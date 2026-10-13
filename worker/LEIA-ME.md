# Ligar o oráculo do chat (grátis, sem cartão, ~5 minutos)

O chat "Pergunte ao oráculo" usa um modelo de IA **gratuito** que roda num Cloudflare Worker seu.
Ninguém precisa de chave nem de conta: a pessoa abre o site e pergunta.

Enquanto o `config.json` do site estiver vazio, o chat **não aparece** na página da partida (para ninguém
ver um chat que não funciona). Ele aparece sozinho quando você fizer o passo 5.

## Passo a passo

1. **Conta**: crie uma conta grátis em https://dash.cloudflare.com/sign-up (plano Free, não pede cartão).
2. **Worker**: *Workers & Pages* → *Create* → *Create Worker* → nome `culpado-coach` → *Deploy*.
   Depois *Edit code*: apague o exemplo, cole **todo** o conteúdo de [`coach.js`](coach.js) e clique *Deploy*.
3. **Modelo grátis**: no Worker, *Settings* → *Bindings* → *Add binding* → **Workers AI** →
   nome da variável **`AI`** (maiúsculo) → *Add binding* (ou *Deploy*, se pedir).
4. **Teste**: abra `https://culpado-coach.SEU-USUARIO.workers.dev/saude`.
   Tem que aparecer `"ok":true` e `"provedor":"workers-ai"`. Se der `"ok":false`, o binding do passo 3 não pegou.
5. **Ligar no site**: no GitHub, abra o arquivo [`config.json`](../config.json) da raiz do site → lápis (*Edit*) →
   ponha a URL do Worker (sem `/saude` no fim) e faça *Commit changes*:

   ```json
   {"coach": "https://culpado-coach.SEU-USUARIO.workers.dev"}
   ```

   Em 1 a 2 minutos o chat do site já aparece e funciona para todo mundo. Não precisa rebuild.
   Para desligar, volte para `{"coach": ""}`.

## Opcional: respostas melhores com o Gemini (também grátis)

1. Em https://aistudio.google.com/apikey entre com uma conta Google e clique
   *Create API key* → **Create API key in new project** (sem cartão).
   Na lista de chaves, a coluna *Plan* (ou *Tier*) tem que mostrar **Free**. Se mostrar *Paid* ou *Tier 1*,
   a chave caiu num projeto com faturamento: apague essa chave e crie outra num projeto novo.
2. No Worker: *Settings* → *Variables and Secrets* → *Add* → tipo **Secret**, nome **`GEMINI_API_KEY`**,
   valor = a chave → *Deploy*. (Espaço ou quebra de linha colados junto não atrapalham.)
3. `/saude` passa a mostrar `"provedor":"gemini"`. Se a cota grátis do Gemini acabar (ou a chave for
   recusada), o Worker usa sozinho o modelo da Cloudflare e deixa o Gemini de lado por uns 10 minutos.

**Não** ligue faturamento (*billing*) nesse projeto do Google nem o plano *Workers Paid* na Cloudflare.
Com a chave num projeto **Free** e a Cloudflare no plano Free, o pior que acontece é a cota do dia acabar:
nunca chega conta. (Uma chave num projeto com faturamento é cobrada a cada pergunta, sem cota grátis.)

## Opcional: botão "Gerar o mapa agora" (mapa animado na hora)

Sem isto, a partida que ainda não tem mapa animado mostra só "O replay animado desta partida ainda não foi
gerado." Com isto, aparece o botão **Gerar o mapa agora**: qualquer amigo aperta, o Worker cria o arquivo
`mapa/pedidos/<id>` no repositório do site, o push acorda o robô (`.github/workflows/mapa.yml`) e o mapa
aparece sozinho na página em uns 2 minutos (1 do robô + 1 do GitHub Pages), sem recarregar.

O Worker precisa de uma chave do GitHub que só mexe neste repositório:

1. Entre no GitHub com a conta dona do site e abra https://github.com/settings/personal-access-tokens/new
   (é o token **fine-grained**; não use o *classic*).
2. *Token name*: `culpado-mapa`. *Expiration*: o máximo que a tela deixar (até 1 ano; anote a data).
3. *Resource owner*: a sua conta (`Suetam016`).
4. *Repository access*: **Only select repositories** → escolha **culpado_dota2** (só ele).
5. *Permissions* → *Repository permissions* → **Contents: Read and write**. Não mexa em mais nada
   (o *Metadata: Read-only* vem marcado sozinho e é obrigatório). **Não marque Workflows, Administration nem
   nenhuma outra permissão**: sem *Workflows* o token não consegue alterar os robôs (`.github/workflows`).
6. *Generate token* e copie o valor (`github_pat_...`). Ele só aparece uma vez.
7. No Worker da Cloudflare: se o Worker foi criado antes do botão do mapa, primeiro *Edit code* → apague tudo,
   cole o [`coach.js`](coach.js) atual → *Deploy* (o código antigo não tem o `/mapa`). Depois *Settings* →
   *Variables and Secrets* → *Add* → tipo **Secret**, nome **`GITHUB_TOKEN`**, valor = o token → *Deploy*.
