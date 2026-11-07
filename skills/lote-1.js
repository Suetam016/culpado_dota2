// Esteira de animações das skills, lote 1: ults e skills marcantes dos heróis que mais aparecem nas partidas do grupo
// e que ainda caíam no desenho genérico (ver skills/fila.json e skills/LEIA.md).
//
// Mesmo contrato do objeto ASSIN do index.html (montarLances): cada skill é uma função (uso) => assinatura, com
// { ini, fim, chao, criar() -> { g, ... }, desenhar(e, tt, F) }, ou null quando não dá para desenhar. Assim o mesmo
// desenho vale no replay do site e no Plantão, que reaproveita o ASSIN. O lote não enxerga as variáveis de
// montarLances: recebe tudo em K (ver ferramentasDoLote no index.html e o simulador em skills/catalogo.html).
//
// Estilo: traço nítido com contorno escuro por baixo (lê em cima do mapa), cor chapada, nada de borrão nem partícula
// esfumaçada. Tamanhos em unidades do viewBox vezes F.z, como o resto do replay.
(function () {
  'use strict';
  var lote = function (K) {
    var s = K.s, at = K.at, Q = K.Q, pos = K.pos, mix = K.mix, lim = K.lim, saiDe = K.saiDe, sorte = K.sorte, dist = K.dist;
    var R = K.R, UNID = K.UNID, area = K.area;
    var ESCURO = '#07070c';

    // traço duplo: contorno escuro + cor por cima
    var duplo = function (cor, extra) {
      var base = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      var a = s('path', Object.assign({}, base, { stroke: ESCURO, 'stroke-opacity': 0.55 }, extra || {}));
      var b = s('path', Object.assign({}, base, { stroke: cor }, extra || {}));
      return { els: [a, b], set: function (d, w, op) { op = op == null ? 1 : op; at(a, { d: d, 'stroke-width': w * 2.1, opacity: op }); at(b, { d: d, 'stroke-width': w, opacity: op }); } };
    };
    var seg = function (p, q) { return 'M' + p[0].toFixed(2) + ',' + p[1].toFixed(2) + 'L' + q[0].toFixed(2) + ',' + q[1].toFixed(2); };
    var circ = function (c, r) { return 'M' + (c[0] - r).toFixed(2) + ',' + c[1].toFixed(2) + 'a' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 1 0 ' + (2 * r).toFixed(2) + ',0a' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 1 0 ' + (-2 * r).toFixed(2) + ',0'; };
    var arco = function (c, r, a0, a1) {
      var p0 = [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r], p1 = [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r];
      return 'M' + p0[0].toFixed(2) + ',' + p0[1].toFixed(2) + 'A' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 ' + (Math.abs(a1 - a0) > Math.PI ? 1 : 0) + ' 1 ' + p1[0].toFixed(2) + ',' + p1[1].toFixed(2);
    };
    var raiosEm = function (c, n, r0, r1, giro) {
      var d = '';
      for (var i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2 + (giro || 0); d += seg([c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0], [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1]); }
      return d;
    };
    var zigue = function (p, q, n, amp, semente) {
      var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, d = 'M' + p[0].toFixed(2) + ',' + p[1].toFixed(2);
      for (var i = 1; i < n; i++) { var k = i / n, o = (sorte(semente + i * 7.3) - 0.5) * 2 * amp; d += 'L' + (p[0] + dx * k + nx * o).toFixed(2) + ',' + (p[1] + dy * k + ny * o).toFixed(2); }
      return d + 'L' + q[0].toFixed(2) + ',' + q[1].toFixed(2);
    };
    // estouro de impacto: anel que abre + raios curtos, em k de 0 a 1
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
    // dano dessa skill, de quem usou, em ordem (todos os ticks, não só o primeiro de cada alvo)
    var golpesDe = function (uso, janela, chave) {
      chave = chave || uso.hab[0];
      return K.DANO.filter(function (d) { return d.quem === uso.quem && d.hab && d.hab[0] === chave && d.t >= uso.t - 0.1 && d.t <= uso.t + janela && d.alvo !== uso.quem; }).sort(function (a, b) { return a.t - b.t; });
    };
    var alvoDe = function (uso, janela) {
      var h = K.acertosDe(uso, janela)[0];
      if (h) return { idx: h.alvo, t: h.t };
      if (uso.alvo != null && uso.alvo !== uso.quem) return { idx: uso.alvo, t: null };
      return null;
    };
    var tokOu = function (F, idx, tt) { return F.tok(idx) || Q(pos(tt)[idx]); };
    var some = function (e, op) { e.g.setAttribute('opacity', op.toFixed(2)); };

    return {
      // ---------------------------------------------------------------------------------------------------------
      // Juggernaut: Blade Fury. Três lâminas girando em volta dele enquanto o dano sai, e um corte em quem apanha.
      juggernaut_blade_fury: function (uso) {
        var fimTick = K.ticksDe(uso, uso.hab[0], uso.t + 6, 1.6);
        var fim = Math.min(uso.t + 5.2, Math.max(uso.t + 2.5, (fimTick == null ? uso.t + 5 : fimTick + 0.8)));
        var golpes = golpesDe(uso, 6);
        return {
          ini: uso.t, fim: fim, chao: false,
          criar: function () {
            var g = s('g', {}); var disco = s('path', { fill: 'rgba(255,170,60,.13)', stroke: 'none' });
            var borda = duplo('#ffcf7a', { 'stroke-dasharray': '1 .8' });
            var laminas = [0, 1, 2].map(function () { return duplo('#fff3d6'); });
            var cores = [0, 1, 2].map(function () { return duplo('#ff9a2e'); });
            var cortes = [0, 1, 2, 3].map(function () { return duplo('#fff'); });
            g.append(disco); borda.els.forEach(function (x) { g.append(x); });
            cores.forEach(function (l) { l.els.forEach(function (x) { g.append(x); }); });
            laminas.forEach(function (l) { l.els.forEach(function (x) { g.append(x); }); });
            cortes.forEach(function (l) { l.els.forEach(function (x) { g.append(x); }); });
            return { g: g, disco: disco, borda: borda, laminas: laminas, cores: cores, cortes: cortes };
          },
          desenhar: function (e, tt, F) {
            var c = tokOu(F, uso.quem, tt); if (!c) { some(e, 0); return; }
            var k = tt - uso.t, abre = saiDe(lim(k / 0.25)), rr = area(250, F.z) * abre, giro = k * 13;
            at(e.disco, { d: circ(c, rr) });
            e.borda.set(circ(c, rr), 0.18 * F.z, 0.8);
            for (var i = 0; i < 3; i++) {
              var a0 = giro + (i * Math.PI * 2) / 3;
              e.cores[i].set(arco(c, rr * 0.86, a0, a0 + 1.25), 0.55 * F.z);
              e.laminas[i].set(arco(c, rr * 0.86, a0 + 0.75, a0 + 1.25), 0.3 * F.z);
            }
            // quem levou o tick agora ganha um corte em X que pisca
            var n = 0;
            golpes.forEach(function (d) {
              if (n >= 4 || tt < d.t || tt > d.t + 0.35) return;
              var q = F.tok(d.alvo); if (!q) return;
              var f = (tt - d.t) / 0.35, L = (R + 0.6) * F.z * saiDe(lim(f * 2.5)), an = sorte(d.t * 3 + d.alvo) * Math.PI;
              var p1 = [q[0] - Math.cos(an) * L, q[1] - Math.sin(an) * L], p2 = [q[0] + Math.cos(an) * L, q[1] + Math.sin(an) * L];
              e.cortes[n++].set(seg(p1, p2), 0.3 * F.z, 1 - f);
            });
            for (; n < 4; n++) e.cortes[n].set('', 0, 0);
            some(e, tt > fim - 0.35 ? lim((fim - tt) / 0.35) : 1);
          },
        };
      },

      // Juggernaut: Omnislash. Ele some e aparece em volta de cada vítima, deixando cortes em X e um rastro em zigue-zague.
      juggernaut_omni_slash: function (uso) {
        var golpes = golpesDe(uso, 7);
        if (!golpes.length && uso.alvo == null) return null;
        // cada tick de 1 s do dado vira 3 cortes (o Omnislash dá vários golpes por segundo)
        var cortes = [];
        var base = golpes.length ? golpes : [{ t: uso.t + 0.2, alvo: uso.alvo }];
        base.forEach(function (d) { for (var j = 0; j < 3; j++) cortes.push({ t: Math.max(uso.t + 0.1, d.t - 0.66 + j * 0.33), alvo: d.alvo, seed: d.t * 5 + j + d.alvo * 13 }); });
        cortes.sort(function (a, b) { return a.t - b.t; });
        var fim = cortes[cortes.length - 1].t + 0.8;
        var N = 5;
        return {
          ini: uso.t, fim: fim, chao: false,
          criar: function () {
            var g = s('g', {});
            var rastro = duplo('#ffd27a', { 'stroke-dasharray': '.9 .5' });
            var fantasma = duplo('#ffe9b8');
            var xs = []; for (var i = 0; i < N; i++) xs.push({ a: duplo('#fff'), b: duplo('#ff8a1f') });
            rastro.els.forEach(function (x) { g.append(x); }); fantasma.els.forEach(function (x) { g.append(x); });
            xs.forEach(function (x) { x.b.els.concat(x.a.els).forEach(function (y) { g.append(y); }); });
            return { g: g, rastro: rastro, fantasma: fantasma, xs: xs };
          },
          desenhar: function (e, tt, F) {
            var vis = cortes.filter(function (c) { return tt >= c.t && tt <= c.t + 0.7; }).slice(-N);
            var ponto = function (c) { var q = F.tok(c.alvo) || Q(pos(c.t)[c.alvo]); if (!q) return null; var an = sorte(c.seed) * Math.PI * 2, d = (R + 1.2) * F.z; return [q[0] + Math.cos(an) * d, q[1] + Math.sin(an) * d]; };
            // rastro: liga os pontos de onde ele golpeou, do mais velho ao mais novo
            var pts = vis.map(ponto).filter(Boolean);
            e.rastro.set(pts.length > 1 ? 'M' + pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join('L') : '', 0.2 * F.z, 0.85);
            var ult = pts[pts.length - 1];
            e.fantasma.set(ult ? circ(ult, R * 0.55 * F.z) : '', 0.28 * F.z, 0.9);
            for (var i = 0; i < N; i++) {
              var c = vis[i], x = e.xs[i];
              if (!c) { x.a.set('', 0, 0); x.b.set('', 0, 0); continue; }
              var q = F.tok(c.alvo) || Q(pos(c.t)[c.alvo]); if (!q) { x.a.set('', 0, 0); x.b.set('', 0, 0); continue; }
              var f = (tt - c.t) / 0.7, L = (R + 0.9) * F.z * saiDe(lim(f * 4)), an = sorte(c.seed + 1) * Math.PI;
              var d1 = seg([q[0] - Math.cos(an) * L, q[1] - Math.sin(an) * L], [q[0] + Math.cos(an) * L, q[1] + Math.sin(an) * L]);
              var an2 = an + 1.2;
              var d2 = seg([q[0] - Math.cos(an2) * L * 0.8, q[1] - Math.sin(an2) * L * 0.8], [q[0] + Math.cos(an2) * L * 0.8, q[1] + Math.sin(an2) * L * 0.8]);
              x.b.set(d1 + d2, 0.5 * F.z, 1 - f); x.a.set(d1 + d2, 0.2 * F.z, 1 - f);
            }
            some(e, tt > fim - 0.3 ? lim((fim - tt) / 0.3) : 1);
          },
        };
      },

      // ---------------------------------------------------------------------------------------------------------
      // Faceless Void: Chronosphere (versão 2). Cúpula que estoura, mostrador de relógio com dois ponteiros e cada preso
      // dentro de um cristal hexagonal. Substitui a do index.html.
      faceless_void_chronosphere: function (uso) {
        var tt0 = uso.t + 0.5, ps0 = pos(tt0), v0 = ps0[uso.quem];
        if (!v0) return null;
        var perto = K.todos.filter(function (p) { return inimigos(p.idx, uso.quem) && ps0[p.idx] && !K.morto(p.idx, tt0) && dist(ps0[p.idx], v0) <= 700 / 128; });
        var pts = [v0].concat(perto.map(function (p) { return ps0[p.idx]; }));
        var centro = [pts.reduce(function (a, q) { return a + q[0]; }, 0) / pts.length, pts.reduce(function (a, q) { return a + q[1]; }, 0) / pts.length];
        var presos = K.todos.filter(function (p) { return p.idx !== uso.quem && ps0[p.idx] && dist(ps0[p.idx], centro) <= 500 / 128; }).map(function (p) { return p.idx; });
        var DURA = 4.2, c = Q(centro);
        return {
          ini: uso.t, fim: uso.t + DURA, chao: true,
          criar: function () {
            var g = s('g', {});
            var domo = s('path', { fill: 'rgba(78,52,190,.34)', stroke: 'none' });
            var anel = duplo('#cdbcff'), anel2 = duplo('#8f78ff', { 'stroke-dasharray': '.5 .9' });
            var marcas = duplo('#efe8ff'), grandes = duplo('#ffffff');
            var hora = duplo('#ffffff'), minuto = duplo('#e7dcff');
            var cristais = presos.map(function () { return duplo('#bfe9ff'); });
            var trinca = duplo('#ffffff');
            g.append(domo);
            [anel, anel2, marcas, grandes, minuto, hora, trinca].concat(cristais).forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, domo: domo, anel: anel, anel2: anel2, marcas: marcas, grandes: grandes, hora: hora, minuto: minuto, cristais: cristais, trinca: trinca };
          },
          desenhar: function (e, tt, F) {
            var RR = area(500, F.z), k = tt - uso.t;
            var abre = k < 0.22 ? saiDe(k / 0.22) * 1.08 : 1 + 0.08 * (1 - lim((k - 0.22) / 0.2)); // estoura um pouco além e assenta
            var r = RR * abre;
            at(e.domo, { d: circ(c, r) });
            e.anel.set(circ(c, r), 0.45 * F.z); e.anel2.set(circ(c, r * 0.9), 0.16 * F.z, 0.9);
            e.marcas.set(raiosEm(c, 12, r * 0.78, r * 0.86, 0), 0.16 * F.z, 0.9);
            e.grandes.set(raiosEm(c, 4, r * 0.72, r * 0.86, 0), 0.3 * F.z);
            var aM = (k / DURA) * Math.PI * 4 - Math.PI / 2, aH = (k / DURA) * Math.PI * 0.6 - Math.PI / 2;
            e.minuto.set(seg(c, [c[0] + Math.cos(aM) * r * 0.66, c[1] + Math.sin(aM) * r * 0.66]), 0.22 * F.z);
            e.hora.set(seg(c, [c[0] + Math.cos(aH) * r * 0.42, c[1] + Math.sin(aH) * r * 0.42]), 0.38 * F.z);
            presos.forEach(function (idx, i) {
              var q = F.tok(idx);
              if (!q || k < 0.2) { e.cristais[i].set('', 0, 0); return; }
              var rc = (R + 0.55) * F.z * saiDe(lim((k - 0.2) / 0.2)), d = '';
              for (var j = 0; j < 6; j++) { var a = (j / 6) * Math.PI * 2 + Math.PI / 6; d += (j ? 'L' : 'M') + (q[0] + Math.cos(a) * rc).toFixed(2) + ',' + (q[1] + Math.sin(a) * rc).toFixed(2); }
              e.cristais[i].set(d + 'Z', 0.28 * F.z, 0.95);
            });
            // no fim o tempo volta: trincas no vidro e some
            var kf = lim((k - (DURA - 0.5)) / 0.5);
            e.trinca.set(kf > 0 ? zigue(c, [c[0] + r * 0.9, c[1] - r * 0.3], 5, r * 0.08, 3) + zigue(c, [c[0] - r * 0.5, c[1] + r * 0.8], 5, r * 0.08, 9) + zigue(c, [c[0] - r * 0.7, c[1] - r * 0.6], 4, r * 0.08, 17) : '', 0.16 * F.z, kf);
            some(e, 1 - kf * kf);
          },
        };
      },

      // Faceless Void: Time Walk. Imagens dele pelo caminho e um arco de relógio que volta onde ele saiu.
      faceless_void_time_walk: function (uso) {
        var de = pos(uso.t)[uso.quem], para = pos(uso.t + 1)[uso.quem];
        if (!de || !para || dist(de, para) < 1.5) return null;
        var DURA = 1.1;
        return {
          ini: uso.t, fim: uso.t + DURA, chao: false,
          criar: function () {
            var g = s('g', {}); var risco = duplo('#b79cff'), volta = duplo('#ffffff'), seta = duplo('#e2d6ff');
            var ecos = [0, 1, 2, 3].map(function () { return duplo('#cbb8ff'); });
            [risco, volta, seta].concat(ecos).forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, risco: risco, volta: volta, seta: seta, ecos: ecos };
          },
          desenhar: function (e, tt, F) {
            var k = (tt - uso.t) / DURA, a = Q(de), b = Q(para), anda = saiDe(lim(k / 0.45)), agora = mix(a, b, anda);
            e.risco.set(seg(a, agora), 0.22 * F.z, 1 - k);
            e.ecos.forEach(function (x, i) { var f = (i + 1) / 5; if (anda < f) { x.set('', 0, 0); return; } x.set(circ(mix(a, b, f), R * 0.8 * F.z), 0.2 * F.z, (1 - k) * (0.4 + f * 0.5)); });
            var rr = (R + 1.2) * F.z, giro = -k * Math.PI * 3;
            e.volta.set(arco(a, rr, giro, giro + 4.4), 0.26 * F.z, 1 - k);
            var pa = [a[0] + Math.cos(giro) * rr, a[1] + Math.sin(giro) * rr], tg = giro - Math.PI / 2, L = 0.8 * F.z;
            e.seta.set(seg(pa, [pa[0] + Math.cos(tg + 0.6) * L, pa[1] + Math.sin(tg + 0.6) * L]) + seg(pa, [pa[0] + Math.cos(tg - 0.6) * L, pa[1] + Math.sin(tg - 0.6) * L]), 0.24 * F.z, 1 - k);
          },
        };
      },

      // ---------------------------------------------------------------------------------------------------------
      // Lion: Earth Spike. Fileira de espinhos de pedra que brota do chão do Lion até depois do alvo.
      lion_impale: function (uso) {
        var hits = K.acertosDe(uso, 1.5);
        var de = pos(uso.t)[uso.quem]; if (!de) return null;
        var longe = hits.reduce(function (m, d) { var q = pos(d.t)[d.alvo]; return q && (!m || dist(q, de) > dist(m, de)) ? q : m; }, null);
        var ponta = longe ? [de[0] + (longe[0] - de[0]) * (1 + 1.6 / Math.max(1, dist(longe, de))), de[1] + (longe[1] - de[1]) * (1 + 1.6 / Math.max(1, dist(longe, de)))] : K.pontaPara(uso, 900);
        if (!ponta) return null;
        var N = 9, PASSO = 0.055, VIDA = 0.75;
        return {
          ini: uso.t, fim: uso.t + N * PASSO + VIDA, chao: true,
          criar: function () {
            var g = s('g', {}); var fenda = duplo('#3a2a16');
            var esp = []; for (var i = 0; i < N; i++) esp.push(s('path', { fill: '#d8b47a', stroke: ESCURO, 'stroke-linejoin': 'round' }));
            fenda.els.forEach(function (y) { g.append(y); }); esp.forEach(function (x) { g.append(x); });
            return { g: g, fenda: fenda, esp: esp };
          },
          desenhar: function (e, tt, F) {
            var a = Q(de), b = Q(ponta), k = tt - uso.t, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
            var nx = -dy / L, ny = dx / L;
            e.fenda.set(seg(a, mix(a, b, lim(k / (N * PASSO)))), 0.14 * F.z, 1 - lim((k - N * PASSO) / VIDA));
            e.esp.forEach(function (p, i) {
              var f = (k - i * PASSO) / VIDA;
              if (f < 0 || f > 1) { p.setAttribute('d', ''); return; }
              var cresce = f < 0.25 ? saiDe(f / 0.25) * 1.15 : f < 0.4 ? 1.15 - 0.15 * ((f - 0.25) / 0.15) : 1 - Math.pow((f - 0.4) / 0.6, 2);
              var lado = (i % 2 ? 1 : -1) * 0.35 * F.z, base = mix(a, b, (i + 0.8) / (N + 0.4));
              var q = [base[0] + nx * lado, base[1] + ny * lado];
              var h = (2.1 + sorte(i * 3.1) * 1.1) * F.z * cresce, w = 0.7 * F.z;
              var inc = (sorte(i * 5.7) - 0.5) * 0.5 * F.z;
              p.setAttribute('d', 'M' + (q[0] - w).toFixed(2) + ',' + q[1].toFixed(2) + 'L' + (q[0] + inc).toFixed(2) + ',' + (q[1] - h).toFixed(2) + 'L' + (q[0] + w).toFixed(2) + ',' + q[1].toFixed(2) + 'Z');
              p.setAttribute('stroke-width', (0.16 * F.z).toFixed(3));
            });
          },
        };
      },

      // Lion: Finger of Death. Raio vermelho em zigue-zague do Lion até o alvo, com estouro no alvo.
      lion_finger_of_death: function (uso) {
        var alvo = alvoDe(uso, 1.5); if (!alvo) return null;
        var ATRASO = 0.25, FEIXE = 0.55;
        return {
          ini: uso.t, fim: uso.t + ATRASO + FEIXE + 0.5, chao: false,
          criar: function () {
            var g = s('g', {}); var mao = duplo('#ff6a4a'), fora = duplo('#ff3b2f'), meio = duplo('#ffe2d6'), boom = estouro('#ff4a3a');
            [mao, fora, meio, boom].forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, mao: mao, fora: fora, meio: meio, boom: boom };
          },
          desenhar: function (e, tt, F) {
            var a = tokOu(F, uso.quem, tt), b = tokOu(F, alvo.idx, tt); if (!a || !b) { some(e, 0); return; }
            some(e, 1);
            var k = tt - uso.t;
            // carregando: anel que fecha na mão do Lion
            e.mao.set(k < ATRASO ? circ(a, (R + 1.6 * (1 - k / ATRASO)) * F.z) : '', 0.22 * F.z, 0.9);
            var f = (k - ATRASO) / FEIXE;
            if (f >= 0 && f <= 1) {
              var d = zigue(a, b, 9, 0.9 * F.z, Math.floor(tt * 18));
              e.fora.set(d, 0.75 * F.z * (1 - f * 0.6), 1); e.meio.set(d, 0.26 * F.z, 1);
            } else { e.fora.set('', 0, 0); e.meio.set('', 0, 0); }
            e.boom.set(b, (k - ATRASO - 0.08) / 0.7, F.z, true);
          },
        };
      },

      // ---------------------------------------------------------------------------------------------------------
      // Shadow Shaman: Shackles. Duas correntes elétricas verdes do Shaman até o preso, faiscando enquanto dura.
      shadow_shaman_shackles: function (uso) {
        var alvo = alvoDe(uso, 1); if (!alvo) return null;
        var fimTick = K.ticksDe(uso, uso.hab[0], uso.t + 4, 1.2);
        var fim = Math.max(uso.t + 1.5, Math.min(uso.t + 3.2, fimTick == null ? uso.t + 2.8 : fimTick + 0.5));
        return {
          ini: uso.t, fim: fim, chao: false,
          criar: function () {
            var g = s('g', {}); var c1 = duplo('#d9ff5a', { 'stroke-dasharray': '.7 .35' }), c2 = duplo('#a6f03c', { 'stroke-dasharray': '.7 .35' }), faisca = duplo('#ffffff'), anel = duplo('#d9ff5a');
            [c1, c2, faisca, anel].forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, c1: c1, c2: c2, faisca: faisca, anel: anel };
          },
          desenhar: function (e, tt, F) {
            var a = tokOu(F, uso.quem, tt), b = tokOu(F, alvo.idx, tt); if (!a || !b) { some(e, 0); return; }
            var k = tt - uso.t, chega = saiDe(lim(k / 0.2)), bb = mix(a, b, chega);
            var dx = bb[0] - a[0], dy = bb[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, cv = Math.min(2.4 * F.z, L * 0.18);
            var m = mix(a, bb, 0.5);
            var curva = function (sg) { return 'M' + a[0].toFixed(2) + ',' + a[1].toFixed(2) + 'Q' + (m[0] + nx * cv * sg).toFixed(2) + ',' + (m[1] + ny * cv * sg).toFixed(2) + ' ' + bb[0].toFixed(2) + ',' + bb[1].toFixed(2); };
            e.c1.set(curva(1), 0.32 * F.z); e.c2.set(curva(-1), 0.32 * F.z);
            e.c1.els[1].setAttribute('stroke-dashoffset', (-k * 3).toFixed(2)); e.c2.els[1].setAttribute('stroke-dashoffset', (k * 3).toFixed(2));
            var semente = Math.floor(tt * 12), f0 = 0.2 + sorte(semente) * 0.6;
            e.faisca.set(chega >= 1 ? zigue(mix(a, b, f0), mix(a, b, f0 + 0.12), 4, 0.7 * F.z, semente) : '', 0.16 * F.z, 0.95);
            e.anel.set(chega >= 1 ? circ(b, (R + 0.5 + 0.15 * Math.sin(k * 20)) * F.z) : '', 0.24 * F.z, 0.9);
            some(e, tt > fim - 0.3 ? lim((fim - tt) / 0.3) : 1);
          },
        };
      },

      // Shadow Shaman: Mass Serpent Ward. Dez totens de serpente em roda; os mais perto cospem no inimigo do lado.
      shadow_shaman_mass_serpent_ward: function (uso) {
        var ponto = K.pontaPara(uso, 550) || pos(uso.t)[uso.quem]; if (!ponto) return null;
        var DURA = 7, N = 10;
        var maisPerto = function (tt) {
          var ps = pos(tt), m = null, dm = 650 / 128;
          K.todos.forEach(function (p) { if (!inimigos(p.idx, uso.quem) || !ps[p.idx] || K.morto(p.idx, tt)) return; var d = dist(ps[p.idx], ponto); if (d < dm) { dm = d; m = p.idx; } });
          return m;
        };
        return {
          ini: uso.t, fim: uso.t + DURA, chao: true,
          criar: function () {
            var g = s('g', {}); var roda = duplo('#7fc94a', { 'stroke-dasharray': '.4 .6' });
            var totens = []; for (var i = 0; i < N; i++) totens.push({ haste: duplo('#5a3a1e'), cab: s('path', { fill: '#8fd14f', stroke: ESCURO, 'stroke-linejoin': 'round' }), olho: s('circle', { fill: '#ffef5a' }) });
            var cuspes = [0, 1, 2].map(function () { return duplo('#c9ff6a'); });
            roda.els.forEach(function (y) { g.append(y); });
            totens.forEach(function (t) { t.haste.els.forEach(function (y) { g.append(y); }); g.append(t.cab, t.olho); });
            cuspes.forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, roda: roda, totens: totens, cuspes: cuspes };
          },
          desenhar: function (e, tt, F) {
            var c = Q(ponto), k = tt - uso.t, rr = Math.max(area(150, F.z), (R + 1.4) * F.z);
            e.roda.set(circ(c, rr * saiDe(lim(k / 0.3))), 0.14 * F.z, 0.8);
            var lugares = [];
            e.totens.forEach(function (t, i) {
              var a = (i / N) * Math.PI * 2 - Math.PI / 2, q = [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr];
              var f = saiDe(lim((k - i * 0.04) / 0.18)), h = 2 * F.z * f, w = 0.6 * F.z * f;
              var bal = Math.sin(k * 6 + i) * 0.12 * F.z;
              t.haste.set(seg(q, [q[0] + bal, q[1] - h]), 0.2 * F.z, f ? 1 : 0);
              var top = [q[0] + bal, q[1] - h];
              t.cab.setAttribute('d', 'M' + (top[0] - w).toFixed(2) + ',' + (top[1] + w * 0.3).toFixed(2) + 'L' + top[0].toFixed(2) + ',' + (top[1] - w * 1.3).toFixed(2) + 'L' + (top[0] + w).toFixed(2) + ',' + (top[1] + w * 0.3).toFixed(2) + 'Z');
              t.cab.setAttribute('stroke-width', (0.12 * F.z).toFixed(3));
              at(t.olho, { cx: top[0], cy: top[1] - w * 0.25, r: 0.12 * F.z * f });
              lugares.push(top);
            });
            var alvo = k > 0.5 ? maisPerto(tt) : null, q = alvo != null ? F.tok(alvo) : null;
            e.cuspes.forEach(function (x, j) {
              var bat = Math.floor(tt * 3 + j * 0.33), fb = tt * 3 + j * 0.33 - bat;
              if (!q || fb > 0.6) { x.set('', 0, 0); return; }
              var de = lugares[Math.floor(sorte(bat * 7 + j) * N)], p = mix(de, q, fb / 0.6), p0 = mix(de, q, Math.max(0, fb / 0.6 - 0.18));
              x.set(seg(p0, p), 0.22 * F.z, 1);
            });
            some(e, tt > uso.t + DURA - 0.4 ? lim((uso.t + DURA - tt) / 0.4) : 1);
          },
        };
      },

      // ---------------------------------------------------------------------------------------------------------
      // Spirit Breaker: Charge of Darkness. Mira roxa no alvo, rastro por onde ele correu e a pancada na chegada.
      spirit_breaker_charge_of_darkness: function (uso) {
        if (uso.alvo == null || uso.alvo === uso.quem) return null;
        var chegou = null;
        for (var tt = uso.t + 0.5; tt <= uso.t + 9; tt += 0.25) { var ps = pos(tt), a = ps[uso.quem], b = ps[uso.alvo]; if (a && b && dist(a, b) < 1.6) { chegou = tt; break; } }
        if (chegou == null) { var bash = K.DANO.find(function (d) { return d.quem === uso.quem && d.alvo === uso.alvo && d.t > uso.t + 0.5 && d.t < uso.t + 9; }); chegou = bash ? bash.t : null; }
        var fim = chegou == null ? uso.t + 3 : chegou + 0.7;
        return {
          ini: uso.t, fim: fim, chao: false,
          criar: function () {
            var g = s('g', {}); var rastro = duplo('#a98bff', { 'stroke-dasharray': '1 .6' }), chifre = duplo('#e2d6ff'), mira = duplo('#b99cff'), boom = estouro('#9f7bff');
            [rastro, chifre, mira, boom].forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, rastro: rastro, chifre: chifre, mira: mira, boom: boom };
          },
          desenhar: function (e, tt, F) {
            var a = tokOu(F, uso.quem, tt), b = tokOu(F, uso.alvo, tt); if (!a || !b) { some(e, 0); return; }
            some(e, 1);
            var correndo = chegou == null || tt < chegou;
            e.rastro.set(K.trilhaDe(uso.quem, Math.max(uso.t, tt - 2.5), tt), 0.3 * F.z, correndo ? 0.9 : lim(1 - (tt - chegou) / 0.5));
            if (correndo) {
              var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, d = '';
              for (var i = 0; i < 2; i++) { var o = (R + 0.7 + i * 0.9 + ((tt * 2.5) % 0.9)) * F.z, p = [a[0] + ux * o, a[1] + uy * o], w = 0.8 * F.z; d += 'M' + (p[0] - ux * w - uy * w).toFixed(2) + ',' + (p[1] - uy * w + ux * w).toFixed(2) + 'L' + p[0].toFixed(2) + ',' + p[1].toFixed(2) + 'L' + (p[0] - ux * w + uy * w).toFixed(2) + ',' + (p[1] - uy * w - ux * w).toFixed(2); }
              e.chifre.set(d, 0.28 * F.z, 1);
              var rr = (R + 1) * F.z, gi = tt * 2;
              e.mira.set(arco(b, rr, gi, gi + 1.2) + arco(b, rr, gi + 2.1, gi + 3.3) + arco(b, rr, gi + 4.2, gi + 5.4), 0.26 * F.z, 1);
            } else { e.chifre.set('', 0, 0); e.mira.set('', 0, 0); }
            e.boom.set(b, chegou == null ? -1 : (tt - chegou) / 0.6, F.z, true);
          },
        };
      },

      // ---------------------------------------------------------------------------------------------------------
      // Sniper: Shrapnel. Área marcada no chão e estilhaços caindo do céu em pontos sorteados, com estalo no chão.
      sniper_shrapnel: function (uso) {
        var hits = K.acertosDe(uso, 4);
        var ponto = K.centroDe(hits) || K.pontaPara(uso, 1200); if (!ponto) return null;
        var fimTick = K.ticksDe(uso, uso.hab[0], uso.t + 11, 2);
        var fim = Math.min(uso.t + 10, Math.max(uso.t + 3, fimTick == null ? uso.t + 5 : fimTick + 1));
        var N = 6;
        return {
          ini: uso.t, fim: fim, chao: true,
          criar: function () {
            var g = s('g', {}); var chao = s('path', { fill: 'rgba(255,196,90,.12)', stroke: 'none' }), borda = duplo('#ffc45a', { 'stroke-dasharray': '.8 .5' });
            var cacos = []; for (var i = 0; i < N; i++) cacos.push({ queda: duplo('#fff2c8'), estalo: duplo('#ffb02e') });
            g.append(chao); borda.els.forEach(function (y) { g.append(y); });
            cacos.forEach(function (c) { c.queda.els.concat(c.estalo.els).forEach(function (y) { g.append(y); }); });
            return { g: g, chao: chao, borda: borda, cacos: cacos };
          },
          desenhar: function (e, tt, F) {
            var c = Q(ponto), rr = area(450, F.z) * saiDe(lim((tt - uso.t) / 0.25));
            at(e.chao, { d: circ(c, rr) }); e.borda.set(circ(c, rr), 0.18 * F.z, 0.9);
            e.cacos.forEach(function (x, i) {
              var ritmo = 2.2, kk = tt * ritmo + i / N, n = Math.floor(kk), f = kk - n;
              var an = sorte(n * 31 + i * 7) * Math.PI * 2, d = Math.sqrt(sorte(n * 17 + i * 3)) * rr * 0.9;
              var p = [c[0] + Math.cos(an) * d, c[1] + Math.sin(an) * d];
              if (f < 0.3) { var alto = (1 - f / 0.3) * 4 * F.z; x.queda.set(seg([p[0] + alto * 0.35, p[1] - alto - 0.9 * F.z], [p[0] + alto * 0.35 * 0.8, p[1] - alto]), 0.22 * F.z, 1); x.estalo.set('', 0, 0); }
              else { var g2 = (f - 0.3) / 0.7; x.queda.set('', 0, 0); x.estalo.set(raiosEm(p, 5, 0.2 * F.z, (0.4 + g2 * 0.6) * F.z, n), 0.16 * F.z, 1 - g2); }
            });
            some(e, tt > fim - 0.4 ? lim((fim - tt) / 0.4) : 1);
          },
        };
      },

      // Sniper: Assassinate. Mira vermelha que fecha no alvo, tiro traçante e estouro.
      sniper_assassinate: function (uso) {
        var alvo = alvoDe(uso, 4); if (!alvo) return null;
        var tiro = alvo.t != null ? Math.max(uso.t + 1, alvo.t - 0.15) : uso.t + 2;
        var VOO = 0.25;
        return {
          ini: uso.t, fim: tiro + VOO + 0.7, chao: false,
          criar: function () {
            var g = s('g', {}); var laser = duplo('#ff4a4a', { 'stroke-dasharray': '.35 .35' }), mira = duplo('#ff3030'), cruz = duplo('#ffffff'), bala = duplo('#fff6c8'), boom = estouro('#ff3b3b');
            [laser, mira, cruz, bala, boom].forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, laser: laser, mira: mira, cruz: cruz, bala: bala, boom: boom };
          },
          desenhar: function (e, tt, F) {
            var a = tokOu(F, uso.quem, tt), b = tokOu(F, alvo.idx, Math.min(tt, tiro + VOO)); if (!a || !b) { some(e, 0); return; }
            some(e, 1);
            var mirando = tt < tiro, k = lim((tt - uso.t) / Math.max(0.3, tiro - uso.t));
            if (mirando) {
              var rr = (R + 0.6 + 3 * (1 - saiDe(k))) * F.z;
              e.laser.set(seg(a, b), 0.1 * F.z, 0.8);
              e.mira.set(circ(b, rr), 0.22 * F.z, 1);
              e.cruz.set(raiosEm(b, 4, rr * 0.55, rr * 1.35, tt * 0.8), 0.18 * F.z, 1);
            } else { e.laser.set('', 0, 0); e.mira.set('', 0, 0); e.cruz.set('', 0, 0); }
            var f = (tt - tiro) / VOO;
            if (f >= 0 && f <= 1) { var p = mix(a, b, f), p0 = mix(a, b, Math.max(0, f - 0.25)); e.bala.set(seg(p0, p), 0.35 * F.z, 1); } else e.bala.set('', 0, 0);
            e.boom.set(b, (tt - tiro - VOO) / 0.65, F.z, true);
          },
        };
      },

      // ---------------------------------------------------------------------------------------------------------
      // Phantom Assassin: Stifling Dagger. Adaga girando até o alvo e um corte duplo na chegada.
      phantom_assassin_stifling_dagger: function (uso) {
        var alvo = alvoDe(uso, 1.5); if (!alvo) return null;
        var de = pos(uso.t)[uso.quem], ate = pos(uso.t)[alvo.idx]; if (!de || !ate) return null;
        var VOO = Math.min(0.6, Math.max(0.22, dist(de, ate) * 128 / 1200 * 0.5));
        return {
          ini: uso.t, fim: uso.t + VOO + 0.55, chao: false,
          criar: function () {
            var g = s('g', {}); var rastro = duplo('#c7d6ff'); var lam = s('path', { fill: '#eef3ff', stroke: ESCURO, 'stroke-linejoin': 'round' }); var corte = duplo('#ff4d5e'), brilho = duplo('#ffffff');
            rastro.els.forEach(function (y) { g.append(y); }); g.append(lam); [corte, brilho].forEach(function (x) { x.els.forEach(function (y) { g.append(y); }); });
            return { g: g, rastro: rastro, lam: lam, corte: corte, brilho: brilho };
          },
          desenhar: function (e, tt, F) {
            var a = tokOu(F, uso.quem, uso.t), b = tokOu(F, alvo.idx, tt); if (!a || !b) { some(e, 0); return; }
            var k = (tt - uso.t) / VOO;
            if (k <= 1) {
              var p = mix(a, b, k), p0 = mix(a, b, Math.max(0, k - 0.3)), giro = tt * 28, L = 0.9 * F.z, w = 0.3 * F.z;
              e.rastro.set(seg(p0, p), 0.18 * F.z, 0.8);
              var pt = function (r, an) { return (p[0] + Math.cos(giro + an) * r).toFixed(2) + ',' + (p[1] + Math.sin(giro + an) * r).toFixed(2); };
              e.lam.setAttribute('d', 'M' + pt(L, 0) + 'L' + pt(w, Math.PI / 2) + 'L' + pt(L * 0.5, Math.PI) + 'L' + pt(w, -Math.PI / 2) + 'Z');
              e.lam.setAttribute('stroke-width', (0.12 * F.z).toFixed(3));
              e.corte.set('', 0, 0); e.brilho.set('', 0, 0);
            } else {
              e.rastro.set('', 0, 0); e.lam.setAttribute('d', '');
              var f = (tt - uso.t - VOO) / 0.55, C = (R + 0.9) * F.z * saiDe(lim(f * 4));
              var d = seg([b[0] - C, b[1] - C * 0.5], [b[0] + C, b[1] + C * 0.5]) + seg([b[0] - C * 0.6, b[1] + C * 0.9], [b[0] + C * 0.6, b[1] - C * 0.9]);
              e.corte.set(d, 0.5 * F.z, 1 - f); e.brilho.set(d, 0.18 * F.z, 1 - f);
            }
          },
        };
      },

      // ---------------------------------------------------------------------------------------------------------
      // Rubick: Telekinesis. Runas girando em volta de quem ele levantou, linha de força até ele e a pancada no chão ao cair.
      rubick_telekinesis: function (uso) {
        var alvo = alvoDe(uso, 2); if (!alvo) return null;
        var NO_AR = 1.6;
        return {
          ini: uso.t, fim: uso.t + NO_AR + 0.7, chao: false,
          criar: function () {
            var g = s('g', {}); var fio = duplo('#7ff0c8', { 'stroke-dasharray': '.3 .45' }), sombra = s('ellipse', { fill: 'rgba(0,0,0,.35)' }), aro = duplo('#7ff0c8');
            var runas = [0, 1, 2].map(function () { return s('path', { fill: '#c8fff0', stroke: ESCURO, 'stroke-linejoin': 'round' }); });
            var boom = estouro('#7ff0c8');
            fio.els.forEach(function (y) { g.append(y); }); g.append(sombra); aro.els.forEach(function (y) { g.append(y); }); runas.forEach(function (x) { g.append(x); }); boom.els.forEach(function (y) { g.append(y); });
            return { g: g, fio: fio, sombra: sombra, aro: aro, runas: runas, boom: boom };
          },
          desenhar: function (e, tt, F) {
            var a = tokOu(F, uso.quem, tt), b = tokOu(F, alvo.idx, tt); if (!a || !b) { some(e, 0); return; }
            some(e, 1);
            var k = tt - uso.t, noAr = k < NO_AR, sobe = noAr ? saiDe(lim(k / 0.3)) : 0;
            e.fio.set(noAr ? seg(a, b) : '', 0.14 * F.z, 0.85);
            at(e.sombra, { cx: b[0], cy: b[1] + R * F.z * 0.9, rx: (R * 0.9) * F.z * (1 - sobe * 0.3), ry: (R * 0.35) * F.z, opacity: noAr ? 1 : 0 });
            var rr = (R + 0.8) * F.z;
            e.aro.set(noAr ? circ(b, rr) : '', 0.18 * F.z, 0.9);
            e.runas.forEach(function (p, i) {
              if (!noAr) { p.setAttribute('d', ''); return; }
              var an = k * 4 + (i * Math.PI * 2) / 3, q = [b[0] + Math.cos(an) * rr, b[1] + Math.sin(an) * rr * 0.55], w = 0.45 * F.z;
              p.setAttribute('d', 'M' + q[0].toFixed(2) + ',' + (q[1] - w).toFixed(2) + 'L' + (q[0] + w * 0.7).toFixed(2) + ',' + q[1].toFixed(2) + 'L' + q[0].toFixed(2) + ',' + (q[1] + w).toFixed(2) + 'L' + (q[0] - w * 0.7).toFixed(2) + ',' + q[1].toFixed(2) + 'Z');
              p.setAttribute('stroke-width', (0.1 * F.z).toFixed(3));
            });
            e.boom.set(b, (k - NO_AR) / 0.6, F.z, false);
          },
        };
      },
    };
  };

  // Ficha de cada skill do lote, para o catálogo e a fila (nome como aparece no jogo).
  var fichas = {
    juggernaut_blade_fury: { heroi: 'juggernaut', nome: 'Blade Fury', ult: false },
    juggernaut_omni_slash: { heroi: 'juggernaut', nome: 'Omnislash', ult: true },
    faceless_void_chronosphere: { heroi: 'faceless_void', nome: 'Chronosphere', ult: true, refaz: true },
    faceless_void_time_walk: { heroi: 'faceless_void', nome: 'Time Walk', ult: false },
    lion_impale: { heroi: 'lion', nome: 'Earth Spike', ult: false },
    lion_finger_of_death: { heroi: 'lion', nome: 'Finger of Death', ult: true },
    shadow_shaman_shackles: { heroi: 'shadow_shaman', nome: 'Shackles', ult: false },
    shadow_shaman_mass_serpent_ward: { heroi: 'shadow_shaman', nome: 'Mass Serpent Ward', ult: true },
    spirit_breaker_charge_of_darkness: { heroi: 'spirit_breaker', nome: 'Charge of Darkness', ult: false },
    sniper_shrapnel: { heroi: 'sniper', nome: 'Shrapnel', ult: false },
    sniper_assassinate: { heroi: 'sniper', nome: 'Assassinate', ult: true },
    phantom_assassin_stifling_dagger: { heroi: 'phantom_assassin', nome: 'Stifling Dagger', ult: false },
    rubick_telekinesis: { heroi: 'rubick', nome: 'Telekinesis', ult: false },
  };

  (window.SKILL_LOTES = window.SKILL_LOTES || []).push({ numero: 1, fichas: fichas, fazer: lote });
})();
