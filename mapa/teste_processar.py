"""Testes rápidos do robô do mapa (sem rede): fila, pedidos do site e o formato de falhas.json.

    python3 mapa/teste_processar.py      (ou: python3 -m unittest mapa/teste_processar.py)
"""
from __future__ import annotations

import json
import sys

sys.dont_write_bytecode = True  # não deixa __pycache__ na pasta do robô (o workflow faz git add mapa)
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import processar as P  # noqa: E402


class Fila(unittest.TestCase):
    def test_pedido_entra_mesmo_com_max_falhas(self):
        falhas = {"111111111": P.MAX_FALHAS, "222222222": {"n": P.MAX_FALHAS, "motivo": "sem replay_url", "quando": "2026-01-01T00:00:00Z"}}
        fila = P.montar_fila([111111111, 222222222], [111111111, 333333333], [], set(), falhas)
        self.assertEqual(fila, [111111111, 222222222, 333333333])

    def test_automatica_respeita_max_falhas_nos_dois_formatos(self):
        falhas = {"111111111": P.MAX_FALHAS, "222222222": {"n": P.MAX_FALHAS}, "333333333": 2, "444444444": {"n": 1, "quando": "2020-01-01T00:00:00Z"}}
        fila = P.montar_fila([], [111111111, 222222222, 333333333, 444444444], [], set(), falhas)
        self.assertEqual(fila, [333333333, 444444444])

    def test_automatica_espera_10_min_depois_de_falhar(self):
        agora = time.time()
        quando = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(agora - 120))
        falhas = {"111111111": {"n": 1, "motivo": "sem replay_url", "quando": quando}}
        self.assertEqual(P.montar_fila([], [111111111], [], set(), falhas, agora=agora), [])
        self.assertEqual(P.montar_fila([], [111111111], [], set(), falhas, agora=agora + 11 * 60), [111111111])
        # pedido do site não espera
        self.assertEqual(P.montar_fila([111111111], [], [], set(), falhas, agora=agora), [111111111])

    def test_feitos_e_duplicados(self):
        fila = P.montar_fila([5, 5, 6], [6, 7, 8], [9, 7], {8}, {})
        self.assertEqual(fila, [5, 6, 7, 9])
        self.assertEqual(P.montar_fila([5, 6], [7], [9], set(), {}, so_pedidos=True), [5, 6])

    def test_n_falhas_aceita_lixo(self):
        self.assertEqual([P.n_falhas(x) for x in (None, 3, "2", {"n": 4}, {"n": None}, {}, "x", [1])], [0, 3, 2, 4, 0, 0, 0, 0])

    def test_motivos(self):
        self.assertEqual(P.motivo_da_falha(RuntimeError("sem replay_url (partida ainda não analisada pelo OpenDota)")), "sem replay_url")
        self.assertEqual(P.motivo_da_falha(RuntimeError("parser não devolveu posições")), "o parser não leu o replay")
        self.assertEqual(P.motivo_da_falha(RuntimeError("x" * 400)), "x" * 150)


