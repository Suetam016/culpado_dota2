"""Partidas de League of Legends dos jogadores de lol/jogadores.json, pela API oficial da Riot (protótipo do Culpado LoL).

Roda no GitHub Actions com a chave da Riot no segredo RIOT_API_KEY (o container do Claude não alcança a Riot, e a chave
nunca vai para o navegador nem para o repositório). Para cada jogador: Riot ID -> PUUID (account-v1), últimas partidas
(match-v5) e, para cada partida nova, a partida + a timeline, compactadas no que o site usa:

    lol/partidas/<id>.json   partida compacta (jogadores, estatísticas, quadros por minuto, eventos)
    lol/indice.json          lista das partidas por jogador, das mais novas para as mais velhas

    python lol/coletar.py --jogadores lol/jogadores.json --saida lol

A chave de desenvolvimento expira a cada 24 h: com 401/403 o script avisa e sai com erro (o run fica vermelho no Actions).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "culpado-lol-coleta"
PAUSA_S = 1.25            # chave de desenvolvimento/pessoal: 100 chamadas a cada 2 min e 20 por segundo
POR_JOGADOR = 20          # partidas mais recentes consultadas por jogador a cada rodada
MAX_NOVAS = 30            # partidas novas baixadas por rodada (2 chamadas cada)
TENTATIVAS_429 = 4

# plataforma (onde a conta joga) -> roteamento regional da match-v5 e da account-v1
REGIOES = {
    "br1": "americas", "na1": "americas", "la1": "americas", "la2": "americas",
    "euw1": "europe", "eun1": "europe", "tr1": "europe", "ru": "europe", "me1": "europe",
    "kr": "asia", "jp1": "asia",
    "oc1": "sea", "sg2": "sea", "tw2": "sea", "vn2": "sea",
}

RE_RIOT_ID = re.compile(r"^(.{3,16})#([A-Za-z0-9]{2,5})$")

CAMPOS = (
    "puuid", "riotIdGameName", "riotIdTagline", "championName", "championId", "teamId", "teamPosition",
    "win", "kills", "deaths", "assists", "champLevel", "goldEarned", "totalMinionsKilled", "neutralMinionsKilled",
    "totalDamageDealtToChampions", "totalDamageTaken", "damageDealtToObjectives", "damageDealtToBuildings",
    "visionScore", "wardsPlaced", "wardsKilled", "detectorWardsPlaced", "timeCCingOthers", "totalTimeSpentDead",
    "longestTimeSpentLiving", "summoner1Id", "summoner2Id", "gameEndedInSurrender", "gameEndedInEarlySurrender",
    "spell1Casts", "spell2Casts", "spell3Casts", "spell4Casts", "summoner1Casts", "summoner2Casts",
)
VERSAO = 3                # partidas gravadas com versão menor são baixadas de novo
                          # (v2: uso de habilidades e skills; v3: pings, todas as conquistas, recibo das mortes, ouro no bolso)
PINGS = (
    "allInPings", "assistMePings", "basicPings", "commandPings", "dangerPings", "enemyMissingPings",
    "enemyVisionPings", "getBackPings", "holdPings", "needVisionPings", "onMyWayPings", "pushPings",
    "retreatPings", "visionClearedPings",
)


class ChaveInvalida(Exception):
    pass


class Api:
    def __init__(self, chave: str, pausa: float = PAUSA_S):
        self.chave, self.pausa, self.ultima, self.chamadas = chave, pausa, 0.0, 0

    def get(self, url: str):
        for tentativa in range(TENTATIVAS_429 + 1):
            espera = self.ultima + self.pausa - time.monotonic()
            if espera > 0:
                time.sleep(espera)
            self.ultima = time.monotonic()
            self.chamadas += 1
            req = urllib.request.Request(url, headers={"X-Riot-Token": self.chave, "User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return json.loads(r.read())
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    raise ChaveInvalida(f"HTTP {e.code}") from e
                if e.code == 404:
                    return None
                if e.code == 429 or e.code >= 500:
                    if tentativa == TENTATIVAS_429:
                        raise
                    time.sleep(float(e.headers.get("Retry-After") or 10 * (tentativa + 1)))
                    continue
                raise
        return None


# ---------------------------------------------------------------- compactar

def compactar(partida: dict, timeline: dict | None) -> dict:
    """Partida + timeline da match-v5 -> o JSON pequeno que o site lê."""
    info = partida["info"]
    jogadores = []
    for p in info["participants"]:
        j = {k: p.get(k) for k in CAMPOS}
        j["id"] = p.get("participantId")
        j["itens"] = [p.get(f"item{i}", 0) for i in range(7)]
        ch = p.get("challenges") or {}
        # todas as conquistas (viram medalhas); números com muitas casas são arredondados
        j["challenges"] = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in ch.items()
                           if isinstance(v, (int, float))}
        j["pings"] = {k[:-5]: p.get(k, 0) for k in PINGS}
        jogadores.append(j)

    times = []
    for t in info.get("teams", []):
        obj = t.get("objectives") or {}
        times.append({"teamId": t.get("teamId"), "win": t.get("win"),
                      "objetivos": {k: (v or {}).get("kills", 0) for k, v in obj.items()}})

    quadros, eventos = [], []
    skills = {j["id"]: [] for j in jogadores}     # ordem em que subiu cada habilidade: [segundo, 1=Q 2=W 3=E 4=R]
    compras = {j["id"]: [] for j in jogadores}    # [segundo, item]
    if timeline:
        for q in timeline["info"].get("frames", []):
            linha = {}
            for pid, f in (q.get("participantFrames") or {}).items():
                pos = f.get("position") or {}
                linha[pid] = [pos.get("x"), pos.get("y"), f.get("totalGold"), f.get("xp"),
                              (f.get("minionsKilled") or 0) + (f.get("jungleMinionsKilled") or 0), f.get("level"),
                              f.get("currentGold")]
            quadros.append({"t": round((q.get("timestamp") or 0) / 1000), "p": linha})
            for e in q.get("events", []):
                pid, t = e.get("participantId"), round((e.get("timestamp") or 0) / 1000)
                if e.get("type") == "SKILL_LEVEL_UP" and pid in skills and e.get("levelUpType") == "NORMAL":
                    skills[pid].append([t, e.get("skillSlot")])
                elif e.get("type") == "ITEM_PURCHASED" and pid in compras:
                    compras[pid].append([t, e.get("itemId")])
                c = compactar_evento(e)
                if c:
                    eventos.append(c)

    for j in jogadores:
        j["skills"], j["compras"] = skills[j["id"]], compras[j["id"]]

    return {
        "v": VERSAO,
        "id": partida["metadata"]["matchId"],
        "inicio": round((info.get("gameStartTimestamp") or info.get("gameCreation") or 0) / 1000),
        "duracao": info.get("gameDuration"),
        "fila": info.get("queueId"),
        "modo": info.get("gameMode"),
        "versao": info.get("gameVersion"),
        "jogadores": jogadores,
        "times": times,
        "quadros": quadros,
        "eventos": eventos,
    }


def recibo(danos: list) -> list:
    """Dano que a vítima levou antes de morrer, somado por fonte e habilidade: [[quem, fonte, habilidade, slot, dano]].
    quem = participantId (0 para torre, tropa ou monstro), fonte = nome do campeão ou da torre/tropa."""
    soma: dict[tuple, int] = {}
    for d in danos:
        total = (d.get("physicalDamage") or 0) + (d.get("magicDamage") or 0) + (d.get("trueDamage") or 0)
        if total <= 0:
            continue
        chave = (d.get("participantId") or 0, d.get("name") or "", d.get("spellName") or "", d.get("spellSlot"))
        soma[chave] = soma.get(chave, 0) + total
    return sorted(([*k, v] for k, v in soma.items()), key=lambda x: -x[4])


def compactar_evento(e: dict) -> dict | None:
    t = round((e.get("timestamp") or 0) / 1000)
    tipo = e.get("type")
    pos = e.get("position") or {}
    if tipo == "CHAMPION_KILL":
        return {"t": t, "tipo": "abate", "matou": e.get("killerId"), "morreu": e.get("victimId"),
                "assist": e.get("assistingParticipantIds") or [], "x": pos.get("x"), "y": pos.get("y"),
                "recompensa": (e.get("bounty") or 0) + (e.get("shutdownBounty") or 0),
                "recibo": recibo(e.get("victimDamageReceived") or [])}
    if tipo == "ELITE_MONSTER_KILL":
        return {"t": t, "tipo": "monstro", "time": e.get("killerTeamId"), "quem": e.get("killerId"),
                "monstro": e.get("monsterType"), "sub": e.get("monsterSubType")}
    if tipo == "BUILDING_KILL":
        # teamId = dono da estrutura derrubada
        return {"t": t, "tipo": "estrutura", "dono": e.get("teamId"), "quem": e.get("killerId"),
                "estrutura": e.get("buildingType"), "torre": e.get("towerType"), "rota": e.get("laneType"),
                "x": pos.get("x"), "y": pos.get("y")}
    if tipo == "TURRET_PLATE_DESTROYED":
        return {"t": t, "tipo": "placa", "dono": e.get("teamId"), "quem": e.get("killerId"), "rota": e.get("laneType")}
    return None


# ---------------------------------------------------------------- índice

def resumo(compacta: dict, puuids: dict[str, str]) -> dict:
    """Entrada do índice: quem dos nossos jogou, com que campeão, se ganhou."""
    nossos = []
    for j in compacta["jogadores"]:
        if j["puuid"] in puuids:
            nossos.append({"riotId": puuids[j["puuid"]], "campeao": j["championName"], "win": j["win"],
                           "k": j["kills"], "d": j["deaths"], "a": j["assists"], "rota": j["teamPosition"]})
    return {"id": compacta["id"], "inicio": compacta["inicio"], "duracao": compacta["duracao"],
            "fila": compacta["fila"], "nossos": nossos}


def ler_json(caminho: Path, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return padrao


def gravar_json(caminho: Path, dados) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(".tmp")
    tmp.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(caminho)


# ---------------------------------------------------------------- rodada

def rodada(api: Api, jogadores: list[dict], saida: Path, por_jogador: int = POR_JOGADOR, max_novas: int = MAX_NOVAS) -> int:
    indice = ler_json(saida / "indice.json", {"partidas": [], "jogadores": {}})
    contas = indice.setdefault("jogadores", {})       # riotId -> {"puuid", "regiao"}
    conhecidas = {p["id"]: p for p in indice.get("partidas", [])}
    puuids: dict[str, str] = {}
    fila: list[tuple[str, str]] = []                  # (matchId, roteamento)

    for jog in jogadores:
        riot_id, regiao = jog["riotId"].strip(), jog.get("regiao", "br1").lower()
        m = RE_RIOT_ID.match(riot_id)
        if not m or regiao not in REGIOES:
            print(f"pulando {riot_id!r}: use Nome#TAG e uma região válida ({', '.join(REGIOES)})")
            continue
        rota = REGIOES[regiao]
        conta = contas.get(riot_id)
        if not conta or conta.get("regiao") != regiao:
            nome, tag = (urllib.parse.quote(x) for x in m.groups())
            r = api.get(f"https://{rota}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{nome}/{tag}")
            if not r:
                print(f"::warning::{riot_id}: a Riot não achou essa conta (confira o nome e a tag em lol/jogadores.json)")
                continue
            conta = contas[riot_id] = {"puuid": r["puuid"], "regiao": regiao}
        puuids[conta["puuid"]] = riot_id
        ids = api.get(f"https://{rota}.api.riotgames.com/lol/match/v5/matches/by-puuid/{conta['puuid']}/ids"
                      f"?start=0&count={por_jogador}") or []
        print(f"{riot_id}: {len(ids)} partidas recentes")
        for mid in ids:
            if mid not in conhecidas and all(mid != f for f, _ in fila):
                fila.append((mid, rota))

    # partidas gravadas por uma versão antiga do script: baixa de novo, depois das novas
    for mid in conhecidas:
        c = ler_json(saida / "partidas" / f"{mid}.json", None)
        plataforma = mid.split("_")[0].lower()
        if c and c.get("v", 1) < VERSAO and plataforma in REGIOES and all(mid != f for f, _ in fila):
            fila.append((mid, REGIOES[plataforma]))

    novas = 0
    for mid, rota in fila[:max_novas]:
        partida = api.get(f"https://{rota}.api.riotgames.com/lol/match/v5/matches/{mid}")
        if not partida:
            continue
        timeline = api.get(f"https://{rota}.api.riotgames.com/lol/match/v5/matches/{mid}/timeline")
        compacta = compactar(partida, timeline)
        gravar_json(saida / "partidas" / f"{mid}.json", compacta)
        conhecidas[mid] = resumo(compacta, puuids)
        novas += 1

    # o resumo de todas as partidas é refeito a partir dos arquivos: um amigo novo na lista aparece nas antigas também
    for mid in list(conhecidas):
        c = ler_json(saida / "partidas" / f"{mid}.json", None)
        if c:
            conhecidas[mid] = resumo(c, puuids)

    indice["partidas"] = sorted(conhecidas.values(), key=lambda p: p["inicio"], reverse=True)
    indice["atualizado"] = int(time.time())
    gravar_json(saida / "indice.json", indice)
    print(f"{novas} partidas novas, {api.chamadas} chamadas à Riot")
    return novas


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jogadores", default="lol/jogadores.json")
    ap.add_argument("--saida", default="lol")
    a = ap.parse_args(argv)
    chave = os.environ.get("RIOT_API_KEY", "").strip()
    if not chave:
        print("::error::Falta o segredo RIOT_API_KEY (Settings > Secrets and variables > Actions).")
        return 1
    jogadores = ler_json(Path(a.jogadores), [])
    try:
        rodada(Api(chave), jogadores, Path(a.saida))
    except ChaveInvalida as e:
        print(f"::error::A Riot recusou a chave ({e}). A chave de desenvolvimento expira a cada 24 h: gere outra em "
              "developer.riotgames.com e troque o segredo RIOT_API_KEY.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
