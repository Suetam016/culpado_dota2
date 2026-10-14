# Robô da coleta de partidas

Junta, sozinho, uma base de partidas de Dota com todos os detalhes (ouro e XP minuto a minuto, compras, lutas,
posições...) para a gente montar modelos depois. Não mexe no site.

## O que ele faz

De hora em hora (aos 17 minutos), no GitHub Actions (`.github/workflows/coleta.yml`):

1. Pega a lista das partidas do **Suéter** (conta 81918076) dos últimos 14 dias no OpenDota.
2. Baixa cada partida, **das mais antigas para as mais novas** (a Valve apaga o replay em umas 2 semanas, então as
   velhas têm pressa).
3. Descobre quem são os **amigos**: quem jogou **no mesmo time** do Suéter em **3 partidas ou mais**, em **pelo menos 2
   sessões diferentes**, nos últimos 14 dias. Uma sessão nova só começa quando o Suéter fica mais de 7 horas sem
   começar partida (umas 6 horas sem jogar). Partidas seguidas não contam como critério: quando a gente está em 4 e
   pega um aleatório para completar, ele pode cair com a gente de novo a sessão inteira, mesmo passando da
   meia-noite. Quem joga com o perfil oculto não entra. Também entram as contas do `amigos.json` do site (esse
   arquivo não é alterado).
4. Baixa as partidas dos amigos dos últimos 14 dias, também das mais antigas para as mais novas.
5. Com a cota que ainda sobra, baixa as partidas **mais velhas que 14 dias** do Suéter e dos amigos que o OpenDota
   **já tinha analisado** (o replay já sumiu, mas a análise feita na época continua lá), das mais novas para trás.
   Isso vem ligado (`COLETA_HISTORICO: "1"`); `"0"` desliga. Com isso o branch `dados` cresce bem mais rápido
   (chute: 50 a 150 KB por partida). O resumo de cada rodada mostra quanta cota do dia sobrou sem uso: se continuar
   sobrando muito, é porque não há mais partidas analisadas para baixar dessas contas.

Partida que o OpenDota ainda não analisou: o robô pede a análise uma vez e volta a olhar na rodada seguinte, depois
com 1 h, 2 h, 4 h, 8 h e então de 12 em 12 h. Se em 3 dias não sair, ou se a partida já tem mais de 15 dias (sem
replay), ele desiste e guarda só os dados básicos. Partida já baixada nunca é baixada de novo, e partida em que vários
de nós jogamos é baixada uma vez só.

Se o OpenDota der erro numa partida (fora do ar, erro 500, rede), o robô só tenta de novo mais tarde, esperando cada
vez mais (30 min, 1 h, 2 h... até 12 h). Se o OpenDota cair de vez (5 erros seguidos), a rodada para e esses erros
nem contam. Só uma partida que dá o mesmo erro 3 vezes (por exemplo "não encontrada"), ou que passa dos 15 dias sem
conseguir baixar, é descartada, e isso fica anotado no `estado.json` e no resumo da rodada.

## Cota do OpenDota (plano grátis, sem chave)

- No máximo ~54 consultas por minuto (uma a cada 1,1 s).
- Deixa sempre **200 consultas do dia livres** (`COLETA_RESERVA`). O robô lê o que o OpenDota diz que ainda resta no
  dia (cabeçalho `X-Rate-Limit-Remaining-Day`) e para quando chega na reserva. Depois disso, as rodadas seguintes
  nem chamam o OpenDota até o dia seguinte (UTC), a não ser uma consulta de teste a cada 6 horas para ver se o dia
  do OpenDota já virou.
- Se o OpenDota não mandar esse cabeçalho, o robô usa no máximo 80 consultas por rodada e conta sozinho: no máximo
  2000 − 200 = 1800 por dia (UTC). Esse teto próprio vale sempre.
- Se o OpenDota responder "429" (limite estourado), a rodada para na hora e guarda o que já baixou.
- Nenhum erro apaga o que já foi salvo.
- Antes de gastar cota, o robô testa se vai conseguir gravar no branch `dados`. Se não for (falta de permissão), a
  rodada nem começa: sem isso, ela gastaria consultas e perderia tudo, até a conta das consultas gastas no dia.

Os números ficam no começo do `coleta.yml` (`env:`).

## Onde ficam os dados

No branch **`dados`** deste repositório (um branch separado, sem nada do site; não vai para o GitHub Pages):

| Arquivo | O que é |
|---|---|
| `partidas/<id>.json.gz` | a resposta do OpenDota para a partida (`/api/matches/<id>`), igualzinha, compactada |
| `indice.json` | uma linha por partida: início, duração, quem jogou de cada lado, quem é do grupo, se foi analisada, tamanho |
| `amigos.json` | os amigos detectados (jogos juntos, sessões, última vez) e quem quase entrou |
| `estado.json` | controle do robô: análises pedidas, desistências e partidas descartadas, falhas, consultas gastas por dia |

O resumo de cada rodada (consultas gastas, quanto resta no dia, partidas novas, pendentes, amigos) aparece na página
da execução em **Actions → Coleta de partidas**.

## Como baixar os dados

Tudo de uma vez (só o branch dos dados):

    git clone --branch dados --single-branch https://github.com/Suetam016/culpado_dota2 culpado-dados

Para atualizar depois: `git pull` dentro da pasta `culpado-dados`. Sem git: no GitHub, troque o branch para `dados`
e use **Code → Download ZIP**.

Ler uma partida em Python:

    import gzip, json
    partida = json.loads(gzip.open("partidas/8000000000.json.gz").read())

## Rodar e testar no computador

    python3 coleta/teste_coletar.py                                   # testes, sem internet
    python3 coleta/coletar.py --dados /tmp/dados --amigos amigos.json # uma rodada de verdade numa pasta qualquer

Para rodar o robô agora no GitHub: **Actions → Coleta de partidas → Run workflow**.
