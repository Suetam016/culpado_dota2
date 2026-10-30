// Testes do veredito do LoL: node lol/teste_julgar.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const L = require('./julgar.js');
const exemplo = require('./exemplos/EXEMPLO.json');

const jog = (id, time, rota, extra = {}) => ({ id, puuid: 'p' + id, teamId: time, teamPosition: rota, win: time === 200,
  championName: 'C' + id, riotIdGameName: 'J' + id, kills: 0, deaths: 0, assists: 0, visionScore: 30, ...extra });
const quadros = Array.from({ length: 16 }, (_, m) => ({ t: m * 60, p: Object.fromEntries(Array.from({ length: 10 }, (_, i) =>
  [String(i + 1), [0, 0, 500 + m * (i === 0 ? 250 : 350), 0, 0, 1]])) }));
const rotas = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const base = () => ({ jogadores: Array.from({ length: 10 }, (_, i) => jog(i + 1, i < 5 ? 100 : 200, rotas[i % 5])), quadros, eventos: [] });

// 1) quem morre sozinho e entrega o Barão é o culpado
{
  const p = base();
  p.eventos.push({ t: 600, tipo: 'abate', matou: 6, morreu: 3, assist: [], recompensa: 300, x: 7000, y: 7000 });
  p.eventos.push({ t: 1200, tipo: 'abate', matou: 7, morreu: 3, assist: [8], recompensa: 400, x: 5000, y: 9000 });
  p.eventos.push({ t: 1230, tipo: 'monstro', time: 200, monstro: 'BARON_NASHOR' });
  p.eventos.push({ t: 1300, tipo: 'abate', matou: 2, morreu: 9, assist: [], recompensa: 300 });
  const r = L.julgar(p, 'p1');
  assert.equal(r.timeNos, 100);
  assert.equal(r.venceu, false);
  assert.equal(r.culpado.jogador.id, 3);
  const k = Object.fromEntries(r.culpado.componentes.map((c) => [c.key, c.pontos]));
  assert.equal(k.mortes, 0.7);
  assert.equal(k.objetivos, 0.8);              // metade de 1.500
  assert.ok(k.sozinho > 0);
  assert.match(r.culpado.componentes.find((c) => c.key === 'objetivos').evidencia, /Barão/);
  // o top perdeu a rota (250 x 350 por minuto): 1.400 de ouro aos 14 min
  const top = r.vereditos.find((v) => v.jogador.id === 1);
  assert.equal(top.componentes.find((c) => c.key === 'rota').pontos, 0.7);
  // quem matou ganha crédito
  const jg = r.vereditos.find((v) => v.jogador.id === 2);
  assert.ok(jg.componentes.find((c) => c.key === 'abates').pontos < 0);
  assert.ok(Math.abs(r.vereditos.reduce((a, v) => a + v.fatia, 0) - 1) < 1e-9);
}
// 2) visão do suporte
{
  const p = base();
  p.jogadores[4].visionScore = 10; p.jogadores[9].visionScore = 50;
  const r = L.julgar(p, 'p5');
  assert.equal(r.vereditos.find((v) => v.jogador.id === 5).componentes.find((c) => c.key === 'visao').pontos, 0.6);
}
// 3) torre do time 200 derrubada logo depois da morte do 6: culpa do 6 visto pelo time 200; nada para o time 100
{
  const p = base();
  p.eventos.push({ t: 100, tipo: 'abate', matou: 1, morreu: 6, assist: [], recompensa: 300 });
  p.eventos.push({ t: 120, tipo: 'estrutura', dono: 200, estrutura: 'TOWER_BUILDING' });
  const r = L.julgar(p, 'p6');
  assert.equal(r.timeNos, 200);
  assert.equal(r.vereditos.find((v) => v.jogador.id === 6).componentes.find((c) => c.key === 'objetivos').pontos, 0.3);
  const r2 = L.julgar(p, 'p1');
  assert.ok(!r2.vereditos.some((v) => v.componentes.some((c) => c.key === 'objetivos')));
}
// 4) exemplo real do formato compacto roda inteiro
{
  const r = L.julgar(exemplo, 'p-mia');
  assert.equal(r.vereditos.length, 5);
  assert.equal(L.ouroDoTime(exemplo, r.timeNos).length, exemplo.quadros.length);
  assert.equal(L.mmss(605), '10:05');
}
console.log('ok');
