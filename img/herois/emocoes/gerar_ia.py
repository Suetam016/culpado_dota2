"""Gera as emoções dos retratos com IA e monta GIF + folha de quadros para a jogada.

Provedor (variável PROVEDOR): "gratis" usa o Pollinations (sem chave, uma imagem a cada ~45 s);
"gemini" usa o modelo de imagem do Gemini (precisa de GEMINI_API_KEY com faturamento ativo).

Para cada herói e emoção, pede ao modelo de imagem do Gemini uma versão do retrato de img/herois/<heroi>.png
rindo, chorando, sofrendo, apavorado ou nocauteado, guarda a imagem em ia/<heroi>_<emocao>.png e roda
fazer_gif.py para gerar <heroi>_<emocao>.gif e <heroi>_<emocao>_folha.png (14 quadros de 256 px).
Herói/emoção que já tem imagem de IA é pulado, então dá para rodar de novo sem pagar duas vezes.

    GEMINI_API_KEY=... python img/herois/emocoes/gerar_ia.py pudge,faceless_void   # ou "todos"
"""
import base64
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PASTA = Path(__file__).parent
RETRATOS = PASTA.parent
IA = PASTA / "ia"
MODELO = os.environ.get("GEMINI_MODELO", "gemini-2.5-flash-image")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent"

BASE = ("Edit this video game hero portrait. Keep the exact same character, costume, colors, art style, "
        "lighting, framing and background; only change the facial expression and body language, "
        "exaggerated like a funny cartoon reaction. Do not add text, borders or new characters. ")
PROMPTS = {
    "rindo": BASE + "The character is laughing hysterically, mouth wide open, eyes squeezed shut, cheerful.",
    "chorando": BASE + "The character is crying a river, big tears streaming down the face, trembling lip, very sad.",
    "sofrendo": BASE + "The character is in exaggerated pain, gritting teeth, wincing, sweat drops, cartoon agony.",
    "apavorado": BASE + "The character is terrified, eyes bulging, jaw dropped, pale face, cartoon fear.",
    "nocauteado": BASE + "The character is knocked out, dizzy spiral eyes, tongue out, head tilted, cartoon KO.",
}


class SemCota(Exception):
    """A chave não tem cota para o modelo de imagem (plano gratuito ou sem faturamento)."""


