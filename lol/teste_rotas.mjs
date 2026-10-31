// Testes da fase de rotas do LoL: node lol/teste_rotas.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const R = require('./rotas.js');

const pos = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const jogadores = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, teamId: i < 5 ? 100 : 200, teamPosition: pos[i % 5] }));
// minuto m: nosso topo ganha 100 de ouro por minuto a mais; bot deles (atirador + suporte) ganha 80 a mais cada
const quadros = Array.from({ length: 20 }, (_, m) => {
  const p = {};
  for (const j of jogadores) {
    let ouro = 500 + m * 300;
    if (j.id === 1) ouro += m * 100;
    if (j.id === 9 || j.id === 10) ouro += m * 80;
    p[j.id] = [0, 0, ouro, m * 400, m * 7, 1, 0];
  }
  return { t: m * 60, p };
});
const eventos = [
  { tipo: 'abate', t: 300, morreu: 6, matou: 1, assist: [] },          // nosso topo matou o deles
  { tipo: 'abate', t: 400, morreu: 4, matou: 9, assist: [10] },        // bot deles matou nosso atirador
  { tipo: 'abate', t: 420, morreu: 5, matou: 7, assist: [9] },         // caçador deles com ajuda do atirador
  { tipo: 'abate', t: 1000, morreu: 6, matou: 1, assist: [] },         // depois dos 14: não conta
];
const rs = R.rotas({ jogadores, quadros, eventos }, 100);
assert.deepEqual(rs.map((r) => r.nome), ['Topo', 'Selva', 'Meio', 'Bot']);
const [topo, selva, , bot] = rs;
assert.deepEqual([topo.m10.ouro, topo.m14.ouro, topo.minutoFim], [1000, 1400, 14]);
assert.equal(topo.resultado, 'ganhou');
assert.deepEqual(topo.abates, { nos: 1, eles: 0 });
assert.equal(selva.resultado, 'empate');
assert.equal(bot.nos.length, 2);
assert.equal(bot.m14.ouro, -2240);
assert.equal(bot.resultado, 'perdeu');
assert.ok(bot.esmagou);
assert.deepEqual(bot.abates, { nos: 0, eles: 2 });
// partida curta (remake): sem rotas
assert.deepEqual(R.rotas({ jogadores, quadros: quadros.slice(0, 8), eventos }, 100), []);

// partidas reais: 4 rotas e números finitos
const dir = new URL('./partidas/', import.meta.url);
for (const f of fs.readdirSync(dir)) {
  const p = JSON.parse(fs.readFileSync(new URL(f, dir)));
  if (p.duracao < 900) continue;
  const time = p.jogadores[0].teamId;
  const x = R.rotas(p, time);
  if (p.fila === 450) continue; // ARAM não tem rota
  assert.ok(x.length >= 3, f);
  assert.ok(x.every((r) => Number.isFinite(r.peso)), f);
}
console.log('ok: rotas');
