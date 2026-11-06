#!/usr/bin/env python3
"""
Gera meta/posicao.json: farm e build de cada herói NA POSIÇÃO em que jogou, a partir das partidas analisadas que
a coleta guarda no branch "dados" (partidas/<id>.json.gz: as do grupo e as dos adversários, na faixa de rank de
vocês). O painel usa para comparar o farm só com quem jogou na mesma posição (antes era com todas as posições) e
para ler a build pelo que se compra naquela posição.

A posição é a mesma da base de rotas (rotas/gerar.py: atribuir_posicoes), que segue a regra do painel.

Saída (só biblioteca padrão):
  {"v": 1, "gerado": ..., "partidas": N, "min_n": 15, "q": [5, 10, 20, ..., 90, 95],
   "farm": {"p": {"1": {"n": .., "gpm": [quantis], "lh10": [..], "nw20": [..]}, ...},
            "h": {"<hero_id>.<pos>": {mesmo formato, só com min_n+ jogos}}},
   "build": {"h": {"<hero_id>.<pos>": {"n": .., "i": [[item, % dos jogos, minuto médio, ordem média], ...]}}}}

  gpm  = ouro por minuto no fim; lh10 = last hits aos 10 min; nw20 = ouro ganho até os 20 min (gold_t[20]).
  Build: os itens grandes (montados ou de 1400+ de ouro, sem consumível nem peça pura como Yasha ou Eagle) na ordem em que saíram, a primeira compra de
  cada um; "ordem" é a posição dele entre os itens grandes (0 = o primeiro).

Uso:
  python3 meta/posicao.py --dados .dados          # pasta com o checkout do branch dados
"""

import argparse
import gzip
import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / 'rotas'))
import gerar as rotas  # noqa: E402  (atribuir_posicoes, valida, jogadores_da_partida)

DESTINO = RAIZ / 'meta' / 'posicao.json'
Q = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95]
MIN_N = 15          # herói na posição precisa de 15+ jogos para ter quantis próprios (senão o painel usa a posição)
MIN_N_BUILD = 10
ITENS_POR_HEROI = 14
CUSTO_GRANDE = 1400
# montados, mas quase sempre viram outro item: contam como degrau, não como item da build
INTERMEDIARIOS = {'yasha', 'sange', 'kaya', 'pers', 'lesser_crit', 'oblivion_staff', 'ultimate_scepter_2', 'diffusal_blade_2',
                  'wraith_pact', 'cornucopia'}
RANK_MAX = 99       # a base já é da faixa do grupo: não corta rank
IGNORAR = re.compile(r'^(tango|clarity|flask|faerie_fire|enchanted_mango|ward_|tpscroll|smoke_of_deceit|dust|'
                     r'blood_grenade|recipe_|famango|great_famango|greater_famango|cheese|refresher_shard|aegis|'
                     r'tome_of_knowledge|ward_dispenser|branches|boots$|travel_boots)')


def itens_grandes():
    html = (RAIZ / 'index.html').read_text(encoding='utf-8')
    m = re.search(r'<script type="application/json" id="dados-embutidos">([\s\S]*?)</script>', html)
    itens = json.loads(m.group(1))['constantes']['i']
    componentes = {c for v in itens.values() if isinstance(v, list) and len(v) > 3 and isinstance(v[3], list) for c in v[3]}
    out = set()
    for chave, v in itens.items():
        if not isinstance(v, list) or len(v) < 3 or IGNORAR.match(chave):
            continue
        custo = v[2] or 0
        montado = len(v) > 3 and isinstance(v[3], list) and len(v[3]) > 0
        if chave in INTERMEDIARIOS or (chave in componentes and not montado):
            continue  # peça pura (Yasha, Eagle, Mithril...): é degrau para outro item, não diz a build
        if custo >= CUSTO_GRANDE or (montado and custo >= 1000):
            out.add(chave)
    return out


def quantis(xs):
    xs = sorted(xs)
    n = len(xs)
    out = []
    for q in Q:
        pos = (n - 1) * q / 100
        a = int(pos)
        b = min(a + 1, n - 1)
        out.append(round(xs[a] + (xs[b] - xs[a]) * (pos - a), 1))
    return out


