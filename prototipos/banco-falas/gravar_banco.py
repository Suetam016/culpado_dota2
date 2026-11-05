"""Banco de falas: grava na voz do Mat as frases que faltam (prototipos/banco-falas/faltam.json, do faltam.js).

    python prototipos/banco-falas/gravar_banco.py

Cada áudio vira audios/banco/<chave>.mp3, gravado de uma vez só (mesma semente, pontas com folga larga, volume
igualado). O índice audios/banco/indice.json ({chave: {t, s}}) é salvo depois de cada frase, para um job que
estoure o tempo não perder o que já gravou. O site emenda as frases na hora (pausas e ambiente ficam com ele).
"""
import json
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
sys.path.insert(0, str(RAIZ / "audio"))
import falar  # noqa: E402

SEMENTE = 1234
BANCO = RAIZ / "audios" / "banco"


def main():
    import numpy as np
    import soundfile as sf
    import torch

    faltam = json.loads((AQUI / "faltam.json").read_text(encoding="utf-8"))
    BANCO.mkdir(parents=True, exist_ok=True)
    arq_indice = BANCO / "indice.json"
    indice = json.loads(arq_indice.read_text(encoding="utf-8")) if arq_indice.exists() else {}
    faltam = [x for x in faltam if x["chave"] not in indice]
    print(f"{len(faltam)} frases para gravar", flush=True)
    if not faltam:
        return
    modelo, prompt = falar.carregar("cpu")
    for i, x in enumerate(faltam):
        t = time.time()
        torch.manual_seed(SEMENTE)
        wavs, sr = modelo.generate_voice_clone(text=x["texto"], language="Portuguese", voice_clone_prompt=prompt)
        w = np.asarray(wavs[0], dtype=np.float32).squeeze()
        # pontas: só tira o silêncio de verdade (abaixo de 0,4% do pico), com folga larga no fim (300 ms) para não
        # comer o final da última palavra, que cai devagar ("conta", "porra"); fade curto no começo e longo no fim
        lim = 0.004 * (float(np.max(np.abs(w))) or 1.0)
        voz = np.where(np.abs(w) > lim)[0]
        if len(voz):
            w = w[max(0, voz[0] - int(0.06 * sr)): voz[-1] + int(0.30 * sr)]
        ni, nf = min(int(0.02 * sr), len(w) // 4), min(int(0.12 * sr), len(w) // 4)
        if ni:
            w[:ni] *= np.linspace(0, 1, ni, dtype=np.float32)
        if nf:
            w[-nf:] *= np.linspace(1, 0, nf, dtype=np.float32) ** 2
        w = np.concatenate([np.zeros(int(0.08 * sr), dtype=np.float32), w, np.zeros(int(0.15 * sr), dtype=np.float32)])
        w = w * (0.08 / (float(np.sqrt(np.mean(w ** 2))) or 1.0))
        w = w * min(1.0, 0.9 / (float(np.max(np.abs(w))) or 1.0))
        wav = BANCO / f"{x['chave']}.wav"
        sf.write(wav, w, sr)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                        "-ar", "24000", "-ac", "1", "-b:a", "64k",
                        str(wav.with_suffix(".mp3"))], check=True)
        wav.unlink()
        indice[x["chave"]] = {"t": x["texto"], "s": round(len(w) / sr, 2)}
        arq_indice.write_text(json.dumps(indice, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        print(f"{i + 1}/{len(faltam)} {len(w) / sr:4.1f}s em {time.time() - t:4.0f}s  {x['texto']}", flush=True)


if __name__ == "__main__":
    main()
