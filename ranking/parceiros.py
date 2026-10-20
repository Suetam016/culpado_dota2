#!/usr/bin/env python3
"""
Gera amigos/parceiros.json: para cada dupla de amigos (amigos.json do site) que jogou do mesmo lado, a win rate da
dupla, as combinações de posição (rota) e as duplas de heróis. Lê as partidas que o robô de coleta guarda no branch
órfão "dados" (partidas/<id>.json.gz, resposta crua do OpenDota). Só biblioteca padrão.

Uso:
  git clone --branch dados --single-branch https://github.com/Suetam016/culpado_dota2 dados
  python3 ranking/parceiros.py --dados dados [--recentes .recentes] [--dias 365]
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


MIN_JOGOS_FORMACAO = 2
PARTIDAS_POR_GRUPO = 8
LOBBY_RANQUEADA = 7
MINUTO_LANE = 10         # a lane é julgada pelo ouro + XP de cada lado nesse minuto
EMPATE_LANE = 0.08       # diferença relativa abaixo disso é lane empatada


def lane_de(match, p):
    """(rota física, resultado da lane do lado de p: 1 ganhou, 0 empate, -1 perdeu) ou (None, None)."""
    lane = p.get('lane')
    if not lane or p.get('lane_role') == 4 or p.get('is_roaming'):
        return None, None

    def valor(q):
        ouro, xp = q.get('networth_t') or q.get('gold_t') or [], q.get('xp_t') or []
        return ouro[MINUTO_LANE] + xp[MINUTO_LANE] if len(ouro) > MINUTO_LANE and len(xp) > MINUTO_LANE else None

    nossos, deles = [], []
    for q in match['players']:
        if q.get('lane') != lane or q.get('lane_role') == 4 or q.get('is_roaming'):
            continue
        v = valor(q)
        if v is None:
            return lane, None
        (nossos if q.get('isRadiant') == p.get('isRadiant') else deles).append(v)
    if not nossos or not deles:
        return lane, None
    # média por herói: 2 contra 1 não vira vitória automática
    a, b = sum(nossos) / len(nossos), sum(deles) / len(deles)
    dif = (a - b) / max(a, b, 1)
    return lane, (1 if dif > EMPATE_LANE else -1 if dif < -EMPATE_LANE else 0)


def dados_herois():
    """id -> [slug da imagem, nome]"""
    html = (RAIZ / 'index.html').read_text(encoding='utf-8')
    m = re.search(r'<script type="application/json" id="dados-embutidos">([\s\S]*?)</script>', html)
    return {int(k): [v[0], v[1]] for k, v in json.loads(m.group(1))['constantes']['h'].items()}


def wr(v, j):
    return round(100 * v / j) if j else 0


def resumir(contagens, minimo, rotulo):
    """{chave: [jogos, vitorias]} -> lista ordenada por win rate (desempate: mais jogos)."""
    itens = [dict(rotulo(k), jogos=j, vitorias=v, winRate=wr(v, j)) for k, (j, v) in contagens.items() if j >= minimo]
    itens.sort(key=lambda x: (-x['winRate'], -x['jogos']))
    return itens


def ficha_time_fechado(match, radiant, doLado):
    """Resumo de uma partida de time fechado (os 5 do lado são amigos), do ponto de vista do grupo."""
    sinal = 1 if radiant else -1
    vant = [sinal * v for v in (match.get('radiant_gold_adv') or [])]
    eles = [p for p in match['players'] if p.get('isRadiant') != radiant]
    soma = lambda ps, k: sum(p.get(k) or 0 for p in ps)
    lanes = {}
    for p in doLado:
        lane, res = lane_de(match, p)
        if lane and res is not None:
            lanes[lane] = res
    return {
        'id': match.get('match_id'), 't': match['start_time'], 'v': int(match.get('radiant_win') == radiant),
        'dur': match.get('duration'),
        'nos': [[str(p['account_id']), p.get('hero_id') or 0, p.get('position_est') or 0,
                 p.get('kills'), p.get('deaths'), p.get('assists'), p.get('gold_per_min')] for p in doLado],
        'eles': [p.get('hero_id') or 0 for p in eles],
        'ouro': {str(m): vant[m] for m in (10, 20, 30) if len(vant) > m},
        'maior': max(vant) if vant else None, 'menor': min(vant) if vant else None,
        'abates': [soma(doLado, 'kills'), soma(eles, 'kills')],
        'torres': [soma(doLado, 'towers_killed'), soma(eles, 'towers_killed')] if any('towers_killed' in p for p in doLado) else None,
        'roshans': [soma(doLado, 'roshans_killed'), soma(eles, 'roshans_killed')] if any('roshans_killed' in p for p in doLado) else None,
        'lanes': sorted(lanes.values(), reverse=True),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dados', required=True, help='pasta com o branch "dados" (tem partidas/)')
    ap.add_argument('--dias', type=int, default=365, help='só partidas desse período (0 = todas)')
    ap.add_argument('--recentes', help='pasta com <id>.json que o gerar.js acabou de baixar (entram as que a coleta ainda não tem)')
    args = ap.parse_args()

    amigos = {int(k): v for k, v in json.loads((RAIZ / 'amigos.json').read_text(encoding='utf-8')).items()}
    herois = dados_herois()
    desde = time.time() - args.dias * 86400 if args.dias else 0
    usados = set()

    # grupo de 3+ amigos do mesmo lado (tupla de contas ordenada) -> estatísticas
    grupos = defaultdict(lambda: {'jogos': 0, 'vitorias': 0, 'formacoes': defaultdict(lambda: [0, 0]), 'partidas': [],
                                  'herois': defaultdict(lambda: defaultdict(lambda: [0, 0]))})
    # conta -> (herói, posição) -> [jogos, vitórias], em qualquer partida (solo ou com amigos): base da sugestão de picks
    pool = defaultdict(lambda: defaultdict(lambda: [0, 0]))

    # (a, b) com a < b -> estatísticas
    pares = defaultdict(lambda: {'jogos': 0, 'vitorias': 0, 'rotas': defaultdict(lambda: [0, 0]),
                                 'herois': defaultdict(lambda: [0, 0]), 'partidas': []})
    individuais = defaultdict(lambda: [0, 0])  # conta -> [jogos, vitorias], só partidas com outro amigo do lado
    lidas = 0
    inicio_mais_antigo = None
    # cada lado de partida com 1+ amigo: a página recalcula tudo isso para o período escolhido
    jogos = []
    time_fechado = []  # partidas com 5 amigos do mesmo lado: ficha completa para o raio-x da página
    medalhas = {}  # conta -> (início, rank_tier) da partida mais nova: o OpenDota grava a medalha atual do jogador

    def partidas():
        vistas = {}
        for arq in sorted(Path(args.dados, 'partidas').glob('*.json.gz')):
            vistas[arq.name.split('.')[0]] = (arq, gzip.open)
        if args.recentes and Path(args.recentes).is_dir():
            for arq in sorted(Path(args.recentes).glob('*.json')):
                mid = arq.stem
                # a da coleta já vem analisada; a recente só entra se a coleta não tem a partida
                if mid not in vistas:
                    vistas[mid] = (arq, open)
        for mid, (arq, abrir) in vistas.items():
            try:
                with abrir(arq, 'rb') as f:
                    yield json.loads(f.read())
            except Exception as e:
                print(f'{arq.name}: ilegível ({e})', file=sys.stderr)

    for match in partidas():
        if (match.get('start_time') or 0) < desde or not match.get('players'):
            continue
        lidas += 1
        for radiant in (True, False):
            doLado = [p for p in match['players'] if p.get('account_id') in amigos and p.get('isRadiant') == radiant]
            if doLado:
                jogos.append({'id': match.get('match_id'), 't': match['start_time'], 'v': int(match.get('radiant_win') == radiant),
                              'r': int(match.get('lobby_type') == LOBBY_RANQUEADA),
                              'j': [[str(p['account_id']), p.get('hero_id') or 0, p.get('position_est') or 0, *lane_de(match, p)]
                                    for p in doLado]})
                for p in doLado:
                    if p.get('rank_tier'):
                        medalhas[str(p['account_id'])] = max(medalhas.get(str(p['account_id']), (0, 0)), (match['start_time'], p['rank_tier']))
            if len(doLado) == 5:
                time_fechado.append(ficha_time_fechado(match, radiant, doLado))
                usados.update(p['hero_id'] for p in match['players'] if p.get('hero_id'))
            for p in doLado:
                if p.get('hero_id'):
                    chave = (p['hero_id'], p.get('position_est') or 0)
                    pool[p['account_id']][chave][0] += 1
                    pool[p['account_id']][chave][1] += match.get('radiant_win') == radiant
                    usados.add(p['hero_id'])
            if len(doLado) < 2:
                continue
            inicio_mais_antigo = min(inicio_mais_antigo or match['start_time'], match['start_time'])
            venceu = match.get('radiant_win') == radiant
            for p in doLado:
                individuais[p['account_id']][0] += 1
                individuais[p['account_id']][1] += venceu
                if p.get('hero_id'):
                    usados.add(p['hero_id'])
            if len(doLado) >= 3:
                ordenados = sorted(doLado, key=lambda x: x['account_id'])
                grupo = grupos[tuple(p['account_id'] for p in ordenados)]
                grupo['jogos'] += 1
                grupo['vitorias'] += venceu
                posicoes = tuple(p.get('position_est') for p in ordenados)
                if all(posicoes):
                    grupo['formacoes'][posicoes][0] += 1
                    grupo['formacoes'][posicoes][1] += venceu
                for p in ordenados:
                    if p.get('hero_id'):
                        grupo['herois'][p['account_id']][p['hero_id']][0] += 1
                        grupo['herois'][p['account_id']][p['hero_id']][1] += venceu
                grupo['partidas'].append({
                    'matchId': match.get('match_id'), 'inicio': match['start_time'], 'venceu': venceu,
                    'herois': {str(p['account_id']): {'heroi': p.get('hero_id'), 'pos': p.get('position_est')}
                               for p in ordenados},
                })
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
                    par['partidas'].append({'matchId': match.get('match_id'), 'inicio': match['start_time'],
                                            'venceu': venceu, 'heroiA': hp, 'heroiB': hq, 'posA': pp, 'posB': pq})

    saida = []
    for (a, b), par in pares.items():
        rotas = resumir(par['rotas'], MIN_JOGOS_ROTA, lambda k: {'posA': k[0], 'posB': k[1]})
        duplas = resumir(par['herois'], MIN_JOGOS_HEROIS, lambda k: {'heroiA': k[0], 'heroiB': k[1]})
        saida.append({
            'a': str(a), 'b': str(b), 'nomeA': amigos[a], 'nomeB': amigos[b],
            'jogos': par['jogos'], 'vitorias': par['vitorias'], 'winRate': wr(par['vitorias'], par['jogos']),
            'rotas': rotas[:TOP],
            'rotasPiores': [r for r in rotas[::-1] if r['winRate'] < 50][:3],
            'herois': [h for h in duplas if h['winRate'] > 50][:TOP],
            'heroisPiores': [h for h in duplas[::-1] if h['winRate'] < 50][:3],
            'partidas': sorted(par['partidas'], key=lambda x: -x['inicio'])[:PARTIDAS_POR_GRUPO],
        })
    saida.sort(key=lambda x: (-x['winRate'], -x['jogos']))

    composicoes = []
    for membros, g in grupos.items():
        formacoes = resumir(g['formacoes'], MIN_JOGOS_FORMACAO,
                            lambda k, m=membros: {'posicoes': {str(c): pos for c, pos in zip(m, k)}})
        partidas = sorted(g['partidas'], key=lambda x: -x['inicio'])[:PARTIDAS_POR_GRUPO]
        composicoes.append({
            'membros': [str(c) for c in membros],
            'herois': {str(c): resumir(g['herois'][c], 1, lambda k: {'heroi': k})[:3] for c in membros},
            'jogos': g['jogos'], 'vitorias': g['vitorias'], 'winRate': wr(g['vitorias'], g['jogos']),
            'formacoes': formacoes[:3],
            'partidas': partidas,
        })
    composicoes.sort(key=lambda x: (-x['winRate'], -x['jogos']))

    destino = RAIZ / 'amigos' / 'parceiros.json'
    novo = {
        'desde': time.strftime('%Y-%m-%d', time.gmtime(inicio_mais_antigo)) if inicio_mais_antigo else None,
        'partidasLidas': lidas,
        'jogadores': {str(k): {'nome': amigos[k], 'jogos': j, 'vitorias': v, 'winRate': wr(v, j)}
                      for k, (j, v) in individuais.items()},
        'pares': saida,
        'composicoes': composicoes,
        'pool': {str(c): sorted(({'heroi': h, 'pos': pos, 'jogos': j, 'vitorias': v} for (h, pos), (j, v) in hs.items()),
                                key=lambda x: (-x['jogos'], -x['vitorias']))
                 for c, hs in pool.items()},
        'herois': {str(h): herois.get(h, [None, f'#{h}']) for h in sorted(usados)},
        'nomes': {str(k): v for k, v in amigos.items()},
        'jogos': sorted(jogos, key=lambda x: x['t']),
        'medalhas': {c: m[1] for c, m in medalhas.items()},
        'timeFechado': sorted(time_fechado, key=lambda x: x['t']),
    }
    # roda depois de toda coleta: só regrava (e só gera commit) se algo mudou de verdade
    try:
        velho = json.loads(destino.read_text(encoding='utf-8'))
        velho.pop('atualizadoEm', None)
    except (OSError, ValueError):
        velho = None
    if velho == json.loads(json.dumps(novo, ensure_ascii=False)):
        print(f'{destino}: nada mudou')
        return
    destino.write_text(json.dumps({'atualizadoEm': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), **novo},
                                  ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{destino}: {len(saida)} duplas, {len(composicoes)} composições, {lidas} partidas lidas')


if __name__ == '__main__':
    main()
