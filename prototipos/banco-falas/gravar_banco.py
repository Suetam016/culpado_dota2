"""Banco de falas: grava na voz do Mat as frases que faltam (prototipos/banco-falas/faltam.json, do faltam.js).

    python prototipos/banco-falas/gravar_banco.py

Cada áudio vira audios/banco/<chave>.mp3, gravado de uma vez só (mesma semente, pontas com folga larga, volume
igualado). O índice audios/banco/indice.json ({chave: {t, s}}) é salvo depois de cada frase, para um job que
estoure o tempo não perder o que já gravou. O site emenda as frases na hora (pausas e ambiente ficam com ele).
"""
import json
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
sys.path.insert(0, str(RAIZ / "audio"))
import falar  # noqa: E402

BANCO = RAIZ / "audios" / "banco"


def main():
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
        seg = falar.gravar_um(modelo, prompt, x["texto"], BANCO / x["chave"])
        indice[x["chave"]] = {"t": x["texto"], "s": seg}
        arq_indice.write_text(json.dumps(indice, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        print(f"{i + 1}/{len(faltam)} {seg:4.1f}s em {time.time() - t:4.0f}s  {x['texto']}", flush=True)

if __name__ == "__main__":
    main()