class Rodada(unittest.TestCase):
    """main() inteiro numa pasta temporária, com o OpenDota e o parser simulados."""

    def rodar(self, pedidos=(), falhas=None, resultado=None, so_pedidos=False, mapas=()):
        d = Path(tempfile.mkdtemp())
        (d / "pedidos").mkdir()
        (d / "mapas").mkdir()
        for i in pedidos:
            (d / "pedidos" / str(i)).write_text("pedido pelo site em 2026-10-13T12:00:00Z\n")
        for i in mapas:
            (d / "mapas" / f"{i}.json").write_text(json.dumps({"v": P.VERSAO, "id": i}, separators=(",", ":")))
        if falhas is not None:
            (d / "falhas.json").write_text(json.dumps(falhas))
        resultado = resultado or {}

        def processar(mid, parser, tmp, **kw):
            r = resultado.get(mid, "ok")
            if r != "ok":
                raise RuntimeError(r)
            return {"v": P.VERSAO, "id": mid}

        args = ["processar.py", "--pedidos", str(d / "pedidos"), "--saida", str(d / "mapas"), "--falhas", str(d / "falhas.json")]
        if so_pedidos:
            args.append("--so-pedidos")
        with mock.patch.object(sys, "argv", args), mock.patch.object(P, "processar", processar), \
                mock.patch.object(P, "post", lambda c: b"") as _, mock.patch("sys.stdout"):
            self.assertEqual(P.main(), 0)
        return d, json.loads((d / "falhas.json").read_text())

    def test_pedido_novo_zera_falhas_e_some_da_pasta(self):
        d, falhas = self.rodar(pedidos=[904249335], falhas={"904249335": P.MAX_FALHAS, "111": 2})
        self.assertTrue((d / "mapas" / "904249335.json").exists())
        self.assertFalse((d / "pedidos" / "904249335").exists())
        self.assertNotIn("904249335", falhas)
        self.assertEqual(falhas["111"], 2, "formato antigo das outras partidas fica como está")

    def test_falha_sem_replay_url_fica_no_formato_novo(self):
        d, falhas = self.rodar(pedidos=[904249335], falhas={"904249335": {"n": P.MAX_FALHAS, "motivo": "x", "quando": "2020-01-01T00:00:00Z"}},
                               resultado={904249335: "sem replay_url (partida ainda não analisada pelo OpenDota)"})
        f = falhas["904249335"]
        self.assertEqual(f["n"], 1, "o pedido zerou a contagem antes de tentar")
        self.assertEqual(f["motivo"], "sem replay_url")
        self.assertRegex(f["quando"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
        self.assertFalse((d / "pedidos" / "904249335").exists(), "pedido atendido sai da pasta (o site pede de novo)")
        self.assertFalse((d / "mapas" / "904249335.json").exists())

    def test_falha_automatica_soma_a_partir_do_formato_antigo(self):
        with mock.patch.object(P, "get", lambda c: [{"match_id": 904249336}]), mock.patch.object(P.time, "sleep", lambda s: None):
            d = Path(tempfile.mkdtemp())
            (d / "amigos.json").write_text('["1"]')
            (d / "falhas.json").write_text('{"904249336": 2}')
            args = ["processar.py", "--amigos", str(d / "amigos.json"), "--pedidos", str(d / "pedidos"), "--saida", str(d / "mapas"), "--falhas", str(d / "falhas.json")]

            def falha(*a):
                raise RuntimeError("parser não devolveu posições")
            with mock.patch.object(sys, "argv", args), mock.patch.object(P, "processar", falha), mock.patch.object(P, "post", lambda c: b""), mock.patch("sys.stdout"):
                P.main()
            f = json.loads((d / "falhas.json").read_text())["904249336"]
            self.assertEqual((f["n"], f["motivo"]), (3, "o parser não leu o replay"))

    def test_so_pedidos_ignora_o_resto(self):
        d, falhas = self.rodar(pedidos=[904249337], so_pedidos=True)
        self.assertTrue((d / "mapas" / "904249337.json").exists())
        self.assertEqual(falhas, {})

    def test_pedido_de_mapa_que_ja_existe_so_limpa(self):
        d, _ = self.rodar(pedidos=[904249338], mapas=[904249338], resultado={904249338: "não devia processar"})
        self.assertFalse((d / "pedidos" / "904249338").exists())

    def test_falhas_json_estragado_nao_derruba(self):
        d = Path(tempfile.mkdtemp())
        (d / "falhas.json").write_text("{quebrado")
        (d / "pedidos").mkdir()
        (d / "pedidos" / "904249339").write_text("x")
        args = ["processar.py", "--pedidos", str(d / "pedidos"), "--saida", str(d / "mapas"), "--falhas", str(d / "falhas.json")]
        with mock.patch.object(sys, "argv", args), mock.patch.object(P, "processar", lambda *a, **kw: {"v": P.VERSAO}), mock.patch("sys.stdout"):
            self.assertEqual(P.main(), 0)
        self.assertEqual(json.loads((d / "falhas.json").read_text()), {})


class Novos(unittest.TestCase):
    def test_nomes_de_arquivo_so_com_digitos_ascii(self):
        d = Path(tempfile.mkdtemp())
        (d / "pedidos").mkdir()
        (d / "mapas").mkdir()
        for nome in ["²", "١٢٣٤٥٦٧٨٩", "123", "904249340", "abc", "9042493400001"]:
            (d / "pedidos" / nome).write_text("x")
        (d / "mapas" / "١٢٣٤٥٦٧٨٩.json").write_text("{}")
        vistos = []

        def processar(mid, *a, **kw):
            vistos.append(mid)
            return {"v": P.VERSAO, "id": mid}
        args = ["processar.py", "--pedidos", str(d / "pedidos"), "--saida", str(d / "mapas"), "--falhas", str(d / "falhas.json")]
        with mock.patch.object(sys, "argv", args), mock.patch.object(P, "processar", processar), mock.patch("sys.stdout"):
            self.assertEqual(P.main(), 0)
        self.assertEqual(vistos, [904249340])
        self.assertTrue((d / "pedidos" / "²").exists(), "nome estranho é ignorado, não derruba a rodada")

    def partida(self, contas, replay="http://replay"):
        return {"players": [{"account_id": c} for c in contas], **({"replay_url": replay} if replay else {})}

    def test_pedido_de_partida_sem_amigo_nao_baixa_o_replay(self):
        baixou = []
        with mock.patch.object(P, "get", lambda c: self.partida([None, 999, 123])), mock.patch.object(P, "baixar", lambda *a: baixou.append(a)):
            with self.assertRaisesRegex(RuntimeError, "sem nenhum amigo") as cm:
                P.processar(904249341, "http://x", Path("/tmp"), amigos={"81918076"})
        self.assertEqual(baixou, [])
        self.assertEqual(P.motivo_da_falha(cm.exception), "sem amigos")

    def test_rodada_grava_sem_amigos_e_le_o_amigos_json_no_modo_pedidos(self):
        d = Path(tempfile.mkdtemp())
        (d / "pedidos").mkdir()
        (d / "pedidos" / "904249342").write_text("x")
        (d / "amigos.json").write_text('{"81918076": "Suéter"}')
        posts = []
        args = ["processar.py", "--amigos", str(d / "amigos.json"), "--so-pedidos", "--pedidos", str(d / "pedidos"), "--saida", str(d / "mapas"), "--falhas", str(d / "falhas.json")]
        consultas = []

        def get(c):
            consultas.append(c)
            return self.partida([5, 6])
        with mock.patch.object(sys, "argv", args), mock.patch.object(P, "get", get), mock.patch.object(P, "post", lambda c: posts.append(c)), mock.patch("sys.stdout"):
            P.main()
        f = json.loads((d / "falhas.json").read_text())["904249342"]
        self.assertEqual(f["motivo"], "sem amigos")
        self.assertEqual(consultas, ["/matches/904249342"], "no modo pedidos não consulta as contas")
        self.assertEqual(posts, [], "partida de fora não pede análise ao OpenDota")
        self.assertFalse((d / "pedidos" / "904249342").exists())

    def test_pedido_espera_o_replay_url_na_mesma_rodada(self):
        respostas = [self.partida([81918076], None), self.partida([81918076], None), self.partida([81918076])]
        posts, sonos = [], []

        def get(c):
            return respostas.pop(0)
        with mock.patch.object(P, "get", get), mock.patch.object(P, "post", lambda c: posts.append(c)), \
                mock.patch.object(P, "baixar", lambda *a: (_ for _ in ()).throw(RuntimeError("chegou no download"))), mock.patch("sys.stdout"):
            with self.assertRaisesRegex(RuntimeError, "chegou no download"):
                P.processar(904249343, "http://x", Path("/tmp"), amigos={"81918076"}, espera_replay_s=300, dormir=sonos.append)
        self.assertEqual(posts, ["/request/904249343"])
        self.assertEqual(sonos, [P.ESPERA_PASSO_S, P.ESPERA_PASSO_S])

    def test_espera_tem_limite(self):
        relogio = [1000.0]

        def dormir(s):
            relogio[0] += s
        with mock.patch.object(P, "get", lambda c: self.partida([1], None)), mock.patch.object(P, "post", lambda c: b""), \
                mock.patch.object(P.time, "time", lambda: relogio[0]), mock.patch("sys.stdout"):
            with self.assertRaisesRegex(RuntimeError, "replay_url"):
                P.processar(904249344, "http://x", Path("/tmp"), espera_replay_s=100, dormir=dormir)
        self.assertLessEqual(relogio[0] - 1000, 100 + P.ESPERA_PASSO_S)

    def test_automatica_nao_espera_nem_confere_amigos(self):
        with mock.patch.object(P, "get", lambda c: self.partida([5], None)):
            with self.assertRaisesRegex(RuntimeError, "replay_url"):
                P.processar(904249345, "http://x", Path("/tmp"))

    def test_limpar_falhas(self):
        agora = time.time()
        velho = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(agora - 31 * 86400))
        novo = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(agora - 86400))
        falhas = {"1": {"n": 1, "quando": velho}, "2": {"n": 2, "quando": novo}, "3": 4, "4": 2, "5": {"n": 1}}
        self.assertEqual(P.limpar_falhas(falhas, [4], agora=agora), {"2": falhas["2"], "4": 2, "5": {"n": 1}})
        self.assertEqual(P.limpar_falhas(falhas, [], agora=agora, antigas_tambem=False), {"2": falhas["2"], "3": 4, "4": 2, "5": {"n": 1}})

    def test_so_fila_com_pedido_nao_consulta_as_contas(self):
        d = Path(tempfile.mkdtemp())
        (d / "pedidos").mkdir()
        (d / "pedidos" / "904249346").write_text("x")
        (d / "amigos.json").write_text('{"1": "a", "2": "b"}')
        saida = d / "out"
        args = ["processar.py", "--amigos", str(d / "amigos.json"), "--so-fila", "--pedidos", str(d / "pedidos"), "--saida", str(d / "mapas"), "--falhas", str(d / "falhas.json")]
        consultas = []
        with mock.patch.object(sys, "argv", args), mock.patch.object(P, "get", lambda c: consultas.append(c) or []), \
                mock.patch.dict("os.environ", {"GITHUB_OUTPUT": str(saida)}), mock.patch("sys.stdout"):
            P.main()
        self.assertEqual(consultas, [])
        self.assertIn("pedidos=1", saida.read_text())
        self.assertIn("fila=1", saida.read_text())


if __name__ == "__main__":
    unittest.main(verbosity=2)
