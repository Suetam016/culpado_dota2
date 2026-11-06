"""Grava os áudios da fila (audio/fila.json) com a voz clonada do Mat no Qwen3-TTS (Apache 2.0), na CPU do Actions.

    python audio/falar.py

A voz vem de audio/voz/mat.wav (trecho de 26 s que o Mat publicou para isso) e da transcrição dele em audio/voz/mat.txt.
Cada vitória vira uma conversa do zap: 3 a 4 áudios curtos (audio/banco.js), cada um gravado inteiro em
audios/banco/<chave>.mp3, e audios/<id>-<lado>.json (texto, áudios, quem fala) marca a partida como pronta. O pedido do site atendido (audio/pedidos/<id>) é apagado, saindo o áudio ou não; a falha fica em
audio/falhas.json para o site parar de esperar.
"""
import json
import os
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


def carregar(device="cpu"):
    """Carrega o modelo e o "prompt" da voz do Mat (calculado uma vez e reaproveitado em todos os áudios)."""
    import torch
    from qwen_tts import Qwen3TTSModel

    t = time.time()
    dtype = torch.float32
    if device.startswith("cuda"):
        # bfloat16 só nas GPUs novas (L4/A10, Ampere+); na T4 vai float16
        dtype = torch.bfloat16 if torch.cuda.get_device_capability()[0] >= 8 else torch.float16
    modelo = Qwen3TTSModel.from_pretrained(MODELO, device_map=device, dtype=dtype)
    prompt = modelo.create_voice_clone_prompt(ref_audio=str(VOZ), ref_text=VOZ_TEXTO)
    print(f"modelo carregado em {time.time() - t:.0f}s ({device}, {torch.get_num_threads()} threads, "
          f"{os.cpu_count()} CPUs)", flush=True)
    return modelo, prompt


SEMENTE = 1234


def gravar_um(modelo, prompt, texto, destino):
    """Grava UM áudio curto da conversa em <destino>.mp3, inteiro e de uma vez só (sem emenda). Devolve os segundos."""
    import numpy as np
    import soundfile as sf
    import torch

    torch.manual_seed(SEMENTE)  # a mesma semente em todos: a voz fica com o mesmo jeito de um áudio para o outro
    wavs, sr = modelo.generate_voice_clone(text=texto, language="Portuguese", voice_clone_prompt=prompt)
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
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".wav")
    sf.write(tmp, w, sr)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "24000", "-ac", "1", "-b:a", "64k", str(destino.with_suffix(".mp3"))], check=True)
    tmp.unlink()
    return round(len(w) / sr, 2)


def gravar(modelo, prompt, x, saida=SAIDA):
    """Grava a conversa de um item da fila: cada áudio curto (x["audios"], de audio/banco.js) vira
    audios/banco/<chave>.mp3 (o que já estiver no banco é reaproveitado) e audios/<arquivo>.json marca a partida
    como pronta. Devolve o .json (dict)."""
    t = time.time()
    banco = saida / "banco"
    arq_indice = banco / "indice.json"
    indice = json.loads(arq_indice.read_text(encoding="utf-8")) if arq_indice.exists() else {}
    audios = []
    for a in x["audios"]:
        if a["chave"] not in indice or not (banco / f"{a['chave']}.mp3").exists():
            seg = gravar_um(modelo, prompt, a["texto"], banco / a["chave"])
            indice[a["chave"]] = {"t": a["texto"], "s": seg}
            arq_indice.write_text(json.dumps(indice, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        audios.append({**a, "segundos": indice[a["chave"]]["s"]})
    info = {k: x.get(k) for k in ("id", "lado", "texto", "partes", "eu", "conta", "heroi", "fatia")}
    info.update(conversa=True, audios=audios, segundos=round(sum(a["segundos"] for a in audios), 1), voz="mat",
                modelo=MODELO, gravadoEm=agora())
    (saida / f"{x['arquivo']}.json").write_text(json.dumps(info, ensure_ascii=False), encoding="utf-8")
    print(f"ok {x['arquivo']}: {len(audios)} áudios, {info['segundos']}s em {time.time() - t:.0f}s", flush=True)
    return info


def main():
    fila = json.loads((AQUI / "fila.json").read_text(encoding="utf-8"))
    SAIDA.mkdir(exist_ok=True)
    falhas_arq = AQUI / "falhas.json"
    falhas = json.loads(falhas_arq.read_text(encoding="utf-8")) if falhas_arq.exists() else {}
    a_gravar = [x for x in fila if not x.get("jaTem")]
    modelo = prompt = None
    if a_gravar:
        modelo, prompt = carregar("cpu")
    for x in fila:
        pedido = AQUI / "pedidos" / str(x["id"])
        if x.get("jaTem"):
            pedido.unlink(missing_ok=True)
            continue
        try:
            gravar(modelo, prompt, x)
            falhas.pop(str(x["id"]), None)
        except Exception as e:
            traceback.print_exc()
            falhas[str(x["id"])] = {"motivo": str(e)[:200], "quando": agora()}
        finally:
            if x.get("pedido"):
                pedido.unlink(missing_ok=True)
    falhas_arq.write_text(json.dumps(falhas, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
