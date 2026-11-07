"""Fila da esteira de animações: quais skills ainda caem no desenho genérico, em ordem do que o grupo mais vê.

Lê todos os mapas/*.json (partidas do grupo com replay), conta em quantas partidas cada skill foi usada e marca o que
já tem desenho próprio: o objeto ASSIN do index.html e os lotes em skills/lote-*.js. Grava skills/fila.json.

Uso: python3 skills/fila.py   (da raiz do repo)
"""
import collections
import glob
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAM_LOTE = 12

# apertos que não são jogada visível no mapa (orbes, ligar/desligar, soltar) ou que já são só ícone de status
FORA = re.compile(r'^(invoker_(quas|wex|exort|invoke)|.*_release$|.*_stop$|.*_land$|.*toggle.*|.*_cancel$|'
                  r'morphling_morph_(agi|str)|troll_warlord_berserkers_rage|witch_doctor_voodoo_switcheroo|'
                  r'.*_flesh_heap$|ability_|plus_|seasonal_|special_bonus)')


def chaves_assin():
    src = open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
    i = src.index('const ASSIN = {')
    j = src.index('Object.assign(ASSIN, ITENS)')
    return set(re.findall(r'^([a-z_0-9]+): *\(uso\)', src[i:j], re.M))


def chaves_lotes():
    out = {}
    for f in sorted(glob.glob(os.path.join(RAIZ, 'skills', 'lote-*.js'))):
        n = int(re.search(r'lote-(\d+)', f).group(1))
        src = open(f, encoding='utf-8').read()
        fichas = src[src.index('var fichas = {'):]
        for k in re.findall(r'^\s+([a-z_0-9]+): \{ heroi:', fichas, re.M):
            out[k] = n
    return out


def chaves_fichas():
    src = open(os.path.join(RAIZ, 'skills', 'fichas.js'), encoding='utf-8').read()
    return set(re.findall(r"([a-z_0-9]+): '", src))


def herois():
    nomes = [os.path.basename(p)[:-4] for p in glob.glob(os.path.join(RAIZ, 'img', 'herois', '*.png'))]
    return sorted(nomes, key=len, reverse=True)


def heroi_de(chave, nomes):
    for n in nomes:
        if chave.startswith(n + '_'):
            return n
    return chave.split('_')[0]


def main():
    assin = chaves_assin()
    lotes = chaves_lotes()
    fichas = chaves_fichas()
    nomes = herois()
    partidas = collections.Counter()
    usos = collections.Counter()
    info = {}
    total = 0
    for f in glob.glob(os.path.join(RAIZ, 'mapas', '*.json')):
        m = json.load(open(f, encoding='utf-8'))
        hab = m.get('hab') or []
        total += 1
        vistos = set()
        for u in m.get('usos') or []:
            if u[2] >= len(hab) or not hab[u[2]] or hab[u[2]][2] == 'i':
                continue
            k = hab[u[2]][0]
            usos[k] += 1
            info[k] = hab[u[2]]
            vistos.add(k)
        for k in vistos:
            partidas[k] += 1

    linhas = []
    for k, n in partidas.most_common():
        if FORA.match(k):
            continue
        estado = 'lote %d' % lotes[k] if k in lotes else ('replay' if k in assin else ('ficha' if k in fichas else 'generico'))
        linhas.append({'chave': k, 'heroi': heroi_de(k, nomes), 'nome': info[k][1], 'ult': info[k][2] == 'u',
                       'partidas': n, 'usos': usos[k], 'estado': estado})

    pendentes = [x for x in linhas if x['estado'] == 'generico']
    for i, x in enumerate(pendentes):
        x['proximo_lote'] = max(lotes.values() or [0]) + 1 + i // TAM_LOTE

    vistas = sum(x['partidas'] for x in linhas)
    cobertas = sum(x['partidas'] for x in linhas if x['estado'] != 'generico')
    saida = {
        'partidas': total,
        'skills_vistas': len(linhas),
        'com_desenho': sum(1 for x in linhas if x['estado'] != 'generico'),
        'cobertura_partidas': round(cobertas / vistas, 3) if vistas else 0,
        'tam_lote': TAM_LOTE,
        'skills': linhas,
    }
    with open(os.path.join(RAIZ, 'skills', 'fila.json'), 'w', encoding='utf-8') as f:
        json.dump(saida, f, ensure_ascii=False, indent=0)
    print('%d partidas, %d skills vistas, %d com desenho (%.0f%% das aparições)' % (
        total, len(linhas), saida['com_desenho'], 100 * saida['cobertura_partidas']))
    for x in pendentes[:TAM_LOTE]:
        print('  próximo: %-40s %4d partidas' % (x['chave'], x['partidas']))


if __name__ == '__main__':
    main()
