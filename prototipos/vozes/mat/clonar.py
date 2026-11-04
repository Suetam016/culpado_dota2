"""Clona a voz do Mat (trechos alvo*.wav, com o ok dele) em modelos que clonam de verdade, na CPU do Actions.

    python prototipos/vozes/mat/clonar.py <chatterbox|qwen>
"""
import sys, time, traceback
from pathlib import Path
import numpy as np
import soundfile as sf

AQUI = Path(__file__).parent
SAIDA = AQUI / "clone"
SAIDA.mkdir(exist_ok=True)
REF = str(AQUI / "alvo.wav")
TEXTO = ("Atenção, grupo! Saiu o veredito oficial do Culpado. Nakyo, de Mirana, carregou trinta e dois por cento "
         "do mérito. Iluminados sessenta e três, Temidos trinta e nove. Os outros quatro que lutem.")


def salvar(nome, wav, sr):
    wav = np.asarray(wav, dtype=np.float32).squeeze()
    sf.write(SAIDA / f"{nome}.wav", wav, sr)
    print(f"ok {nome}: {len(wav)/sr:.1f}s", flush=True)


def chatterbox():
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    for nome, kw in [("chatterbox_clone", {}), ("chatterbox_clone_expressivo", {"exaggeration": 0.7, "cfg_weight": 0.3})]:
        try:
            wav = m.generate(TEXTO, language_id="pt", audio_prompt_path=REF, **kw)
            salvar(nome, wav.cpu().numpy(), m.sr)
        except Exception:
            traceback.print_exc()


def qwen():
    import torch
    from faster_whisper import WhisperModel
    segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(REF, language="pt")
    ref_text = " ".join(s.text.strip() for s in segs)
    print("transcrição do trecho:", ref_text, flush=True)
    from qwen_tts import Qwen3TTSModel
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-0.6B-Base", device_map="cpu", dtype=torch.float32)
    try:
        wavs, sr = m.generate_voice_clone(text=TEXTO, language="Portuguese", ref_audio=REF, ref_text=ref_text)
        salvar("qwen3_clone", wavs[0], sr)
    except Exception:
        traceback.print_exc()


t = time.time()
{"chatterbox": chatterbox, "qwen": qwen}[sys.argv[1]]()
print(f"{sys.argv[1]}: {time.time()-t:.0f}s")
