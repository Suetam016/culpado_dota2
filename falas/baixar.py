"""Falas dos heróis para o veredito: risada + fala feliz para o craque, som de morte + fala triste para o culpado.

1) Lista na wiki de Dota (Fandom, API MediaWiki list=allimages) todos os áudios "Vo_<heroi>_..." (cache em catalogo-bruto.json).
2) Separa por herói (nomes de img/herois/*.png) e categoria pelo fim do nome do arquivo:
   riso = laugh; feliz = happy/win/thanks; morte = death/die; triste = lose/failure/sad (pain se faltar).
   Fora: arcanas, personas, brinquedos, falas de skill/compra/abate.
3) Baixa poucos de cada e reduz com ffmpeg (mono, 22 kHz, 40 kbps, sem silêncio nas pontas, volume igualado)
   em falas/<heroi>/<categoria>-<n>.mp3.
4) Pega a transcrição na página <Herói>/Responses da wiki (texto em inglês) para legenda.
5) Escreve falas/indice.json {heroi: {categoria: [[arquivo, texto], ...]}} e falas/cobertura.json.
Os sons são da Valve; uso de fã, sem fins comerciais.

    python falas/baixar.py
"""
from __future__ import annotations

import collections
import gzip
import json
import re
import shutil
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
VERSAO = 2

# nome da voz na wiki quando difere do nome do retrato (npc_dota_hero_<x>)
APELIDO_VOZ = {
    "furion": ["furion", "natures_prophet"],
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
    "keeper_of_the_light": ["keeper_of_the_light", "keeper"],
    "drow_ranger": ["drow_ranger", "drowranger", "drow"],
    "sand_king": ["sand_king", "sandking"],
    "crystal_maiden": ["crystal_maiden", "crystalmaiden"],
    "storm_spirit": ["storm_spirit", "stormspirit"],
    "night_stalker": ["night_stalker", "nightstalker"],
    "faceless_void": ["faceless_void", "faceless"],
    "pangolier": ["pangolier", "pangolin"],
    "shadow_shaman": ["shadow_shaman", "shadowshaman"],
    "witch_doctor": ["witch_doctor", "witchdoctor"],
}

CATEGORIAS = [
    ("riso", ["laugh"]),
    ("feliz", ["happy", "win", "thanks", "victory", "emote_good", "inthebag"]),
    ("morte", ["death", "die", "death_defeat"]),
    ("triste", ["lose", "failure", "fail", "sad", "despair", "emote_bad", "defeat", "pain"]),
]
QUANTOS = {"riso": 2, "feliz": 4, "morte": 2, "triste": 4}
VARIANTE = re.compile(r"(^|_)(arc|arcana\d*|toy|persona|per|dlc|item|helmet|wheel|ti\d+|crownfall|kid|bp)(_|\d|$)")
CONTEXTO_RUIM = re.compile(r"ability|lasthit|last_hit|kill|rival|cast|ally|purch|item|rune|spawn|move|attack|bottle|regen|deny|respawn|immort|tp_|teleport")
APOSTROFOS = "'" * 2


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                corpo = r.read()
                return gzip.decompress(corpo) if r.headers.get("Content-Encoding") == "gzip" else corpo
        except Exception as e:  # noqa: BLE001
            if "404" in str(e):
                raise
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


def nomes_dos_herois() -> dict[str, str]:
    """npc curto -> nome em inglês, das constantes embutidas no index.html."""
    html = (RAIZ.parent / "index.html").read_text()
    m = re.search(r'<script type="application/json" id="dados-embutidos">(.*?)</script>', html, re.S)
    h = json.loads(m.group(1))["constantes"]["h"]
    return {v[0]: v[1] for v in h.values()}


def limpar_frase(linha: str) -> str:
    s = re.sub(r"<sm2>.*?</sm2>", "", linha)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s).replace(APOSTROFOS + "'", "").replace(APOSTROFOS, "")
    return re.sub(r"^[*#:\s]+", "", s).strip()


def transcricoes(nome_ingles: str) -> dict[str, str]:
    """arquivo (minúsculo, sem extensão) -> frase, da página <Herói>/Responses."""
    q = {"action": "parse", "page": f"{nome_ingles}/Responses", "prop": "wikitext", "format": "json", "redirects": 1}
    try:
        txt = json.loads(get(f"{WIKI}?{urllib.parse.urlencode(q)}"))["parse"]["wikitext"]["*"]
    except Exception as e:  # noqa: BLE001
        print(f"  {nome_ingles}: sem página de falas ({e})")
        return {}
    out = {}
    for linha in txt.splitlines():
        arqs = re.findall(r"<sm2>\s*([^<|]+?)\s*</sm2>", linha) or re.findall(r"\{\{\s*sm2\s*\|\s*([^|}]+)", linha)
        if not arqs:
            continue
        frase = limpar_frase(linha)
        for a in arqs:
            out[Path(a.strip().lower().replace(" ", "_")).stem] = frase
    return out


