"""Testes da coleta do LoL com uma API falsa (sem rede): python -m unittest lol/teste_coletar.py"""
import json
import random
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import coletar  # noqa: E402

ROTAS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]
CAMPEOES = ["Garen", "LeeSin", "Ahri", "Jinx", "Thresh", "Darius", "Vi", "Zed", "Caitlyn", "Lulu"]


def partida_falsa(mid="BR1_1", puuid_nosso="p-mia", nome="MiaMid", tag="BR1", semente=7, minutos=28):
    """Partida + timeline no formato da match-v5, com abates, dragões e torres plausíveis."""
    rnd = random.Random(semente)
    participantes = []
    for i in range(10):
        nosso = i == 2
        participantes.append({
            "participantId": i + 1, "puuid": puuid_nosso if nosso else f"p{i}",
            "riotIdGameName": nome if nosso else f"Jogador{i + 1}", "riotIdTagline": tag if nosso else "BR1",
            "championName": CAMPEOES[i], "championId": i + 1, "teamId": 100 if i < 5 else 200,
            "teamPosition": ROTAS[i % 5], "win": i >= 5, "kills": 0, "deaths": 0, "assists": 0, "champLevel": 14,
            "goldEarned": 0, "totalMinionsKilled": 150, "neutralMinionsKilled": 10,
            "totalDamageDealtToChampions": rnd.randint(8000, 30000), "totalDamageTaken": rnd.randint(10000, 30000),
            "damageDealtToObjectives": rnd.randint(1000, 9000), "damageDealtToBuildings": rnd.randint(0, 5000),
            "visionScore": rnd.randint(8, 60), "wardsPlaced": 8, "wardsKilled": 2, "detectorWardsPlaced": 1,
            "timeCCingOthers": 10, "totalTimeSpentDead": 60, "longestTimeSpentLiving": 500,
            "summoner1Id": 4, "summoner2Id": 14, "item0": 3031, "item1": 3006,
            "challenges": {"killParticipation": 0.5, "teamDamagePercentage": 0.2, "kda": 2.1, "extraQueNaoUsamos": 1},
        })
    eventos_por_min = {m: [] for m in range(minutos + 1)}
    for _ in range(30):
        t = rnd.randint(90, minutos * 60 - 5)
        vitima = rnd.randint(1, 10)
        inimigos = range(6, 11) if vitima <= 5 else range(1, 6)
        matador = rnd.choice(list(inimigos))
        assist = rnd.sample([x for x in inimigos if x != matador], rnd.randint(0, 2))
        participantes[matador - 1]["kills"] += 1
        participantes[vitima - 1]["deaths"] += 1
        for a in assist:
            participantes[a - 1]["assists"] += 1
        eventos_por_min[t // 60].append({"type": "CHAMPION_KILL", "timestamp": t * 1000, "killerId": matador,
                                         "victimId": vitima, "assistingParticipantIds": assist,
                                         "position": {"x": rnd.randint(500, 14000), "y": rnd.randint(500, 14000)},
                                         "bounty": 300, "shutdownBounty": 0})
    for t, time_, tipo in ((600, 200, "DRAGON"), (1100, 200, "DRAGON"), (1500, 200, "BARON_NASHOR"), (800, 100, "HORDE")):
        eventos_por_min[t // 60].append({"type": "ELITE_MONSTER_KILL", "timestamp": t * 1000, "killerTeamId": time_,
                                         "killerId": 7, "monsterType": tipo})
    for t in (700, 1200, 1550, 1600):
        eventos_por_min[t // 60].append({"type": "BUILDING_KILL", "timestamp": t * 1000, "teamId": 100, "killerId": 8,
                                         "buildingType": "TOWER_BUILDING", "towerType": "OUTER_TURRET",
                                         "laneType": "MID_LANE", "position": {"x": 5000, "y": 5000}})
    eventos_por_min[3].append({"type": "WARD_PLACED", "timestamp": 180000, "creatorId": 1})
    frames = []
    for m in range(minutos + 1):
        pf = {}
        for i in range(10):
            ouro = 500 + m * (380 if i >= 5 else 340) + rnd.randint(-200, 200)
            pf[str(i + 1)] = {"position": {"x": rnd.randint(500, 14000), "y": rnd.randint(500, 14000)},
                              "totalGold": ouro, "xp": m * 400, "minionsKilled": m * 6, "jungleMinionsKilled": 0,
                              "level": min(18, 1 + m // 2)}
        frames.append({"timestamp": m * 60000, "participantFrames": pf, "events": eventos_por_min[m]})
    for i, p in enumerate(participantes):
        p["goldEarned"] = frames[-1]["participantFrames"][str(i + 1)]["totalGold"]
    partida = {"metadata": {"matchId": mid}, "info": {
        "gameStartTimestamp": 1761850000000 + semente * 3600000, "gameDuration": minutos * 60, "queueId": 420,
        "gameMode": "CLASSIC", "gameVersion": "15.21.712.1234", "participants": participantes,
        "teams": [{"teamId": 100, "win": False, "objectives": {"dragon": {"kills": 0}, "tower": {"kills": 3}}},
                  {"teamId": 200, "win": True, "objectives": {"dragon": {"kills": 2}, "baron": {"kills": 1}}}]}}
    return partida, {"info": {"frames": frames}}


class ApiFalsa:
    def __init__(self, partidas):
        self.partidas = {p["metadata"]["matchId"]: (p, t) for p, t in partidas}
        self.chamadas = 0
        self.urls = []

    def get(self, url):
        self.chamadas += 1
        self.urls.append(url)
        if "/by-riot-id/MiaMid/BR1" in url:
            return {"puuid": "p-mia", "gameName": "MiaMid", "tagLine": "BR1"}
        if "/by-riot-id/" in url:
            return None
        if url.split("?")[0].endswith("/ids"):
            return list(self.partidas)
        mid = url.split("/matches/")[1]
        if mid.endswith("/timeline"):
            return self.partidas[mid[:-9]][1]
        return self.partidas[mid][0]


class TesteColeta(unittest.TestCase):
    def test_compactar(self):
        c = coletar.compactar(*partida_falsa())
        self.assertEqual(c["id"], "BR1_1")
        self.assertEqual(len(c["jogadores"]), 10)
        self.assertNotIn("extraQueNaoUsamos", c["jogadores"][0]["challenges"])
        self.assertEqual(c["jogadores"][0]["itens"][:2], [3031, 3006])
        self.assertEqual(len(c["quadros"]), 29)
        self.assertEqual(len(c["quadros"][5]["p"]["1"]), 6)
        tipos = {e["tipo"] for e in c["eventos"]}
        self.assertEqual(tipos, {"abate", "monstro", "estrutura"})   # WARD_PLACED fica de fora
        self.assertEqual(c["inicio"], 1761850000 + 7 * 3600)

    def test_rodada_e_idempotencia(self):
        api = ApiFalsa([partida_falsa("BR1_1", semente=1), partida_falsa("BR1_2", semente=2)])
        with tempfile.TemporaryDirectory() as d:
            saida = Path(d)
            jog = [{"riotId": "MiaMid#BR1", "regiao": "br1"}, {"riotId": "SemTag"}, {"riotId": "Fantasma#BR1"}]
            self.assertEqual(coletar.rodada(api, jog, saida), 2)
            indice = json.loads((saida / "indice.json").read_text())
            self.assertEqual([p["id"] for p in indice["partidas"]], ["BR1_2", "BR1_1"])   # mais nova primeiro
            self.assertEqual(indice["partidas"][0]["nossos"][0]["riotId"], "MiaMid#BR1")
            self.assertEqual(indice["partidas"][0]["nossos"][0]["campeao"], "Ahri")
            self.assertTrue((saida / "partidas" / "BR1_1.json").exists())
            self.assertTrue(all("americas.api.riotgames.com" in u for u in api.urls))
            # segunda rodada: conta em cache, nada novo baixado
            api.urls.clear()
            self.assertEqual(coletar.rodada(api, jog[:1], saida), 0)
            self.assertFalse(any("by-riot-id" in u for u in api.urls))
            self.assertEqual(len(api.urls), 1)

    def test_sem_chave(self):
        import os
        antes = os.environ.pop("RIOT_API_KEY", None)
        try:
            self.assertEqual(coletar.main(["--jogadores", "/nao/existe.json"]), 1)
        finally:
            if antes is not None:
                os.environ["RIOT_API_KEY"] = antes


if __name__ == "__main__":
    unittest.main()
