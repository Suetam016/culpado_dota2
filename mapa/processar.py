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
import os
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


VERSAO = 2  # 2: uso de skills e itens (para o mapa mostrar o que aconteceu na luta)
ITENS_DE_LUTA = {
    "blink", "overwhelming_blink", "swift_blink", "arcane_blink", "black_king_bar", "refresher", "glimmer_cape",
    "force_staff", "hurricane_pike", "lotus_orb", "sheepstick", "orchid", "bloodthorn", "nullifier", "abyssal_blade",
    "manta", "satanic", "shivas_guard", "ghost", "ethereal_blade", "cyclone", "wind_waker", "pipe", "crimson_guard",
    "guardian_greaves", "mekansm", "solar_crest", "rod_of_atos", "gungir", "disperser", "silver_edge", "invis_sword",
    "blade_mail", "aeon_disk", "heavens_halberd", "meteor_hammer", "dagon", "bfury", "harpoon", "phylactery",
    "boots_of_bearing", "spirit_vessel", "urn_of_shadows", "medallion_of_courage", "diffusal_blade", "tpscroll",
    "travel_boots", "travel_boots_2", "smoke_of_deceit", "eternal_shroud", "sphere", "helm_of_the_overlord",
}
_CONST: dict = {}


def constantes() -> dict:
    """Heróis, habilidades e itens do OpenDota (uma vez por rodada): nome bonito e qual é a ultimate."""
    if not _CONST:
        def pega(caminho):
            for tentativa in range(3):
                try:
                    return get(caminho)
                except Exception:  # noqa: BLE001
                    if tentativa == 2:
                        raise
                    time.sleep(5 * (tentativa + 1))
        novo = {"npc": {int(h["id"]): h["name"] for h in pega("/constants/heroes").values()},
                "hab": pega("/constants/abilities"), "itens": pega("/constants/items"), "ults": set()}
        for hab in pega("/constants/hero_abilities").values():
            lista = [a for a in hab.get("abilities") or [] if a and a != "generic_hidden"]
            if lista:
                novo["ults"].add(lista[-1])
        _CONST.update(novo)  # só guarda quando veio tudo
    return _CONST


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
    exemplo = exemplo_hab = None
    heroi_do_slot: dict[int, int] = {}
    casts = []  # (tempo, nome do lançador, chave da habilidade, nome do alvo, item?)
    for ev in parsear(dem, parser):
        tipo = ev.get("type")
        tipos[tipo] += 1
        if tipo == "player_slot":
            slot_de[ev.get("key")] = ev.get("value")
        elif tipo == "interval" and ev.get("x") is not None:
            if exemplo is None:
                exemplo = ev
            pos.setdefault(int(ev["slot"]), {})[int(ev["time"])] = (round(float(ev["x"]), 1), round(float(ev["y"]), 1))
            if ev.get("hero_id"):
                heroi_do_slot[int(ev["slot"])] = int(ev["hero_id"])
        elif tipo in ("DOTA_COMBATLOG_ABILITY", "DOTA_COMBATLOG_ITEM") and ev.get("inflictor"):
            if exemplo_hab is None:
                exemplo_hab = ev
            if not ev.get("attackerillusion"):
                casts.append((float(ev.get("time") or 0), ev.get("attackername"), ev["inflictor"], ev.get("targetname"), tipo.endswith("ITEM")))
    dem.unlink(missing_ok=True)
    print(f"  {match_id}: {sum(tipos.values())} eventos; tipos {tipos.most_common(8)}")
    print(f"  exemplo de interval: {json.dumps(exemplo)[:400]}")
    print(f"  exemplo de habilidade: {json.dumps(exemplo_hab)[:400]}")
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
    hab, usos = habilidades(casts, ordem, heroi_do_slot)
    print(f"  {len(usos)} usos de skill/item de {len(casts)} no combat log")
    return {"v": VERSAO if hab is not None else 1, "id": match_id, "t0": t0, "slots": [slot_de.get(s, s) for s in ordem], "x": xs, "y": ys,
            "limites": [min(todos_x), max(todos_x), min(todos_y), max(todos_y)], "hab": hab or [], "usos": usos}


