#!/usr/bin/env node
// Gera amigos/ranking.json rodando o motor de análise do próprio index.html (culpa e craques) sobre a BASE do grupo:
// o branch "dados", onde o robô de coleta guarda a partida crua do OpenDota (partidas/<id>.json.gz) uma única vez.
// Este robô não baixa partida nenhuma. O resultado do motor de cada partida fica guardado na mesma base
// (analises/<id>.json, com a versão do motor): partida já analisada por esta versão do motor não é analisada de novo.
// Só chama o OpenDota para a foto e a medalha de cada amigo, no máximo a cada 12 h. Só biblioteca padrão do Node 18+.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..');
const API = 'https://api.opendota.com/api';
const DADOS = process.env.DADOS || path.join(RAIZ, '.dados');   // checkout do branch "dados"
const DIAS_HISTORICO = 365;   // igual ao parceiros.py: partida mais velha que isso é outro patch, outro meta
const PERFIS_HORAS = 12;
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
  // a versão do motor é o próprio código: mudou o motor, as análises guardadas viram velhas e são refeitas
  const versao = crypto.createHash('sha1').update(scripts[0]).digest('hex').slice(0, 12);
  return Object.assign(ctx.module.exports, { versao });
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

async function pedir(caminho) {
  const chave = process.env.OPENDOTA_API_KEY;
  const url = `${API}${caminho}${chave ? `${caminho.includes('?') ? '&' : '?'}api_key=${chave}` : ''}`;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'culpado-dota2-ranking/1.0' } });
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

// o que o motor disse de uma partida, só com o que interessa guardar (para o ranking e para modelos depois)
function resumoDaAnalise(r, doLado) {
  const contas = new Set(doLado.map((p) => p.account_id));
  return {
    venceu: r.partida.venceu,
    duracao: r.partida.duracao,
    culpados: culpadosDe(r).map((v) => v.jogador.conta),
    craques: craquesDe(r).map((c) => c.jogador.conta),
    amigos: [...contas],
    jogadores: (r.vereditos || []).map((v) => ({
      conta: v.jogador.conta ?? null, heroi: v.jogador.heroi.id, posicao: v.jogador.posicao || null,
      culpa: Math.round(v.fatia * 1000) / 1000, pontos: v.score,
      componentes: (v.componentes || []).map((c) => [c.key, c.pontos]),
    })),
    merito: (r.craques || []).map((c) => ({ conta: c.jogador.conta ?? null, fatia: Math.round(c.fatia * 1000) / 1000 })),
  };
}

