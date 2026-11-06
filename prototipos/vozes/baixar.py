"""Falas originais da Mirana (gravações da Valve, sem alteração) para testar o áudio do veredito.

Uso de fã em protótipo; nada aqui clona ou imita voz. Baixa da wiki de Dota (Fandom, Liquipedia de reserva)
as falas de vitória, risada e abate e grava em prototipos/vozes/mirana/ com um indice.json.

    python prototipos/vozes/baixar.py
"""
import gzip, json, re, time, urllib.parse, urllib.request
from pathlib import Path

UA = "culpado-dota2-vozes/1.0 (site de fã; github.com/Suetam016/culpado_dota2)"
WIKIS = ["https://dota2.fandom.com/api.php", "https://liquipedia.net/dota2/api.php"]
PASTA = Path(__file__).parent / "mirana"
QUER = re.compile(r"^vo_mirana_mir_(win|laugh|happy|kill_0[1-4]|rival_0[1-3])_", re.I)
MAX = 40


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as r:
        c = r.read()
        return gzip.decompress(c) if r.headers.get("Content-Encoding") == "gzip" else c


def listar(wiki):
    achados, cont = [], {}
    for prefixo in ("Vo_mirana", "Mirana_"):
        cont = {}
        while True:
            q = {"action": "query", "list": "allimages", "aiprefix": prefixo, "aiprop": "url|size|mime", "ailimit": 500, "format": "json", **cont}
            d = json.loads(get(f"{wiki}?{urllib.parse.urlencode(q)}"))
            achados += [x for x in d.get("query", {}).get("allimages", []) if str(x.get("mime", "")).startswith("audio/")]
            if "continue" not in d:
                break
            cont = d["continue"]
            time.sleep(1)
    return achados


PASTA.mkdir(parents=True, exist_ok=True)
for velho in PASTA.glob("*.mp3"):
    velho.unlink()
todos = []
for wiki in WIKIS:
    try:
        todos = listar(wiki)
        print(f"{wiki}: {len(todos)} áudios")
        if todos:
            break
    except Exception as e:
        print(f"{wiki}: erro {e}")
escolhidos = [x for x in todos if QUER.search(x["name"]) and x.get("size", 0) < 400_000][:MAX]
indice = []
for x in escolhidos:
    nome = re.sub(r"[^a-z0-9_.]", "_", x["name"].lower())
    try:
        (PASTA / nome).write_bytes(get(x["url"]))
        indice.append({"arquivo": nome, "original": x["name"]})
        print("ok", nome)
    except Exception as e:
        print("falhou", x["name"], e)
    time.sleep(1.5)
(PASTA / "indice.json").write_text(json.dumps({"todos": [x["name"] for x in todos], "baixados": indice}, ensure_ascii=False, indent=1))
print(f"{len(indice)} falas baixadas de {len(todos)}")
