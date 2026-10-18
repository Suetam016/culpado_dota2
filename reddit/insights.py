#!/usr/bin/env python3
"""
Coleta insights estratégicos do r/DotA2 e gera reddit/insights.json.
Roda periodicamente (ex: 1x por dia).

Uso:
  python3 reddit/insights.py            # Reddit se tiver credenciais, senão exemplos offline
  python3 reddit/insights.py --exigir   # só Reddit: se falhar, sai com erro e não mexe no insights.json

Credenciais (app "script" em https://www.reddit.com/prefs/apps), por variável de ambiente:
  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
"""

import json
import os
import sys
import re
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

# Tentar importar PRAW (Reddit API)
try:
    import praw
    PRAW_AVAILABLE = True
except ImportError:
    PRAW_AVAILABLE = False

# Tópicos estratégicos (palavras-chave em inglês para match com comentários)
TOPICOS = {
    'fortify': {
        'palavras': ['fortif', 'high ground', 'defend', 'base defense'],
        'descricao': 'Defesa de posições elevadas e fortify mechanics'
    },
    'siege': {
        'palavras': ['siege', 'highground', 'rosh pit', 'base assault'],
        'descricao': 'Cerco e ataque à base inimiga'
    },
    'farm': {
        'palavras': ['farm', 'farming', 'last hit', 'cs', 'last-hit', 'gold efficiency'],
        'descricao': 'Eficiência de farm e prioridade de ouro'
    },
    'position': {
        'palavras': ['pos1', 'pos2', 'pos3', 'pos4', 'pos5', 'carry', 'mid', 'support', 'offlane'],
        'descricao': 'Papéis e posições no time'
    },
    'items': {
        'palavras': ['item', 'build', 'bkb', 'blink', 'boots', 'agha', 'blessing', 'anathema'],
        'descricao': 'Builds de itens e timing'
    },
    'gank': {
        'palavras': ['gank', 'roam', 'kill', 'rotation', 'teleport'],
        'descricao': 'Ganks, roaming e rotações'
    },
    'vision': {
        'palavras': ['ward', 'vision', 'deward', 'smoke', 'detection', 'observer', 'sentry'],
        'descricao': 'Visão, wards e smoke ganks'
    },
    'objectives': {
        'palavras': ['rosh', 'roshan', 'objectiv', 'tower', 'barracks', 'creep wave'],
        'descricao': 'Objetivos do mapa (roshan, torres)'
    },
    'timing': {
        'palavras': ['timing', 'window', 'power spike', 'minute', 'game stage', 'mid-game', 'late-game', 'early-game'],
        'descricao': 'Timing de poder dos heróis e janelas de oportunidade'
    }
}

# comentário que cita um herói junto com uma dessas palavras vai para "meta" (quem está forte, build, patch)
PALAVRAS_META = ['broken', 'strong', ' op ', 'overpowered', 'busted', 'meta', 'nerf', 'buff', 'patch', 'build',
                 'facet', 'winrate', 'win rate', 'spam', 'insane', 'underrated', 'overrated', 'counter', 'item']
BUSCA_META = 'meta OR patch OR nerf OR buff OR broken OR build OR "win rate"'


def herois_conhecidos():
    """[(regex do nome, id)] a partir das constantes embutidas no index.html do site."""
    html = (Path(__file__).resolve().parent.parent / 'index.html').read_text(encoding='utf-8')
    m = re.search(r'<script type="application/json" id="dados-embutidos">([\s\S]*?)</script>', html)
    herois = json.loads(m.group(1))['constantes']['h']
    return [(re.compile(r'\b' + re.escape(v[1].lower()) + r'\b'), int(k)) for k, v in herois.items()]


def herois_citados(texto, herois):
    t = texto.lower()
    return sorted({hid for rx, hid in herois if rx.search(t)})


def eh_meta(texto, herois_no_texto):
    t = f' {texto.lower()} '
    return bool(herois_no_texto) and any(p in t for p in PALAVRAS_META)


