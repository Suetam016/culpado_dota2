// Dados do lance (luta.json) e funções comuns do replay (core.js).
// ===== Dados reais da luta + geometria do mapa compartilhada pelos 6 protótipos =====
const D = {"nomes":["Faceless Void","Pudge","Terrorblade"],"sig":["VOID","PUDGE","TB"],"team":[0,1,1],"retrato":["faceless_void","pudge","terrorblade"],"dur":33,"t0":1260,"partida":9057339159,"x":[[149.1,146.6,144.2,142.1,140.8,139.4,138.0,136.5,135.9,135.9,131.1,131.1,131.1,131.1,131.1,125.2,122.5,120.1,117.9,115.4,112.9,110.5,108.0,105.7,103.3,105.8,110.0,110.0,110.0,110.0,110.0,110.0,110.0,110.0],[185.0,185.0,127.3,127.3,127.3,126.4,126.2,128.0,130.0,130.7,131.2,131.2,131.2,131.2,131.2,131.2,128.9,126.5,124.0,122.1,120.0,118.1,116.1,114.0,111.9,109.8,108.9,108.9,108.9,108.9,108.9,108.9,108.9,108.9],[175.8,175.8,176.4,176.5,175.9,175.9,175.7,175.4,175.3,174.2,171.8,169.3,169.3,169.3,169.3,169.3,169.3,130.8,127.7,125.0,122.2,119.4,116.6,114.9,114.0,111.3,110.2,110.2,110.2,110.2,110.2,110.2,110.2,110.2]],"y":[[101.2,102.4,103.6,105.3,107.7,110.1,112.5,114.8,115.1,115.1,121.4,121.4,121.4,121.4,121.4,118.5,118.0,116.7,115.1,113.9,112.8,111.3,110.1,108.7,107.2,108.3,110.5,110.5,110.5,110.5,110.5,110.5,110.5,110.5],[175.7,175.7,129.1,129.1,129.1,126.9,125.3,123.7,122.1,121.2,120.8,120.8,120.8,120.8,120.8,120.8,121.1,121.8,122.2,120.7,119.2,117.6,116.0,114.5,113.2,111.8,110.7,110.7,110.7,110.7,110.7,110.7,110.7,110.7],[100.2,99.7,99.7,96.7,93.9,93.9,92.3,91.4,88.9,87.8,85.7,83.7,83.6,83.6,83.6,83.6,83.6,126.7,126.1,124.5,122.9,121.4,120.1,117.6,114.6,112.8,111.8,111.8,111.8,111.8,111.8,111.8,111.8,111.8]],"dano":[[9,1,0,58],[9,1,0,360],[10,0,1,141],[10,1,0,116],[10,1,0,158],[11,1,0,145],[11,1,0,158],[12,1,0,116],[12,1,0,158],[13,1,0,145],[13,1,0,158],[14,0,1,159],[14,0,1,183],[14,1,0,87],[25,0,1,121],[25,0,1,164],[25,2,0,14],[25,1,0,116],[26,0,2,119],[26,0,1,121],[26,0,1,186],[26,0,1,446],[26,2,0,28],[26,1,0,14],[26,1,0,116],[27,0,2,119],[27,0,1,183],[27,0,1,609],[27,2,0,28],[27,1,0,28],[27,1,0,145],[28,0,2,238],[28,0,1,185],[28,0,1,242],[28,0,1,587],[28,2,0,28],[28,1,0,116],[29,0,1,561],[29,2,0,28],[29,1,0,14],[29,1,0,145],[30,0,1,121],[30,0,1,210],[30,0,1,454],[30,2,0,28],[30,1,0,87],[31,0,2,119],[31,2,0,28],[31,2,0,82],[32,2,0,28],[32,2,0,189],[33,2,0,28],[33,2,0,364]],"usos":[[7.0,0,"Town Portal Scroll","i",-1],[8.0,1,"Meat Hook","h",-1],[9.0,1,"Rot","h",-1],[10.0,1,"Dismember","u",0],[11.0,2,"Town Portal Scroll","i",-1],[14.0,0,"Time Walk","h",-1],[14.0,1,"Meat Shield","h",-1],[15.0,1,"Rot","h",-1],[24.0,0,"Time Walk","h",-1],[25.0,0,"Chronosphere","u",-1],[25.0,2,"Manta Style","i",-1],[25.0,1,"Rot","h",-1],[30.0,2,"Reflection","h",-1],[31.0,2,"Conjure Image","h",-1],[31.0,2,"Heaven's Halberd","i",0]]};
const NOMES = D.nomes || ['Kez','Witch Doctor','Tidehunter','Earth Spirit','Lich','Necrophos','Pudge','Drow Ranger','Dazzle','Outworld Destroyer'];
const SIG = D.sig || ['KEZ','WD','TIDE','ES','LICH','NEC','PUD','DROW','DAZ','OD'];
const NH = D.x.length;
const TEAM = s => D.team ? D.team[s] : (s < 5 ? 0 : 1);
const TCOL = ['#4f9dff', '#e5533d'];
const TRGB = [[79,157,255],[229,83,61]];
const LO = 66, HI = 190;
const N = D.x[0].length;
const DUR = N - 1;
const clamp01 = v => Math.max(0.01, Math.min(0.99, v));
const P = D.x.map((xs, s) => xs.map((x, i) => [clamp01((x - LO) / (HI - LO)), clamp01((D.y[s][i] - LO) / (HI - LO))]));

