#!/usr/bin/env node
// Teste do banco de falas: monta o roteiro de uma partida (o mesmo do áudio de produção, audio/fila.js) e corta em
// pedaços do jeito que o banco guardaria: frases fixas, números (com a unidade colada), heróis ("de Pudge") e nomes.
//   node prototipos/banco-falas/montar.js <id>   -> prototipos/banco-falas/pedacos.json
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { dadosEmbutidos } = require('../../ranking/gerar.js');

const RAIZ = path.resolve(__dirname, '../..');
const id = process.argv[2];
if (!/^\d{9,12}$/.test(id || '')) { console.error('uso: montar.js <id da partida>'); process.exit(1); }
execFileSync('node', [path.join(RAIZ, 'audio/fila.js'), '--id', id], { stdio: 'inherit', cwd: RAIZ });
const item = JSON.parse(fs.readFileSync(path.join(RAIZ, 'audio/fila.json'), 'utf8')).find((x) => !x.jaTem);
if (!item) { console.error('sem roteiro para essa partida'); process.exit(1); }

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const herois = Object.values(dadosEmbutidos().h).map((h) => h.localized_name).filter(Boolean).sort((a, b) => b.length - a.length);
const NUM = 'zero|uma?|duas|dois|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzent[oa]s|trezent[oa]s|quatrocent[oa]s|quinhent[oa]s|seiscent[oa]s|setecent[oa]s|oitocent[oa]s|novecent[oa]s|mil';
const UNID = 'por cento do mérito|por cento|vezes|mil|minutos|abates|mortes';
const reNum = new RegExp(`(?<![\\p{L}])(?:${NUM})(?:(?:\\s+e\\s+|\\s+)(?:${NUM}))*(?:\\s+(?:${UNID}))?[.!?,]?(?![\\p{L}])`, 'giu');
const reHeroi = new RegExp(`(?:de |do |da )?(?:${herois.map(esc).join('|')})[.!?,]?(?![\\p{L}])`, 'gu');
// nome de jogador: palavra(s) com maiúscula no meio da frase que não sejam herói ("do Pelegrino Vaz", "Kuscomem")
const reNome = /(?<=\S\s)(?:(?:do|da|de|o|a) )?[A-ZÀ-Ú][\p{L}\d']*(?: [A-ZÀ-Ú][\p{L}\d']*)*[.!?,]?(?![\p{L}])/gu;

const pedacos = [];
for (const frase of String(item.texto).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []) {
  const s = frase.trim();
  const achados = [];
  for (const [re, tipo] of [[reNum, 'numero'], [reHeroi, 'heroi'], [reNome, 'nome']]) {
    if (!re) continue;
    for (const m of s.matchAll(re)) {
      if (tipo === 'numero' && /^(um|uma)[.!?,]?$/i.test(m[0].trim())) continue; // artigo, não número
      if (!achados.some((a) => m.index < a.fim && m.index + m[0].length > a.ini)) achados.push({ ini: m.index, fim: m.index + m[0].length, tipo });
    }
  }
  achados.sort((a, b) => a.ini - b.ini);
  let i = 0;
  const pedFrase = [];
  for (const a of achados) {
    if (a.ini > i && s.slice(i, a.ini).trim()) pedFrase.push({ t: s.slice(i, a.ini).replace(/^[\s:;,]+/, '').trim(), tipo: 'fixa' });
    pedFrase.push({ t: s.slice(a.ini, a.fim).trim(), tipo: a.tipo });
    i = a.fim;
  }
  const resto = s.slice(i).replace(/^[\s:;,]+/, '').trim();
  if (resto && /\p{L}/u.test(resto)) pedFrase.push({ t: resto, tipo: 'fixa' });
  if (pedFrase.length) pedFrase[pedFrase.length - 1].fim = true;
  pedacos.push(...pedFrase);
}
fs.writeFileSync(path.join(__dirname, 'pedacos.json'), JSON.stringify({ partida: item.arquivo, texto: item.texto, pedacos }, null, 1));
console.log(`${pedacos.length} pedaços`);
for (const p of pedacos) console.log(`${p.tipo.padEnd(6)} ${p.fim ? '|' : ' '} ${p.t}`);
