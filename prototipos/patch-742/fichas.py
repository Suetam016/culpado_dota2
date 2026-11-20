"""Baixa a ficha oficial (datafeed do dota2.com, em português) de cada item da loja e grava em
prototipos/patch-742/fichas-itens-brutas.json. Usado para o tooltip de item da página do patch."""
import json, time, urllib.request
B = 'https://www.dota2.com/datafeed'
def get(u):
    for t in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('erro', u, e); time.sleep(3)
lista = get(f'{B}/itemlist?language=brazilian')['result']['data']['itemabilities']
ids = [i['id'] for i in lista if i['id'] > 0 and i['name'].startswith('item_') and not i['name'].startswith('item_recipe')]
out = {}
for k in ids:
    d = get(f'{B}/itemdata?item_id={k}&language=brazilian')
    if d: out[k] = d
    time.sleep(0.2)
print(len(ids), len(out))
json.dump(out, open('prototipos/patch-742/fichas-itens-brutas.json', 'w'), ensure_ascii=False)
