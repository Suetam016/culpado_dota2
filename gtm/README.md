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
vale para a liga e para o grupo. Elementos novos ainda sem gatilho: o botão `#liga-pedir-grupo` (abre o formulário de pedido, ver abaixo),
as linhas `#liga-grupos tr[data-grupo]` (clique num grupo) e o link `#voltar-liga`.

**Pedido de grupo (desde 05/11/2026):** o pedido para entrar na liga virou um formulário próprio no `/ranking/`.
`#liga-pedir-grupo` agora abre/fecha o `#liga-form` (antes abria a caixa de feedback). A pessoa cola o ID da partida
(`#lf-partida` + `#lf-buscar`), escolhe o time (`.lf-time[data-lado="radiant|dire"]`), marca quem é do grupo e quem é
completer (`.lf-pessoa`) e envia em `#lf-enviar`. No envio que dá certo o site manda
`dataLayer.push({ event: 'group_request_submit', group_size: <pessoas do grupo>, completers: <randoms> })`.
O botão da home `#home-pedir-grupo` (gatilho `group_request_click`) continua com o mesmo id, mas agora leva para
`/ranking/#pedir`, que abre a liga com o formulário aberto (a URL vira `#liga`). O pedido não passa mais pelo feedback,
então ele não conta como `feedback_submit`.

O GTM também espera estes eventos no `dataLayer`, que **o site ainda não envia**:
`match_judge_start`, `match_judge_success`, `match_judge_error`, `feedback_submit`
(com `is_example`, `load_time_ms`, `verdict_doc`, `error_code`).

## Tela de vitória: visões sorteadas (desde 04/11/2026)

Numa vitória, a tela sorteia uma "visão" (`documento`; Plantão, Stories e Post entram depois). **Desde 04/11/2026 a
visão `zap` está desligada**: toda vitória mostra o `documento`, então `victory_view` chega sempre com `documento` e
`victory_view_switch: false`, o botão `.trocar-visao` some (só aparece quando há mais de uma visão) e `.zap-play` /
`.zap-pedir` não aparecem mais. O código ficou para religar depois. O site envia `dataLayer.push({ event: 'victory_view', victory_view: '<id>', victory_view_switch: <true se a pessoa trocou> })`.
A visão também fica em `.visao-vitoria[data-visao]`. Elementos novos ainda sem gatilho: o botão `.trocar-visao`
(`data-gtm="vitoria-trocar-visao"`, "Ver em outra tela"). Os botões do áudio (`.zap-play`, `.zap-pedir`) continuam iguais,
agora dentro da visão do zap. `?visao=zap` (ou `documento`) na URL força uma visão, mesmo desligada, útil para testar.

## Boas-vindas a grupo novo na home (desde 06/11/2026)

A home ganhou dois elementos novos, ainda **sem gatilho no GTM**:

- **Splash** `#home-splash`: texto amarelo pulsando ao lado do título ("Bem-vindos, Kushitas!"). É um link para `ranking/#liga`
  (de propósito não é `ranking/`, para não contar como `ranking_open`).
- **Letreiro** `#home-letreiro`: faixa embaixo do topo com frases que giram. Os links das frases são `.letreiro-link`
  com `data-gtm="letreiro-pedir_grupo"` (vai para `ranking/#pedir`), `letreiro-feedback_injusto` e
  `letreiro-feedback_novidade` (abrem a caixa de feedback já com o começo do texto). O × é `#letreiro-fechar`
  (o letreiro some para aquela pessoa até entrar o próximo grupo).

Todo clique nesses dois manda `dataLayer.push({ event: 'home_banner_click', banner: 'splash'|'letreiro', banner_item })`,
com `banner_item` = `grupo`, `pedir_grupo`, `feedback_injusto`, `feedback_novidade` ou `fechar`.
Para virar evento no GA4 basta um gatilho de Evento personalizado `home_banner_click` com essas duas variáveis da camada de dados.

## Conferência automática

O workflow `gtm.yml` roda `node gtm/checar.js` em todo PR que mexe nas páginas. Ele abre a home, a partida de
exemplo e o ranking e confere tudo da tabela acima (lendo direto de `container.json`).
Se falhar: mantenha os nomes antigos, ou avise o Mat para repassar a mudança ao responsável do GTM.
Quando o GTM for atualizado, troque `container.json` pela exportação nova.
