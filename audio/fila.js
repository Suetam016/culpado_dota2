#!/usr/bin/env node
// Monta a fila do robô do áudio da vitória: para cada vitória, roda o motor do index.html (o mesmo do ranking),
// tira os fatos da partida e escreve o roteiro (audio/roteiro.js). A voz sai depois, no audio/falar.py.
//
//   node audio/fila.js [--max N] [--dias D]
//
// Entram primeiro os pedidos do site (audio/pedidos/<id>, partida de qualquer pessoa: vem do OpenDota) e depois as
// vitórias do grupo dos últimos D dias que ainda não têm áudio (vêm da base, branch "dados", em .dados).
// Escreve audio/fila.json: [{id, lado, arquivo, texto, eu, conta, heroi, fatia, pedido}] e imprime fila=<n> para o workflow.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { carregarMotor, dadosEmbutidos } = require('../ranking/gerar.js');
const Roteiro = require('./roteiro.js');

const RAIZ = path.resolve(__dirname, '..');
const DADOS = process.env.DADOS || path.join(RAIZ, '.dados');
const PASTA = path.join(RAIZ, 'audios');
const PEDIDOS = path.join(__dirname, 'pedidos');
const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? Number(process.argv[i + 1]) : padrao;
};
const MAX = arg('max', 3);
const DIAS = arg('dias', 3);

const ler = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const temAudio = (id, lado) => fs.existsSync(path.join(PASTA, `${id}-${lado}.json`));

async function baixar(id) {
  const chave = process.env.OPENDOTA_API_KEY ? `?api_key=${process.env.OPENDOTA_API_KEY}` : '';
  const r = await fetch(`https://api.opendota.com/api/matches/${id}${chave}`);
  if (!r.ok) throw new Error(`OpenDota ${r.status}`);
  return r.json();
}

async function main() {
  const motor = carregarMotor();
  const { h: heroes, i: items, ids: itemIds } = dadosEmbutidos();
  const rotas = fs.existsSync(path.join(RAIZ, 'rotas', 'base.json')) ? ler(path.join(RAIZ, 'rotas', 'base.json')) : null;
  const amigos = ler(path.join(RAIZ, 'amigos.json'));
  const idsAmigos = new Set(Object.keys(amigos).map(Number));
  const indice = fs.existsSync(path.join(DADOS, 'indice.json')) ? ler(path.join(DADOS, 'indice.json')) : {};

  const candidatos = [];
  // 1) pedidos do site (quem pediu está esperando na página)
  const pedidos = fs.existsSync(PEDIDOS) ? fs.readdirSync(PEDIDOS).filter((f) => /^\d+$/.test(f)) : [];
  for (const id of pedidos) candidatos.push({ id, pedido: true });
  // 2) vitórias do grupo dos últimos dias, das mais novas para as mais velhas
  const desde = Date.now() / 1000 - DIAS * 86400;
  Object.entries(indice)
    .filter(([, info]) => (info.inicio || 0) >= desde && info.radiant_venceu != null)
    .sort((a, b) => b[1].inicio - a[1].inicio)
    .forEach(([id, info]) => {
      const lado = info.radiant_venceu ? 'radiant' : 'dire';
      if ((info[lado] || []).some((c) => idsAmigos.has(c)) && !temAudio(id, lado)) candidatos.push({ id, lado });
    });

  const fila = [];
  for (const c of candidatos) {
    if (fila.length >= MAX) break;
    let match;
    try {
      const arq = path.join(DADOS, 'partidas', `${c.id}.json.gz`);
      match = fs.existsSync(arq) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(arq))) : await baixar(c.id);
    } catch (e) {
      console.error(`${c.id}: sem a partida (${e.message})`);
      continue;
    }
    if (!match || !Array.isArray(match.players) || match.radiant_win == null) { console.error(`${c.id}: partida incompleta`); continue; }
    const lado = c.lado || (match.radiant_win ? 'radiant' : 'dire');
    if (c.pedido && temAudio(c.id, lado)) { fila.push({ id: c.id, lado, pedido: true, jaTem: true }); continue; }
    try {
      const r = motor.analisar({ match, heroes, items, itemIds, amigos, rotas, timings: {}, matchups: {}, duracoes: {}, mapa: null }, { lado });
      const f = Roteiro.fatos(r);
      if (!f) { console.error(`${c.id}: sem craque`); continue; }
      const g = Roteiro.gerar(f, `${c.id}-${lado}`);
      fila.push({ id: c.id, lado, arquivo: `${c.id}-${lado}`, texto: g.texto, partes: g.partes, eu: f.eu, conta: f.conta,
        heroi: f.heroi, fatia: f.fatia, pedido: !!c.pedido });
      console.log(`${c.id} ${lado} (${f.eu}, ${f.heroi}, ${f.fatia}%): ${g.texto}`);
    } catch (e) {
      console.error(`${c.id}: motor falhou (${e.message})`);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'fila.json'), JSON.stringify(fila, null, 1));
  const n = fila.filter((x) => !x.jaTem).length;
  console.log(`fila=${n} (pedidos: ${pedidos.length})`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `fila=${n}\npedidos=${pedidos.length}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
