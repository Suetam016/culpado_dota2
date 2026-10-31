// Testes do documento da culpa do LoL: node lol/teste_culpa.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const C = require('./culpa.js');
const L = require('./julgar.js');

// gravidade sobe com a fatia e com os pontos; 42%+ vai direto ao Tribunal
assert.equal(C.gravidade({ fatia: 0.23, score: 1.3 }), 0);
assert.equal(C.gravidade({ fatia: 0.30, score: 3.0 }), 2);
assert.equal(C.gravidade({ fatia: 0.38, score: 5.0 }), 3);
assert.equal(C.gravidade({ fatia: 0.43, score: 1.0 }), 4);

// documento: acusações do que a pessoa fez, com a prova; sempre o mesmo para a mesma partida
const j = { id: 3, kills: 0, deaths: 11, assists: 2, teamPosition: 'MIDDLE', detectorWardsPlaced: 0, totalTimeSpentDead: 100, pings: { enemyMissing: 2 } };
const v = { jogador: j, fatia: 0.4, score: 5, mortes: [{ recompensa: 300 }, { recompensa: 400 }],
  componentes: [{ key: 'mortes', pontos: 3, evidencia: 'Morreu 11 vezes.' }, { key: 'sozinho', pontos: 1, evidencia: '3 mortes sozinho.' }] };
v.pesou = v.componentes;
const partida = { id: 'BR1_9', inicio: 1761850000, duracao: 30 * 60 };
const d = C.documento(v, partida);
assert.equal(d.nivel, 3);
assert.equal(d.papel, 'haia');
assert.equal(d.entregue, 700);
assert.equal(d.recompensa, null);
assert.equal(d.acusacoes.length, 4);
assert.equal(d.acusacoes[0].evidencia, 'Morreu 11 vezes.');
assert.ok(C.CRIMES.mortes.flat().includes(d.acusacoes[0].crime));
assert.ok(d.acusacoes.some((a) => /0 abates|Sentinela/.test(a.evidencia || '')));   // um gatilho provado
assert.ok(!d.acusacoes.some((a) => a.evidencia === '11 mortes na partida'));           // mortes já provadas no componente
assert.equal(new Set(d.acusacoes.map((a) => a.crime)).size, d.acusacoes.length);         // nada repetido
assert.deepEqual(C.documento(v, partida).acusacoes, d.acusacoes);
assert.equal(d.numero, '9/2025');

// partidas reais: toda derrota gera papel com 3 ou mais acusações e sem buraco
const idx = JSON.parse(fs.readFileSync(new URL('./indice.json', import.meta.url)));
const puuid = Object.values(idx.jogadores)[0].puuid;
const niveis = [];
for (const f of fs.readdirSync(new URL('./partidas/', import.meta.url))) {
  const p = JSON.parse(fs.readFileSync(new URL('./partidas/' + f, import.meta.url)));
  if (p.duracao < 300) continue;
  const r = L.julgar(p, puuid);
  if (r.venceu) continue;
  const doc = C.documento(r.culpado, p);
  niveis.push(doc.nivel);
  assert.ok(doc.acusacoes.length >= 3, f);
  assert.ok(doc.acusacoes.every((a) => a.crime), f);
}
console.log('ok: culpa (níveis das derrotas reais:', niveis.join(' '), ')');