def build_do_jogador(p, grandes):
    vistos, out = set(), []
    for c in sorted(p.get('purchase_log') or [], key=lambda c: c.get('time') or 0):
        k = c.get('key')
        if k in grandes and k not in vistos:
            vistos.add(k)
            out.append((k, max(0, (c.get('time') or 0) / 60)))
    return out


def partidas(pasta: Path):
    for f in sorted(pasta.glob('*.json.gz')):
        try:
            with gzip.open(f) as g:
                yield json.load(g)
        except Exception as e:  # noqa: BLE001
            print(f'  {f.name}: {e}', file=sys.stderr)


def gerar(dados: Path):
    grandes = itens_grandes()
    farm_p = defaultdict(lambda: defaultdict(list))
    farm_h = defaultdict(lambda: defaultdict(list))
    build = defaultdict(lambda: {'n': 0, 'i': defaultdict(lambda: [0, 0.0, 0.0])})
    n_partidas = 0
    descartes = defaultdict(int)
    for m in partidas(dados / 'partidas'):
        motivo = rotas.valida(m, RANK_MAX)
        js = None if motivo else rotas.jogadores_da_partida(m)
        if js is None:
            descartes[motivo or 'sem séries por minuto'] += 1
            continue
        rotas.atribuir_posicoes(js)
        n_partidas += 1
        for p, j in zip(m['players'], js):
            pos = j.get('pos')
            if not pos:
                continue
            chave = f"{p['hero_id']}.{pos}"
            gt, lt = p.get('gold_t') or [], p.get('lh_t') or []
            valores = {'gpm': p.get('gold_per_min'), 'lh10': lt[10] if len(lt) > 10 else None, 'nw20': gt[20] if len(gt) > 20 else None}
            for k, v in valores.items():
                if v is not None:
                    farm_p[str(pos)][k].append(v)
                    farm_h[chave][k].append(v)
            b = build[chave]
            b['n'] += 1
            for ordem, (item, minuto) in enumerate(build_do_jogador(p, grandes)):
                x = b['i'][item]
                x[0] += 1
                x[1] += minuto
                x[2] += ordem

    def resumo(d):
        n = len(d.get('gpm') or [])
        return {'n': n, **{k: quantis(v) for k, v in d.items() if len(v) >= 5}}

    saida = {
        'v': 1, 'gerado': int(time.time()), 'partidas': n_partidas, 'min_n': MIN_N, 'q': Q,
        'farm': {
            'p': {k: resumo(v) for k, v in sorted(farm_p.items())},
            'h': {k: resumo(v) for k, v in sorted(farm_h.items()) if len(v.get('gpm') or []) >= MIN_N},
        },
        'build': {'h': {}},
    }
    for chave, b in sorted(build.items()):
        if b['n'] < MIN_N_BUILD:
            continue
        lista = sorted(b['i'].items(), key=lambda kv: -kv[1][0])[:ITENS_POR_HEROI]
        saida['build']['h'][chave] = {'n': b['n'], 'i': [[k, round(c / b['n'], 2), round(mi / c, 1), round(o / c, 1)] for k, (c, mi, o) in lista]}
    return saida, dict(descartes)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dados', required=True, help='checkout do branch dados (com a pasta partidas/)')
    ap.add_argument('--saida', default=str(DESTINO))
    a = ap.parse_args(argv)
    saida, descartes = gerar(Path(a.dados))
    if saida['partidas'] < 100:
        print(f"só {saida['partidas']} partidas boas: {a.saida} fica como está", file=sys.stderr)
        return 1
    destino = Path(a.saida)
    tmp = destino.with_suffix('.tmp')
    tmp.write_text(json.dumps(saida, separators=(',', ':'), ensure_ascii=False))
    tmp.replace(destino)
    print(f"ok: {saida['partidas']} partidas (descartadas: {descartes or 'nenhuma'}); farm de {len(saida['farm']['h'])} herói.posição "
          f"com {MIN_N}+ jogos, build de {len(saida['build']['h'])} -> {destino} ({destino.stat().st_size // 1024} KB)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
