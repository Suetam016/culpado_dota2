"""Teste do banco de falas: grava cada pedaço de pedacos.json solto (como o banco guardaria) e emenda.

    python prototipos/banco-falas/emendar.py

Lê pedacos.json (feito pelo montar.js). Sai em prototipos/banco-falas/saida/<partida>/: emendado.mp3 (montado dos
pedaços), inteiro.mp3 (o mesmo texto gravado de uma vez, para comparar), pedacos/NN.mp3 e tempos.json.
Usa audio/falar.py (mesma voz e modelo da produção). As pausas imitam um áudio de zap: curta dentro da frase, maior
no fim de frase. Cada pedaço tem o silêncio das pontas cortado e o volume igualado.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent.parent / "audio"))
import falar  # noqa: E402

PAUSA_MEIO = 0.07
PAUSA_FIM = 0.28


def main():
    import numpy as np
    import soundfile as sf

    cfg = json.loads((AQUI / "pedacos.json").read_text(encoding="utf-8"))
    saida = AQUI / "saida" / cfg["partida"]
    (saida / "pedacos").mkdir(parents=True, exist_ok=True)
    modelo, prompt = falar.carregar("cpu")
    partes, tempos, sr = [], [], None
    for i, p in enumerate(cfg["pedacos"]):
        t = time.time()
        wavs, sr = modelo.generate_voice_clone(text=p["t"], language="Portuguese", voice_clone_prompt=prompt)
        w = np.asarray(wavs[0], dtype=np.float32).squeeze()
        # corta o silêncio das pontas (abaixo de 2% do pico) com 20 ms de folga
        lim = 0.02 * (float(np.max(np.abs(w))) or 1.0)
        voz = np.where(np.abs(w) > lim)[0]
        if len(voz):
            folga = int(0.02 * sr)
            w = w[max(0, voz[0] - folga): voz[-1] + folga]
        # volume igual entre os pedaços (RMS) para a emenda não pular
        rms = float(np.sqrt(np.mean(w ** 2))) or 1.0
        w = w * (0.08 / rms)
        sf.write(saida / "pedacos" / f"{i:02d}.wav", w, sr)
        partes.append(w)
        partes.append(np.zeros(int((PAUSA_FIM if p.get("fim") else PAUSA_MEIO) * sr), dtype=np.float32))
        tempos.append({"i": i, "texto": p["t"], "tipo": p["tipo"], "segundos": round(len(w) / sr, 2), "gerado_em": round(time.time() - t, 1)})
        print(f"{i:02d} {p['tipo']:6} {len(w) / sr:4.1f}s em {time.time() - t:4.0f}s  {p['t']}", flush=True)
    tudo = np.concatenate(partes)
    tudo = tudo * (0.89 / (float(np.max(np.abs(tudo))) or 1.0))
    sf.write(saida / "emendado.wav", tudo, sr)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(saida / "emendado.wav"), "-ac", "1", "-b:a", "64k",
                    str(saida / "emendado.mp3")], check=True)
    (saida / "emendado.wav").unlink()
    for f in sorted((saida / "pedacos").glob("*.wav")):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(f), "-ac", "1", "-b:a", "48k", str(f.with_suffix(".mp3"))], check=True)
        f.unlink()
    t = time.time()
    falar.gravar(modelo, prompt, {"arquivo": "inteiro", "texto": cfg["texto"]}, saida)
    inteiro_s = round(time.time() - t, 1)
    (saida / "inteiro.json").unlink(missing_ok=True)
    (saida / "tempos.json").write_text(json.dumps({"total_s": round(len(tudo) / sr, 1), "inteiro_gerado_em": inteiro_s, "pedacos": tempos}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"emendado: {len(tudo) / sr:.1f}s", flush=True)


if __name__ == "__main__":
    main()
