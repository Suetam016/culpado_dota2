"""Testes do robô da coleta, sem internet: um OpenDota falso (servidor HTTP local) e um relógio falso.

    python3 coleta/teste_coletar.py      (ou: python3 -m unittest coleta/teste_coletar.py)

O último grupo (BranchDados) roda o fluxo inteiro do workflow com git de verdade: coleta/dados.sh preparar ->
coletar.py -> dados.sh salvar, contra um repositório "origin" local (bare), duas rodadas, com um push de outra
pessoa no meio para exercitar o pull --rebase.
"""
from __future__ import annotations

import contextlib
import gzip
import io
import json
import os
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import coletar as C

LO = C.CONTA_LO
T0 = 1792000800  # 2026-10-14 (UTC); o relógio falso começa aqui
DIA = 86400


def brt(dias_atras: int, hora: int, minuto: int = 0) -> int:
    """Horário de Brasília (UTC-3) no dia T0 - dias_atras."""
    import datetime as dt
    d = (dt.datetime.fromtimestamp(T0, dt.timezone(dt.timedelta(hours=-3))) - dt.timedelta(days=dias_atras)).date()
    return int(dt.datetime(d.year, d.month, d.day, hora, minuto, tzinfo=dt.timezone(dt.timedelta(hours=-3))).timestamp())


def partida(mid: int, inicio: int, radiant, dire, analisada: bool = True) -> dict:
    radiant = list(radiant) + [None] * (5 - len(radiant))
    dire = list(dire) + [None] * (5 - len(dire))
    players = []
    for i, c in enumerate(radiant + dire):
        p = {"account_id": c, "player_slot": i if i < 5 else 128 + i - 5, "hero_id": i + 1,
             "personaname": f"jogador{c}" if c else None, "kills": i}
        if analisada:
            p["gold_t"] = [0, 150, 400, 700]
            p["lh_t"] = [0, 3, 9, 15]
        players.append(p)
    return {"match_id": mid, "start_time": inicio, "duration": 2400, "radiant_win": True, "game_mode": 22,
            "lobby_type": 7, "version": 22 if analisada else None, "players": players}


class Relogio:
    def __init__(self, t: float = T0):
        self.t = float(t)
        self.dormidas: list[float] = []

    def agora(self) -> float:
        return self.t

    def dormir(self, s: float) -> None:
        self.dormidas.append(s)
        self.t += s


