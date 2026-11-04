"""Grava os áudios da fila (audio/fila.json) com a voz clonada do Mat no Qwen3-TTS (Apache 2.0), na CPU do Actions.

    python audio/falar.py

A voz vem de audio/voz/mat.wav (trecho de 26 s que o Mat publicou para isso) e da transcrição dele em audio/voz/mat.txt.
Cada áudio sai em audios/<id>-<lado>.mp3 (mono, 48 kbps) com audios/<id>-<lado>.json ao lado (texto, quem fala,
duração). O pedido do site atendido (audio/pedidos/<id>) é apagado, saindo o áudio ou não; a falha fica em
audio/falhas.json para o site parar de esperar.
"""
import json
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

AQUI = Path(__file__).parent
RAIZ = AQUI.parent
SAIDA = RAIZ / "audios"
VOZ = AQUI / "voz" / "mat.wav"
VOZ_TEXTO = (AQUI / "voz" / "mat.txt").read_text(encoding="utf-8").strip()
MODELO = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"


def agora():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    fila = json.loads((AQUI / "fila.json").read_text(encoding="utf-8"))
    SAIDA.mkdir(exist_ok=True)
    falhas_arq = AQUI / "falhas.json"
    falhas = json.loads(falhas_arq.read_text(encoding="utf-8")) if falhas_arq.exists() else {}
    a_gravar = [x for x in fila if not x.get("jaTem")]
    modelo = prompt = None
    if a_gravar:
        import torch
        from qwen_tts import Qwen3TTSModel
        global np, sf
        import numpy as np
        import soundfile as sf

        t = time.time()
        modelo = Qwen3TTSModel.from_pretrained(MODELO, device_map="cpu", dtype=torch.float32)
        # o "prompt" da voz é calculado uma vez e reaproveitado em todos os áudios
        prompt = modelo.create_voice_clone_prompt(ref_audio=str(VOZ), ref_text=VOZ_TEXTO)
        print(f"modelo carregado em {time.time() - t:.0f}s", flush=True)
    for x in fila:
        pedido = AQUI / "pedidos" / str(x["id"])
        if x.get("jaTem"):
            pedido.unlink(missing_ok=True)
            continue
        t = time.time()
        try:
            wavs, sr = modelo.generate_voice_clone(text=x["texto"], language="Portuguese", voice_clone_prompt=prompt)
            wav = np.asarray(wavs[0], dtype=np.float32).squeeze()
            # normaliza o volume (pico em -1 dB) e grava em mp3 mono leve
            pico = float(np.max(np.abs(wav))) or 1.0
            wav = wav * (0.89 / pico)
            tmp = SAIDA / f"{x['arquivo']}.wav"
            sf.write(tmp, wav, sr)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-ac", "1", "-b:a", "48k",
                            str(SAIDA / f"{x['arquivo']}.mp3")], check=True)
            tmp.unlink()
            info = {k: x.get(k) for k in ("id", "lado", "texto", "partes", "eu", "conta", "heroi", "fatia")}
            info.update(segundos=round(len(wav) / sr, 1), voz="mat", modelo=MODELO, gravadoEm=agora())
            (SAIDA / f"{x['arquivo']}.json").write_text(json.dumps(info, ensure_ascii=False), encoding="utf-8")
            falhas.pop(str(x["id"]), None)
            print(f"ok {x['arquivo']}: {len(wav) / sr:.1f}s de áudio em {time.time() - t:.0f}s", flush=True)
        except Exception as e:
            traceback.print_exc()
            falhas[str(x["id"])] = {"motivo": str(e)[:200], "quando": agora()}
        finally:
            if x.get("pedido"):
                pedido.unlink(missing_ok=True)
    falhas_arq.write_text(json.dumps(falhas, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
