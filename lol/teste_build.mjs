// Testes da leitura da build do LoL: node lol/teste_build.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const B = require('./build.js');

const itens = {
  1001: { n: 'Botas', g: 300, t: ['Boots'], d: 1, f: true },
  3047: { n: 'Botas Galvanizadas de Aço', g: 1200, t: ['Boots', 'Armor'], d: 2, f: false },
  3111: { n: 'Passos de Mercúrio', g: 1250, t: ['Boots', 'SpellBlock'], d: 2, f: false },
  3157: { n: 'Ampulheta de Zhonya', g: 3250, t: ['Armor', 'SpellDamage'], d: 3, f: false },
  3102: { n: 'Véu da Banshee', g: 3000, t: ['SpellBlock', 'SpellDamage'], d: 3, f: false },
  3165: { n: 'Morellonomicon', g: 2950, t: ['SpellDamage'], d: 3, f: false },
  6655: { n: 'Tormento de Luden', g: 2900, t: ['SpellDamage'], d: 3, f: false },
  1058: { n: 'Bastão Desnecessariamente Grande', g: 1200, t: ['SpellDamage'], d: 1, f: true },
  3089: { n: 'Capuz da Morte de Rabadon', g: 3600, t: ['SpellDamage'], d: 3, f: false },
  2055: { n: 'Sentinela de Controle', g: 75, t: ['Vision'], d: 1, f: false },
};
const campeoes = { Ahri: { t: ['Mage', 'Assassin'] }, Zed: { t: ['Assassin'] }, Garen: { t: ['Fighter', 'Tank'] } };
const quadro = (t, ouro) => ({ t, p: { 1: [0, 0, 0, 0, 0, 1, ouro], 6: [0, 0, 0, 0, 0, 1, 0] } });
const ahri = { id: 1, teamId: 100, championName: 'Ahri', teamPosition: 'MIDDLE', deaths: 6, itens: [6655, 1001, 3089, 0, 0, 0, 3340],
  compras: [[30, 1058], [700, 6655], [900, 1001], [1500, 1058], [1600, 3089], [1700, 6655]] };
const zed = { id: 6, teamId: 200, championName: 'Zed', teamPosition: 'MIDDLE', deaths: 2, physicalDamageDealtToChampions: 30000, magicDamageDealtToChampions: 2000,
  trueDamageDealtToChampions: 1000, totalHeal: 12000, itens: [], compras: [[500, 3157]] };
const garen = { id: 7, teamId: 200, championName: 'Garen', teamPosition: 'TOP', physicalDamageDealtToChampions: 20000, magicDamageDealtToChampions: 0,
  trueDamageDealtToChampions: 5000, totalHeal: 3000, itens: [], compras: [] };
const morte = (t) => ({ tipo: 'abate', t, morreu: 1, matou: 6, recibo: [[6, 'Zed', 'q', 0, 900, 800, 0, 100], [0, 'Turret', '', null, 300, 300, 0, 0]] });
const partida = { duracao: 30 * 60, jogadores: [ahri, zed, garen], eventos: [morte(400), morte(800), morte(1200)], quadros: [quadro(0, 500), quadro(1800, 2400)] };

// itens completos na ordem, sem repetir e sem componente
assert.deepEqual(B.completos(ahri, itens).map((x) => x.id), [6655, 3089]);
// perfil do time inimigo e do que te matou (só dano de campeão)
const pi = B.perfil([zed, garen]);
assert.equal(Math.round(pi.fisico * 100), 86);
const mp = B.morreuPara(partida, ahri);
assert.equal(mp.mortes, 3);
assert.equal(Math.round(mp.fisico * 100), 89);
assert.equal(B.grupo(ahri, campeoes), 'Mage');
assert.equal(B.grupo({ ...ahri, teamPosition: 'UTILITY' }, campeoes), 'Support');

const l = B.ler(partida, ahri, null, itens, campeoes);
assert.equal(l.rival, zed);
const textos = l.leitura.map((x) => x.texto);
assert.ok(textos[0].startsWith('Primeiro item (Tormento de Luden) só aos 12 min. O rival de rota fechou o dele 3 min antes'), textos[0]);
assert.ok(textos.some((t) => t.startsWith('Nenhum item de armadura, e 89% do dano das mortes foi físico')));
assert.ok(textos.includes('Nenhuma Sentinela de Controle comprada (75 de ouro).'));
assert.ok(textos.includes('Terminou a partida com 2.400 de ouro guardado sem gastar.'));
assert.ok(textos.includes('Zed curou 12.000 e não teve corte de cura na build.'));
assert.deepEqual(l.sugestoes.map((s) => s.id), [3157, 3047, 3165]);   // Zhonya, bota de armadura, Morello
assert.ok(l.sugestoes[0].motivo.includes('89%'));

// item sugerido que não existe mais no jogo é descartado; item que já tem não é sugerido
const semZhonya = { ...itens }; delete semZhonya[3157];
assert.ok(!B.ler(partida, ahri, null, semZhonya, campeoes).sugestoes.some((s) => s.id === 3157));
const comZhonya = { ...ahri, itens: [3157], compras: [...ahri.compras, [1750, 3157], [1760, 2055]] };
const l2 = B.ler(partida, comZhonya, null, itens, campeoes);
assert.ok(l2.leitura.some((x) => x.bom && x.texto.startsWith('Fez armadura')));
assert.ok(!l2.sugestoes.some((s) => s.id === 3157));

// sem dados de item (antes do coletor baixar): não quebra
const l3 = B.ler(partida, ahri, null, null, null);
assert.deepEqual(l3.sugestoes, []);
console.log('ok: build');
