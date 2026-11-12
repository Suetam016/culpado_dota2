// Confere: toda chave usada no HTML existe em pt.json, e es/en (se existirem)
// têm as mesmas chaves e os mesmos marcadores {x}.
import fs from 'fs';
const pt = JSON.parse(fs.readFileSync('i18n/pt.json', 'utf8'));
let erros = 0;
const html = fs.readFileSync('palco/index.html', 'utf8');
for (const [, k] of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g))
  if (!(k in pt)) { console.log('falta em pt.json:', k); erros++; }
const marc = s => (s.match(/\{\w+\}/g) || []).sort().join();
for (const l of ['es', 'en']) {
  const f = `i18n/${l}.json`; if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k in pt) {
    if (!(k in d)) { console.log(`falta em ${l}:`, k); erros++; }
    else if (marc(d[k]) !== marc(pt[k])) { console.log(`marcadores diferentes em ${l}:`, k); erros++; }
  }
}
console.log(erros ? `${erros} problema(s)` : `ok: ${Object.keys(pt).length} chaves`);
process.exit(erros ? 1 : 0);
