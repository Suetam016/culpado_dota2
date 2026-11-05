#!/usr/bin/env node
// Banco de falas: monta o roteiro de cada partida listada (o mesmo do site, audio/fila.js), corta em frases
// (audio/banco.js) e lista as que ainda não estão gravadas em audios/banco/.
//   node prototipos/banco-falas/faltam.js <id> [<id>...]   -> prototipos/banco-falas/faltam.json [{chave, texto}]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Banco = require('../../audio/banco.js');

const RAIZ = path.resolve(__dirname, '../..');
const ids = process.argv.slice(2).filter((x) => /^\d{9,12}$/.test(x));
if (!ids.length) { console.error('uso: faltam.js <id da partida> [...]'); process.exit(1); }
const indiceArq = path.join(RAIZ, 'audios/banco/indice.json');
const indice = fs.existsSync(indiceArq) ? JSON.parse(fs.readFileSync(indiceArq, 'utf8')) : {};

const faltam = new Map();
for (const id of ids) {
  try {
    execFileSync('node', [path.join(RAIZ, 'audio/fila.js'), '--id', id, '--forcar'], { stdio: 'inherit', cwd: RAIZ });
  } catch (e) { console.error(`${id}: fila.js falhou`); continue; }
  const item = JSON.parse(fs.readFileSync(path.join(RAIZ, 'audio/fila.json'), 'utf8')).find((x) => !x.jaTem);
  if (!item) { console.error(`${id}: sem roteiro`); continue; }
  const fs_ = Banco.frases(item.texto);
  let novas = 0;
  for (const t of fs_) {
    const c = Banco.chave(t);
    if (!indice[c] && !faltam.has(c)) { faltam.set(c, t); novas++; }
  }
  console.log(`${item.arquivo}: ${fs_.length} frases, ${fs_.length - novas} já no banco`);
}
fs.writeFileSync(path.join(__dirname, 'faltam.json'), JSON.stringify([...faltam].map(([chave, texto]) => ({ chave, texto })), null, 1));
console.log(`faltam ${faltam.size} frases`);
