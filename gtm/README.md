# Medição (Google Tag Manager)

O site carrega o contêiner **GTM-5MRD79NK** em todas as páginas (snippet no `<head>` e `<noscript>` no `<body>`).
As tags, gatilhos e variáveis são do painel do GTM, mantido por um amigo do Mat. `container.json` é a exportação dele.

## O que o GTM depende do site

Se um destes nomes mudar ou sumir, o evento para de chegar no GA4 **sem dar erro nenhum**.

| Evento GA4 | Depende de |
|---|---|
| example_match_click | `#home-exemplo` |
| last_match_click | `#home-ultima-btn` |
| group_request_click | `#home-pedir-grupo` |
| ranking_open | `a[href="ranking/"]` |
| ranking_tab_click | `.aba` com `data-aba` (no /ranking/) |
| share (method share / copy_link) | `.cartaz-share` / `.cartaz-link` |
| player_opinion_click | `.fig-ver` |
| chapter_click | `a.cap` (o `href` vira o parâmetro `chapter`) |
| replay_summary_play | `.cinema-botao` |
| replay_play | `.m-play-grande` |
| highlight_click | `.lance` (classes `potg`, `throw`, `bom` viram `highlight_type`) |
| replay_jump | `.selo-replay`, `.farm-ver` |
| sound_toggle | `#som` |
| section_view | seções da partida: `lances`, `cap-jogo`, `cap-janela`, `cap-draft`, `cap-rotas`, `cap-itens`, `cap-tribunal`, `cap-time` |
| scroll_depth / page_type | URL: `/ranking...` = ranking, `#<id da partida>` = partida, resto = home |

Desde 04/11/2026 o `/ranking/` sem `#` (ou com `#liga`) abre a **Liga dos grupos** (lista de grupos); o grupo Marocas
fica em `/ranking/#elo` e nas outras abas. Então `ranking_open` agora significa "abriu a liga", e `page_type` = ranking
vale para a liga e para o grupo. Elementos novos ainda sem gatilho: o botão `#liga-pedir-grupo` (pedir para entrar na liga),
as linhas `#liga-grupos tr[data-grupo]` (clique num grupo) e o link `#voltar-liga`.

O GTM também espera estes eventos no `dataLayer`, que **o site ainda não envia**:
`match_judge_start`, `match_judge_success`, `match_judge_error`, `group_request_submit`, `feedback_submit`
(com `is_example`, `load_time_ms`, `verdict_doc`, `error_code`).

## Conferência automática

O workflow `gtm.yml` roda `node gtm/checar.js` em todo PR que mexe nas páginas. Ele abre a home, a partida de
exemplo e o ranking e confere tudo da tabela acima (lendo direto de `container.json`).
Se falhar: mantenha os nomes antigos, ou avise o Mat para repassar a mudança ao responsável do GTM.
Quando o GTM for atualizado, troque `container.json` pela exportação nova.
