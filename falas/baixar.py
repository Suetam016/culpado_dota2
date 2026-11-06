"""Falas dos heróis para o veredito: risada/fala feliz para o craque, morte/fala triste para o culpado.

1) Lista na wiki de Dota (Fandom, API MediaWiki list=allimages) todos os áudios "Vo_<heroi>_...".
2) Separa por herói (nomes de img/herois/*.png) e por categoria pelo nome do arquivo
   (laugh, happy, win, kill... / death, pain, lose, failure...).
3) Baixa alguns de cada categoria e reduz com ffmpeg (mono, 22 kHz, 40 kbps) em falas/<heroi>/<arquivo>.mp3.
4) Escreve falas/indice.json {heroi: {categoria: [arquivo, ...]}} e falas/cobertura.json.
Os sons são da Valve; uso de fã, sem fins comerciais.

    python falas/baixar.py
"""
from __future__ import annotations

import gzip
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "culpado-dota2-falas/1.0 (site de fã sem fins comerciais; github.com/Suetam016/culpado_dota2)"
WIKI = "https://dota2.fandom.com/api.php"
RAIZ = Path(__file__).resolve().parent
PAUSA = 0.6

# nome da voz na wiki quando difere do nome do retrato (npc_dota_hero_<x>)
APELIDO_VOZ = {
    "furion": ["furion", "natures_prophet", "nature's_prophet"],
    "zuus": ["zuus", "zeus"],
    "rattletrap": ["rattletrap", "clockwerk"],
    "windrunner": ["windrunner", "windranger"],
    "obsidian_destroyer": ["obsidian_destroyer", "outworld_destroyer", "outworld_devourer"],
    "nevermore": ["nevermore", "shadow_fiend"],
    "skeleton_king": ["skeleton_king", "wraith_king"],
    "life_stealer": ["life_stealer", "lifestealer"],
    "treant": ["treant", "treant_protector"],
    "wisp": ["wisp", "io"],
    "magnataur": ["magnataur", "magnus"],
    "necrolyte": ["necrolyte", "necrophos"],
    "shredder": ["shredder", "timbersaw"],
    "doom_bringer": ["doom_bringer", "doom"],
    "abyssal_underlord": ["abyssal_underlord", "underlord"],
    "vengefulspirit": ["vengefulspirit", "vengeful_spirit", "vengeful"],
    "queenofpain": ["queenofpain", "queen_of_pain"],
    "antimage": ["antimage", "anti_mage"],
    "centaur": ["centaur"],
    "keeper_of_the_light": ["keeper_of_the_light", "keeper"],
    "drow_ranger": ["drow_ranger", "drowranger", "drow"],
    "sand_king": ["sand_king", "sandking"],
    "crystal_maiden": ["crystal_maiden", "crystalmaiden"],
    "storm_spirit": ["storm_spirit", "stormspirit"],
    "dark_seer": ["dark_seer"],
    "night_stalker": ["night_stalker", "nightstalker"],
    "faceless_void": ["faceless_void", "faceless"],
    "monkey_king": ["monkey_king"],
    "dragon_knight": ["dragon_knight"],
    "phantom_assassin": ["phantom_assassin"],
    "templar_assassin": ["templar_assassin"],
    "winter_wyvern": ["winter_wyvern"],
    "elder_titan": ["elder_titan"],
    "spirit_breaker": ["spirit_breaker"],
    "ancient_apparition": ["ancient_apparition"],
}

CATEGORIAS = {
    # craque
    "riso": r"laugh",
    "feliz": r"happy|win|victory|thanks|kill|rival|lasthit|cast_haste|immort|bottle|rare",
    # culpado
    "morte": r"death|die|dying",
    "triste": r"lose|loss|fail|pain|deny|defeat|despair|sad|respawn|anger|frustr",
}
QUANTOS = {"riso": 3, "feliz": 4, "morte": 3, "triste": 4}
# nomes que não queremos (pacotes de anunciador, arcanas, persona e falas longas de loja)
RUINS = re.compile(r"announcer|arcana|persona|_ti\d|battlepass|_dlc|_tv_|purch|_shop|_item_|_move|_attack|_cast_\d", re.I)


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                corpo = r.read()
                return gzip.decompress(corpo) if r.headers.get("Content-Encoding") == "gzip" else corpo
        except Exception as e:  # noqa: BLE001
            print(f"    falhou ({e}); de novo")
            time.sleep(3 * (tentativa + 1))
    raise RuntimeError(url)


