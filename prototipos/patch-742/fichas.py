import json,re
R=json.load(open('/home/user/culpado_dota2/prototipos/patch-742/fichas-itens-brutas.json'))
od=json.load(open('/mnt/project-files/patch-7-42/dados-brutos/od-itens.json'))
D=json.load(open('dados.json'))
od_id={v.get('id'):v for v in od.values() if isinstance(v,dict)}
od_slug={k:v.get('id') for k,v in od.items() if isinstance(v,dict)}
patch={i['id']:i for i in D['itens']+D['neutros'] if i.get('id')}
TOK={'str':'de Força','agi':'de Agilidade','int':'de Inteligência','all':'a todos os atributos','damage':'de dano','attack':'de velocidade de ataque',
'health':'de vida','hp_regen':'de regeneração de vida','mana':'de mana','mana_regen':'de regeneração de mana','armor':'de armadura','move_speed':'de velocidade de movimento',
'spell_resist':'de resistência mágica','cast_range':'de alcance de uso','lifesteal':'de roubo de vida','evasion':'de esquiva','spell_lifesteal':'de roubo de vida arcano',
'attack_range_melee':'de alcance de ataque (corpo a corpo)','attack_range':'de alcance de ataque (longo alcance)','attack_range_all':'de alcance de ataque',
'restoration_amp':'de amplificação de restauração','cooldown_reduction':'de redução de intervalo','aoe_bonus':'de área de efeito','projectile_speed':'de velocidade de projétil',
'debuff_amp':'de amplificação de efeitos negativos','primary_attribute':'ao atributo primário','status_resist':'de resistência a efeitos','selected_attrib':'ao atributo escolhido'}
PCT={'spell_resist','lifesteal','evasion','spell_lifesteal','restoration_amp','cooldown_reduction','debuff_amp','status_resist'}
def fmt(vs):
    vs=[('%g'%v).replace('.',',') for v in vs]
    return vs[0] if len(set(vs))==1 else '/'.join(vs)
def limpa(s):
    s=re.sub(r'<br\s*/?>','\n',s); s=re.sub(r'<[^>]+>','',s); return re.sub(r'[ \t]+',' ',s).strip()
F={}
for k,v in R.items():
    it=v['result']['data']['items'][0]; k=int(k)
    if not it.get('name_loc'): continue
    sv={x['name']:x for x in it['special_values']}
    def rep(m):
        x=sv.get(m.group(1)); 
        return fmt(x['values_float']) if x and x['values_float'] else ''
    stats=[]
    for x in it['special_values']:
        h=x['heading_loc']; 
        if not h or not x['values_float']: continue
        val=fmt(x['values_float']); h=limpa(h)
        m=re.match(r'^([+-])\$(\w+)$',h)
        if m: stats.append(f"{m.group(1)}{val}{'%' if m.group(2) in PCT or x['is_percentage'] else ''} {TOK.get(m.group(2),m.group(2))}")
        elif h[:1] in '+-': stats.append(f"{h[0]}{val}{'%' if x['is_percentage'] else ''} {h[1:].strip()}")
        else: stats.append(f"{h.title()} {val}")
    desc=re.sub(r'%(\w+)%',rep,it['desc_loc'] or '').replace('%%','%')
    desc=re.sub(r'\nEm inglês:.*$','',desc,flags=re.S)
    secs=[]
    for parte in re.split(r'<h1>',desc):
        if not parte.strip(): continue
        if '</h1>' in parte: t,x=parte.split('</h1>',1)
        else: t,x='',parte
        x=limpa(x)
        if t or x: secs.append([limpa(t),x])
    comp=None
    if k in patch and patch[k].get('comp'): comp=patch[k]['comp']
    else:
        mudou=k in patch and any(re.search(r'receita|recipe|Requires|Requer',e.get('t',''),re.I) for e in patch[k]['l'])
        o=od_id.get(k)
        if o and o.get('components') and not mudou: comp=[od_slug.get(c) for c in o['components'] if od_slug.get(c)]
    f={'n':it['name_loc'],'c':it.get('item_cost') or 0,'s':stats,'d':secs}
    cd=[c for c in it['cooldowns'] if c]; mc=[c for c in it['mana_costs'] if c]
    if cd: f['cd']=fmt(cd)
    if mc: f['mc']=fmt(mc)
    if comp: f['r']=comp
    if 0<it.get('item_neutral_tier',0)<10: f['t']=it['item_neutral_tier']+1
    F[k]=f
json.dump(F,open('fichas.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(F),len(json.dumps(F,ensure_ascii=False))//1024,'KB')
for k in (1955,1953,1942,139,50):print(json.dumps(F.get(k),ensure_ascii=False)[:700])
