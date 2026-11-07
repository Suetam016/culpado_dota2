// Gera falas.json com duas tomadas (sorteios) do locutor para a partida 9073941063 (Nakyo de Mirana).
const R = require('./roteiro.js');
const NOMES = { mirana: 'Mirana', grimstroke: 'Grimstroke', death_prophet: 'Death Prophet', ringmaster: 'Ringmaster', ursa: 'Ursa' };
const falavel = (nick) => { const s = (nick || '').replace(/[^A-Za-zÀ-ú0-9 ]/g, '').replace(/^3/, 'Tr').trim(); return /[A-Za-zÀ-ú]{3}/.test(s) ? s : 'inimigo'; };
const ev = [
  { t: 0.6, tipo: 'abertura' },
  { t: 21.8, tipo: 'skill', skill: 'a flecha' },
  { t: 30, tipo: 'abate', vitima: 'grimstroke', dono: falavel('Suéter') },
  { t: 33, tipo: 'torre' },
  { t: 39, tipo: 'sumiu' },
  { t: 42.6, tipo: 'quartel' },
  { t: 66.2, tipo: 'torre4' },
  { t: 74, tipo: 'enquanto' },
  { t: 105.2, tipo: 'varios', skill: 'chuva de estrela', n: 3 },
  { t: 107, tipo: 'abate', vitima: 'death_prophet', dono: falavel('3rvinha') },
  { t: 111.8, tipo: 'dano', vitima: 'ursa', num: 1045 },
  { t: 114, tipo: 'abate', vitima: 'ringmaster', dono: falavel('メ BΣKIПΗӨ.') },
  { t: 122, tipo: 'fim' },
];
const ctx = { quem: 'Nakyo', heroi: 'mirana', nomeHeroi: (h) => NOMES[h] || h, lado: 'Temidos' };
const out = [], tomadas = {};
let evitar = {};
for (const s of [1, 2]) {
  const f = R.montar(ev, { ...ctx, semente: s * 7919, evitar });
  f.forEach((x) => (evitar[x.tipo] = evitar[x.tipo] || []).push(x.i));
  tomadas[s] = f;
  f.forEach((x, k) => out.push([`t${s}-${String(k).padStart(2, '0')}-${x.tipo}`, x.texto, x.ref]));
}
require('fs').writeFileSync(__dirname + '/falas.json', JSON.stringify(out, null, 1));
require('fs').writeFileSync(__dirname + '/tomadas.json', JSON.stringify(tomadas, null, 1));
for (const [n, t, r] of out) console.log(n, r, '|', t);