def listar(prefixo: str) -> list[dict]:
    todos, cont = [], {}
    while True:
        q = {"action": "query", "list": "allimages", "aiprefix": prefixo, "aiprop": "url|size|mime",
             "ailimit": 500, "format": "json", **cont}
        dados = json.loads(get(f"{WIKI}?{urllib.parse.urlencode(q)}"))
        for x in dados.get("query", {}).get("allimages", []):
            if str(x.get("mime", "")).startswith("audio/"):
                todos.append({"n": x["name"], "u": x["url"], "b": x.get("size", 0)})
        time.sleep(PAUSA)
        if "continue" not in dados:
            return todos
        cont = dados["continue"]


def main() -> int:
    herois = sorted(p.stem for p in (RAIZ.parent / "img" / "herois").glob("*.png"))
    bruto_arq = RAIZ / "catalogo-bruto.json"
    if bruto_arq.exists():
        bruto = json.loads(bruto_arq.read_text())
    else:
        bruto = listar("Vo_")
        bruto_arq.write_text(json.dumps(bruto, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(bruto)} áudios Vo_ na wiki")

    # herói de cada arquivo: o apelido mais longo que casa com o começo do nome
    chaves = []
    for h in herois:
        for a in APELIDO_VOZ.get(h, [h]):
            chaves.append((a.lower(), h))
    chaves.sort(key=lambda t: -len(t[0]))
    por_heroi: dict[str, list[dict]] = {h: [] for h in herois}
    for x in bruto:
        nome = x["n"].lower().replace(" ", "_")
        if not nome.startswith("vo_"):
            continue
        resto = nome[3:]
        for a, h in chaves:
            if resto.startswith(a + "_"):
                por_heroi[h].append(x)
                break

    cobertura, indice = {}, {}
    for h in herois:
        arqs = [x for x in por_heroi[h] if not RUINS.search(x["n"])]
        cat: dict[str, list[dict]] = {}
        for c, rx in CATEGORIAS.items():
            r = re.compile(r"_(" + rx + r")(_|\d|\.)", re.I)
            cat[c] = sorted([x for x in arqs if r.search(x["n"].replace(" ", "_")) and x["b"] <= 400_000],
                            key=lambda x: (x["b"] > 120_000, x["n"]))
        cobertura[h] = {"total": len(por_heroi[h]), **{c: len(v) for c, v in cat.items()},
                        "exemplos": {c: [x["n"] for x in v[:6]] for c, v in cat.items()}}
        pasta = RAIZ / h
        indice[h] = {}
        for c, v in cat.items():
            # espalha a escolha pela lista para variar o tipo de fala (happy, win, kill...)
            escolhidos = v if len(v) <= QUANTOS[c] else [v[i * len(v) // QUANTOS[c]] for i in range(QUANTOS[c])]
            for x in escolhidos:
                nome = re.sub(r"[^a-z0-9_]", "", Path(x["n"]).stem.lower().replace(" ", "_")) + ".mp3"
                destino = pasta / nome
                if not destino.exists():
                    try:
                        corpo = get(x["u"])
                    except Exception as e:  # noqa: BLE001
                        print(f"  {h} {c}: download falhou ({e})")
                        continue
                    pasta.mkdir(exist_ok=True)
                    tmp = pasta / ("_tmp" + Path(urllib.parse.urlparse(x["u"]).path.split("/revision")[0]).suffix)
                    tmp.write_bytes(corpo)
                    ok = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-ac", "1", "-ar", "22050",
                                         "-b:a", "40k", "-af", "silenceremove=1:0:-50dB,areverse,silenceremove=1:0:-50dB,areverse",
                                         str(destino)]).returncode == 0
                    tmp.unlink()
                    if not ok:
                        print(f"  {h} {c}: ffmpeg falhou em {x['n']}")
                        continue
                    time.sleep(PAUSA)
                indice[h].setdefault(c, []).append(nome)
        print(f"  {h}: {len(por_heroi[h])} falas; " + ", ".join(f"{c} {len(v)}" for c, v in cat.items()))

    (RAIZ / "cobertura.json").write_text(json.dumps(cobertura, indent=1, ensure_ascii=False) + "\n")
    (RAIZ / "indice.json").write_text(json.dumps(indice, indent=0, ensure_ascii=False) + "\n")
    sem = [h for h in herois if not indice[h].get("riso") and not indice[h].get("feliz")]
    sem2 = [h for h in herois if not indice[h].get("morte") and not indice[h].get("triste")]
    print(f"sem fala de craque: {sem}\nsem fala de culpado: {sem2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