def extrair_topicos(texto):
    """Detecta quais tópicos estão presentes no texto."""
    texto_lower = texto.lower()
    topicos_encontrados = []

    for topico, config in TOPICOS.items():
        for palavra in config['palavras']:
            if palavra.lower() in texto_lower:
                topicos_encontrados.append(topico)
                break

    return list(set(topicos_encontrados))  # Remove duplicatas

def limpar_texto(texto):
    """Remove URLs, mentions, markdown desnecessário."""
    # Remove URLs
    texto = re.sub(r'https?://\S+', '', texto)
    # Remove mentions de usuário
    texto = re.sub(r'/u/\S+', '', texto)
    # Remove markdown excessivo
    texto = re.sub(r'[*_]{2,}', '', texto)
    # Trunca para 300 chars
    if len(texto) > 300:
        texto = texto[:300].rsplit(' ', 1)[0] + '…'
    return texto.strip()

def coletar_reddit():
    """Coleta comentários/posts do r/DotA2 usando PRAW."""
    if not PRAW_AVAILABLE:
        print("PRAW não instalado. Use: pip install praw", file=sys.stderr)
        return []

    try:
        client_id = os.environ.get('REDDIT_CLIENT_ID')
        client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
        if not client_id or not client_secret:
            print("Sem REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET no ambiente.", file=sys.stderr)
            return []
        # read-only: só client_id + secret, sem login de usuário
        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent='dota2-insights-miner/1.0 (github.com/suetam016/culpado_dota2)'
        )

        insights = []
        print("Coletando do r/DotA2...", file=sys.stderr)

        # Buscar top comments da semana
        subreddit = reddit.subreddit('DotA2')

        herois = herois_conhecidos()
        vistos = set()
        posts = []
        for post in list(subreddit.top(time_filter='week', limit=30)) + list(subreddit.search(BUSCA_META, sort='top', time_filter='week', limit=20)):
            if post.id not in vistos:
                vistos.add(post.id)
                posts.append(post)

        for post in posts:
            # Expandir comentários
            post.comments.replace_more(limit=2)

            for comment in post.comments.list()[:10]:  # Top 10 comments por post
                texto = comment.body
                score = comment.score

                # Filtrar comentários muito curtos ou com downvote
                if len(texto) < 50 or score < 5:
                    continue

                citados = herois_citados(texto, herois)
                meta = eh_meta(texto, citados)
                topicos = [] if meta else extrair_topicos(texto)
                if not meta and not topicos:
                    continue

                insight = {
                    'categoria': 'meta' if meta else 'dicas',
                    'herois': citados,
                    'id': comment.id,
                    'autor': comment.author.name if comment.author else 'Anônimo',
                    'score': score,
                    'topicos': topicos,
                    'texto': limpar_texto(texto),
                    'coletadoEm': datetime.now(timezone.utc).isoformat(),
                    'url': f'https://reddit.com{comment.permalink}'
                }
                insights.append(insight)

        return insights

    except Exception as e:
        print(f"Erro ao acessar Reddit: {e}", file=sys.stderr)
        return []

def carregar_insights_offline():
    """Carrega insights de exemplo para desenvolvimento (sem Reddit API)."""
    return [
        {
            'id': 'example1',
            'autor': 'DotA2_Coach',
            'score': 245,
            'topicos': ['fortify', 'objectives'],
            'texto': 'High ground defense é crítico. Seu time deve estar em formação antes do inimigo chegar. Fortify skill adiciona +30% de armor quando você defende sua base.',
            'coletadoEm': datetime.now(timezone.utc).isoformat(),
            'url': 'https://reddit.com/r/DotA2/example1'
        },
        {
            'id': 'example2',
            'autor': 'Pro_Player',
            'score': 189,
            'topicos': ['farm', 'timing'],
            'texto': 'Farm efficiency early game é tudo. Se você não tem 50 CS aos 10min na pos1, você está ficando atrás. Foque em last hits, não em kills.',
            'coletadoEm': datetime.now(timezone.utc).isoformat(),
            'url': 'https://reddit.com/r/DotA2/example2'
        },
        {
            'id': 'example3',
            'autor': 'Support_Main',
            'score': 156,
            'topicos': ['vision', 'position'],
            'texto': 'Como pos5, suas wards salvam o time. Coloque observers em locais que revelam onde o inimigo está farmando. Sentry wards matam smoke ganks.',
            'coletadoEm': datetime.now(timezone.utc).isoformat(),
            'url': 'https://reddit.com/r/DotA2/example3'
        },
        {
            'id': 'example4',
            'autor': 'Meta_Analyst',
            'score': 312,
            'topicos': ['timing', 'objectives'],
            'texto': 'Roshan windows são power spikes. Se seu time tem vantagem de 5k gold e o inimigo está sem BKB, tente um Rosh. Controle o pit para ganhar experiência.',
            'coletadoEm': datetime.now(timezone.utc).isoformat(),
            'url': 'https://reddit.com/r/DotA2/example4'
        }
    ]