8. **Teste**: abra `https://culpado-coach.SEU-USUARIO.workers.dev/saude`. Tem que aparecer `"mapa":true` e
   `"mapaTokenVence"` com a data em que o token vence. `"mapa":false` explica o problema em `"mapaMsg"`
   (por exemplo: o token não enxerga `mapa/falhas.json` = repositório errado ou token sem acesso a ele).
   O `/saude` só confere a **leitura** (o GitHub não diz as permissões do token sem tentar escrever): o primeiro
   pedido pelo botão confirma a escrita. Se ele disser "A chave do robô do mapa venceu ou foi recusada", falta
   o *Read and write* do passo 5. O resultado do `/saude` fica guardado por 1 minuto.
9. Abra no site uma partida sem mapa: o botão aparece (o `config.json` com o endereço do Worker, do passo 5
   lá de cima, já vale para o chat e para o mapa).

**Quando vencer**: o botão para de funcionar e diz "A chave do robô do mapa venceu. Avise o dono do site";
`/saude` mostra `"mapa":false`. Para renovar, em https://github.com/settings/personal-access-tokens abra o
`culpado-mapa` → *Regenerate token* (ou crie outro igual) e troque o valor do segredo `GITHUB_TOKEN` no Worker
(*Deploy*). Um lembrete no calendário uma semana antes da data ajuda.

**O que essa chave permite e por que é seguro o bastante**

- O token fica só no Worker (segredo da Cloudflare): o site e quem usa o site nunca o veem.
- O GitHub só deixa o token ler e escrever **arquivos deste repositório** (`culpado_dota2`). Ele não acessa
  os seus outros repositórios, a sua conta, *Settings*, *Actions* nem segredos.
- O código do Worker só **escreve** em `mapa/pedidos/<id>` (um arquivo de texto com a data do pedido, commit
  "Pedido de mapa: <id>") e só **lê** `mapas/<id>.json`, `mapa/pedidos/<id>`, a lista da pasta `mapa/pedidos`
  e `mapa/falhas.json`. O `<id>` só aceita de 9 a 12 dígitos.
- O robô só gera mapa de **partida com pelo menos um de vocês** (as contas do `amigos.json`). O endereço do
  Worker é público (está no `config.json`); sem essa regra, qualquer partida do mundo viraria 500 KB no
  repositório. Partida de fora fica com "O mapa animado só é gerado para partidas de vocês."
- Limites contra abuso (cada pedido criado = 1 commit + 1 rodada do robô):
  - por internet: **6 partidas diferentes por hora** (`MAPA_POR_HORA`) e **12 pedidos criados por hora**
    (`MAPA_ARQUIVOS_POR_IP`). Pedir de novo a mesma partida depois que o robô a atendeu cria outro commit e
    gasta desses 12 (é o que o site faz sozinho enquanto o OpenDota não libera o replay: 3 vezes, no máximo);
  - no total: **15 pedidos criados por hora** (`MAPA_GLOBAL_POR_HORA`) e no máximo **10 pedidos da mesma
    partida por hora**;
  - esses contam na memória de cada cópia do Worker (a Cloudflare roda várias), então são aproximados. O teto
    que vale para todas as cópias é a **fila do repositório**: com 8 pedidos esperando em `mapa/pedidos`,
    ninguém cria outro ("O robô está com fila cheia, tente em alguns minutos");
  - consultas de andamento: até 20 partidas diferentes por hora por internet, e cada cópia do Worker faz no
    máximo **1500 chamadas por hora à API do GitHub** (`MAPA_GITHUB_POR_HORA`).
  Pedir de novo uma partida que já tem mapa ou que já está na fila não gasta nada nem cria commit. Antes de
  criar o pedido, o Worker confere no OpenDota se a partida existe (`MAPA_CONFERIR_OPENDOTA` = `0` desliga).
  Cada pedido gasta uns 2 minutos de Actions (grátis em repositório público).
- **A cota da API do GitHub é da sua conta**: 5000 chamadas por hora, divididas entre este token, o `gh`, os
  outros tokens e os apps que você autorizou. Um abuso pesado no botão pode gastar essa cota por até 1 hora
  (o botão para nesse tempo e as suas outras ferramentas do GitHub podem receber "rate limit"). O orçamento de
  1500/h por cópia do Worker existe para isso não acontecer com uma cópia só.
- O risco que sobra: se alguém roubasse a Cloudflare do dono, poderia mexer nos arquivos deste repositório
  (o site). Tudo fica no histórico do git e se desfaz com um *revert*; para cortar na hora, apague o token em
  https://github.com/settings/personal-access-tokens.
- Para desligar o botão: apague o segredo `GITHUB_TOKEN` no Worker. O site volta a mostrar só o aviso.

