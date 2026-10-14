"""Posição de cada herói segundo a segundo, a partir do replay (para o "lance animado" do site).

Roda no GitHub Actions do repositório do site, com o parser de replays do OpenDota rodando em
localhost:5600. Para cada partida: pega o replay_url no OpenDota, baixa o .dem.bz2 da Valve,
descompacta, manda pro parser e guarda só as posições (eventos "interval") em mapas/<id>.json.

    python mapa/processar.py --amigos amigos.json --pedidos mapa/pedidos --saida mapas

Pedidos do site (botão "Gerar o mapa agora", pelo Worker): arquivo mapa/pedidos/<id>. Cada pedido é tentado
mesmo que a partida já tenha falhado MAX_FALHAS vezes e sai da pasta depois da tentativa; o resultado fica em
mapas/<id>.json ou, se falhou, em mapa/falhas.json ({"<id>": {"n", "motivo", "quando"}}), que o Worker lê.
Agora aberto a todos: qualquer partida pode ter mapa gerado (antes era só com amigos no time).
Se o OpenDota ainda não tem o replay_url, o pedido espera aqui mesmo (até ESPERA_REPLAY_S) em vez de voltar ao site e gerar outra rodada.
"""
from __future__ import annotations

import argparse
import bz2
import calendar
import json
import os
import re
import sys
import time
import urllib.error
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


VERSAO = 4  # 2: uso de skills e itens; 3: dano entre heróis; 4: dano com a skill que causou
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
            brutas = hab.get("abilities") or [] if isinstance(hab, dict) else []
            planas = [x for a in brutas for x in (a if isinstance(a, list) else [a])]  # às vezes vem lista dentro de lista
            lista = [a for a in planas if isinstance(a, str) and a and a != "generic_hidden"]
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


def tem_amigo(m: dict, amigos) -> bool:
    return any(str(p.get("account_id")) in amigos for p in (m.get("players") or []) if isinstance(p, dict) and p.get("account_id"))


def processar(match_id: int, parser: str, tmp: Path, amigos=None, espera_replay_s: float = 0, dormir=None) -> dict:
    """amigos: contas do amigos.json (não usado; antes restringia apenas a amigos, agora aberto a todos).
    espera_replay_s: sem replay_url, pede a análise ao OpenDota e consulta de novo a cada ESPERA_PASSO_S até esse tempo."""
    m = get(f"/matches/{match_id}")
    url = m.get("replay_url")
    if not url and espera_replay_s > 0:
        try:
            post(f"/request/{match_id}")
        except Exception as e:  # noqa: BLE001
            print(f"  {match_id}: pedido de análise ao OpenDota falhou ({e})")
        fim = time.time() + espera_replay_s
        while not url and time.time() < fim:
            (dormir or time.sleep)(ESPERA_PASSO_S)
            try:
                url = get(f"/matches/{match_id}").get("replay_url")
            except Exception as e:  # noqa: BLE001
                print(f"  {match_id}: consulta ao OpenDota falhou ({e})")
        print(f"  {match_id}: " + ("o OpenDota liberou o replay" if url else f"sem replay_url depois de {espera_replay_s:.0f} s"))
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
    dano_brut: Counter = Counter()  # (segundo, atacante, alvo) -> dano, só herói em herói de verdade
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
        elif tipo == "DOTA_COMBATLOG_DAMAGE" and ev.get("targethero") and not ev.get("targetillusion") and ev.get("value"):
            inf = ev.get("inflictor")
            inf = inf if isinstance(inf, str) and inf not in ("dota_unknown", "") else ""
            dano_brut[(int(float(ev.get("time") or 0)), ev.get("attackername"), ev.get("targetname"), inf)] += int(ev["value"])
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
    dano = danos(dano_brut, ordem, heroi_do_slot, hab) if hab is not None else []
    print(f"  {len(dano)} registros de dano herói->herói")
    print(f"  {len(usos)} usos de skill/item de {len(casts)} no combat log")
    return {"v": VERSAO if hab is not None else 1, "id": match_id, "t0": t0, "slots": [slot_de.get(s, s) for s in ordem], "x": xs, "y": ys,
            "limites": [min(todos_x), max(todos_x), min(todos_y), max(todos_y)], "hab": hab or [], "usos": usos, "dano": dano}