class OpenDotaFalso:
    """Imita o que o robô usa da API: /players/<c>/matches, /matches/<id> e POST /request/<id>."""

    def __init__(self):
        self.partidas: dict[int, dict] = {}
        self.analisa_quando_pedir: dict[int, dict] = {}
        self.listas: dict[int, list] = {}
        self.historicos: dict[int, list] = {}  # lista completa (sem ?date=)
        self.cabecalho = "normal"  # "normal", "estranho" (maiúsculas trocadas) ou None
        self.restante_dia = 100000
        self.restante_minuto = 60
        self.erro_429_a_partir = None  # nº da chamada (1, 2, ...)
        self.status_forcado: dict[str, int] = {}
        self.status_partidas = None  # ex.: 502 em todo /matches/<id> (OpenDota fora do ar)
        self.chamadas: list[tuple[str, str]] = []
        self.servidas: dict[int, bytes] = {}
        self.trava = threading.Lock()
        falso = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                falso.responder(self, "GET")

            def do_POST(self):
                falso.responder(self, "POST")

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}/api"

    def fechar(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def lista(self, conta: int, *mids: int):
        self.listas[conta] = [{"match_id": m, "start_time": self.partidas[m]["start_time"], "player_slot": 0,
                               "version": self.partidas[m]["version"]} for m in mids]

    def gets_de_partida(self) -> list[int]:
        return [int(c.split("/")[-1]) for m, c in self.chamadas if m == "GET" and c.startswith("/api/matches/")]

    def posts(self) -> list[int]:
        return [int(c.split("/")[-1]) for m, c in self.chamadas if m == "POST"]

    def responder(self, h, metodo):
        caminho = h.path
        if metodo == "POST":
            h.rfile.read(int(h.headers.get("Content-Length") or 0))
        with self.trava:
            self.chamadas.append((metodo, caminho))
            n = len(self.chamadas)
            self.restante_dia -= 1
            corpo, status = self.rotear(metodo, caminho, n)
        h.send_response(status)
        h.send_header("Content-Type", "application/json; charset=utf-8")
        h.send_header("Content-Length", str(len(corpo)))
        if self.cabecalho == "normal":
            h.send_header("X-Rate-Limit-Remaining-Minute", str(self.restante_minuto))
            h.send_header("X-Rate-Limit-Remaining-Day", str(self.restante_dia))
        elif self.cabecalho == "estranho":
            h.send_header("x-RATE-limit-REMAINING-minute", str(self.restante_minuto))
            h.send_header("X-RATE-LIMIT-REMAINING-DAY", str(self.restante_dia))
        h.end_headers()
        h.wfile.write(corpo)

    def rotear(self, metodo, caminho, n):
        if self.erro_429_a_partir and n >= self.erro_429_a_partir:
            return b'{"error":"rate limit exceeded"}', 429
        base = caminho.split("?")[0]
        if self.status_partidas and base.startswith("/api/matches/"):
            return b'<html>502 Bad Gateway</html>', self.status_partidas
        if base in self.status_forcado:
            return b'{"error":"Internal Server Error"}', self.status_forcado[base]
        partes = base.strip("/").split("/")
        if metodo == "GET" and len(partes) == 4 and partes[1] == "players" and partes[3] == "matches":
            c = int(partes[2])
            lst = self.listas.get(c, []) if "date=" in caminho else self.historicos.get(c, self.listas.get(c, []))
            return json.dumps(lst).encode(), 200
        if metodo == "GET" and len(partes) == 3 and partes[1] == "matches":
            m = self.partidas.get(int(partes[2]))
            if m is None:
                return b'{"error":"Not Found"}', 404
            corpo = json.dumps(m, ensure_ascii=False).encode()
            self.servidas[int(partes[2])] = corpo
            return corpo, 200
        if metodo == "POST" and len(partes) == 3 and partes[1] == "request":
            mid = int(partes[2])
            if mid in self.analisa_quando_pedir:
                self.partidas[mid] = self.analisa_quando_pedir.pop(mid)
            return json.dumps({"job": {"jobId": 123}}).encode(), 200
        return b'{"error":"Not Found"}', 404


# Amigo A: 3 partidas no time do LO em 2 sessões (noites). R: 2 seguidas na mesma noite (completou o time). K: 4 numa
# sessão só que passa da meia-noite (23h -> 1h30). E: 3 partidas em 3 dias, mas no time adversário. Contas ocultas.
A, R, K, E, M = 1001, 2002, 3003, 4004, 5005
OCULTA = 4294967295


def mundo(s: OpenDotaFalso) -> dict:
    lo = {
        101: partida(101, brt(5, 22), [LO, A, None, OCULTA], [E]),
        102: partida(102, brt(5, 23), [LO, A], []),
        103: partida(103, brt(2, 21), [LO, A, R], []),
        104: partida(104, brt(2, 22), [LO, R], [E]),
        105: partida(105, brt(3, 23), [], [LO, K]),
        106: partida(106, brt(3, 23, 50), [LO, K], []),
        107: partida(107, brt(2, 0, 40), [LO, K], []),  # 00:40 do dia seguinte: mesma noite
        108: partida(108, brt(2, 1, 30), [LO, K], [E]),
    }
    amigos = {
        201: partida(201, brt(10, 20), [A], []),
        202: partida(202, brt(0, 10), [A, M], []),  # A e o amigo manual juntos: baixa uma vez só
        203: partida(203, brt(7, 20), [], [M]),
    }
    s.partidas.update(lo)
    s.partidas.update(amigos)
    s.lista(LO, *sorted(lo, reverse=True))  # o OpenDota lista da mais nova para a mais velha
    s.lista(A, 202, 103, 102, 101, 201)
    s.lista(M, 202, 203)
    s.lista(R, 104, 103)  # R não é amigo: a lista dele não deve ser consultada
    return {"lo": lo, "amigos": amigos}


class Base(unittest.TestCase):
    def setUp(self):
        self.s = OpenDotaFalso()
        self.addCleanup(self.s.fechar)
        self.dir = Path(tempfile.mkdtemp(prefix="coleta-teste-"))
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.dados = self.dir / "dados"
        self.amigos_site = self.dir / "amigos.json"
        self.amigos_site.write_text(json.dumps({str(LO): "Suéter", str(M): "Manual"}, ensure_ascii=False))
        self.rel = Relogio()
        env = {k: v for k, v in os.environ.items() if not k.startswith(("GITHUB_", "COLETA_", "OPENDOTA_"))}
        p = mock.patch.dict(os.environ, env, clear=True)
        p.start()
        self.addCleanup(p.stop)

    def rodar(self, *extra: str, dados: Path | None = None) -> tuple[int, str]:
        args = ["--dados", str(dados or self.dados), "--amigos", str(self.amigos_site), "--api", self.s.url, *extra]
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            rc = C.main(args, relogio=self.rel.agora, dormir=self.rel.dormir)
        return rc, saida.getvalue()

    def ler(self, nome: str):
        return json.loads((self.dados / nome).read_text(encoding="utf-8"))


class Unidades(unittest.TestCase):
    def test_cabecalhos_sem_diferenciar_maiusculas(self):
        h = {"x-RATE-limit-REMAINING-day": "250", "X-Rate-Limit-Remaining-Minute": " 59 ", "Content-Type": "x",
             "X-Rate-Limit-Remaining-Month": "abc"}
        self.assertEqual(C.ler_cabecalhos_de_limite(h), {"dia": 250, "minuto": 59})

    def test_sessoes_pela_pausa_e_nao_pelo_relogio(self):
        s = C.sessoes([brt(3, 23, 50), brt(2, 1, 30), brt(2, 5, 0), brt(2, 6, 30), brt(2, 21, 0), brt(1, 4, 0)])
        self.assertEqual(len(set(s.values())), 2, "23:50 -> 6:30 sem pausa de 7 h é uma sessão só")
        self.assertEqual(s[brt(3, 23, 50)], s[brt(2, 6, 30)])
        self.assertNotEqual(s[brt(2, 6, 30)], s[brt(2, 21, 0)], "14 h30 depois: outra sessão")
        self.assertEqual(s[brt(2, 21, 0)], s[brt(1, 4, 0)], "21h -> 4h com só 7 h entre inícios: mesma sessão")

    def test_aleatorio_numa_sessao_que_cruza_horario_fixo_nao_vira_amigo(self):
        # achado da revisão: 05:00, 05:45 e 06:30 contavam "3 jogos em 2 dias" com o corte às 6h
        lo = {str(i): {"inicio": t, "companheiros": [R]} for i, t in
              enumerate((brt(2, 5, 0), brt(2, 5, 45), brt(2, 6, 30)))}
        amigos, quase = C.detectar_amigos(lo, {}, T0)
        self.assertEqual(amigos, {})
        self.assertEqual((quase[R]["jogos"], quase[R]["sessoes"]), (3, 1))
        # meia-noite também não separa
        lo = {str(i): {"inicio": t, "companheiros": [R]} for i, t in
              enumerate((brt(3, 23, 0), brt(2, 0, 10), brt(2, 1, 20)))}
        self.assertEqual(C.detectar_amigos(lo, {}, T0)[0], {})

    def test_sessao_usa_a_agenda_inteira_do_lo(self):
        # X jogou com o LO às 20h e às 3h30 (7h30 entre as duas), mas o LO jogou a noite toda: uma sessão só. As
        # partidas do meio são só do LO (vêm da lista do OpenDota, nem precisam estar baixadas).
        lo = {"1": {"inicio": brt(3, 20), "companheiros": [R]}, "2": {"inicio": brt(2, 3, 30), "companheiros": [R]},
              "3": {"inicio": brt(2, 4, 0), "companheiros": [R]}}
        self.assertEqual(set(C.detectar_amigos(lo, {}, T0)[0]), {R}, "sem a agenda do LO pareceriam 2 sessões")
        agenda = [brt(3, h) for h in (21, 22, 23)] + [brt(2, h) for h in (0, 1, 2)]
        amigos, quase = C.detectar_amigos(lo, {}, T0, inicios_lo=agenda)
        self.assertEqual(amigos, {})
        self.assertEqual(quase[R]["sessoes"], 1)

    def test_regra_dos_amigos(self):
        lo = {"1": {"inicio": brt(5, 22), "companheiros": [A]}, "2": {"inicio": brt(5, 23), "companheiros": [A, R]},
              "3": {"inicio": brt(5, 23, 40), "companheiros": [R]}, "4": {"inicio": brt(2, 21), "companheiros": [A]},
              "5": {"inicio": brt(20, 21), "companheiros": [R]}}  # fora da janela de 14 dias
        amigos, quase = C.detectar_amigos(lo, {str(A): "a"}, T0)
        self.assertEqual(set(amigos), {A})
        self.assertEqual(amigos[A]["jogos"], 3)
        self.assertEqual(amigos[A]["sessoes"], 2)
        self.assertEqual(amigos[A]["nome"], "a")
        self.assertEqual(set(quase), {R}, "2 seguidas na mesma noite não fazem amigo")

    def test_analisada(self):
        self.assertTrue(C.analisada(partida(1, T0, [LO], [])))
        self.assertFalse(C.analisada(partida(1, T0, [LO], [], analisada=False)))
        m = partida(1, T0, [LO], [])
        for p in m["players"]:
            p["gold_t"] = None
        self.assertFalse(C.analisada(m), "version sem gold_t não conta")


class Rodadas(Base):
    def test_rodada_completa(self):
        w = mundo(self.s)
        rc, log = self.rodar()
        self.assertEqual(rc, 0, log)
        # ordem: as do LO da mais velha para a mais nova; depois as dos amigos, também da mais velha
        lo_ordem = sorted(w["lo"], key=lambda m: w["lo"][m]["start_time"])
        amigos_ordem = sorted(w["amigos"], key=lambda m: w["amigos"][m]["start_time"])
        self.assertEqual(self.s.gets_de_partida(), lo_ordem + amigos_ordem)
        self.assertEqual(self.s.posts(), [])
        # listas: a do LO, depois só as dos amigos (A detectado + M manual); nunca a do R
        listas = [c for m, c in self.s.chamadas if "/players/" in c and "date=" in c]
        self.assertEqual(listas[0], f"/api/players/{LO}/matches?date=14&significant=0")
        self.assertEqual(sorted(listas[1:]), sorted(f"/api/players/{c}/matches?date=14&significant=0" for c in (A, M)))
        self.assertTrue(all(f"/players/{R}/" not in c for m, c in self.s.chamadas))
        # fase histórica, ligada por padrão: o histórico completo de cada um, depois de tudo dos 14 dias
        hist = [c for m, c in self.s.chamadas if "/players/" in c and "date=" not in c]
        self.assertEqual(sorted(hist), sorted(f"/api/players/{c}/matches?significant=0" for c in (LO, A, M)))
        self.assertGreater([c for m, c in self.s.chamadas].index(hist[0]),
                           max(i for i, (m, c) in enumerate(self.s.chamadas) if "/matches/" in c))
        # amigos.json do branch dados
        am = self.ler("amigos.json")
        self.assertEqual(set(am["amigos"]), {str(A), str(M)})
        self.assertEqual(am["amigos"][str(A)]["jogos"], 3)
        self.assertEqual(am["amigos"][str(A)]["sessoes"], 2)
        self.assertEqual(am["amigos"][str(A)]["fonte"], "detectado")
        self.assertEqual(am["amigos"][str(A)]["nome"], f"jogador{A}")
        self.assertEqual(am["amigos"][str(M)]["fonte"], "manual")
        self.assertEqual(am["amigos"][str(M)]["nome"], "Manual")
        self.assertEqual(am["quase"][str(R)]["jogos"], 2)
        self.assertEqual((am["quase"][str(K)]["jogos"], am["quase"][str(K)]["sessoes"]), (4, 1), "uma noite só não basta")
        self.assertNotIn(str(E), am["amigos"])
        self.assertNotIn(str(E), am["quase"], "adversário não conta")
        self.assertNotIn(str(OCULTA), json.dumps(am))
        # índice e arquivos
        ind = self.ler("indice.json")
        self.assertEqual(set(ind), {str(m) for m in [*w["lo"], *w["amigos"]]})
        e = ind["101"]
        self.assertEqual(e["radiant"], [A, LO])
        self.assertEqual(e["dire"], [E])
        self.assertEqual(e["grupo"], [A, LO])
        self.assertTrue(e["analisada"])
        self.assertEqual(e["bytes"], (self.dados / "partidas" / "101.json.gz").stat().st_size)
        self.assertEqual(ind["202"]["grupo"], [A, M])
        self.assertTrue((self.dados / "README.md").exists())
        self.assertFalse((self.dados / ".tmp").exists())
        est = self.ler("estado.json")
        self.assertEqual(est["pendentes"], {})
        self.assertEqual(est["rodadas"][-1]["fim"], "fila vazia")
        self.assertEqual(est["cota"]["cabecalhos_primeira_resposta"]["X-Rate-Limit-Remaining-Day"], str(100000 - 1))
        self.assertIn("cabeçalhos de limite da primeira resposta", log)

    def test_gzip_valido_e_igual_ao_que_veio(self):
        mundo(self.s)
        self.rodar()
        for arq in (self.dados / "partidas").glob("*.json.gz"):
            mid = int(arq.name.split(".")[0])
            bruto = gzip.decompress(arq.read_bytes())
            self.assertEqual(bruto, self.s.servidas[mid], "guarda a resposta crua, byte a byte")
            m = json.loads(bruto)
            self.assertEqual(m["match_id"], mid)
            self.assertTrue(m["players"][0]["gold_t"])

    def test_nao_baixa_de_novo(self):
        w = mundo(self.s)
        self.rodar()
        antes = {a.name: a.read_bytes() for a in (self.dados / "partidas").iterdir()}
        self.assertEqual(sorted(self.s.gets_de_partida()), sorted([*w["lo"], *w["amigos"]]), "202 baixada uma vez só")
        self.s.chamadas.clear()
        self.rel.t += 3 * 3600
        # partida nova do LO com o A
        self.s.partidas[109] = partida(109, int(self.rel.t) - 3600, [LO, A], [])
        self.s.lista(LO, 109, *sorted(w["lo"], reverse=True))
        rc, log = self.rodar()
        self.assertEqual(rc, 0, log)
        self.assertEqual(self.s.gets_de_partida(), [109])
        depois = {a.name: a.read_bytes() for a in (self.dados / "partidas").iterdir()}
        self.assertEqual({k: v for k, v in depois.items() if k != "109.json.gz"}, antes)
        self.assertEqual(self.ler("amigos.json")["amigos"][str(A)]["jogos"], 4)

    def test_lista_de_amigo_so_de_tempos_em_tempos(self):
        mundo(self.s)
        self.rodar()
        self.s.chamadas.clear()
        self.rel.t += 1800
        self.rodar()
        self.assertEqual([c for m, c in self.s.chamadas], [f"/api/players/{LO}/matches?date=14&significant=0"])
        self.s.chamadas.clear()
        self.rel.t += C.INTERVALO_LISTA_AMIGO_S
        self.rodar()
        self.assertEqual(len([c for m, c in self.s.chamadas if "/players/" in c]), 3)

    def test_arquivo_ja_baixado_fora_do_indice(self):
        w = mundo(self.s)
        bruto = json.dumps(w["lo"][101]).encode()
        (self.dados / "partidas").mkdir(parents=True)
        (self.dados / "partidas" / "101.json.gz").write_bytes(gzip.compress(bruto))
        (self.dados / "partidas" / "999.json.gz").write_bytes(b"lixo")  # estragado: baixa de novo
        _, log = self.rodar()
        self.assertNotIn(101, self.s.gets_de_partida())
        self.assertIn("101", self.ler("indice.json"))
        self.assertIn("999.json.gz estragado", log)
        self.assertIn("arquivos já baixados entraram no índice", log)


class Cota(Base):
    def test_para_na_reserva_com_cabecalho(self):
        mundo(self.s)
        self.s.restante_dia = 205
        rc, log = self.rodar("--reserva", "200")
        self.assertEqual(rc, 0)
        self.assertEqual(len(self.s.chamadas), 5, "a 5ª resposta diz 200 restantes: para")
        fim = self.ler("estado.json")["rodadas"][-1]["fim"]
        self.assertIn("reserva atingida", fim)
        self.assertIn("200", fim)
        self.assertIn("Restante do dia: 200", log)

    def test_depois_da_reserva_nao_chama_ate_o_dia_seguinte_ou_a_sonda(self):
        # achado da revisão: cada rodada de hora em hora gastava 1 chamada da reserva só para ver que tinha acabado
        w = mundo(self.s)
        self.assertEqual(C.iso(T0)[11:16], "18:00", "o teste conta com a virada do dia UTC 6 h depois")
        self.s.restante_dia = 201
        por_rodada = []
        for _ in range(12):  # 18:00 -> 05:00 UTC
            antes = len(self.s.chamadas)
            rc, log = self.rodar("--reserva", "200")
            self.assertEqual(rc, 0, log)
            por_rodada.append(len(self.s.chamadas) - antes)
            self.rel.t += 3600
        # 18:00 chega na reserva; 00:00 é outro dia UTC (1 chamada); depois, nada até a sonda das 06:00
        self.assertEqual(por_rodada, [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0])
        est = self.ler("estado.json")
        self.assertEqual(est["parada_reserva"]["restante"], 199)
        self.assertIn("reserva já atingida hoje", est["rodadas"][-1]["fim"])
        self.assertEqual(est["cota"]["restante"]["dia"], 199, "rodada sem chamadas mantém a última leitura")
        self.assertIn("Restante do dia: 199 na última leitura", log)
        # 06:00: sonda. O OpenDota zerou o dia: volta a baixar normalmente e esquece a parada
        self.s.restante_dia = 5000
        rc, log = self.rodar("--reserva", "200")
        self.assertEqual(len(self.ler("indice.json")), len(w["lo"]) + len(w["amigos"]))
        est = self.ler("estado.json")
        self.assertNotIn("parada_reserva", est)
        self.assertEqual(est["rodadas"][-1]["fim"], "fila vazia")

    def test_cabecalho_com_maiusculas_trocadas(self):
        mundo(self.s)
        self.s.cabecalho = "estranho"
        self.s.restante_dia = 203
        self.rodar("--reserva", "200")
        self.assertEqual(len(self.s.chamadas), 3)

    def test_com_cabecalho_nao_tem_orcamento_por_rodada(self):
        w = mundo(self.s)
        self.rodar("--orcamento-sem-cabecalho", "3")
        self.assertEqual(len(self.s.gets_de_partida()), len(w["lo"]) + len(w["amigos"]))

    def test_sem_cabecalho_orcamento_por_rodada_e_teto_do_dia(self):
        mundo(self.s)
        self.s.cabecalho = None
        _, log = self.rodar("--orcamento-sem-cabecalho", "4", "--teto-dia", "10", "--reserva", "3")
        self.assertEqual(len(self.s.chamadas), 4)
        self.assertIn("SEM cabeçalho de limite", log)
        hoje = C.iso(self.rel.t)[:10]
        self.assertEqual(self.ler("estado.json")["uso"][hoje], 4)
        self.assertIn("orçamento da rodada", self.ler("estado.json")["rodadas"][-1]["fim"])
        self.rel.t += 3600
        self.rodar("--orcamento-sem-cabecalho", "4", "--teto-dia", "10", "--reserva", "3")
        self.assertEqual(len(self.s.chamadas), 7, "teto 10 - reserva 3 = 7 no dia")
        self.assertIn("teto diário", self.ler("estado.json")["rodadas"][-1]["fim"])
        self.rel.t += 3600
        self.rodar("--orcamento-sem-cabecalho", "4", "--teto-dia", "10", "--reserva", "3")
        self.assertEqual(len(self.s.chamadas), 7, "o dia acabou para o robô")
        self.assertEqual(self.ler("estado.json")["uso"][hoje], 7)

    def test_429_para_a_rodada_e_guarda_o_que_tem(self):
        w = mundo(self.s)
        self.s.erro_429_a_partir = 4  # lista do LO, 2 partidas, 429
        rc, log = self.rodar()
        self.assertEqual(rc, 0, log)
        self.assertEqual(len(self.s.chamadas), 4)
        ind = self.ler("indice.json")
        self.assertEqual(len(ind), 2)
        self.assertIn("429", self.ler("estado.json")["rodadas"][-1]["fim"])
        for k in ind:
            self.assertTrue((self.dados / "partidas" / f"{k}.json.gz").exists())
        # na rodada seguinte continua de onde parou, sem baixar as 2 de novo
        self.s.erro_429_a_partir = None
        self.s.chamadas.clear()
        self.rel.t += 3600
        self.rodar()
        self.assertEqual(len(self.ler("indice.json")), len(w["lo"]) + len(w["amigos"]))
        self.assertFalse(set(self.s.gets_de_partida()) & {int(k) for k in ind})

    def test_429_so_no_pedido_de_analise_segue_baixando(self):
        self.s.partidas[301] = partida(301, int(T0) - 5 * 3600, [LO], [], analisada=False)
        self.s.partidas[303] = partida(303, int(T0) - 4 * 3600, [LO], [], analisada=False)
        self.s.partidas[302] = partida(302, int(T0) - 3 * 3600, [LO], [])
        self.s.lista(LO, 302, 303, 301)
        self.s.status_forcado["/api/request/301"] = 429
        rc, log = self.rodar()
        self.assertEqual(rc, 0, log)
        self.assertEqual(self.s.posts(), [301], "depois do 429 não pede mais nesta rodada")
        self.assertEqual(self.s.gets_de_partida(), [301, 303, 302])
        self.assertIn("302", self.ler("indice.json"))
        pend = self.ler("estado.json")["pendentes"]
        self.assertIsNone(pend["301"]["pedido_em"])
        self.assertIsNone(pend["303"]["pedido_em"])
        self.assertEqual(self.ler("estado.json")["rodadas"][-1]["fim"], "fila vazia")
        # na rodada seguinte pede as duas
        del self.s.status_forcado["/api/request/301"]
        self.rel.t += 3600
        self.rodar()
        self.assertEqual(self.s.posts(), [301, 301, 303])

    def test_429_geral_no_pedido_de_analise_encerra_na_chamada_seguinte(self):
        self.s.partidas[301] = partida(301, int(T0) - 5 * 3600, [LO], [], analisada=False)
        self.s.partidas[302] = partida(302, int(T0) - 3 * 3600, [LO], [])
        self.s.lista(LO, 302, 301)
        self.s.erro_429_a_partir = 3  # lista, GET 301, POST 301 (429), GET 302 (429)
        self.rodar()
        self.assertEqual(len(self.s.chamadas), 4)
        self.assertIn("429", self.ler("estado.json")["rodadas"][-1]["fim"])
        self.assertNotIn("302", self.ler("indice.json"))

    def test_pausa_entre_chamadas_e_limite_por_minuto(self):
        mundo(self.s)
        self.rodar()
        n = len(self.s.chamadas)
        pausas = [d for d in self.rel.dormidas if d > 0]
        self.assertGreaterEqual(len(pausas), n - 1)
        self.assertTrue(all(abs(d - C.PAUSA_S) < 0.01 for d in pausas))
        self.rel.dormidas.clear()
        self.s.restante_minuto = 1
        self.s.chamadas.clear()
        self.rel.t += 3 * 3600
        self.rodar()
        self.assertIn(61, self.rel.dormidas)

    def test_tempo_maximo(self):
        mundo(self.s)
        self.rodar("--tempo-max", "5", "--pausa", "2")  # 3 chamadas e acabou o tempo
        self.assertEqual(len(self.s.chamadas), 3)
        self.assertEqual(self.ler("estado.json")["rodadas"][-1]["fim"], "tempo máximo da rodada")


class Historico(Base):
    """Fase opcional (COLETA_HISTORICO=1): partidas antigas que o OpenDota já analisou, com a sobra da cota."""

    def setUp(self):
        super().setUp()
        self.w = mundo(self.s)
        velhas = {601: partida(601, int(T0) - 40 * DIA, [LO], []), 602: partida(602, int(T0) - 20 * DIA, [LO, A], []),
                  603: partida(603, int(T0) - 25 * DIA, [LO], [], analisada=False),
                  604: partida(604, int(T0) - 30 * DIA, [A], [])}
        self.s.partidas.update(velhas)
        self.s.historicos[LO] = [{"match_id": m, "start_time": self.s.partidas[m]["start_time"],
                                  "version": self.s.partidas[m]["version"]} for m in (*self.w["lo"], 602, 603, 601)]
        self.s.historicos[A] = [{"match_id": 604, "start_time": velhas[604]["start_time"], "version": 22}]

    def test_ligada_por_padrao_e_0_desliga(self):
        with mock.patch.dict(os.environ, {"COLETA_HISTORICO": "0"}):
            self.rodar()
        self.assertFalse([c for m, c in self.s.chamadas if "/players/" in c and "date=" not in c])
        self.assertNotIn("601", self.ler("indice.json"))
        self.rel.t += 3600
        _, log = self.rodar()  # sem a variável: ligada
        self.assertIn("601", self.ler("indice.json"))
        self.assertIn("histórico antigo: 3", log)

    def test_baixa_antigas_analisadas_depois_das_recentes(self):
        with mock.patch.dict(os.environ, {"COLETA_HISTORICO": "1"}):
            rc, log = self.rodar()
        self.assertEqual(rc, 0, log)
        gets = self.s.gets_de_partida()
        recentes = len(self.w["lo"]) + len(self.w["amigos"])
        self.assertEqual(sorted(gets[:recentes]), sorted([*self.w["lo"], *self.w["amigos"]]))
        self.assertEqual(gets[recentes:], [602, 604, 601], "das mais novas para as mais velhas; a 603 não tem análise")
        ind = self.ler("indice.json")
        self.assertTrue(all(ind[str(m)]["analisada"] for m in (601, 602, 604)))
        self.assertNotIn("603", ind)
        self.assertIn("histórico antigo: 3", log)
        # o histórico completo é consultado uma vez por dia
        self.s.chamadas.clear()
        self.rel.t += 3 * 3600
        with mock.patch.dict(os.environ, {"COLETA_HISTORICO": "1"}):
            self.rodar()
        self.assertFalse([c for m, c in self.s.chamadas if "/players/" in c and "date=" not in c])
        self.assertEqual(self.s.gets_de_partida(), [])


class Analise(Base):
    def setUp(self):
        super().setUp()
        self.ini = int(T0) - 2 * 3600
        self.s.partidas[301] = partida(301, self.ini, [LO, A], [], analisada=False)
        self.s.lista(LO, 301)

    def test_pede_analise_e_tenta_de_novo(self):
        self.s.analisa_quando_pedir[301] = partida(301, self.ini, [LO, A], [])
        self.rodar()
        self.assertEqual(self.s.gets_de_partida(), [301])
        self.assertEqual(self.s.posts(), [301])
        p = self.ler("estado.json")["pendentes"]["301"]
        self.assertEqual(p["tentativas"], 0)
        self.assertEqual(p["pedido_em"][:13], C.iso(T0)[:13])
        self.assertNotIn("301", self.ler("indice.json"))
        # 10 min depois: ainda não é hora
        self.rel.t += 600
        self.rodar()
        self.assertEqual(self.s.gets_de_partida(), [301])
        # na rodada da hora seguinte: analisada, salva, sai dos pendentes; sem segundo pedido
        self.rel.t += 3000
        self.rodar()
        self.assertEqual(self.s.gets_de_partida(), [301, 301])
        self.assertEqual(self.s.posts(), [301])
        self.assertTrue(self.ler("indice.json")["301"]["analisada"])
        self.assertEqual(self.ler("estado.json")["pendentes"], {})

    def test_espera_cresce_e_desiste_em_3_dias(self):
        self.rodar()
        self.assertEqual(self.s.posts(), [301])
        gets = 1
        for _ in range(200):  # rodadas de hora em hora por ~4 dias
            self.rel.t += 3600
            self.rodar()
            if "301" in self.ler("indice.json"):
                break
        n_gets = len(self.s.gets_de_partida())
        self.assertLess(n_gets, 15, "espera crescente: poucas consultas em 3 dias")
        self.assertGreater(n_gets, gets)
        self.assertEqual(self.s.posts(), [301], "pede a análise uma vez só")
        e = self.ler("indice.json")["301"]
        self.assertFalse(e["analisada"], "guarda os dados básicos")
        self.assertIn("3 dias", self.ler("estado.json")["desistencias"]["301"]["motivo"])
        self.assertTrue(3 * DIA <= self.rel.t - T0 <= 4 * DIA)
        self.rel.t += 3600
        self.rodar()
        self.assertEqual(len(self.s.gets_de_partida()), n_gets, "a partida não é consultada de novo")

    def test_partida_velha_desiste_sem_pedir(self):
        self.s.partidas[302] = partida(302, int(T0) - 16 * DIA, [LO], [], analisada=False)
        self.s.lista(LO, 302)
        self.rodar()
        self.assertEqual(self.s.posts(), [])
        self.assertFalse(self.ler("indice.json")["302"]["analisada"])
        self.assertIn("15 dias", self.ler("estado.json")["desistencias"]["302"]["motivo"])


class Falhas(Base):
    def test_base_estragada_nao_grava_nada(self):
        mundo(self.s)
        self.dados.mkdir()
        (self.dados / "indice.json").write_text("{quebrado")
        (self.dados / "estado.json").write_text('{"uso": {}}')
        rc, _ = self.rodar()
        self.assertEqual(rc, 2)
        self.assertEqual(self.s.chamadas, [])
        self.assertEqual((self.dados / "indice.json").read_text(), "{quebrado")
        self.assertEqual((self.dados / "estado.json").read_text(), '{"uso": {}}')
        self.assertFalse((self.dados / "amigos.json").exists())

    def test_erro_numa_partida_nao_apaga_nada(self):
        w = mundo(self.s)
        self.rodar()
        ind_antes = self.ler("indice.json")
        arquivos = {a.name: a.read_bytes() for a in (self.dados / "partidas").iterdir()}
        # rodada seguinte: partida nova com erro 500 e o OpenDota caindo de vez
        self.rel.t += 3 * 3600
        self.s.partidas[110] = partida(110, int(self.rel.t) - 7200, [LO], [])
        self.s.partidas[111] = partida(111, int(self.rel.t) - 3600, [LO], [])
        self.s.lista(LO, 111, 110, *sorted(w["lo"], reverse=True))
        self.s.status_forcado["/api/matches/110"] = 500
        rc, log = self.rodar()
        self.assertEqual(rc, 0, log)
        ind = self.ler("indice.json")
        self.assertEqual(ind_antes, {k: v for k, v in ind.items() if k != "111"})
        self.assertIn("111", ind)
        f = self.ler("estado.json")["falhas"]["110"]
        self.assertEqual((f["n"], f["t"]), (0, 1), "500 é erro do OpenDota: só adia, não conta para descartar")
        for nome, conteudo in arquivos.items():
            self.assertEqual((self.dados / "partidas" / nome).read_bytes(), conteudo)
        # API fora do ar: para depois de 5 erros seguidos, sem estragar nada
        self.rel.t += 3600
        self.s.status_forcado.update({f"/api/matches/{m}": 502 for m in range(400, 410)})
        for m in range(400, 410):
            self.s.partidas[m] = partida(m, int(self.rel.t) - 5000 + m, [LO], [])
        self.s.lista(LO, *range(400, 410))
        rc, log = self.rodar()
        self.assertEqual(rc, 0)
        self.assertIn("5 chamadas seguidas", self.ler("estado.json")["rodadas"][-1]["fim"])
        self.assertTrue(set(ind) <= set(self.ler("indice.json")))

    def test_queda_do_opendota_nao_descarta_partidas(self):
        # achado da revisão: 3 rodadas com 502 em /matches descartavam para sempre as 5 mais antigas do LO (e o
        # resumo dizia "Faltam: 0")
        w = mundo(self.s)
        self.s.status_partidas = 502
        for _ in range(3):
            rc, log = self.rodar()
            self.assertEqual(rc, 0, log)
            est = self.ler("estado.json")
            self.assertIn("5 chamadas seguidas", est["rodadas"][-1]["fim"])
            self.assertGreater(est["rodadas"][-1]["faltam"], 0)
            self.rel.t += 3600
        self.assertEqual(est["desistencias"], {})
        self.assertGreaterEqual(len(est["falhas"]), 5)
        self.assertTrue(all(f["n"] == 0 for f in est["falhas"].values()), est["falhas"])
        self.assertGreaterEqual(max(f["t"] for f in est["falhas"].values()), 2, "a espera cresce mesmo assim")
        self.assertEqual(self.ler("indice.json"), {})
        # o OpenDota volta: em poucas horas está tudo baixado, inclusive as 5 mais antigas do LO
        self.s.status_partidas = None
        for _ in range(4):
            self.rodar()
            self.rel.t += 3600
        self.assertEqual(set(self.ler("indice.json")), {str(m) for m in [*w["lo"], *w["amigos"]]})
        est = self.ler("estado.json")
        self.assertEqual((est["falhas"], est["desistencias"]), ({}, {}))
        self.assertEqual(set(est["lo"]), {str(m) for m in w["lo"]}, "todas as partidas do LO contam para os amigos")
        self.assertIn(str(A), self.ler("amigos.json")["amigos"])

    def test_erro_que_se_repete_descarta_e_aparece_no_resumo(self):
        w = mundo(self.s)
        self.s.status_forcado["/api/matches/105"] = 404
        resumo = self.dir / "resumo.md"
        with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(resumo)}):
            for _ in range(8):
                self.rodar()
                self.rel.t += 3600
        est = self.ler("estado.json")
        d = est["desistencias"]["105"]
        self.assertIs(d["salva"], False)
        self.assertIn("HTTP 404 (3 vezes)", d["motivo"])
        self.assertEqual(d["inicio"], w["lo"][105]["start_time"])
        self.assertNotIn("105", est["falhas"])
        self.assertNotIn("105", self.ler("indice.json"))
        self.assertEqual(self.s.gets_de_partida().count(105), 3, "não volta para a fila depois de descartada")
        self.assertEqual(len(self.ler("indice.json")), len(w["lo"]) + len(w["amigos"]) - 1)
        txt = resumo.read_text(encoding="utf-8")
        self.assertIn("Descartadas sem nenhum dado (erro que se repete): 1 nesta rodada; 1 anotadas em estado.json (105)",
                      txt)
        self.assertIn("105", [k for r in est["rodadas"] for k in r["descartadas"]])

    def test_5xx_isolado_so_adia_e_desiste_pela_idade(self):
        self.s.partidas[701] = partida(701, int(T0) - 3 * DIA, [LO], [])
        self.s.partidas[702] = partida(702, int(T0) - 2 * DIA, [LO], [])
        self.s.partidas[703] = partida(703, int(T0) - int(15.05 * DIA), [LO], [])
        self.s.partidas[704] = partida(704, int(T0) - int(14.6 * DIA), [LO], [])
        self.s.lista(LO, 702, 701, 704, 703)
        for m in (701, 703, 704):
            self.s.status_forcado[f"/api/matches/{m}"] = 500
        for i in range(24):
            self.rodar()
            if i == 0:
                self.s.lista(LO, 702, 701, 703)  # a 704 sai da janela de 14 dias do OpenDota
            self.rel.t += 3600
        est = self.ler("estado.json")
        f = est["falhas"]["701"]
        self.assertEqual(f["n"], 0, "erro do OpenDota não conta para descartar")
        self.assertEqual(f["t"], 6)
        self.assertEqual(self.s.gets_de_partida().count(701), 6, "espera 30 min, 1 h, 2 h, 4 h, 8 h, 12 h")
        self.assertEqual(C.de_iso(f["proxima"]) - C.de_iso(f["quando"]), 12 * 3600)
        self.assertIn("702", self.ler("indice.json"))
        self.assertIn("HTTP 500 (6 vezes, partida com mais de 15 dias)", est["desistencias"]["703"]["motivo"])
        self.assertIn("saiu da lista sem conseguir baixar", est["desistencias"]["704"]["motivo"])
        self.assertTrue(all(est["desistencias"][k]["salva"] is False for k in ("703", "704")))
        self.assertNotIn("701", est["desistencias"])

    def test_amigos_do_site_nao_mudam_e_resumo_no_github(self):
        mundo(self.s)
        antes = self.amigos_site.read_bytes()
        resumo = self.dir / "resumo.md"
        saida = self.dir / "saida.txt"
        with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(resumo), "GITHUB_OUTPUT": str(saida)}):
            self.rodar()
        self.assertEqual(self.amigos_site.read_bytes(), antes)
        txt = resumo.read_text(encoding="utf-8")
        for trecho in ("Chamadas ao OpenDota nesta rodada", "Restante do dia: 99", "Partidas novas salvas: **11**",
                       "Amigos detectados: jogador1001", "Quase", "Faltam: 0", "Fim da rodada: fila vazia",
                       f"Sobra da cota do dia acima da reserva: {1800 - len(self.s.chamadas)} (a fila esvaziou"):
            self.assertIn(trecho, txt)
        self.assertIn("novas=11", saida.read_text())


