/* Sistema binário da Bolsa do grupo: buraco negro da culpa e sol do craque orbitando um ao outro.
 * Cada amigo orbita o lado que pesa mais nele (Índice Culpado x Índice Craque, últimas 20 partidas com o grupo,
 * conta ajustada pelo tamanho do grupo). A animação roda sozinha; ao entrar, os planetas saem de onde estavam na
 * última visita (guardado no navegador) e deslizam para onde estão agora. */
(function () {
let KY = 0.34; // achatamento da órbita (vista inclinada); no celular fica mais alto para usar a tela
const mixCor = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a == null ? 1 : a})`;
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function buracoNegro(ctx, x, y, rh, t, parte) {
  const nAneis = 8;
  const anel = (i, a0, a1) => {
    const rr = rh * (1.75 + i * 0.32), q = i / (nAneis - 1);
    const g = ctx.createLinearGradient(x - rr, y, x + rr, y);
    const quente = mixCor([255, 246, 220], [255, 138, 60], q), frio = mixCor([255, 150, 70], [150, 40, 30], q);
    g.addColorStop(0, rgb(quente, 0.95 - q * 0.35)); g.addColorStop(1, rgb(frio, 0.7 - q * 0.35));
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, 1.6 - q * 0.6); ctx.setLineDash([3 + i * 2, 2 + i * 1.4]); ctx.lineDashOffset = -t * (60 / (1 + i * 0.6));
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * KY, 0, a0, a1); ctx.stroke();
  };
  ctx.save();
  if (parte === 'tras') {
    for (let i = nAneis - 1; i >= 0; i--) anel(i, Math.PI, Math.PI * 2);
    // imagem do disco curvada por cima do buraco (lente)
    for (let i = 0; i < 4; i++) { const rr = rh * (1.18 + i * 0.13), q = i / 3; ctx.setLineDash([2 + i, 3 + i]); ctx.lineDashOffset = -t * 30 / (1 + i);
      ctx.strokeStyle = rgb(mixCor([255, 240, 210], [230, 110, 50], q), 0.85 - q * 0.4); ctx.lineWidth = 1.3 - q * 0.4;
      ctx.beginPath(); ctx.ellipse(x, y - rh * 0.06, rr, rr * 0.92, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, rh, 0, 7); ctx.fillStyle = '#000'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, rh * 1.04, 0, 7); ctx.strokeStyle = 'rgba(255,236,200,.95)'; ctx.lineWidth = 1.6; ctx.stroke();
    palavra(ctx, 'CULPA', x, y, rh * 1.55, t, 'culpa');
    // imagem de baixo, fininha
    ctx.beginPath(); ctx.ellipse(x, y + rh * 0.05, rh * 1.12, rh * 1.06, 0, Math.PI * 0.08, Math.PI * 0.92); ctx.strokeStyle = 'rgba(255,190,120,.55)'; ctx.lineWidth = 1; ctx.stroke();
  } else {
    for (let i = 0; i < nAneis; i++) anel(i, 0, Math.PI);
  }
  ctx.restore();
}
function sol(ctx, x, y, rs, t) {
  ctx.save();
  // ondas de calor que saem do sol
  for (let k = 0; k < 3; k++) { const u = ((t * 0.35 + k / 3) % 1); ctx.beginPath(); ctx.arc(x, y, rs * (1.1 + u * 1.6), 0, 7); ctx.strokeStyle = `rgba(255,200,90,${0.45 * (1 - u)})`; ctx.lineWidth = 1.2; ctx.stroke(); }
  // coroa em raios finos
  const n = 64; ctx.lineWidth = 1.1;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + t * 0.05; const l = 1.12 + 0.22 * (0.5 + 0.5 * Math.sin(i * 2.7 + t * 2.1)) * (0.6 + 0.4 * Math.sin(i * 0.9 - t * 1.3));
    ctx.strokeStyle = `rgba(255,${190 + (i % 3) * 20},90,.75)`; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rs * 1.06, y + Math.sin(a) * rs * 1.06); ctx.lineTo(x + Math.cos(a) * rs * l, y + Math.sin(a) * rs * l); ctx.stroke(); }
  const g = ctx.createRadialGradient(x - rs * 0.25, y - rs * 0.25, rs * 0.1, x, y, rs);
  g.addColorStop(0, '#fffbe8'); g.addColorStop(0.55, '#ffd36b'); g.addColorStop(1, '#ff9a2e');
  ctx.beginPath(); ctx.arc(x, y, rs, 0, 7); ctx.fillStyle = g; ctx.fill();
  // faixas girando para mostrar rotação
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, rs, 0, 7); ctx.clip(); ctx.strokeStyle = 'rgba(200,90,20,.28)'; ctx.lineWidth = 1;
  for (let k = -3; k <= 3; k++) { const yy = y + k * rs * 0.27; const off = ((t * 12 + k * 7) % 14); ctx.setLineDash([6, 8]); ctx.lineDashOffset = -off * (k % 2 ? 1 : -1); ctx.beginPath(); ctx.moveTo(x - rs, yy); ctx.lineTo(x + rs, yy); ctx.stroke(); }
  ctx.restore(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, rs, 0, 7); ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = 1.5; ctx.stroke();
  palavra(ctx, 'CRAQUE', x, y, rs * 1.62, t, 'craque');
  ctx.restore();
}
// palavra estilizada dentro do astro
function palavra(ctx, txt, x, y, larg, t, tipo) {
  ctx.save(); let fs = 40; ctx.font = `900 ${fs}px Cinzel, serif`; const w0 = ctx.measureText(txt).width + txt.length * fs * 0.12; fs = Math.max(7, fs * larg / w0);
  ctx.font = `900 ${fs}px Cinzel, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const esp = fs * 0.12; const letras = [...txt]; const ws = letras.map(l => ctx.measureText(l).width); const tot = ws.reduce((a, b) => a + b, 0) + esp * (letras.length - 1);
  let cx0 = x - tot / 2;
  letras.forEach((l, i) => { const lx = cx0 + ws[i] / 2; cx0 += ws[i] + esp;
    if (tipo === 'culpa') { const tremor = Math.sin(t * 9 + i * 1.7) > 0.96 ? 1.5 : 0;
      if (tremor) { ctx.fillStyle = 'rgba(80,220,255,.7)'; ctx.fillText(l, lx - tremor, y + 1); }
      const g = ctx.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); g.addColorStop(0, '#ff8a96'); g.addColorStop(0.55, '#ff2d48'); g.addColorStop(1, '#7a0016');
      ctx.fillStyle = g; ctx.fillText(l, lx + tremor, y + 1); }
    else { ctx.lineWidth = Math.max(1, fs * 0.08); ctx.strokeStyle = 'rgba(255,248,225,.9)'; ctx.strokeText(l, lx, y + 1);
      const g = ctx.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); g.addColorStop(0, '#8a3a00'); g.addColorStop(1, '#4a1600'); ctx.fillStyle = g; ctx.fillText(l, lx, y + 1); } });
  ctx.restore();
}
function ondas(ctx, x, y, r, t, cor) { for (let k = 0; k < 2; k++) { const u = (t * 1.1 + k / 2) % 1; ctx.beginPath(); ctx.arc(x, y, r * (1.15 + u * 1.5), 0, 7); ctx.strokeStyle = rgb(cor, 0.9 * (1 - u)); ctx.lineWidth = 1.6; ctx.stroke(); } }

