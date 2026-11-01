# Dados da coleta (branch órfão `dados`)

Gravado pelo robô `.github/workflows/coleta.yml` (código em `coleta/` no branch `main`). Não é publicado no site.

- `partidas/<id>.json.gz`: resposta crua de `https://api.opendota.com/api/matches/<id>` (gzip). Quase todas com a
  análise do replay (séries por minuto, lances, compras, posições...); as com `"analisada": false` no índice são só
  os dados básicos (o OpenDota não conseguiu analisar a tempo).
- `provisorias/<id>.json.gz`: só os dados básicos de partidas que ainda esperam a análise do replay (pendentes no
  `estado.json`). O ranking dos amigos usa para as duplas não esperarem o OpenDota; quando a análise chega, a
  partida vai para `partidas/` e vale no lugar desta.
- `indice.json`: uma linha por partida: início (unix), duração, contas visíveis de cada lado, contas do grupo,
  analisada, tamanho do .gz.
- `amigos.json`: quem o robô considera amigo (e quem quase entrou), com jogos juntos, sessões e a última vez.
- `estado.json`: controle do robô (pedidos de análise pendentes, desistências e descartes, falhas, uso da cota por
  dia). Em `desistencias`, `"salva": false` é partida descartada sem nenhum dado (erro que se repetiu).
- `analises/<id>.json`: o que o motor do site concluiu de cada partida com amigos (culpa, pontos e componentes de cada
  jogador, culpados, craques), gravado pelo robô do ranking com a versão do motor (`motor`). Não é refeito enquanto o
  motor não muda; o ranking e os modelos leem daqui em vez de reanalisar.

Baixar tudo: `git clone --branch dados --single-branch https://github.com/Suetam016/culpado_dota2 culpado-dados`

Ler uma partida em Python: `json.loads(gzip.open("partidas/<id>.json.gz").read())`