async function main() {
  const motor = carregarMotor();
  const { h: heroes, i: items, ids: itemIds } = dadosEmbutidos();
  const rotas = fs.existsSync(path.join(RAIZ, 'rotas', 'base.json'))
    ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'rotas', 'base.json'), 'utf8'))
    : null;
  const amigos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'amigos.json'), 'utf8'));
  const idsAmigos = new Set(Object.keys(amigos).map(Number));
  const saida = path.join(RAIZ, 'amigos', 'ranking.json');
  const anterior = fs.existsSync(saida) ? JSON.parse(fs.readFileSync(saida, 'utf8')) : {};

  if (!fs.existsSync(path.join(DADOS, 'indice.json'))) {
    console.error(`sem a base em ${DADOS} (indice.json): ranking.json fica como está`);
    process.exit(1);
  }
  const indice = JSON.parse(fs.readFileSync(path.join(DADOS, 'indice.json'), 'utf8'));
  const pastaAnalises = path.join(DADOS, 'analises');
  fs.mkdirSync(pastaAnalises, { recursive: true });

  const desde = Date.now() / 1000 - DIAS_HISTORICO * 86400;
  const historicos = Object.fromEntries(Object.keys(amigos).map((k) => [k, []]));
  const conta = { reaproveitadas: 0, analisadas: 0, semAnalise: 0, falhas: 0 };
  for (const [mid, info] of Object.entries(indice)) {
    const contas = [...(info.radiant || []), ...(info.dire || [])].filter((c) => idsAmigos.has(c));
    if (!contas.length || (info.inicio || 0) < desde) continue;
    if (!info.analisada) { conta.semAnalise++; continue; }   // o robô de coleta pede a análise e volta a olhar
    const arqAnalise = path.join(pastaAnalises, `${mid}.json`);
    let analise = null;
    if (fs.existsSync(arqAnalise)) {
      try { analise = JSON.parse(fs.readFileSync(arqAnalise, 'utf8')); } catch (e) { analise = null; }
    }
    const faltaLado = (a) => ['radiant', 'dire'].some((lado) => (info[lado] || []).some((c) => idsAmigos.has(c)) && !(a.lados || {})[lado]);
    if (analise && analise.motor === motor.versao && !faltaLado(analise)) {
      conta.reaproveitadas++;
    } else {
      const arqPartida = path.join(DADOS, 'partidas', `${mid}.json.gz`);
      if (!fs.existsSync(arqPartida)) continue;
      let match;
      try { match = JSON.parse(zlib.gunzipSync(fs.readFileSync(arqPartida))); } catch (e) { console.error(`  ${mid}: arquivo ilegível`); continue; }
      if (!match || !Array.isArray(match.players) || match.version == null) continue;
      analise = { matchId: Number(mid), motor: motor.versao, analisadaEm: new Date().toISOString(), inicio: match.start_time,
        ranqueada: match.lobby_type === LOBBY_RANQUEADA, lados: {} };
      for (const lado of ['radiant', 'dire']) {
        const doLado = match.players.filter((p) => idsAmigos.has(p.account_id) && p.isRadiant === (lado === 'radiant'));
        if (!doLado.length) continue;
        try {
          const r = motor.analisar({ match, heroes, items, itemIds, amigos, rotas, timings: {}, matchups: {}, duracoes: {}, mapa: null }, { lado });
          analise.lados[lado] = resumoDaAnalise(r, doLado);
        } catch (erro) {
          console.error(`  partida ${mid} (${lado}): motor falhou (${erro.message})`);
          conta.falhas++;
        }
      }
      fs.writeFileSync(arqAnalise, JSON.stringify(analise));
      conta.analisadas++;
    }
    for (const [lado, a] of Object.entries(analise.lados || {})) {
      for (const c of a.amigos) {
        if (!historicos[String(c)]) continue;
        const tipo = a.venceu ? (a.craques.includes(c) ? 'craque' : 'vitoria') : (a.culpados.includes(c) ? 'culpado' : 'derrota');
        const eu = (a.jogadores || []).find((j) => j.conta === c) || {};
        historicos[String(c)].push({ matchId: analise.matchId, lado, tipo, inicio: analise.inicio, comStack: a.amigos.length >= 2, ranqueada: analise.ranqueada,
          heroi: eu.heroi ?? null, culpa: eu.culpa ?? null, merito: ((a.merito || []).find((m) => m.conta === c) || {}).fatia ?? null });
      }
    }
  }
  // partidas que só existem no ranking antigo (de quando este robô baixava direto do OpenDota) não se perdem
  let legado = 0;
  for (const [c, xs] of Object.entries(anterior.historicos || {})) {
    if (!historicos[c]) continue;
    for (const e of xs) {
      if (!(String(e.matchId) in indice) && (e.inicio || 0) >= desde) { historicos[c].push(e); legado++; }
    }
  }
  if (legado) console.log(`${legado} julgamentos do ranking antigo que não estão na base foram mantidos`);
  console.log(`base: ${conta.reaproveitadas} análises reaproveitadas, ${conta.analisadas} feitas agora (motor ${motor.versao}), ${conta.semAnalise} partidas ainda sem a análise do OpenDota, ${conta.falhas} falhas`);

  // foto da Steam e medalha atual de cada um (para a corrida de elo): só a cada PERFIS_HORAS
  let perfis = anterior.perfis || {};
  let perfisEm = anterior.perfisEm || null;
  const perfisVelhos = !perfisEm || Date.now() - Date.parse(perfisEm) > PERFIS_HORAS * 3600e3 || Object.keys(amigos).some((k) => !perfis[k]);
  if (perfisVelhos) {
    const novos = {};
    for (const conta_ of Object.keys(amigos)) {
      const p = await pedir(`/players/${conta_}`);
      await sleep(PAUSA_MS);
      novos[conta_] = p ? {
        avatar: (p.profile && (p.profile.avatarfull || p.profile.avatarmedium)) || null,
        rankTier: p.rank_tier || null,
        leaderboard: p.leaderboard_rank || null,
      } : perfis[conta_] || null;
    }
    perfis = novos;
    perfisEm = new Date().toISOString();
  }

  const ranking = Object.entries(amigos).map(([conta_, nome]) => {
    const eventos = historicos[conta_].sort((a, b) => (a.inicio || 0) - (b.inicio || 0));
    const culpados = eventos.filter((e) => e.tipo === 'culpado').length;
    const craques = eventos.filter((e) => e.tipo === 'craque').length;
    const partidasN = eventos.length;
    const vitorias = eventos.filter((e) => e.tipo === 'vitoria' || e.tipo === 'craque').length;
    const ranqueadas = eventos.filter((e) => e.ranqueada);
    const vitoriasRanq = ranqueadas.filter((e) => e.tipo === 'vitoria' || e.tipo === 'craque').length;
    return {
      accountId: conta_,
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
    console.error('Nenhuma partida julgada; ranking.json fica como está.');
    process.exit(1);
  }

  // só regrava (e só gera commit) se algo mudou de verdade
  const conteudo = { semAnalise: conta.semAnalise, ranking, historicos, perfis, perfisEm };
  const igual = JSON.stringify(conteudo) === JSON.stringify({ semAnalise: anterior.semAnalise, ranking: anterior.ranking, historicos: anterior.historicos, perfis: anterior.perfis, perfisEm: anterior.perfisEm });
  if (igual) { console.log('ranking.json: nada mudou'); return; }
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, JSON.stringify({ atualizadoEm: new Date().toISOString(), ...conteudo }, null, 2), 'utf8');
  console.log(`Ranking salvo: ${saida}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
