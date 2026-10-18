#!/usr/bin/env python3
"""
Gera meta/meta.json com o meta atual de Dota na faixa de rank do grupo (OpenDota /heroStats): heróis mais fortes,
mais escolhidos, mais fracos, o que os pros estão pegando, os que estão subindo desde a semana passada e a build
mais comprada (itemPopularity) de cada herói forte. Só biblioteca padrão.

Uso:
  python3 meta/meta.py            # OPENDOTA_API_KEY opcional no ambiente
"""

import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / 'meta' / 'meta.json'
API = 'https://api.opendota.com/api'
FAIXAS = {4: 'Archon', 5: 'Legend', 6: 'Ancient'}   # onde o grupo joga (rank_tier das partidas guardadas)
MIN_FATIA_PICKS = 0.35   # herói precisa de pelo menos 35% dos picks do herói mediano pra entrar nas listas
TOP = 12
HEROIS_COM_BUILD = 12
ITENS_POR_FASE = 4
DIAS_COMPARACAO = 7
HISTORICO_MAX = 21
# consumíveis e itens de visão não dizem nada da build
IGNORAR = re.compile(r'^(tango|clarity|flask|faerie_fire|enchanted_mango|ward_|tpscroll|smoke_of_deceit|dust|'
                     r'blood_grenade|recipe_|famango|great_famango|greater_famango|cheese|refresher_shard|aegis|'
                     r'tome_of_knowledge|ward_dispenser|branches)')


def pedir(caminho):
    chave = os.environ.get('OPENDOTA_API_KEY')
    url = f'{API}{caminho}' + (f'{"&" if "?" in caminho else "?"}api_key={chave}' if chave else '')
    for tentativa in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'culpado-dota2-meta/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f'  {caminho}: {e}', file=sys.stderr)
            time.sleep(2 * (tentativa + 1))
    return None


def constantes():
    html = (RAIZ / 'index.html').read_text(encoding='utf-8')
    m = re.search(r'<script type="application/json" id="dados-embutidos">([\s\S]*?)</script>', html)
    c = json.loads(m.group(1))['constantes']
    # como o painel (expandirConstantes): o id dos itens comuns está na própria entrada; "ids" só tem o resto
    ids = dict(c['ids'])
    for chave, v in c['i'].items():
        if isinstance(v, list) and v and v[0] is not None:
            ids.setdefault(str(v[0]), chave)
    return c['h'], c['i'], ids


def main():
    herois, itens, ids_itens = constantes()
    stats = pedir('/heroStats')
    if not isinstance(stats, list) or not stats:
        print('heroStats não respondeu; meta.json fica como está.', file=sys.stderr)
        sys.exit(1)

    lista = []
    for h in stats:
        picks = sum(h.get(f'{f}_pick') or 0 for f in FAIXAS)
        vitorias = sum(h.get(f'{f}_win') or 0 for f in FAIXAS)
        if not picks:
            continue
        hid = str(h['id'])
        lista.append({
            'id': h['id'], 'nome': (herois.get(hid) or [None, h.get('localized_name')])[1] or h.get('localized_name'),
            'slug': (herois.get(hid) or [h.get('name', '').replace('npc_dota_hero_', '')])[0],
            'funcoes': h.get('roles') or [], 'picks': picks, 'winRate': round(100 * vitorias / picks, 1),
            'proPicks': h.get('pro_pick') or 0, 'proWinRate': round(100 * (h.get('pro_win') or 0) / h['pro_pick'], 1) if h.get('pro_pick') else None,
        })
    total = sum(x['picks'] for x in lista) / 10   # 10 heróis por partida
    for x in lista:
        x['pickRate'] = round(100 * x['picks'] / total, 1)
    mediana = sorted(x['picks'] for x in lista)[len(lista) // 2]
    validos = [x for x in lista if x['picks'] >= MIN_FATIA_PICKS * mediana]

    # tendência: win rate de agora contra a foto mais antiga dentro da janela (até ~7 dias atrás)
    anterior = json.loads(DESTINO.read_text(encoding='utf-8')) if DESTINO.exists() else {}
    historico = [f for f in anterior.get('historico', []) if f.get('quando')]
    agora = time.time()
    base = next((f for f in historico if agora - f['quando'] <= (DIAS_COMPARACAO + 1) * 86400), None)
    for x in validos:
        antes = base and base['wr'].get(str(x['id']))
        x['variacao'] = round(x['winRate'] - antes, 1) if antes is not None and agora - base['quando'] >= 2 * 86400 else None
    historico = ([f for f in historico if agora - f['quando'] <= HISTORICO_MAX * 86400]
                 + [{'quando': int(agora), 'wr': {str(x['id']): x['winRate'] for x in validos}}])
    historico = [f for i, f in enumerate(historico) if i == len(historico) - 1 or historico[i + 1]['quando'] - f['quando'] >= 20 * 3600]

    fortes = sorted(validos, key=lambda x: -x['winRate'])[:TOP]
    fracos = sorted(validos, key=lambda x: x['winRate'])[:6]
    populares = sorted(validos, key=lambda x: -x['picks'])[:8]
    pros = sorted((x for x in lista if x['proPicks']), key=lambda x: -x['proPicks'])[:8]
    subindo = sorted((x for x in validos if x['variacao'] and x['variacao'] > 0), key=lambda x: -x['variacao'])[:6]

    # neutros e habilidades vêm com custo 0: na build só entra o que se compra na loja
    compravel = lambda k: isinstance(itens.get(k), list) and (itens[k][2] or 0) > 0
    builds = {}
    for x in fortes[:HEROIS_COM_BUILD]:
        pop = pedir(f'/heroes/{x["id"]}/itemPopularity')
        time.sleep(1.1)
        if not isinstance(pop, dict):
            continue
        fases = {}
        for fase, chave in (('inicio', 'start_game_items'), ('cedo', 'early_game_items'),
                            ('meio', 'mid_game_items'), ('tarde', 'late_game_items')):
            contagem = pop.get(chave) or {}
            chaves = [ids_itens.get(str(i)) for i, _ in sorted(contagem.items(), key=lambda kv: -kv[1])]
            fases[fase] = [k for k in chaves if k and not IGNORAR.match(k) and compravel(k)][:ITENS_POR_FASE]
        builds[str(x['id'])] = fases

    usados = {k for b in builds.values() for f in b.values() for k in f}
    patch = pedir('/constants/patch')
    saida = {
        'atualizadoEm': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'fonte': 'OpenDota (/heroStats e /itemPopularity)',
        'patch': patch[-1]['name'] if isinstance(patch, list) and patch else None,
        'faixa': f'{FAIXAS[min(FAIXAS)]} a {FAIXAS[max(FAIXAS)]}',
        'partidas': round(total),
        'fortes': fortes, 'fracos': fracos, 'populares': populares, 'pros': pros, 'subindo': subindo,
        'builds': builds,
        'itens': {k: (itens.get(k) or [None, k])[1] for k in sorted(usados)},
        'historico': historico,
    }
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(saida, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{DESTINO}: patch {saida["patch"]}, {len(validos)} heróis, {len(builds)} builds, '
          f'{"com" if subindo else "sem"} tendência')


if __name__ == '__main__':
    main()