def danos(brut, ordem, heroi_do_slot, hab):
    """[[segundo, atacante, alvo, dano, hab]] com atacante/alvo = índice em slots e hab = índice em hab (-1 =
    ataque normal). Ilusões contam para o dono. Skills que só aparecem no dano entram em hab."""
    c = constantes()
    k_do_npc = {c["npc"].get(heroi_do_slot.get(s)): k for k, s in enumerate(ordem) if heroi_do_slot.get(s)}
    idx = {h[0]: i for i, h in enumerate(hab)}
    out = []
    for (t, a, b, inf), v in brut.items():
        ka, kb = k_do_npc.get(a), k_do_npc.get(b)
        if ka is None or kb is None or ka == kb or v < 10:
            continue
        hi = -1
        if inf:
            chave = inf.removeprefix("item_")
            if chave not in idx:
                info = (c["itens"] if inf.startswith("item_") else c["hab"]).get(chave)
                info = info if isinstance(info, dict) else {}
                if isinstance(info.get("dname"), str):
                    idx[chave] = len(hab)
                    hab.append([chave, info["dname"], "i" if inf.startswith("item_") else "u" if chave in c["ults"] else "h"])
            hi = idx.get(chave, -1)
        out.append([t, ka, kb, v, hi])
    out.sort()
    return out


def habilidades(casts, ordem, heroi_do_slot):
    """hab: [[chave, nome, tipo]] (tipo u = ultimate, h = skill, i = item); usos: [[t, quem, hab, alvo]]
    com quem/alvo = índice em slots (-1 se o alvo não é herói)."""
    try:
        c = constantes()
    except Exception as e:  # noqa: BLE001
        import traceback
        print(f"  sem constantes do OpenDota ({e!r}): mapa sem skills por enquanto")
        print("  " + traceback.format_exc().strip().replace("\n", "\n  ")[-800:])
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
            info = c["itens"].get(nome_item)
            info = info if isinstance(info, dict) else {}
            nome, tipo, chave = info.get("dname") or nome_item.replace("_", " ").title(), "i", nome_item
        else:
            info = c["hab"].get(chave) if isinstance(chave, str) else None
            info = info if isinstance(info, dict) else {}
            if not isinstance(info.get("dname"), str) or chave.startswith(("special_bonus", "ability_", "plus_")):
                continue
            nome, tipo = info["dname"], "u" if chave in c["ults"] else "h"
        if chave not in idx:
            idx[chave] = len(hab)
            hab.append([chave, nome, tipo])
        usos.append([round(t, 1), k, idx[chave], k_do_npc.get(alvo, -1)])
    usos.sort()
    return hab, usos


MAX_FALHAS = 6
ESPERA_AUTOMATICA_S = 10 * 60  # partida que acabou de falhar não é tentada de novo sozinha antes disso
ESPERA_REPLAY_S = 5 * 60  # pedido do site sem replay_url: espera o OpenDota analisar dentro da mesma rodada
ESPERA_REPLAY_RODADA_S = 8 * 60  # soma das esperas numa rodada (os outros pedidos e o timeout do workflow)
ESPERA_PASSO_S = 20
FALHA_VELHA_S = 30 * 86400  # falhas.json: entradas mais velhas que isto saem (o arquivo não cresce sem fim)
ID_PARTIDA = re.compile(r"[0-9]{9,12}")  # só dígitos ASCII (str.isdigit aceita "²" e "١٢٣")


