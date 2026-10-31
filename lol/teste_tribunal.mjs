// Testes do tribunal do LoL: node lol/teste_tribunal.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const T = require('./tribunal.js');
const L = require('./julgar.js');

// o pior lance: a morte que mais derrubou a chance, com os objetivos que vieram depois
const j = { id: 3, championName: 'Ahri' };
const zed = { id: 7, championName: 'Zed' };
const m1 = { tipo: 'abate', t: 600, morreu: 3, matou: 7, recompensa: 300, x: 7400, y: 7400 };
const m2 = { tipo: 'abate', t: 1300, morreu: 3, matou: 7, recompensa: 400, x: 5000, y: 10400 };
const barao = { tipo: 'monstro', monstro: 'BARON_NASHOR', t: 1320 };
const cv = { lances: [
  { t: 600, morte: m1, matou: zed, nossaMorte: true, antes: 0.5, depois: 0.47, delta: -0.03, objetivos: [] },
  { t: 1300, morte: m2, matou: zed, nossaMorte: true, antes: 0.55, depois: 0.31, delta: -0.24, objetivos: [barao] },
] };
const pl = T.piorLance(j, cv, L);
assert.equal(pl.t, 1300);
assert.equal(pl.ouro, 1900);
assert.equal(pl.texto, 'Aos 21:40 morreu para Zed no Barão. Logo depois os inimigos pegaram Barão. A chance de vitória foi de 55% para 31%, e o lance custou 1.900 de ouro.');

// a dica sai do que mais pesou fora as mortes; a build entra como segunda dica
const v = { jogador: j, mortes: [m1, m2], componentes: [
  { key: 'mortes', pontos: 3, evidencia: 'Morreu 2 vezes.' },
  { key: 'sozinho', pontos: 0.6, evidencia: '2 mortes sem nenhuma luta por perto (10:00, 21:40).' }] };
const d = T.dica(v, { sugestoes: [{ nome: 'Véu da Banshee', motivo: 'resistência mágica' }] }, L);
assert.ok(d[0].startsWith('2 mortes sem nenhuma luta por perto'));
assert.equal(d[1], 'Na build, faltou Véu da Banshee: resistência mágica.');
// só mortes: fala de onde morreu
v.componentes = v.componentes.slice(0, 1);
v.mortes = [m1, { ...m2, x: 7000, y: 7000 }];
assert.ok(T.dica(v, null, L)[0].startsWith('2 das 2 mortes foram no meio'));
// ninguém sem dica e sem lance quebrado nas partidas reais
const idx = JSON.parse(fs.readFileSync(new URL('./indice.json', import.meta.url)));
const puuid = Object.values(idx.jogadores)[0].puuid;
for (const f of fs.readdirSync(new URL('./partidas/', import.meta.url))) {
  const p = JSON.parse(fs.readFileSync(new URL('./partidas/' + f, import.meta.url)));
  if (p.duracao < 300) continue;
  const r = L.julgar(p, puuid);
  const c = L.chanceDeVitoria(p, r.timeNos);
  for (const x of r.vereditos) {
    const pa = T.parecer(x, c, L, null);
    assert.ok(pa.dicas.length && pa.dicas.every((t) => t && !t.includes('undefined')), f);
    if (pa.lance) assert.ok(!pa.lance.texto.includes('undefined'), f);
  }
}
console.log('ok: tribunal');
