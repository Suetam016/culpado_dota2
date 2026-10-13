"""Posição de cada herói segundo a segundo, a partir do replay (para o "lance animado" do site).

Roda no GitHub Actions do repositório do site, com o parser de replays do OpenDota rodando em
localhost:5600. Para cada partida: pega o replay_url no OpenDota, baixa o .dem.bz2 da Valve,
descompacta, manda pro parser e guarda só as posições (eventos "interval") em mapas/<id>.json.

    python mapa/processar.py --amigos amigos.json --pedidos mapa/pedidos --saida mapas
"""
from __future__ import annotations

import argparse
import bz2
import json
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

API = "https://api.opendota.com/api"


def get(caminho: str):
    req = urllib.request.Request(API + caminho, headers={"User-Agent": "culpado-dota2-mapa"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def post(caminho: str):
    req = urllib.request.Request(API + caminho, method="POST", headers={"User-Agent": "culpado-dota2-mapa"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def baixar(url: str, destino: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "culpado-dota2-mapa"})
    with urllib.request.urlopen(req, timeout=300) as r, open(destino, "wb") as out:
        primeiro = r.read(1 << 20)
        print(f"  replay {url} -> HTTP {r.status} {r.headers.get('Content-Type')} {r.headers.get('Content-Length')} inicio={primeiro[:12]!r}")
        if primeiro[:3] == b"BZh":
            dec = bz2.BZ2Decompressor()
            out.write(dec.decompress(primeiro))
            while bloco := r.read(1 << 20):
                out.write(dec.decompress(bloco))
        elif primeiro[:4] == b"\x28\xb5\x2f\xfd":  # zstd (a Valve trocou o bz2 por zstd, mesmo com o nome .bz2)
            import zstandard
            dec = zstandard.ZstdDecompressor().decompressobj()
            out.write(dec.decompress(primeiro))
            while bloco := r.read(1 << 20):
                out.write(dec.decompress(bloco))
        elif primeiro[:6] == b"PBDEMS":
            out.write(primeiro)
            while bloco := r.read(1 << 20):
                out.write(bloco)
        else:
            raise RuntimeError(f"replay em formato inesperado: {primeiro[:40]!r}")


def parsear(dem: Path, parser: str):
    req = urllib.request.Request(parser, data=open(dem, "rb"), method="POST",
                                 headers={"Content-Length": str(dem.stat().st_size)})
    with urllib.request.urlopen(req, timeout=900) as r:
        for linha in r:
            linha = linha.strip()
            if linha:
                try:
                    yield json.loads(linha)
                except json.JSONDecodeError:
                    continue


def processar(match_id: int, parser: str, tmp: Path) -> dict:
    m = get(f"/matches/{match_id}")
    url = m.get("replay_url")
    if not url:
        raise RuntimeError("sem replay_url (partida ainda não analisada pelo OpenDota)")
    dem = tmp / f"{match_id}.dem"
    baixar(url, dem)
    slot_de = {}
    pos: dict[int, dict[int, tuple]] = {}
    tipos = Counter()
    exemplo = None
    for ev in parsear(dem, parser):
        tipo = ev.get("type")
        tipos[tipo] += 1
        if tipo == "player_slot":
            slot_de[ev.get("key")] = ev.get("value")
        elif tipo == "interval" and ev.get("x") is not None:
            if exemplo is None:
                exemplo = ev
            pos.setdefault(int(ev["slot"]), {})[int(ev["time"])] = (round(float(ev["x"]), 1), round(float(ev["y"]), 1))
    dem.unlink(missing_ok=True)
    print(f"  {match_id}: {sum(tipos.values())} eventos; tipos {tipos.most_common(8)}")
    print(f"  exemplo de interval: {json.dumps(exemplo)[:400]}")
    if not pos:
        raise RuntimeError("parser não devolveu posições")
    t0 = min(min(d) for d in pos.values())
    t1 = max(max(d) for d in pos.values())
    ordem = sorted(pos)
    xs, ys = [], []
    for s in ordem:
        d, ux, uy, lx, ly = pos[s], [], [], None, None
        for t in range(t0, t1 + 1):
            if t in d:
                lx, ly = d[t]
            ux.append(lx)
            uy.append(ly)
        xs.append(ux)
        ys.append(uy)
    todos_x = [v for a in xs for v in a if v is not None]
    todos_y = [v for a in ys for v in a if v is not None]
    return {"v": 1, "id": match_id, "t0": t0, "slots": [slot_de.get(s, s) for s in ordem], "x": xs, "y": ys,
            "limites": [min(todos_x), max(todos_x), min(todos_y), max(todos_y)]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--amigos")
    ap.add_argument("--pedidos", default="mapa/pedidos")
    ap.add_argument("--saida", default="mapas")
    ap.add_argument("--parser", default="http://localhost:5600")
    ap.add_argument("--maximo", type=int, default=6)
    a = ap.parse_args()
    saida = Path(a.saida)
    saida.mkdir(parents=True, exist_ok=True)
    feitos = {int(p.stem) for p in saida.glob("*.json") if p.stem.isdigit()}
    fila = []
    pedidos = Path(a.pedidos)
    for f in sorted(pedidos.glob("*")) if pedidos.exists() else []:
        if f.stem.isdigit():
            fila.append(int(f.stem))
    if a.amigos and Path(a.amigos).exists():
        for conta in json.loads(Path(a.amigos).read_text()):
            try:
                for j in get(f"/players/{conta}/matches?limit=6&date=5&significant=0"):
                    fila.append(int(j["match_id"]))
            except Exception as e:  # noqa: BLE001
                print(f"  conta {conta}: {e}")
            time.sleep(1.2)
    fila = [i for i in dict.fromkeys(fila) if i not in feitos]
    print(f"Fila: {fila}")
    tmp = Path("/tmp/replays")
    tmp.mkdir(exist_ok=True)
    feitos_agora = 0
    for mid in fila[: a.maximo]:
        try:
            dados = processar(mid, a.parser, tmp)
            (saida / f"{mid}.json").write_text(json.dumps(dados, separators=(",", ":")))
            feitos_agora += 1
            (pedidos / str(mid)).unlink(missing_ok=True) if pedidos.exists() else None
            print(f"OK {mid}")
        except Exception as e:  # noqa: BLE001
            print(f"FALHOU {mid}: {e}")
            try:  # pede a análise ao OpenDota para a próxima rodada ter replay_url
                post(f"/request/{mid}")
            except Exception:  # noqa: BLE001
                pass
    print(f"{feitos_agora} mapas novos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