/* ---------- efeitos dos líderes ---------- */
// estrela de 4 pontas (brilho tipo "twinkle")
function estrela4(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) { const a = rot + (k * Math.PI) / 4, rr = k % 2 ? r * 0.18 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
}
// AURA SOMBRIA: brasas escuras sendo puxadas para dentro e lascas escuras subindo
function auraSombria(ctx, o, t, dt, tam, parte, BH, cel, forca) {
  const x = o.x, y = o.y; const k = forca == null ? 1 : forca;
  o.brasas = o.brasas || []; o.cinzas = o.cinzas || [];
  if (parte === 'tras') {
    // cinzas: lascas escuras com borda vermelha que se soltam e sobem
    const nc = (cel ? 8 : 16) * k * dt; o.cAcc = (o.cAcc || 0) + nc;
    while (o.cAcc >= 1) { o.cAcc -= 1; const a = Math.random() * 6.283; o.cinzas.push({ dx: Math.cos(a) * tam * 0.9, dy: Math.sin(a) * tam * 0.9, vx: (Math.random() - .5) * 10, vy: -(10 + Math.random() * 16), rot: Math.random() * 6, vr: (Math.random() - .5) * 4, s: 1.6 + Math.random() * 2.2, vida: 0, dur: 1.3 + Math.random() }); }
    o.cinzas = o.cinzas.filter(c => (c.vida += dt) < c.dur);
    o.cinzas.forEach(c => { c.dx += c.vx * dt; c.dy += c.vy * dt; c.rot += c.vr * dt; const al = Math.sin((c.vida / c.dur) * Math.PI);
      ctx.save(); ctx.translate(x + c.dx, y + c.dy); ctx.rotate(c.rot); ctx.beginPath(); ctx.moveTo(0, -c.s * 1.4); ctx.lineTo(c.s, c.s * 0.8); ctx.lineTo(-c.s * 0.9, c.s * 0.6); ctx.closePath();
      ctx.fillStyle = `rgba(10,0,4,${al})`; ctx.fill(); ctx.strokeStyle = `rgba(255,60,90,${al})`; ctx.lineWidth = 0.9; ctx.stroke(); ctx.restore(); });
    return;
  }
  // brasas escuras: nascem longe e são puxadas para dentro do planeta
  const nasce = (cel ? 18 : 34) * (k < 1 ? k * 0.5 : 1) * dt; o.brAcc = (o.brAcc || 0) + nasce;
  while (o.brAcc >= 1) { o.brAcc -= 1; const a = Math.random() * 6.283; o.brasas.push({ a, r: tam * (2.4 + Math.random() * 1.8), v: 0.5 + Math.random() * 0.5, s: 1.5 + Math.random() * 2, giro: (Math.random() < .5 ? -1 : 1) * (1 + Math.random()) }); }
  o.brasas = o.brasas.filter(b => (b.r -= dt * tam * 1.6 * b.v) > tam * 0.9);
  o.brasas.forEach(b => { b.a += dt * b.giro; const px = x + Math.cos(b.a) * b.r, py = y + Math.sin(b.a) * b.r * 0.8; const al = Math.min(1, (b.r - tam) / (tam * 0.6));
    ctx.fillStyle = `rgba(0,0,0,${al})`; ctx.strokeStyle = `rgba(255,50,80,${al})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, b.s, 0, 7); ctx.fill(); ctx.stroke(); });
}
// AURA DE LUZ: raios de luz girando, brilhos de 4 pontas, poeira dourada subindo e anéis de halo
function auraLuz(ctx, o, t, dt, tam, parte, BH, cel, forca) {
  const x = o.x, y = o.y; const kf = forca == null ? 1 : forca;
  if (kf < 1) return auraLuzMenor(ctx, o, t, dt, tam, parte, cel, kf);
  o.brilhos = o.brilhos || []; o.poeira = o.poeira || [];
  if (parte === 'tras') {
    // raios de luz (god rays)
    const n = cel ? 10 : 16; ctx.save(); ctx.translate(x, y);
    for (let k = 0; k < n; k++) { const a = t * 0.35 + (k / n) * Math.PI * 2; const len = tam * (3.2 + 2.2 * (0.5 + 0.5 * Math.sin(t * 2 + k * 2.7))); const w = 0.07 + 0.03 * Math.sin(t * 3 + k);
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len); g.addColorStop(0, 'rgba(255,244,200,.8)'); g.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len); ctx.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // halo: anéis finos que se abrem
    for (let k = 0; k < 3; k++) { const u = (t * 0.7 + k / 3) % 1; ctx.beginPath(); ctx.arc(x, y, tam * (1.2 + u * 2.2), 0, 7); ctx.strokeStyle = `rgba(255,226,150,${0.7 * (1 - u)})`; ctx.lineWidth = 1.2; ctx.stroke(); }
    return;
  }
  // brilhos de 4 pontas que acendem e apagam em volta
  const nb = (cel ? 10 : 18) * dt; o.bAcc = (o.bAcc || 0) + nb;
  while (o.bAcc >= 1) { o.bAcc -= 1; const a = Math.random() * 6.283, r = tam * (1.4 + Math.random() * 1.8); o.brilhos.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, vida: 0, dur: 0.6 + Math.random() * 0.7, s: 3 + Math.random() * 5, rot: Math.random() * 0.8 }); }
  o.brilhos = o.brilhos.filter(b => (b.vida += dt) < b.dur);
  o.brilhos.forEach(b => { const u = b.vida / b.dur, k = Math.sin(u * Math.PI); ctx.fillStyle = `rgba(255,${235 + 20 * k},${190 + 60 * k},${k})`; estrela4(ctx, x + b.dx, y + b.dy, b.s * k, b.rot + u * 0.6); });
  // poeira dourada subindo
  const np = (cel ? 14 : 26) * dt; o.pAcc = (o.pAcc || 0) + np;
  while (o.pAcc >= 1) { o.pAcc -= 1; o.poeira.push({ dx: (Math.random() - .5) * tam * 2.4, dy: tam * (0.2 + Math.random() * 0.6), vy: 14 + Math.random() * 18, vida: 0, dur: 1.2 + Math.random(), s: 1 + Math.random() * 1.4, fase: Math.random() * 6 }); }
  o.poeira = o.poeira.filter(p => (p.vida += dt) < p.dur);
  o.poeira.forEach(p => { p.dy -= p.vy * dt; const u = p.vida / p.dur; const px = x + p.dx + Math.sin(p.vida * 3 + p.fase) * 3, py = y + p.dy; ctx.fillStyle = `rgba(255,214,120,${Math.sin(u * Math.PI)})`;
    ctx.beginPath(); ctx.moveTo(px, py - p.s * 1.6); ctx.lineTo(px + p.s, py); ctx.lineTo(px, py + p.s * 1.6); ctx.lineTo(px - p.s, py); ctx.closePath(); ctx.fill(); });
}

// versão menor da luz para quem orbita o sol mas não é o líder
function auraLuzMenor(ctx, o, t, dt, tam, parte, cel, kf) {
  if (parte === 'tras') return; const x = o.x, y = o.y; o.brilhos = o.brilhos || [];
  const nb = (cel ? 3 : 6) * (0.3 + kf) * dt; o.bAcc = (o.bAcc || 0) + nb;
  while (o.bAcc >= 1) { o.bAcc -= 1; const a = Math.random() * 6.283, r = tam * (1.3 + Math.random() * 1.1); o.brilhos.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, vida: 0, dur: 0.6 + Math.random() * 0.6, s: 2.5 + Math.random() * 3.5, rot: Math.random() }); }
  o.brilhos = o.brilhos.filter(b => (b.vida += dt) < b.dur);
  o.brilhos.forEach(b => { const u = b.vida / b.dur, k = Math.sin(u * Math.PI); ctx.fillStyle = `rgba(255,236,190,${k})`; estrela4(ctx, x + b.dx, y + b.dy, b.s * k, b.rot); });
}
// floco de neve nítido
function floco(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a); ctx.moveTo(0, 0); ctx.lineTo(c * r, s * r);
    const bx = c * r * 0.55, by = s * r * 0.55, a1 = a + 0.6, a2 = a - 0.6; ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a1) * r * 0.35, by + Math.sin(a1) * r * 0.35); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a2) * r * 0.35, by + Math.sin(a2) * r * 0.35); }
  ctx.stroke(); ctx.restore();
}
// FRIO: quem está em cima do muro, longe dos dois, solta flocos e cristais de gelo
function auraFrio(ctx, o, t, dt, tam, parte, BH, cel) {
  const x = o.x, y = o.y; o.flocos = o.flocos || [];
  if (parte === 'tras') {
    // anel de geada: seis cristais finos girando devagar
    ctx.strokeStyle = 'rgba(170,220,255,.55)'; ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) { const a = t * 0.3 + (k * Math.PI) / 3; const r0 = tam + 4, r1 = tam + 9; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); }
    return;
  }
  const nf = (cel ? 3 : 5) * dt; o.fAcc = (o.fAcc || 0) + nf;
  while (o.fAcc >= 1) { o.fAcc -= 1; o.flocos.push({ dx: (Math.random() - .5) * tam * 3, dy: -tam * (0.6 + Math.random() * 0.8), vy: 8 + Math.random() * 8, fase: Math.random() * 6, s: 2.5 + Math.random() * 2.5, rot: Math.random() * 6, vida: 0, dur: 2 + Math.random() * 1.5 }); }
  o.flocos = o.flocos.filter(f => (f.vida += dt) < f.dur);
  o.flocos.forEach(f => { f.dy += f.vy * dt; f.rot += dt * 0.8; const al = Math.sin((f.vida / f.dur) * Math.PI); ctx.strokeStyle = `rgba(200,235,255,${al})`; ctx.lineWidth = 1; floco(ctx, x + f.dx + Math.sin(f.vida * 2 + f.fase) * 4, y + f.dy, f.s, f.rot); });
}
// FILTROS DO AVATAR: podridão (lado do buraco negro), ouro (lado do sol), gelo (em cima do muro)
function fotoFiltrada(c, tipo, nivel) {
  const f = FOTO(c); if (!f) return null; const chave = c + tipo + nivel; if (FILTROS[chave]) return FILTROS[chave];
  const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d'); x.drawImage(f, 0, 0, n, n);
  let im; try { im = x.getImageData(0, 0, n, n); } catch (e) { return FILTROS[chave] = f; }
  const d = im.data, k = nivel; let sem = [...c].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7); const rnd = () => ((sem = (sem * 1664525 + 1013904223) >>> 0) / 4294967296);
  const blobs = tipo === 'podre' ? Array.from({ length: 5 }, () => [6 + rnd() * 52, 6 + rnd() * 52, 5 + rnd() * 9]) : [];
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % n, py = Math.floor(i / 4 / n); const r = d[i], g = d[i + 1], b = d[i + 2]; const l = 0.3 * r + 0.59 * g + 0.11 * b;
    let R, G, B;
    if (tipo === 'podre') { let mancha = 1; for (const [mx, my, mr] of blobs) { const dd = Math.hypot(px - mx, py - my); if (dd < mr) mancha = Math.min(mancha, 0.42 + 0.58 * (dd / mr) ** 2); } R = (l * 0.62 + 18) * mancha; G = (l * 0.78 + 26) * mancha; B = (l * 0.3 + 10) * mancha; const vin = Math.hypot(px - n / 2, py - n / 2) / (n / 2); const esc = 1 - Math.max(0, vin - 0.55) * 1.2; R *= esc; G *= esc; B *= esc; }
    else if (tipo === 'ouro') { R = Math.min(255, l * 1.12 + 52); G = Math.min(255, l * 0.88 + 30); B = l * 0.32 + 4; const brilho = Math.max(0, 1 - Math.abs((px + py) - n * 0.7) / 6) * 70; R = Math.min(255, R + brilho); G = Math.min(255, G + brilho); B = Math.min(255, B + brilho * 0.6); }
    else { R = l * 0.55 + 30; G = l * 0.8 + 52; B = Math.min(255, l * 1.0 + 92); const borda = Math.hypot(px - n / 2, py - n / 2) / (n / 2); if (borda > 0.8) { const geada = (borda - 0.8) * 5 * 120; R = Math.min(255, R + geada); G = Math.min(255, G + geada); B = Math.min(255, B + geada); } }
    d[i] = r + (R - r) * k; d[i + 1] = g + (G - g) * k; d[i + 2] = b + (B - b) * k;
  }
  x.putImageData(im, 0, 0); return FILTROS[chave] = cv;
}
const FILTROS = {};

/* ---------- dados ---------- */
const JANELA = 20, MINIMO = 8;
let DADOS = null;
function montarDados() {
  const hist = ranking.historicos || {};
  const contas = Object.keys(hist);
  const perfis = ranking.perfis || {};
  const nomes = { ...((parceirosBase && parceirosBase.nomes) || {}), ...Object.fromEntries((ranking.ranking || []).map(j => [j.accountId, j.nome])) };
  const cores = Object.fromEntries(contas.map((c, i) => [c, CORES_ELO[i % CORES_ELO.length]]));
  // quantos amigos estavam do mesmo lado em cada partida (para a conta ajustada)
  const lados = new Map();
  contas.forEach(c => hist[c].forEach(h => { if (!h.comStack) return; const k = h.matchId + (h.lado || ''); lados.set(k, (lados.get(k) || 0) + 1); }));
  const ev = Object.fromEntries(contas.map(c => [c, hist[c].filter(h => h.comStack).sort((a, b) => (a.inicio || 0) - (b.inicio || 0))]));
  // índice ajustado: vezes culpado (ou craque) dividido pelo esperado para o tamanho do grupo; 100 = na média
  const indice = (c, tipo, ate) => {
    const l = ev[c].filter(h => (h.inicio || 0) <= ate); const w = l.slice(-JANELA); if (w.length < MINIMO) return null;
    const alvo = tipo === 'culp' ? 'culpado' : 'craque';
    const hits = w.filter(h => h.tipo === alvo).length;
    const esp = w.reduce((s, h) => s + ((tipo === 'culp' ? h.tipo === 'derrota' || h.tipo === 'culpado' : h.tipo === 'vitoria' || h.tipo === 'craque') ? 1 / Math.max(1, lados.get(h.matchId + (h.lado || '')) || 1) : 0), 0);
    return esp ? (100 * hits) / esp : null;
  };
  const agora = Date.now() / 1000;
  const vals = Object.fromEntries(contas.map(c => [c, { cu: indice(c, 'culp', agora), cr: indice(c, 'craq', agora) }]));
  // semana (domingo a sábado): vitórias fazem o sol crescer, derrotas o buraco negro
  const hoje = new Date(); const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay()) / 1000;
  let v = 0, l = 0; ((parceirosBase && parceirosBase.jogos) || []).forEach(g => { if (g.t >= ini) g.v ? v++ : l++; });
  const eventos = contas.flatMap(c => ev[c].filter(h => h.tipo === 'culpado' || h.tipo === 'craque').map(h => ({ c, k: h.tipo === 'culpado' ? 'culp' : 'craq', t: h.inicio || 0 })));
  DADOS = { contas, nomes, cores, perfis, vals, sem: { v, l }, eventos };
}
const nomeDe = c => (DADOS.nomes[c] || c);
const corDe = c => DADOS.cores[c] || '#888';
const iniDe = c => ((nomeDe(c).match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase());
const fmt = v => (v == null ? '–' : v.toFixed(0));

/* ---------- fotos da Steam (com CORS para poder aplicar os filtros) ---------- */
const FOTOS = {};
function FOTO(c) {
  const u = (DADOS.perfis[c] || {}).avatar; if (!u) return null;
  let f = FOTOS[c];
  if (!f) { f = FOTOS[c] = new Image(); f.crossOrigin = 'anonymous';
    f.onerror = () => { if (f.semCors) { f.falhou = true; return; } const g = new Image(); g.semCors = true; g.onerror = () => { g.falhou = true; }; g.src = u; FOTOS[c] = g; };
    f.src = u + (u.includes('?') ? '&c' : '?'); }
  return f.complete && f.naturalWidth && !f.falhou ? f : null;
}
function bolinha(ctx, c, x, y, r, brilho, img) {
  ctx.save(); ctx.shadowColor = corDe(c); ctx.shadowBlur = brilho || 14;
  ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, 7); ctx.fillStyle = corDe(c); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = '#121a17'; ctx.fill();
  const f = img || FOTO(c);
  if (f) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip(); ctx.drawImage(f, x - r, y - r, r * 2, r * 2); ctx.restore(); return; }
  ctx.fillStyle = '#e9f2ec'; ctx.font = `800 ${Math.round(r * 0.95)}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(iniDe(c), x, y + 1); ctx.textBaseline = 'alphabetic';
}

/* ---------- a cena ---------- */
const CHAVE = 'binario-visto-v1';
const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } };
const gravar = v => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) { /* sem armazenamento: tudo bem */ } };

