// Esteira de animações: moldes. Cada skill sem desenho feito à mão ganha uma ficha curta em skills/fichas.js
// ("molde cor opções"), e o molde monta a animação no mesmo contrato do ASSIN (ini/fim/chao/criar/desenhar).
// Desenho feito à mão (index.html ou skills/lote-N.js) sempre ganha: este lote só preenche o que falta (soNovas).
//
// Moldes: proj, onda, linha, area, feixe, corrente, marca, aura, giro, salto, invoca, golpe, chuva, vortice, cupula.
// Opções: rNNN raio/alcance em unidades do jogo, dN duração em s, aN atraso em s, nN quantidade, e uma palavra de forma
// ou glifo (ex.: flecha, estrela, escudo, ceu). Cores por nome (CORES) ou #hex.
(function () {
  'use strict';
  var CORES = {
    fogo: '#ff7a2e', brasa: '#ffb02e', gelo: '#8fd8ff', agua: '#4fb6ff', raio: '#b8d8ff', eletrico: '#7fe3ff',
    veneno: '#9be04a', acido: '#c6f03c', sombra: '#a07bff', vazio: '#7a5cff', sangue: '#e8333a', luz: '#ffe27a',
    ouro: '#ffd23f', terra: '#c8a46a', pedra: '#b9ad97', natureza: '#6fd16a', arcano: '#c77dff', rosa: '#ff7ac8',
    metal: '#d0d4dc', lua: '#cfe0ff', branco: '#f2f2f2', vermelho: '#ff4d4d', laranja: '#ff9a2e', verde: '#5fe36a',
    azul: '#5aa8ff', roxo: '#b15cff', ciano: '#5ff0e0', marrom: '#a8743e', vinho: '#b83a5e', espirito: '#9ff0d0',
  };
  var FORMAS = ['bola', 'flecha', 'lamina', 'gota', 'estrela', 'lanca', 'espinhos', 'gelo', 'fogo', 'rachadura', 'raios', 'cruz',
    'chama', 'anel', 'ceu', 'caveira', 'olho', 'espiral', 'escudo', 'totem', 'bicho', 'arvore', 'torre', 'pedra', 'reto', 'nota', 'coracao'];

  var ler = function (txt) {
    var p = txt.trim().split(/\s+/), o = { molde: p[0], cor: CORES[p[1]] || p[1] || '#ffffff' };
    for (var i = 2; i < p.length; i++) {
      var w = p[i], m = /^([rdan])(\d*\.?\d+)$/.exec(w);
      if (m) o[{ r: 'raio', d: 'dur', a: 'atraso', n: 'n' }[m[1]]] = Number(m[2]);
      else if (FORMAS.indexOf(w) >= 0) o.forma = w;
    }
    return o;
  };

  var fazer = function (K) {
    var s = K.s, at = K.at, Q = K.Q, pos = K.pos, mix = K.mix, lim = K.lim, saiDe = K.saiDe, sorte = K.sorte, dist = K.dist;
    var R = K.R, area = K.area, ESCURO = '#07070c';
    var f2 = function (n) { return n.toFixed(2); };
    var duplo = function (cor, extra) {
      var base = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      var a = s('path', Object.assign({}, base, { stroke: ESCURO, 'stroke-opacity': 0.55 }, extra || {}));
      var b = s('path', Object.assign({}, base, { stroke: cor }, extra || {}));
      return { els: [a, b], set: function (d, w, op) { op = op == null ? 1 : op; at(a, { d: d || '', 'stroke-width': w * 2.1, opacity: op }); at(b, { d: d || '', 'stroke-width': w, opacity: op }); } };
    };
    var cheio = function (cor) { return s('path', { fill: cor, stroke: ESCURO, 'stroke-linejoin': 'round' }); };
    var poe = function (g, xs) { xs.forEach(function (x) { if (x.els) x.els.forEach(function (y) { g.append(y); }); else g.append(x); }); };
    var seg = function (p, q) { return 'M' + f2(p[0]) + ',' + f2(p[1]) + 'L' + f2(q[0]) + ',' + f2(q[1]); };
    var circ = function (c, r) { r = Math.max(0.01, r); return 'M' + f2(c[0] - r) + ',' + f2(c[1]) + 'a' + f2(r) + ',' + f2(r) + ' 0 1 0 ' + f2(2 * r) + ',0a' + f2(r) + ',' + f2(r) + ' 0 1 0 ' + f2(-2 * r) + ',0'; };
    var arco = function (c, r, a0, a1) { var p0 = [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r], p1 = [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r]; return 'M' + f2(p0[0]) + ',' + f2(p0[1]) + 'A' + f2(r) + ',' + f2(r) + ' 0 ' + (Math.abs(a1 - a0) > Math.PI ? 1 : 0) + ' 1 ' + f2(p1[0]) + ',' + f2(p1[1]); };
    var poli = function (c, pts, giro) { return pts.map(function (q, i) { var a = q[1] + (giro || 0); return (i ? 'L' : 'M') + f2(c[0] + Math.cos(a) * q[0]) + ',' + f2(c[1] + Math.sin(a) * q[0]); }).join('') + 'Z'; };
    var raiosEm = function (c, n, r0, r1, giro) { var d = ''; for (var i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2 + (giro || 0); d += seg([c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0], [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1]); } return d; };
    var zigue = function (p, q, n, amp, sem) { var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, d = 'M' + f2(p[0]) + ',' + f2(p[1]); for (var i = 1; i < n; i++) { var k = i / n, o = (sorte(sem + i * 7.3) - 0.5) * 2 * amp; d += 'L' + f2(p[0] + dx * k + nx * o) + ',' + f2(p[1] + dy * k + ny * o); } return d + 'L' + f2(q[0]) + ',' + f2(q[1]); };
    var estrelaD = function (c, r, n, giro) { var pts = []; for (var i = 0; i < n * 2; i++) pts.push([i % 2 ? r * 0.45 : r, (i / (n * 2)) * Math.PI * 2 - Math.PI / 2]); return poli(c, pts, giro); };
    // glifos pequenos (marca, area), desenhados como traço em volta de c, tamanho r
    var GLIFO = {
      estrela: function (c, r, g) { return estrelaD(c, r, 5, g); },
      raios: function (c, r, g) { return raiosEm(c, 8, r * 0.35, r, g); },
      cruz: function (c, r, g) { return raiosEm(c, 4, 0, r, g + Math.PI / 4); },
      gelo: function (c, r, g) { var d = raiosEm(c, 6, 0, r, g); for (var i = 0; i < 6; i++) { var a = (i / 6) * Math.PI * 2 + g, m = [c[0] + Math.cos(a) * r * 0.6, c[1] + Math.sin(a) * r * 0.6]; d += seg(m, [m[0] + Math.cos(a + 0.7) * r * 0.3, m[1] + Math.sin(a + 0.7) * r * 0.3]) + seg(m, [m[0] + Math.cos(a - 0.7) * r * 0.3, m[1] + Math.sin(a - 0.7) * r * 0.3]); } return d; },
      chama: function (c, r, g) { var d = ''; for (var i = 0; i < 6; i++) { var a = (i / 6) * Math.PI * 2 + g; d += poli([c[0] + Math.cos(a) * r * 0.75, c[1] + Math.sin(a) * r * 0.75], [[r * 0.35, a + Math.PI / 2], [r * 0.45, a], [r * 0.35, a - Math.PI / 2]], 0); } return d; },
      anel: function (c, r) { return circ(c, r) + circ(c, r * 0.6); },
      caveira: function (c, r) { return circ([c[0], c[1] - r * 0.15], r * 0.6) + circ([c[0] - r * 0.22, c[1] - r * 0.15], r * 0.14) + circ([c[0] + r * 0.22, c[1] - r * 0.15], r * 0.14) + seg([c[0] - r * 0.25, c[1] + r * 0.55], [c[0] + r * 0.25, c[1] + r * 0.55]); },
      olho: function (c, r) { return 'M' + f2(c[0] - r) + ',' + f2(c[1]) + 'Q' + f2(c[0]) + ',' + f2(c[1] - r * 0.8) + ' ' + f2(c[0] + r) + ',' + f2(c[1]) + 'Q' + f2(c[0]) + ',' + f2(c[1] + r * 0.8) + ' ' + f2(c[0] - r) + ',' + f2(c[1]) + circ(c, r * 0.28); },
      espiral: function (c, r, g) { var d = ''; for (var i = 0; i <= 24; i++) { var k = i / 24, a = g + k * Math.PI * 3; d += (i ? 'L' : 'M') + f2(c[0] + Math.cos(a) * r * k) + ',' + f2(c[1] + Math.sin(a) * r * k); } return d; },
      escudo: function (c, r, g) { var pts = []; for (var i = 0; i < 6; i++) pts.push([r, (i / 6) * Math.PI * 2 + Math.PI / 6 + g * 0.2]); return poli(c, pts, 0); },
      gota: function (c, r) { return 'M' + f2(c[0]) + ',' + f2(c[1] - r) + 'Q' + f2(c[0] + r * 0.8) + ',' + f2(c[1] + r * 0.2) + ' ' + f2(c[0]) + ',' + f2(c[1] + r * 0.7) + 'Q' + f2(c[0] - r * 0.8) + ',' + f2(c[1] + r * 0.2) + ' ' + f2(c[0]) + ',' + f2(c[1] - r) + 'Z'; },
      raio: function (c, r) { return 'M' + f2(c[0] + r * 0.2) + ',' + f2(c[1] - r) + 'L' + f2(c[0] - r * 0.35) + ',' + f2(c[1] + r * 0.1) + 'L' + f2(c[0] + r * 0.2) + ',' + f2(c[1] + r * 0.05) + 'L' + f2(c[0] - r * 0.2) + ',' + f2(c[1] + r); },
      nota: function (c, r) { return circ([c[0] - r * 0.3, c[1] + r * 0.5], r * 0.3) + seg([c[0], c[1] + r * 0.5], [c[0], c[1] - r * 0.8]) + seg([c[0], c[1] - r * 0.8], [c[0] + r * 0.5, c[1] - r * 0.5]); },
      coracao: function (c, r) { return 'M' + f2(c[0]) + ',' + f2(c[1] + r * 0.8) + 'C' + f2(c[0] - r * 1.2) + ',' + f2(c[1] - r * 0.1) + ' ' + f2(c[0] - r * 0.5) + ',' + f2(c[1] - r) + ' ' + f2(c[0]) + ',' + f2(c[1] - r * 0.35) + 'C' + f2(c[0] + r * 0.5) + ',' + f2(c[1] - r) + ' ' + f2(c[0] + r * 1.2) + ',' + f2(c[1] - r * 0.1) + ' ' + f2(c[0]) + ',' + f2(c[1] + r * 0.8) + 'Z'; },
    };
    var glifo = function (nome, c, r, g) { return (GLIFO[nome] || GLIFO.raios)(c, r, g || 0); };
    var estouro = function (cor) {
      var anel = duplo(cor), rr = duplo('#fff');
      return { els: anel.els.concat(rr.els), set: function (c, k, z, forte) {
        if (!c || k < 0 || k > 1) { anel.set('', 0, 0); rr.set('', 0, 0); return; }
        var f = forte ? 1.5 : 1, a = saiDe(k);
        anel.set(circ(c, (R * 0.7 + a * 2.6 * f) * z), 0.4 * z * (1 - k) + 0.05, 1 - k);
        rr.set(raiosEm(c, 8, (R * 0.9 + a * 1.4 * f) * z, (R * 0.9 + a * 3.2 * f) * z, 0.3), 0.22 * z, 1 - k);
      } };
    };
    var inimigos = function (a, b) { return a != null && b != null && K.nosSet.has(a) !== K.nosSet.has(b); };
    var alvoDe = function (uso, janela) {
      var hs = K.acertosDe(uso, janela).filter(function (d) { return inimigos(uso.quem, d.alvo); });
      if (hs.length) return { idx: hs[0].alvo, t: hs[0].t };
      if (uso.alvo != null && uso.alvo !== uso.quem) return { idx: uso.alvo, t: null };
      return null;
    };
    var pontoDe = function (uso, alcance) { return K.centroDe(K.acertosDe(uso, 3)) || K.pontaPara(uso, alcance) || pos(uso.t)[uso.quem]; };
    var durDe = function (uso, o, padrao, max) {
      if (o.dur) return o.dur;
      var fim = K.ticksDe(uso, uso.hab[0], uso.t + (max || 8), 1.6);
      return Math.max(padrao, Math.min(max || 8, fim == null ? padrao : fim - uso.t + 0.6));
    };
    var tok = function (F, idx, tt) { return F.tok(idx) || Q(pos(tt)[idx]); };
    var some = function (e, op) { e.g.setAttribute('opacity', f2(Math.max(0, op))); };
    var fade = function (tt, fim, f) { return tt > fim - f ? lim((fim - tt) / f) : 1; };
    // forma de projétil apontada na direção ang, em p
    var cabeca = function (forma, p, ang, z, giro) {
      var L = 0.9 * z, w = 0.38 * z, c = Math.cos(ang), sn = Math.sin(ang), P = function (a, b) { return f2(p[0] + c * a - sn * b) + ',' + f2(p[1] + sn * a + c * b); };
      if (forma === 'flecha' || forma === 'lanca') { var l = forma === 'lanca' ? 1.6 : 1; return 'M' + P(L * l, 0) + 'L' + P(-L * 0.2 * l, w) + 'L' + P(0, 0) + 'L' + P(-L * 0.2 * l, -w) + 'Z'; }
      if (forma === 'lamina') { var g = giro || 0, cg = Math.cos(g), sg = Math.sin(g), Q2 = function (a, b) { return f2(p[0] + cg * a - sg * b) + ',' + f2(p[1] + sg * a + cg * b); }; return 'M' + Q2(L, 0) + 'L' + Q2(0, w * 0.6) + 'L' + Q2(-L, 0) + 'L' + Q2(0, -w * 0.6) + 'Z'; }
      if (forma === 'estrela') return estrelaD(p, L * 0.8, 5, giro || 0);
      if (forma === 'gota') return 'M' + P(L, 0) + 'Q' + P(-L * 0.2, w * 1.4) + ' ' + P(-L * 0.6, 0) + 'Q' + P(-L * 0.2, -w * 1.4) + ' ' + P(L, 0) + 'Z';
      return circ(p, w * 1.3);
    };

    var M = {};
    // projétil até quem levou (ou até a ponta do alcance), com estouro
    M.proj = function (uso, o) {
      var alvo = alvoDe(uso, 2.5), de = pos(uso.t)[uso.quem];
      var fixo = alvo ? null : K.pontaPara(uso, o.raio || 900);
      if (!de || (!alvo && !fixo)) return null;
      var ate = alvo ? pos(uso.t)[alvo.idx] : fixo, VOO = alvo && alvo.t != null ? Math.max(0.2, Math.min(1.2, alvo.t - uso.t + 0.15)) : Math.max(0.2, Math.min(0.8, dist(de, ate) * 128 / 1400));
      if (!ate) return null;
      return { ini: uso.t, fim: uso.t + VOO + 0.6, chao: false,
        criar: function () { var g = s('g', {}), r = duplo(o.cor), c = cheio(o.cor), b = estouro(o.cor); poe(g, [r, c, b]); return { g: g, r: r, c: c, b: b }; },
        desenhar: function (e, tt, F) {
          var a = tok(F, uso.quem, uso.t), b = alvo ? tok(F, alvo.idx, tt) : Q(fixo); if (!a || !b) { some(e, 0); return; }
          some(e, 1);
          var k = (tt - uso.t) / VOO;
          if (k <= 1) { var p = mix(a, b, saiDe(k) * 0.3 + k * 0.7), p0 = mix(a, b, Math.max(0, k - 0.3)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]); e.r.set(seg(p0, p), 0.22 * F.z, 0.85); e.c.setAttribute('d', cabeca(o.forma, p, ang, F.z, tt * 20)); e.c.setAttribute('stroke-width', f2(0.12 * F.z)); }
          else { e.r.set('', 0, 0); e.c.setAttribute('d', ''); }
          e.b.set(b, (k - 1) * VOO / 0.55, F.z, false);
        } };
    };
    // onda que sai do herói e varre a linha (Dragon Slave, Shockwave)
    M.onda = function (uso, o) {
      var de = pos(uso.t)[uso.quem], hs = K.acertosDe(uso, 1.5), alc = (o.raio || 1000) / 128;
      var longe = hs.reduce(function (m, d) { var q = pos(d.t)[d.alvo]; return q && (!m || dist(q, de) > dist(m, de)) ? q : m; }, null);
      var dir = longe || K.pontaPara(uso, o.raio || 1000); if (!de || !dir) return null;
      var L = Math.hypot(dir[0] - de[0], dir[1] - de[1]) || 1, fimP = [de[0] + (dir[0] - de[0]) / L * Math.max(alc, L + 1), de[1] + (dir[1] - de[1]) / L * Math.max(alc, L + 1)];
      var DUR = 0.7;
      return { ini: uso.t, fim: uso.t + DUR + 0.2, chao: false,
        criar: function () { var g = s('g', {}), f1 = duplo(o.cor), f2_ = duplo('#fff'), rastro = duplo(o.cor, { 'stroke-dasharray': '.6 .5' }); poe(g, [rastro, f1, f2_]); return { g: g, f1: f1, f2: f2_, rastro: rastro }; },
        desenhar: function (e, tt, F) {
          var a = Q(de), b = Q(fimP), k = lim((tt - uso.t) / DUR), p = mix(a, b, saiDe(k)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), lar = area(o.n || 150, F.z) * 0.9;
          e.f1.set(arco(p, lar, ang - 0.9, ang + 0.9), 0.55 * F.z, 1 - k * 0.5);
          e.f2.set(arco(mix(a, b, Math.max(0, saiDe(k) - 0.05)), lar * 0.8, ang - 0.7, ang + 0.7), 0.22 * F.z, 1 - k * 0.5);
          e.rastro.set(seg(a, p), 0.25 * F.z, 0.6 * (1 - k));
          some(e, fade(tt, uso.t + DUR + 0.2, 0.3));
        } };
    };
    // fileira que brota do chão (espinhos, gelo, fogo, rachadura)
    M.linha = function (uso, o) {
      var de = pos(uso.t)[uso.quem]; if (!de) return null;
      var hs = K.acertosDe(uso, 1.5), longe = hs.reduce(function (m, d) { var q = pos(d.t)[d.alvo]; return q && (!m || dist(q, de) > dist(m, de)) ? q : m; }, null);
      var ponta = longe ? mix(de, longe, 1 + 1.4 / Math.max(1, dist(longe, de))) : K.pontaPara(uso, o.raio || 900); if (!ponta) return null;
      var N = 9, PASSO = 0.05, VIDA = (o.dur || 0.8);
      return { ini: uso.t, fim: uso.t + N * PASSO + VIDA, chao: true,
        criar: function () { var g = s('g', {}), fenda = duplo(o.forma === 'rachadura' ? o.cor : '#2a1d0e'), xs = []; for (var i = 0; i < N; i++) xs.push(cheio(o.cor)); poe(g, [fenda].concat(xs)); return { g: g, fenda: fenda, xs: xs }; },
        desenhar: function (e, tt, F) {
          var a = Q(de), b = Q(ponta), k = tt - uso.t, op = 1 - lim((k - N * PASSO) / VIDA);
          e.fenda.set(o.forma === 'rachadura' ? zigue(a, mix(a, b, lim(k / (N * PASSO))), 10, 0.5 * F.z, 3) : seg(a, mix(a, b, lim(k / (N * PASSO)))), (o.forma === 'rachadura' ? 0.35 : 0.14) * F.z, op);
          e.xs.forEach(function (p, i) {
            var f = (k - i * PASSO) / VIDA; if (f < 0 || f > 1 || o.forma === 'rachadura') { p.setAttribute('d', ''); return; }
            var cr = f < 0.25 ? saiDe(f / 0.25) * 1.15 : f < 0.4 ? 1.15 - 0.15 * ((f - 0.25) / 0.15) : 1 - Math.pow((f - 0.4) / 0.6, 2);
            var q = mix(a, b, (i + 0.8) / (N + 0.4)), h = (2 + sorte(i * 3.1) * 1) * F.z * cr, w = 0.65 * F.z;
            var d = o.forma === 'gelo' ? poli([q[0], q[1] - h * 0.4], [[h * 0.55, -Math.PI / 2], [w, 0], [h * 0.3, Math.PI / 2], [w, Math.PI]], 0)
              : o.forma === 'fogo' ? 'M' + f2(q[0] - w) + ',' + f2(q[1]) + 'Q' + f2(q[0] - w * 0.6) + ',' + f2(q[1] - h * 0.6) + ' ' + f2(q[0]) + ',' + f2(q[1] - h) + 'Q' + f2(q[0] + w * 0.6) + ',' + f2(q[1] - h * 0.6) + ' ' + f2(q[0] + w) + ',' + f2(q[1]) + 'Z'
              : 'M' + f2(q[0] - w) + ',' + f2(q[1]) + 'L' + f2(q[0]) + ',' + f2(q[1] - h) + 'L' + f2(q[0] + w) + ',' + f2(q[1]) + 'Z';
            p.setAttribute('d', d); p.setAttribute('stroke-width', f2(0.15 * F.z));
          });
        } };
    };
    // área: aviso (com atraso), estouro e, se durar, zona que pulsa
    M.area = function (uso, o) {
      var ponto = o.forma === 'ceu' || o.eu ? null : pontoDe(uso, o.raio ? Math.max(300, o.raio * 1.5) : 600);
      var noHeroi = !ponto || o.eu; var A = o.atraso || 0, D = o.dur || 0;
      if (o.forma === 'ceu') ponto = pontoDe(uso, 700);
      var fim = uso.t + A + Math.max(0.9, D);
      return { ini: uso.t, fim: fim, chao: true,
        criar: function () { var g = s('g', {}), fundo = s('path', { fill: o.cor, 'fill-opacity': 0.16, stroke: 'none' }), borda = duplo(o.cor), aviso = duplo(o.cor, { 'stroke-dasharray': '.6 .5' }), gl = duplo('#fff'), gl2 = duplo(o.cor), ceu = duplo('#fff'); poe(g, [fundo, aviso, borda, gl2, gl, ceu]); return { g: g, fundo: fundo, borda: borda, aviso: aviso, gl: gl, gl2: gl2, ceu: ceu }; },
        desenhar: function (e, tt, F) {
          var c = noHeroi && !ponto ? tok(F, uso.quem, tt) : Q(ponto); if (!c) { some(e, 0); return; }
          var rr = area(o.raio || 300, F.z), k = tt - uso.t;
          if (k < A) { var f = k / A; e.aviso.set(circ(c, rr * (1.3 - 0.3 * f)), 0.18 * F.z, 0.5 + f * 0.5); at(e.fundo, { d: '' }); e.borda.set('', 0, 0); e.gl.set('', 0, 0); e.gl2.set('', 0, 0); e.ceu.set('', 0, 0); some(e, 1); return; }
          e.aviso.set('', 0, 0);
          var kb = k - A, b = saiDe(lim(kb / 0.25)), viva = D > 0;
          var op = viva ? fade(tt, fim, 0.4) : 1 - lim((kb - 0.2) / 0.7);
          at(e.fundo, { d: circ(c, rr * b) });
          var pulso = viva ? 1 + 0.04 * Math.sin(kb * 8) : 1;
          e.borda.set(circ(c, rr * b * pulso), 0.38 * F.z, 1);
          var g0 = viva ? kb * 0.8 : 0;
          e.gl2.set(glifo(o.forma === 'ceu' ? 'raios' : o.forma, c, rr * 0.7 * b, g0), 0.4 * F.z, 0.9);
          e.gl.set(glifo(o.forma === 'ceu' ? 'raios' : o.forma, c, rr * 0.7 * b, g0), 0.14 * F.z, 0.9);
          e.ceu.set(o.forma === 'ceu' && kb < 0.35 ? seg([c[0], c[1] - 9 * F.z * (1 - kb / 0.35)], c) : '', 0.7 * F.z * (1 - kb / 0.35), 1);
          some(e, op);
        } };
    };
    // feixe do herói até o alvo (ou do céu, com ceu)
    M.feixe = function (uso, o) {
      var alvo = alvoDe(uso, 2); if (!alvo) return null;
      var A = o.atraso || 0.1, D = o.dur || 0.5;
      return { ini: uso.t, fim: uso.t + A + D + 0.5, chao: false,
        criar: function () { var g = s('g', {}), fora = duplo(o.cor), meio = duplo('#fff'), b = estouro(o.cor); poe(g, [fora, meio, b]); return { g: g, fora: fora, meio: meio, b: b }; },
        desenhar: function (e, tt, F) {
          var a = tok(F, uso.quem, tt), b = tok(F, alvo.idx, tt); if (!a || !b) { some(e, 0); return; }
          some(e, 1);
          var k = tt - uso.t, f = (k - A) / D;
          if (o.forma === 'ceu') a = [b[0], b[1] - 9 * F.z];
          if (f >= 0 && f <= 1) { var d = o.forma === 'reto' || o.forma === 'ceu' ? seg(a, b) : zigue(a, b, 9, 0.8 * F.z, Math.floor(tt * 18)); e.fora.set(d, 0.75 * F.z * (1 - f * 0.5), 1); e.meio.set(d, 0.24 * F.z, 1); }
          else { e.fora.set('', 0, 0); e.meio.set('', 0, 0); }
          e.b.set(b, (k - A - 0.05) / 0.6, F.z, true);
        } };
    };
    // ligação entre o herói e o alvo enquanto dura
    M.corrente = function (uso, o) {
      var alvo = alvoDe(uso, 1.5) || (uso.alvo != null && uso.alvo !== uso.quem ? { idx: uso.alvo } : null); if (!alvo) return null;
      var D = durDe(uso, o, 2.5, 8);
      return { ini: uso.t, fim: uso.t + D, chao: false,
        criar: function () { var g = s('g', {}), c1 = duplo(o.cor, { 'stroke-dasharray': '.7 .35' }), fa = duplo('#fff'), an = duplo(o.cor); poe(g, [c1, fa, an]); return { g: g, c1: c1, fa: fa, an: an }; },
        desenhar: function (e, tt, F) {
          var a = tok(F, uso.quem, tt), b = tok(F, alvo.idx, tt); if (!a || !b) { some(e, 0); return; }
          var k = tt - uso.t, bb = mix(a, b, saiDe(lim(k / 0.2))), m = mix(a, bb, 0.5), L = dist(a, bb) || 1, cv = Math.min(1.5 * F.z, L * 0.12) * Math.sin(k * 4);
          e.c1.set('M' + f2(a[0]) + ',' + f2(a[1]) + 'Q' + f2(m[0] - (bb[1] - a[1]) / L * cv) + ',' + f2(m[1] + (bb[0] - a[0]) / L * cv) + ' ' + f2(bb[0]) + ',' + f2(bb[1]), 0.32 * F.z);
          e.c1.els[1].setAttribute('stroke-dashoffset', f2(-k * 3));
          var sem = Math.floor(tt * 10), f0 = 0.2 + sorte(sem) * 0.6;
          e.fa.set(k > 0.2 ? zigue(mix(a, b, f0), mix(a, b, f0 + 0.1), 3, 0.5 * F.z, sem) : '', 0.14 * F.z, 0.9);
          e.an.set(k > 0.2 ? circ(b, (R + 0.5) * F.z) : '', 0.22 * F.z, 0.9);
          some(e, fade(tt, uso.t + D, 0.3));
        } };
    };
    // marca girando em cima de quem levou (debuff), ou de quem recebeu (buff em aliado)
    M.marca = function (uso, o) {
      var alvo = alvoDe(uso, 2) || (uso.alvo != null ? { idx: uso.alvo } : { idx: uso.quem });
      var D = durDe(uso, o, 2.5, 8);
      return { ini: uso.t, fim: uso.t + D, chao: false,
        criar: function () { var g = s('g', {}), aro = duplo(o.cor), gl = duplo(o.cor), gb = duplo('#fff'), b = estouro(o.cor); poe(g, [aro, gl, gb, b]); return { g: g, aro: aro, gl: gl, gb: gb, b: b }; },
        desenhar: function (e, tt, F) {
          var q = tok(F, alvo.idx, tt); if (!q) { some(e, 0); return; }
          var k = tt - uso.t, a = saiDe(lim(k / 0.25)), rr = (R + 0.5) * F.z;
          e.aro.set(arco(q, rr, k * 3, k * 3 + 4.6), 0.24 * F.z, 1);
          var c = [q[0], q[1] - rr - 1.8 * F.z * a];
          e.gl.set(glifo(o.forma || 'raios', c, 1.4 * F.z * a, k * 1.5), 0.42 * F.z, 1); e.gb.set(glifo(o.forma || 'raios', c, 1.4 * F.z * a, k * 1.5), 0.14 * F.z, 1);
          e.b.set(q, k / 0.5, F.z, false);
          some(e, fade(tt, uso.t + D, 0.3));
        } };
    };
    // aura em volta do herói (ou do aliado que recebeu): anel girando, escudo hexagonal com escudo
    M.aura = function (uso, o) {
      var quem = uso.alvo != null && !inimigos(uso.quem, uso.alvo) ? uso.alvo : uso.quem;
      var D = durDe(uso, o, 2.5, 10);
      return { ini: uso.t, fim: uso.t + D, chao: false,
        criar: function () { var g = s('g', {}), fundo = s('path', { fill: o.cor, 'fill-opacity': 0.14, stroke: 'none' }), a1 = duplo(o.cor), a2 = duplo('#fff'); poe(g, [fundo, a1, a2]); return { g: g, fundo: fundo, a1: a1, a2: a2 }; },
        desenhar: function (e, tt, F) {
          var q = tok(F, quem, tt); if (!q) { some(e, 0); return; }
          var k = tt - uso.t, rr = Math.max((R + 0.9) * F.z, o.raio ? area(o.raio, F.z) : 0) * saiDe(lim(k / 0.25));
          if (o.forma === 'escudo') { var d = glifo('escudo', q, rr, k); at(e.fundo, { d: d }); e.a1.set(d, 0.32 * F.z); e.a2.set(arco(q, rr * 0.86, k * 2, k * 2 + 1), 0.14 * F.z, 0.9); }
          else { at(e.fundo, { d: circ(q, rr) }); e.a1.set(arco(q, rr, k * 2, k * 2 + 2.2) + arco(q, rr, k * 2 + 3.1, k * 2 + 5.3), 0.3 * F.z); e.a2.set(arco(q, rr * 0.8, -k * 3, -k * 3 + 1.4), 0.14 * F.z, 0.9); }
          some(e, fade(tt, uso.t + D, 0.4));
        } };
    };
    // lâminas girando em volta do herói
    M.giro = function (uso, o) {
      var D = durDe(uso, o, 2, 8);
      return { ini: uso.t, fim: uso.t + D, chao: false,
        criar: function () { var g = s('g', {}), ls = [0, 1, 2].map(function () { return duplo(o.cor); }), bs = [0, 1, 2].map(function () { return duplo('#fff'); }); poe(g, ls.concat(bs)); return { g: g, ls: ls, bs: bs }; },
        desenhar: function (e, tt, F) {
          var c = tok(F, uso.quem, tt); if (!c) { some(e, 0); return; }
          var k = tt - uso.t, rr = area(o.raio || 250, F.z) * 0.85 * saiDe(lim(k / 0.25)), gi = k * 11;
          for (var i = 0; i < 3; i++) { var a0 = gi + i * 2.094; e.ls[i].set(arco(c, rr, a0, a0 + 1.1), 0.5 * F.z); e.bs[i].set(arco(c, rr, a0 + 0.7, a0 + 1.1), 0.2 * F.z); }
          some(e, fade(tt, uso.t + D, 0.3));
        } };
    };
    // salto/avanço: arco do ponto de saída até a chegada e anel no pouso
    M.salto = function (uso, o) {
      var de = pos(uso.t)[uso.quem], para = pos(uso.t + 1)[uso.quem];
      if (!de || !para || dist(de, para) < 1.3) return null;
      return { ini: uso.t, fim: uso.t + 1.2, chao: false,
        criar: function () { var g = s('g', {}), arc = duplo(o.cor, { 'stroke-dasharray': '.8 .5' }), sai = duplo(o.cor), b = estouro(o.cor); poe(g, [arc, sai, b]); return { g: g, arc: arc, sai: sai, b: b }; },
        desenhar: function (e, tt, F) {
          var a = Q(de), b = Q(para), k = (tt - uso.t) / 1.2, m = mix(a, b, 0.5), alto = Math.min(4 * F.z, dist(a, b) * 0.3);
          e.arc.set('M' + f2(a[0]) + ',' + f2(a[1]) + 'Q' + f2(m[0]) + ',' + f2(m[1] - alto) + ' ' + f2(b[0]) + ',' + f2(b[1]), 0.26 * F.z, 1 - k);
          e.sai.set(circ(a, (R + k * 2) * F.z), 0.2 * F.z, 1 - k);
          e.b.set(b, (tt - uso.t - 0.35) / 0.7, F.z, false);
        } };
    };
    // invocação: n figuras que brotam em roda (totem, bicho, árvore, torre, pedra)
    M.invoca = function (uso, o) {
      var ponto = o.forma === 'bicho' || o.eu ? pos(uso.t)[uso.quem] : (K.pontaPara(uso, o.raio || 350) || pos(uso.t)[uso.quem]); if (!ponto) return null;
      var N = o.n || 3, D = o.dur || 4;
      return { ini: uso.t, fim: uso.t + D, chao: true,
        criar: function () { var g = s('g', {}), fs = []; for (var i = 0; i < N; i++) fs.push({ c: cheio(o.cor), o: s('circle', { fill: '#fff' }) }); var b = estouro(o.cor); poe(g, [b]); fs.forEach(function (f) { g.append(f.c, f.o); }); return { g: g, fs: fs, b: b }; },
        desenhar: function (e, tt, F) {
          var c = Q(ponto), k = tt - uso.t, rr = N > 1 ? (R + 1.6 + N * 0.2) * F.z : 0;
          e.b.set(c, k / 0.6, F.z, false);
          e.fs.forEach(function (f, i) {
            var a = (i / N) * Math.PI * 2 - Math.PI / 2 + (o.forma === 'bicho' ? k * 0.6 : 0), q = [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr], p = saiDe(lim((k - i * 0.05) / 0.2)), z = F.z * p * (N > 4 ? 1.4 : 2), d;
            if (o.forma === 'arvore') d = 'M' + f2(q[0]) + ',' + f2(q[1] - 1.8 * z) + 'L' + f2(q[0] + 0.9 * z) + ',' + f2(q[1]) + 'L' + f2(q[0] - 0.9 * z) + ',' + f2(q[1]) + 'Z';
            else if (o.forma === 'torre' || o.forma === 'totem') d = 'M' + f2(q[0] - 0.35 * z) + ',' + f2(q[1]) + 'L' + f2(q[0] - 0.35 * z) + ',' + f2(q[1] - 1.5 * z) + 'L' + f2(q[0]) + ',' + f2(q[1] - 2 * z) + 'L' + f2(q[0] + 0.35 * z) + ',' + f2(q[1] - 1.5 * z) + 'L' + f2(q[0] + 0.35 * z) + ',' + f2(q[1]) + 'Z';
            else if (o.forma === 'pedra') d = poli(q, [[0.8 * z, 0], [0.6 * z, 1.3], [0.9 * z, 2.4], [0.7 * z, 3.6], [0.85 * z, 4.8]], 0);
            else d = circ(q, 0.7 * z) + circ([q[0] + 0.55 * z, q[1] - 0.55 * z], 0.3 * z) + circ([q[0] - 0.55 * z, q[1] - 0.55 * z], 0.3 * z);
            f.c.setAttribute('d', d); f.c.setAttribute('stroke-width', f2(0.13 * F.z));
            at(f.o, { cx: q[0], cy: q[1] - (o.forma === 'torre' || o.forma === 'totem' ? 1.4 : 0.1) * z, r: 0.14 * z });
          });
          some(e, fade(tt, uso.t + D, 0.4));
        } };
    };
    // golpe colado no alvo: corte grande e estouro
    M.golpe = function (uso, o) {
      var alvo = alvoDe(uso, 1.5); if (!alvo) return null;
      var T = alvo.t != null ? Math.max(uso.t + 0.05, alvo.t - 0.2) : uso.t + 0.1;
      return { ini: uso.t, fim: T + 0.8, chao: false,
        criar: function () { var g = s('g', {}), c = duplo(o.cor), w = duplo('#fff'), b = estouro(o.cor); poe(g, [c, w, b]); return { g: g, c: c, w: w, b: b }; },
        desenhar: function (e, tt, F) {
          var q = tok(F, alvo.idx, tt); if (!q) { some(e, 0); return; }
          some(e, 1);
          var f = (tt - T) / 0.6; if (f < 0) { e.c.set('', 0, 0); e.w.set('', 0, 0); e.b.set(null); return; }
          var rr = (R + 1.1) * F.z, an = sorte(uso.t) * 2, sw = saiDe(lim(f * 3));
          var d = o.forma === 'cruz' ? raiosEm(q, 4, 0, rr * sw, 0.8) : arco(q, rr, an, an + 2.6 * sw);
          e.c.set(d, 0.6 * F.z, 1 - f); e.w.set(d, 0.2 * F.z, 1 - f);
          e.b.set(q, f, F.z, true);
        } };
    };
    // chuva: coisas caindo do céu em pontos sorteados da área
    M.chuva = function (uso, o) {
      var ponto = pontoDe(uso, Math.max(600, (o.raio || 400) * 1.5)); if (!ponto) return null;
      var D = durDe(uso, o, 2.5, 10), N = o.n || 6;
      return { ini: uso.t, fim: uso.t + D, chao: true,
        criar: function () { var g = s('g', {}), fundo = s('path', { fill: o.cor, 'fill-opacity': 0.12, stroke: 'none' }), borda = duplo(o.cor, { 'stroke-dasharray': '.8 .5' }), xs = []; for (var i = 0; i < N; i++) xs.push({ q: duplo('#fff'), c: cheio(o.cor), x: duplo(o.cor) }); g.append(fundo); poe(g, [borda]); xs.forEach(function (x) { poe(g, [x.q, x.c, x.x]); }); return { g: g, fundo: fundo, borda: borda, xs: xs }; },
        desenhar: function (e, tt, F) {
          var c = Q(ponto), rr = area(o.raio || 400, F.z) * saiDe(lim((tt - uso.t) / 0.25));
          at(e.fundo, { d: circ(c, rr) }); e.borda.set(circ(c, rr), 0.16 * F.z, 0.9);
          e.xs.forEach(function (x, i) {
            var kk = tt * 2 + i / N, n = Math.floor(kk), f = kk - n, an = sorte(n * 31 + i * 7) * 6.283, d = Math.sqrt(sorte(n * 17 + i * 3)) * rr * 0.85, p = [c[0] + Math.cos(an) * d, c[1] + Math.sin(an) * d];
            if (f < 0.35) { var alto = (1 - f / 0.35) * 5 * F.z, q = [p[0] + alto * 0.3, p[1] - alto]; x.q.set(seg([q[0] + 0.5 * F.z, q[1] - 1.2 * F.z], q), 0.16 * F.z, 1); x.c.setAttribute('d', cabeca(o.forma || 'bola', q, Math.PI * 0.6, F.z * 0.8, tt * 6)); x.c.setAttribute('stroke-width', f2(0.1 * F.z)); x.x.set('', 0, 0); }
            else { var g2 = (f - 0.35) / 0.65; x.q.set('', 0, 0); x.c.setAttribute('d', ''); x.x.set(circ(p, (0.3 + g2 * 1.1) * F.z) , 0.2 * F.z, 1 - g2); }
          });
          some(e, fade(tt, uso.t + D, 0.4));
        } };
    };
    // vórtice que puxa: espiral girando
    M.vortice = function (uso, o) {
      var ponto = o.eu ? null : pontoDe(uso, Math.max(500, (o.raio || 400) * 1.5));
      var D = durDe(uso, o, 2, 8);
      return { ini: uso.t, fim: uso.t + D, chao: true,
        criar: function () { var g = s('g', {}), fundo = s('path', { fill: o.cor, 'fill-opacity': 0.2, stroke: 'none' }), braços = [0, 1, 2].map(function () { return duplo(o.cor); }), borda = duplo('#fff'); g.append(fundo); poe(g, braços.concat([borda])); return { g: g, fundo: fundo, bracos: braços, borda: borda }; },
        desenhar: function (e, tt, F) {
          var c = ponto ? Q(ponto) : tok(F, uso.quem, tt); if (!c) { some(e, 0); return; }
          var k = tt - uso.t, rr = area(o.raio || 400, F.z) * saiDe(lim(k / 0.3));
          at(e.fundo, { d: circ(c, rr) }); e.borda.set(circ(c, rr), 0.14 * F.z, 0.8);
          e.bracos.forEach(function (b, i) { b.set(glifo('espiral', c, rr, -k * 4 + i * 2.094), 0.3 * F.z, 1); });
          some(e, fade(tt, uso.t + D, 0.4));
        } };
    };
    // cúpula/arena: círculo fechado com marcas na borda
    M.cupula = function (uso, o) {
      var ponto = pontoDe(uso, Math.max(500, (o.raio || 500) * 1.2)); if (!ponto) return null;
      var D = durDe(uso, o, 3, 8);
      return { ini: uso.t, fim: uso.t + D, chao: true,
        criar: function () { var g = s('g', {}), fundo = s('path', { fill: o.cor, 'fill-opacity': 0.2, stroke: 'none' }), borda = duplo(o.cor), marcas = duplo('#fff'), gl = duplo(o.cor); g.append(fundo); poe(g, [borda, marcas, gl]); return { g: g, fundo: fundo, borda: borda, marcas: marcas, gl: gl }; },
        desenhar: function (e, tt, F) {
          var c = Q(ponto), k = tt - uso.t, ab = k < 0.22 ? saiDe(k / 0.22) * 1.06 : 1 + 0.06 * (1 - lim((k - 0.22) / 0.2)), rr = area(o.raio || 500, F.z) * ab;
          at(e.fundo, { d: circ(c, rr) }); e.borda.set(circ(c, rr), 0.45 * F.z);
          e.marcas.set(raiosEm(c, 16, rr * 0.88, rr * 0.98, k * 0.3), 0.14 * F.z, 0.9);
          e.gl.set(o.forma ? glifo(o.forma, c, rr * 0.35, k) : '', 0.3 * F.z, 0.7);
          some(e, fade(tt, uso.t + D, 0.4));
        } };
    };

    var out = {}, fichas = window.SKILL_FICHAS || {};
    Object.keys(fichas).forEach(function (chave) {
      var o = ler(fichas[chave]); if (!M[o.molde]) return;
      o.eu = /\beu\b/.test(fichas[chave]);
      out[chave] = function (uso) { try { return M[o.molde](uso, o); } catch (err) { return null; } };
    });
    return out;
  };

  (window.SKILL_LOTES = window.SKILL_LOTES || []).push({ numero: 0, soNovas: true, fazer: fazer, ler: ler, CORES: CORES });
})();