def escolher(arqs: list[tuple[str, dict]]) -> dict[str, list[dict]]:
    limpos = [(r, x) for r, x in arqs if not VARIANTE.search(r) and x["b"] < 300_000]
    cats = {}
    for c, tipos in CATEGORIAS:
        achados: list[dict] = []
        for t in tipos:  # prefere o primeiro tipo; pain só se faltar fala triste
            rx = re.compile(rf"(^|_)({t})(_?\d+)*\.(mp3|wav|ogg)$")
            for r, x in limpos:
                m = rx.search(r)
                if m and not CONTEXTO_RUIM.search(r[:m.start()]) and x not in achados:
                    achados.append(x)
            if len(achados) >= 6:
                break
        cats[c] = achados
    return cats


def reduzir(origem: Path, destino: Path) -> bool:
    filtro = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
              "silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11")
    return subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(origem), "-ac", "1", "-ar", "22050",
                           "-b:a", "40k", "-af", filtro, str(destino)]).returncode == 0


def main() -> int:
    herois = sorted(p.stem for p in (RAIZ.parent / "img" / "herois").glob("*.png"))
    ingles = nomes_dos_herois()
    bruto_arq = RAIZ / "catalogo-bruto.json"
    if bruto_arq.exists():
        bruto = json.loads(bruto_arq.read_text())
    else:
        bruto = listar("Vo_")
        bruto_arq.write_text(json.dumps(bruto, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(bruto)} áudios Vo_ na wiki")

    versao_arq = RAIZ / "versao.txt"
    if not versao_arq.exists() or versao_arq.read_text().strip() != str(VERSAO):
        for p in RAIZ.iterdir():
            if p.is_dir() and p.name != "__pycache__":
                shutil.rmtree(p)
        versao_arq.write_text(f"{VERSAO}\n")

    chaves = sorted(((a.lower(), h) for h in herois for a in APELIDO_VOZ.get(h, [h])), key=lambda t: -len(t[0]))
    por_heroi: dict[str, list[tuple[str, dict]]] = collections.defaultdict(list)
    for x in bruto:
        nome = x["n"].lower().replace(" ", "_")
        for a, h in chaves:
            if nome.startswith(f"vo_{a}_"):
                por_heroi[h].append((nome[len(a) + 4:], x))
                break

    cobertura, indice = {}, {}
    for h in herois:
        cats = escolher(por_heroi[h])
        cobertura[h] = {"total": len(por_heroi[h]), **{c: len(v) for c, v in cats.items()}}
        if not any(cats.values()):
            print(f"  {h}: sem falas na wiki")
            continue
        textos = transcricoes(ingles.get(h, h.replace("_", " ").title()))
        time.sleep(PAUSA)
        pasta = RAIZ / h
        indice[h] = {}
        for c, v in cats.items():
            n = QUANTOS[c]
            escolhidos = v if len(v) <= n else [v[i * len(v) // n] for i in range(n)]
            for k, x in enumerate(escolhidos, 1):
                nome = f"{c}-{k}.mp3"
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
                    ok = reduzir(tmp, destino)
                    tmp.unlink()
                    if not ok:
                        print(f"  {h} {c}: ffmpeg falhou em {x['n']}")
                        continue
                    time.sleep(PAUSA)
                texto = textos.get(Path(x["n"].lower().replace(" ", "_")).stem, "")
                indice[h].setdefault(c, []).append([nome, texto])
        print(f"  {h}: " + ", ".join(f"{c} {len(v)}" for c, v in cats.items()) + f"; {len(textos)} legendas")

    (RAIZ / "cobertura.json").write_text(json.dumps(cobertura, indent=0, ensure_ascii=False) + "\n")
    (RAIZ / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("sem falas:", [h for h in herois if h not in indice])
    print("sem risada:", [h for h in indice if not indice[h].get("riso")])
    print("sem morte:", [h for h in indice if not indice[h].get("morte")])
    return 0


if __name__ == "__main__":
    sys.exit(main())