@unittest.skipUnless(shutil.which("git") and shutil.which("bash"), "precisa de git e bash")
class BranchDados(Base):
    """O fluxo do workflow com git de verdade, contra um 'origin' local."""

    def sh(self, *args, cwd=None, ok=True, env_extra=None):
        env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
               "DADOS_REMOTO": f"file://{self.origem}", **(env_extra or {})}
        env.pop("GH_TOKEN", None)
        r = subprocess.run(args, cwd=cwd or self.dir, env=env, capture_output=True, text=True, check=False)
        if ok and r.returncode != 0:
            self.fail(f"{args} saiu com {r.returncode}:\n{r.stdout}\n{r.stderr}")
        return r

    def git_origem(self, *args) -> str:
        return self.sh("git", "-C", str(self.origem), *args).stdout

    def test_duas_rodadas_com_push_de_outro_no_meio(self):
        self.origem = self.dir / "origem.git"
        self.sh("git", "init", "--quiet", "--bare", "-b", "main", str(self.origem))
        self.sh("git", "-C", str(self.origem), "config", "uploadpack.allowFilter", "true")
        script = str(AQUI / "dados.sh")
        w = mundo(self.s)
        # rodada 1: o branch ainda não existe
        r = self.sh("bash", script, "preparar", "d1")
        self.assertIn("ainda não existe", r.stdout)
        self.assertIn("push para o branch dados: ok", r.stdout)
        rc, log = self.rodar(dados=self.dir / "d1")
        self.assertEqual(rc, 0, log)
        (self.dir / "d1" / ".tmp").mkdir()
        (self.dir / "d1" / ".tmp" / "lixo").write_text("x")  # sobra de gravação: não vai para o commit
        r = self.sh("bash", script, "salvar", "d1", "Coleta: rodada 1")
        self.assertIn("salvo no branch dados", r.stdout)
        arvore1 = self.git_origem("ls-tree", "-r", "dados").splitlines()
        nomes1 = sorted(linha.split("\t")[1] for linha in arvore1)
        n = len(w["lo"]) + len(w["amigos"])
        self.assertEqual(len([x for x in nomes1 if x.startswith("partidas/")]), n)
        self.assertTrue({"indice.json", "estado.json", "amigos.json", "README.md"} <= set(nomes1))
        self.assertFalse(any(".tmp" in x for x in nomes1))
        self.assertEqual(self.git_origem("rev-list", "--count", "dados").strip(), "1")
        self.assertEqual(self.git_origem("for-each-ref", "--format=%(refname)").split(), ["refs/heads/dados"])

        # rodada 2: clone parcial (sem partidas/), partida nova, e alguém empurra no branch no meio
        r = self.sh("bash", script, "preparar", "d2")
        self.assertIn(f"partidas no branch: {n}", r.stdout)
        self.assertIn("push para o branch dados: ok", r.stdout)
        self.assertFalse((self.dir / "d2" / "partidas").exists(), "partidas/ não é baixado")
        self.assertTrue((self.dir / "d2" / "indice.json").exists())
        self.sh("git", "clone", "--quiet", "--branch", "dados", f"file://{self.origem}", "outro")
        (self.dir / "outro" / "NOTA.txt").write_text("anotação do LO\n")
        self.sh("git", "-C", "outro", "add", "NOTA.txt")
        self.sh("git", "-C", "outro", "-c", "user.name=LO", "-c", "user.email=lo@x", "commit", "--quiet", "-m", "nota")
        self.sh("git", "-C", "outro", "push", "--quiet", "origin", "dados")

        self.s.chamadas.clear()
        self.rel.t += 3 * 3600
        self.s.partidas[109] = partida(109, int(self.rel.t) - 3600, [LO, A], [])
        self.s.lista(LO, 109, *sorted(w["lo"], reverse=True))
        rc, log = self.rodar(dados=self.dir / "d2")
        self.assertEqual(rc, 0, log)
        self.assertEqual(self.s.gets_de_partida(), [109], "o índice basta para não baixar de novo")
        r = self.sh("bash", script, "salvar", "d2", "Coleta: rodada 2")
        self.assertIn("push recusado", r.stdout)
        self.assertIn("salvo no branch dados", r.stdout)
        arvore2 = self.git_origem("ls-tree", "-r", "dados").splitlines()
        self.assertTrue({linha for linha in arvore1 if "partidas/" in linha} <= set(arvore2),
                        "nenhuma partida apagada nem alterada")
        nomes2 = {linha.split("\t")[1] for linha in arvore2}
        self.assertIn("partidas/109.json.gz", nomes2)
        self.assertIn("NOTA.txt", nomes2, "o push do outro ficou")
        self.assertEqual(self.git_origem("rev-list", "--count", "dados").strip(), "3")
        ind = json.loads(self.git_origem("show", "dados:indice.json"))
        self.assertEqual(len(ind), n + 1)
        bruto = subprocess.run(["git", "-C", str(self.origem), "show", "dados:partidas/109.json.gz"],
                               capture_output=True, check=True).stdout
        self.assertEqual(json.loads(gzip.decompress(bruto))["match_id"], 109)
        # rodada 3 sem nada novo: não cria commit
        self.sh("bash", script, "preparar", "d3")
        self.rel.t += 1800
        self.s.chamadas.clear()
        self.rodar(dados=self.dir / "d3")
        self.assertEqual(self.s.gets_de_partida(), [])
        r = self.sh("bash", script, "salvar", "d3", "Coleta: rodada 3")
        self.assertIn("salvo", r.stdout, "estado.json muda (uso da cota), então tem commit")

    def test_preparar_falha_antes_da_coleta_se_o_push_nao_vai_funcionar(self):
        # achado da revisão: sem push, a rodada gastava cota e perdia tudo, inclusive o contador do estado.json
        self.origem = self.dir / "origem.git"
        self.sh("git", "init", "--quiet", "--bare", "-b", "main", str(self.origem))
        self.sh("git", "-C", str(self.origem), "config", "uploadpack.allowFilter", "true")
        script = str(AQUI / "dados.sh")
        # clone funciona, push não (como um token só de leitura)
        sem_push = {"GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": f"url.file://{self.dir}/sem-permissao.git.pushInsteadOf",
                    "GIT_CONFIG_VALUE_0": f"file://{self.origem}"}
        r = self.sh("bash", script, "preparar", "d1", ok=False, env_extra=sem_push)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("não consigo enviar para o branch dados", r.stdout)
        self.assertEqual(self.git_origem("for-each-ref").strip(), "", "nada foi enviado")
        # com o branch já existindo
        mundo(self.s)
        self.sh("bash", script, "preparar", "d2")
        self.rodar(dados=self.dir / "d2")
        self.sh("bash", script, "salvar", "d2", "Coleta: rodada 1")
        r = self.sh("bash", script, "preparar", "d3", ok=False, env_extra=sem_push)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("não consigo enviar para o branch dados", r.stdout)
        self.assertEqual(self.git_origem("rev-list", "--count", "dados").strip(), "1")


if __name__ == "__main__":
    unittest.main(verbosity=2)
