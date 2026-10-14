#!/usr/bin/env python3
"""Robô da BASE DE ROTAS: o que cada herói faz na fase de rota, na posição em que jogou.

Para cada duelo de rota (mesma rota física, papel contra papel: core contra core, suporte contra suporte) guarda a
diferença média de ouro ganho (gold_t) e XP aos 10 min, a % de rotas "ganhas" (+1000 de ouro) e a amostra. O painel
usa isso como o esperado da rota (engine.js: esperadoDoDuelo / expectativaDaRota). Win rate de partida NÃO entra.

Posição e duelos (iguais a posicoesNaRota / duelosDaRota do painel, para as chaves baterem):
  - quem roamou (is_roaming), foi para a selva (lane_role 4) ou não tem rota sai da rota;
  - na rota, o core é quem tem mais last hits aos 10 min, se tiver farm de core (20+ LH, ou 10+ e 60% do maior LH
    do time) ou 10+ LH e bem mais que o parceiro (ou sozinho); com sinal de suporte (position_est 4/5 ou 6+ wards)
    só com 40+ LH;
    farm parecido ou dois cores: desempate por LH aos 20 min, wards e GPM;
  - safe = pos1 e pos5, off = pos3 e pos4, mid = pos2 (um segundo herói no mid é pos4);
  - duelo: o core principal contra o core principal, suporte contra suporte (pelo ouro); quem sobra fica fora.

Base (rotas/base.json), tudo do ponto de vista do primeiro e só com 20+ rotas:
  "p": {"P|Q": [n, ouro, xp]}                 rota típica de posição contra posição (média crua)
  "h": {"A.P": {"Q": [n, ouro, xp]}}          herói A na posição P contra qualquer herói na posição Q
  "m": {"A.P": {"B.Q": [n, ouro, xp, %ganha]}} par de heróis
  Amostra pequena é puxada para o nível de cima, não para 0: o herói para a rota típica das posições e o par para
  (herói A na posição) + (herói B na posição) - (rota típica).

Fontes (só biblioteca padrão):
  auto     -> explorer se ele tiver partidas públicas; senão amostra             [padrão]
  amostra  -> /api/parsedMatches + /api/matches/{id} (partidas públicas analisadas, 1 chamada cada)
  explorer -> /api/explorer (SQL; no OpenDota costuma ter só partidas de liga: o --verificar mostra)
  falso    -> dados sintéticos (teste offline; exige --saida e --acumulado fora de rotas/)

rotas/acumulado.json guarda as somas brutas e até onde já coletou (ate_match_id / ate_start_time): a rodada
seguinte só soma o que é novo. As rodadas antigas perdem peso com o tempo (0,8 por semana; patch novo pesa mais).
Se a coleta falhar ou vier pequena, NADA é gravado: a base boa anterior fica.

Uso:
  python3 rotas/gerar.py --verificar             (o que o explorer tem: colunas, partidas por dia, liga x pública)
  python3 rotas/gerar.py                          (auto, com prazo de 40 min)
  python3 rotas/gerar.py --fonte falso --saida /tmp/base.json --acumulado /tmp/acc.json
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.dont_write_bytecode = True  # o workflow faz git add rotas

API = "https://api.opendota.com/api"
AQUI = Path(__file__).resolve().parent
MINUTO = 10
MIN_N = 20              # só vai para a base.json linha com 20+ rotas (o painel não usa menos que isso)
PRIOR_N = 30            # pseudo-rotas que puxam a média para o nível de cima (amostra pequena = perto do típico)
LIMIAR_GANHA = 1000     # rota "ganha" = +1000 de ouro aos 10 min
MIN_PARTIDAS = 5        # rodada com menos partidas novas que isso não grava nada (a base acumula entre rodadas; o OpenDota manda muita Turbo)
DECAIMENTO_SEMANA = 0.8  # peso das rodadas anteriores por semana que passou
PODA = 0.5              # par com menos que isso (depois do decaimento) sai do acumulado
ESPERA = 1.1            # segundos entre chamadas (<= 60/min, limite do OpenDota sem chave)
ESPERA_COM_CHAVE = 0.3
MODOS = {1, 2, 3, 4, 5, 16, 22}  # = modelos/compactar.py: all pick, captains, random/single draft, ranked all pick
RANK_MAX = 75           # rank médio acima disso (Divine 5, Immortal) fica fora: o grupo joga de Archon a Ancient
# posição na rota (= ROTA do engine.js)
FARM_CORE, FARM_MIN, FARM_FRACAO, EMPATE_LH = 20, 10, 0.6, 10


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- HTTP
_ult = [0.0]
CHAMADAS = [0]


def get_json(url: str, tentativas: int = 4, timeout: int = 120):
    """GET com espera entre chamadas e novas tentativas em 429/5xx. Erro de SQL do explorer (HTTP 400 com
    {"err": ...}) volta como dicionário para o chamador mostrar o motivo."""
    chave = os.environ.get("OPENDOTA_API_KEY")
    if chave:
        url += ("&" if "?" in url else "?") + "api_key=" + urllib.parse.quote(chave)
    ultimo = None
    for t in range(tentativas):
        espera = (ESPERA_COM_CHAVE if chave else ESPERA) - (time.time() - _ult[0])
        if espera > 0:
            time.sleep(espera)
        _ult[0] = time.time()
        CHAMADAS[0] += 1
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "culpado-dota2-rotas"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            corpo = ""
            try:
                corpo = e.read().decode(errors="replace")
            except Exception:  # noqa: BLE001
                pass
            if e.code == 400:
                try:
                    d = json.loads(corpo)
                except Exception:  # noqa: BLE001
                    d = None
                if isinstance(d, dict) and d.get("err"):
                    return d
            ultimo = f"HTTP {e.code}" + (f": {corpo[:300]}" if corpo else "")
            if e.code not in (429, 500, 502, 503, 504, 524):
                break
        except Exception as e:  # noqa: BLE001 (timeout, rede)
            ultimo = str(e)
        if t + 1 < tentativas:
            log(f"  falhou ({ultimo}); tentativa {t + 1}/{tentativas}")
            time.sleep(10 * (t + 1))
    raise RuntimeError(f"desisti ({ultimo}): {url.split('?')[0]}")


# ---------------------------------------------------------------- posições (= posicoesNaRota do painel)
def lane_fisica(lane, lane_role, radiant: bool):
    if lane in (1, 2, 3):
        return lane
    if lane_role == 2:
        return 2
    if lane_role == 1:
        return 1 if radiant else 3
    if lane_role == 3:
        return 3 if radiant else 1
    return None


def tipo_da_lane(lane, radiant: bool):
    if lane == 2:
        return "mid"
    if lane == 1:
        return "safe" if radiant else "off"
    if lane == 3:
        return "off" if radiant else "safe"
    return None


def _farm_de_core(j: dict, max_lh: float) -> bool:
    x = j.get("lh10")
    return x is not None and (x >= FARM_CORE or (x >= FARM_MIN and x >= FARM_FRACAO * max_lh))


def _sinal_de_suporte(j: dict) -> bool:
    """O OpenDota estima pos4/pos5; sem essa estimativa, 6+ wards na partida (= sinalDeSuporte do painel)."""
    if j.get("est"):
        return j["est"] >= 4
    return j.get("wards") is not None and j["wards"] >= 6


def _suporte_fraco(j: dict) -> bool:
    """Suporte que pegou uns creeps continua suporte, a não ser com farm de carry (40+ LH aos 10 min)."""
    return _sinal_de_suporte(j) and (j.get("lh10") or 0) < 2 * FARM_CORE


def _farm_forte(j: dict, max_lh: float) -> bool:
    return _farm_de_core(j, max_lh) and not _suporte_fraco(j)


def _rota_tem_core(ordem: list[dict], max_lh: float, mid: bool = False) -> bool:
    """O primeiro da fila tem farm de core, ou tem 10+ LH e bem mais que o parceiro (offlaner apanhando), ou estava
    sozinho na rota (= rotaTemCore do painel)."""
    a = ordem[0]
    if not (mid and len(ordem) == 1) and _suporte_fraco(a):  # sozinho no mid com 10+ LH é o pos2 mesmo com position_est 4/5
        return False
    if _farm_de_core(a, max_lh):
        return True
    la = a.get("lh10") or 0
    if la < FARM_MIN:
        return False
    return len(ordem) == 1 or la >= 2 * (ordem[1].get("lh10") or 0) + 5


def _desempate(a: dict, b: dict) -> int:
    """LH aos 20 min, depois wards (quem põe bem mais é o suporte), depois GPM. 1 = a, -1 = b, 0 = dúbio."""
    def rel(x, y):
        if x is None or y is None or max(x, y) <= 0:
            return 0.0
        return (x - y) / max(x, y)
    r = rel(a.get("lh20"), b.get("lh20"))
    if abs(r) >= 0.15:
        return 1 if r > 0 else -1
    wa, wb = a.get("wards"), b.get("wards")
    if wa is not None and wb is not None and abs(wa - wb) >= 5:
        return 1 if wa < wb else -1
    r = rel(float(a.get("gpm") or 0), float(b.get("gpm") or 0))
    return (1 if r > 0 else -1) if abs(r) >= 0.15 else 0


def atribuir_posicoes(jogadores: list[dict]) -> list[dict]:
    """jogadores (na ordem da partida): [{radiant, hero, lane, lane_role, roam, g10, x10, lh10, lh20, wards, est, gpm}]
    -> + pos, rota (lane física ou None), core, principal, duvida."""
    for radiant in (True, False):
        time_ = [j for j in jogadores if j["radiant"] == radiant]
        max_lh = max([0.0] + [float(j.get("lh10") or 0) for j in time_])
        por = defaultdict(list)
        for j in time_:
            lane = lane_fisica(j.get("lane"), j.get("lane_role"), radiant)
            saiu = bool(j.get("roam")) or j.get("lane_role") == 4 or lane is None
            fora = saiu and _farm_de_core(j, max_lh)
            j.update(rota=None if saiu else lane, pos=4 if saiu and not fora else None, core=fora, principal=False, duvida=False)
            if not saiu:
                por[lane].append(j)
        for lane, xs in por.items():
            tipo = tipo_da_lane(lane, radiant)
            ordem = sorted(xs, key=lambda j: (_suporte_fraco(j), -(j["lh10"] if j.get("lh10") is not None else -1), -(j.get("g10") or 0), -(j.get("gpm") or 0)))
            tem_core = _rota_tem_core(ordem, max_lh, tipo == "mid")
            if tem_core and len(ordem) > 1:
                a, b = ordem[0], ordem[1]
                dois = _farm_forte(b, max_lh)
                if dois or (a.get("lh10") or 0) - (b.get("lh10") or 0) < EMPATE_LH:
                    v = _desempate(a, b)
                    if v < 0:
                        ordem[0], ordem[1] = b, a
                    if dois or v == 0:
                        a["duvida"] = b["duvida"] = True
            for i, j in enumerate(ordem):
                j["principal"] = tem_core and i == 0
                j["core"] = j["principal"] or (j["duvida"] and _farm_forte(j, max_lh))
                j["pos"] = {"safe": 1, "mid": 2, "off": 3}[tipo] if j["principal"] else (5 if tipo == "safe" else 4)
    return jogadores


def duelos_da_partida(jogadores: list[dict]):
    """(heroA, posA, heroB, posB, dif_ouro, dif_xp) de cada duelo Radiant x Dire (= duelosDaRota do painel)."""
    atribuir_posicoes(jogadores)
    idx = {id(j): i for i, j in enumerate(jogadores)}
    out = []
    for lane in (1, 2, 3):
        a = [j for j in jogadores if j["radiant"] and j["rota"] == lane]
        b = [j for j in jogadores if not j["radiant"] and j["rota"] == lane]
        for core in (True, False):
            def ordem(xs):
                return sorted((j for j in xs if bool(j["core"]) == core), key=lambda j: (-int(j["principal"]), -(j.get("g10") or 0), idx[id(j)]))
            for x, y in zip(ordem(a), ordem(b)):
                out.append((x["hero"], x["pos"], y["hero"], y["pos"], x["g10"] - y["g10"], x["x10"] - y["x10"]))
    return out


# ---------------------------------------------------------------- agregação
def nova_acc():
    return defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])  # n, soma ouro, soma xp, ganhas, perdidas


def agregar(duelos, acc):
    for ha, pa, hb, pb, dg, dx in duelos:
        k1, k2, sinal = f"{ha}.{pa}", f"{hb}.{pb}", 1
        if (ha, pa) > (hb, pb):  # chave canônica: guarda cada par uma vez
            k1, k2, sinal = k2, k1, -1
        a = acc[f"{k1}|{k2}"]
        a[0] += 1
        a[1] += sinal * dg
        a[2] += sinal * dx
        a[3] += sinal * dg >= LIMIAR_GANHA
        a[4] += sinal * dg <= -LIMIAR_GANHA


def fator_de_decaimento(gerado_antes: float | None, agora: float) -> float:
    if not gerado_antes:
        return DECAIMENTO_SEMANA
    semanas = max(0.0, (agora - float(gerado_antes)) / (7 * 86400))
    return DECAIMENTO_SEMANA ** semanas


def juntar(acc, anterior: dict | None, fator: float):
    """Soma o acumulado das rodadas anteriores (com decaimento) ao desta e tira os pares que sumiram."""
    for k, v in ((anterior or {}).get("pares") or {}).items():
        a = acc[k]
        for i in range(5):
            a[i] += fator * float(v[i])
    for k in [k for k, v in acc.items() if v[0] < PODA]:
        del acc[k]
    return acc


def montar_base(acc, meta: dict) -> dict:
    """{"v": 2, "minuto": 10, "min_n": 20, ..., "p": {...}, "h": {...}, "m": {...}} (ver o topo do arquivo)."""
    pos = defaultdict(lambda: [0.0, 0.0, 0.0])
    her = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0.0]))
    pares = []
    for k, (n, g, x, w, l) in acc.items():
        a, b = k.split("|")
        pa, pb = a.split(".")[1], b.split(".")[1]
        for (kp, s) in ((f"{pa}|{pb}", 1), (f"{pb}|{pa}", -1)):
            t = pos[kp]
            t[0] += n
            t[1] += s * g
            t[2] += s * x
        for (ka, kq, s) in ((a, pb, 1), (b, pa, -1)):
            t = her[ka][kq]
            t[0] += n
            t[1] += s * g
            t[2] += s * x
        pares.append((a, b, n, g, x, w, l))
    media_pos = {k: (g / n, x / n) if n else (0.0, 0.0) for k, (n, g, x) in pos.items()}

    def heroi(chave: str, pos_rival: str) -> tuple[float, float]:
        """Herói na posição contra a posição rival, puxado para a rota típica dessas posições."""
        mg, mx = media_pos.get(f"{chave.split('.')[1]}|{pos_rival}", (0.0, 0.0))
        t = her.get(chave, {}).get(pos_rival)
        if not t or not t[0]:
            return mg, mx
        n, g, x = t
        return (g + PRIOR_N * mg) / (n + PRIOR_N), (x + PRIOR_N * mx) / (n + PRIOR_N)

    m: dict[str, dict] = defaultdict(dict)
    for a, b, n, g, x, w, l in pares:
        if n < MIN_N or a == b:  # espelho (mesmo herói na mesma posição) é 0 por definição
            continue
        pa, pb = a.split(".")[1], b.split(".")[1]
        mg, mx = media_pos.get(f"{pa}|{pb}", (0.0, 0.0))
        hag, hax = heroi(a, pb)
        hbg, hbx = heroi(b, pa)
        prior_g, prior_x = hag - hbg - mg, hax - hbx - mx
        og = round((g + PRIOR_N * prior_g) / (n + PRIOR_N))
        ox = round((x + PRIOR_N * prior_x) / (n + PRIOR_N))
        m[a][b] = [round(n), og, ox, round(100 * w / n)]
        m[b][a] = [round(n), -og, -ox, round(100 * l / n)]
    h: dict[str, dict] = {}
    for chave, lin in her.items():
        for q, (n, _, _) in lin.items():
            if n >= MIN_N:
                g, x = heroi(chave, q)
                h.setdefault(chave, {})[q] = [round(n), round(g), round(x)]
    p = {k: [round(n), round(g / n), round(x / n)] for k, (n, g, x) in pos.items() if n >= MIN_N}
    return {"v": 2, "minuto": MINUTO, "min_n": MIN_N, "prior": PRIOR_N, "limiar_ganha": LIMIAR_GANHA, "medida": "gold_t + xp_t aos 10 min",
            **meta, "p": p, "h": h, "m": dict(m)}


# ---------------------------------------------------------------- filtro de partida (= modelos/compactar.py:valida + rank)
def valida(match: dict, rank_max: float = RANK_MAX) -> str | None:
    """Motivo para descartar a partida, ou None se serve para a base."""
    if match.get("version") is None:
        return "sem replay analisado"
    if match.get("game_mode") not in MODOS:
        return f"modo {match.get('game_mode')}"
    if (match.get("duration") or 0) < 15 * 60:
        return "menos de 15 min"
    ps = match.get("players") or []
    if len(ps) != 10 or any(not p.get("hero_id") for p in ps):
        return "sem 10 heróis"
    if any((p.get("leaver_status") or 0) >= 2 for p in ps):  # 1 = caiu e voltou; 2+ = abandono de verdade
        return "abandono"
    ranks = [p["rank_tier"] for p in ps if p.get("rank_tier")]
    if ranks and sum(ranks) / len(ranks) > rank_max:
        return "rank alto"
    return None


def jogadores_da_partida(match: dict) -> list[dict] | None:
    js = []
    for p in match.get("players") or []:
        gt, xt, lt = p.get("gold_t") or [], p.get("xp_t") or [], p.get("lh_t") or []
        if len(gt) <= MINUTO or len(xt) <= MINUTO or len(lt) <= MINUTO:
            return None
        js.append({"radiant": p["player_slot"] < 128, "hero": p["hero_id"], "lane": p.get("lane"), "lane_role": p.get("lane_role"),
                   "roam": p.get("is_roaming") is True, "gpm": p.get("gold_per_min") or 0,
                   "g10": gt[MINUTO], "x10": xt[MINUTO], "lh10": lt[MINUTO], "lh20": lt[min(20, len(lt) - 1)],
                   "wards": None if p.get("obs_placed") is None and p.get("sen_placed") is None else (p.get("obs_placed") or 0) + (p.get("sen_placed") or 0),
                   "est": p.get("position_est")})
    return js if len(js) == 10 else None


# ---------------------------------------------------------------- fonte: amostra (partidas públicas analisadas)
def fonte_amostra(prazo: float, orcamento: int, ate_match_id: int = 0, rank_max: float = RANK_MAX):
    """Anda pelas partidas analisadas mais recentes até a última já coletada (ate_match_id), o prazo ou o orçamento."""
    acc, partidas, menor, maior = nova_acc(), 0, None, ate_match_id
    motivos: dict[str, int] = defaultdict(int)
    inicio_chamadas = CHAMADAS[0]
    vistas = 0
    fim = False
    while not fim and time.time() < prazo and CHAMADAS[0] - inicio_chamadas < orcamento:
        try:
            lista = get_json(f"{API}/parsedMatches" + (f"?less_than_match_id={menor}" if menor else ""))
        except RuntimeError as e:
            if not partidas:
                raise
            log(f"  lista de partidas falhou ({e}): fico com o que já tenho")
            break
        ids =[x["match_id"] for x in lista or [] if isinstance(x, dict) and x.get("match_id")]
        if not ids:
            break
        menor = min(ids)
        for mid in sorted(ids, reverse=True):
            if mid <= ate_match_id:
                fim = True  # daqui para baixo já foi coletado numa rodada anterior
                break
            if time.time() >= prazo or CHAMADAS[0] - inicio_chamadas >= orcamento:
                fim = True
                break
            vistas += 1
            try:
                mt = get_json(f"{API}/matches/{mid}", tentativas=2)
            except RuntimeError as e:
                log(f"  {mid}: {e}")
                if "429" in str(e):
                    fim = True  # limite do dia: para e grava o que já tem
                    break
                continue
            motivo = valida(mt, rank_max)
            js = None if motivo else jogadores_da_partida(mt)
            if motivo or js is None:
                motivos[motivo or "sem séries por minuto"] += 1
                continue
            agregar(duelos_da_partida(js), acc)
            partidas += 1
            maior = max(maior, mid)
            if vistas % 100 == 0:
                log(f"  amostra: {partidas} partidas de {vistas} vistas ({CHAMADAS[0] - inicio_chamadas} chamadas)")
    log(f"amostra: {partidas} partidas boas de {vistas} vistas; descartadas: {dict(motivos) or 'nenhuma'}")
    return acc, partidas, {"ate_match_id": maior}


# ---------------------------------------------------------------- fonte: explorer (SQL)
# gold_t/xp_t/lh_t são arrays por minuto a partir do minuto 0; no Postgres o índice começa em 1 -> [MINUTO + 1].
FILTRO_PUBLICA = "COALESCE(m.leagueid, 0) = 0 AND m.game_mode IN ({modos})".format(modos=",".join(map(str, sorted(MODOS))))
SQL = """SELECT pm.match_id, pm.player_slot, pm.hero_id, pm.lane, pm.lane_role, pm.is_roaming, pm.gold_per_min, m.start_time,
pm.gold_t[{i}] AS g10, pm.xp_t[{i}] AS x10, pm.lh_t[{i}] AS lh10, pm.lh_t[21] AS lh20
FROM player_matches pm JOIN matches m USING (match_id)
WHERE m.start_time >= {ini} AND m.start_time < {fim} AND m.duration >= 900 AND {filtro}
AND pm.gold_t IS NOT NULL AND array_length(pm.gold_t, 1) > {i}
ORDER BY pm.match_id, pm.player_slot LIMIT {lim}"""
SQL_CONTAGEM = ("SELECT count(*) AS total, count(*) FILTER (WHERE COALESCE(leagueid, 0) > 0) AS liga "
                "FROM matches WHERE start_time > {desde}")


def linha_para_jogador(r: dict) -> dict:
    return {"radiant": int(r["player_slot"]) < 128, "hero": int(r["hero_id"]), "lane": r.get("lane"),
            "lane_role": r.get("lane_role"), "roam": r.get("is_roaming") is True, "gpm": r.get("gold_per_min") or 0,
            "g10": r.get("g10") or 0, "x10": r.get("x10") or 0, "lh10": r.get("lh10"), "lh20": r.get("lh20"), "wards": None, "est": None}


def partidas_das_linhas(rows: list[dict]):
    por = defaultdict(list)
    for r in rows:
        por[r["match_id"]].append(r)
    # o LIMIT pode cortar a última partida: só entra partida com os 10
    return [(mid, [linha_para_jogador(r) for r in sorted(rs, key=lambda r: int(r["player_slot"]))], max(int(r.get("start_time") or 0) for r in rs))
            for mid, rs in por.items() if len(rs) == 10 and sum(int(r["player_slot"]) < 128 for r in rs) == 5]


def contagem_do_explorer(agora: int | None = None) -> dict:
    """Partidas nas últimas 24 h no explorer: total e de liga. Se total == liga, o explorer é só de partidas de liga."""
    agora = agora or int(time.time())
    d = get_json(f"{API}/explorer?sql=" + urllib.parse.quote(SQL_CONTAGEM.format(desde=agora - 86400)), tentativas=1, timeout=100)
    if d.get("err"):
        raise RuntimeError(f"erro do explorer: {str(d['err'])[:300]}")
    r = (d.get("rows") or [{}])[0]
    total, liga = int(r.get("total") or 0), int(r.get("liga") or 0)
    return {"total": total, "liga": liga, "publicas": total - liga}


def fonte_explorer(dias: int, fatias: int, lim: int, prazo: float, ate_start_time: int = 0, agora: int | None = None):
    acc, partidas, ok, seguidas = nova_acc(), 0, 0, 0
    agora = agora or int(time.time())
    desde = max(agora - dias * 86400, int(ate_start_time or 0))
    passo = max(1, (agora - desde) // fatias)
    ultimo = int(ate_start_time or 0)
    for f in range(fatias):
        if time.time() >= prazo:
            log(f"fatia {f + 1}/{fatias}: prazo acabou")
            break
        fim = agora - f * passo
        ini = max(desde, fim - passo)
        if ini >= fim:
            break
        q = SQL.format(i=MINUTO + 1, ini=ini, fim=fim, lim=lim, filtro=FILTRO_PUBLICA)
        try:
            d = get_json(f"{API}/explorer?sql=" + urllib.parse.quote(q), tentativas=1, timeout=100)
            if d.get("err"):
                raise RuntimeError(f"erro do explorer: {str(d['err'])[:300]}")
        except RuntimeError as e:
            log(f"fatia {f + 1}/{fatias}: {e}")
            seguidas += 1
            if seguidas >= 3:
                log("3 fatias seguidas com erro: desisto do explorer")
                break
            continue
        seguidas = 0
        js = partidas_das_linhas(d.get("rows") or [])
        for _, x, st in js:
            agregar(duelos_da_partida(x), acc)
            ultimo = max(ultimo, st)
        partidas += len(js)
        ok += 1
        log(f"fatia {f + 1}/{fatias}: {len(d.get('rows') or [])} linhas, {len(js)} partidas")
    if not ok:
        raise RuntimeError("nenhuma fatia do explorer respondeu")
    return acc, partidas, {"ate_start_time": ultimo}


# ---------------------------------------------------------------- fonte: falsa (teste offline)
def partidas_falsas(n: int = 4000, semente: int = 1, forte: int = 1, herois: int = 14):
    """Partidas sintéticas. O herói `forte` sai ~900 na frente na rota; nos outros, ruído."""
    rnd = random.Random(semente)
    forca = {h: rnd.gauss(0, 200) for h in range(1, herois + 1)}
    forca[forte] = 900
    for _ in range(n):
        hs = rnd.sample(range(1, herois + 1), 10)
        js = []
        for i, h in enumerate(hs):
            radiant = i < 5
            k = i % 5
            lane_role = [1, 1, 2, 3, 3][k]
            roam = k == 4 and rnd.random() < 0.2
            core = k in (0, 2, 3)
            base = {1: 4200, 2: 3900, 3: 3400}[lane_role] - (0 if core else 2000)
            g = int(base + forca[h] + rnd.gauss(0, 400))
            lh = max(0, (g - 400) // 45) if core else rnd.randint(0, 9)
            js.append({"radiant": radiant, "hero": h, "lane": None, "lane_role": lane_role, "roam": roam,
                       "g10": g, "x10": int(g * 1.1), "lh10": lh, "lh20": lh * 2, "wards": 2 if core else 15, "gpm": 0})
        yield js


def fonte_falsa(n: int = 4000):
    acc = nova_acc()
    for js in partidas_falsas(n):
        agregar(duelos_da_partida(js), acc)
    return acc, n, {}


# ---------------------------------------------------------------- verificação
def verificar() -> int:
    """O que o explorer tem: colunas que o robô usa, se gold_t[11] é o minuto 10 e quantas partidas por dia são de
    liga x públicas. Tudo vai para o stdout (o workflow põe no resumo)."""
    ok = True
    q = ("SELECT pm.match_id, pm.player_slot, pm.hero_id, pm.lane, pm.lane_role, pm.is_roaming, pm.gold_t[11] g10, pm.xp_t[11] x10, "
         "pm.lh_t[11] lh10, pm.lh_t[21] lh20, pm.gold_t[1] g0, array_length(pm.gold_t, 1) minutos, m.leagueid, m.game_mode, m.lobby_type "
         "FROM player_matches pm JOIN matches m USING (match_id) WHERE pm.gold_t IS NOT NULL ORDER BY pm.match_id DESC LIMIT 20")
    try:
        d = get_json(f"{API}/explorer?sql=" + urllib.parse.quote(q), tentativas=1, timeout=100)
        rows = d.get("rows") or []
        print(json.dumps({"err": d.get("err"), "linhas": d.get("rowCount"), "colunas": [f.get("name") for f in d.get("fields") or []],
                          "exemplo": rows[0] if rows else None}, indent=1, ensure_ascii=False))
        # gold_t[1] é o minuto 0 (0 ou perto disso); gold_t[11], o minuto 10 (alguns milhares)
        if rows and rows[0].get("g0") is not None:
            print(f"minuto 0 = {rows[0]['g0']}, minuto 10 = {rows[0]['g10']} (esperado: ~0 e ~2000-5000)")
        ok = not d.get("err") and bool(rows)
    except RuntimeError as e:
        print(f"consulta das colunas falhou: {e}")
        ok = False
    try:
        c = contagem_do_explorer()
        print(f"partidas nas últimas 24 h no explorer: {c['total']} ({c['liga']} de liga, {c['publicas']} públicas)")
        if c["publicas"] < 100:
            print("=> o explorer quase não tem partida pública: a fonte da base de rotas é a amostra (/parsedMatches)")
        else:
            print("=> o explorer tem partidas públicas: o modo auto usa o explorer (só partidas públicas, modos normais)")
    except RuntimeError as e:
        print(f"contagem falhou: {e}")
        ok = False
    return 0 if ok else 1


# ---------------------------------------------------------------- main
def ler_json(p: Path):
    try:
        d = json.loads(p.read_text())
        return d if isinstance(d, dict) else None
    except Exception:  # noqa: BLE001
        return None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fonte", default="auto", choices=["auto", "amostra", "explorer", "falso"])
    ap.add_argument("--dias", type=int, default=14, help="explorer: janela máxima (só o que é mais novo que a última coleta)")
    ap.add_argument("--fatias", type=int, default=14, help="explorer: consultas (uma por período)")
    ap.add_argument("--limite", type=int, default=30000, help="explorer: linhas por consulta (10 por partida)")
    ap.add_argument("--orcamento", type=int, default=1200, help="amostra: máximo de chamadas à API nesta rodada")
    ap.add_argument("--rank-max", type=float, default=RANK_MAX, help="amostra: rank médio máximo (rank_tier, 75 = Divine 5)")
    ap.add_argument("--prazo-min", type=float, default=40, help="tempo máximo da rodada inteira (o workflow corta em 45)")
    ap.add_argument("--saida", default=None, help="padrão: rotas/base.json")
    ap.add_argument("--acumulado", default=None, help="padrão: rotas/acumulado.json")
    ap.add_argument("--min-partidas", type=int, default=MIN_PARTIDAS)
    ap.add_argument("--verificar", action="store_true")
    a = ap.parse_args(argv)
    if a.verificar:
        return verificar()

    if a.fonte == "falso":
        # nunca grava a base sintética por cima da de verdade
        if not a.saida or not a.acumulado or AQUI in (Path(a.saida).resolve().parent, Path(a.acumulado).resolve().parent):
            log("--fonte falso exige --saida e --acumulado fora de rotas/ (para não sobrescrever a base de verdade)")
            return 2
    acc_path = Path(a.acumulado or AQUI / "acumulado.json")
    saida = Path(a.saida or AQUI / "base.json")
    anterior = ler_json(acc_path) or {}
    inicio = time.time()
    prazo = inicio + a.prazo_min * 60
    fonte = a.fonte
    estado: dict = {}
    try:
        if fonte == "auto":
            try:
                c = contagem_do_explorer()
                log(f"explorer: {c['total']} partidas nas últimas 24 h, {c['publicas']} públicas")
                fonte = "explorer" if c["publicas"] >= 100 else "amostra"
            except Exception as e:  # noqa: BLE001
                log(f"explorer não respondeu à contagem ({e})")
                fonte = "amostra"
            log(f"fonte escolhida: {fonte}")
        if fonte == "explorer":
            try:
                acc, n, estado = fonte_explorer(a.dias, a.fatias, a.limite, prazo, anterior.get("ate_start_time") or 0)
            except Exception as e:  # noqa: BLE001
                if a.fonte == "explorer":
                    raise
                log(f"explorer falhou ({e}); caindo para a amostra")
                fonte = "amostra"
        if fonte == "amostra":
            acc, n, estado = fonte_amostra(prazo, a.orcamento, int(anterior.get("ate_match_id") or 0), a.rank_max)
        elif fonte == "falso":
            acc, n, estado = fonte_falsa()
    except Exception as e:  # noqa: BLE001
        log(f"coleta falhou ({e}); base antiga mantida")
        return 1
    if n < a.min_partidas:
        log(f"só {n} partidas novas nesta rodada (mínimo {a.min_partidas}): base antiga mantida")
        return 1

    agora = time.time()
    fator = fator_de_decaimento(anterior.get("gerado"), agora)
    juntar(acc, anterior, fator)
    total = n + fator * float(anterior.get("partidas") or 0)
    novo_estado = {"ate_match_id": max(int(anterior.get("ate_match_id") or 0), int(estado.get("ate_match_id") or 0)),
                   "ate_start_time": max(int(anterior.get("ate_start_time") or 0), int(estado.get("ate_start_time") or 0))}
    base = montar_base(acc, {"gerado": int(agora), "fonte": fonte, "partidas": round(total), "partidas_rodada": n})
    saida.parent.mkdir(parents=True, exist_ok=True)
    acc_path.parent.mkdir(parents=True, exist_ok=True)
    # grava em arquivo temporário e troca: um erro no meio nunca deixa a base pela metade
    acumulado = {"v": 2, "gerado": int(agora), "partidas": round(total, 2), **novo_estado,
                 "pares": {k: [round(x, 2) for x in v] for k, v in sorted(acc.items())}}
    for p, dados in ((acc_path, acumulado), (saida, base)):
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(dados, separators=(",", ":")))
        tmp.replace(p)
    pares = sum(len(v) for v in base["m"].values()) // 2
    log(f"ok: {n} partidas novas ({fonte}, {CHAMADAS[0]} chamadas, {round((agora - inicio) / 60, 1)} min), {round(total)} no acumulado "
        f"(peso das antigas {fator:.2f}); base: {len(base['p'])} pares de posição, {sum(len(v) for v in base['h'].values())} herói.pos "
        f"e {pares} pares de heróis com {MIN_N}+ rotas -> {saida} ({saida.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