function hashI(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
// espalha eventos do mesmo segundo para não piscarem todos juntos
const DANO = D.dano.map((e, i) => ({ t: e[0] + hashI(i * 7 + 3) * 0.9, src: e[1], tgt: e[2], amt: e[3] })).sort((a, b) => a.t - b.t);
const USOS = D.usos.map((e, i) => ({ t: e[0] + hashI(i * 13 + 5) * 0.5, s: e[1], nome: e[2], tipo: e[3], alvo: e[4] })).sort((a, b) => a.t - b.t);

// morte: herói parado no mesmo ponto por 4 amostras logo depois de levar dano
const DEAD = Array(NH).fill(Infinity);
for (let s = 0; s < NH; s++) {
  for (let i = 0; i < N - 4; i++) {
    let parado = true;
    for (let k = 1; k <= 4; k++) if (D.x[s][i + k] !== D.x[s][i] || D.y[s][i + k] !== D.y[s][i]) { parado = false; break; }
    if (parado && D.dano.some(e => e[2] === s && e[0] >= i - 3 && e[0] <= i + 1)) { DEAD[s] = i + 0.6; break; }
  }
}
const KILLS = [];
for (let s = 0; s < NH; s++) if (isFinite(DEAD[s])) {
  const hits = DANO.filter(e => e.tgt === s && e.t <= DEAD[s] + 0.5 && TEAM(e.src) !== TEAM(s));
  KILLS.push({ t: DEAD[s], v: s, k: hits.length ? hits[hits.length - 1].src : -1 });
}
KILLS.sort((a, b) => a.t - b.t);

function cr(a, b, c, d, t) { return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); }
const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.07;
function pos(s, t) {
  t = Math.max(0, Math.min(N - 1.001, t));
  const i = Math.floor(t), f = t - i, a = P[s][i], b = P[s][i + 1];
  if (far(a, b)) return (f < 0.85 ? a : b).slice(); // TP / blink: corta em vez de deslizar
  let p0 = P[s][Math.max(0, i - 1)], p3 = P[s][Math.min(N - 1, i + 2)];
  if (far(p0, a)) p0 = a; if (far(b, p3)) p3 = b;
  return [cr(p0[0], a[0], b[0], p3[0], f), cr(p0[1], a[1], b[1], p3[1], f)];
}
const alive = (s, t) => t < DEAD[s];
function hp(s, t) {
  if (!alive(s, t)) return 0;
  let d = 0;
  for (const e of DANO) { if (e.t > t) break; if (e.tgt === s && e.t > t - 14) d += e.amt * (1 - (t - e.t) / 20); }
  let v = 1 - d / 2600;
  if (t > DEAD[s] - 3) v = Math.min(v, (DEAD[s] - t) / 3);
  return Math.max(0.04, Math.min(1, v));
}
function recentes(lista, t, win) { const r = []; for (const e of lista) { if (e.t > t) break; if (e.t > t - win) r.push(e); } return r; }