def gerar(retrato: Path, emocao: str, chave: str) -> bytes:
    corpo = {"contents": [{"parts": [{"text": PROMPTS[emocao]},
                                     {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(retrato.read_bytes()).decode()}}]}],
             "generationConfig": {"responseModalities": ["IMAGE"]}}
    req = urllib.request.Request(URL, data=json.dumps(corpo).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": chave})
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                resp = json.load(r)
            for parte in resp["candidates"][0]["content"]["parts"]:
                dado = parte.get("inlineData") or parte.get("inline_data")
                if dado:
                    return base64.b64decode(dado["data"])
            raise RuntimeError("resposta sem imagem: " + json.dumps(resp)[:300])
        except urllib.error.HTTPError as e:
            corpo_erro = e.read().decode("utf-8", "replace")
            if e.code == 429 and ("limit: 0" in corpo_erro or "free_tier" in corpo_erro or "billing" in corpo_erro.lower()):
                raise SemCota(corpo_erro[:400])
            if e.code in (429, 500, 503) and tentativa < 3:
                print(f"  HTTP {e.code}, tentando de novo em {20 * (tentativa + 1)} s", flush=True)
                time.sleep(20 * (tentativa + 1))
                continue
            raise RuntimeError(f"HTTP {e.code}: {corpo_erro[:300]}")


SITE = os.environ.get("SITE_RETRATOS", "https://suetam016.github.io/culpado_dota2/img/herois/")
POLLI = [  # tentados em ordem; o primeiro que devolver uma edição do retrato vira o padrão da rodada
    "https://image.pollinations.ai/prompt/{p}?model=kontext&image={img}&width=512&height=512&nologo=true&seed={seed}&referrer=culpado_dota2",
    "https://gen.pollinations.ai/image/{p}?model=kontext&image={img}&width=512&height=512&nologo=true&seed={seed}",
    "https://gen.pollinations.ai/image/{p}?model=nanobanana&image={img}&width=512&height=512&nologo=true&seed={seed}",
]
_polli_ok = None
_ultimo = 0.0


def distancia(a: bytes, b: bytes) -> float:
    """Diferença média (0-255) entre as duas imagens em 32x32 cinza; edição do retrato fica baixa, imagem nova fica alta."""
    from PIL import Image
    x = Image.open(io.BytesIO(a)).convert("L").resize((32, 32))
    y = Image.open(io.BytesIO(b)).convert("L").resize((32, 32))
    return sum(abs(p - q) for p, q in zip(x.tobytes(), y.tobytes())) / 1024


def gerar_gratis(retrato: Path, emocao: str, heroi: str) -> bytes:
    global _polli_ok, _ultimo
    token = os.environ.get("POLLINATIONS_TOKEN")
    texto = PROMPTS[emocao].replace("Edit this video game hero portrait.", "Edit the input image (a video game hero portrait).")
    p = urllib.parse.quote(texto, safe="")
    img = urllib.parse.quote(SITE + heroi + ".png", safe="")
    original = retrato.read_bytes()
    erros = []
    for i, modelo in enumerate(POLLI):
        if _polli_ok is not None and i != _polli_ok:
            continue
        url = modelo.format(p=p, img=img, seed=abs(hash(heroi + emocao)) % 100000)
        for tentativa in range(3):
            espera = 46 - (time.time() - _ultimo)
            if espera > 0:
                time.sleep(espera)
            _ultimo = time.time()
            req = urllib.request.Request(url, headers={"User-Agent": "culpado-dota2-emocoes"} | ({"Authorization": f"Bearer {token}"} if token else {}))
            try:
                with urllib.request.urlopen(req, timeout=240) as r:
                    tipo, dado = r.headers.get("Content-Type", ""), r.read()
            except urllib.error.HTTPError as e:
                corpo = e.read().decode("utf-8", "replace")[:200]
                if e.code in (402, 429, 500, 502, 503) and tentativa < 2:
                    print(f"  HTTP {e.code} em {url.split('?')[0][:40]}..., nova tentativa", flush=True)
                    time.sleep(int(e.headers.get("Retry-After") or 60))
                    continue
                erros.append(f"{url.split('/prompt')[0].split('/image/')[0]} HTTP {e.code}: {corpo}")
                break
            except Exception as e:
                erros.append(f"{url[:40]}: {e}")
                break
            if not tipo.startswith("image/"):
                erros.append(f"{url[:40]}: resposta {tipo} {dado[:150]!r}")
                break
            d = distancia(original, dado)
            print(f"  diferença do retrato: {d:.0f}", flush=True)
            if d > 70:  # ignorou a imagem de entrada e desenhou outra coisa
                (IA / "suspeitas").mkdir(exist_ok=True)
                (IA / "suspeitas" / f"{heroi}_{emocao}_m{i}.png").write_bytes(dado)
                erros.append(f"modelo {i} ignorou o retrato (diferença {d:.0f})")
                break
            _polli_ok = i
            return dado
    if _polli_ok is None and len(erros) >= len(POLLI):
        raise SemCota("nenhum endpoint gratuito editou o retrato: " + " | ".join(erros))
    raise RuntimeError(" | ".join(erros))


def main():
    provedor = os.environ.get("PROVEDOR", "gratis")
    chave = os.environ.get("GEMINI_API_KEY")
    if provedor == "gemini" and not chave:
        print("Falta o segredo GEMINI_API_KEY (Settings > Secrets and variables > Actions).")
        sys.exit(1)
    pedido = (sys.argv[1] if len(sys.argv) > 1 else "pudge,faceless_void,terrorblade").strip()
    herois = sorted(p.stem for p in RETRATOS.glob("*.png")) if pedido == "todos" else [h.strip() for h in pedido.split(",") if h.strip()]
    emocoes = [e.strip() for e in os.environ.get("EMOCOES", ",".join(PROMPTS)).split(",") if e.strip() in PROMPTS]
    IA.mkdir(exist_ok=True)
    feitos = falhas = 0
    for heroi in herois:
        retrato = RETRATOS / f"{heroi}.png"
        if not retrato.exists():
            print(f"- {heroi}: sem retrato em img/herois, pulado")
            continue
        for emocao in emocoes:
            img = IA / f"{heroi}_{emocao}.png"
            if not img.exists():
                try:
                    dado = gerar(retrato, emocao, chave) if provedor == "gemini" else gerar_gratis(retrato, emocao, heroi)
                    img.write_bytes(dado)
                    feitos += 1
                    print(f"- {heroi} {emocao}: ok", flush=True)
                except SemCota as e:
                    print(f"\nO provedor {provedor} não gerou imagens. Gemini sem cota precisa de faturamento ativo no Google AI Studio. Resposta: {e}")
                    sys.exit(1)
                except Exception as e:  # um herói ruim não derruba o lote
                    print(f"- {heroi} {emocao}: falhou ({e})")
                    falhas += 1
                    continue
            subprocess.run([sys.executable, str(PASTA / "fazer_gif.py"), str(img), emocao, str(PASTA / f"{heroi}_{emocao}"), str(retrato)], check=True)
    print(f"\n{feitos} imagens novas geradas, {falhas} falhas.")


main()