def habilidades(casts, ordem, heroi_do_slot):
    """hab: [[chave, nome, tipo]] (tipo u = ultimate, h = skill, i = item); usos: [[t, quem, hab, alvo]]
    com quem/alvo = índice em slots (-1 se o alvo não é herói)."""
    try:
        c = constantes()
    except Exception as e:  # noqa: BLE001
        print(f"  sem constantes do OpenDota ({e!r}): mapa sem skills por enquanto")
        return None, []
    k_do_npc = {c["npc"].get(heroi_do_slot.get(s)): k for k, s in enumerate(ordem) if heroi_do_slot.get(s)}
    hab, idx, usos = [], {}, []
    for t, quem, chave, alvo, item in casts:
        k = k_do_npc.get(quem)
        if k is None:
            continue
        if item:
            nome_item = chave.removeprefix("item_")
            if nome_item not in ITENS_DE_LUTA:
                continue
            info = c["itens"].get(nome_item) or {}
            nome, tipo, chave = info.get("dname") or nome_item.replace("_", " ").title(), "i", nome_item
        else:
            info = c["hab"].get(chave) or {}
            if not info.get("dname") or chave.startswith(("special_bonus", "ability_", "plus_")):
                continue
            nome, tipo = info["dname"], "u" if chave in c["ults"] else "h"
        if chave not in idx:
            idx[chave] = len(hab)
            hab.append([chave, nome, tipo])
        usos.append([round(t, 1), k, idx[chave], k_do_npc.get(alvo, -1)])
    usos.sort()
    return hab, usos


MAX_FALHAS = 6


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--amigos")
    ap.add_argument("--pedidos", default="mapa/pedidos")
    ap.add_argument("--saida", default="mapas")
    ap.add_argument("--parser", default="http://localhost:5600")
    ap.add_argument("--maximo", type=int, default=15)
    ap.add_argument("--so-fila", action="store_true", help="só diz se tem partida nova (checagem rápida do workflow)")
    ap.add_argument("--falhas", default="mapa/falhas.json")
    a = ap.parse_args()
    saida = Path(a.saida)
    saida.mkdir(parents=True, exist_ok=True)
    feitos, antigos = set(), []
    for arq in saida.glob("*.json"):
        if arq.stem.isdigit():
            # versão antiga entra de novo na fila (no fim) para ganhar as skills
            (feitos.add if f'"v":{VERSAO},' in arq.read_text()[:20] else antigos.append)(int(arq.stem))
    fila, recentes = [], []
    pedidos = Path(a.pedidos)
    for f in sorted(pedidos.glob("*")) if pedidos.exists() else []:
        if f.stem.isdigit():
            fila.append(int(f.stem))
    if a.amigos and Path(a.amigos).exists():
        for conta in json.loads(Path(a.amigos).read_text()):
            try:
                for j in get(f"/players/{conta}/matches?limit=6&date=5&significant=0"):
                    recentes.append(int(j["match_id"]))
            except Exception as e:  # noqa: BLE001
                print(f"  conta {conta}: {e}")
            time.sleep(1.2)
    fila += sorted(recentes, reverse=True)  # pedidos primeiro, depois as partidas mais novas
    fila += sorted(antigos, reverse=True)
    falhas_arq = Path(a.falhas)
    falhas = json.loads(falhas_arq.read_text()) if falhas_arq.exists() else {}
    # partida que falhou muitas vezes (sem replay na Valve, por exemplo) sai da fila: o robô roda a cada 10 min
    fila = [i for i in dict.fromkeys(fila) if i not in feitos and falhas.get(str(i), 0) < MAX_FALHAS]
    print(f"Fila: {fila}")
    if a.so_fila:
        saida_gh = os.environ.get("GITHUB_OUTPUT")
        if saida_gh:
            with open(saida_gh, "a") as fh:
                fh.write(f"fila={len(fila)}\n")
        return 0
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
            falhas[str(mid)] = falhas.get(str(mid), 0) + 1
            try:  # pede a análise ao OpenDota para a próxima rodada ter replay_url
                post(f"/request/{mid}")
            except Exception:  # noqa: BLE001
                pass
    falhas_arq.write_text(json.dumps(falhas, indent=0, sort_keys=True) + "\n")
    print(f"{feitos_agora} mapas novos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
