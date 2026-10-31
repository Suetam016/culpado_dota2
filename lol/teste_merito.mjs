// Testes do mérito e do elo da atuação no LoL: node lol/teste_merito.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const M = require('./merito.js');
const L = require('./julgar.js');

const pos = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const jogadores = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, teamId: i < 5 ? 100 : 200, teamPosition: pos[i % 5], win: i < 5,
  kills: 2, deaths: 2, assists: 2, visionScore: 20, challenges: { teamDamagePercentage: 0.2, killParticipation: 0.5, kda: 2, goldPerMinute: 400, visionScorePerMinute: 0.8 } }));
jogadores[3].challenges = { teamDamagePercentage: 0.4, killParticipation: 0.8, kda: 9, goldPerMinute: 600, visionScorePerMinute: 0.5 };
jogadores[4].visionScore = 70;
jogadores[4].totalHealsOnTeammates = 5000;
const quadros = Array.from({ length: 16 }, (_, m) => ({ t: m * 60, p: Object.fromEntries(jogadores.map((j) => [j.id, [0, 0, 500 + m * 300 + (j.id === 4 ? m * 100 : 0), 0, 0, 1, 0]])) }));
const eventos = [
  { tipo: 'abate', t: 300, morreu: 9, matou: 4, assist: [5], recompensa: 300 },
  { tipo: 'abate', t: 900, morreu: 7, matou: 4, assist: [2], recompensa: 400 },
  { tipo: 'monstro', t: 1000, monstro: 'BARON_NASHOR', time: 100, quem: 2 },
  { tipo: 'monstro', t: 1100, monstro: 'DRAGON', time: 200, quem: 7 },            // do time deles: não conta
  { tipo: 'estrutura', t: 1200, estrutura: 'TOWER_BUILDING', dono: 200, quem: 4 },
];
const partida = { duracao: 1800, jogadores, quadros, eventos };
const m = M.merito(partida, 100, null);
assert.equal(m.craques.length, 1);
assert.equal(m.craques[0].jogador.id, 4);
const keys = m.craques[0].brilhou.map((b) => b.key);
assert.deepEqual(keys, ['dano', 'abates', 'rota', 'objetivos']);
assert.equal(m.craques[0].brilhou[1].evidencia, '2 abates e 0 assistências que renderam 700 de ouro ao time.');
const cacador = m.lista.find((x) => x.jogador.id === 2);
assert.equal(cacador.brilhou.find((b) => b.key === 'objetivos').evidencia, 'Golpe final em Barão.');
const sup = m.lista.find((x) => x.jogador.id === 5);
assert.deepEqual(sup.brilhou.map((b) => b.key).sort(), ['abates', 'protecao', 'visao']);
assert.ok(Math.abs(m.lista.reduce((s, x) => s + x.fatia, 0) - 1) < 1e-9);

// elo: quem jogou muito acima dos outros fica lá em cima; todo mundo recebe um
const e = M.elos(partida);
assert.equal(e.size, 10);
assert.ok(e.get(4).indice >= 8, e.get(4).nome);
assert.ok(e.get(9).indice < e.get(4).indice);

// partidas reais: toda vitória tem craque com prova
const idx = JSON.parse(fs.readFileSync(new URL('./indice.json', import.meta.url)));
const puuid = Object.values(idx.jogadores)[0].puuid;
for (const f of fs.readdirSync(new URL('./partidas/', import.meta.url))) {
  const p = JSON.parse(fs.readFileSync(new URL('./partidas/' + f, import.meta.url)));
  if (p.duracao < 300) continue;
  const r = L.julgar(p, puuid);
  if (!r.venceu) continue;
  const mm = M.merito(p, r.timeNos, L.chanceDeVitoria(p, r.timeNos));
  assert.ok(mm.craques[0].brilhou.length, f);
}
console.log('ok: mérito');
