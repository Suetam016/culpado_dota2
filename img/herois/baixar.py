"""Retratos dos heróis guardados no próprio site (img/herois/<nome>.png).

O CDN da Steam não manda cabeçalho CORS de forma confiável, e o WebGL da jogada recusa a imagem;
servindo do mesmo domínio o retrato sempre carrega. A lista de heróis vem do OpenDota.

    python img/herois/baixar.py
"""
import json
import time
import urllib.request
from pathlib import Path

PASTA = Path(__file__).parent
UA = {"User-Agent": "culpado-dota2-retratos/1.0 (github.com/Suetam016/culpado_dota2)"}
CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{}.png"


def baixar(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


herois = json.loads(baixar("https://api.opendota.com/api/constants/heroes"))
nomes = sorted(h["name"].replace("npc_dota_hero_", "") for h in herois.values())
novos = 0
for nome in nomes:
    arq = PASTA / f"{nome}.png"
    if arq.exists():
        continue
    try:
        arq.write_bytes(baixar(CDN.format(nome)))
        novos += 1
    except Exception as e:  # um retrato faltando não derruba os outros
        print(f"falhou {nome}: {e}")
    time.sleep(0.3)
print(f"{novos} retratos novos, {len(nomes)} heróis")
