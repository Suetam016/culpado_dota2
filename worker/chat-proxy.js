// Proxy do chat do coach (Cloudflare Worker).
// Guarda a chave da API da Anthropic como segredo (ANTHROPIC_API_KEY) e repassa as perguntas do site para
// api.anthropic.com. O site chama este Worker como se fosse a API (baseURL do SDK), então aqui só tem repasse
// com limites: só o site pode usar, só o modelo do coach, teto de tokens e um limite de perguntas por pessoa.
const ORIGENS = ['https://suetam016.github.io'];
const MODELOS = new Set(['claude-opus-5-5']);
const MAX_TOKENS = 8000;
const MAX_CORPO = 300_000; // bytes: contexto da partida + conversa
const POR_HORA = 40; // perguntas por IP por hora (memória do Worker; suficiente para um grupo de amigos)
const contagem = new Map();

function cors(origem) {
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(origem) ? origem : ORIGENS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function recusa(status, mensagem, origem) {
  return new Response(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: mensagem } }), {
    status,
    headers: { 'content-type': 'application/json', ...cors(origem) },
  });
}

export default {
  async fetch(req, env) {
    const origem = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origem) });
    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/v1/messages') return recusa(404, 'só /v1/messages', origem);
    if (!ORIGENS.includes(origem)) return recusa(403, 'origem não autorizada', origem);
    if (!env.ANTHROPIC_API_KEY) return recusa(500, 'falta o segredo ANTHROPIC_API_KEY no Worker', origem);

    const ip = req.headers.get('CF-Connecting-IP') || 'anon';
    const hora = Math.floor(Date.now() / 3_600_000);
    const chave = `${ip}:${hora}`;
    const n = (contagem.get(chave) || 0) + 1;
    contagem.set(chave, n);
    if (contagem.size > 5000) contagem.clear();
    if (n > POR_HORA) return recusa(429, 'muitas perguntas nesta hora; tente mais tarde', origem);

    const texto = await req.text();
    if (texto.length > MAX_CORPO) return recusa(413, 'conversa grande demais', origem);
    let corpo;
    try {
      corpo = JSON.parse(texto);
    } catch {
      return recusa(400, 'JSON inválido', origem);
    }
    if (!MODELOS.has(corpo.model)) return recusa(400, 'modelo não permitido', origem);
    corpo.max_tokens = Math.min(Number(corpo.max_tokens) || 1024, MAX_TOKENS);

    const headers = {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': req.headers.get('anthropic-version') || '2023-06-01',
    };
    const beta = req.headers.get('anthropic-beta');
    if (beta) headers['anthropic-beta'] = beta;
    const resp = await fetch(`https://api.anthropic.com/v1/messages${url.search}`, { method: 'POST', headers, body: JSON.stringify(corpo) });
    const saida = new Headers(resp.headers);
    for (const [k, v] of Object.entries(cors(origem))) saida.set(k, v);
    return new Response(resp.body, { status: resp.status, headers: saida });
  },
};
