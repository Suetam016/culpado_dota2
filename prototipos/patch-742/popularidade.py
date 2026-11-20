# Baixa do OpenDota o que cada herói está comprando (itemPopularity) para ver quem já compra os itens novos do 7.42.
import json, time, urllib.request
def get(u):
    for t in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'oculpado'}), timeout=60))
        except Exception as e:
            print('erro', u, e); time.sleep(5 * (t + 1))
herois = get('https://api.opendota.com/api/heroes') or []
out = {'quando': time.strftime('%Y-%m-%d %H:%M'), 'herois': {}}
for h in herois:
    out['herois'][h['id']] = get(f"https://api.opendota.com/api/heroes/{h['id']}/itemPopularity")
    time.sleep(1.1)
out['ids'] = {v['id']: k for k, v in (get('https://api.opendota.com/api/constants/items') or {}).items() if isinstance(v, dict) and 'id' in v}
json.dump(out, open('prototipos/patch-742/popularidade-brutas.json', 'w'))
print(len(out['herois']), 'heróis')
