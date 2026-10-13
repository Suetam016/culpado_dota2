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
`http://localhost:8765`).

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
- A tela da Cloudflare muda de vez em quando: se não achar *Bindings*, procure "Workers AI" nas configurações do Worker.