def n_falhas(v) -> int:
    """falhas.json aceita o formato novo {"n", "motivo", "quando"} e o antigo (só o número)."""
    if isinstance(v, dict):
        try:
            return int(v.get("n") or 0)
        except (TypeError, ValueError):
            return 0
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def motivo_da_falha(e: Exception) -> str:
    """Texto curto que o site mostra; "sem replay_url" = o OpenDota ainda não analisou (o site espera e tenta de novo)."""
    txt = str(e)
    if "replay_url" in txt:
        return "sem replay_url"
    if isinstance(e, urllib.error.HTTPError) and "valve" in str(getattr(e, "url", "") or "").lower():
        return f"replay indisponível na Valve (HTTP {e.code})"
    if "parser" in txt:
        return "o parser não leu o replay"
    return txt[:150] or e.__class__.__name__


def agora_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def quando_de(v):
    if not isinstance(v, dict) or not isinstance(v.get("quando"), str):
        return None
    try:
        return calendar.timegm(time.strptime(v["quando"], "%Y-%m-%dT%H:%M:%SZ"))
    except ValueError:
        return None


def recente(v, agora: float) -> bool:
    t = quando_de(v)
    return t is not None and agora - t < ESPERA_AUTOMATICA_S


def limpar_falhas(falhas: dict, candidatas, agora=None, antigas_tambem=True) -> dict:
    """Tira as entradas com mais de 30 dias e (antigas_tambem) as do formato antigo, só número, de partidas que
    não estão mais entre as candidatas (pedidos e partidas recentes dos amigos)."""
    agora = time.time() if agora is None else agora
    cand = {str(i) for i in candidatas}
    out = {}
    for k, v in falhas.items():
        if isinstance(v, dict):
            t = quando_de(v)
            if t is not None and agora - t > FALHA_VELHA_S:
                continue
        elif antigas_tambem and k not in cand:
            continue
        out[k] = v
    return out


