"""Narrador do Plantão (tela de vitória) com a voz do Mat no tom de programa policial.

Mesmo modelo do áudio do zap (Qwen3-TTS 0.6B Base, clone sem treino), mas a referência é a imitação de locutor
policial que o Mat gravou (trechos ref_a/b/c.wav, 18 s cada). O modelo copia o jeito de falar da referência.
O texto da referência sai do faster-whisper. Cada fala de falas.json diz qual referência usar (o Mat escolheu
a C para abertura e abate e a B para o fim). falas.json sai de tomadas.js (roteiro.js sorteia as falas). Saída em saida/ (mp3 mono).

    python prototipos/vozes/policial/narrar.py
"""
import json, subprocess, time
from pathlib import Path
import numpy as np, soundfile as sf, torch

AQUI = Path(__file__).parent
SAIDA = AQUI / "saida"
SAIDA.mkdir(exist_ok=True)
falas = json.loads((AQUI / "falas.json").read_text(encoding="utf-8"))

from faster_whisper import WhisperModel
w = WhisperModel("small", device="cpu", compute_type="int8")
textos = {}
for r in ("a", "b", "c"):
    segs, _ = w.transcribe(str(AQUI / f"ref_{r}.wav"), language="pt", vad_filter=False)
    textos[r] = " ".join(s.text.strip() for s in segs).strip()
    print(f"ref_{r}: {textos[r]}", flush=True)
(SAIDA / "referencias.json").write_text(json.dumps(textos, ensure_ascii=False, indent=1), encoding="utf-8")
del w

from qwen_tts import Qwen3TTSModel
m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-0.6B-Base", device_map="cpu", dtype=torch.float32)
prompts = {r: m.create_voice_clone_prompt(ref_audio=str(AQUI / f"ref_{r}.wav"), ref_text=textos[r]) for r in textos}

def gravar(nome, texto, r):
    t = time.time()
    wavs, sr = m.generate_voice_clone(text=texto, language="Portuguese", voice_clone_prompt=prompts[r])
    wav = np.asarray(wavs[0], dtype=np.float32).squeeze()
    wav = wav * (0.89 / (float(np.max(np.abs(wav))) or 1.0))
    tmp = SAIDA / f"{nome}.wav"
    sf.write(tmp, wav, sr)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-ac", "1", "-b:a", "64k", str(SAIDA / f"{nome}.mp3")], check=True)
    tmp.unlink()
    print(f"ok {nome}: {len(wav) / sr:.1f}s em {time.time() - t:.0f}s", flush=True)
    return round(len(wav) / sr, 2)

dur = {}
for f in falas:
    nome, texto = f[0], f[1]
    r = f[2] if len(f) > 2 else "a"
    dur[nome] = gravar(nome, texto, r)
(SAIDA / "duracoes.json").write_text(json.dumps(dur, indent=1), encoding="utf-8")
