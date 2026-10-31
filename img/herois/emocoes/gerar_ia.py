"""Gera as emoções dos retratos com IA (Gemini) e monta GIF + folha de quadros para a jogada.

Para cada herói e emoção, pede ao modelo de imagem do Gemini uma versão do retrato de img/herois/<heroi>.png
rindo, chorando, sofrendo, apavorado ou nocauteado, guarda a imagem em ia/<heroi>_<emocao>.png e roda
fazer_gif.py para gerar <heroi>_<emocao>.gif e <heroi>_<emocao>_folha.png (14 quadros de 256 px).
Herói/emoção que já tem imagem de IA é pulado, então dá para rodar de novo sem pagar duas vezes.

    GEMINI_API_KEY=... python img/herois/emocoes/gerar_ia.py pudge,faceless_void   # ou "todos"
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
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


def main():
    chave = os.environ.get("GEMINI_API_KEY")
    if not chave:
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
                    img.write_bytes(gerar(retrato, emocao, chave))
                    feitos += 1
                    print(f"- {heroi} {emocao}: ok", flush=True)
                except SemCota as e:
                    print(f"\nA chave do Gemini não tem cota para gerar imagens (o modelo de imagem exige faturamento ativo no Google AI Studio). Resposta: {e}")
                    sys.exit(1)
                except Exception as e:  # um herói ruim não derruba o lote
                    print(f"- {heroi} {emocao}: falhou ({e})")
                    falhas += 1
                    continue
            subprocess.run([sys.executable, str(PASTA / "fazer_gif.py"), str(img), emocao, str(PASTA / f"{heroi}_{emocao}"), str(retrato)], check=True)
    print(f"\n{feitos} imagens novas geradas, {falhas} falhas.")


main()
