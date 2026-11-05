"""Teste do banco de falas, versão 2: pedaços do tamanho de uma frase inteira, emendados com acabamento.

    python prototipos/banco-falas/emendar2.py

A v1 (emendar.py) cortava no meio da frase ("Sequência de" + "catorze" + "porra") e ficou picotada. Aqui cada pedaço
é uma frase inteira, como o banco guardaria: as frases com número ou nome entram no banco já gravadas com cada valor
(ex.: "Trinta e três por cento do mérito na minha conta." para 0 a 100), então a entonação da frase fica inteira.
Acabamento: mesma semente em todas as frases (entonação mais parecida), corte das pontas com fade de 25 ms, volume
igualado por frase, pausas de zap que variam com a pontuação, um fundo de ambiente bem baixo e contínuo por baixo de
tudo (esconde o "buraco" digital entre as frases) e uma compressão leve no final.
Sai em prototipos/banco-falas/saida/<partida>/v2/: emendado.mp3, frases/NN.mp3 e tempos.json.
"""
import json
import random
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent.parent / "audio"))
import falar  # noqa: E402

SEMENTE = 1234


def frases_de(pedacos):
    """Junta os pedaços da v1 de volta em frases inteiras (o fim de frase vem marcado com fim=true)."""
    out, atual = [], []
    for p in pedacos:
        atual.append(p["t"])
        if p.get("fim"):
            out.append(" ".join(atual).replace(" :", ":").replace(" ,", ","))
            atual = []
    if atual:
        out.append(" ".join(atual))
    return out


def main():
    import numpy as np
    import soundfile as sf
    import torch

    cfg = json.loads((AQUI / "pedacos.json").read_text(encoding="utf-8"))
    saida = AQUI / "saida" / cfg["partida"] / "v2"
    (saida / "frases").mkdir(parents=True, exist_ok=True)
    modelo, prompt = falar.carregar("cpu")
    rnd = random.Random(7)
    partes, tempos, sr = [], [], None
    frases = frases_de(cfg["pedacos"])
    for i, f in enumerate(frases):
        t = time.time()
        torch.manual_seed(SEMENTE)
        wavs, sr = modelo.generate_voice_clone(text=f, language="Portuguese", voice_clone_prompt=prompt)
        w = np.asarray(wavs[0], dtype=np.float32).squeeze()
        # pontas: corta o silêncio (abaixo de 1,5% do pico) deixando 40 ms, com fade de 25 ms nas duas pontas
        lim = 0.015 * (float(np.max(np.abs(w))) or 1.0)
        voz = np.where(np.abs(w) > lim)[0]
        if len(voz):
            folga = int(0.04 * sr)
            w = w[max(0, voz[0] - folga): voz[-1] + folga]
        n = min(int(0.025 * sr), len(w) // 4)
        if n:
            rampa = np.linspace(0, 1, n, dtype=np.float32)
            w[:n] *= rampa
            w[-n:] *= rampa[::-1]
        rms = float(np.sqrt(np.mean(w ** 2))) or 1.0
        w = w * (0.08 / rms)
        sf.write(saida / "frases" / f"{i:02d}.wav", w, sr)
        partes.append(w)
        # pausa de zap: maior depois de pergunta/exclamação, com uma variação pequena para não soar metrônomo
        base = 0.42 if f.rstrip().endswith(("?", "!")) else 0.34
        partes.append(np.zeros(int((base + rnd.uniform(-0.05, 0.08)) * sr), dtype=np.float32))
        tempos.append({"i": i, "texto": f, "segundos": round(len(w) / sr, 2), "gerado_em": round(time.time() - t, 1)})
        print(f"{i:02d} {len(w) / sr:4.1f}s em {time.time() - t:4.0f}s  {f}", flush=True)
    tudo = np.concatenate(partes[:-1])
    # fundo de ambiente: ruído marrom bem baixo (~-50 dB) contínuo, igual em todo o áudio
    ruido = np.cumsum(np.random.default_rng(3).standard_normal(len(tudo)).astype(np.float32))
    ruido -= np.convolve(ruido, np.ones(2000, dtype=np.float32) / 2000, mode="same")
    ruido *= 0.003 / (float(np.sqrt(np.mean(ruido ** 2))) or 1.0)
    tudo = tudo + ruido
    tudo = tudo * (0.89 / (float(np.max(np.abs(tudo))) or 1.0))
    sf.write(saida / "emendado.wav", tudo, sr)
    # compressão leve + volume padrão de áudio de celular
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(saida / "emendado.wav"),
                    "-af", "acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120,loudnorm=I=-16:TP=-1.5:LRA=9",
                    "-ar", "24000", "-ac", "1", "-b:a", "64k", str(saida / "emendado.mp3")], check=True)
    (saida / "emendado.wav").unlink()
    for f in sorted((saida / "frases").glob("*.wav")):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(f), "-ac", "1", "-b:a", "48k", str(f.with_suffix(".mp3"))], check=True)
        f.unlink()
    (saida / "tempos.json").write_text(json.dumps({"total_s": round(len(tudo) / sr, 1), "frases": tempos}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"emendado v2: {len(tudo) / sr:.1f}s, {len(frases)} frases", flush=True)


if __name__ == "__main__":
    main()
