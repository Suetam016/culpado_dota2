"""Grava as falas que faltam do banco fechado do locutor (banco/lista.json) em banco/<id>.mp3.

    python prototipos/vozes/policial/gravar_banco.py --parte 0 --de 8

Mesmo modelo do áudio do zap (Qwen3-TTS 0.6B Base, clone da voz do Mat sem treino), com os trechos de referência que
ele escolheu (ref_c indignado, ref_b comemoração). Cada parte grava 1/N das falas, para rodar em paralelo.
"""
import argparse, json, subprocess, time
from pathlib import Path
import numpy as np, soundfile as sf, torch
from qwen_tts import Qwen3TTSModel

AQUI = Path(__file__).parent
BANCO = AQUI / "banco"
ap = argparse.ArgumentParser(); ap.add_argument("--parte", type=int, default=0); ap.add_argument("--de", type=int, default=1)
a = ap.parse_args()
lista = json.loads((BANCO / "lista.json").read_text(encoding="utf-8"))
faltam = [x for i, x in enumerate(lista) if i % a.de == a.parte and not (BANCO / f"{x['id']}.mp3").exists()]
print(f"parte {a.parte}/{a.de}: {len(faltam)} falas", flush=True)
if not faltam:
    raise SystemExit(0)
textos = json.loads((AQUI / "saida" / "referencias.json").read_text(encoding="utf-8"))
m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-0.6B-Base", device_map="cpu", dtype=torch.float32)
prompts = {}
t0 = time.time()
for x in faltam:
    r = x["ref"]
    if r not in prompts:
        prompts[r] = m.create_voice_clone_prompt(ref_audio=str(AQUI / f"ref_{r}.wav"), ref_text=textos[r])
    t = time.time()
    wavs, sr = m.generate_voice_clone(text=x["texto"], language="Portuguese", voice_clone_prompt=prompts[r])
    wav = np.asarray(wavs[0], dtype=np.float32).squeeze()
    wav = wav * (0.89 / (float(np.max(np.abs(wav))) or 1.0))
    tmp = BANCO / f"{x['id']}.wav"
    sf.write(tmp, wav, sr)
    # mono 48 kbps, com 60 ms de silêncio no fim para a última palavra não cortar
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-af", "apad=pad_dur=0.06", "-ac", "1", "-b:a", "48k",
                    str(BANCO / f"{x['id']}.mp3")], check=True)
    tmp.unlink()
    print(f"ok {x['id']}: {len(wav) / sr:.1f}s em {time.time() - t:.0f}s", flush=True)
print(f"parte {a.parte}: {len(faltam)} falas em {time.time() - t0:.0f}s", flush=True)
