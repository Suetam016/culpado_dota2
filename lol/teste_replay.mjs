// Testes do replay do LoL: node lol/teste_replay.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const R = require('./replay.js');

const quadros = [0, 60, 120, 180].map((t) => ({ t, p: { 1: [1000 + t * 10, 1000, 0, 0, 0, 5], 2: [5000, 5000, 0, 0, 0, 5] } }));
const partida = {
  duracao: 200, quadros,
  jogadores: [{ id: 1, teamId: 100, championName: 'Ahri' }, { id: 2, teamId: 200, championName: 'Zed' }],
  eventos: [
    { t: 90, tipo: 'abate', matou: 2, morreu: 1, assist: [], x: 3000, y: 3000 },
    { t: 100, tipo: 'monstro', time: 200, monstro: 'DRAGON' },
    { t: 110, tipo: 'estrutura', dono: 100, estrutura: 'TOWER_BUILDING', x: 4000, y: 4000 },
    { t: 120, tipo: 'placa', dono: 100 },
  ],
};
const r = R.preparar(partida, 100);
const ahri = r.jogadores[0], zed = r.jogadores[1];
// entre o minuto 0 e o 1: anda em linha reta
assert.deepEqual(R.posicao(ahri, 30), { vivo: true, x: 1300, y: 1000 });
// no segundo do abate está no lugar do abate; o matador também
assert.deepEqual(R.posicao(ahri, 90), { vivo: true, x: 3000, y: 3000 });
assert.deepEqual(R.posicao(zed, 90), { vivo: true, x: 3000, y: 3000 });
// morta por 10 s (nível 5) e volta na base
assert.equal(R.posicao(ahri, 95).vivo, false);
assert.equal(R.tempoRenascer(5, 90), 10);
assert.deepEqual(R.posicao(ahri, 100), { vivo: true, ...R.BASE[100] });
// o quadro do minuto 2 (t=120) não é descartado: ela já renasceu
assert.ok(ahri.chaves.some((c) => c.t === 120));
// eventos com texto e lado
assert.deepEqual(r.eventos.map((e) => [e.t, e.texto, e.bom]), [
  [90, 'Zed matou Ahri', false], [100, 'Os inimigos pegaram o dragão', false], [110, 'Os inimigos derrubaram uma torre', false]]);
// partida real, se tiver
const dir = new URL('./partidas/', import.meta.url);
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).slice(0, 5)) {
    const p = JSON.parse(fs.readFileSync(new URL(f, dir)));
    const rr = R.preparar(p, 100);
    for (const j of rr.jogadores) for (let t = 0; t <= p.duracao; t += 7) {
      const s = R.posicao(j, t);
      if (s.vivo) assert.ok(s.x >= -500 && s.x <= 16000 && s.y >= -500 && s.y <= 16000, `${f} ${j.campeao} ${t}`);
    }
  }
}
console.log('ok');