def montar_fila(pedidos_ids, recentes, antigos, feitos, falhas, agora=None, so_pedidos=False):
    """Pedidos do site primeiro (sempre tentados: pedido novo zera a contagem de falhas da partida), depois as
    partidas recentes dos amigos e as de versão antiga. As automáticas saem da fila depois de MAX_FALHAS e não
    são tentadas de novo nos 10 min seguintes a uma falha."""
    agora = time.time() if agora is None else agora
    pedidos_ids = [i for i in dict.fromkeys(pedidos_ids) if i not in feitos]
    if so_pedidos:
        return pedidos_ids
    auto = [i for i in dict.fromkeys([*recentes, *antigos])
            if i not in feitos and i not in pedidos_ids
            and n_falhas(falhas.get(str(i))) < MAX_FALHAS and not recente(falhas.get(str(i)), agora)]
    return pedidos_ids + auto


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--amigos")
    ap.add_argument("--pedidos", default="mapa/pedidos")
    ap.add_argument("--saida", default="mapas")
    ap.add_argument("--parser", default="http://localhost:5600")
    ap.add_argument("--maximo", type=int, default=15)
    ap.add_argument("--so-fila", action="store_true", help="só diz se tem partida nova (checagem rápida do workflow)")
    ap.add_argument("--so-pedidos", action="store_true", help="só os pedidos do site (o workflow publica e depois faz o resto)")
    ap.add_argument("--falhas", default="mapa/falhas.json")
    a = ap.parse_args()
    saida = Path(a.saida)
    saida.mkdir(parents=True, exist_ok=True)
    feitos, antigos = set(), []
    for arq in saida.glob("*.json"):
        if ID_PARTIDA.fullmatch(arq.stem):
            # versão antiga entra de novo na fila (no fim) para ganhar as skills
            (feitos.add if f'"v":{VERSAO},' in arq.read_text()[:20] else antigos.append)(int(arq.stem))
    pedidos = Path(a.pedidos)
    pedidos_ids = sorted(int(f.name) for f in pedidos.glob("*") if ID_PARTIDA.fullmatch(f.name)) if pedidos.exists() else []
    pendentes = [i for i in pedidos_ids if i not in feitos]
    amigos = None
    if a.amigos and Path(a.amigos).exists():
        amigos = {str(c) for c in json.loads(Path(a.amigos).read_text())}  # {"conta": "nome"} ou ["conta"]
    recentes, contas_ok = [], 0
    # --so-fila com pedido do site esperando: responde já (o passo "Processar partidas" consulta as contas depois)
    if amigos and not a.so_pedidos and not (a.so_fila and pendentes):
        for conta in sorted(amigos):
            try:
                for j in get(f"/players/{conta}/matches?limit=6&date=5&significant=0"):
                    recentes.append(int(j["match_id"]))
                contas_ok += 1
            except Exception as e:  # noqa: BLE001
                print(f"  conta {conta}: {e}")
            time.sleep(1.2)
    falhas_arq = Path(a.falhas)
    try:
        falhas = json.loads(falhas_arq.read_text()) if falhas_arq.exists() else {}
    except json.JSONDecodeError:
        falhas = {}
    falhas = falhas if isinstance(falhas, dict) else {}
    fila = montar_fila(pedidos_ids, sorted(recentes, reverse=True), sorted(antigos, reverse=True), feitos, falhas, so_pedidos=a.so_pedidos)
    print(f"Fila: {fila}" + (f" (pedidos do site: {pedidos_ids})" if pedidos_ids else ""))
    if a.so_fila:
        saida_gh = os.environ.get("GITHUB_OUTPUT")
        if saida_gh:
            with open(saida_gh, "a") as fh:
                fh.write(f"fila={len(fila)}\n")
                fh.write(f"pedidos={len(pendentes)}\n")
        return 0
    # pedido de mapa que já existe (alguém pediu de novo enquanto o robô trabalhava): só limpa
    for mid in pedidos_ids:
        if mid in feitos:
            (pedidos / str(mid)).unlink(missing_ok=True)
    tmp = Path("/tmp/replays")
    tmp.mkdir(exist_ok=True)
    feitos_agora = 0
    espera_resta = ESPERA_REPLAY_RODADA_S
    for mid in fila[: a.maximo]:
        pedido = mid in pedidos_ids
        if pedido:
            falhas.pop(str(mid), None)  # pedido novo: a partida ganha todas as tentativas de novo
        t_ini = time.time()
        try:
            if pedido:
                dados = processar(mid, a.parser, tmp, amigos=amigos, espera_replay_s=min(ESPERA_REPLAY_S, espera_resta))
            else:
                dados = processar(mid, a.parser, tmp)
            (saida / f"{mid}.json").write_text(json.dumps(dados, separators=(",", ":")))
            feitos_agora += 1
            falhas.pop(str(mid), None)
            print(f"OK {mid}")
        except Exception as e:  # noqa: BLE001
            print(f"FALHOU {mid}: {e}")
            motivo = motivo_da_falha(e)
            falhas[str(mid)] = {"n": n_falhas(falhas.get(str(mid))) + 1, "motivo": motivo, "quando": agora_iso()}
            if motivo != "sem amigos":
                try:  # pede a análise ao OpenDota para a próxima rodada ter replay_url
                    post(f"/request/{mid}")
                except Exception:  # noqa: BLE001
                    pass
        if pedido:
            espera_resta = max(0, espera_resta - (time.time() - t_ini))
        # o pedido foi atendido (com mapa ou com o motivo em falhas.json): o site pede de novo se quiser
        if pedido:
            (pedidos / str(mid)).unlink(missing_ok=True)
    if not a.so_pedidos:
        # o formato antigo só sai quando a lista das contas veio (senão toda partida pareceria "fora da fila")
        falhas = limpar_falhas(falhas, [*pedidos_ids, *recentes, *antigos], antigas_tambem=contas_ok > 0)
    falhas_arq.parent.mkdir(parents=True, exist_ok=True)
    falhas_arq.write_text(json.dumps(falhas, indent=0, sort_keys=True, ensure_ascii=False) + "\n")
    print(f"{feitos_agora} mapas novos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
