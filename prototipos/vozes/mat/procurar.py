"""Procura um estilo de voz do Kokoro parecido com a voz do Mat (random walk simples, CPU).

Ideia do KVoiceWalk, reescrita curta: o estilo de voz do Kokoro é um tensor pequeno; mexemos nele aos poucos e
ficamos com a mudança quando a fala gerada fica mais parecida com a gravação (Resemblyzer) sem perder a estabilidade.

    python procurar.py alvo.wav alvo2.wav <minutos> <pasta_saida>
"""
import sys, time
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from huggingface_hub import hf_hub_download
from kokoro import KPipeline
from resemblyzer import VoiceEncoder, preprocess_wav

alvos, minutos, saida = sys.argv[1:3], float(sys.argv[3]), Path(sys.argv[4])
saida.mkdir(parents=True, exist_ok=True)
torch.manual_seed(7)
pipe = KPipeline(lang_code="p", repo_id="hexgrad/Kokoro-82M", device="cpu")
enc = VoiceEncoder("cpu")
alvo = np.mean([enc.embed_utterance(preprocess_wav(Path(a))) for a in alvos], axis=0)
FRASES = ["Saiu o veredito oficial do Culpado, e dessa vez ninguém vai poder reclamar do resultado.",
          "Ele carregou o time nas costas, farmou tudo que podia e ainda segurou a base no final."]
BASES = ["pm_alex", "pm_santa", "pf_dora", "am_adam", "am_michael", "am_eric", "am_liam", "am_onyx", "am_puck",
         "am_echo", "am_fenrir", "bm_george", "bm_lewis", "bm_daniel", "bm_fable", "em_alex", "em_santa", "im_nicola", "hm_omega"]


def falar(voz, texto):
    partes = [np.asarray(a) for _, _, a in pipe(texto, voice=voz)]
    return np.concatenate(partes) if partes else np.zeros(1)


def emb(wav):
    return enc.embed_utterance(preprocess_wav(wav, source_sr=24000))


def nota(voz):
    e1, e2 = emb(falar(voz, FRASES[0])), emb(falar(voz, FRASES[1]))
    t = float(np.mean([e1 @ alvo, e2 @ alvo]) / np.linalg.norm(alvo))
    s = float(e1 @ e2)
    return 2 * t * s / (t + s), t, s


vozes = {}
for b in BASES:
    try:
        vozes[b] = torch.load(hf_hub_download("hexgrad/Kokoro-82M", f"voices/{b}.pt"), weights_only=True)
    except Exception as e:
        print("sem", b, e)
pilha = torch.stack(list(vozes.values()))
desvio = pilha.std(dim=0)
notas = sorted(((nota(v), n) for n, v in vozes.items()), key=lambda x: -x[0][0])
for (sc, t, s), n in notas:
    print(f"{n:10s} nota {sc:.3f} alvo {t:.3f} estab {s:.3f}")
top = [vozes[n] for _, n in notas[:3]]
melhor, (mn, mt, ms) = notas[0][1], notas[0][0]
melhor = vozes[melhor]
media = torch.stack(top).mean(dim=0)
r = nota(media)
if r[0] > mn:
    melhor, (mn, mt, ms) = media, r
print(f"início: nota {mn:.3f} alvo {mt:.3f}")
fim, passo, escala = time.time() + minutos * 60, 0, 0.25
while time.time() < fim:
    passo += 1
    cand = melhor + torch.randn_like(melhor) * desvio * escala
    r = nota(cand)
    if r[0] > mn:
        melhor, (mn, mt, ms) = cand, r
        torch.save(melhor, saida / "voz_mat.pt")
        print(f"passo {passo}: nota {mn:.3f} alvo {mt:.3f} estab {ms:.3f}", flush=True)
    if passo % 200 == 0:
        escala = max(0.05, escala * 0.9)
        print(f"passo {passo} (escala {escala:.3f})", flush=True)
torch.save(melhor, saida / "voz_mat.pt")
texto = ("Atenção, grupo! Saiu o veredito oficial do Culpado. Nakyo, de Mirana, carregou trinta e dois por cento do mérito. "
         "Iluminados sessenta e três, Temidos trinta e nove. Os outros quatro que lutem.")
sf.write(saida / "narracao_mat.wav", falar(str(saida / "voz_mat.pt"), texto), 24000)
inicial = notas[0][1]
sf.write(saida / f"narracao_base_{inicial}.wav", falar(inicial, texto), 24000)
print(f"fim: {passo} passos, nota {mn:.3f}, alvo {mt:.3f} (base mais parecida: {inicial})")
