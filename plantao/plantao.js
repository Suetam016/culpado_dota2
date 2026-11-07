// Plantão da Selva: a tela de vitória como plantão policial da tarde. Um helicóptero persegue quem carregou nos 2
// minutos finais do replay de verdade (mapas/<id>.json), com câmera lenta nos lances, acelerado no que é chato, som
// sintetizado e o locutor com a voz do Mat.
//
// O locutor NÃO é gerado na hora: toca falas inteiras de um banco fechado, gravado uma vez só (audio/plantao/, ver
// audio/plantao/banco.js). Cada lance da partida vira 1 a 3 falas do banco; o site baixa só as sorteadas.
//
// Uso (index.html, visaoPlantao): Plantao.montar(caixa, ctx) com ctx = {match, mapa, carry (idx do jogador), jog
// (montarJogadores), est (ESTRUTURAS), arv (ARVORES_B64), tri (TRILHAS_B64), ladoNome(radiant), data, fatia, amigos
// (nicks do grupo)}. Devolve {parar()}.
(function () {
  'use strict';
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/plantao\/plantao\.js.*$/, '') : ''; })();
  var NPC = 'npc_dota_hero_';
  var PROJ = /arrow|meat_hook|shuriken|bolt|spear|cask|concussive|assassinate|stifling_dagger|missile|lance|toss|shackle|boulder|wave_of_terror|dragon_slave|laguna|finger|hookshot|grapple|spirit_lance|nether_strike/;
  var INVIS = /invis|wind_walk|shadow_walk|ghost_walk|smoke_of_deceit|silver_edge|invis_sword|shukuchi|moonlight|meld|skeleton_walk|sand_storm|vendetta|spirit_walk|fade_bolt_x/;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mmss(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function mil(v) { return v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(Math.round(v)); }
  function slugDe(j) { return String((j.heroi && j.heroi.npc) || '').replace(NPC, ''); }

  // ---------------------------------------------------------------------------------------------------------------
  // Dados: tudo o que a cena precisa, tirado da partida (OpenDota) e do mapa do robô. Índice 0-4 = time de quem
  // carregou, 5-9 = inimigos; NAK = quem carregou.
  function janelaDeImpacto(m, mapa, carry, kDe, t0, TF) {
    var k = kDe[carry.idx], lado = carry.radiant, ponto = {}, add = function (t, v) { t = Math.round(t); ponto[t] = (ponto[t] || 0) + v; };
    var inimigoK = {}; (m.players || []).forEach(function (p, pi) { var r = p.isRadiant != null ? p.isRadiant : p.player_slot < 128; if (r !== lado && kDe[pi] != null) inimigoK[kDe[pi]] = true; });
    var bateu = {}; // [vitimaK] -> tempos em que o jogador bateu nela
    (mapa.dano || []).forEach(function (d) { if (d[1] === k && inimigoK[d[2]]) { add(d[0], d[3]); (bateu[d[2]] = bateu[d[2]] || []).push(d[0]); } });
    var npcK = {}; (m.players || []).forEach(function (p, pi) { if (p.hero_id != null && kDe[pi] != null && inimigoK[kDe[pi]]) npcK[pi] = kDe[pi]; });
    (m.players || []).forEach(function (p, pi) {
      var r = p.isRadiant != null ? p.isRadiant : p.player_slot < 128; if (r !== lado) return;
      (p.kills_log || []).forEach(function (kl) {
        if (pi === carry.idx) { add(kl.time, 900); return; }
        // participação: abate do time em quem o jogador bateu nos 8 s antes
        var vk = null; Object.keys(bateu).forEach(function (x) { if (bateu[x].some(function (t) { return t <= kl.time && t >= kl.time - 8; })) vk = x; });
        if (vk != null) add(kl.time, 450);
      });
    });
    var soma = function (fim) { var s = 0; for (var t = fim - 124; t <= fim; t++) s += ponto[t] || 0; return s; };
    var noFim = soma(TF), melhor = TF, maior = noFim;
    for (var fim = t0 + 130; fim < TF - 60; fim += 5) { var v = soma(fim); if (v > maior) { maior = v; melhor = fim; } }
    // só troca o fim (trono caindo) por uma luta que valeu bem mais; termina uns segundos depois do último lance dela
    if (melhor === TF || maior < noFim * 1.6 + 600) return TF;
    var ult = melhor; for (var t = melhor; t > melhor - 30; t--) if (ponto[t]) { ult = t; break; }
    return Math.min(TF, ult + 6);
  }
  function preparar(ctx) {
    var m = ctx.match, mapa = ctx.mapa, jog = ctx.jog;
    var carry = jog.find(function (j) { return j.idx === ctx.carry; });
    if (!carry) throw new Error('sem carregador');
    var nos = jog.filter(function (j) { return j.radiant === carry.radiant; });
    nos.sort(function (a, b) { return (b.idx === carry.idx) - (a.idx === carry.idx); });
    var eles = jog.filter(function (j) { return j.radiant !== carry.radiant; });
    var ordem = nos.concat(eles);
    var NAK = 0;
    // índice do mapa (posição 0..9 gravada pelo robô) -> nossa ordem
    var kDe = {};
    jog.forEach(function (j, i) { var k = mapa.slots.indexOf(j.slot); kDe[j.idx] = k >= 0 ? k : i; });
    var iDeK = {}; ordem.forEach(function (j, i) { iDeK[kDe[j.idx]] = i; });
    var iDeIdx = {}; ordem.forEach(function (j, i) { iDeIdx[j.idx] = i; });
    var npcDe = {}; ordem.forEach(function (j, i) { if (j.heroi && j.heroi.npc) npcDe[j.heroi.npc] = i; });

    var L = mapa.x[0].length, t0 = mapa.t0;
    var TF = Math.min(Math.round(m.duration || (t0 + L - 1)), t0 + L - 1);
    // janela de 2 min: a do fim, a não ser que o jogador em destaque tenha tido uma luta bem mais forte antes (dano em
    // herói + abates + participação). Pedido do Mat: suporte com mérito não pode aparecer parado só no fim.
    var T1 = janelaDeImpacto(m, mapa, carry, kDe, t0, TF), final = T1 === TF;
    var T0 = Math.max(t0 + 1, T1 - 124);
    var N = T1 - T0 + 1;
    var ix = function (t) { return clamp(t - t0, 0, L - 1); };
    var pos = ordem.map(function (j) { var k = kDe[j.idx]; var row = []; for (var t = T0; t <= T1; t++) row.push([mapa.x[k][ix(t)], mapa.y[k][ix(t)]]); return row; });
    var hab = mapa.hab || [];
    var dentro = function (t) { return t >= T0 && t <= T1; };
    var ev = (mapa.usos || []).filter(function (u) { return dentro(u[0]) && iDeK[u[1]] != null && hab[u[2]]; })
      .map(function (u) { return [Math.round((u[0] - T0) * 10) / 10, iDeK[u[1]], hab[u[2]][0], hab[u[2]][2], u[3] != null && u[3] >= 0 && iDeK[u[3]] != null ? iDeK[u[3]] : -1, hab[u[2]][1] || '']; });
    var dano = (mapa.dano || []).filter(function (d) { return dentro(d[0]) && iDeK[d[1]] != null && iDeK[d[2]] != null; })
      .map(function (d) { return [d[0] - T0, iDeK[d[1]], iDeK[d[2]], d[3], d[4] >= 0 && hab[d[4]] ? hab[d[4]][0] : '']; });
    var abates = [], mortes = ordem.map(function () { return []; }), antes = [0, 0];
    (m.players || []).forEach(function (p, pi) {
      var ik = iDeIdx[pi];
      (p.kills_log || []).forEach(function (k) {
        var v = npcDe[k.key]; if (v == null || ik == null) return;
        mortes[v].push(k.time);
        if (dentro(k.time)) abates.push([k.time - T0, ik, v]);
        else if (k.time < T0) antes[jog[pi].radiant ? 0 : 1]++;
      });
    });
    abates.sort(function (a, b) { return a[0] - b[0]; });
    // placar antes da perseguição: o final da partida menos os abates da janela (o kills_log não tem as mortes para creep)
    if (final && m.radiant_score != null && m.dire_score != null) {
      var naJanela = [0, 0]; abates.forEach(function (k) { naJanela[(k[1] < 5) === carry.radiant ? 0 : 1]++; });
      antes = [Math.max(0, m.radiant_score - naJanela[0]), Math.max(0, m.dire_score - naJanela[1])];
    }
    // prédios: posição de verdade, quando caíram e quem deu o último golpe
    var quedas = {}, slotI = {};
    ordem.forEach(function (j, i) { slotI[j.slot] = i; });
    var pred = [];
    (m.objectives || []).forEach(function (o) {
      if (o.type !== 'building_kill' || !o.key) return;
      var k = o.key.replace('npc_dota_', '');
      (quedas[k] = quedas[k] || []).push(o.time);
      if (dentro(o.time)) pred.push([o.time - T0, o.player_slot != null && slotI[o.player_slot] != null ? slotI[o.player_slot] : -1, k]);
    });
    var est = ctx.est.map(function (e) {
      var k = e[0], ts = quedas[k] || [], t = ts.length ? ts.shift() : null;
      var tipo = k.indexOf('fort') >= 0 ? 'fort' : k.indexOf('rax') >= 0 ? 'rax' : 'torre';
      return [k, Math.round((e[1] / 128 + 128) * 10) / 10, Math.round((e[2] / 128 + 128) * 10) / 10, tipo, t == null ? null : t < T0 ? -1 : t - T0, k.indexOf('tower4') >= 0];
    });
    // a fortaleza cai no fim da partida mesmo quando o objetivo não vem: o trono do perdedor cai em T1
    var perdedor = carry.radiant ? 'badguys' : 'goodguys';
    est.forEach(function (e) { if (e[3] === 'fort' && e[0].indexOf(perdedor) === 0 && e[4] === null && final && m.radiant_win === carry.radiant) e[4] = N - 1.5; });
    // vivo: morto da morte até o pulo para a fonte (renasceu)
    var vivo = ordem.map(function (j, i) {
      var k = kDe[j.idx], row = [];
      for (var t = T0; t <= T1; t++) {
        var ult = null; mortes[i].forEach(function (x) { if (x <= t && (ult === null || x > ult)) ult = x; });
        var morto = false;
        if (ult !== null) { morto = true; for (var s = ix(ult) + 1; s <= ix(t); s++) { if (Math.abs(mapa.x[k][s] - mapa.x[k][s - 1]) + Math.abs(mapa.y[k][s] - mapa.y[k][s - 1]) > 8) { morto = false; break; } } }
        row.push(morto ? 0 : 1);
      }
      return row;
    });
    return { T0: T0, N: N, final: final, NAK: NAK, ordem: ordem, herois: ordem.map(slugDe), nomes: ordem.map(function (j) { return j.nome; }), heroiNome: ordem.map(function (j) { return (j.heroi && j.heroi.nome) || '?'; }),
      pos: pos, ev: ev, dano: dano, abates: abates, pred: pred, est: est, vivo: vivo,
      placar0: antes, radiant: carry.radiant, raw: m.players[carry.idx] || {} };
  }

  // Como desenhar cada skill usada (de todos os heróis), deduzido do que ela fez: quem levou dano dela e quando,
  // se o herói saltou, se tinha alvo. Formas: proj (projétil até a vítima), area (onda onde estavam as vítimas),
  // golpe (pancada colada), salto (blink), alvo (traço até o alvo sem dano), aura (anel no próprio herói).
  function efeitos(D) {
    var P = function (i, t) { var a = clamp(Math.floor(t), 0, D.N - 1), b = Math.min(D.N - 1, a + 1), f = clamp(t - a, 0, 1); var A = D.pos[i][a], B = D.pos[i][b]; return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; };
    var dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    return D.ev.filter(function (e) { return e[2] !== 'tpscroll' && e[2].indexOf('ward') < 0; }).map(function (e) {
      var t = e[0], i = e[1], vit = {};
      D.dano.forEach(function (d) { if (d[1] === i && d[4] === e[2] && d[0] >= t - 0.2 && d[0] <= t + 3 && vit[d[2]] == null) vit[d[2]] = d[0]; });
      var vs = Object.keys(vit).map(function (k) { return { i: +k, t: Math.max(t, vit[k]) }; });
      var o = { t: t, i: i, key: e[2], tipo: e[3], nome: e[5], vit: vs, alvo: e[4] };
      var antes = P(i, Math.max(0, t - 0.3)), depois = P(i, Math.min(D.N - 1, t + 1));
      if (/blink|leap|phase|shukuchi|time_walk|ball_lightning|pounce|charge|surge|dash|rolling/.test(e[2]) || (dist(antes, depois) > 7 && !vs.length)) { o.forma = 'salto'; o.de = antes; o.para = depois; }
      else if (vs.length && PROJ.test(e[2])) { vs.sort(function (x, y) { return x.t - y.t; }); o.vit = [vs[0]]; o.forma = 'proj'; o.th = Math.max(vs[0].t, t + 0.25); }
      else if (vs.length >= 2) {
        var c = [0, 0]; vs.forEach(function (v) { var q = P(v.i, v.t); c[0] += q[0] / vs.length; c[1] += q[1] / vs.length; });
        o.forma = 'area'; o.c = c; o.r = Math.min(7, 2.5 + Math.max.apply(null, vs.map(function (v) { return dist(P(v.i, v.t), c); }))); o.th = Math.min.apply(null, vs.map(function (v) { return v.t; }));
      } else if (vs.length === 1) { o.forma = dist(P(i, t), P(vs[0].i, vs[0].t)) > 3.5 ? 'proj' : 'golpe'; o.th = Math.max(vs[0].t, t + (o.forma === 'proj' ? 0.25 : 0.05)); }
      else if (e[4] >= 0 && e[4] !== i) o.forma = 'alvo';
      else o.forma = e[3] === 'i' && !/black_king_bar|manta|mjollnir|lotus|blade_mail|satanic|bloodstone|refresher|shivas|crimson|pipe|mekansm|greaves/.test(e[2]) ? null : 'aura';
      return o;
    }).filter(function (o) { return o.forma; });
  }

  // Lances que o locutor comenta (tipos do banco) e o ritmo do replay (rápido no chato, lento no que decide)
  // como foi a morte, para o locutor ler o lance: debaixo da torre, briga, solado (ninguém do time bateu), pick-off
  // (vítima sem ninguém do time dela por perto) ou em equipe
  function contexto(D, k) {
    var t = k[0], v = k[2], sec = clamp(Math.round(t), 0, D.N - 1), pv = D.pos[v] && D.pos[v][sec];
    if (!pv) return '';
    var perto = function (de, ate) { var n = 0; for (var i = de; i < ate; i++) { if (i === v || !D.pos[i] || !D.vivo[i][sec]) continue; var q = D.pos[i][sec]; if (Math.hypot(q[0] - pv[0], q[1] - pv[1]) < 12) n++; } return n; };
    var ladoV = D.radiant ? 'badguys' : 'goodguys';
    var torre = D.est.some(function (e) { return e[3] !== 'fort' && e[0].indexOf(ladoV) === 0 && (e[4] === null || e[4] > t) && Math.hypot(e[1] - pv[0], e[2] - pv[1]) < 8; });
    if (torre) return 'torre';
    var deles = perto(5, 10), nossos = perto(0, 5);
    if (deles >= 2 && nossos >= 2) return 'luta';
    var ajudou = D.dano.some(function (d) { return d[2] === v && d[1] !== k[1] && d[1] < 5 && d[0] >= t - 6 && d[0] <= t + .5; });
    if (!ajudou) return 'solo';
    if (deles === 0) return 'pickoff';
    return 'equipe';
  }
  function roteiro(D, ctx) {
    var NAK = D.NAK, FIM = D.N - 1, L = [];
    var meus = D.abates.filter(function (k) { return k[1] === NAK; });
    L.push({ t: 0.6, tipo: 'abertura', p: 1 });
    meus.forEach(function (k) { var v = D.ordem[k[2]]; L.push({ t: k[0], tipo: 'abate', vitima: D.herois[k[2]], dono: ctx.amigos.indexOf(v.nome) >= 0 ? v.nome : '', ctx: contexto(D, k), p: 9 }); });
    D.est.forEach(function (e) {
      if (e[4] === null || e[4] < 0) return;
      var nosso = (e[0].indexOf('goodguys') === 0) === D.radiant;
      if (nosso) return;
      L.push({ t: e[4], tipo: e[3] === 'fort' ? 'fim' : e[3] === 'rax' ? 'quartel' : e[5] ? 'torre4' : 'torre', p: e[3] === 'fort' ? 10 : e[3] === 'rax' ? 6 : 5 });
    });
    // várias vítimas na mesma skill, em até 1 s
    var grupos = {};
    D.dano.forEach(function (d) { if (d[1] !== NAK || !d[4] || d[2] < 5) return; var c = d[4] + '@' + Math.round(d[0]); (grupos[c] = grupos[c] || { t: d[0], v: {} }).v[d[2]] = 1; });
    var melhorV = null;
    Object.keys(grupos).forEach(function (c) { var g = grupos[c], n = Object.keys(g.v).length; if (n >= 2 && (!melhorV || n > melhorV.n)) melhorV = { t: g.t, n: n }; });
    if (melhorV) L.push({ t: melhorV.t, tipo: 'varios', n: melhorV.n, p: 7 });
    // maior porrada num herói
    var maior = null;
    D.dano.forEach(function (d) { if (d[1] === NAK && d[2] >= 5 && d[3] >= 500 && (!maior || d[3] > maior[3])) maior = d; });
    if (maior) L.push({ t: maior[0], tipo: 'dano', vitima: D.herois[maior[2]], num: maior[3], p: 6 });
    // skill decisiva: a ultimate (ou a skill de mais dano) do carregador
    var ult = D.ev.filter(function (e) { return e[1] === NAK && e[3] === 'u' && !INVIS.test(e[2]); })[0];
    if (!ult) { var porHab = {}; D.dano.forEach(function (d) { if (d[1] === NAK && d[4]) porHab[d[4]] = (porHab[d[4]] || 0) + d[3]; }); var top = Object.keys(porHab).sort(function (a, b) { return porHab[b] - porHab[a]; })[0]; if (top) ult = D.ev.filter(function (e) { return e[1] === NAK && e[2] === top; })[0]; }
    if (ult) L.push({ t: ult[0], tipo: 'skill', p: 4 });
    var inv = D.ev.filter(function (e) { return e[1] === NAK && INVIS.test(e[2]); })[0];
    if (inv) L.push({ t: inv[0], tipo: 'sumiu', p: 4 });
    // ritmo: velocidade por meio segundo de jogo
    var chaves = D.abates.map(function (k) { return k[0]; }).concat(D.est.filter(function (e) { return e[4] !== null && e[4] >= 0; }).map(function (e) { return e[4]; }), L.filter(function (x) { return x.tipo !== 'abertura'; }).map(function (x) { return x.t; }));
    // ritmo: a ação (abates, troca de dano do carry com herói, ult dele) anda devagar e com folga; prédio caindo só
    // segura no instante da queda, e o caminho entre um e outro acelera (pedido do Mat: menos perseguição de torre)
    var acao = D.abates.map(function (k) { return k[0]; })
      .concat(D.dano.filter(function (d) { return d[3] >= 150 && ((d[1] === NAK && d[2] >= 5) || (d[2] === NAK && d[1] >= 5)); }).map(function (d) { return d[0]; }))
      .concat(D.ev.filter(function (e) { return e[1] === NAK && e[3] === 'u'; }).map(function (e) { return e[0]; }));
    var predios = D.est.filter(function (e) { return e[4] !== null && e[4] >= 0; }).map(function (e) { return e[4]; });
    var perto = function (lista, t) { var d = Infinity; lista.forEach(function (k) { d = Math.min(d, Math.abs(t - k)); }); return d; };
    var vel = [];
    for (var s = 0; s <= FIM * 2 + 1; s++) {
      var t = s / 2, dA = perto(acao, t), dP = perto(predios, t);
      vel.push(t < 4 ? 2 : dA < 2.5 ? 1.2 : dA < 6 ? 1.8 : dP < 2 ? 1.6 : dA < 12 || dP < 5 ? 3.5 : dA < 20 ? 6 : 9);
    }
    // "enquanto isso": no maior trecho acelerado
    var ini, best;
    // (só depois do primeiro lance: logo depois da abertura soa fora de hora)
    var primeiro = Math.min.apply(null, chaves.concat([FIM]));
    ini = -1; best = null;
    for (s = 0; s <= vel.length; s++) { if (vel[s] >= 5 && s / 2 > primeiro) { if (ini < 0) ini = s; } else if (ini >= 0) { if (!best || s - ini > best[1] - best[0]) best = [ini, s]; ini = -1; } }
    if (best && (best[1] - best[0]) / 2 >= 10) L.push({ t: best[0] / 2 + 1, tipo: 'enquanto', p: 2 });
    var lentos = [];
    D.abates.forEach(function (k) { if (k[1] === NAK) lentos.push([k[0] - 0.4, k[0] + 0.8, 0.45]); });
    D.est.forEach(function (e) { if (e[4] !== null && e[4] >= 0) lentos.push(e[3] === 'fort' ? [e[4] - 0.4, e[4] + 1.4, 0.35] : [e[4] - 0.4, e[4] + 0.6, 0.6]); });
    if (melhorV) lentos.push([melhorV.t - 0.3, melhorV.t + 0.7, 0.5]);
    if (maior) lentos.push([maior[0] - 0.3, maior[0] + 0.5, 0.5]);
    // no máximo uma fala a cada 3 s de jogo: fica a mais importante
    L.sort(function (a, b) { return b.p - a.p; });
    var fica = [];
    L.forEach(function (x) { if (x.tipo === 'fim' || !fica.some(function (y) { return Math.abs(y.t - x.t) < 3; })) fica.push(x); });
    fica.sort(function (a, b) { return a.t - b.t; });
    return { eventos: fica.map(function (x) { var o = { t: x.t, tipo: x.tipo }; ['vitima', 'dono', 'n', 'num', 'ctx'].forEach(function (k) { if (x[k] != null) o[k] = x[k]; }); return o; }), vel: vel, lentos: lentos };
  }

  function carregarBanco() {
    if (window.BancoPlantao && carregarBanco.indice) return carregarBanco.indice;
    var s = new Promise(function (ok, erro) {
      if (window.BancoPlantao) return ok();
      var el = document.createElement('script'); el.src = BASE + 'audio/plantao/banco.js'; el.onload = function () { ok(); }; el.onerror = erro; document.head.appendChild(el);
    });
    carregarBanco.indice = Promise.all([s, fetch(BASE + 'audio/plantao/falas.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })]).then(function (x) { return x[1]; });
    return carregarBanco.indice;
  }

  // ---------------------------------------------------------------------------------------------------------------
  function montar(caixa, ctx) {
    var t00 = performance.now();
    var D;
    try { D = preparar(ctx); } catch (e) { caixa.append(aviso('Não deu para montar o plantão desta partida.')); return { parar: function () {} }; }
    var R = roteiro(D, ctx);
    var NAK = D.NAK, N = D.N, FIM = N - 1;
    var inimigo = ctx.ladoNome(!D.radiant), meuLado = ctx.ladoNome(D.radiant);
    var nick = D.nomes[NAK], heroi = D.heroiNome[NAK];
    var ab3 = function (r) { return ctx.ladoNome(r).slice(0, 3).toUpperCase(); };
    var meusAbates = D.abates.filter(function (k) { return k[1] === NAK; }).length;
    var meusPredios = D.pred.filter(function (p) { return p[1] === NAK; }).length;
    var forte = D.est.filter(function (e) { return e[3] === 'fort' && e[0].indexOf(D.radiant ? 'badguys' : 'goodguys') === 0; })[0];

    // ----- DOM
    var h = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    var peca = h('div', 'peca pl'); peca.setAttribute('role', 'img'); peca.setAttribute('aria-label', 'Plantão com câmera de helicóptero perseguindo ' + heroi + ' de ' + nick);
    var cv = h('canvas'); cv.width = 900; cv.height = 846;
    var topo = h('div', 'pl-topo');
    var vin = h('div', 'vin'); vin.append(h('b', '', 'PLANTÃO')); var vs = h('small'); vs.append('da Selva', h('br'), 'perseguição'); vin.append(vs);
    var vivoEl = h('div', 'vivo'); vivoEl.append(h('i'), 'AO VIVO');
    var plc = h('div', 'plc'); var nRad = h('span', 'n'), nDire = h('span', 'n');
    plc.append(h('span', 't', ab3(true)), nRad, nDire, h('span', 't', ab3(false)));
    topo.append(vin, vivoEl, plc);
    var chips = h('div', 'pl-chips'); var cAb = h('b', '', '0'), cPr = h('b', '', '0');
    var d1 = h('div'); d1.append(cAb, 'ABATES'); var d2 = h('div'); d2.append(cPr, 'PRÉDIOS'); chips.append(d1, d2);
    var gc = h('div', 'pl-gc'); var nm = h('div', 'nome'); var foto = h('img'); foto.alt = ''; foto.src = BASE + 'img/herois/' + D.herois[NAK] + '.png'; nm.append(foto, nick);
    if (nick.length > 11) nm.style.fontSize = Math.max(3.4, 7.6 * 11 / nick.length).toFixed(2) + 'cqw'; // nick comprido cabe na tarja
    var sub = h('div', 'sub'); gc.append(nm, h('br'), sub);
    var fala = h('div', 'pl-fala'); var falaTx = h('span'); fala.append(h('small', '', 'LOCUTOR'), falaTx);
    var tk = h('div', 'pl-tk'); var tkTx = h('div');
    var r = D.raw;
    var kda = r.kills != null ? r.kills + '/' + r.deaths + '/' + r.assists : '';
    var itens = [kda ? nick + ' fecha a partida em ' + kda : nick + ' fecha a partida',
      r.hero_damage ? mil(r.hero_damage) + ' de dano em heróis' : null,
      meusPredios ? 'derrubou ' + meusPredios + (meusPredios > 1 ? ' prédios' : ' prédio') + ' só na perseguição' : null,
      ctx.data ? 'partida de ' + ctx.data : null,
      inimigo + ' convocam reunião de emergência na fonte',
      ctx.fatia ? Math.round(ctx.fatia * 100) + '% do mérito da vitória' : null].filter(Boolean).join(' • ');
    tkTx.textContent = itens + ' • ' + itens + ' • ';
    tk.append(h('b', '', 'URGENTE'), tkTx);
    var btn = h('button', 'pl-play'); btn.type = 'button'; btn.setAttribute('data-gtm', 'vitoria-plantao-play');
    var bs = h('span'); var bLbl = h('b', '', 'Preparando o locutor…'); bs.append(h('i'), bLbl); btn.append(bs); btn.disabled = true;
    peca.append(cv, topo, chips, gc, fala, tk, btn);
    var info = h('div', 'pl-info'); var mudoLbl = h('label'); var mudo = h('input'); mudo.type = 'checkbox'; mudoLbl.append(mudo, ' sem som');
    var tempo = h('span', '', 'Medindo o tempo…'); var sorteio = h('span');
    info.append(mudoLbl, tempo, sorteio);
    // tempo de preparo e nº do sorteio só na página de teste (?visao=plantao): no site, só o "sem som" (pedido do Mat)
    var teste = false; try { teste = new URLSearchParams(location.search).get('visao') === 'plantao'; } catch (e) { /* sem URL */ }
    if (!teste) { tempo.hidden = true; sorteio.hidden = true; }
    caixa.append(peca, info);

    // ----- banco de falas: baixa só as sorteadas
    var TEXTOS = {}, FALAS = [], tomada = 0, baixados = {}, bytes = 0;
    function sortear(semente) {
      return window.BancoPlantao.montar(R.eventos, { heroi: D.herois[NAK], quem: ctx.amigos.indexOf(nick) >= 0 ? nick : '', amigos: new Set(ctx.amigos), semente: semente, tem: function (id) { return Boolean(TEXTOS[id]); } })
        .map(function (x) { var ids = x.ids.filter(function (id) { return TEXTOS[id]; }); return [x.t, ids.length ? TEXTOS[ids[0]] : '', ids]; })
        .filter(function (f) { return f[2].length; });
    }
    function baixar(lista) {
      var ids = []; lista.forEach(function (f) { f[2].forEach(function (id) { if (!baixados[id]) ids.push(id); }); });
      return Promise.all(ids.map(function (id) {
        baixados[id] = fetch(BASE + 'audio/plantao/' + id + '.mp3').then(function (x) { if (!x.ok) throw 0; return x.arrayBuffer(); })
          .then(function (ab) { bytes += ab.byteLength; return decodificar(ab); }).then(function (b) { buf['voz' + id] = b; }).catch(function () {});
        return baixados[id];
      })).then(function () { return ids.length; });
    }
    function preparar2() {
      var t = performance.now();
      btn.disabled = true; bLbl.textContent = 'Preparando o locutor…';
      FALAS = sortear((Math.random() * 1e9) | 0); tomada++;
      return baixar(FALAS).then(function (n) {
        var seg = (performance.now() - (tomada === 1 ? t00 : t)) / 1000;
        var nFalas = FALAS.reduce(function (s, f) { return s + f[2].length; }, 0);
        tempo.textContent = '';
        var ok = h('span', 'ok', (tomada === 1 ? 'Pronto em ' : 'Novo sorteio pronto em ') + seg.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s');
        tempo.append(ok, ' · ' + nFalas + ' falas do banco' + (n ? ' (' + Math.round(bytes / 1024) + ' KB baixados até agora)' : ' (já estavam baixadas)') + ' · nada gerado na hora');
        sorteio.textContent = 'Sorteio nº ' + tomada + ' de falas';
        btn.disabled = false; bLbl.textContent = tomada === 1 ? 'Assistir com som' : 'Ver de novo';
        if (!esperandoPlay) { esperandoPlay = false; }
      });
    }
    var esperandoPlay = false;

    // ----- áudio
    var A = null, mestre, abafa, saidaVoz, vozAtual = null, ruido, rotor = null, cama = null, buf = {};
    function ctxAudio() {
      if (A) return A;
      A = new (window.AudioContext || window.webkitAudioContext)();
      var comp = A.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      abafa = A.createBiquadFilter(); abafa.type = 'lowpass'; abafa.frequency.value = 18000;
      mestre = A.createGain(); mestre.gain.value = mudo.checked ? 0 : 0.8; mestre.connect(abafa); abafa.connect(comp); comp.connect(A.destination);
      saidaVoz = A.createGain(); saidaVoz.gain.value = mudo.checked ? 0 : 1.1; saidaVoz.connect(comp);
      var n = A.sampleRate * 2, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; ruido = b;
      return A;
    }
    function decodificar(ab) { var a = ctxAudio(); return new Promise(function (ok, erro) { a.decodeAudioData(ab, ok, erro); }); }
    // sons das skills de quem carregou (sons/<habilidade>.mp3, os mesmos do replay do site)
    var habs = {}; D.ev.forEach(function (e) { if (e[3] !== 'i') habs[e[2]] = (habs[e[2]] || 0) + (e[1] === NAK ? 100 : 1); });
    Object.keys(habs).sort(function (a, b) { return habs[b] - habs[a]; }).slice(0, 16).forEach(function (k) {
      fetch(BASE + 'sons/' + k + '.mp3').then(function (x) { if (!x.ok) throw 0; return x.arrayBuffer(); }).then(decodificar).then(function (b) { buf['hab' + k] = b; }).catch(function () {});
    });
    function env(gn, t, a, p, d) { gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(p, t + a); gn.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
    function osc(tp, f0, f1, t, a, p, d, alvo) { var o = A.createOscillator(), gn = A.createGain(); o.type = tp; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d); env(gn, t, a, p, d); o.connect(gn); gn.connect(alvo || mestre); o.start(t); o.stop(t + a + d + .05); }
    function chiado(ft, f0, f1, q, t, a, p, d, alvo) { var s = A.createBufferSource(), f = A.createBiquadFilter(), gn = A.createGain(); s.buffer = ruido; s.loop = true; f.type = ft; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + a + d); env(gn, t, a, p, d); s.connect(f); f.connect(gn); gn.connect(alvo || mestre); s.start(t, Math.random()); s.stop(t + a + d + .05); }
    function pancada(t, forca) { osc('sine', 140, 42, t, .004, .9 * forca, .3); chiado('bandpass', 900, 500, 3, t, .002, .55 * forca, .16); chiado('highpass', 4000, 4000, .7, t, .001, .3 * forca, .04); }
    function metal(t, f, v, d) { [1, 2.76, 5.4].forEach(function (m, i) { osc('triangle', f * m, f * m * .985, t, .002, v / (i + 1), d / (i * .5 + 1)); }); }
    function moedas(t, n) { for (var i = 0; i < n; i++) metal(t + .06 + i * .055 + Math.random() * .02, 2600 + Math.random() * 700, .07, .18); }
    function sino(t) { [1, 2.4, 3.9].forEach(function (m, i) { osc('sine', 155 * m, 152 * m, t, .004, .3 / (i + 1), 1.6 / (i * .6 + 1)); }); }
    function plim(t) { osc('sine', 1568, 1568, t, .004, .18, .35); osc('sine', 2093, 2093, t + .09, .004, .16, .5); }
    function metais(t, notas, dur, vol) { notas.forEach(function (f) { [1, 1.004, .996].forEach(function (dt) { var o = A.createOscillator(), fl = A.createBiquadFilter(), gn = A.createGain(); o.type = 'sawtooth'; o.frequency.value = f * dt; fl.type = 'lowpass'; fl.frequency.setValueAtTime(400, t); fl.frequency.exponentialRampToValueAtTime(3200, t + .04); fl.frequency.exponentialRampToValueAtTime(900, t + dur); gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol / notas.length, t + .02); gn.gain.setValueAtTime(vol / notas.length, t + dur * .6); gn.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(fl); fl.connect(gn); gn.connect(mestre); o.start(t); o.stop(t + dur + .05); }); }); }
    function timpano(t, f, v) { osc('sine', f * 1.5, f, t, .003, v, .9); chiado('lowpass', 260, 140, 1, t, .002, v * .4, .25); }
    // vinheta original do plantão: três golpes curtos e o acorde aberto
    function vinheta(t) { var c1 = [146.8, 220, 293.7, 349.2], c2 = [155.6, 233.1, 311.1, 392]; [0, .16, .32].forEach(function (o) { metais(t + o, c1, .13, .34); timpano(t + o, 73, .5); }); metais(t + .52, c2, 1.5, .42); timpano(t + .52, 78, .8); for (var k = 0; k < 10; k++) timpano(t + .6 + k * .06, 78, .12 + k * .02); }
    function fanfarraFinal(t) { var c = [[196, 246.9, 293.7], [220, 277.2, 329.6], [261.6, 329.6, 392, 523.3]]; c.forEach(function (n, i) { metais(t + i * .22, n, i === 2 ? 2.4 : .2, .42); timpano(t + i * .22, 65, .7); }); chiado('highpass', 5000, 5000, .7, t + .44, .3, .08, 2.2); }
    function radio(t, fim) { chiado('bandpass', 2400, 1800, 4, t, .004, .28, .09); if (!fim) osc('square', 1180, 1180, t + .1, .004, .06, .07); }
    function sirene(t, dur, vol) { var o = A.createOscillator(), lfo = A.createOscillator(), lg = A.createGain(), gn = A.createGain(), f = A.createBiquadFilter(); o.type = 'square'; o.frequency.value = 760; lfo.frequency.value = .55; lg.gain.value = 230; lfo.connect(lg); lg.connect(o.frequency); f.type = 'lowpass'; f.frequency.value = 1500; gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + .8); gn.gain.setValueAtTime(vol, t + dur - 1); gn.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(f); f.connect(gn); gn.connect(mestre); o.start(t); lfo.start(t); o.stop(t + dur + .1); lfo.stop(t + dur + .1); }
    function desmorona(t, forte) { osc('sine', 90, 26, t, .006, forte ? 1 : .75, forte ? 2.2 : 1.2); chiado('lowpass', 900, 120, 1, t, .01, forte ? .7 : .45, forte ? 2.6 : 1.5); for (var k = 0; k < (forte ? 14 : 7); k++) chiado('bandpass', 1500 + Math.random() * 2500, 900, 6, t + .15 + Math.random() * (forte ? 1.6 : .8), .002, .18, .05); }
    function vuum(t, desce) { chiado('bandpass', desce ? 3200 : 300, desce ? 240 : 3200, 3, t, .3, .26, .08); }
    function fitaRapida(t) { chiado('bandpass', 500, 4000, 6, t, .35, .16, .1); osc('sawtooth', 90, 600, t, .4, .04, .05); }
    function somHab(k, t, vol) { vol = vol || .75; var b = buf['hab' + k]; if (!b) { chiado('bandpass', 1800, 600, 2, t, .01, .2 * vol, .25); return; } var s = A.createBufferSource(), gn = A.createGain(); s.buffer = b; gn.gain.setValueAtTime(vol, t); gn.gain.setValueAtTime(vol, t + 2.2); gn.gain.exponentialRampToValueAtTime(.0001, t + 2.5); s.connect(gn); gn.connect(mestre); s.start(t); s.stop(t + 2.6); }
    function ligarFundo() {
      var t = A.currentTime;
      var s = A.createBufferSource(); s.buffer = ruido; s.loop = true; var f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; var am = A.createGain(); am.gain.value = .5; var lfo = A.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 10.5; var lg = A.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(am.gain);
      var hum = A.createOscillator(); hum.type = 'sine'; hum.frequency.value = 52; var hg = A.createGain(); hg.gain.value = .25; hum.connect(hg); hg.connect(am);
      var vol = A.createGain(); vol.gain.setValueAtTime(.0001, t); vol.gain.exponentialRampToValueAtTime(.42, t + 1.5); s.connect(f); f.connect(am); am.connect(vol); vol.connect(mestre); s.start(t); lfo.start(t); hum.start(t);
      rotor = { vol: vol, lfo: lfo, parar: function () { var a = A.currentTime; vol.gain.cancelScheduledValues(a); vol.gain.setValueAtTime(vol.gain.value, a); vol.gain.exponentialRampToValueAtTime(.0001, a + .8); [s, lfo, hum].forEach(function (x) { x.stop(a + .9); }); } };
      var bus = A.createGain(); bus.gain.setValueAtTime(.0001, t); bus.gain.exponentialRampToValueAtTime(.5, t + 2); var lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; bus.connect(lp); lp.connect(mestre);
      var notas = [55, 55, 65.4, 55, 49, 49, 58.3, 61.7], batida = 60 / 126, prox = t + .9, k = 0, vivoC = true;
      (function agenda() { if (!vivoC) return; while (prox < A.currentTime + .3) { var nn = notas[k % 8] * (estrago.ab + estrago.pr >= 4 ? 1.122 : 1); osc('sawtooth', nn, nn, prox, .005, .22, batida * .7, bus); osc('sine', nn / 2, nn / 2, prox, .005, .3, batida * .5, bus); chiado('highpass', 7000, 7000, .7, prox + batida / 2, .001, .05 + .012 * Math.min(estrago.pr + estrago.ab, 8), .03, bus); if (k % 4 === 0) chiado('lowpass', 180, 120, 1, prox, .002, .25, .12, bus); prox += batida; k++; } setTimeout(agenda, 90); })();
      cama = { bus: bus, lp: lp, parar: function () { vivoC = false; var a = A.currentTime; bus.gain.cancelScheduledValues(a); bus.gain.setValueAtTime(bus.gain.value, a); bus.gain.exponentialRampToValueAtTime(.0001, a + .6); } };
    }
    function abaixar(seg) { if (!A || !rotor) return; var a = A.currentTime; [rotor.vol.gain, cama.bus.gain].forEach(function (p, i) { p.cancelScheduledValues(a); p.setValueAtTime(Math.max(.0001, p.value), a); p.linearRampToValueAtTime(i ? .18 : .16, a + .12); p.setValueAtTime(i ? .18 : .16, a + seg); p.linearRampToValueAtTime(i ? .5 : .42, a + seg + .5); }); }

    // ----- tempo
    function ritmo(t) {
      for (var i = 0; i < R.lentos.length; i++) { var l = R.lentos[i]; if (t >= l[0] && t < l[1]) return [l[2], 'lento']; }
      var v = R.vel[clamp(Math.floor(t * 2), 0, R.vel.length - 1)];
      return [v, v >= 5 ? 'rapido' : 'normal'];
    }

    // ----- posições
    function pos(i, t) { var a = clamp(Math.floor(t), 0, FIM), b = Math.min(FIM, a + 1), f = clamp(t - a, 0, 1); var P = D.pos[i][a], Q = D.pos[i][b]; return [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f]; }
    function vivo(i, t) { return D.vivo[i][clamp(Math.round(t), 0, FIM)]; }

    // ----- terreno pré-desenhado (árvores e trilhas de verdade do site)
    var g = cv.getContext('2d'), W = cv.width, H = cv.height;
    var S = 10, M0 = 61, M1 = 195, TAM = (M1 - M0) * S;
    var terra = document.createElement('canvas'); terra.width = terra.height = TAM;
    (function () {
      var t = terra.getContext('2d');
      var gr = t.createLinearGradient(0, TAM, TAM, 0); gr.addColorStop(0, '#46603a'); gr.addColorStop(.46, '#4f6040'); gr.addColorStop(.54, '#5a4f3c'); gr.addColorStop(1, '#5a4234');
      t.fillStyle = gr; t.fillRect(0, 0, TAM, TAM);
      function P(x, y) { return [(x - M0) * S, (M1 - y) * S]; }
      t.strokeStyle = '#2c5f7a'; t.lineWidth = 7 * S; t.lineCap = 'round'; t.beginPath(); var a = P(70, 182), b = P(128, 128), c = P(186, 70); t.moveTo(a[0], a[1]); t.quadraticCurveTo(b[0] - 10 * S, b[1] - 6 * S, b[0], b[1]); t.quadraticCurveTo(b[0] + 10 * S, b[1] + 6 * S, c[0], c[1]); t.stroke();
      if (ctx.tri) { var tb = atob(ctx.tri), tri = new Uint8Array(134 * 134); for (var k = 0; k < tb.length; k++) { var v = tb.charCodeAt(k); tri[2 * k] = v >> 4; tri[2 * k + 1] = v & 15; }
        for (var j = 0; j < 134; j++) for (var i = 0; i < 134; i++) { var q = tri[j * 134 + i]; if (q < 3) continue; t.fillStyle = 'rgba(150,122,82,' + Math.min(.75, q / 16) + ')'; var p = P(M0 + i, M0 + j + 1); t.fillRect(p[0], p[1], S + 1, S + 1); } }
      if (ctx.arv) { var ab = atob(ctx.arv), r = 0; var rnd = function () { r = (r * 16807 + 11) % 2147483647; return r / 2147483647; };
        for (j = 0; j < 268; j++) for (i = 0; i < 268; i++) { var n = j * 268 + i; if (!((ab.charCodeAt(n >> 3) >> (7 - (n & 7))) & 1)) continue;
          var x = M0 + i * .5 + .25, y = M0 + j * .5 + .25, pp = P(x, y), rr = S * (.42 + rnd() * .18);
          t.fillStyle = 'rgba(0,0,0,.35)'; t.beginPath(); t.arc(pp[0] + S * .18, pp[1] + S * .22, rr, 0, 7); t.fill();
          var dire = x + y > 258; t.fillStyle = dire ? (rnd() > .5 ? '#3b4a2a' : '#46553a') : (rnd() > .5 ? '#2f5228' : '#3a6232'); t.beginPath(); t.arc(pp[0], pp[1], rr, 0, 7); t.fill(); } }
      t.fillStyle = 'rgba(90,70,55,.55)'; var bd = P(160, 196); t.fillRect(bd[0], bd[1], 36 * S, 36 * S);
      t.fillStyle = 'rgba(70,90,60,.45)'; var br = P(60, 96); t.fillRect(br[0], br[1], 36 * S, 36 * S);
    })();

    // ----- legendas (GC)
    var GC = [[0, heroi + (D.final ? ' · na base dos ' : ' · na caça aos ') + inimigo]];
    var cAbG = 0;
    D.abates.forEach(function (k) { if (k[1] === NAK) { cAbG++; GC.push([k[0], heroi + ' · ' + cAbG + (cAbG > 1 ? ' abates' : ' abate') + ' na perseguição']); } });
    D.est.forEach(function (e) {
      if (e[4] === null || e[4] < 0) return; if ((e[0].indexOf('goodguys') === 0) === D.radiant) return;
      var mir = D.pred.some(function (p) { return Math.abs(p[0] - e[4]) < 1 && p[1] === NAK; });
      var oq = e[3] === 'fort' ? 'o trono' : e[3] === 'rax' ? 'o quartel' : e[5] ? 'a torre do trono' : 'a torre';
      GC.push([e[4], e[3] === 'fort' ? heroi + ' · derrubou o trono' + (ctx.fatia ? ' · ' + Math.round(ctx.fatia * 100) + '% do mérito' : '') : mir ? heroi + ' · derrubou ' + oq : oq.replace(/^a |^o /, function (x) { return x.toUpperCase(); }) + ' dos ' + inimigo + ' no chão']);
    });
    GC.sort(function (a, b) { return a[0] - b[0]; });
    var CARIMBO = { torre: 'TORRE NO CHÃO', rax: 'QUARTEL NO CHÃO', fort: 'O TRONO CAIU' };
    var primeiraQueda = D.est.filter(function (e) { return e[4] !== null && e[4] >= 0; }).map(function (e) { return e[4]; }).sort(function (a, b) { return a - b; })[0];

    // ----- estado
    var FX = [], ICONES = {}; // forma genérica (efeitos) desligada em 06/11 a pedido do Mat: só desenho próprio (ASSIN)
    // desenhos próprios das skills, os mesmos do replay do site (ASSIN no index.html), num SVG por cima do canvas;
    // a forma genérica (efeitos) fica só para as skills que ainda não têm desenho
    var RX = null;
    if (ctx.fxReplay) { try { RX = ctx.fxReplay(D.T0 - 3, D.T0 + D.N); } catch (e) { RX = null; if (window.console) console.error('plantao fx', e); } }
    if (RX) {
      RX.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); RX.svg.setAttribute('preserveAspectRatio', 'none'); RX.svg.classList.add('pl-fx'); RX.svg.setAttribute('aria-hidden', 'true');
      cv.after(RX.svg);
      FX = FX.filter(function (o) { return !RX.tem(o.key); });
    }
    function fxReplay(t, dx, dy, bal) {
      if (!RX) return;
      var L = M1 - M0, a = zoom * L / 100, e = W / 2 + (M0 - cam[0]) * zoom, f = H / 2 - (M1 - cam[1]) * zoom, tk = {};
      for (var i = 0; i < 10; i++) { if (!D.pos[i] || !vivo(i, t)) continue; var q = pos(i, t); tk[D.ordem[i].idx] = [(q[0] - M0) / L * 100, 100 - (q[1] - M0) / L * 100]; }
      var tr = 'translate(' + (W / 2 + dx).toFixed(2) + ',' + (H / 2 + dy).toFixed(2) + ') rotate(' + (bal * 57.2958).toFixed(3) + ') translate(' + (-W / 2) + ',' + (-H / 2) + ') translate(' + e.toFixed(2) + ',' + f.toFixed(2) + ') scale(' + a.toFixed(4) + ')';
      try { RX.irPara(D.T0 + t, tk, tr, W / (100 * a)); } catch (er) { RX.svg.remove(); RX = null; }
    }
    function icone(k, tipo) { if (!ICONES[k]) { var im = new Image(); im.src = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/' + (tipo === 'i' ? 'items' : 'abilities') + '/' + k + '.png'; ICONES[k] = im; } return ICONES[k]; }
    D.ev.forEach(function (e) { if (e[2] !== 'tpscroll') icone(e[2], e[3]); });
    var imgs = D.herois.map(function (s) { var i = new Image(); i.src = BASE + 'img/herois/' + s + '.png'; return i; });
    var parts = [], carimbos = [], cam = null, zoom = W / 27, tela = null, placar = D.placar0.slice(), estrago = { ab: 0, pr: 0 };
    function tl(p) { return [W / 2 + (p[0] - cam[0]) * zoom, H / 2 - (p[1] - cam[1]) * zoom]; }
    function explosao(x, y, forte) { for (var k = 0; k < (forte ? 90 : 40); k++) { var a = Math.random() * 7, v = (forte ? 9 : 5) * (.3 + Math.random()); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0, max: .6 + Math.random() * (forte ? 1.6 : .9), tipo: Math.random() < .5 ? 'fogo' : 'caco' }); }
      for (k = 0; k < (forte ? 26 : 12); k++) parts.push({ x: x + (Math.random() - .5) * 2, y: y + (Math.random() - .5) * 2, vx: (Math.random() - .5) * .8, vy: .6 + Math.random(), vida: 0, max: 2.6 + Math.random() * 2, tipo: 'fumaca' });
      parts.push({ x: x, y: y, vx: 0, vy: 0, vida: 0, max: forte ? 1.2 : .7, tipo: 'onda', forte: forte }); }

    var ultimoModo = 'normal', tocando = false;
    function disparar(a, b) {
      if (!A || !tocando) return; var t = A.currentTime + .02;
      var md = ritmo(b)[1];
      if (md !== ultimoModo) { if (md === 'lento') { vuum(t, true); abafa.frequency.cancelScheduledValues(t); abafa.frequency.setValueAtTime(18000, t); abafa.frequency.exponentialRampToValueAtTime(1400, t + .25); if (rotor) rotor.lfo.frequency.setTargetAtTime(4, t, .1); }
        else { if (ultimoModo === 'lento') { abafa.frequency.setTargetAtTime(18000, t, .08); vuum(t, false); } if (rotor) rotor.lfo.frequency.setTargetAtTime(md === 'rapido' ? 15 : 10.5, t, .2); if (md === 'rapido') fitaRapida(t); }
        ultimoModo = md; }
      var cruza = function (x) { return x > a && x <= b; };
      var nSons = 0;
      D.ev.forEach(function (e) { if (!cruza(e[0]) || e[2] === 'tpscroll' || nSons > 2) return; var q = pos(e[1], e[0]); if (e[1] !== NAK && (!cam || Math.hypot(q[0] - cam[0], q[1] - cam[1]) > 22)) return; nSons++; somHab(e[2], t + nSons * .04, e[1] === NAK ? .75 : .4); });
      D.abates.forEach(function (k) { if (!cruza(k[0])) return; if (k[1] === NAK) { pancada(t, 1.1); moedas(t, 6); sino(t + .05); } else pancada(t, .55); plim(t + .25); });
      D.est.forEach(function (e) { if (e[4] === null || e[4] < 0 || !cruza(e[4])) return; desmorona(t, e[3] === 'fort'); if (e[3] === 'fort') { if (cama) cama.parar(); fanfarraFinal(t + .5); if (rotor) rotor.vol.gain.setTargetAtTime(.12, t, .5); } });
      FALAS.forEach(function (f) {
        if (!cruza(f[0])) return; radio(t);
        // a fala do lance é 1 a 3 falas inteiras do banco, tocadas em sequência com um respiro entre elas
        var bs = f[2].map(function (id) { return buf['voz' + id]; }).filter(Boolean);
        if (vozAtual) vozAtual.fontes.forEach(function (x) { try { x.g.gain.setTargetAtTime(.0001, t, .05); x.s.stop(t + .3); } catch (e) { /* já parou */ } });
        if (!bs.length) { abaixar(2); return; }
        var at = t + .12, fontes = [];
        bs.forEach(function (b, k) { var s = A.createBufferSource(), gv = A.createGain(); s.buffer = b; s.connect(gv); gv.connect(saidaVoz); s.start(at); fontes.push({ s: s, g: gv });
          if (k) (function (txt, quando) { setTimeout(function () { if (tocando) mostrarFala(txt); }, quando); })(TEXTOS[f[2][k]], (at - A.currentTime) * 1000);
          at += b.duration + (k < bs.length - 1 ? .28 : 0); });
        var meu = { fontes: fontes, fim: at }; vozAtual = meu; abaixar(at - t);
        setTimeout(function () { if (A && vozAtual === meu) radio(A.currentTime, true); }, (at - t + .05) * 1000);
      });
      if (primeiraQueda != null && cruza(primeiraQueda + 0.2)) sirene(t + .2, 3.2, .05);
      if (cama) { var fx = 700 + Math.min(8, estrago.ab + estrago.pr) * 260; cama.lp.frequency.setTargetAtTime(fx, t, .3); }
    }

    // ----- quadro
    var barra = 0, fimHold = 0;
    var linhas = document.createElement('canvas'); linhas.width = W; linhas.height = H; (function () { var lg = linhas.getContext('2d'); lg.fillStyle = 'rgba(0,0,0,.08)'; for (var y = 0; y < H; y += 4) lg.fillRect(0, y, W, 1); })();
    var grao = document.createElement('canvas'); grao.width = W; grao.height = H; (function () { var gg = grao.getContext('2d'), id = gg.createImageData(W, H), s = 7; for (var p = 0; p < id.data.length; p += 4) { s = (s * 16807) % 2147483647; var v = s / 2147483647 * 255; id.data[p] = id.data[p + 1] = id.data[p + 2] = v; id.data[p + 3] = 22; } gg.putImageData(id, 0, 0); })();
    var nomeAlvo = ('ALVO: ' + nick).toUpperCase(), subAlvo = (heroi + ' · procurado').toUpperCase();
    function quadro(t, ms, dt) {
      var md = ritmo(t)[1];
      var alvo = pos(NAK, t); if (!cam) cam = alvo.slice(); var seg = md === 'rapido' ? .1 : .06; cam[0] += (alvo[0] - cam[0]) * seg; cam[1] += (alvo[1] - cam[1]) * seg;
      var zAlvo = W / (md === 'lento' ? 20 : md === 'rapido' ? 36 : 27); zoom += (zAlvo - zoom) * .05;
      var bal = Math.sin(ms / 900) * .012, dx = Math.sin(ms / 1300) * 7, dy = Math.cos(ms / 1700) * 6;
      fxReplay(t, dx, dy, bal);
      g.save(); g.fillStyle = '#1a2414'; g.fillRect(0, 0, W, H);
      g.translate(W / 2 + dx, H / 2 + dy); g.rotate(bal); g.translate(-W / 2, -H / 2);
      var mw = W * .6 / zoom, mh = H * .6 / zoom, x0 = Math.max(M0, cam[0] - mw), x1 = Math.min(M1, cam[0] + mw), y0 = Math.max(M0, cam[1] - mh), y1 = Math.min(M1, cam[1] + mh);
      if (x1 > x0 && y1 > y0) { var d0 = tl([x0, y1]), d1 = tl([x1, y0]); g.drawImage(terra, (x0 - M0) * S, (M1 - y1) * S, (x1 - x0) * S, (y1 - y0) * S, d0[0], d0[1], d1[0] - d0[0], d1[1] - d0[1]); }
      D.est.forEach(function (e) {
        var s = tl([e[1], e[2]]); if (s[0] < -80 || s[0] > W + 80 || s[1] < -80 || s[1] > H + 80) return;
        var caiu = e[4] !== null && (e[4] < 0 || t >= e[4]); var dire = e[0].indexOf('bad') === 0; var z = (e[3] === 'fort' ? 4.6 : e[3] === 'rax' ? 2.6 : 1.9) * zoom;
        if (caiu) { g.fillStyle = 'rgba(40,32,26,.28)'; g.beginPath(); g.ellipse(s[0], s[1], z * .45, z * .34, 0, 0, 7); g.fill(); g.fillStyle = '#6b6058'; for (var k = 0; k < 7; k++) { var a = k * 2.1 + e[1]; g.fillRect(s[0] + Math.cos(a) * z * .4, s[1] + Math.sin(a) * z * .3, z * .18, z * .12); } return; }
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(s[0] - z / 2 + z * .18, s[1] - z / 2 + z * .22, z, z);
        g.fillStyle = dire ? '#5c3a32' : '#3d5a3a';
        if (e[3] === 'fort') { g.beginPath(); for (var q = 0; q < 6; q++) { var an = q / 6 * Math.PI * 2; g.lineTo(s[0] + Math.cos(an) * z * .6, s[1] + Math.sin(an) * z * .6); } g.closePath(); g.fill(); g.fillStyle = dire ? '#c0402e' : '#7fd36a'; g.beginPath(); g.arc(s[0], s[1], z * .22, 0, 7); g.fill(); }
        else { g.fillRect(s[0] - z / 2, s[1] - z / 2, z, z); g.fillStyle = dire ? '#8a4a3a' : '#5f8a52'; g.fillRect(s[0] - z * .3, s[1] - z * .3, z * .6, z * .6); }
      });
      D.abates.forEach(function (k) { var age = t - k[0]; if (age < 0 || age > 5) return; var s = tl(pos(k[2], k[0])); g.globalAlpha = Math.min(1, (5 - age)); g.fillStyle = '#fff'; g.font = '700 26px Archivo,sans-serif'; g.textAlign = 'center'; g.fillText('✕', s[0], s[1] + 9); g.globalAlpha = 1; });
      D.dano.forEach(function (e) { var age = t - e[0]; if (age < 0 || age > 1.3) return; var nk = e[1] === NAK; if (!nk && e[3] < 150) return; var s = tl(pos(e[2], e[0])); g.globalAlpha = 1 - age / 1.3; g.fillStyle = nk ? '#ffd23f' : 'rgba(255,255,255,.85)'; g.font = '800 ' + (nk ? (e[3] > 900 ? 40 : 28) : 17) + 'px Archivo,sans-serif'; g.textAlign = 'center'; g.fillText('-' + Math.round(e[3]).toLocaleString('pt-BR'), s[0] + ((e[2] * 13 + e[0] * 7) % 34 - 17), s[1] - 30 - age * 34); g.globalAlpha = 1; });
      // skills de todo mundo, com a forma do que a skill fez (ver efeitos)
      g.save(); g.shadowBlur = 14; // brilho nas skills
      FX.forEach(function (o) {
        g.shadowColor = o.tipo === 'u' ? '#ffd23f' : o.i < 5 ? '#7fd3ff' : '#ff7a59';
        var age = t - o.t, fim = o.forma === 'area' || o.forma === 'proj' ? (o.th - o.t) + 1.1 : 1.3; if (age < 0 || age > fim) return;
        var ult = o.tipo === 'u', cor = ult ? '255,210,63' : o.i < 5 ? '127,211,255' : '255,122,89', a1 = 1 - age / fim;
        var s0 = tl(pos(o.i, o.t)), R2 = o.i === NAK ? 28 : 21;
        if (o.forma === 'salto') { var p0 = tl(o.de), p1 = tl(o.para); g.strokeStyle = 'rgba(' + cor + ',' + (.8 * a1) + ')'; g.lineWidth = 4; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); g.setLineDash([]);
          [p0, p1].forEach(function (q, k) { g.fillStyle = 'rgba(' + cor + ',' + (.45 * a1) + ')'; g.beginPath(); g.arc(q[0], q[1], R2 * (1 + age * (k ? 1.4 : 2.2)), 0, 7); g.fill(); }); return; }
        if (o.forma === 'aura') { g.strokeStyle = 'rgba(' + cor + ',' + a1 + ')'; g.lineWidth = ult ? 6 : 3; var rr = R2 + 6 + age * (ult ? 70 : 34); g.beginPath(); g.arc(s0[0], s0[1], rr, 0, 7); g.stroke(); if (ult) { g.fillStyle = 'rgba(' + cor + ',' + (.18 * a1) + ')'; g.fill(); } return; }
        if (o.forma === 'alvo') { var q = tl(pos(o.alvo, o.t + Math.min(age, .8))); g.strokeStyle = 'rgba(' + cor + ',' + (.9 * a1) + ')'; g.lineWidth = ult ? 5 : 3; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]); g.strokeStyle = 'rgba(' + cor + ',' + a1 + ')'; g.beginPath(); g.arc(q[0], q[1], 26 + 6 * Math.sin(age * 12), 0, 7); g.stroke(); return; }
        var ida = Math.max(.12, o.th - o.t), k2 = clamp(age / ida, 0, 1), dep = age - ida;
        if (o.forma === 'proj' || o.forma === 'golpe') {
          var v = o.vit[0], dv = tl(pos(v.i, o.t + Math.min(age, ida))), sc = tl(pos(o.i, o.t)), hx = sc[0] + (dv[0] - sc[0]) * k2, hy = sc[1] + (dv[1] - sc[1]) * k2;
          if (o.forma === 'proj' && k2 < 1) { var gr = g.createLinearGradient(sc[0] + (dv[0] - sc[0]) * Math.max(0, k2 - .35), sc[1] + (dv[1] - sc[1]) * Math.max(0, k2 - .35), hx, hy); gr.addColorStop(0, 'rgba(' + cor + ',0)'); gr.addColorStop(1, 'rgba(' + cor + ',.95)'); g.strokeStyle = gr; g.lineWidth = ult ? 10 : 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(sc[0] + (dv[0] - sc[0]) * Math.max(0, k2 - .35), sc[1] + (dv[1] - sc[1]) * Math.max(0, k2 - .35)); g.lineTo(hx, hy); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(hx, hy, ult ? 9 : 6, 0, 7); g.fill(); }
          if (dep >= 0) { var b2 = clamp(1 - dep / 1, 0, 1); g.strokeStyle = 'rgba(' + cor + ',' + b2 + ')'; g.lineWidth = ult ? 6 : 4; g.beginPath(); g.arc(dv[0], dv[1], 24 + dep * (ult ? 70 : 44), 0, 7); g.stroke();
            for (var r3 = 0; r3 < 6; r3++) { var an = r3 * 1.047 + o.t; g.strokeStyle = 'rgba(255,255,255,' + b2 + ')'; g.lineWidth = 2; g.beginPath(); g.moveTo(dv[0] + Math.cos(an) * (22 + dep * 30), dv[1] + Math.sin(an) * (22 + dep * 30)); g.lineTo(dv[0] + Math.cos(an) * (34 + dep * 60), dv[1] + Math.sin(an) * (34 + dep * 60)); g.stroke(); } }
          return;
        }
        if (o.forma === 'area') {
          var c = tl(o.c), R = o.r * zoom;
          if (dep < 0) { g.strokeStyle = 'rgba(' + cor + ',' + (.5 + .5 * k2) + ')'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); g.arc(c[0], c[1], R * (1.15 - .15 * k2), 0, 7); g.stroke(); g.setLineDash([]); g.strokeStyle = 'rgba(' + cor + ',.6)'; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(c[0], c[1]); g.stroke(); return; }
          var b3 = clamp(1 - dep / 1.1, 0, 1); g.fillStyle = 'rgba(' + cor + ',' + (.32 * b3) + ')'; g.beginPath(); g.arc(c[0], c[1], R * (1 + dep * .25), 0, 7); g.fill(); g.strokeStyle = 'rgba(' + cor + ',' + b3 + ')'; g.lineWidth = ult ? 7 : 4; g.stroke();
          if (ult) for (var st = 0; st < 10; st++) { var an2 = st * .63 + dep * 3, rr2 = R * (.3 + (st % 3) * .25); g.fillStyle = 'rgba(255,255,255,' + b3 + ')'; g.beginPath(); g.arc(c[0] + Math.cos(an2) * rr2, c[1] + Math.sin(an2) * rr2 - 40 * (1 - Math.min(1, dep * 4)), 4, 0, 7); g.fill(); }
          o.vit.forEach(function (v) { if (t < v.t) return; var q = tl(pos(v.i, v.t)); g.strokeStyle = 'rgba(255,255,255,' + b3 + ')'; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], 26 + dep * 20, 0, 7); g.stroke(); });
        }
      });
      g.restore();
      for (var i = 0; i < 10; i++) {
        if (!D.pos[i] || !vivo(i, t)) continue; var s = tl(pos(i, t)), R2 = i === NAK ? 28 : 21; if (s[0] < -40 || s[0] > W + 40 || s[1] < -40 || s[1] > H + 40) continue;
        var levou = D.dano.some(function (e) { return e[2] === i && t - e[0] >= 0 && t - e[0] < .25; });
        g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(s[0] + 6, s[1] + 8, R2, R2 * .7, 0, 0, 7); g.fill();
        g.save(); g.beginPath(); g.arc(s[0], s[1], R2, 0, 7); g.clip(); if (imgs[i].complete && imgs[i].naturalWidth) g.drawImage(imgs[i], s[0] - R2 * 1.78, s[1] - R2 * 1.1, R2 * 3.56, R2 * 2); else { g.fillStyle = '#888'; g.fill(); } if (levou) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(s[0] - R2, s[1] - R2, R2 * 2, R2 * 2); } g.restore();
        g.lineWidth = 3; g.strokeStyle = i < 5 ? '#5fe36a' : '#ff4d4d'; g.beginPath(); g.arc(s[0], s[1], R2, 0, 7); g.stroke();
        // ícone da skill no pé do retrato (como no replay do site), por 1,8 s
        var npop = 0;
        for (var u = 0; u < D.ev.length; u++) { var e = D.ev[u], idade = t - e[0]; if (e[1] !== i || idade < 0 || idade > 1.8 || e[2] === 'tpscroll') continue;
          var lado = (e[3] === 'u' ? 34 : 27) * (i === NAK ? 1.15 : 1), px = s[0] + R2 * .62 + npop * (lado + 3), py = s[1] + R2 * .55; npop++;
          g.globalAlpha = idade > 1.5 ? (1.8 - idade) / .3 : Math.min(1, idade * 8); var sc2 = idade < .12 ? 1.5 - idade * 4 : 1;
          g.save(); g.translate(px, py); g.scale(sc2, sc2); g.fillStyle = '#0b0d14'; g.fillRect(-lado / 2 - 2, -lado / 2 - 2, lado + 4, lado + 4);
          var ic = icone(e[2], e[3]); if (ic.complete && ic.naturalWidth) g.drawImage(ic, -lado / 2, -lado / 2, lado, lado); else { g.fillStyle = '#334'; g.fillRect(-lado / 2, -lado / 2, lado, lado); g.fillStyle = '#fff'; g.font = '700 11px Archivo,sans-serif'; g.textAlign = 'center'; g.fillText(e[5].slice(0, 2), 0, 4); }
          g.strokeStyle = e[3] === 'u' ? '#ffd23f' : e[3] === 'i' ? '#c9c9c9' : '#fff'; g.lineWidth = e[3] === 'u' ? 3 : 2; g.strokeRect(-lado / 2 - 1, -lado / 2 - 1, lado + 2, lado + 2); g.restore(); g.globalAlpha = 1; }
      }
      for (var p = parts.length - 1; p >= 0; p--) { var q2 = parts[p]; q2.vida += dt; if (q2.vida > q2.max) { parts.splice(p, 1); continue; } var ss = tl([q2.x, q2.y]), f = q2.vida / q2.max;
        if (q2.tipo === 'onda') { g.strokeStyle = 'rgba(255,230,180,' + (1 - f) + ')'; g.lineWidth = q2.forte ? 8 : 5; g.beginPath(); g.arc(ss[0], ss[1], f * (q2.forte ? 16 : 8) * zoom, 0, 7); g.stroke(); continue; }
        q2.x += q2.vx * dt; q2.y += q2.vy * dt; q2.vx *= .96; q2.vy *= .96;
        if (q2.tipo === 'fumaca') { g.fillStyle = 'rgba(60,55,52,' + (.5 * (1 - f)) + ')'; g.beginPath(); g.arc(ss[0], ss[1], (1 + f * 3) * zoom * .5, 0, 7); g.fill(); }
        else if (q2.tipo === 'fogo') { g.fillStyle = 'rgba(255,' + (200 - f * 150 | 0) + ',60,' + (1 - f) + ')'; g.beginPath(); g.arc(ss[0], ss[1], (1 - f) * 7 + 2, 0, 7); g.fill(); }
        else { g.fillStyle = 'rgba(140,120,100,' + (1 - f) + ')'; g.fillRect(ss[0], ss[1], 4, 4); } }
      g.restore();
      var m = tl(pos(NAK, t)); m = [m[0] + dx, m[1] + dy]; tela = m;
      var hx = m[0] + Math.sin(ms / 700) * 14, hy = m[1] + Math.cos(ms / 830) * 10;
      var hol = g.createRadialGradient(hx, hy, H * .09, hx, hy, H * .42); hol.addColorStop(0, 'rgba(4,8,18,0)'); hol.addColorStop(.6, 'rgba(4,8,18,.22)'); hol.addColorStop(1, 'rgba(4,8,18,.5)'); g.fillStyle = hol; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter'; var luz = g.createRadialGradient(hx, hy, 0, hx, hy, H * .16); luz.addColorStop(0, 'rgba(255,240,200,.16)'); luz.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = luz; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
      g.drawImage(grao, (ms / 40 | 0) % 7 - 3, (ms / 30 | 0) % 5 - 2);
      g.drawImage(linhas, 0, 0);
      var faixa = md === 'lento' ? H * .08 : 0; barra += (faixa - barra) * .15; if (barra > 1) { g.fillStyle = '#000'; g.fillRect(0, 0, W, barra); g.fillRect(0, H - barra, W, barra); }
      var z = 50 + Math.sin(ms / 200) * 3; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { g.beginPath(); g.moveTo(m[0] + q[0] * z, m[1] + q[1] * (z - 15)); g.lineTo(m[0] + q[0] * z, m[1] + q[1] * z); g.lineTo(m[0] + q[0] * (z - 15), m[1] + q[1] * z); g.stroke(); });
      var ladoTxt = m[0] > W * .62 ? 'right' : 'left', ox = ladoTxt === 'left' ? m[0] + z + 8 : m[0] - z - 8;
      g.fillStyle = '#fff'; g.font = '700 16px "JetBrains Mono",monospace'; g.textAlign = ladoTxt; g.fillText(nomeAlvo, ox, m[1] - z + 12); g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '500 13px "JetBrains Mono",monospace'; g.fillText(subAlvo, ox, m[1] - z + 30);
      for (i = 5; i < 10; i++) { if (!D.pos[i] || !vivo(i, t)) continue; var se = tl(pos(i, t)); se = [se[0] + dx, se[1] + dy]; var dd = Math.hypot(se[0] - m[0], se[1] - m[1]); if (dd > H * .38 || dd < 20) continue; g.strokeStyle = 'rgba(255,77,77,.9)'; g.lineWidth = 2; var zz = 24; g.strokeRect(se[0] - zz, se[1] - zz, zz * 2, zz * 2); g.fillStyle = 'rgba(255,120,120,.95)'; g.font = '600 12px "JetBrains Mono",monospace'; g.textAlign = 'center'; g.fillText(D.heroiNome[i].toUpperCase(), se[0], se[1] + zz + 14); }
      var topoY = Math.max(barra, 0) + 30; g.font = '600 17px "JetBrains Mono",monospace'; g.fillStyle = '#fff'; g.textAlign = 'left';
      g.fillText('CÂMERA AÉREA 1', 20, topoY); if ((ms / 600 | 0) % 2) { g.fillStyle = '#ff3030'; g.beginPath(); g.arc(26, topoY + 22, 7, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.fillText('REC  ' + mmss(D.T0 + t), 40, topoY + 28);
      g.textAlign = 'right'; g.fillText('ALT ' + (318 + Math.round(Math.sin(ms / 2400) * 6)) + ' m', W - 20, topoY); var ap = pos(NAK, t); g.fillText('X ' + ap[0].toFixed(1) + '  Y ' + ap[1].toFixed(1), W - 20, topoY + 28);
      var base = H - Math.max(barra, 0) - 20; g.textAlign = 'left';
      var tag = md === 'lento' ? 'CÂMERA LENTA' : md === 'rapido' ? '▶▶ ACELERADO ' + ritmo(t)[0] + 'x' : 'AO VIVO'; g.fillStyle = md === 'lento' ? '#ffd23f' : md === 'rapido' ? '#9fd8ff' : '#fff'; g.fillText(tag, 20, base);
      g.fillStyle = '#fff'; g.textAlign = 'right';
      var naBase = forte && Math.hypot(ap[0] - forte[1], ap[1] - forte[2]) < 26;
      g.fillText((naBase ? 'DENTRO DA BASE DOS ' : 'A CAMINHO DA BASE DOS ') + inimigo.toUpperCase(), W - 20, base);
      for (var c = carimbos.length - 1; c >= 0; c--) { var cb = carimbos[c]; cb.vida += dt; if (cb.vida > cb.max) { carimbos.splice(c, 1); continue; } var f2 = cb.vida / cb.max, es = cb.vida < .15 ? 1.6 - cb.vida * 4 : 1;
        g.save(); g.translate(W / 2, H * .3); g.rotate(-.06); g.scale(es, es); g.globalAlpha = f2 > .8 ? (1 - f2) * 5 : 1; g.font = '400 ' + (cb.grande ? 78 : 54) + 'px Anton,Impact,sans-serif'; g.textAlign = 'center'; var wv = g.measureText(cb.txt).width + 40;
        g.fillStyle = cb.cor; g.fillRect(-wv / 2, -(cb.grande ? 70 : 50), wv, cb.grande ? 92 : 66); g.fillStyle = '#fff'; g.fillText(cb.txt, 0, cb.grande ? 6 : 2); if (cb.sub) { g.font = '700 20px Archivo,sans-serif'; g.fillStyle = '#fff'; g.fillText(cb.sub, 0, cb.grande ? 52 : 44); } g.restore(); }
      if (t >= FIM - 0.01 && fimHold > 0) { var ff = Math.min(1, fimHold / 1.2); g.fillStyle = 'rgba(8,10,20,' + (.55 * ff) + ')'; g.fillRect(0, 0, W, H); g.globalAlpha = ff; g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.font = '400 64px Anton,Impact,sans-serif'; g.fillText('FIM DA PERSEGUIÇÃO', W / 2, H * .46); g.fillStyle = '#fff'; g.font = '700 24px Archivo,sans-serif';
        g.fillText(nick + (kda ? ' · ' + kda : '') + ' · ' + estrago.pr + (estrago.pr === 1 ? ' prédio' : ' prédios') + ' e ' + estrago.ab + (estrago.ab === 1 ? ' abate' : ' abates') + ' em 2 minutos', W / 2, H * .46 + 40); g.globalAlpha = 1; }
    }

    // ----- eventos visuais + DOM
    function eventos(a, b) {
      var cruza = function (x) { return x > a && x <= b; };
      D.abates.forEach(function (k) { if (!cruza(k[0])) return; var rad = (k[1] < 5) === D.radiant; if (rad) placar[0]++; else placar[1]++; pulsar(rad ? nRad : nDire, placar[rad ? 0 : 1]);
        if (k[1] === NAK) { estrago.ab++; pulsar(cAb, estrago.ab); carimbos.push({ txt: 'ABATE CONFIRMADO', sub: D.heroiNome[k[2]] + ' (' + String(D.nomes[k[2]]).trim() + ')', cor: '#d81e1e', vida: 0, max: 2.1 }); }
        var pv = pos(k[2], k[0]); explosao(pv[0], pv[1], false); });
      D.est.forEach(function (e) { if (e[4] === null || e[4] < 0 || !cruza(e[4])) return; explosao(e[1], e[2], e[3] === 'fort');
        var mir = D.pred.some(function (p) { return Math.abs(p[0] - e[4]) < 1 && p[1] === NAK && p[2] === e[0]; }); if (mir) { estrago.pr++; pulsar(cPr, estrago.pr); }
        carimbos.push({ txt: CARIMBO[e[3]], sub: mir ? 'último golpe de ' + heroi : '', cor: e[3] === 'fort' ? '#d81e1e' : '#1f2a44', vida: 0, max: e[3] === 'fort' ? 3.4 : 1.8, grande: e[3] === 'fort' }); });
      FALAS.forEach(function (f) { if (cruza(f[0])) mostrarFala(f[1]); });
      GC.forEach(function (x) { if (cruza(x[0])) { sub.textContent = x[1]; sub.classList.remove('nova'); void sub.offsetWidth; sub.classList.add('nova'); } });
    }
    function mostrarFala(txt) { falaTx.textContent = txt; fala.classList.remove('nova'); void fala.offsetWidth; fala.classList.add('nova'); }
    function pulsar(n, v) { n.textContent = v; n.classList.remove('pulso'); void n.offsetWidth; n.classList.add('pulso'); }

    // ----- laço
    var t = 0, ant = null;
    function reset() { t = 0; cam = null; parts = []; carimbos = []; placar = D.placar0.slice(); estrago = { ab: 0, pr: 0 }; nRad.textContent = placar[0]; nDire.textContent = placar[1]; cAb.textContent = 0; cPr.textContent = 0; sub.textContent = GC[0][1]; falaTx.textContent = ''; fimHold = 0; ultimoModo = 'normal'; }
    function loop(ms) {
      if (!tocando) return; if (!caixa.isConnected) { parar(false); return; }
      if (ant === null) ant = ms; var dt = Math.min(.1, (ms - ant) / 1000); ant = ms;
      var a = t;
      if (t < FIM) { var rr = ritmo(t)[0];
        // o locutor manda: se a fala atual ainda não acabou, o replay desacelera para a próxima fala não atropelar
        if (A && vozAtual && vozAtual.fim > A.currentTime) { var resta = vozAtual.fim - A.currentTime + .15, prox = FALAS.filter(function (f) { return f[0] > t; })[0]; if (prox) rr = Math.max(.2, Math.min(rr, (prox[0] - t) / resta)); }
        t = Math.min(FIM, t + dt * rr); eventos(a === 0 ? -1 : a, t); disparar(a === 0 ? -1 : a, t); } else fimHold += dt;
      quadro(t, ms, dt);
      if (fimHold > 5) { parar(true); return; }
      requestAnimationFrame(loop);
    }
    function tocar() {
      if (btn.disabled) return;
      ctxAudio(); if (A.state === 'suspended') A.resume();
      try { (window.dataLayer = window.dataLayer || []).push({ event: 'victory_plantao_play', victory_plantao_take: tomada }); } catch (e) { /* sem GTM */ }
      reset(); tocando = true; ant = null; btn.hidden = true; ligarFundo(); vinheta(A.currentTime + .05); requestAnimationFrame(loop);
    }
    function parar(fim) {
      tocando = false; if (vozAtual) { vozAtual.fontes.forEach(function (x) { try { x.s.stop(); } catch (e) { /* já parou */ } }); vozAtual = null; }
      if (rotor) { rotor.parar(); rotor = null; } if (cama) { cama.parar(); cama = null; }
      btn.hidden = false;
      if (fim) preparar2(); else bLbl.textContent = 'Continuar do começo';
    }
    btn.addEventListener('click', tocar);
    cv.addEventListener('click', function () { if (tocando) parar(false); });
    mudo.addEventListener('change', function () { if (mestre) { mestre.gain.setTargetAtTime(mudo.checked ? 0 : .8, A.currentTime, .05); saidaVoz.gain.setTargetAtTime(mudo.checked ? 0 : 1.1, A.currentTime, .05); } });

    // quadro parado: o primeiro abate de quem carregou (ou o meio da perseguição), para a página já mostrar a cena
    var k1 = D.abates.filter(function (k) { return k[1] === NAK; })[0], alvoT = k1 ? Math.max(0, k1[0] - .3) : FIM / 2;
    try { var qq = new URLSearchParams(location.search).get('quadro'); if (qq) { alvoT = clamp(+qq, 0, FIM); window.__plantao = { D: D, FX: FX, R: R }; } } catch (e) { /* sem URL */ } // ?quadro=<s> mostra outro instante parado (teste)
    function parado() { if (tocando) return; reset(); cam = pos(NAK, alvoT).slice(); zoom = W / 22; eventos(-1, alvoT); carimbos = []; parts = []; quadro(alvoT, 0, 0); }
    parado(); imgs.forEach(function (im) { im.addEventListener('load', parado); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(parado);

    carregarBanco().then(function (indice) { TEXTOS = indice || {}; return preparar2(); })
      .catch(function () { tempo.hidden = false; tempo.textContent = 'O locutor não carregou: a perseguição toca sem a voz.'; btn.disabled = false; bLbl.textContent = 'Assistir com som'; });
    return { parar: function () { if (tocando) parar(false); } };
  }

  function aviso(txt) { var p = document.createElement('p'); p.className = 'pl-aviso'; p.textContent = txt; return p; }

  window.Plantao = { montar: montar, preparar: preparar, roteiro: roteiro, aviso: aviso };
})();
