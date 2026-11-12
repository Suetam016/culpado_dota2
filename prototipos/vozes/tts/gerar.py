"""Gera a mesma narração do veredito em vários modelos de voz abertos, para comparar (protótipo).

    python prototipos/vozes/tts/gerar.py <modelo>
"""
import sys, time, traceback
from pathlib import Path
import numpy as np
import soundfile as sf

TEXTO = ("Atenção, grupo! Saiu o veredito oficial do Culpado. Nakyo, de Mirana, carregou trinta e dois por cento "
         "do mérito. Iluminados sessenta e três, Temidos trinta e nove. Os outros quatro que lutem.")
SAIDA = Path(__file__).parent / "amostras"
SAIDA.mkdir(exist_ok=True)


def salvar(nome, wav, sr):
    wav = np.asarray(wav, dtype=np.float32).squeeze()
    sf.write(SAIDA / f"{nome}.wav", wav, sr)
    print(f"ok {nome}: {len(wav)/sr:.1f}s")


def chatterbox():
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    wav = m.generate(TEXTO, language_id="pt")
    salvar("chatterbox", wav.cpu().numpy(), m.sr)


def kokoro():
    from kokoro import KPipeline
    p = KPipeline(lang_code="p")
    for voz in ["pf_dora", "pm_alex", "pm_santa"]:
        partes = [a for _, _, a in p(TEXTO, voice=voz)]
        salvar(f"kokoro_{voz}", np.concatenate([np.asarray(x) for x in partes]), 24000)


def qwen():
    import torch
    from qwen_tts import Qwen3TTSModel
    m = Qwen3TTSModel.from_pretrained("Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice", device_map="cpu", dtype=torch.float32)
    try:
        print("falantes:", m.get_supported_speakers())
    except Exception as e:
        print("sem lista de falantes:", e)
    for falante in ["Ryan", "Aiden"]:
        try:
            wavs, sr = m.generate_custom_voice(text=TEXTO, language="Portuguese", speaker=falante)
            salvar(f"qwen3_{falante.lower()}", wavs[0], sr)
        except Exception:
            traceback.print_exc()


t = time.time()
try:
    {"chatterbox": chatterbox, "kokoro": kokoro, "qwen": qwen}[sys.argv[1]]()
except Exception:
    traceback.print_exc()
print(f"{sys.argv[1]}: {time.time()-t:.0f}s")