def gerar_insights(insights_brutos, fonte):
    """Processa insights e gera ranking por tópico."""
    topicos_stats = defaultdict(lambda: {'count': 0, 'insights': [], 'score_total': 0})

    meta = sorted((i for i in insights_brutos if i.get('categoria') == 'meta'), key=lambda x: -x['score'])
    citados = defaultdict(int)
    for i in meta:
        for h in i.get('herois', []):
            citados[h] += 1

    for insight in insights_brutos:
        for topico in insight['topicos']:
            topicos_stats[topico]['count'] += 1
            topicos_stats[topico]['score_total'] += insight['score']
            topicos_stats[topico]['insights'].append({
                'texto': insight['texto'],
                'score': insight['score'],
                'autor': insight['autor'],
                'url': insight['url']
            })

    # Ordenar insights por score dentro de cada tópico
    for topico in topicos_stats:
        topicos_stats[topico]['insights'].sort(key=lambda x: x['score'], reverse=True)
        topicos_stats[topico]['insights'] = topicos_stats[topico]['insights'][:5]  # Top 5 por tópico

    # Criar resultado estruturado
    resultado = {
        'atualizadoEm': datetime.now(timezone.utc).isoformat(),
        'fonte': fonte,  # 'reddit' ou 'exemplo'
        'totalInsights': len(insights_brutos),
        'topicos': {},
        'meta': [{'texto': i['texto'], 'score': i['score'], 'autor': i['autor'], 'url': i['url'], 'herois': i.get('herois', [])}
                 for i in meta[:12]],
        'heroisCitados': [{'heroi': h, 'vezes': n} for h, n in sorted(citados.items(), key=lambda kv: -kv[1])[:10]],
    }

    for topico in sorted(topicos_stats.keys()):
        stats = topicos_stats[topico]
        resultado['topicos'][topico] = {
            'descricao': TOPICOS[topico]['descricao'],
            'count': stats['count'],
            'avgScore': round(stats['score_total'] / stats['count']),
            'insights': stats['insights']
        }

    return resultado

def salvar_insights(dados):
    """Salva insights em reddit/insights.json."""
    insights_path = Path(__file__).parent / 'insights.json'
    with open(insights_path, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=2, ensure_ascii=False)
    print(f"✓ Insights salvos em {insights_path}", file=sys.stderr)

def main():
    exigir = '--exigir' in sys.argv[1:]
    insights_brutos = coletar_reddit() if PRAW_AVAILABLE else []
    fonte = 'reddit'
    if not insights_brutos:
        if exigir:
            # na coleta automática: nunca troca dados reais por exemplos
            print("Nada coletado do Reddit; insights.json fica como está.", file=sys.stderr)
            sys.exit(1)
        if not PRAW_AVAILABLE:
            print("PRAW não instalado (pip install praw).", file=sys.stderr)
        print("Usando exemplos offline para desenvolvimento.", file=sys.stderr)
        insights_brutos = carregar_insights_offline()
        fonte = 'exemplo'

    print(f"Processando {len(insights_brutos)} insights ({fonte})...", file=sys.stderr)
    insights = gerar_insights(insights_brutos, fonte)
    salvar_insights(insights)

if __name__ == '__main__':
    main()
