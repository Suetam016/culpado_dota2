# Handoff: Quem é o Culpado - Novas Features

## O que foi implementado nesta sessão

### 1. Sistema de Mining de Insights do Reddit
- **Arquivo**: `reddit/insights.py`
- **Função**: Coleta comentários/posts estratégicos do r/DotA2
- **Tópicos extraídos**: fortify, siege, farm, position, items, gank, vision, objectives, timing
- **Output**: `reddit/insights.json` com insights organizados por tópico

**Para usar (offline):**
```bash
python3 reddit/insights.py
```

Isso gera `reddit/insights.json` com exemplos de desenvolvimento.

**Para coleta real (depois):**
- Instalar: `pip install praw`
- Adicionar credenciais Reddit em `reddit/insights.py` (função `coletar_reddit()`)
- Rodar: `python3 reddit/insights.py`

### 2. Nova aba "Meta 🔥" no site de ranking
- **Localização**: `ranking/index.html`, `ranking/app.js`, `ranking/styles.css`
- **Função**: Exibe insights do Reddit categorizados por tópico
- **Features**:
  - Cards interativos por tópico
  - Mostra score médio e quantidade de insights
  - Top 5 insights de cada tópico com autor e pontuação

**Ver no site:**
https://suetam016.github.io/culpado_dota2/ranking/
- Clique aba "Meta 🔥"

## Fluxo de trabalho

1. **Fazer mudanças** neste repositório (`culpado_dota2`)
2. **Comitar e fazer push**: As mudanças vão direto para o site
3. **GitHub Pages atualiza automaticamente**: ~2 minutos depois

## Próximos passos (sugestões)

- [ ] Implementar coleta automática com GitHub Actions
- [ ] Correlacionar insights com heróis específicos
- [ ] Adicionar NLP melhorado para extração
- [ ] Histor de insights ao longo do tempo
- [ ] Integrar insights com análise de partidas individuais

## Estrutura do repositório

```
/
├── ranking/           ← Site de ranking dos amigos Marocas
│   ├── index.html     ← 3 abas: Geral, Stack, Solo, Meta 🔥
│   ├── app.js
│   └── styles.css
├── reddit/            ← Mining de insights
│   ├── insights.py    ← Coletor (offline/PRAW)
│   └── insights.json  ← Dados gerados
├── amigos.json        ← Lista de amigos (account_id: nome)
├── index.html         ← Painel principal
└── [resto do site]
```

## Comandos úteis

```bash
# Gerar insights
python3 reddit/insights.py

# Ver o site localmente
python3 -m http.server 8000
# Abrir http://localhost:8000/ranking/

# Comitar mudanças
git add .
git commit -m "descricao"
git push origin main
```

---
**Data**: 2026-10-16  
**Sessão anterior criou**: mining de insights + aba Meta no ranking
