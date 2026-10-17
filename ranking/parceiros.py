#!/usr/bin/env python3
"""
Gera amigos/parceiros.json: para cada dupla de amigos (amigos.json do site) que jogou do mesmo lado, a win rate da
dupla, as combinações de posição (rota) e as duplas de heróis. Lê as partidas que o robô de coleta guarda no branch
órfão "dados" (partidas/<id>.json.gz, resposta crua do OpenDota). Só biblioteca padrão.

Uso:
  git clone --branch dados --single-branch https://github.com/Suetam016/culpado_dota2 dados
  python3 ranking/parceiros.py --dados dados [--dias 365]
"""

import argparse
import gzip
import json
import re
import sys
import time
from collections import defaultdict
from itertools import combinations
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MIN_JOGOS_ROTA = 2     # combinação de posição só entra com pelo menos isso de partidas
MIN_JOGOS_HEROIS = 2   # dupla de heróis idem
TOP = 5                # quantas combinações guardar por dupla (melhores e piores)


def nomes_herois():
    html = (RAIZ / 'index.html').read_text(encoding='utf-8')
    m = re.search(r'<script type="application/json" id="dados-embutidos">([\s\S]*?)</script>', html)
    return {int(k): v[1] for k, v in json.loads(m.group(1))['constantes']['h'].items()}


def wr(v, j):
    return round(100 * v / j) if j else 0


def resumir(contagens, minimo, rotulo):
    """{chave: [jogos, vitorias]} -> lista ordenada por win rate (desempate: mais jogos)."""
    itens = [dict(rotulo(k), jogos=j, vitorias=v, winRate=wr(v, j)) for k, (j, v) in contagens.items() if j >= minimo]
    itens.sort(key=lambda x: (-x['winRate'], -x['jogos']))
    return itens


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dados', required=True, help='pasta com o branch "dados" (tem partidas/)')
    ap.add_argument('--dias', type=int, default=365, help='só partidas desse período (0 = todas)')
    args = ap.parse_args()

    amigos = {int(k): v for k, v in json.loads((RAIZ / 'amigos.json').read_text(encoding='utf-8')).items()}
    herois = nomes_herois()
    desde = time.time() - args.dias * 86400 if args.dias else 0

    # (a, b) com a < b -> estatísticas
    pares = defaultdict(lambda: {'jogos': 0, 'vitorias': 0, 'rotas': defaultdict(lambda: [0, 0]),
                                 'herois': defaultdict(lambda: [0, 0])})
    individuais = defaultdict(lambda: [0, 0])  # conta -> [jogos, vitorias], só partidas com outro amigo do lado
    lidas = 0
    inicio_mais_antigo = None

    for arq in sorted(Path(args.dados, 'partidas').glob('*.json.gz')):
        try:
            match = json.loads(gzip.open(arq).read())
        except Exception as e:
            print(f'{arq.name}: ilegível ({e})', file=sys.stderr)
            continue
        if (match.get('start_time') or 0) < desde or not match.get('players'):
            continue
        lidas += 1
        for radiant in (True, False):
            doLado = [p for p in match['players'] if p.get('account_id') in amigos and p.get('isRadiant') == radiant]
            if len(doLado) < 2:
                continue
            inicio_mais_antigo = min(inicio_mais_antigo or match['start_time'], match['start_time'])
            venceu = match.get('radiant_win') == radiant
            for p in doLado:
                individuais[p['account_id']][0] += 1
                individuais[p['account_id']][1] += venceu
            for p, q in combinations(sorted(doLado, key=lambda x: x['account_id']), 2):
                par = pares[(p['account_id'], q['account_id'])]
                par['jogos'] += 1
                par['vitorias'] += venceu
                pp, pq = p.get('position_est'), q.get('position_est')
                if pp and pq:
                    par['rotas'][(pp, pq)][0] += 1
                    par['rotas'][(pp, pq)][1] += venceu
                hp, hq = p.get('hero_id'), q.get('hero_id')
                if hp and hq:
                    par['herois'][(hp, hq)][0] += 1
                    par['herois'][(hp, hq)][1] += venceu

    saida = []
    for (a, b), par in pares.items():
        rotas = resumir(par['rotas'], MIN_JOGOS_ROTA, lambda k: {'posA': k[0], 'posB': k[1]})
        duplas = resumir(par['herois'], MIN_JOGOS_HEROIS,
                         lambda k: {'heroiA': herois.get(k[0], f'#{k[0]}'), 'heroiB': herois.get(k[1], f'#{k[1]}')})
        saida.append({
            'a': str(a), 'b': str(b), 'nomeA': amigos[a], 'nomeB': amigos[b],
            'jogos': par['jogos'], 'vitorias': par['vitorias'], 'winRate': wr(par['vitorias'], par['jogos']),
            'rotas': rotas[:TOP],
            'rotasPiores': [r for r in rotas[::-1] if r['winRate'] < 50][:3],
            'herois': [h for h in duplas if h['winRate'] > 50][:TOP],
            'heroisPiores': [h for h in duplas[::-1] if h['winRate'] < 50][:3],
        })
    saida.sort(key=lambda x: (-x['winRate'], -x['jogos']))

    destino = RAIZ / 'amigos' / 'parceiros.json'
    destino.write_text(json.dumps({
        'atualizadoEm': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'desde': time.strftime('%Y-%m-%d', time.gmtime(inicio_mais_antigo)) if inicio_mais_antigo else None,
        'partidasLidas': lidas,
        'jogadores': {str(k): {'nome': amigos[k], 'jogos': j, 'vitorias': v, 'winRate': wr(v, j)}
                      for k, (j, v) in individuais.items()},
        'pares': saida,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{destino}: {len(saida)} duplas, {lidas} partidas lidas')


if __name__ == '__main__':
    main()