const CENA = { montado: false, nomes: false, hover: null };
function ladoDe(cu, cr, mxC, mxK) {
  if (cu == null && cr == null) return null;
  const a = cu == null ? 0 : Math.min(1, cu / mxC), b = cr == null ? 0 : Math.min(1, cr / mxK); let d = b - a;
  if (!(b > 0) && a > 0) d = Math.min(d, -0.12); // nunca foi craque na janela: não chega no sol
  if (Math.abs(d) < 0.1) return { lado: 'muro', forca: 0 };
  return d < 0 ? { lado: 'bh', forca: Math.min(1, -d * 1.8) } : { lado: 'sol', forca: Math.min(1, d * 1.8) };
}

function montar(el) {
  el.innerHTML = `<div class="binario-palco"><canvas></canvas>
      <button class="binario-nomes" id="binario-nomes" aria-pressed="false">Mostrar nomes</button></div>
    <p class="binario-nota">Cada amigo orbita o lado que pesa mais nele: perto do <b class="r">buraco negro</b> quem anda sendo culpado, perto do <b class="g">sol</b> quem anda carregando, e quem está equilibrado fica gelado, orbitando os dois por fora. A conta é das últimas ${JANELA} partidas com o grupo, ajustada pelo tamanho do grupo. O buraco negro cresce com as derrotas da semana e o sol com as vitórias. Passe o mouse (ou toque) num planeta para ver quem é.</p>`;
  const cv = el.querySelector('canvas'); const ctx = cv.getContext('2d');
  Object.assign(CENA, { el, cv, ctx, o: {}, fios: [], flut: [], ult: null, fase: 0, est: Array.from({ length: 220 }, () => [Math.random(), Math.random(), Math.random()]) });
  const btn = el.querySelector('#binario-nomes');
  btn.onclick = () => { CENA.nomes = !CENA.nomes; btn.setAttribute('aria-pressed', String(CENA.nomes)); btn.textContent = CENA.nomes ? 'Esconder nomes' : 'Mostrar nomes'; };
  const acha = e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; let m = null, md = 30;
    Object.values(CENA.o).forEach(o => { const d = Math.hypot(o.x - x, o.y - y); if (d < md) { md = d; m = o.c; } }); CENA.hover = m; };
  cv.addEventListener('pointermove', acha); cv.addEventListener('pointerdown', acha); cv.addEventListener('pointerleave', () => { CENA.hover = null; });
  // só anima quando está na tela
  CENA.visivel = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { CENA.visivel = es[0].isIntersecting; if (CENA.visivel) laco(); }).observe(cv);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) laco(); });
  CENA.montado = true;
}