O que o robô faz com o pedido: confere se a partida é de vocês, tenta mesmo que ela já tenha falhado antes,
apaga o pedido e publica `mapas/<id>.json`. Se o OpenDota ainda não liberou o replay (partida acabou de
terminar), o robô pede a análise e espera até 5 minutos na mesma rodada. Se ainda assim não sair, anota o
motivo em `mapa/falhas.json`; o site mostra "Esperando o OpenDota liberar o replay" e pede de novo sozinho
depois de 3, 6 e 10 minutos (no máximo 3 vezes, para não encher o histórico nem o limite de publicações do
GitHub Pages). Se o GitHub Pages demorar para publicar, o site busca o mapa direto pelo Worker
(`GET /mapa/<id>/arquivo`). Entradas do `falhas.json` com mais de 30 dias saem sozinhas.

## Quanto dá para usar

- **Cloudflare (padrão, modelo Gemma 4)**: 10.000 "neurons" grátis por dia para a conta inteira, o que dá
  umas **100 perguntas por dia para o grupo todo** (cada pergunta reenvia os dados da partida). A cota zera
  às **21h de Brasília**. Quando acaba, o chat avisa "Volta hoje às 21h" (ou "amanhã", se já passou das 21h)
  e fica parado até recarregar a página.
- **Gemini (se ligar)**: umas centenas de perguntas por dia (o Google não publica o número). Zera de madrugada.
- **Limite por conexão**: até **40 perguntas por hora por internet** (mude com a variável `POR_HORA`).
  Quem está na mesma casa ou no mesmo 4G divide esse limite. Pergunta que falha antes de responder
  (cota, modelo lotado) não conta.
- **Teto geral**: até **60 perguntas por hora somando todo mundo** (variável `GLOBAL_POR_HORA`), para uma
  rajada não gastar a cota do dia em minutos.
- Esses limites são **aproximados**: ficam na memória do Worker, e a Cloudflare roda várias cópias dele.
  Se alguém abusar mesmo assim, a cota do dia acaba e o oráculo volta às 21h. **Nunca gera conta.**
- O oráculo só lê as últimas 6 perguntas e respostas da conversa e responde curto.

Variáveis opcionais (*Settings* → *Variables and Secrets*, tipo *Text*):
`MODELO` (padrão `@cf/google/gemma-4-26b-a4b-it`; mais barato: `@cf/zai-org/glm-4.7-flash`),
`GEMINI_MODELO` (padrão `gemini-3.5-flash-lite`), `POR_HORA`, `GLOBAL_POR_HORA`,
`ORIGENS` (outros sites que podem usar, separados por vírgula; para testar no seu computador:
`http://localhost:8765`), e do mapa: `GITHUB_REPO` (padrão `Suetam016/culpado_dota2`), `MAPA_POR_HORA`,
`MAPA_ARQUIVOS_POR_IP`, `MAPA_GLOBAL_POR_HORA`, `MAPA_GITHUB_POR_HORA`, `MAPA_CONFERIR_OPENDOTA`.

## Privacidade (avise a galera)

- O Worker manda ao modelo os dados da partida (apelidos, heróis, números) e as perguntas. Nada é guardado no Worker.
- **Gemini grátis**: o Google pode usar as perguntas para treinar modelos e revisores humanos podem lê-las.
  Ninguém deve escrever dado pessoal no chat (o site já avisa embaixo do chat).
  Os termos do Gemini provavelmente exigem 18 anos ou mais (não confirmei): confira em https://ai.google.dev/gemini-api/terms.

## Se algo der errado

- **O chat não aparece na partida**: o `config.json` está vazio ou com uma URL que não começa com `https://`.
- **"Não deu para chamar o oráculo"** (e a internet está ok): a URL do `config.json` está errada ou o Worker
  não foi publicado.
- **"O oráculo não aceitou pedidos deste endereço"**: o site está num endereço que não é
  `suetam016.github.io`; ponha esse endereço na variável `ORIGENS` do Worker.
- **"Não é de um coach"**: o Worker ainda tem o código antigo (o proxy da Anthropic). Cole o `coach.js` novo
  e clique *Deploy*.
- **"O oráculo ainda está dormindo"**: falta o binding `AI` (passo 3); `/saude` mostra `"ok":false`.
- **"O oráculo está lotado" toda hora**: abra *Logs* (ou *Observability*) no Worker. Se aparecer
  "parâmetro recusado pelo modelo", o modelo mudou de formato: troque `MODELO` por
  `@cf/zai-org/glm-4.7-flash` (ou outro da lista do Workers AI). Se aparecer "chave do Gemini recusada",
  confira o segredo `GEMINI_API_KEY`.
- Nos *Logs* também aparecem o modelo usado, os erros e o consumo de cada pergunta.
- **O botão "Gerar o mapa agora" não aparece**: falta o segredo `GITHUB_TOKEN` (ou o Worker tem o código antigo);
  `/saude` mostra `"mapa":false` e o motivo.
- **"A chave do robô do mapa venceu"**: renove o token (veja acima). **"O robô do mapa não respondeu"**: o GitHub
  estava fora ou lento; os *Logs* do Worker mostram a resposta do GitHub.
- **O mapa não sai e o site diz que o robô está demorando**: veja em *Actions* do repositório se o workflow
  "Mapa (posições dos heróis)" rodou e o log dele.
- A tela da Cloudflare muda de vez em quando: se não achar *Bindings*, procure "Workers AI" nas configurações do Worker.
