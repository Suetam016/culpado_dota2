"""Sons das skills para o mapa animado: baixa da wiki de Dota (Fandom, com Liquipedia de reserva).

Para cada ultimate e skill de impacto que aparece em mapas/*.json, procura pelo nome em inglês
(o "dname" do OpenDota, ex.: "Black Hole") um arquivo de áudio com esse prefixo na wiki
(API MediaWiki, list=allimages) e salva em sons/<chave>.mp3. O índice sons/indice.json diz ao site
quais sons existem. Os sons são da Valve; uso de fã, sem fins comerciais.

    python sons/baixar.py
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "culpado-dota2-sons/1.0 (site de fã sem fins comerciais; github.com/Suetam016/culpado_dota2)"
WIKIS = ["https://dota2.fandom.com/api.php", "https://liquipedia.net/dota2/api.php"]
PAUSA = 2.1
MAX_BYTES = 450_000
IMPACTO = {
    "mirana_arrow", "pudge_meat_hook", "earth_spirit_boulder_smash", "earth_spirit_rolling_boulder",
    "earth_spirit_geomagnetic_grip", "windrunner_powershot", "windrunner_shackleshot", "lion_impale", "nyx_assassin_impale",
    "lina_light_strike_array", "invoker_sun_strike", "invoker_chaos_meteor", "kunkka_torrent", "kunkka_ghostship",
    "sniper_assassinate", "ancient_apparition_ice_blast", "magnataur_skewer", "spirit_breaker_charge_of_darkness",
    "tusk_snowball", "tusk_walrus_punch", "phoenix_icarus_dive", "batrider_flaming_lasso", "vengefulspirit_magic_missile",
    "sven_storm_bolt", "skywrath_mage_mystic_flare", "legion_commander_overwhelming_odds", "slardar_slithereen_crush",
    "tiny_toss", "tiny_avalanche", "rattletrap_hookshot", "elder_titan_echo_stomp", "centaur_hoof_stomp",
    "earthshaker_fissure", "earthshaker_echo_slam", "sand_king_burrowstrike", "ember_spirit_sleight_of_fist",
    "dark_willow_bramble_maze", "venomancer_venomous_gale", "bane_nightmare", "shadow_shaman_shackles",
    "queenofpain_sonic_wave", "death_prophet_carrion_swarm", "leshrac_split_earth", "puck_dream_coil", "zuus_lightning_bolt",
    "storm_spirit_ball_lightning", "chaos_knight_chaos_bolt", "snapfire_mortimer_kisses", "hoodwink_sharpshooter",
    "marci_grapple", "primal_beast_onslaught", "primal_beast_pulverize", "muerta_dead_shot",
}
ITENS = {"black_king_bar", "blink", "refresher", "sheepstick", "smoke_of_deceit", "tpscroll"}
# preferência entre os arquivos achados: o som do "cast" primeiro, loop/fim por último
ORDEM = [r"^{n}\.(mp3|ogg|wav)$", r"^{n}[_ ]cast", r"^{n}[_ ](start|launch|impact|target|hit)", r"^{n}\b", r"^{n}"]


def get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def candidatos(wiki: str, nome: str) -> list[dict]:
    q = urllib.parse.urlencode({"action": "query", "list": "allimages", "aiprefix": nome.replace(" ", "_"),
                                "aiprop": "url|size|mime", "ailimit": 50, "format": "json"})
    dados = json.loads(get(f"{wiki}?{q}"))
    return [x for x in dados.get("query", {}).get("allimages", []) if str(x.get("mime", "")).startswith("audio/")]


def escolher(arquivos: list[dict], nome: str) -> dict | None:
    n = re.escape(nome.replace(" ", "_"))
    ruins = re.compile(r"(loop|end|_off|response|voice)", re.I)
    for padrao in ORDEM:
        rx = re.compile(padrao.format(n=n), re.I)
        ok = [a for a in arquivos if rx.search(a["name"].replace(" ", "_")) and not ruins.search(a["name"]) and a.get("size", 0) <= MAX_BYTES]
        if ok:
            return sorted(ok, key=lambda a: (len(a["name"]), a.get("size", 0)))[0]
    return None


def main() -> int:
    raiz = Path(__file__).resolve().parent
    indice_arq = raiz / "indice.json"
    indice = json.loads(indice_arq.read_text()) if indice_arq.exists() else {}
    tentados_arq = raiz / "tentados.json"
    tentados = json.loads(tentados_arq.read_text()) if tentados_arq.exists() else {}
    querer = {}
    for m in sorted((raiz.parent / "mapas").glob("*.json")):
        for chave, nome, tipo in json.loads(m.read_text()).get("hab") or []:
            if tipo == "u" or chave in IMPACTO or (tipo == "i" and chave in ITENS):
                querer[chave] = nome
    faltam = {k: n for k, n in querer.items() if k not in indice and tentados.get(k, 0) < 2}
    print(f"{len(querer)} skills com som desejado; {len(indice)} já baixadas; {len(faltam)} para procurar")
    novos = 0
    for chave, nome in sorted(faltam.items()):
        achado = None
        for wiki in WIKIS:
            try:
                arquivos = candidatos(wiki, nome)
            except Exception as e:  # noqa: BLE001
                print(f"  {chave}: {wiki} falhou ({e})")
                arquivos = []
            time.sleep(PAUSA)
            achado = escolher(arquivos, nome)
            if achado:
                break
            if arquivos:
                print(f"  {chave}: nenhum bom entre {[a['name'] for a in arquivos][:6]}")
        if not achado:
            tentados[chave] = tentados.get(chave, 0) + 1
            print(f"  {chave} ({nome}): sem som")
            continue
        try:
            corpo = get(achado["url"])
        except Exception as e:  # noqa: BLE001
            print(f"  {chave}: download falhou ({e})")
            tentados[chave] = tentados.get(chave, 0) + 1
            continue
        ext = Path(urllib.parse.urlparse(achado["url"]).path.split("/revision")[0]).suffix.lower() or ".mp3"
        destino = raiz / f"{chave}{ext}"
        destino.write_bytes(corpo)
        indice[chave] = destino.name
        novos += 1
        print(f"  OK {chave}: {achado['name']} ({len(corpo) // 1024} KB)")
        time.sleep(PAUSA)
    indice_arq.write_text(json.dumps(dict(sorted(indice.items())), indent=0, ensure_ascii=False) + "\n")
    tentados_arq.write_text(json.dumps(dict(sorted(tentados.items())), indent=0) + "\n")
    print(f"{novos} sons novos; {len(indice)} no total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
