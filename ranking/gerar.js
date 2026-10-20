#!/usr/bin/env node
// Gera amigos/ranking.json rodando o motor de análise do próprio index.html (culpa e craques) sobre as partidas
// analisadas dos amigos na OpenDota. Só biblioteca padrão do Node 18+.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
// partidas baixadas aqui ficam para o parceiros.py (--recentes): o robô de coleta pode estar horas atrás
const RECENTES = path.join(RAIZ, '.recentes');
const API = 'https://api.opendota.com/api';
const PARTIDAS_POR_AMIGO = 60;   // só baixa o detalhe das que ainda não foram julgadas
const DADOS = path.join(RAIZ, '.dados');   // branch "dados" do robô de coleta (o workflow faz checkout aqui)
const MAX_PEDIDOS_ANALISE = 40;
const DIAS_HISTORICO = 365;   // igual ao parceiros.py: partida mais velha que isso é outro patch, outro meta
const PAUSA_MS = 1100;
const EMPATE_TECNICO = 0.05;
const LOBBY_RANQUEADA = 7;
// A Valve não expõe o MMR de cada partida; ±25 é a variação típica de uma ranqueada (é uma estimativa)
const MMR_POR_PARTIDA = 25;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function carregarMotor() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*src)([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/type="application\/json"/.test(m[1]))
    .map((m) => m[2])
    .filter((s) => s.includes('motor de análise de partidas'));
  if (scripts.length !== 1) throw new Error('motor do index.html não encontrado');

  const stub = () => new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : stub()),
    apply: () => stub(),
    construct: () => stub(),
    set: () => true,
  });
  const ctx = {
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, JSON, Math, Date, Map, Set, Intl,
    document: stub(), localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { hash: '', search: '', href: '', pathname: '/' }, navigator: {},
    history: { replaceState() {}, pushState() {} }, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    module: { exports: {} },
  };
  for (const g of ['Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'MutationObserver', 'Image', 'Audio', 'AudioContext',
    'Blob', 'URL', 'URLSearchParams', 'performance', 'TextEncoder', 'TextDecoder', 'atob', 'btoa', 'ResizeObserver',
    'IntersectionObserver', 'Worker', 'Notification', 'getComputedStyle', 'customElements', 'DOMParser', 'FileReader',
    'AbortController', 'Response', 'Request', 'Headers']) ctx[g] = stub();
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  ctx.exports = ctx.module.exports;
  vm.createContext(ctx);
  vm.runInContext(scripts[0], ctx, { timeout: 60000 });
  return ctx.module.exports;
}

// Mesmo formato que o painel passa ao motor (expandirConstantes do index.html): sem isso o motor não acha o
// nome interno dos heróis e perde a linha do tempo das mortes.
function dadosEmbutidos() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const m = html.match(/<script type="application\/json" id="dados-embutidos">([\s\S]*?)<\/script>/);
  const c = JSON.parse(m[1]).constantes;
  const h = {};
  const i = {};
  const ids = { ...(c.ids || {}) };
  for (const [id, [nome, localizado, attr, ataque]] of Object.entries(c.h || {})) {
    h[id] = { name: `npc_dota_hero_${nome}`, localized_name: localizado, primary_attr: attr, attack_type: ataque };
  }
  for (const [key, [id, dname, cost, components]] of Object.entries(c.i || {})) {
    i[key] = { id, dname, cost, components: components || null };
    if (id != null && !(id in ids)) ids[id] = key;
  }
  return { h, i, ids };
}

async function pedir(caminho, metodo = 'GET') {
  const chave = process.env.OPENDOTA_API_KEY;
  const url = `${API}${caminho}${chave ? `${caminho.includes('?') ? '&' : '?'}api_key=${chave}` : ''}`;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const resp = await fetch(url, { method: metodo, headers: { 'User-Agent': 'culpado-dota2-ranking/1.0' } });
      if (resp.ok) return resp.json();
      console.error(`  ${caminho}: HTTP ${resp.status}`);
    } catch (erro) {
      console.error(`  ${caminho}: ${erro.message}`);
    }
    await sleep(PAUSA_MS * (tentativa + 2));
  }
  return null;
}

function culpadosDe(r) {
  const vs = r.vereditos || [];
  return vs.length > 1 && vs[0].fatia - vs[1].fatia < EMPATE_TECNICO ? [vs[0], vs[1]] : vs.slice(0, 1);
}

