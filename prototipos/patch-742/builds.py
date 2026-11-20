"""Junta, para cada amigo da Liga (amigos.json + grupos/<id>/amigos.json), os 5 heróis mais jogados nos últimos
120 dias e os itens que ele termina com cada um. Grava prototipos/patch-742/builds-amigos.json (entrada da leitura do patch)."""
import json, os, glob, time, urllib.request, collections
KEY = os.environ.get('OPENDOTA_API_KEY', '')
def get(path):
    url = f'https://api.opendota.com/api{path}' + ((('&' if '?' in path else '?') + 'api_key=' + KEY) if KEY else '')
    for t in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'culpado-patch'}), timeout=120) as r:
                return json.load(r)
        except Exception as e:
            print('erro', path, e); time.sleep(5 * (t + 1))
    return []
grupos = [('marocas', 'Marocas', json.load(open('amigos.json')))]
PASTAS = {'marocas': 'amigos'}
gj = json.load(open('grupos/grupos.json'))
for g in gj:
    p = f"grupos/{g['id']}/amigos.json"
    if os.path.exists(p): grupos.append((g['id'], g['nome'], json.load(open(p)))); PASTAS[g['id']] = f"grupos/{g['id']}"
proj = '&'.join('project=' + x for x in ['hero_id', 'player_slot', 'radiant_win'] + [f'item_{i}' for i in range(6)])
out = {'geradoEm': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'grupos': []}
for gid, gnome, am in grupos:
    pessoas = []
    for conta, nome in am.items():
        ms = get(f'/players/{conta}/matches?date=120&significant=0&{proj}') or []
        if not ms:
            # Perfil sem lista pública no OpenDota (só aparece pelas partidas do grupo): lê as partidas que o ranking
            # já guardou e pega os itens dele em cada uma (lado + herói identificam o jogador).
            rk = json.load(open(f"{PASTAS[gid]}/ranking.json"))
            hist = [x for x in rk.get('historicos', {}).get(conta, []) if x.get('inicio', 0) > time.time() - 120 * 86400][-40:]
            ms = []
            for x in hist:
                m = get(f"/matches/{x['matchId']}")
                if not isinstance(m, dict): continue
                for pl in m.get('players') or []:
                    if pl.get('hero_id') == x['heroi'] and bool(pl.get('isRadiant', pl.get('player_slot', 0) < 128)) == (x.get('lado') == 'radiant'):
                        ms.append({'hero_id': x['heroi'], 'player_slot': pl.get('player_slot', 0), 'radiant_win': m.get('radiant_win'),
                                   **{f'item_{k}': pl.get(f'item_{k}') for k in range(6)}})
                        break
                time.sleep(1)
            print('  via partidas do grupo:', len(ms), 'de', len(hist))
        por = collections.defaultdict(lambda: {'j': 0, 'v': 0, 'it': collections.Counter()})
        for m in ms:
            h = por[m.get('hero_id')]; h['j'] += 1
            if (m.get('player_slot', 0) < 128) == bool(m.get('radiant_win')): h['v'] += 1
            for i in set(m.get(f'item_{k}') for k in range(6)):
                if i: h['it'][i] += 1
        top = sorted(por.items(), key=lambda x: -x[1]['j'])[:5]
        pessoas.append({'conta': conta, 'nome': nome, 'partidas': len(ms),
                        'herois': [{'id': hid, 'j': x['j'], 'v': x['v'], 'itens': x['it'].most_common(12)} for hid, x in top if hid]})
        print(gid, nome, len(ms)); time.sleep(1)
    out['grupos'].append({'id': gid, 'nome': gnome, 'pessoas': pessoas})
json.dump(out, open('prototipos/patch-742/builds-amigos.json', 'w'), ensure_ascii=False, indent=1)
