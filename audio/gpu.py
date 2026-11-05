"""Voz do Mat na GPU (Modal): o mesmo Qwen3-TTS 0.6B do falar.py, para o áudio pedido pelo site sair em ~1 min.

Fluxo: o site pede (POST /audio no Worker) -> o Worker chama o endereço `pedir` daqui com a chave -> `pedir` dispara
`Voz.gravar` numa GPU e responde na hora -> `gravar` monta o roteiro (node audio/fila.js --id, o mesmo motor do site),
grava a voz e sobe audios/<id>-<lado>.mp3 + .json na main pela API do GitHub, apagando audio/pedidos/<id>. O site
já pergunta ao Worker se o áudio ficou pronto, então nada muda do lado dele.

Publicado pelo workflow voz-gpu.yml (segredos MODAL_TOKEN_ID/MODAL_TOKEN_SECRET). Custo: GPU T4 a ~US$ 0,59/h (VOZ_GPU=L4 no deploy troca), só
enquanto grava (a máquina desliga 2 min depois do último áudio); o plano grátis do Modal dá US$ 30/mês.

Teste na mão (mede o tempo de máquina fria e quente):  modal run audio/gpu.py --id 9073941063
"""
import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import modal

RAIZ_LOCAL = Path(__file__).resolve().parent.parent
RAIZ = "/repo"
MODELO = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
REPO = os.environ.get("CULPADO_REPO", "Suetam016/culpado_dota2")

app = modal.App("culpado-voz")
segredo = modal.Secret.from_name("culpado-voz")  # GITHUB_TOKEN, CHAVE, OPENDOTA_API_KEY (voz-gpu.yml cria)


def _baixar_modelo():
    from huggingface_hub import snapshot_download

    snapshot_download(MODELO)


# só o que o roteiro (motor do site + roteiro.js) e a voz precisam; o resto do repositório (mapas, sons) fica de fora
ARQUIVOS = ["index.html", "amigos.json", "ranking/gerar.js", "rotas/base.json"]
PASTAS = ["audio", "frases"]

imagem = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "sox", "nodejs")
    .pip_install("torch", "torchaudio", "qwen-tts==0.1.1", "soundfile", "numpy", "huggingface_hub")
    .run_function(_baixar_modelo)
)
for a in ARQUIVOS:
    if (RAIZ_LOCAL / a).exists():
        imagem = imagem.add_local_file(RAIZ_LOCAL / a, f"{RAIZ}/{a}", copy=True)
for d in PASTAS:
    if (RAIZ_LOCAL / d).is_dir():
        imagem = imagem.add_local_dir(RAIZ_LOCAL / d, f"{RAIZ}/{d}", copy=True,
                                      ignore=["pedidos/*", "fila.json", "falhas.json", "__pycache__"])

imagem_web = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]")


def agora():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def github(metodo, caminho, corpo=None):
    """API de conteúdo do GitHub: devolve (status, json)."""
    req = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/contents/{caminho}",
        method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "culpado-voz-gpu"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def subir(caminho, conteudo: bytes, mensagem):
    for _ in range(3):
        st, atual = github("GET", caminho)
        corpo = {"message": mensagem, "content": base64.b64encode(conteudo).decode()}
        if st == 200 and atual.get("sha"):
            corpo["sha"] = atual["sha"]
        st, r = github("PUT", caminho, corpo)
        if st in (200, 201):
            return
        time.sleep(1)
    raise RuntimeError(f"GitHub recusou {caminho}: {st} {str(r)[:200]}")


def apagar(caminho, mensagem):
    st, atual = github("GET", caminho)
    if st == 200 and atual.get("sha"):
        github("DELETE", caminho, {"message": mensagem, "sha": atual["sha"]})