function craquesDe(r) {
  const vs = r.craques || [];
  return vs.length > 1 && vs[0].fatia - vs[1].fatia < EMPATE_TECNICO ? [vs[0], vs[1]] : vs.slice(0, 1);
}

function sequencia(tipos) {
  const decisivos = tipos.filter((t) => t === 'culpado' || t === 'craque');
  if (decisivos.length < 2) return null;
  const ultimo = decisivos[decisivos.length - 1];
  let n = 0;
  for (let i = decisivos.length - 1; i >= 0 && decisivos[i] === ultimo; i--) n++;
  return n >= 2 ? ultimo : null;
}

async function main() {
  const motor = carregarMotor();
  const { h: heroes, i: items, ids: itemIds } = dadosEmbutidos();
  const rotas = fs.existsSync(path.join(RAIZ, 'rotas', 'base.json'))
    ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'rotas', 'base.json'), 'utf8'))
    : null;
  const amigos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'amigos.json'), 'utf8'));
  const idsAmigos = new Set(Object.keys(amigos).map(Number));

  // foto da Steam e medalha atual de cada um (para a corrida de elo)
  const perfis = {};
  for (const conta of Object.keys(amigos)) {
    const p = await pedir(`/players/${conta}`);
    await sleep(PAUSA_MS);
    if (!p) continue;
    perfis[conta] = {
      avatar: (p.profile && (p.profile.avatarfull || p.profile.avatarmedium)) || null,
      rankTier: p.rank_tier || null,
      leaderboard: p.leaderboard_rank || null,
    };
  }

  // O histórico se acumula: parte do ranking.json anterior e só julga partida nova (antes recomeçava do zero com as
  // últimas 20 de cada um, e quem jogava muito perdia os jogos mais antigos).
  const saida = path.join(RAIZ, 'amigos', 'ranking.json');
  const anterior = fs.existsSync(saida) ? JSON.parse(fs.readFileSync(saida, 'utf8')) : {};
  const historicos = Object.fromEntries(Object.keys(amigos).map((k) => [k, ((anterior.historicos || {})[k] || []).slice()]));
  const jaTem = new Set(Object.entries(historicos).flatMap(([k, xs]) => xs.map((e) => `${e.matchId}:${k}`)));
  const faltaAlguem = (match) => match.players.some((p) => idsAmigos.has(p.account_id) && !jaTem.has(`${match.match_id}:${p.account_id}`));
  const partidas = new Map();
  let semReplay = 0;
  let novas = 0;
  let pedidosAnalise = 0;

  const julgar = (match) => {
    const mid = match.match_id;
    const amigosNaPartida = match.players.filter((p) => idsAmigos.has(p.account_id));
    for (const lado of ['radiant', 'dire']) {
      const doLado = amigosNaPartida.filter((p) => p.isRadiant === (lado === 'radiant'));
      if (!doLado.some((p) => !jaTem.has(`${mid}:${p.account_id}`))) continue;
      let r;
      try {
        r = motor.analisar({ match, heroes, items, itemIds, amigos, rotas, timings: {}, matchups: {}, duracoes: {}, mapa: null }, { lado });
      } catch (erro) {
        console.error(`  partida ${mid}: motor falhou (${erro.message})`);
        continue;
      }
      const culpados = new Set(culpadosDe(r).map((v) => v.jogador.conta));
      const craques = new Set(craquesDe(r).map((c) => c.jogador.conta));
      const venceu = r.partida.venceu;
      const comStack = doLado.length >= 2;
      for (const p of doLado) {
        const chave = `${mid}:${p.account_id}`;
        if (jaTem.has(chave)) continue;
        const tipo = venceu
          ? (craques.has(p.account_id) ? 'craque' : 'vitoria')
          : (culpados.has(p.account_id) ? 'culpado' : 'derrota');
        historicos[String(p.account_id)].push({ matchId: mid, lado, tipo, inicio: match.start_time, comStack, ranqueada: match.lobby_type === LOBBY_RANQUEADA });
        jaTem.add(chave);
        novas++;
      }
    }
  };

  // 1) o que o robô de coleta já baixou (branch dados): partida analisada com amigo que ainda não foi julgada
  const indice = fs.existsSync(path.join(DADOS, 'indice.json')) ? JSON.parse(fs.readFileSync(path.join(DADOS, 'indice.json'), 'utf8')) : {};
  for (const [mid, info] of Object.entries(indice)) {
    if (!info.analisada || (info.inicio || 0) < Date.now() / 1000 - DIAS_HISTORICO * 86400) continue;
    const contas = [...(info.radiant || []), ...(info.dire || [])].filter((c) => idsAmigos.has(c));
    if (!contas.some((c) => !jaTem.has(`${mid}:${c}`))) continue;
    const arq = path.join(DADOS, 'partidas', `${mid}.json.gz`);
    if (!fs.existsSync(arq)) continue;
    try {
      const match = JSON.parse(zlib.gunzipSync(fs.readFileSync(arq)));
      if (match && Array.isArray(match.players) && match.version != null) { partidas.set(Number(mid), match); julgar(match); }
    } catch (erro) { console.error(`  ${arq}: ${erro.message}`); }
  }
  console.log(`branch dados: ${novas} julgamentos novos`);

  // 2) as partidas recentes de cada amigo no OpenDota (o robô de coleta pode estar horas atrás)
  for (const [conta, nome] of Object.entries(amigos)) {
    console.log(`${nome}: buscando partidas`);
    const lista = (await pedir(`/players/${conta}/matches?limit=${PARTIDAS_POR_AMIGO}`)) || [];
    await sleep(PAUSA_MS);
    for (const meta of lista) {
      const mid = meta.match_id;
      if (jaTem.has(`${mid}:${conta}`)) continue;
      if (!partidas.has(mid)) {
        const detalhe = await pedir(`/matches/${mid}`);
        await sleep(PAUSA_MS);
        if (!detalhe || !Array.isArray(detalhe.players)) continue;
        fs.mkdirSync(RECENTES, { recursive: true });
        fs.writeFileSync(path.join(RECENTES, `${mid}.json`), JSON.stringify(detalhe));
        if (detalhe.version == null) {
          // sem a análise do replay: pede ao OpenDota e ela entra numa próxima rodada
          semReplay++;
          partidas.set(mid, null);
          if (pedidosAnalise < MAX_PEDIDOS_ANALISE && Date.now() / 1000 - (detalhe.start_time || 0) < 14 * 86400) {
            pedidosAnalise++;
            await pedir(`/request/${mid}`, 'POST');
            await sleep(PAUSA_MS);
          }
          continue;
        }
        partidas.set(mid, detalhe);
      }
      const match = partidas.get(mid);
      if (match && faltaAlguem(match)) julgar(match);
    }
  }

  const ranking = Object.entries(amigos).map(([conta, nome]) => {
    const eventos = historicos[conta].sort((a, b) => (a.inicio || 0) - (b.inicio || 0));
    const culpados = eventos.filter((e) => e.tipo === 'culpado').length;
    const craques = eventos.filter((e) => e.tipo === 'craque').length;
    const partidasN = eventos.length;
    const vitorias = eventos.filter((e) => e.tipo === 'vitoria' || e.tipo === 'craque').length;
    const ranqueadas = eventos.filter((e) => e.ranqueada);
    const vitoriasRanq = ranqueadas.filter((e) => e.tipo === 'vitoria' || e.tipo === 'craque').length;
    return {
      accountId: conta,
      nome,
      culpados,
      craques,
      partidas: partidasN,
      vitorias,
      winRate: partidasN ? Math.round((vitorias / partidasN) * 100) : 0,
      streak: sequencia(eventos.map((e) => e.tipo)),
      mmrGanho: vitoriasRanq * MMR_POR_PARTIDA,
      mmrPerdido: (ranqueadas.length - vitoriasRanq) * MMR_POR_PARTIDA,
    };
  }).sort((a, b) => b.culpados - a.culpados);

  if (!Object.values(historicos).some((xs) => xs.length)) {
    // OpenDota fora do ar ou sem cota e nada guardado: não troca o ranking bom anterior por um vazio
    console.error('Nenhuma partida julgada; ranking.json fica como está.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, JSON.stringify({
    atualizadoEm: new Date().toISOString(),
    semAnalise: semReplay, // partidas recentes sem a análise do replay no OpenDota: entram numa próxima rodada
    ranking,
    historicos,
    perfis,
  }, null, 2), 'utf8');
  console.log(`Ranking salvo: ${saida} (${novas} julgamentos novos, ${semReplay} partidas ainda sem análise, ${pedidosAnalise} análises pedidas)`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