// ----- geometria aproximada (u para a direita, v para cima; Radiant embaixo à esquerda) -----
const LANES = [
  [[.15,.21],[.115,.40],[.10,.62],[.11,.84],[.17,.895],[.40,.90],[.62,.895],[.80,.86]],
  [[.20,.20],[.35,.345],[.5,.5],[.65,.655],[.80,.80]],
  [[.21,.15],[.40,.115],[.62,.10],[.84,.11],[.895,.17],[.90,.40],[.895,.62],[.86,.80]],
];
const RIVER = [[-.02,.75],[.12,.705],[.26,.645],[.40,.565],[.5,.5],[.60,.435],[.74,.355],[.88,.295],[1.02,.25]];
const TW_R = [[.105,.60],[.115,.44],[.125,.29],[.41,.405],[.33,.325],[.255,.25],[.80,.105],[.52,.11],[.29,.125],[.165,.19],[.19,.165]];
const TOWERS = [...TW_R.map(p => [p[0], p[1], 0]), ...TW_R.map(p => [1 - p[0], 1 - p[1], 1])];
const ANCIENT = [[.115,.115],[.885,.885]];
const BASES = [[.10,.10,.20],[.90,.90,.20]];
const CAMPS_R = [[.30,.44],[.24,.55],[.44,.26],[.58,.22],[.70,.21],[.38,.19],[.47,.36]];
const CAMPS = [...CAMPS_R, ...CAMPS_R.map(p => [1 - p[0], 1 - p[1]])];
const ROSH = [.33, .64];
const VIS_HERO = 0.085, VIS_TOWER = 0.07;
function visivel(u, v, t, time) {
  if (time < 0) return true;
  for (let s = 0; s < NH; s++) if (TEAM(s) === time && alive(s, t)) { const p = pos(s, t); if (Math.hypot(p[0] - u, p[1] - v) < VIS_HERO) return true; }
  for (const w of TOWERS) if (w[2] === time && Math.hypot(w[0] - u, w[1] - v) < VIS_TOWER) return true;
  return false;
}

// ----- ruído CPU -----
function h2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, o = 4) { let s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= .5; } return s; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mkCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function path(g, pts, S) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] * S, (1 - p[1]) * S) : g.moveTo(p[0] * S, (1 - p[1]) * S)); }

// ----- máscara: R = rotas e acampamentos, G = rio, B = base (high ground) -----
let _mask = null;
function getMask() {
  if (_mask) return _mask;
  const S = 512;
  const chan = draw => { const c = mkCanvas(S), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = g.lineJoin = 'round'; draw(g); const b = mkCanvas(S), bg = b.getContext('2d'); bg.filter = 'blur(4px)'; bg.drawImage(c, 0, 0); return bg.getImageData(0, 0, S, S).data; };
  const lane = chan(g => { g.lineWidth = .024 * S; LANES.forEach(l => { path(g, l, S); g.stroke(); }); CAMPS.forEach(c => { g.beginPath(); g.arc(c[0] * S, (1 - c[1]) * S, .022 * S, 0, 7); g.fill(); }); g.beginPath(); g.arc(ROSH[0] * S, (1 - ROSH[1]) * S, .03 * S, 0, 7); g.fill(); });
  const river = chan(g => { g.lineWidth = .05 * S; path(g, RIVER, S); g.stroke(); g.beginPath(); g.arc(.5 * S, .5 * S, .045 * S, 0, 7); g.fill(); });
  const base = chan(g => BASES.forEach(b => { g.beginPath(); g.arc(b[0] * S, (1 - b[1]) * S, b[2] * S, 0, 7); g.fill(); }));
  const img = new ImageData(S, S), fl = { r: new Float32Array(S * S), g: new Float32Array(S * S), b: new Float32Array(S * S) };
  for (let i = 0; i < S * S; i++) { img.data[i * 4] = lane[i * 4]; img.data[i * 4 + 1] = river[i * 4]; img.data[i * 4 + 2] = base[i * 4]; img.data[i * 4 + 3] = 255; fl.r[i] = lane[i * 4] / 255; fl.g[i] = river[i * 4] / 255; fl.b[i] = base[i * 4] / 255; }
  const canvas = mkCanvas(S); canvas.getContext('2d').putImageData(img, 0, 0);
  const sample = (ch, u, v) => { const x = Math.max(0, Math.min(S - 1, u * S)), y = Math.max(0, Math.min(S - 1, (1 - v) * S)); return fl[ch][(y | 0) * S + (x | 0)]; };
  return (_mask = { S, canvas, sample });
}
const lado = (u, v) => smooth(-.04, .04, u + v - 1 + .08 * (fbm(u * 3, v * 3, 3) - .5));
function clareira(u, v) { const m = getMask(); return Math.min(1, Math.max(m.sample('r', u, v) * 1.4, m.sample('g', u, v) * 1.5, m.sample('b', u, v) * 1.2)); }
function densidade(u, v) { return smooth(.38, .62, fbm(u * 6 + 3, v * 6 + 3, 3)) * (1 - smooth(.05, .35, clareira(u, v))); }

