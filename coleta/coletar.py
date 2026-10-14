"""Coleta de partidas para a base dos modelos: as do Suéter (conta 81918076) dos últimos 14 dias e as dos amigos.

Roda de hora em hora no GitHub Actions (.github/workflows/coleta.yml) e grava num branch órfão "dados" do
repositório (fora do site; ver coleta/dados.sh):

    partidas/<id>.json.gz  resposta crua de /api/matches/<id> do OpenDota (com a análise do replay), em gzip
    indice.json            id -> início, duração, contas visíveis de cada lado, contas do grupo, analisada, bytes
    amigos.json            amigos detectados (jogos juntos, sessões, última vez) + os que quase entraram
    estado.json            pedidos de análise pendentes, desistências e descartes, falhas, listas, uso da cota por dia

    python coleta/coletar.py --dados dados --amigos amigos.json

Ordem: partidas do Suéter primeiro, depois as dos amigos; dentro de cada grupo, as MAIS ANTIGAS primeiro (a Valve
apaga o replay em ~2 semanas). Partida ainda não analisada pelo OpenDota: pede a análise (POST /request) uma vez e
tenta o GET de novo nas rodadas seguintes (espera crescente, por até ~3 dias); com mais de ~15 dias, desiste e guarda
os dados básicos (analisada = false). Partida já salva nunca é baixada de novo. Erro do OpenDota (5xx, rede) numa
partida só adia a próxima tentativa (espera crescente); se a rodada parar porque o OpenDota caiu, essas falhas nem
contam. Só um erro que se repete igual (4xx, resposta que não é JSON, partida errada) descarta a partida, na 3ª vez,
e isso fica anotado (estado.json e resumo).

Amigos: colegas de time (mesmo lado, conta visível) em >= 3 partidas do Suéter, em >= 2 SESSÕES diferentes, nos
últimos 14 dias. Uma sessão nova só começa depois de >= 7 h entre o início de uma partida do Suéter e o da seguinte
(~6 h sem jogar). Nada de "partidas seguidas" nem de corte por data: quando o grupo está em 4, entra um aleatório para
completar, e ele pode ficar a sessão toda, inclusive passando da meia-noite ou de qualquer outro horário fixo. Somam-se
as contas do amigos.json do site (lista manual; esse arquivo não é alterado).

Fase histórica (COLETA_HISTORICO=1, ligada no workflow): com a sobra da cota, partidas com mais de 14 dias que o
OpenDota já tinha analisado, das mais novas para trás.

Cota do OpenDota grátis (sem chave): ~60 chamadas/min e um limite por dia. O robô lê os cabeçalhos
X-Rate-Limit-Remaining-* (sem diferenciar maiúsculas) e para quando o restante do dia chega à reserva
(COLETA_RESERVA, 200). Sem esses cabeçalhos, gasta no máximo COLETA_ORCAMENTO_SEM_CABECALHO (80) por rodada. Nos dois
casos há um teto próprio por dia (UTC) contado em estado.json: COLETA_TETO_DIA (2000) menos a reserva. Depois que uma
rodada para na reserva, as seguintes nem chamam a API até o dia UTC seguinte (ou uma sonda de 1 chamada a cada 6 h,
porque não se sabe a que horas o OpenDota zera o dia). Um 429 encerra a rodada; o que já foi baixado fica salvo.
Só biblioteca padrão (Python 3.12).
"""
from __future__ import annotations

import argparse
import calendar
import gzip
import http.client
import json
import os
import re
import shutil
import signal
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

API = "https://api.opendota.com/api"
CONTA_LO = 81918076
UA = "culpado-dota2-coleta"

RESERVA = 200
TETO_DIA = 2000
ORCAMENTO_SEM_CABECALHO = 80
PAUSA_S = 1.1                 # ~54 chamadas/min, abaixo das 60/min do plano grátis
TEMPO_MAX_S = 35 * 60         # para de chamar a API depois disso (o workflow tem 50 min no total)
JANELA_DIAS = 14
MIN_JOGOS = 3
MIN_SESSOES = 2
PAUSA_SESSAO_S = 7 * 3600     # entre o início de uma partida do LO e o da seguinte: acima disso, é outra sessão
INTERVALO_LISTA_AMIGO_S = 2 * 3600  # a lista de partidas de cada amigo é consultada de novo depois disso
INTERVALO_HISTORICO_S = 24 * 3600   # histórico completo (fase opcional): uma consulta por conta por dia
PRIMEIRA_ESPERA_S = 30 * 60   # depois do pedido de análise: tenta o GET de novo na rodada seguinte
MAX_ESPERA_S = 12 * 3600      # espera entre GETs de uma partida pendente: 1 h, 2 h, 4 h, 8 h, 12 h, 12 h...
ESPERA_ANALISE_S = 3 * 86400  # depois do pedido, desiste em ~3 dias
REPLAY_SOME_S = 15 * 86400    # partida com mais de ~15 dias: a Valve já apagou o replay
ESPERA_FALHA_S = 30 * 60      # erro numa partida: espera isso antes de tentar de novo (dobra a cada erro do OpenDota)
MAX_ESPERA_FALHA_S = 12 * 3600
MAX_FALHAS = 3                # erro que se repete igual (4xx, não é JSON, partida errada): descarta na 3ª vez
MIN_FALHAS_TRANSITORIAS = 6   # erro do OpenDota (5xx, rede): só descarta com a partida velha (> 15 dias) e tantas vezes
ERROS_SEGUIDOS_MAX = 5        # o OpenDota fora do ar: encerra a rodada (e essas falhas não contam contra as partidas)
SONDA_RESERVA_S = 6 * 3600    # depois de parar na reserva: no mesmo dia UTC, só 1 chamada de sonda a cada 6 h
SALVAR_A_CADA = 20            # grava indice/estado a cada N partidas novas (se a rodada morrer, perde pouco)
GUARDA_S = 30 * 86400         # entradas velhas do estado (falhas, desistências, partidas do LO) saem depois disso
CONTAS_OCULTAS = {None, 0, 4294967295}

RE_ID = re.compile(r"[0-9]{1,19}")
RE_LIMITE = re.compile(r"rate-?limit-remaining-?([a-z]+)", re.IGNORECASE)
PERIODOS = {"day": "dia", "daily": "dia", "minute": "minuto", "min": "minuto", "month": "mes", "monthly": "mes",
            "hour": "hora", "second": "segundo"}

class Parada(Exception):
    """Fim da rodada (cota, 429, tempo, OpenDota fora do ar): grava o que tem e sai normalmente."""


class ErroRede(Exception):
    pass


class BaseEstragada(Exception):
    """indice/estado/amigos ilegível: a rodada não grava nada (melhor parar do que sobrescrever a base)."""


# ---------------------------------------------------------------- utilidades

