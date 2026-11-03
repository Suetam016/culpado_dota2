// Confere se o site ainda tem tudo o que o contêiner do GTM (gtm/container.json) usa para medir:
// os seletores dos gatilhos de clique, as seções do rastreamento de scroll e as abas do ranking.
// Roda no PR (workflow gtm.yml). Se falhar, a medição do GA4 quebrou ou ficou incompleta:
// avise o Mat para repassar ao responsável do GTM, ou ajuste o site para manter os nomes.
// Uso: node gtm/checar.js [url-base]   (padrão http://localhost:8765)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://localhost:8765').replace(/\/$/, '');
const cont = JSON.parse(fs.readFileSync(path.join(__dirname, 'container.json'), 'utf8')).containerVersion;

// Seletores dos gatilhos de clique ("#x, #x *" vira "#x").
const seletores = [];
for (const t of cont.trigger || []) {
  for (const f of t.filter || []) {
    if (f.type !== 'CSS_SELECTOR') continue;
    const css = f.parameter.find((p) => p.key === 'arg1').value;
    for (const s of css.split(',').map((x) => x.trim()).filter((x) => !/\s\*$/.test(x))) {
      seletores.push({ gatilho: t.name, css: s });
    }
  }
}

// Seções medidas pela tag HTML de scroll (array SECOES).
let secoes = [];
for (const t of cont.tag || []) {
  if (t.type !== 'html') continue;
  const html = t.parameter.find((p) => p.key === 'html').value;
  const m = html.match(/SECOES\s*=\s*\[([^\]]*)\]/);
  if (m) secoes = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.route(/googletagmanager|google-analytics/, (r) => r.abort());

  const achados = {};
  const contar = async () => {
    for (const { css } of seletores) {
      const n = await pagina.locator(css).count();
      achados[css] = (achados[css] || 0) + n;
    }
  };

  // Home
  await pagina.goto(BASE + '/');
  await contar();
  // Partida (a de exemplo, que vem do próprio repo)
  await pagina.click('#home-exemplo');
  await pagina.waitForFunction(() => document.querySelectorAll('[data-secao]').length > 3, null, { timeout: 60000 });
  await pagina.waitForTimeout(1500);
  await contar();
  const secoesSite = await pagina.evaluate(() =>
    [...document.querySelectorAll('[data-secao]')].map((e) => e.id).filter(Boolean));
  // Ranking
  await pagina.goto(BASE + '/ranking/');
  await pagina.waitForTimeout(3000);
  await contar();
  const abasComNome = await pagina.locator('.aba[data-aba]').count();
  await navegador.close();

  const problemas = [];
  for (const { gatilho, css } of seletores) {
    if (!achados[css]) problemas.push(`Gatilho "${gatilho}": o seletor ${css} não existe mais no site.`);
  }
  for (const id of secoes) {
    if (!secoesSite.includes(id)) problemas.push(`Scroll: a seção #${id} não existe mais na partida.`);
  }
  for (const id of secoesSite) {
    if (!secoes.includes(id)) problemas.push(`Scroll: a seção nova #${id} não está na lista SECOES do GTM (não é medida).`);
  }
  if (!abasComNome) problemas.push('Ranking: nenhuma .aba com data-aba (o parâmetro ranking_tab fica vazio).');

  console.log(`Conferidos ${seletores.length} seletores, ${secoes.length} seções e as abas do ranking.`);
  if (problemas.length) {
    console.log('\nA medição do GTM vai quebrar com esta mudança:\n- ' + problemas.join('\n- '));
    console.log('\nAvise o Mat para repassar ao responsável do GTM (ou mantenha os nomes antigos).');
    console.log('Se o GTM já foi atualizado, troque gtm/container.json pela exportação nova.');
    process.exit(1);
  }
  console.log('Tudo que o GTM usa continua no site.');
})().catch((e) => { console.error(e); process.exit(1); });