def anotar_falha(id_, motivo):
    st, atual = github("GET", "audio/falhas.json")
    falhas = {}
    if st == 200:
        try:
            falhas = json.loads(base64.b64decode(atual.get("content", "")) or b"{}")
        except ValueError:
            falhas = {}
    falhas[str(id_)] = {"motivo": str(motivo)[:200], "quando": agora()}
    subir("audio/falhas.json", json.dumps(falhas, ensure_ascii=False, indent=1).encode(), f"Áudio da vitória: falhou {id_}")


@app.cls(gpu=os.environ.get("VOZ_GPU", "T4"), image=imagem, secrets=[segredo], timeout=600, scaledown_window=120, max_containers=2)
class Voz:
    @modal.enter()
    def carregar(self):
        import sys

        sys.path.insert(0, f"{RAIZ}/audio")
        import falar

        self.falar = falar
        self.modelo, self.prompt = falar.carregar("cuda")

    @modal.method()
    def gravar(self, id_: str, lado: str = "", subir_github: bool = True):
        t0 = time.time()
        try:
            cmd = ["node", f"{RAIZ}/audio/fila.js", "--id", str(id_)] + (["--lado", lado] if lado else [])
            subprocess.run(cmd, check=True, cwd=RAIZ, timeout=90)
            fila = [x for x in json.loads(Path(f"{RAIZ}/audio/fila.json").read_text(encoding="utf-8")) if not x.get("jaTem")]
            if not fila:
                raise RuntimeError("sem roteiro (partida sem craque ou incompleta)")
            x = fila[0]
            t1 = time.time()
            saida = Path("/tmp/audios")
            info = self.falar.gravar(self.modelo, self.prompt, x, saida)
            t2 = time.time()
            info["gpu"] = {"roteiro": round(t1 - t0, 1), "voz": round(t2 - t1, 1)}
            if subir_github:
                # o .mp3 antes do .json: o site considera pronto quando o .json aparece
                subir(f"audios/{x['arquivo']}.mp3", (saida / f"{x['arquivo']}.mp3").read_bytes(), f"Áudio da vitória (GPU): {id_}")
                subir(f"audios/{x['arquivo']}.json", json.dumps(info, ensure_ascii=False).encode(), f"Áudio da vitória (GPU): {id_}")
                apagar(f"audio/pedidos/{id_}", f"Áudio da vitória: pedido {id_} atendido")
            info["gpu"]["total"] = round(time.time() - t0, 1)
            print(json.dumps(info["gpu"]), flush=True)
            return info
        except Exception as e:
            if subir_github:
                anotar_falha(id_, e)
                apagar(f"audio/pedidos/{id_}", f"Áudio da vitória: pedido {id_} falhou")
            raise


@app.function(image=imagem_web, secrets=[segredo], max_containers=2)
@modal.fastapi_endpoint(method="POST")
def pedir(corpo: dict):
    """Chamado pelo Worker com {id, lado, chave}. Dispara a gravação numa GPU e responde na hora."""
    from fastapi import HTTPException

    chave = os.environ.get("CHAVE", "")
    if not chave or str(corpo.get("chave", "")) != chave:
        raise HTTPException(status_code=403, detail="chave")
    id_ = str(corpo.get("id", ""))
    lado = str(corpo.get("lado", ""))
    if not id_.isdigit() or not 9 <= len(id_) <= 12 or lado not in ("radiant", "dire", ""):
        raise HTTPException(status_code=400, detail="invalido")
    chamada = Voz().gravar.spawn(id_, lado)
    return {"ok": True, "chamada": chamada.object_id}


@app.local_entrypoint()
def teste(id: str = "9073941063", lado: str = "", vezes: int = 2):
    """Mede o tempo frio (1ª) e quente (2ª) sem subir nada no GitHub."""
    for i in range(vezes):
        t = time.time()
        info = Voz().gravar.remote(id, lado, subir_github=False)
        print(f"rodada {i + 1}: {time.time() - t:.1f}s no total, {info['segundos']}s de áudio, {info['gpu']}")