function prepararVisita() {
  // o que mudou desde a última visita: os planetas saem de onde estavam e vão para onde estão agora
  const antes = ler();
  const agora = Date.now() / 1000;
  CENA.antes = antes && antes.vals ? antes : null;
  CENA.inicio = performance.now() / 1000;
  CENA.novidades = antes && antes.t ? DADOS.eventos.filter(e => e.t > antes.t).sort((a, b) => a.t - b.t).slice(-12) : [];
  gravar({ t: agora, vals: DADOS.vals, sem: DADOS.sem });
}

let pedido = null;
function laco() {
  if (pedido || !CENA.montado) return;
  pedido = requestAnimationFrame(tempo => { pedido = null; if (!CENA.visivel || document.hidden || !document.body.contains(CENA.cv)) return; quadro(tempo); laco(); });
}

function quadro(tempo) {
  const { cv, ctx } = CENA; const r = cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, t = tempo / 1000; if (!W || !H) return;
  const dt = CENA.ult == null ? 0.016 : Math.max(0, Math.min(0.05, t - CENA.ult)); CENA.ult = t;
  const cel = W < 560, cx = W / 2, cy = H * 0.55, R = Math.min(W * 0.47, H * 1.15); KY = cel ? 0.62 : 0.34;
  // durante os primeiros segundos mostra o estado da última visita; depois desliza para o atual
  const desde = t - CENA.inicio; const usaAntes = CENA.antes && desde < 1.6;
  const vals = usaAntes ? CENA.antes.vals : DADOS.vals; const sem = usaAntes && CENA.antes.sem ? CENA.antes.sem : DADOS.sem;
  const lista = DADOS.contas.filter(c => vals[c]);
  const mxC = Math.max(100, ...lista.map(c => vals[c].cu || 0)), mxK = Math.max(100, ...lista.map(c => vals[c].cr || 0));
  const Ma = 0.85 + 0.5 * Math.min(1, sem.l / 30), Sa = 0.85 + 0.5 * Math.min(1, sem.v / 30);
  CENA.M = CENA.M == null ? Ma : CENA.M + (Ma - CENA.M) * Math.min(1, dt * 1.5); CENA.Sr = CENA.Sr == null ? Sa : CENA.Sr + (Sa - CENA.Sr) * Math.min(1, dt * 1.5);
  const base = Math.min(W, H * 1.6) / 30, rh = base * 0.84 * CENA.M, rs = base * 1.2 * CENA.Sr;
  ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, W, H);
  CENA.est.forEach(([x, y, k]) => { ctx.fillStyle = `rgba(220,232,255,${0.15 + 0.5 * Math.abs(Math.sin(t * 0.8 + k * 30))})`; const s = k > 0.92 ? 1.6 : 1; ctx.fillRect(Math.round(x * W), Math.round(y * H), s, s); });
  CENA.fase += dt * 0.12; const dB = R * 0.2, dS = R * 0.36;
  const BH = [cx - Math.cos(CENA.fase) * dB, cy - Math.sin(CENA.fase) * dB * KY], SOL = [cx + Math.cos(CENA.fase) * dS, cy + Math.sin(CENA.fase) * dS * KY];
  const corpos = []; const cont = { bh: 0, sol: 0, muro: 0 };
  lista.forEach((c, i) => {
    const { cu, cr } = vals[c]; const q = ladoDe(cu, cr, mxC, mxK); if (!q) { delete CENA.o[c]; return; }
    const { lado, forca } = q; let centro, rr;
    if (lado === 'muro') { centro = [cx, cy]; rr = R * (0.8 + (i % 4) * 0.05); }
    else if (lado === 'bh') { centro = BH; rr = rh * 3.8 + R * 0.24 * (1 - forca); }
    else { centro = SOL; rr = rs * 2.6 + R * 0.2 * (1 - forca); }
    cont[lado]++;
    const o = CENA.o[c] = CENA.o[c] || { ang: (i / lista.length) * 6.283, rr, cx: centro[0], cy: centro[1], tr: [] };
    const vel = usaAntes ? 3 : 1.1; // a mudança da última visita acontece devagar, para dar para ver
    o.rr += (rr - o.rr) * Math.min(1, dt * vel); o.cx += (centro[0] - o.cx) * Math.min(1, dt * (usaAntes ? 3 : 1.4)); o.cy += (centro[1] - o.cy) * Math.min(1, dt * (usaAntes ? 3 : 1.4));
    o.ang += dt * 1.4 * Math.pow(60 / Math.max(30, o.rr), 1.5);
    o.x = o.cx + Math.cos(o.ang) * o.rr; o.y = o.cy + Math.sin(o.ang) * o.rr * KY; o.prof = Math.sin(o.ang);
    o.tr.push([o.x, o.y]); if (o.tr.length > 26) o.tr.shift();
    Object.assign(o, { c, cu, cr, lado, forca });
    corpos.push(o);
  });
  const lid = []; ['bh', 'sol'].forEach(s => { const l = corpos.filter(o => o.lado === s).sort((a, b) => b.forca - a.forca)[0]; if (l) lid.push(l); });
  // novidades desde a última visita: "+1 culpado" / "+1 craque" em cima de quem foi
  if (!usaAntes && CENA.novidades.length) { const e = CENA.novidades[0]; if (!CENA.proxNov || t >= CENA.proxNov) { CENA.novidades.shift(); CENA.proxNov = t + 0.7; const o = CENA.o[e.c]; if (o) CENA.flut.push({ o, k: e.k, t0: t }); } }
  // fios: do planeta para o buraco negro, do sol para o planeta, e a matéria que o buraco negro rouba do sol
  corpos.forEach(o => { if (o.lado === 'muro') return; const L = lid.includes(o); const top = corpos.filter(q => q.lado === o.lado).sort((a, b) => b.forca - a.forca).indexOf(o); if (top > 2) return; const taxa = (L ? 16 : 3 + 4 * o.forca) * (cel ? 0.6 : 1);
    o.acc = (o.acc || 0) + taxa * dt; while (o.acc >= 1) { o.acc -= 1; CENA.fios.push({ o, u: 0, v: 0.28 + Math.random() * 0.18, a0: o.ang + (Math.random() - .5) * 0.15, r0: o.rr, k: o.lado, giro: 2.2 + Math.random() * 1.2, cor: hexRgb(corDe(o.c)) }); } });
  CENA.massa = (CENA.massa || 0) + dt * (cel ? 10 : 18); while (CENA.massa >= 1) { CENA.massa -= 1; CENA.fios.push({ massa: true, u: 0, v: 0.35 + Math.random() * 0.1, j: (Math.random() - .5) }); }
  CENA.fios = CENA.fios.filter(f => (f.u += dt * f.v) < 1 && (f.massa || CENA.o[f.o.c] === f.o)).slice(-700);
  const posFio = (f, u) => {
    if (f.massa) { const [sx, sy] = SOL, [bx, by] = BH; const mxp = (sx + bx) / 2, myp = (sy + by) / 2 - R * 0.12; const ang = Math.atan2(sy - by, sx - bx);
      if (u < 0.6) { const w = u / 0.6, a = (1 - w) * (1 - w), b = 2 * (1 - w) * w, c2 = w * w; const ox = sx - Math.cos(ang) * rs, oy = sy - Math.sin(ang) * rs * KY; const tx = bx + Math.cos(ang) * rh * 3.2, ty = by + Math.sin(ang) * rh * 3.2 * KY;
        return [a * ox + b * mxp + c2 * tx + f.j * 4 * b, a * oy + b * myp + c2 * ty + f.j * 3 * b]; }
      const w = (u - 0.6) / 0.4; const rr = rh * 3.2 * (1 - w) + rh * 1.05 * w; const aa = ang + w * 4.5; return [bx + Math.cos(aa) * rr, by + Math.sin(aa) * rr * KY]; }
    if (f.k === 'bh') { const rr = f.r0 * Math.pow(1 - u, 1.3) + rh * 1.05 * u; const aa = f.a0 + u * f.giro * (1 + u); return [BH[0] + Math.cos(aa) * rr, BH[1] + Math.sin(aa) * rr * KY, Math.sin(aa)]; }
    const o = f.o; const sx = SOL[0] + Math.cos(f.a0) * rs, sy = SOL[1] + Math.sin(f.a0) * rs * KY; const e = u * u * (3 - 2 * u); return [sx + (o.x - sx) * e, sy + (o.y - sy) * e - Math.sin(u * Math.PI) * 18, 0];
  };
  const desenhaFios = filtro => { ctx.lineCap = 'round'; CENA.fios.forEach(f => { if (!filtro(f)) return; const a = posFio(f, Math.max(0, f.u - 0.035)), b = posFio(f, f.u);
      const cor = f.massa ? [255, 200, 110] : f.k === 'bh' ? mixCor(f.cor, [255, 240, 215], Math.pow(f.u, 1.5)) : [255, 214, 120];
      const al = Math.min(1, f.u * 6, (1 - f.u) * 5); ctx.strokeStyle = rgb(cor, al); ctx.lineWidth = f.massa ? 1.3 : 1.7; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }); ctx.lineCap = 'butt'; };
  ctx.lineWidth = 1; corpos.forEach(o => { ctx.beginPath(); ctx.ellipse(o.cx, o.cy, o.rr, o.rr * KY, 0, 0, 7); ctx.strokeStyle = o.lado === 'bh' ? 'rgba(255,110,120,.10)' : o.lado === 'sol' ? 'rgba(255,210,120,.10)' : 'rgba(150,180,220,.08)'; ctx.stroke(); });
  const planeta = o => { const L = lid.includes(o); const ps = 0.5 + 0.5 * Math.sin(t * 7);
    const tam = (L ? 17 + 2.5 * ps : 10 + 4 * o.forca) * (0.82 + 0.18 * (o.prof + 1)) * (cel ? 0.85 : 1); o.tam = tam;
    ctx.beginPath(); o.tr.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.strokeStyle = corDe(o.c) + '55'; ctx.lineWidth = 1.5; ctx.stroke();
    const cl = o.lado === 'bh' ? [255, 77, 94] : o.lado === 'sol' ? [255, 200, 90] : [180, 200, 230];
    const aura = o.lado === 'bh' ? auraSombria : o.lado === 'sol' ? auraLuz : auraFrio;
    const ka = L ? null : Math.max(0.15, o.forca * 0.6);
    aura(ctx, o, t, dt, tam, 'tras', BH, cel, ka);
    const filtro = o.lado === 'bh' ? 'podre' : o.lado === 'sol' ? 'ouro' : 'gelo';
    const nivel = L ? 1 : o.lado === 'muro' ? 0.75 : Math.round((0.35 + 0.65 * o.forca) * 4) / 4;
    bolinha(ctx, o.c, o.x, o.y, tam, L ? 18 : 6, fotoFiltrada(o.c, filtro, nivel));
    if (L) { ctx.beginPath(); ctx.arc(o.x, o.y, tam + 4.5, 0, 7); ctx.strokeStyle = rgb(cl); ctx.lineWidth = 2; ctx.stroke(); }
    aura(ctx, o, t, dt, tam, 'frente', BH, cel, ka);
    if ((CENA.nomes && (!cel || L)) || CENA.hover === o.c) {
      const txt = nomeDe(o.c).slice(0, 14);
      ctx.font = `${L ? 700 : 500} ${L ? 12 : 11}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const w = ctx.measureText(txt).width + 10, ty = o.y - tam - 9; ctx.fillStyle = 'rgba(4,6,10,.75)'; ctx.fillRect(o.x - w / 2, ty - 11, w, 15);
      ctx.fillStyle = L ? rgb(cl) : '#dfe8e2'; ctx.fillText(txt, o.x, ty);
      ctx.font = '500 10px "IBM Plex Mono", monospace'; const by = o.y + tam + 13;
      ctx.fillStyle = 'rgba(4,6,10,.75)'; ctx.fillRect(o.x - 34, by - 10, 68, 13);
      ctx.fillStyle = '#ff7482'; ctx.textAlign = 'right'; ctx.fillText(`☠${fmt(o.cu)}`, o.x - 3, by); ctx.fillStyle = '#ffd166'; ctx.textAlign = 'left'; ctx.fillText(`★${fmt(o.cr)}`, o.x + 3, by);
    } };
  const atras = corpos.filter(o => o.prof < 0).sort((a, b) => a.y - b.y), frente = corpos.filter(o => o.prof >= 0).sort((a, b) => a.y - b.y);
  const cena = [{ y: BH[1], d: () => { buracoNegro(ctx, BH[0], BH[1], rh, t, 'tras'); desenhaFios(f => !f.massa && f.k === 'bh' && f.u > 0.75 || f.massa && f.u > 0.85); buracoNegro(ctx, BH[0], BH[1], rh, t, 'frente'); } },
    { y: SOL[1], d: () => sol(ctx, SOL[0], SOL[1], rs, t) }].sort((a, b) => a.y - b.y);
  atras.forEach(planeta);
  desenhaFios(f => f.massa ? f.u <= 0.85 : f.k === 'bh' ? f.u <= 0.75 && posFio(f, f.u)[2] < 0 : false);
  cena.forEach(c => c.d());
  desenhaFios(f => !f.massa && (f.k === 'sol' || (f.k === 'bh' && f.u <= 0.75 && posFio(f, f.u)[2] >= 0)));
  frente.forEach(planeta);
  CENA.flut = CENA.flut.filter(f => t - f.t0 < 2);
  CENA.flut.forEach(f => { const u = (t - f.t0) / 2; ctx.font = '700 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = f.k === 'culp' ? `rgba(255,92,108,${1 - u})` : `rgba(255,209,102,${1 - u})`;
    ctx.fillText(`${nomeDe(f.o.c).slice(0, 12)} ${f.k === 'culp' ? '+1 culpado' : '+1 craque'}`, f.o.x, f.o.y - 34 - u * 26); });
  ctx.textAlign = 'left'; const hx = 14; let hy = 22; const linha = (txt, cor, f) => { ctx.font = f; ctx.fillStyle = cor; ctx.fillText(txt, hx, hy); hy += 16; };
  const lb = lid.find(o => o.lado === 'bh'), ls = lid.find(o => o.lado === 'sol');
  linha(`◉ LADO SOMBRIO · ${cont.bh}`, '#ff5c6c', '700 11px "IBM Plex Mono", monospace'); linha(lb ? `${nomeDe(lb.c)} sendo sugado` : 'ninguém', '#e8efe9', '500 12.5px "IBM Plex Mono", monospace');
  linha(`☀ LADO DO SOL · ${cont.sol}`, '#ffd166', '700 11px "IBM Plex Mono", monospace'); linha(ls ? `${nomeDe(ls.c)} brilhando` : 'ninguém', '#e8efe9', '500 12.5px "IBM Plex Mono", monospace');
  linha(`❄ ${cont.muro} em cima do muro · semana ${sem.v}V ${sem.l}D`, 'rgba(232,239,233,.6)', '500 10.5px "IBM Plex Mono", monospace');
}

window.renderizarBinario = function () {
  const el = document.getElementById('binario'); if (!el || !ranking || !ranking.historicos) return;
  const primeira = !DADOS; montarDados();
  if (!CENA.montado || !el.contains(CENA.cv)) montar(el);
  if (primeira) prepararVisita();
  laco();
};
})();
