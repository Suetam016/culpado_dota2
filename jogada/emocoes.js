// Expressões do cabeção: pega o retrato do herói e desenha versões engraçadas por cima (feliz, triste, dor, morto,
// assustado, bravo). Tudo em canvas 2D, sem IA: muda cor, deforma o rosto e cola "adesivos" de desenho animado.
// A imagem precisa ter vindo com crossOrigin = 'anonymous' (como no index.html) para virar textura WebGL depois.
//
// Uso:
//   const caras = Emocoes.gerar(img, { tamanho: 256, moldura: '#e5533d' })  // { normal, feliz, triste, ... } (canvas)
//   tex.image = caras.dor; tex.needsUpdate = true
//   Emocoes.animar(nome, t) -> { sx, sy, rot, dx, dy } para o motor balançar o disco (t em segundos desde o início)
//   Emocoes.porEvento: qual emoção usar em cada momento (ver o fim do arquivo)
(function () {
  const PI = Math.PI;
  const NOMES = ['normal', 'feliz', 'triste', 'dor', 'morto', 'assustado', 'bravo'];

  // recorte quadrado do retrato (os retratos do Dota são 256x144, rosto no centro e um pouco acima)
  function recorte(img, S) {
    const c = tela(S), g = c.getContext('2d');
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, sz = Math.min(w, h) * 0.92;
    g.drawImage(img, (w - sz) / 2, (h - sz) * 0.2, sz, sz, 0, 0, S, S);
    return c;
  }
  function tela(S) { const c = document.createElement('canvas'); c.width = c.height = S; return c; }

  // filtros de cor por pixel (o ctx.filter não existe no Safari)
  function cor(c, f) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const o = f(p[i], p[i + 1], p[i + 2]); p[i] = o[0]; p[i + 1] = o[1]; p[i + 2] = o[2]; }
    g.putImageData(d, 0, 0); return c;
  }
  const luma = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (a, b, k) => a + (b - a) * k;
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

  // desenha o rosto deformado: escala, rotação e ondulação em faixas
  function deformar(base, S, { sx = 1, sy = 1, rot = 0, dy = 0, onda = 0, freq = 3 }) {
    const c = tela(S), g = c.getContext('2d');
    g.save(); g.translate(S / 2, S / 2 + dy * S); g.rotate(rot); g.scale(sx, sy); g.translate(-S / 2, -S / 2);
    if (!onda) g.drawImage(base, 0, 0);
    else { const n = 32, fh = S / n; for (let i = 0; i < n; i++) g.drawImage(base, 0, i * fh, S, fh + 1, Math.sin(i / n * PI * freq) * onda * S, i * fh, S, fh + 1); }
    g.restore();
    return c;
  }

  // ---------- adesivos ----------
  function contornado(g, desenhar, cheio, linha = 0.022) {
    const S = g.canvas.width; g.lineJoin = g.lineCap = 'round';
    g.lineWidth = linha * S * 2.2; g.strokeStyle = '#0b0806'; desenhar(); g.stroke();
    if (cheio) { g.fillStyle = cheio; desenhar(); g.fill(); }
  }
  function gota(g, x, y, r, cheio = '#7fd3ff') {
    const S = g.canvas.width; x *= S; y *= S; r *= S;
    contornado(g, () => { g.beginPath(); g.moveTo(x, y - r * 1.8); g.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r); g.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.8); }, cheio);
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.25, 0, PI * 2); g.fill();
  }
  function brilho(g, x, y, r, cheio = '#ffe066') {
    const S = g.canvas.width; x *= S; y *= S; r *= S;
    contornado(g, () => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * PI / 4, rr = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }, cheio, 0.012);
  }
  function bochecha(g, x, y, r) {
    const S = g.canvas.width, gr = g.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S);
    gr.addColorStop(0, 'rgba(255,90,120,.75)'); gr.addColorStop(1, 'rgba(255,90,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x * S, y * S, r * S, 0, PI * 2); g.fill();
  }
  function sorriso(g) {
    const S = g.canvas.width, x = 0.5 * S, y = 0.7 * S, w = 0.22 * S;
    contornado(g, () => { g.beginPath(); g.moveTo(x - w, y - w * 0.15); g.quadraticCurveTo(x, y + w * 1.15, x + w, y - w * 0.15); g.quadraticCurveTo(x, y + w * 0.25, x - w, y - w * 0.15); }, '#fff8e8');
    g.fillStyle = '#e05a6a'; g.beginPath(); g.ellipse(x, y + w * 0.5, w * 0.35, w * 0.16, 0, 0, PI * 2); g.fill();
  }
  function bocaDor(g) {   // dentes cerrados em zigue-zague
    const S = g.canvas.width, x = 0.5 * S, y = 0.72 * S, w = 0.2 * S, h = 0.07 * S;
    contornado(g, () => { g.beginPath(); g.rect(x - w, y - h, w * 2, h * 2); }, '#fff8e8');
    g.strokeStyle = '#0b0806'; g.lineWidth = S * 0.012; g.beginPath(); g.moveTo(x - w, y);
    for (let i = 0; i <= 8; i++) g.lineTo(x - w + i * w / 4, y + (i % 2 ? -h * 0.6 : h * 0.6)); g.stroke();
  }
  function olhoX(g, x, y, r) {
    const S = g.canvas.width; x *= S; y *= S; r *= S;
    contornado(g, () => { g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); }, null, 0.03);
    g.strokeStyle = '#fff'; g.lineWidth = S * 0.03; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke();
  }
  function linhasImpacto(g, cheio = '#ffffff') {
    const S = g.canvas.width; g.strokeStyle = cheio; g.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + 0.3; g.lineWidth = S * (i % 2 ? 0.018 : 0.03);
      g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * S * 0.42, S / 2 + Math.sin(a) * S * 0.42); g.lineTo(S / 2 + Math.cos(a) * S * 0.5, S / 2 + Math.sin(a) * S * 0.5); g.stroke(); }
  }
  function veia(g, x, y, r) {   // a "veia de raiva" de anime
    const S = g.canvas.width; x *= S; y *= S; r *= S;
    contornado(g, () => { g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; g.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25); g.quadraticCurveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a + 0.6) * r * 0.5, x + Math.cos(a) * r, y + Math.sin(a) * r); } }, null, 0.012);
    g.strokeStyle = '#ff2b2b'; g.lineWidth = S * 0.026; g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; g.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25); g.quadraticCurveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a + 0.6) * r * 0.5, x + Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke();
  }
  function sobrancelhas(g) {   // sobrancelhas de bravo, em V
    const S = g.canvas.width; g.lineCap = 'round';
    [[1, '#0b0806', 0.06], [1, '#3a2418', 0.035]].forEach(([_, c, w]) => { g.strokeStyle = c; g.lineWidth = S * w;
      g.beginPath(); g.moveTo(0.26 * S, 0.3 * S); g.lineTo(0.44 * S, 0.38 * S); g.moveTo(0.74 * S, 0.3 * S); g.lineTo(0.56 * S, 0.38 * S); g.stroke(); });
  }
  function exclamacao(g, x, y, h) {
    const S = g.canvas.width; x *= S; y *= S; h *= S;
    contornado(g, () => { g.beginPath(); g.moveTo(x - h * 0.16, y - h); g.lineTo(x + h * 0.16, y - h); g.lineTo(x + h * 0.08, y - h * 0.3); g.lineTo(x - h * 0.08, y - h * 0.3); g.closePath(); g.moveTo(x + h * 0.12, y); g.arc(x, y, h * 0.12, 0, PI * 2); }, '#ffe066', 0.012);
  }
  function nuvemChuva(g) {
    const S = g.canvas.width, x = 0.5 * S, y = 0.13 * S;
    contornado(g, () => { g.beginPath(); [[-0.12, 0.02, 0.07], [0, -0.02, 0.09], [0.12, 0.02, 0.07]].forEach(([a, b, r]) => { g.moveTo(x + (a + r) * S, y + b * S); g.arc(x + a * S, y + b * S, r * S, 0, PI * 2); }); }, '#8a93a6', 0.012);
    g.strokeStyle = '#7fd3ff'; g.lineWidth = S * 0.012; for (let i = 0; i < 5; i++) { const xx = x + (i - 2) * 0.06 * S; g.beginPath(); g.moveTo(xx, y + 0.08 * S); g.lineTo(xx - 0.015 * S, y + 0.15 * S); g.stroke(); }
  }
  function aureola(g) {
    const S = g.canvas.width; g.strokeStyle = '#ffe066'; g.lineWidth = S * 0.035; g.beginPath(); g.ellipse(S / 2, 0.09 * S, 0.2 * S, 0.05 * S, 0, 0, PI * 2); g.stroke();
  }
  function moldura(g, cor) {
    const S = g.canvas.width; g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, PI * 2); g.fill(); g.globalCompositeOperation = 'source-over';
    if (cor) { g.strokeStyle = cor; g.lineWidth = S * 0.04; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - S * 0.02, 0, PI * 2); g.stroke(); }
  }

  // ---------- as emoções ----------
  const RECEITAS = {
    normal: (b, S) => deformar(b, S, {}),
    feliz(b, S) {
      const c = cor(deformar(b, S, { sx: 1.06, sy: 0.96, dy: -0.02 }), (r, g, bb) => [clamp(r * 1.12 + 10), clamp(g * 1.05 + 6), clamp(bb * 0.92)]);
      const g = c.getContext('2d'); bochecha(g, 0.27, 0.62, 0.11); bochecha(g, 0.73, 0.62, 0.11); sorriso(g);
      brilho(g, 0.22, 0.24, 0.07); brilho(g, 0.8, 0.3, 0.05); brilho(g, 0.7, 0.16, 0.035); return c;
    },
    triste(b, S) {
      const c = cor(deformar(b, S, { sx: 0.97, sy: 0.93, rot: -0.1, dy: 0.04 }), (r, g, bb) => { const l = luma(r, g, bb); return [mix(r, l, 0.7) * 0.8, mix(g, l, 0.7) * 0.88, clamp(mix(bb, l, 0.7) * 1.15 + 18)]; });
      const g = c.getContext('2d'); gota(g, 0.33, 0.55, 0.035); gota(g, 0.34, 0.68, 0.03); gota(g, 0.67, 0.57, 0.035); gota(g, 0.66, 0.7, 0.03); nuvemChuva(g); return c;
    },
    dor(b, S) {
      const c = cor(deformar(b, S, { sx: 0.88, sy: 1.08, onda: 0.025, freq: 5 }), (r, g, bb) => [clamp(r * 1.25 + 40), g * 0.7, bb * 0.7]);
      const g = c.getContext('2d'); linhasImpacto(g); bocaDor(g); gota(g, 0.8, 0.3, 0.04); gota(g, 0.2, 0.36, 0.03); return c;
    },
    morto(b, S) {
      const c = cor(deformar(b, S, { rot: 0.25, sy: 0.95 }), (r, g, bb) => { const l = luma(r, g, bb) * 0.75; return [l, l, l * 1.05]; });
      const g = c.getContext('2d'); olhoX(g, 0.37, 0.43, 0.07); olhoX(g, 0.63, 0.43, 0.07); aureola(g); return c;
    },
    assustado(b, S) {
      const c = cor(deformar(b, S, { sx: 0.9, sy: 1.1, dy: -0.03 }), (r, g, bb) => { const l = luma(r, g, bb); return [clamp(mix(r, l, 0.5) + 35), clamp(mix(g, l, 0.5) + 45), clamp(mix(bb, l, 0.5) + 50)]; });
      const g = c.getContext('2d'); gota(g, 0.18, 0.3, 0.045); gota(g, 0.83, 0.26, 0.04); gota(g, 0.86, 0.45, 0.03); exclamacao(g, 0.82, 0.2, 0.16); return c;
    },
    bravo(b, S) {
      const c = cor(deformar(b, S, { sx: 1.05, sy: 0.95, dy: 0.02 }), (r, g, bb) => [clamp(r * 1.2 + 25), g * 0.85, bb * 0.8]);
      const g = c.getContext('2d'); veia(g, 0.72, 0.24, 0.11); sobrancelhas(g); return c;
    },
  };

  function gerar(img, op = {}) {
    const S = op.tamanho || 256, base = recorte(img, S), out = {};
    for (const n of NOMES) { const c = RECEITAS[n](base, S); moldura(c.getContext('2d'), op.moldura); out[n] = c; }
    return out;
  }

  // movimento do disco por emoção (o motor aplica no Group da cabeça)
  function animar(nome, t) {
    switch (nome) {
      case 'feliz': return { sx: 1 + 0.05 * Math.sin(t * 14), sy: 1 - 0.05 * Math.sin(t * 14), rot: 0.08 * Math.sin(t * 7), dx: 0, dy: 0.04 * Math.abs(Math.sin(t * 7)) };
      case 'triste': return { sx: 1, sy: 0.97, rot: -0.12, dx: 0, dy: -0.03 };
      case 'dor': return { sx: 0.9, sy: 1.1, rot: 0.15 * Math.sin(t * 40), dx: 0.03 * Math.sin(t * 53), dy: 0 };
      case 'morto': return { sx: 1, sy: 1, rot: 0.3, dx: 0, dy: 0 };
      case 'assustado': return { sx: 1.04, sy: 1.04, rot: 0, dx: 0.015 * Math.sin(t * 70), dy: 0.02 };
      case 'bravo': return { sx: 1 + 0.03 * Math.sin(t * 20), sy: 1, rot: 0, dx: 0, dy: 0 };
      default: return { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 };
    }
  }

  // emoção por evento: [herói, de (s), até (s), emoção], segundos desde 21:00 da partida 9057339159.
  // "dor" sempre ganha de outra emoção no mesmo instante; fora dos intervalos fica "normal".
  const porEvento = [
    ['faceless_void', 7.0, 9.0, 'normal'],     // canalizando o TP, tranquilo
    ['pudge', 9.0, 10.5, 'feliz'],             // acertou o Hook
    ['faceless_void', 9.0, 10.0, 'assustado'], // foi fisgado no meio do TP
    ['faceless_void', 10.0, 13.6, 'dor'],      // Dismember
    ['pudge', 10.5, 13.6, 'feliz'],            // comendo o Void
    ['faceless_void', 13.6, 15.5, 'feliz'],    // escapou de Time Walk
    ['pudge', 13.6, 15.5, 'bravo'],            // perdeu a presa
    ['pudge', 25.0, 26.0, 'assustado'],        // preso na Chronosphere
    ['terrorblade', 25.0, 30.5, 'assustado'],
    ['faceless_void', 25.0, 33.0, 'feliz'],    // dono do domo
    ['pudge', 26.0, 30.3, 'dor'],              // apanhando com crítico
    ['pudge', 30.3, 33.0, 'morto'],
    ['terrorblade', 30.5, 33.0, 'triste'],     // viu o aliado cair
  ];
  // golpe com dano acima de 400 força "dor" por 0,4 s em quem levou
  function emocaoEm(heroi, t, levouCriticoAgora) {
    if (levouCriticoAgora) return 'dor';
    let e = 'normal';
    for (const [h, a, b, n] of porEvento) if (h === heroi && t >= a && t < b) { if (n === 'dor') return 'dor'; e = n; }
    return e;
  }

  window.Emocoes = { NOMES, gerar, animar, porEvento, emocaoEm };
})();
