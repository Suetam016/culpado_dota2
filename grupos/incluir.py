#!/usr/bin/env python3
"""Inclui um grupo na Liga a partir do pedido que chegou pelo site (feedback/<arquivo>.json).

    python3 grupos/incluir.py feedback/2026-11-03T12-55-32Z-ofoyij.json            # mostra o que faria
    python3 grupos/incluir.py feedback/<pedido>.json --aplicar                      # grava
    python3 grupos/incluir.py --nome "Os Kushitas" --conta 86736516=Madruga --conta 200957620=Danylera --aplicar
    python3 grupos/incluir.py feedback/<pedido>.json --chave /mnt/project-files/segredos/emails-grupos.pem   # + e-mail

O que ele faz (com --aplicar):
  1. grupos/<id>/amigos.json com as contas do grupo (sem os completers);
  2. a linha do grupo em grupos/grupos.json (nome, data, código da ação na Bolsa, arquivo do pedido);
  3. o letreiro de boas-vindas da home (GRUPO_NOVO no index.html) passa a anunciar este grupo;
  4. coleta/disparar: o merge na main roda a coleta (últimos 14 dias de cada um + histórico) e, depois, o ranking
     (culpados, craques, fotos da Steam e medalhas). O tribunal da home lê grupos.json + amigos.json + ranking.json:
     quem é do grupo aparece com a foto e a partida abre pelo lado do grupo, sem passo extra.
Depois é só commit, PR e merge. O e-mail (se houver) só é mostrado na tela: nunca vai para o repositório.
Só biblioteca padrão (o e-mail usa o openssl da máquina).
"""

import argparse
import base64
import datetime
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GRUPOS = RAIZ / 'grupos' / 'grupos.json'
HOME = RAIZ / 'index.html'
ARTIGOS = re.compile(r'^(os|as|o|a|the)\s+', re.I)


def sem_acento(t):
    return unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode()


def slug(nome):
    s = re.sub(r'[^a-z0-9]+', '-', sem_acento(ARTIGOS.sub('', nome.strip())).lower()).strip('-')
    return s[:30].strip('-') or 'grupo'


def papel(nome):
    cons = re.sub(r'[aeiou]', '', re.sub(r'[^a-z]', '', sem_acento(ARTIGOS.sub('', nome)).lower())).upper()
    return (cons or 'GRP')[:3].ljust(3, 'X') + '3'


def ler_pedido(arq):
    """Pedido do formulário novo (partida + time + quem é do grupo) ou do antigo (contas da Steam na mão)."""
    d = json.loads(Path(arq).read_text(encoding='utf-8'))
    texto = d.get('texto', '')
    nome = (re.search(r'Nome do grupo:\s*(.+)', texto) or [None, ''])[1].strip()
    contas = {}
    m = re.search(r'Do grupo \(\d+\):\n(.*?)(?:\nCompleters:|\nE-mail|\Z)', texto, re.S)
    if m:  # formulário novo: "- Nome (conta 123)"; perfil fechado não tem conta e fica de fora
        for nm, c in re.findall(r'^- (.+?) \(conta (\d+)\)', m[1], re.M):
            contas[c] = nm.strip()
    else:  # formulário antigo: "86736516 - Madruga"
        for c, nm in re.findall(r'^\s*(\d{5,12})\s*[-–:]\s*(.+?)\s*$', texto, re.M):
            contas[c] = nm.strip()
    partida = (re.search(r'Partida:\s*(\d+)', texto) or [None, None])[1] or (d.get('partida') or '').replace('grupo-', '') or None
    email = (re.search(r'E-mail para avisar \(cifrado\):\s*([A-Za-z0-9+/=]+)', texto) or [None, None])[1]
    fechados = len(re.findall(r'\(perfil fechado\)', m[1])) if m else 0
    return {'nome': nome, 'contas': contas, 'partida': partida, 'email': email, 'quando': d.get('quando'),
            'apelido': d.get('nome', ''), 'fechados': fechados}


def abrir_email(cifra, chave):
    r = subprocess.run(['openssl', 'pkeyutl', '-decrypt', '-inkey', chave, '-pkeyopt', 'rsa_padding_mode:oaep',
                        '-pkeyopt', 'rsa_oaep_md:sha256', '-pkeyopt', 'rsa_mgf1_md:sha256'],
                       input=base64.b64decode(cifra), capture_output=True)
    return r.stdout.decode().strip() if r.returncode == 0 else f'(não abriu: {r.stderr.decode().strip()})'


def js(t):
    return "'" + str(t).replace('\\', '\\\\').replace("'", "\\'") + "'"