def iso(t: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


def de_iso(s) -> float | None:
    if not isinstance(s, str):
        return None
    try:
        return float(calendar.timegm(time.strptime(s, "%Y-%m-%dT%H:%M:%SZ")))
    except ValueError:
        return None


def sessoes(inicios, pausa_s: float = PAUSA_SESSAO_S) -> dict[float, int]:
    """Início de cada partida do LO -> nº da sessão. Sessão nova quando a partida começa > pausa_s depois da anterior."""
    out, n, antes = {}, -1, None
    for t in sorted(set(inicios)):
        if antes is None or t - antes > pausa_s:
            n += 1
        out[t] = n
        antes = t
    return out


def ler_json(arq: Path, padrao):
    if not arq.exists():
        return padrao
    try:
        v = json.loads(arq.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise BaseEstragada(f"{arq.name} ilegível ({e})") from e
    if not isinstance(v, type(padrao)):
        raise BaseEstragada(f"{arq.name} com formato inesperado ({type(v).__name__})")
    return v


def json_por_linha(d: dict) -> str:
    """Um registro por linha: o diff do git de cada rodada fica do tamanho do que mudou."""
    def ordem(k):
        return (0, int(k)) if RE_ID.fullmatch(k) else (1, 0)
    linhas = [f"{json.dumps(k)}:{json.dumps(d[k], ensure_ascii=False, sort_keys=True, separators=(',', ':'))}"
              for k in sorted(d, key=lambda k: (ordem(k), k))]
    return "{\n" + ",\n".join(linhas) + "\n}\n"


def conta_visivel(v) -> int | None:
    try:
        c = int(v)
    except (TypeError, ValueError):
        return None
    return None if c in CONTAS_OCULTAS or c < 0 else c


def jogadores(m: dict):
    """(conta visível ou None, 'radiant'/'dire'/None, nome) de cada jogador."""
    for p in m.get("players") or []:
        if not isinstance(p, dict):
            continue
        lado = None
        if p.get("team_number") in (0, 1):
            lado = "radiant" if p["team_number"] == 0 else "dire"
        elif isinstance(p.get("isRadiant"), bool):
            lado = "radiant" if p["isRadiant"] else "dire"
        elif isinstance(p.get("player_slot"), int):
            lado = "radiant" if p["player_slot"] < 128 else "dire"
        yield conta_visivel(p.get("account_id")), lado, p.get("personaname")


def lados(m: dict) -> dict:
    out = {"radiant": [], "dire": []}
    for c, lado, _ in jogadores(m):
        if c is not None and lado:
            out[lado].append(c)
    return {k: sorted(set(v)) for k, v in out.items()}


def analisada(m: dict) -> bool:
    """O OpenDota analisou o replay: tem version e as séries por minuto (gold_t)."""
    return m.get("version") is not None and any(
        isinstance(p, dict) and p.get("gold_t") for p in m.get("players") or [])


def entrada_indice(m: dict, foi_analisada: bool, tamanho: int, quando: str) -> dict:
    ld = lados(m)
    return {"inicio": int(m.get("start_time") or 0), "duracao": m.get("duration"), "radiant_venceu": m.get("radiant_win"),
            "modo": m.get("game_mode"), "lobby": m.get("lobby_type"), "radiant": ld["radiant"], "dire": ld["dire"],
            "grupo": [], "analisada": foi_analisada, "bytes": tamanho, "salva_em": quando}


def ler_amigos_manuais(arq: str | None) -> dict[int, str]:
    """amigos.json do site: {"conta": "nome"} ou ["conta", ...]. Só leitura."""
    if not arq or not Path(arq).exists():
        return {}
    try:
        v = json.loads(Path(arq).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"amigos.json manual ilegível ({e}); seguindo sem ele")
        return {}
    itens = v.items() if isinstance(v, dict) else ((c, "") for c in v) if isinstance(v, list) else ()
    out = {}
    for c, nome in itens:
        cv = conta_visivel(c)
        if cv is not None:
            out[cv] = nome if isinstance(nome, str) else ""
    return out


# ---------------------------------------------------------------- cota e API

def ler_cabecalhos_de_limite(headers) -> dict[str, int]:
    out = {}
    for k, v in (headers.items() if headers else ()):
        m = RE_LIMITE.search(k)
        if not m:
            continue
        try:
            n = int(float(str(v).strip()))
        except ValueError:
            continue
        out[PERIODOS.get(m.group(1).lower(), m.group(1).lower())] = n
    return out


class Cota:
    def __init__(self, estado: dict, reserva: int, teto_dia: int, orcamento_sem_cabecalho: int, max_rodada: int, relogio,
                 sonda_s: float = SONDA_RESERVA_S):
        self.estado = estado  # estado.json: "uso" {"AAAA-MM-DD" (UTC): chamadas} e "parada_reserva" (ver abaixo)
        self.uso = estado.setdefault("uso", {})
        self.reserva, self.teto_dia, self.sonda_s = reserva, teto_dia, sonda_s
        self.orcamento_sem_cabecalho, self.max_rodada = orcamento_sem_cabecalho, max_rodada
        self.relogio = relogio
        self.chamadas = 0
        self.por_tipo: Counter = Counter()
        self.restante: dict[str, int] = {}
        self.cabecalhos_primeira: dict | None = None  # cabeçalhos de limite da 1ª resposta (para o log)

    def hoje(self) -> str:
        return time.strftime("%Y-%m-%d", time.gmtime(self.relogio()))

    def usados_hoje(self) -> int:
        try:
            return int(self.uso.get(self.hoje(), 0))
        except (TypeError, ValueError):
            return 0

    def tem_cabecalho_diario(self) -> bool:
        return "dia" in self.restante or "mes" in self.restante

    def resta(self) -> str:
        """Para o log de cada partida: mostra quanto cada tipo de chamada gasta de verdade (o POST pode custar mais)."""
        r = self.restante.get("dia", self.restante.get("mes"))
        return "" if r is None else f", resta {r}"

    def parada_reserva(self) -> dict | None:
        """Quando uma rodada parou na reserva pelo cabeçalho: {"dia" (UTC), "quando", "restante"}."""
        b = self.estado.get("parada_reserva")
        return b if isinstance(b, dict) else None

    def _motivo_cabecalho(self) -> str | None:
        for periodo, nome in (("dia", "do dia"), ("mes", "do mês")):
            r = self.restante.get(periodo)
            if r is not None and r <= self.reserva:
                return f"reserva atingida: restante {nome} no OpenDota = {r} (reserva {self.reserva})"
        return None

    def motivo_para_parar(self) -> str | None:
        b = self.parada_reserva()
        if self.chamadas == 0 and b and b.get("dia") == self.hoje():
            # uma rodada de hoje já parou na reserva: nem chama a API (cada chamada sairia da reserva) até o dia UTC
            # seguinte, a não ser uma sonda a cada sonda_s, porque não se sabe a que horas o OpenDota zera o dia
            desde = de_iso(b.get("quando"))
            if desde is not None and 0 <= self.relogio() - desde < self.sonda_s:
                return (f"reserva já atingida hoje (UTC) às {str(b.get('quando'))[11:16]} UTC, restante "
                        f"{b.get('restante')}: sem chamadas até o dia UTC seguinte ou a sonda de "
                        f"{iso(desde + self.sonda_s)[11:16]} UTC")
        motivo = self._motivo_cabecalho()
        if motivo:
            return motivo
        limite = self.teto_dia - self.reserva
        if self.usados_hoje() >= limite:
            return f"teto diário próprio: {self.usados_hoje()} chamadas hoje (UTC), teto {self.teto_dia} - reserva {self.reserva}"
        if not self.tem_cabecalho_diario() and self.chamadas >= self.orcamento_sem_cabecalho:
            return f"orçamento da rodada sem cabeçalho de cota ({self.orcamento_sem_cabecalho} chamadas)"
        if self.max_rodada and self.chamadas >= self.max_rodada:
            return f"máximo de {self.max_rodada} chamadas por rodada"
        return None

    def registrar(self, tipo: str, headers) -> None:
        self.chamadas += 1
        self.por_tipo[tipo] += 1
        self.uso[self.hoje()] = self.usados_hoje() + 1
        if headers is None:
            return
        if self.cabecalhos_primeira is None:
            self.cabecalhos_primeira = {k: v for k, v in headers.items()
                                        if any(s in k.lower() for s in ("rate", "limit", "retry"))}
        self.restante.update(ler_cabecalhos_de_limite(headers))
        if self._motivo_cabecalho():  # chegou na reserva: as próximas rodadas de hoje (UTC) nem chamam a API
            r = self.restante.get("dia", self.restante.get("mes"))
            self.estado["parada_reserva"] = {"dia": self.hoje(), "quando": iso(self.relogio()), "restante": r}
        elif self.tem_cabecalho_diario():
            self.estado.pop("parada_reserva", None)  # a cota do OpenDota zerou (ou nunca chegou na reserva)

    def sobra(self) -> int | None:
        """Consultas do dia ainda disponíveis acima da reserva (pelo cabeçalho, ou pelo teto próprio)."""
        proprio = self.teto_dia - self.reserva - self.usados_hoje()
        r = self.restante.get("dia", self.restante.get("mes"))
        if r is None:
            b = self.parada_reserva()
            if self.chamadas == 0 and b and b.get("dia") == self.hoje() and isinstance(b.get("restante"), int):
                r = b["restante"]
        return max(0, min(proprio, r - self.reserva) if r is not None else proprio)


class OpenDota:
    def __init__(self, base: str, cota: Cota, relogio, dormir, pausa: float, fim: float, log):
        self.base, self.cota, self.relogio, self.dormir = base.rstrip("/"), cota, relogio, dormir
        self.pausa, self.fim, self.log = pausa, fim, log
        self.ultimo = None

    def _antes(self) -> None:
        motivo = self.cota.motivo_para_parar()
        if motivo:
            raise Parada(motivo)
        por_minuto = self.cota.restante.get("minuto")
        if por_minuto is not None and por_minuto <= 2:
            self.log(f"  limite por minuto quase no fim ({por_minuto}): esperando 61 s")
            self.dormir(61)
            self.cota.restante.pop("minuto", None)
        if self.ultimo is not None:
            espera = self.ultimo + self.pausa - self.relogio()
            if espera > 0:
                self.dormir(espera)
        if self.relogio() >= self.fim:
            raise Parada("tempo máximo da rodada")

    def chamar(self, metodo: str, caminho: str, tipo: str, parar_no_429: bool = True) -> tuple[int, bytes]:
        """(status, corpo). 429 vira Parada (a não ser com parar_no_429=False); erro de rede vira ErroRede.
        Toda tentativa conta na cota."""
        self._antes()
        self.ultimo = self.relogio()
        req = urllib.request.Request(self.base + caminho, method=metodo, data=b"" if metodo == "POST" else None,
                                     headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                status, corpo, headers = r.status, r.read(), r.headers
        except urllib.error.HTTPError as e:
            status, headers = e.code, e.headers
            try:
                corpo = e.read()
            except Exception:  # noqa: BLE001
                corpo = b""
        except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
            self.cota.registrar(tipo, None)
            raise ErroRede(f"{type(e).__name__}: {e}") from e
        primeira = self.cota.cabecalhos_primeira is None
        self.cota.registrar(tipo, headers)
        if primeira:
            if self.cota.cabecalhos_primeira:
                self.log(f"  cabeçalhos de limite da primeira resposta: {json.dumps(self.cota.cabecalhos_primeira)}")
            else:
                self.log("  primeira resposta SEM cabeçalho de limite: vale o orçamento por rodada e o teto próprio")
        if status == 429 and parar_no_429:
            raise Parada("429 do OpenDota (limite estourado)")
        return status, corpo


# ---------------------------------------------------------------- base (branch dados)

LEIA_DADOS = """# Dados da coleta (branch órfão `dados`)

Gravado pelo robô `.github/workflows/coleta.yml` (código em `coleta/` no branch `main`). Não é publicado no site.

- `partidas/<id>.json.gz`: resposta crua de `https://api.opendota.com/api/matches/<id>` (gzip). Quase todas com a
  análise do replay (séries por minuto, lances, compras, posições...); as com `"analisada": false` no índice são só
  os dados básicos (o OpenDota não conseguiu analisar a tempo).
- `indice.json`: uma linha por partida: início (unix), duração, contas visíveis de cada lado, contas do grupo,
  analisada, tamanho do .gz.
- `amigos.json`: quem o robô considera amigo (e quem quase entrou), com jogos juntos, sessões e a última vez.
- `estado.json`: controle do robô (pedidos de análise pendentes, desistências e descartes, falhas, uso da cota por
  dia). Em `desistencias`, `"salva": false` é partida descartada sem nenhum dado (erro que se repetiu).

Baixar tudo: `git clone --branch dados --single-branch https://github.com/Suetam016/culpado_dota2 culpado-dados`

Ler uma partida em Python: `json.loads(gzip.open("partidas/<id>.json.gz").read())`
"""


class Base:
    def __init__(self, pasta: Path, log):
        self.pasta = Path(pasta)
        self.pasta.mkdir(parents=True, exist_ok=True)
        self.dir_partidas = self.pasta / "partidas"
        self.tmp = self.pasta / ".tmp"  # fora de partidas/: um .tmp que sobrar não vai para o commit
        self.indice: dict = ler_json(self.pasta / "indice.json", {})
        self.estado: dict = ler_json(self.pasta / "estado.json", {})
        self.amigos_antes: dict = ler_json(self.pasta / "amigos.json", {})
        for chave in ("uso", "pendentes", "desistencias", "falhas", "listas", "lo", "nomes"):
            if not isinstance(self.estado.get(chave), dict):
                self.estado[chave] = {}
        if not isinstance(self.estado.get("rodadas"), list):
            self.estado["rodadas"] = []
        shutil.rmtree(self.tmp, ignore_errors=True)
        self.reconciliadas = self.reconciliar(log)

    def reconciliar(self, log) -> int:
        """Arquivo em partidas/ que não está no índice (rodada que morreu antes de gravar o índice) entra no índice
        sem baixar de novo. Com o checkout parcial do workflow, partidas/ só tem o que esta rodada baixou."""
        if not self.dir_partidas.is_dir():
            return 0
        n = 0
        for arq in sorted(self.dir_partidas.glob("*.json.gz")):
            mid = arq.name[: -len(".json.gz")]
            if not RE_ID.fullmatch(mid) or mid in self.indice:
                continue
            try:
                m = json.loads(gzip.decompress(arq.read_bytes()))
                if not isinstance(m, dict):
                    raise TypeError("não é um objeto")
            except Exception as e:  # noqa: BLE001
                log(f"  {arq.name} estragado ({e}): será baixado de novo")
                continue
            self.indice[mid] = entrada_indice(m, analisada(m), arq.stat().st_size, iso(arq.stat().st_mtime))
            n += 1
        return n

    def escrever(self, arq: Path, dados: bytes | str) -> None:
        if isinstance(dados, str):
            dados = dados.encode("utf-8")
        self.tmp.mkdir(parents=True, exist_ok=True)
        tmp = self.tmp / arq.name
        tmp.write_bytes(dados)
        arq.parent.mkdir(parents=True, exist_ok=True)
        os.replace(tmp, arq)

    def salvar_partida(self, mid: int, bruto: bytes, m: dict, foi_analisada: bool, quando: str) -> int:
        gz = gzip.compress(bruto, compresslevel=9, mtime=0)
        self.escrever(self.dir_partidas / f"{mid}.json.gz", gz)
        self.indice[str(mid)] = entrada_indice(m, foi_analisada, len(gz), quando)
        return len(gz)

    def gravar(self, amigos: dict | None) -> None:
        self.escrever(self.pasta / "indice.json", json_por_linha(self.indice))
        self.escrever(self.pasta / "estado.json", json.dumps(self.estado, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
        if amigos is not None:
            self.escrever(self.pasta / "amigos.json", json.dumps(amigos, ensure_ascii=False, indent=1) + "\n")
        leia = self.pasta / "README.md"
        if not leia.exists() or leia.read_text(encoding="utf-8") != LEIA_DADOS:
            self.escrever(leia, LEIA_DADOS)
        shutil.rmtree(self.tmp, ignore_errors=True)


# ---------------------------------------------------------------- amigos

def detectar_amigos(lo_partidas: dict, nomes: dict, agora: float, janela_dias=JANELA_DIAS, min_jogos=MIN_JOGOS,
                    min_sessoes=MIN_SESSOES, pausa_s=PAUSA_SESSAO_S, inicios_lo=()) -> tuple[dict, dict]:
    """(amigos, quase): {conta: {nome, jogos, sessoes, ultima}} a partir das partidas do LO na janela.

    inicios_lo: início de todas as partidas do LO que se conhece (a lista do OpenDota, mesmo as ainda não baixadas),
    para separar as sessões pela agenda inteira do LO, e não só pelas partidas já baixadas."""
    juntos: dict[int, list[float]] = defaultdict(list)
    todos = [t for t in inicios_lo if isinstance(t, (int, float)) and t > 0]
    for e in lo_partidas.values():
        ini = e.get("inicio") if isinstance(e, dict) else None
        if not isinstance(ini, (int, float)) or agora - ini > janela_dias * 86400:
            continue
        todos.append(ini)
        for c in set(e.get("companheiros") or []):
            juntos[c].append(ini)
    sessao = sessoes(todos, pausa_s)
    amigos, quase = {}, {}
    for c, inicios in juntos.items():
        ss = {sessao[t] for t in inicios}
        info = {"nome": nomes.get(str(c)) or "", "jogos": len(inicios), "sessoes": len(ss), "ultima": iso(max(inicios))}
        if len(inicios) >= min_jogos and len(ss) >= min_sessoes:
            amigos[c] = info
        elif len(inicios) >= 2:
            quase[c] = info
    return amigos, quase


# ---------------------------------------------------------------- a rodada

class Rodada:
    def __init__(self, a, base: Base, api: OpenDota, cota: Cota, manuais: dict[int, str], relogio, log):
        self.a, self.base, self.api, self.cota, self.manuais = a, base, api, cota, manuais
        self.relogio, self.log = relogio, log
        e = base.estado
        self.pendentes, self.desistencias, self.falhas = e["pendentes"], e["desistencias"], e["falhas"]
        self.listas, self.lo, self.nomes = e["listas"], e["lo"], e["nomes"]
        self.lo_conta = a.conta
        self.novas = self.basicas = self.pedidos = self.erros_seguidos = 0
        # falhas desde o último sucesso: (partida, falha antes, desistência antes, falha nova), para desfazer se o
        # OpenDota caiu
        self.sequencia: list[tuple[str, dict | None, dict | None, dict]] = []
        self.descartadas: set[str] = set()  # nesta rodada
        self.sem_pedidos = False  # o POST /request recebeu 429: não pede mais análise nesta rodada
        self.novas_por_grupo: Counter = Counter()
        self.bytes_novos = 0
        self.desde_gravacao = 0
        self.amigos: dict = {}
        self.quase: dict = {}
        # partidas do LO já salvas (de rodadas anteriores) também contam para os amigos
        agora = relogio()
        for k, ent in base.indice.items():
            if k not in self.lo and isinstance(ent, dict) and agora - (ent.get("inicio") or 0) <= GUARDA_S:
                self.registrar_lo_de_lados(k, ent.get("inicio"), {"radiant": ent.get("radiant") or [], "dire": ent.get("dire") or []})

    # -- partidas do LO (para os amigos)
    def registrar_lo_de_lados(self, k: str, inicio, ld: dict) -> None:
        for contas in ld.values():
            if self.lo_conta in contas and isinstance(inicio, (int, float)):
                self.lo[k] = {"inicio": int(inicio), "companheiros": sorted(c for c in contas if c != self.lo_conta)}

    def registrar_lo(self, m: dict) -> None:
        k = str(m.get("match_id"))
        self.registrar_lo_de_lados(k, m.get("start_time"), lados(m))
        if k in self.lo:
            comp = set(self.lo[k]["companheiros"])
            for c, _, nome in jogadores(m):
                if c in comp and isinstance(nome, str) and nome:
                    self.nomes[str(c)] = nome

    def calcular_amigos(self) -> None:
        inicios_lo = ((self.listas.get(str(self.lo_conta)) or {}).get("partidas") or {}).values()
        self.amigos, self.quase = detectar_amigos(self.lo, self.nomes, self.relogio(), self.a.janela, self.a.min_jogos,
                                                  self.a.min_sessoes, PAUSA_SESSAO_S, inicios_lo)

    def contas_amigas(self) -> set[int]:
        return (set(self.amigos) | set(self.manuais)) - {self.lo_conta}

    # -- listas de partidas
    def atualizar_lista(self, conta: int) -> None:
        try:
            st, corpo = self.api.chamar("GET", f"/players/{conta}/matches?date={self.a.janela}&significant=0", "lista")
        except ErroRede as e:
            self.log(f"  lista de {conta}: {e}")
            return
        try:
            lst = json.loads(corpo) if st == 200 else None
        except ValueError:
            lst = None
        if not isinstance(lst, list):
            self.log(f"  lista de {conta}: HTTP {st}, sem lista")
            return
        agora = self.relogio()
        antes = (self.listas.get(str(conta)) or {}).get("partidas") or {}
        novas = {str(j["match_id"]): int(j.get("start_time") or 0) for j in lst
                 if isinstance(j, dict) and RE_ID.fullmatch(str(j.get("match_id")))}
        for k, ini in antes.items():  # o que saiu da janela de 14 dias mas ainda pode ter replay fica
            if k not in novas and isinstance(ini, (int, float)) and agora - ini < REPLAY_SOME_S:
                novas[k] = ini
        self.listas[str(conta)] = {"em": iso(agora), "partidas": novas}
        for k in antes:
            if k not in novas:
                self.saiu_da_lista(k)
        self.log(f"  lista de {conta}: {len(lst)} partidas em {self.a.janela} dias")

    # -- fila
    def na_fila(self, k: str, agora: float) -> bool:
        if k in self.base.indice or k in self.desistencias:
            return False
        f = self.falhas.get(k)
        if isinstance(f, dict):
            prox = de_iso(f.get("proxima"))
            if prox is not None and prox > agora:
                return False
        p = self.pendentes.get(k)
        if isinstance(p, dict):
            prox = de_iso(p.get("proxima"))
            if prox is not None and prox > agora:
                return False
        return True

    def fila(self, ids: dict[str, float], excluir=()) -> list[tuple[str, float]]:
        agora = self.relogio()
        return sorted(((k, ini) for k, ini in ids.items() if k not in excluir and self.na_fila(k, agora)),
                      key=lambda x: (x[1], int(x[0])))

    def ids_do_lo(self) -> dict[str, float]:
        ids = dict((self.listas.get(str(self.lo_conta)) or {}).get("partidas") or {})
        for k, p in self.pendentes.items():
            if k in self.lo:
                ids.setdefault(k, p.get("inicio") or 0)
        return ids

    def ids_dos_amigos(self) -> dict[str, float]:
        ids: dict[str, float] = {}
        for c in self.contas_amigas():
            ids.update((self.listas.get(str(c)) or {}).get("partidas") or {})
        for k, p in self.pendentes.items():  # pedido já feito termina mesmo que a conta tenha saído da lista
            ids.setdefault(k, p.get("inicio") or 0)
        return ids

    # -- uma partida
    def falhou(self, k: str, motivo: str, ini, transitoria: bool) -> None:
        """transitoria (5xx, rede): só adia a próxima tentativa (espera crescente); a partida só é descartada se já
        tem mais de 15 dias e falhou MIN_FALHAS_TRANSITORIAS vezes. Senão (4xx, não é JSON, partida errada): descarta
        na MAX_FALHAS-ésima vez. Se a rodada parar porque o OpenDota caiu, nada desta sequência conta para descarte."""
        agora = self.relogio()
        antes = self.falhas.get(k) if isinstance(self.falhas.get(k), dict) else None
        d_antes = self.desistencias.get(k) if isinstance(self.desistencias.get(k), dict) else None
        f = dict(antes or {})
        n, t = int(f.get("n") or 0) + (0 if transitoria else 1), int(f.get("t") or 0) + 1
        inicio = int(ini or f.get("inicio") or 0)
        espera = min(MAX_ESPERA_FALHA_S, ESPERA_FALHA_S * 2 ** (t - 1))
        f.update(n=n, t=t, motivo=motivo, quando=iso(agora), proxima=iso(agora + espera), inicio=inicio)
        self.falhas[k] = f
        self.sequencia.append((k, dict(antes) if antes else None, dict(d_antes) if d_antes else None, dict(f)))
        self.log(f"  FALHOU {k}: {motivo} (erros: {t}; tenta de novo depois de {f['proxima']})")
        if n >= MAX_FALHAS:
            self.descartar(k, f"{motivo} ({n} vezes)")
        elif transitoria and t >= MIN_FALHAS_TRANSITORIAS and inicio and agora - inicio > REPLAY_SOME_S:
            self.descartar(k, f"{motivo} ({t} vezes, partida com mais de 15 dias)")
        self.erros_seguidos += 1
        if self.erros_seguidos >= ERROS_SEGUIDOS_MAX:
            self.desfazer_sequencia()
            raise Parada(f"OpenDota com erro em {ERROS_SEGUIDOS_MAX} chamadas seguidas (fora do ar?)")

    def desfazer_sequencia(self) -> None:
        """O OpenDota caiu: as falhas desde o último sucesso não são culpa das partidas. Volta a contagem e os
        descartes ao que eram, mas mantém a espera crescente (senão as mesmas partidas travariam toda rodada)."""
        for k, f_antes, d_antes, f_nova in reversed(self.sequencia):
            f = dict(f_nova)
            f["n"] = int((f_antes or {}).get("n") or 0)
            f["motivo"] = f"{f_nova.get('motivo', '?')} (OpenDota fora do ar: não conta para descarte)"
            self.falhas[k] = f
            if d_antes is None:
                self.desistencias.pop(k, None)
            else:
                self.desistencias[k] = d_antes
            self.descartadas.discard(k)
        self.log(f"  {len(self.sequencia)} falhas seguidas: OpenDota fora do ar? Não contam para descartar partidas")
        self.sequencia.clear()

    def descartar(self, k: str, motivo: str) -> None:
        """Desiste da partida sem nenhum dado (o erro se repete). Fica anotado; não volta para a fila."""
        f = self.falhas.pop(k, None) or {}
        self.pendentes.pop(k, None)
        self.desistencias[k] = {"motivo": f"descartada: {motivo}", "quando": iso(self.relogio()),
                                "inicio": int(f.get("inicio") or 0), "salva": False}
        self.descartadas.add(k)
        self.log(f"  DESCARTADA {k}: {motivo}")

    def desistir(self, k: str, corpo: bytes, m: dict, motivo: str) -> None:
        agora = self.relogio()
        self.base.salvar_partida(int(k), corpo, m, False, iso(agora))
        self.pendentes.pop(k, None)
        self.falhas.pop(k, None)
        self.desistencias[k] = {"motivo": motivo, "quando": iso(agora), "inicio": int(m.get("start_time") or 0),
                                "salva": True}
        self.basicas += 1
        self.log(f"  {k}: desisti da análise ({motivo}); guardei os dados básicos")

    def processar(self, k: str, ini_lista: float, grupo: str) -> None:
        if k in self.base.indice:
            return
        try:
            st, corpo = self.api.chamar("GET", f"/matches/{k}", "partida")
        except ErroRede as e:
            self.falhou(k, f"rede: {e}", ini_lista, transitoria=True)
            return
        if st != 200:
            self.falhou(k, f"HTTP {st}", ini_lista, transitoria=st >= 500)
            return
        try:
            m = json.loads(corpo)
        except ValueError:
            self.falhou(k, "resposta não é JSON", ini_lista, transitoria=False)
            return
        if not isinstance(m, dict) or str(m.get("match_id")) != k:
            self.falhou(k, "resposta sem a partida", ini_lista, transitoria=False)
            return
        self.erros_seguidos = 0
        self.sequencia.clear()
        self.registrar_lo(m)
        agora = self.relogio()
        if analisada(m):
            tam = self.base.salvar_partida(int(k), corpo, m, True, iso(agora))
            self.pendentes.pop(k, None)
            self.falhas.pop(k, None)
            self.novas += 1
            self.novas_por_grupo[grupo] += 1
            self.bytes_novos += tam
            self.log(f"  OK {k} ({grupo}, {iso(m.get('start_time') or 0)[:10]}, {tam // 1024} KB{self.cota.resta()})")
            self.desde_gravacao += 1
            if self.desde_gravacao >= SALVAR_A_CADA:
                self.base.gravar(None)
                self.desde_gravacao = 0
            return
        inicio = float(m.get("start_time") or ini_lista or 0)
        p = self.pendentes.get(k)
        if not isinstance(p, dict):
            p = {"inicio": int(inicio), "primeira_vez": iso(agora), "pedido_em": None, "tentativas": 0}
        else:
            p["tentativas"] = int(p.get("tentativas") or 0) + 1
        self.pendentes[k] = p
        if agora - inicio > REPLAY_SOME_S:
            self.desistir(k, corpo, m, "mais de 15 dias: a Valve já apagou o replay")
            return
        desde = de_iso(p.get("pedido_em")) or de_iso(p.get("primeira_vez")) or agora
        if agora - desde > ESPERA_ANALISE_S:
            self.desistir(k, corpo, m, "o OpenDota não analisou em 3 dias")
            return
        n = p["tentativas"]
        p["proxima"] = iso(agora + (PRIMEIRA_ESPERA_S if n == 0 else min(MAX_ESPERA_S, 3600 * 2 ** (n - 1))))
        if p.get("pedido_em"):
            self.log(f"  {k}: ainda sem análise (tentativa {n}); próxima depois de {p['proxima']}")
            return
        if self.sem_pedidos:
            self.log(f"  {k}: sem análise; o pedido fica para a próxima rodada")
            return
        try:
            # 429 só no pedido de análise (pode ser um limite à parte): para de pedir, mas segue baixando as que já
            # estão analisadas; se for o limite geral, a próxima chamada recebe 429 e aí a rodada acaba
            st2, _ = self.api.chamar("POST", f"/request/{k}", "pedido", parar_no_429=False)
        except ErroRede as e:
            self.log(f"  {k}: pedido de análise falhou ({e}); tento de novo depois")
            return
        if st2 == 429:
            self.sem_pedidos = True
            self.log(f"  {k}: 429 no pedido de análise; sem novos pedidos nesta rodada")
        elif 200 <= st2 < 300:
            p["pedido_em"] = iso(self.relogio())
            self.pedidos += 1
            self.log(f"  {k}: sem análise; pedi ao OpenDota ({grupo}{self.cota.resta()})")
        else:
            self.log(f"  {k}: pedido de análise recebeu HTTP {st2}; tento de novo depois")

    def processar_fila(self, itens, grupo: str) -> None:
        for k, ini in itens:
            self.processar(k, ini, grupo)

    # -- fase histórica (COLETA_HISTORICO=1, o padrão): com a sobra da cota, partidas mais velhas que a janela que o OpenDota
    #    JÁ analisou (o replay da Valve já sumiu, mas a análise feita na época continua lá), das mais novas para trás
    def atualizar_historico(self, conta: int) -> None:
        hist = self.base.estado.setdefault("historico", {})
        try:
            st, corpo = self.api.chamar("GET", f"/players/{conta}/matches?significant=0", "historico")
            lst = json.loads(corpo) if st == 200 else None
        except (ErroRede, ValueError) as e:
            self.log(f"  histórico de {conta}: {e}")
            return
        if not isinstance(lst, list):
            self.log(f"  histórico de {conta}: HTTP {st}, sem lista")
            return
        limite = self.relogio() - self.a.janela * 86400
        ids = {str(j["match_id"]): int(j.get("start_time") or 0) for j in lst
               if isinstance(j, dict) and RE_ID.fullmatch(str(j.get("match_id"))) and j.get("version") is not None
               and int(j.get("start_time") or 0) < limite and str(j["match_id"]) not in self.base.indice}
        hist[str(conta)] = {"em": iso(self.relogio()), "analisadas": ids}
        self.log(f"  histórico de {conta}: {len(lst)} partidas, {len(ids)} antigas já analisadas a baixar")

    def fase_historico(self) -> None:
        hist = self.base.estado.setdefault("historico", {})
        contas = [self.lo_conta] + sorted(self.contas_amigas())
        agora = self.relogio()
        for c in contas:
            em = de_iso((hist.get(str(c)) or {}).get("em"))
            if em is None or agora - em >= INTERVALO_HISTORICO_S:
                self.atualizar_historico(c)
        ids: dict[str, float] = {}
        for c in contas:
            ids.update((hist.get(str(c)) or {}).get("analisadas") or {})
        fila = sorted(((k, ini) for k, ini in ids.items() if self.na_fila(k, agora)), key=lambda x: (-x[1], int(x[0])))
        self.log(f"Histórico antigo já analisado na fila: {len(fila)}")
        self.processar_fila(fila, "histórico")

    # -- tudo
    def executar(self) -> str:
        """Devolve o motivo do fim da rodada."""
        try:
            self.log(f"Lista do LO ({self.lo_conta})")
            self.atualizar_lista(self.lo_conta)
            fila_lo = self.fila(self.ids_do_lo())
            self.log(f"Partidas do LO na fila: {len(fila_lo)}")
            self.processar_fila(fila_lo, "LO")
            self.calcular_amigos()
            agora = self.relogio()
            contas = sorted(self.contas_amigas(),
                            key=lambda c: de_iso((self.listas.get(str(c)) or {}).get("em")) or 0)
            self.log(f"Amigos: {len(self.amigos)} detectados + {len(self.manuais)} da lista manual -> {len(contas)} contas")
            for c in contas:
                em = de_iso((self.listas.get(str(c)) or {}).get("em"))
                if em is None or agora - em >= self.a.intervalo_lista:
                    self.atualizar_lista(c)
            lo_ids = self.ids_do_lo()
            fila_amigos = self.fila(self.ids_dos_amigos(), excluir=lo_ids)
            self.log(f"Partidas dos amigos na fila: {len(fila_amigos)}")
            self.processar_fila(fila_amigos, "amigos")
            if self.a.historico:
                self.fase_historico()
            # o LO pode ter jogado de novo durante a rodada: a próxima pega
            return "fila vazia"
        except Parada as p:
            self.log(f"Parada: {p}")
            return str(p)

    def faltam(self) -> tuple[int, int]:
        """(partidas conhecidas ainda não salvas, das quais pendentes de análise)."""
        ids = set(self.ids_do_lo()) | set(self.ids_dos_amigos())
        falta = {k for k in ids if k not in self.base.indice and k not in self.desistencias}
        return len(falta), len(falta & set(self.pendentes))

    def saiu_da_lista(self, k: str) -> None:
        """Partida que sai da fila de vez (velha demais) ainda com erro: fica anotada como descartada, não some."""
        if k in self.falhas and k not in self.base.indice and k not in self.desistencias:
            f = self.falhas[k] if isinstance(self.falhas[k], dict) else {}
            self.descartar(k, f"saiu da lista sem conseguir baixar (último erro: {f.get('motivo', '?')})")

    def descartadas_na_base(self) -> list[str]:
        return sorted((k for k, d in self.desistencias.items() if isinstance(d, dict) and d.get("salva") is False),
                      key=int)

    def limpar_estado(self) -> None:
        agora = self.relogio()
        for k in [k for k, e in self.lo.items() if not isinstance(e, dict) or agora - (e.get("inicio") or 0) > GUARDA_S]:
            del self.lo[k]
        for d in (self.desistencias, self.falhas):
            for k in [k for k, e in d.items() if not isinstance(e, dict) or agora - (de_iso(e.get("quando")) or 0) > GUARDA_S]:
                del d[k]
        for k in [k for k in self.pendentes if k in self.base.indice]:
            del self.pendentes[k]
        manter = self.contas_amigas() | {self.lo_conta}
        for c in [c for c in self.listas if conta_visivel(c) not in manter]:
            del self.listas[c]
        hist = self.base.estado.get("historico")
        if isinstance(hist, dict):
            for c in [c for c in hist if conta_visivel(c) not in manter or not isinstance(hist[c], dict)]:
                del hist[c]
            for h in hist.values():
                ps = h.get("analisadas") if isinstance(h.get("analisadas"), dict) else {}
                h["analisadas"] = {k: v for k, v in ps.items() if k not in self.base.indice and k not in self.desistencias}
        for lst in self.listas.values():
            ps = lst.get("partidas") or {}
            for k in [k for k, ini in ps.items() if not isinstance(ini, (int, float)) or agora - ini > REPLAY_SOME_S + 86400]:
                del ps[k]
                self.saiu_da_lista(k)
        uso = self.base.estado["uso"]
        for d in sorted(uso)[:-14]:
            del uso[d]
        comp = {str(c) for e in self.lo.values() for c in e.get("companheiros") or []}
        for c in [c for c in self.nomes if c not in comp]:
            del self.nomes[c]

    def atualizar_grupos(self) -> None:
        grupo = self.contas_amigas() | {self.lo_conta}
        for ent in self.base.indice.values():
            if isinstance(ent, dict):
                contas = set(ent.get("radiant") or []) | set(ent.get("dire") or [])
                ent["grupo"] = sorted(set(ent.get("grupo") or []) | (contas & grupo))

    def amigos_json(self) -> dict:
        def fonte(c):
            return "detectado+manual" if c in self.amigos and c in self.manuais else "detectado" if c in self.amigos else "manual"
        contas = {}
        for c in sorted(self.contas_amigas(), key=lambda c: (-(self.amigos.get(c) or {}).get("jogos", 0), c)):
            info = dict(self.amigos.get(c) or {"nome": "", "jogos": 0, "sessoes": 0, "ultima": None})
            info["nome"] = info.get("nome") or self.manuais.get(c, "")
            info["fonte"] = fonte(c)
            contas[str(c)] = info
        return {
            "atualizado": iso(self.relogio()),
            "conta_principal": self.lo_conta,
            "regra": (f"colega de time (mesmo lado, conta visível) em >= {self.a.min_jogos} partidas do LO, em >= "
                      f"{self.a.min_sessoes} sessões diferentes, nos últimos {self.a.janela} dias (sessão nova depois de "
                      f"> {PAUSA_SESSAO_S // 3600} h entre o início de uma partida do LO e o da seguinte); mais a lista "
                      "manual do amigos.json do site"),
            "partidas_do_lo_na_janela": sum(1 for e in self.lo.values()
                                            if self.relogio() - (e.get("inicio") or 0) <= self.a.janela * 86400),
            "amigos": contas,
            "quase": {str(c): v for c, v in sorted(self.quase.items(), key=lambda kv: (-kv[1]["jogos"], kv[0]))},
        }


# ---------------------------------------------------------------- resumo

def resumo_md(r: Rodada, cota: Cota, motivo: str, inicio: float) -> str:
    falta, pend = r.faltam()
    total = len(r.base.indice)
    total_bytes = sum(int(e.get("bytes") or 0) for e in r.base.indice.values() if isinstance(e, dict))
    tipos = ", ".join(f"{t}: {n}" for t, n in sorted(cota.por_tipo.items())) or "nenhuma"
    b = cota.parada_reserva()
    if cota.tem_cabecalho_diario():
        rest = cota.restante.get("dia", cota.restante.get("mes"))
        rest_txt = f"{rest} ({'dia' if 'dia' in cota.restante else 'mês'}, cabeçalho do OpenDota); reserva {cota.reserva}"
    elif cota.chamadas == 0 and b and b.get("dia") == cota.hoje():
        rest_txt = (f"{b.get('restante')} na última leitura ({str(b.get('quando'))[11:16]} UTC, cabeçalho do OpenDota); "
                    f"reserva {cota.reserva}")
    else:
        rest_txt = (f"sem cabeçalho de cota; contador próprio: {cota.usados_hoje()} chamadas hoje (UTC), "
                    f"teto {cota.teto_dia - cota.reserva}")
    def nome(c, info):
        return f"{info.get('nome') or '?'} ({c})"
    amigos = "; ".join(f"{nome(c, i)}: {i['jogos']} jogos em {i['sessoes']} sessões" for c, i in
                       sorted(r.amigos.items(), key=lambda kv: -kv[1]["jogos"])) or "nenhum ainda"
    quase = "; ".join(f"{nome(c, i)}: {i['jogos']} jogos em {i['sessoes']} sessão(ões)" for c, i in
                      sorted(r.quase.items(), key=lambda kv: -kv[1]["jogos"])[:8])
    linhas = [
        f"## Coleta de partidas — {iso(inicio)[:16].replace('T', ' ')} UTC",
        "",
        f"- Chamadas ao OpenDota nesta rodada: **{cota.chamadas}** ({tipos}); hoje (UTC): {cota.usados_hoje()}",
        f"- Restante do dia: {rest_txt}",
        f"- Partidas novas salvas: **{r.novas}** com análise (LO: {r.novas_por_grupo['LO']}, amigos: "
        f"{r.novas_por_grupo['amigos']}" + (f", histórico antigo: {r.novas_por_grupo['histórico']}" if r.a.historico else "")
        + f"; {r.bytes_novos / 1e6:.1f} MB) + {r.basicas} só com dados básicos",
        f"- Sobra da cota do dia acima da reserva: {cota.sobra()}"
        + (" (a fila esvaziou: essa sobra não foi usada nesta rodada)" if motivo == "fila vazia" else ""),
        f"- Na base: {total} partidas ({total_bytes / 1e6:.1f} MB)",
        (f"- Faltam: {falta} partidas conhecidas, {pend} delas esperando a análise do OpenDota "
         f"(pedidos nesta rodada: {r.pedidos})"),
    ]
    if r.falhas:
        linhas.append(f"- Com erro, esperando nova tentativa: {len(r.falhas)} partidas")
    descartadas = r.descartadas_na_base()
    if descartadas or r.descartadas:
        mostrar = ", ".join(descartadas[-20:]) + (" ..." if len(descartadas) > 20 else "")
        linhas.append(f"- Descartadas sem nenhum dado (erro que se repete): {len(r.descartadas)} nesta rodada; "
                      f"{len(descartadas)} anotadas em estado.json ({mostrar})")
    linhas.append(f"- Amigos detectados: {amigos}")
    if quase:
        linhas.append(f"- Quase (não passaram na regra): {quase}")
    if r.manuais:
        linhas.append(f"- Lista manual (amigos.json do site): {', '.join(str(c) for c in sorted(r.manuais))}")
    if r.base.reconciliadas:
        linhas.append(f"- {r.base.reconciliadas} arquivos já baixados entraram no índice sem baixar de novo")
    linhas.append(f"- Fim da rodada: {motivo}")
    if cota.cabecalhos_primeira is not None:
        linhas.append(f"- Cabeçalhos de limite na primeira resposta: `{json.dumps(cota.cabecalhos_primeira)}`"
                      if cota.cabecalhos_primeira else "- Nenhum cabeçalho de limite na primeira resposta")
    return "\n".join(linhas) + "\n"


# ---------------------------------------------------------------- main

def env_int(nome: str, padrao: int) -> int:
    try:
        return int(os.environ.get(nome, "").strip() or padrao)
    except ValueError:
        return padrao


def env_float(nome: str, padrao: float) -> float:
    try:
        return float(os.environ.get(nome, "").strip() or padrao)
    except ValueError:
        return padrao


def argumentos(argv):
    ap = argparse.ArgumentParser(description="Coleta de partidas do LO e dos amigos (branch dados)")
    ap.add_argument("--dados", default="dados", help="pasta do branch dados")
    ap.add_argument("--amigos", default="amigos.json", help="amigos.json do site (lista manual, só leitura)")
    ap.add_argument("--conta", type=int, default=env_int("COLETA_CONTA", CONTA_LO))
    ap.add_argument("--api", default=os.environ.get("OPENDOTA_API") or API)
    ap.add_argument("--reserva", type=int, default=env_int("COLETA_RESERVA", RESERVA))
    ap.add_argument("--teto-dia", type=int, default=env_int("COLETA_TETO_DIA", TETO_DIA))
    ap.add_argument("--orcamento-sem-cabecalho", type=int, default=env_int("COLETA_ORCAMENTO_SEM_CABECALHO", ORCAMENTO_SEM_CABECALHO))
    ap.add_argument("--max-rodada", type=int, default=env_int("COLETA_MAX_RODADA", 0), help="0 = sem limite além da cota")
    ap.add_argument("--pausa", type=float, default=env_float("COLETA_PAUSA_S", PAUSA_S))
    ap.add_argument("--tempo-max", type=float, default=env_float("COLETA_TEMPO_MAX_S", TEMPO_MAX_S))
    ap.add_argument("--janela", type=int, default=JANELA_DIAS, help="dias de histórico")
    ap.add_argument("--min-jogos", type=int, default=MIN_JOGOS)
    ap.add_argument("--min-sessoes", type=int, default=MIN_SESSOES)
    ap.add_argument("--intervalo-lista", type=float, default=INTERVALO_LISTA_AMIGO_S)
    ap.add_argument("--historico", type=int, choices=(0, 1), default=1 if env_int("COLETA_HISTORICO", 1) else 0,
                    help="1 (padrão) = com a sobra da cota, baixa também partidas antigas já analisadas pelo OpenDota")
    return ap.parse_args(argv)


def main(argv=None, relogio=time.time, dormir=time.sleep) -> int:
    a = argumentos(argv)

    def log(s: str) -> None:
        print(s, flush=True)

    inicio = relogio()
    try:
        base = Base(Path(a.dados), log)
    except BaseEstragada as e:
        log(f"ERRO: {e}. Nada foi gravado: conserte o arquivo no branch dados (o robô não sobrescreve a base).")
        return 2
    cota = Cota(base.estado, a.reserva, a.teto_dia, a.orcamento_sem_cabecalho, a.max_rodada, relogio)
    api = OpenDota(a.api, cota, relogio, dormir, a.pausa, inicio + a.tempo_max, log)
    manuais = {c: n for c, n in ler_amigos_manuais(a.amigos).items() if c != a.conta}
    r = Rodada(a, base, api, cota, manuais, relogio, log)
    motivo, erro = "erro inesperado", None
    try:
        motivo = r.executar()
    except Parada as p:  # sinal fora do laço das chamadas
        motivo = str(p)
    except BaseException as e:  # noqa: BLE001  grava o que já tem antes de propagar
        erro = e
        motivo = f"erro inesperado: {type(e).__name__}: {e}"
    finally:
        if signal.getsignal(signal.SIGTERM) is _sinal:  # rodando como script: a gravação não é interrompida
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            signal.signal(signal.SIGINT, signal.SIG_IGN)
        # arquivo gravado sem entrar no índice (sinal bem no meio): entra agora, sem baixar de novo na próxima rodada
        base.reconciliadas += base.reconciliar(log)
        r.calcular_amigos()
        r.atualizar_grupos()
        r.limpar_estado()
        if cota.chamadas or not isinstance(base.estado.get("cota"), dict):  # rodada sem chamadas: fica a última leitura
            base.estado["cota"] = {"quando": iso(relogio()), "restante": cota.restante,
                                   "cabecalhos_primeira_resposta": cota.cabecalhos_primeira}
        falta, pend = r.faltam()
        base.estado["rodadas"] = (base.estado["rodadas"] + [{
            "inicio": iso(inicio), "chamadas": cota.chamadas, "novas": r.novas, "basicas": r.basicas,
            "pedidos": r.pedidos, "faltam": falta, "pendentes": pend, "restante": dict(cota.restante),
            "sobra_do_dia": cota.sobra(), "descartadas": sorted(r.descartadas, key=int), "fim": motivo,
        }])[-48:]
        base.gravar(r.amigos_json())
        texto = resumo_md(r, cota, motivo, inicio)
        log("")
        log(texto)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
                fh.write(texto)
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as fh:
                fh.write(f"novas={r.novas + r.basicas}\nchamadas={cota.chamadas}\n")
    if erro is not None:
        raise erro
    return 0


def _sinal(signum, _frame):
    raise Parada(f"interrompido pelo sinal {signal.Signals(signum).name} (tempo do GitHub?)")


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, _sinal)
    signal.signal(signal.SIGINT, _sinal)
    sys.exit(main())
