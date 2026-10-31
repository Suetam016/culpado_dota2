// Testes da resenha do LoL: node lol/teste_resenha.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const R = require('./resenha.js');
const L = require('./julgar.js');

// pings
const js = [
  { id: 1, pings: { enemyMissing: 23, push: 2, retreat: 0 } },
  { id: 2, pings: { enemyMissing: 1, onMyWay: 40 } },
];
const pg = R.pings(js);
assert.equal(pg.linhas[0].jogador.id, 2);            // quem mais pingou no total
assert.equal(pg.reiDoInterrogacao.jogador.id, 1);
assert.deepEqual(pg.linhas[1].tipos.map((t) => t.nome), ['?', 'Empurra']);

// ouro parado: 4 minutos seguidos acima de 2.000
const quadros = [0, 500, 2100, 2500, 3300, 2200, 400, 2600].map((g, m) => ({ t: m * 60, p: { 1: [0, 0, 0, 0, 0, 1, g] } }));
const partida = { duracao: 1500, quadros };
assert.deepEqual(R.ouroParado(partida, { id: 1 }), { inicio: 120, minutos: 4, pico: 3300, picoT: 240 });
assert.equal(R.ouroParado({ duracao: 60, quadros: [{ t: 0, p: { 1: [0, 0, 0, 0, 0, 1] } }] }, { id: 1 }), null);  // partida v2

// medalhas
const med = R.medalhas(partida, { id: 1, teamPosition: 'TOP', spell4Casts: 0,
  challenges: { epicMonsterSteals: 1, skillshotsDodged: 10, killParticipation: 0.2, controlWardsPlaced: 0, visionScorePerMinute: 0.2 } }, pg);
assert.deepEqual(med.map((m) => m.titulo), ['Ladrão', 'Turista', 'Pão-duro da visão', 'Jogando no escuro', 'Ult de enfeite', 'Cofrinho', 'Rei do ?']);
assert.ok(med[0].bom && !med[1].bom);

// recibo
const nomes = (c) => (c === 'Zed' ? ['Lâmina', 'Sombra', 'Corte', 'Marca da Morte'] : null);
const rec = R.recibo({ recibo: [[7, 'Zed', 'zedr', 3, 600], [7, 'Zed', 'zedbasicattack', 64, 300], [0, 'Turret', '', null, 200],
  [7, 'Zed', 'zedrattack', 3, 300], [0, 'SRU_OrderMinionMelee', 'basicattack', 64, 1],
  [8, 'Ahri', 'summonerdot', 5, 100], [8, 'Ahri', 'ahriq', 0, 50]] }, nomes);
assert.equal(rec.total, 1551);
assert.deepEqual(rec.linhas.map((l) => `${l.fonte}|${l.golpe}`), ['Zed|R · Marca da Morte', 'Zed|Ataque básico', 'Torre|', 'Ahri|Incendiar', 'Ahri|Q', 'Tropas|']);
assert.deepEqual(rec.porQuem[0], ['Zed', 1200]);

// partidas reais: nada quebra e as lutas fazem sentido
const dir = new URL('./partidas/', import.meta.url);
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    const p = JSON.parse(fs.readFileSync(new URL(f, dir)));
    const pgr = R.pings(p.jogadores);
    for (const j of p.jogadores) R.medalhas(p, j, pgr);
    for (const e of p.eventos) if (e.tipo === 'abate' && e.recibo) R.recibo(e, () => null);
    for (const l of L.lutas(p, 100)) assert.ok(l.abates.length >= 3 && l.fim >= l.inicio, f);
  }
}
console.log('ok');