def trocar_letreiro(html, gid, nome, membros, total):
    sem_art = ARTIGOS.sub('', nome).strip() or nome
    novo = (f"const GRUPO_NOVO = {{ id: {js(gid)}, nome: {js(nome)}, splash: {js('Bem-vindos, ' + sem_art + '!')}, "
            f"membros: [{', '.join(js(m) for m in membros)}], grupos: {int(total)} }};")
    return re.sub(r'^const GRUPO_NOVO = .*;$', lambda _: novo, html, count=1, flags=re.M)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pedido', nargs='?', help='feedback/<arquivo>.json do pedido')
    ap.add_argument('--nome', help='nome do grupo (vence o do pedido)')
    ap.add_argument('--id', help='id na URL (?grupo=<id>); padrão: o nome sem artigo e acento')
    ap.add_argument('--conta', action='append', default=[], help='conta=Nome (repetível; soma ou troca as do pedido)')
    ap.add_argument('--sem', action='append', default=[], help='conta a tirar (ex.: completer marcado errado)')
    ap.add_argument('--papel', help='código da ação na Bolsa (padrão: consoantes do nome + 3)')
    ap.add_argument('--chave', help='chave privada para abrir o e-mail do pedido (só mostra na tela)')
    ap.add_argument('--sem-letreiro', action='store_true', help='não troca o letreiro de boas-vindas da home')
    ap.add_argument('--aplicar', action='store_true', help='grava (sem isto só mostra o que faria)')
    a = ap.parse_args()

    p = ler_pedido(a.pedido) if a.pedido else {'nome': '', 'contas': {}, 'partida': None, 'email': None,
                                                'quando': None, 'apelido': '', 'fechados': 0}
    for c in a.conta:
        conta, _, nm = c.partition('=')
        if not conta.strip().isdigit():
            sys.exit(f'--conta precisa ser número=Nome: {c}')
        p['contas'][conta.strip()] = nm.strip() or conta.strip()
    for c in a.sem:
        p['contas'].pop(c.strip(), None)
    nome = (a.nome or p['nome']).strip()
    if not nome:
        sys.exit('O pedido não diz o nome do grupo: passe --nome "Nome do grupo".')
    gid = a.id or slug(nome)
    if not re.fullmatch(r'[a-z0-9-]+', gid) or gid == 'marocas':
        sys.exit(f'id inválido: {gid}')
    if len(p['contas']) < 2:
        sys.exit(f'Só {len(p["contas"])} conta(s) com perfil aberto: precisa de pelo menos 2 (use --conta).')

    lista = json.loads(GRUPOS.read_text(encoding='utf-8')) if GRUPOS.exists() else []
    problemas = []
    if any(g['id'] == gid for g in lista):
        problemas.append(f'o grupo "{gid}" já existe em grupos/grupos.json')
    outros = {'marocas': json.loads((RAIZ / 'amigos.json').read_text(encoding='utf-8'))}
    for g in lista:
        arq = RAIZ / 'grupos' / g['id'] / 'amigos.json'
        if g['id'] != gid and arq.exists():
            outros[g['id']] = json.loads(arq.read_text(encoding='utf-8'))
    for c in p['contas']:
        for oid, contas in outros.items():
            if c in contas:
                problemas.append(f'a conta {c} ({p["contas"][c]}) já está no grupo {oid} (pode, mas confira)')

    cod = a.papel or papel(nome)
    print(f'Grupo: {nome}  ->  id "{gid}"  ·  ação na Bolsa {cod}  ·  página /ranking/?grupo={gid}')
    if p['quando']:
        quando = datetime.datetime.fromisoformat(p['quando'].replace('Z', '+00:00')).astimezone(datetime.timezone(datetime.timedelta(hours=-3)))
        print(f'Pedido de {quando:%d/%m/%Y %H:%M} (Brasília){" por " + p["apelido"] if p["apelido"] else ""}'
              f'{" · partida " + p["partida"] if p["partida"] else ""}')
    for c, nm in p['contas'].items():
        print(f'  {c}  {nm}')
    if p['fechados']:
        print(f'  + {p["fechados"]} pessoa(s) do grupo com perfil fechado (sem conta: não entram)')
    if p['email']:
        print('E-mail para avisar:', abrir_email(p['email'], a.chave) if a.chave else '(cifrado; passe --chave para abrir)')
    for x in problemas:
        print('ATENÇÃO:', x)
    if not a.aplicar:
        print('\nNada gravado. Rode de novo com --aplicar.')
        return
    if any('já existe' in x for x in problemas):
        sys.exit('Não gravei: o grupo já existe.')

    pasta = RAIZ / 'grupos' / gid
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / 'amigos.json').write_text(json.dumps(p['contas'], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    linha = {'id': gid, 'nome': nome, 'entrou': datetime.date.today().isoformat(), 'papel': cod}
    if a.pedido:
        linha['pedido'] = Path(a.pedido).name
    lista.append(linha)
    GRUPOS.write_text('[\n' + ',\n'.join('  ' + json.dumps(g, ensure_ascii=False) for g in lista) + '\n]\n', encoding='utf-8')
    if not a.sem_letreiro and HOME.exists():
        html = HOME.read_text(encoding='utf-8')
        novo = trocar_letreiro(html, gid, nome, list(p['contas'].values()), 1 + len(lista))
        if novo == html:
            print('ATENÇÃO: não achei GRUPO_NOVO no index.html; letreiro ficou como estava')
        HOME.write_text(novo, encoding='utf-8')
    (RAIZ / 'coleta' / 'disparar').write_text(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ') + '\n')
    print(f'\nGravado: grupos/{gid}/amigos.json, grupos/grupos.json'
          f'{"" if a.sem_letreiro else ", letreiro da home (GRUPO_NOVO)"}, coleta/disparar.')
    print('Agora: commit, PR e merge na main. A coleta roda no merge; o ranking sai logo depois '
          '(as partidas da última semana entram conforme o OpenDota analisa os replays).')


if __name__ == '__main__':
    main()