// lista de árvores (posição, tamanho, lado) para quem desenha árvore por árvore
let _trees = null;
function getTrees() {
  if (_trees) return _trees;
  const out = [], G = 120;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const u = (i + .15 + .7 * h2(i, j + 99)) / G, v = (j + .15 + .7 * h2(i + 55, j)) / G;
    if (u < .02 || v < .02 || u > .98 || v > .98) continue;
    const d = densidade(u, v);
    if (h2(i + 7, j + 13) < d * 1.2) out.push({ u, v, r: .55 + .4 * h2(i + 3, j + 3), side: lado(u, v) });
  }
  return (_trees = out);
}

// ----- terreno pintado em canvas 2D (usado pelo diorama, Pixi e cinema) -----
const _terr = {};
function getTerrain(S, comArvores = true, reg = [0, 0, 1]) {
  const key = S + ':' + comArvores + ':' + reg; if (_terr[key]) return _terr[key];
  const m = getMask(), c = mkCanvas(S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = reg[0] + x / S * reg[2], v = reg[1] + (1 - y / S) * reg[2], n = fbm(u * 18, v * 18, 3), side = lado(u, v);
    let r = mix(mix(41, 69, n), mix(51, 84, n), side), gg = mix(mix(69, 97, n), mix(38, 56, n), side), b = mix(mix(31, 41, n), mix(33, 43, n), side);
    const ln = smooth(.35, .6, m.sample('r', u, v)), dn = .85 + .3 * vnoise(u * 90, v * 90);
    r = mix(r, 120 * dn, ln); gg = mix(gg, 96 * dn, ln); b = mix(b, 64 * dn, ln);
    const bs = smooth(.45, .6, m.sample('b', u, v)), tile = (((u * 90) % 1) > .93 || ((v * 90) % 1) > .93) ? .78 : 1, tv = .88 + .12 * h2(u * 90 | 0, v * 90 | 0);
    r = mix(r, mix(96, 84, side) * tile * tv, bs); gg = mix(gg, mix(92, 66, side) * tile * tv, bs); b = mix(b, mix(82, 60, side) * tile * tv, bs);
    const be = smooth(.3, .45, m.sample('b', u, v)) - smooth(.45, .6, m.sample('b', u, v));
    r *= 1 - .45 * be; gg *= 1 - .45 * be; b *= 1 - .45 * be;
    const rv = m.sample('g', u, v), w = smooth(.3, .42, rv), dp = smooth(.4, .95, rv);
    r = mix(r, mix(30, 12, dp), w); gg = mix(gg, mix(82, 44, dp), w); b = mix(b, mix(96, 70, dp), w);
    const foam = (smooth(.26, .32, rv) - smooth(.32, .42, rv)) * .5; r += foam * 90; gg += foam * 100; b += foam * 100;
    const i = (y * S + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const RX = u => (u - reg[0]) / reg[2] * S, RY = v => (1 - (v - reg[1]) / reg[2]) * S;
  if (comArvores) {
    const k = S / 1000 / reg[2];
    for (const t of getTrees()) { const x = RX(t.u), y = RY(t.v), r = 5.2 * k * t.r; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + r * .45, y + r * .45, r, 0, 7); g.fill(); }
    for (const t of getTrees()) {
      const x = RX(t.u), y = RY(t.v), r = 5.2 * k * t.r, sd = t.side;
      g.fillStyle = `rgb(${mix(22, 58, sd) | 0},${mix(58, 30, sd) | 0},${mix(28, 32, sd) | 0})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = `rgba(${mix(120, 150, sd) | 0},${mix(170, 90, sd) | 0},${mix(80, 70, sd) | 0},.35)`; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .5, 0, 7); g.fill();
    }
  }
  for (const w of TOWERS) { const x = RX(w[0]), y = RY(w[1]), r = S * .0085 / reg[2]; g.fillStyle = '#2a2622'; g.beginPath(); g.arc(x + 1, y + 1, r, 0, 7); g.fill(); g.fillStyle = '#8c8478'; g.beginPath(); g.arc(x, y, r * .85, 0, 7); g.fill(); g.fillStyle = TCOL[w[2]]; g.beginPath(); g.arc(x, y, r * .4, 0, 7); g.fill(); }
  ANCIENT.forEach((a, i) => { const x = RX(a[0]), y = RY(a[1]), r = S * .02 / reg[2]; g.fillStyle = '#1c1916'; g.beginPath(); g.arc(x, y, r * 1.2, 0, 7); g.fill(); g.fillStyle = TCOL[i]; g.beginPath(); g.arc(x, y, r * .7, 0, 7); g.fill(); });
  return (_terr[key] = c);
}
