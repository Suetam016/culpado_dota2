# Ligar o chat do coach para todo mundo (5 minutos, grátis no Cloudflare)

O chat do site usa o Claude pela API da Anthropic. A chave da API **não pode** ficar no site (qualquer um
copiaria), então ela fica guardada num Cloudflare Worker, que só repassa as perguntas do site.

1. **Chave da API**: em https://console.anthropic.com/settings/keys crie uma chave (`sk-ant-...`).
   Em *Billing* coloque crédito e, em *Limits*, um limite de gasto mensal (ex.: US$ 10) para não ter surpresa.
2. **Worker**: crie uma conta grátis em https://dash.cloudflare.com → *Workers & Pages* → *Create* →
   *Create Worker* → dê um nome (ex.: `culpado-chat`) → *Deploy* → *Edit code*. Apague o código de exemplo,
   cole o conteúdo de `worker/chat-proxy.js` e clique *Deploy*.
3. **Segredo**: no Worker, *Settings* → *Variables and Secrets* → *Add* → tipo *Secret*,
   nome `ANTHROPIC_API_KEY`, valor = a chave do passo 1 → *Deploy*.
4. **Me passe a URL do Worker** (algo como `https://culpado-chat.SEU-USUARIO.workers.dev`). Eu publico o site
   com ela (`CULPADO_CHAT_PROXY=<url> python3 painel/build.py`) e o chat passa a funcionar para todo mundo,
   sem ninguém precisar de chave.

Limites que o Worker já aplica: só aceita pedidos vindos de suetam016.github.io, só o modelo do coach,
no máximo 8 mil tokens por resposta e 40 perguntas por hora por pessoa.

Enquanto o Worker não existir, quem quiser pode usar a própria chave no chat (ela fica só no navegador dela).
