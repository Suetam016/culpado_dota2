// Jogada final: Pudge x Faceless Void (partida 9057339159). Miniaturas em desenho animado com o retrato do herói como cabeça.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VOID = 0, PUDGE = 1, TB = 2, NHER = 3;
const PI = Math.PI, $ = s => document.querySelector(s);
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';
DEAD.fill(Infinity); DEAD[PUDGE] = 30.3;

// ===================== assets da linha de montagem (com padrões se faltar algo) =====================
const PADRAO = {
  herois: {
    faceless_void: { corpo: { pele: '#6b5a96', roupa: '#b8995a', escuro: '#4e3d6e' }, cabeca: { escala: 1.6, moldura: '#4f9dff' } },
    pudge: { corpo: { pele: '#c4a690', roupa: '#6b4a2f', escuro: '#4a3829' }, cabeca: { escala: 1.6, moldura: '#e5533d' } },
    terrorblade: { corpo: { pele: '#3d4e8a', roupa: '#1d2440', escuro: '#151a30', chifre: '#d9e6ff' }, cabeca: { escala: 1.6, moldura: '#e5533d' } },
  },
  spells: {
    item_tpscroll: { arquetipo: 'teleporte', cores: ['#ffb070', '#fff1c8'], duracao_ms: 3000, particulas: 40, som: 'tp_canal', som_impacto: 'tp_chegada' },
    pudge_meat_hook: { arquetipo: 'gancho', cores: ['#b8bec4', '#ffd28a'], duracao_ms: 1900, escala: 1, impacto: { tremor: .7, flash: true }, som: 'pudge_meat_hook', destaque: true },
    pudge_rot: { arquetipo: 'aura', cores: ['#7ee84a', '#3d8a20'], particulas: 90, som: 'pudge_rot' },
    pudge_dismember: { arquetipo: 'canalizacao', cores: ['#ff3a3a', '#7a0a0a'], particulas: 60, som: 'pudge_dismember' },
    pudge_flesh_heap: { arquetipo: 'escudo', cores: ['#c8ff7a', '#6aa020'], duracao_ms: 2500, som: 'pudge_flesh_heap' },
    faceless_void_time_walk: { arquetipo: 'blink', cores: ['#9a7dff', '#5fd8ff'], duracao_ms: 400, som: 'faceless_void_time_walk' },
    faceless_void_chronosphere: { arquetipo: 'domo', cores: ['#7a5cff', '#2a1a66', '#c8b8ff'], duracao_ms: 4500, escala: 1, impacto: { tremor: .8, flash: true }, som: 'faceless_void_chronosphere', destaque: true },
    ataque: { arquetipo: 'golpe', cores: ['#c8b8ff', '#ffffff'], som: 'void_ataque', som_impacto: 'void_critico' },
    morte: { arquetipo: 'morte', cores: ['#efe6d6'], som: 'morte' },
  },
};
async function lerJSON(url) { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; } }
function mesclar(a, b) { if (!b || typeof b !== 'object') return a; const o = Array.isArray(a) ? [...a] : { ...a }; for (const k in b) o[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k]) && typeof b[k] === 'object' && !Array.isArray(b[k])) ? mesclar(a[k], b[k]) : b[k]; return o; }
const ASSETS = { ...structuredClone(PADRAO), porHeroi: {} };
for (const nome of ['faceless_void', 'pudge', 'terrorblade']) {
  const j = await lerJSON(`assets/herois/${nome}.json`); if (!j) continue;
  if (j.corpo) { const c = j.corpo; ASSETS.herois[nome].corpo = mesclar(ASSETS.herois[nome].corpo, { ...(c.cor_pele && { pele: c.cor_pele }), ...(c.cor_roupa && { roupa: c.cor_roupa }) }); }
  if (j.cabeca) ASSETS.herois[nome].cabeca = mesclar(ASSETS.herois[nome].cabeca, j.cabeca);
  // a mesma spell (TP) muda de cor e som conforme o herói, então guardo também por herói
  const sp = j.spells || {}; ASSETS.porHeroi[nome] = {}; for (const k in sp) { ASSETS.porHeroi[nome][k] = mesclar(ASSETS.spells[k] || {}, sp[k]); if (!(k in PADRAO.spells) || k !== 'item_tpscroll') ASSETS.spells[k] = mesclar(ASSETS.spells[k] || {}, sp[k]); }
}
const SP = (k, s) => (s != null && ASSETS.porHeroi[D.retrato[s]]?.[k]) || ASSETS.spells[k] || {};
const C = (k, i, s) => new THREE.Color((SP(k, s).cores || [])[i] || (SP(k, s).cores || ['#ffffff'])[0]);
const NADA = { parar() { } };
const tocar = (nome, op) => { try { return (nome && window.SFX?.tocar?.(nome, op)) || NADA; } catch (e) { return NADA; } };

// ===================== roteiro do lance (segundos desde 21:00) =====================
const EV = [
  { k: 'item_tpscroll', s: PUDGE, a: 0, b: 2.05, onde: 2.2 },
  { k: 'item_tpscroll', s: VOID, a: 7.0, b: 9.0, cancela: true },
  { k: 'pudge_meat_hook', s: PUDGE, alvo: VOID, a: 8.0, acerto: 9.0, b: 9.9 },
  { k: 'pudge_rot', s: PUDGE, a: 9.0, b: 15.0 },
  { k: 'pudge_dismember', s: PUDGE, alvo: VOID, a: 10.0, b: 13.6 },
  { k: 'faceless_void_time_walk', s: VOID, a: 13.6, b: 14.0, de: 13, para: 14 },
  { k: 'pudge_flesh_heap', s: PUDGE, a: 14.0, b: 16.5 },
  { k: 'item_tpscroll', s: TB, a: 14.0, b: 16.9, onde: 17.2 },
  { k: 'faceless_void_time_walk', s: VOID, a: 24.55, b: 24.95, de: 24, para: 25 },
  { k: 'faceless_void_chronosphere', s: VOID, a: 25.0, b: 29.5 },
  { k: 'pudge_rot', s: PUDGE, a: 25.0, b: 30.3 },
  { k: 'morte', s: PUDGE, a: 30.3, b: 33 },
];
const ev = k => EV.filter(e => e.k === k);
const ativo = (e, t) => t >= e.a && t < e.b;
const CHRONO = ev('faceless_void_chronosphere')[0];
const DESTAQUES = [
  { a: 8.3, b: 10.3, lento: .28, plano: 'hook', titulo: 'MEAT HOOK', sub: 'pega o Void no meio do TP' },
  { a: 24.9, b: 27.4, lento: .3, plano: 'chrono', titulo: 'CHRONOSPHERE', sub: 'o Void congela o tempo e vira a luta' },
].filter((d, i) => SP(i ? 'faceless_void_chronosphere' : 'pudge_meat_hook').destaque !== false);
const congelado = (s, t) => s !== VOID && ativo(CHRONO, t);

// vida: dano acumulado contra um máximo calibrado pelo que aconteceu
const MAXHP = [3300, 4750, 2900], REGEN = [6, 9, 5];
function vida(s, t) { if (t >= DEAD[s]) return 0; let d = 0; for (const e of DANO) { if (e.t > t) break; if (e.tgt === s) d += e.amt; } return Math.max(.03, Math.min(1, 1 - (d - REGEN[s] * t) / MAXHP[s])); }

// ===================== mundo =====================
const K = 30, C0 = [.49, .40], REG = [.27, .18, .44];
const m = getMask();
const Hh = (u, v) => 3 * (.34 * smooth(.3, .62, m.sample('b', u, v)) - .16 * smooth(.25, .7, m.sample('g', u, v)) + .05 * (fbm(u * 7, v * 7, 3) - .5));
const wp = (u, v, y = 0) => new THREE.Vector3((u - C0[0]) * K, Hh(u, v) + y, -(v - C0[1]) * K);
const naRegiao = (u, v) => u > REG[0] + .005 && u < REG[0] + REG[2] - .005 && v > REG[1] + .005 && v < REG[1] + REG[2] - .005;
function frente(s, alvo, t) { const d = wp(...pos(alvo, t)).sub(wp(...pos(s, t))).setY(0); return d.lengthSq() > .001 ? d.normalize() : new THREE.Vector3(0, 0, 1); }
const HOOK = ev('pudge_meat_hook')[0];
function posBase(s, t) {
  if (s === VOID && t >= HOOK.acerto && t < 10.05) { const a = wp(...pos(VOID, HOOK.acerto)), b = wp(...pos(PUDGE, t)).add(frente(PUDGE, VOID, Math.min(t, 9)).multiplyScalar(1.1)); const k = Math.min(1, (t - HOOK.acerto) / (HOOK.b - HOOK.acerto)); return a.lerp(b, k * k); }
  for (const w of ev('faceless_void_time_walk')) if (s === w.s && t >= w.de && t < w.b) { const a = wp(...pos(VOID, w.de)), b = wp(...pos(VOID, w.para)); return a.lerp(b, smooth(w.a, w.b, t)); }
  return wp(...pos(s, t));
}
function visivelHeroi(s, t) { if (s === PUDGE && t < 2.05) return false; if (s === TB && t < 16.9) return false; return naRegiao(...pos(s, t)); }

// ===================== modelos (corpo cartoon + cabeção com retrato) =====================
const TONS = (() => { const d = new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const TEAMC = [new THREE.Color('#4f9dff'), new THREE.Color('#e5533d')];
const PECAS = {
  pudge: c => [
    { g: 'cap', s: [.09, .14], p: [-.13, .13, 0], c: c.escuro }, { g: 'cap', s: [.09, .14], p: [.13, .13, 0], c: c.escuro },
    { g: 'box', s: [.13, .06, .2], p: [-.13, .03, .04], c: '#2e241b' }, { g: 'box', s: [.13, .06, .2], p: [.13, .03, .04], c: '#2e241b' },
    { g: 'sph', s: [.37, .34, .35], p: [0, .45, .04], c: c.pele },
    { g: 'box', s: [.44, .24, .05], p: [0, .26, .27], r: [.2, 0, 0], c: c.roupa },
    { g: 'tor', s: [.34, .03], p: [0, .33, .03], r: [PI / 2, 0, 0], c: '#3b2a1d' },
    { g: 'sph', s: [.31, .25, .27], p: [0, .66, -.02], c: c.pele },
    { g: 'box', s: [.022, .2, .02], p: [-.06, .5, .37], r: [0, 0, .25], c: '#5a3226' }, { g: 'box', s: [.022, .2, .02], p: [.08, .44, .375], r: [0, 0, -.2], c: '#5a3226' },
    { g: 'box', s: [.1, .015, .02], p: [-.06, .53, .37], c: '#5a3226' },
    { g: 'cap', s: [.08, .2], p: [-.36, .6, .02], r: [0, 0, .55], c: c.pele }, { g: 'cap', s: [.085, .18], p: [-.45, .4, .1], r: [.3, 0, .12], c: c.pele },
    { g: 'cap', s: [.08, .2], p: [.36, .6, .02], r: [0, 0, -.55], c: c.pele }, { g: 'cap', s: [.085, .18], p: [.45, .4, .1], r: [.3, 0, -.12], c: c.pele },
    { g: 'tor', s: [.12, .026, 4.4], p: [-.47, .08, .22], r: [0, 0, PI * .8], c: '#9aa1a8', m: 1, nome: 'gancho' },
    { g: 'cyl', s: [.022, .022, .16], p: [.47, .25, .14], c: '#3b2a1d' },
    { g: 'box', s: [.035, .22, .28], p: [.48, .1, .24], c: '#9aa1a8', m: 1 },
  ],
  faceless_void: c => [
    { g: 'cap', s: [.07, .17], p: [-.11, .27, -.03], r: [-.4, 0, 0], c: c.escuro }, { g: 'cap', s: [.07, .17], p: [.11, .27, -.03], r: [-.4, 0, 0], c: c.escuro },
    { g: 'cap', s: [.06, .16], p: [-.11, .1, .04], r: [.4, 0, 0], c: c.escuro }, { g: 'cap', s: [.06, .16], p: [.11, .1, .04], r: [.4, 0, 0], c: c.escuro },
    { g: 'box', s: [.09, .05, .14], p: [-.11, .025, .08], c: '#2a2238' }, { g: 'box', s: [.09, .05, .14], p: [.11, .025, .08], c: '#2a2238' },
    { g: 'sph', s: [.17, .12, .14], p: [0, .41, 0], c: c.roupa, m: 1 },
    { g: 'cap', s: [.17, .2], p: [0, .63, .03], r: [.28, 0, 0], c: c.pele },
    { g: 'box', s: [.3, .22, .08], p: [0, .65, .18], r: [.28, 0, 0], c: c.roupa, m: 1 },
    { g: 'sph', s: .055, p: [0, .67, .23], c: '#8fe8ff', e: '#4fd0ff' },
    { g: 'sph', s: [.12, .08, .12], p: [-.21, .78, .04], c: c.roupa, m: 1 }, { g: 'sph', s: [.12, .08, .12], p: [.21, .78, .04], c: c.roupa, m: 1 },
    { g: 'cap', s: [.055, .2], p: [-.27, .62, .05], r: [0, 0, .4], c: c.pele }, { g: 'cap', s: [.055, .18], p: [-.32, .43, .13], r: [.7, 0, .1], c: c.pele },
    { g: 'cap', s: [.055, .2], p: [.27, .62, .05], r: [0, 0, -.4], c: c.pele }, { g: 'cap', s: [.055, .18], p: [.32, .43, .13], r: [.7, 0, -.1], c: c.pele },
    { g: 'cyl', s: [.02, .02, .34], p: [.34, .32, .3], r: [1.15, 0, 0], c: '#3a3344' },
    { g: 'sph', s: .075, p: [.34, .24, .45], c: '#59606a', m: 1 },
    { g: 'cone', s: [.025, .08], p: [.34, .33, .45], c: '#59606a', m: 1 }, { g: 'cone', s: [.025, .08], p: [.34, .15, .45], r: [PI, 0, 0], c: '#59606a', m: 1 },
  ],
  terrorblade: c => [
    { g: 'cap', s: [.07, .2], p: [-.11, .15, 0], c: c.escuro }, { g: 'cap', s: [.07, .2], p: [.11, .15, 0], c: c.escuro },
    { g: 'cap', s: [.16, .24], p: [0, .55, 0], c: c.pele }, { g: 'box', s: [.3, .14, .2], p: [0, .38, 0], c: c.roupa },
    { g: 'cap', s: [.05, .22], p: [-.24, .55, .05], r: [0, 0, .5], c: c.pele }, { g: 'cap', s: [.05, .22], p: [.24, .55, .05], r: [0, 0, -.5], c: c.pele },
    { g: 'tor', s: [.2, .022, 2.2], p: [-.34, .38, .15], r: [0, PI / 2, 0], c: '#bfe0ff', e: '#4f9dff', m: 1 },
    { g: 'tor', s: [.2, .022, 2.2], p: [.34, .38, .15], r: [0, -PI / 2, 0], c: '#bfe0ff', e: '#4f9dff', m: 1 },
    { g: 'cone', s: [.18, .5], p: [-.2, .72, -.18], r: [-.9, 0, .6], c: c.escuro }, { g: 'cone', s: [.18, .5], p: [.2, .72, -.18], r: [-.9, 0, -.6], c: c.escuro },
  ],
};
function geoOf(pt) {
  const s = pt.s;
  switch (pt.g) {
    case 'sph': return new THREE.SphereGeometry(1, 24, 16);
    case 'cap': return new THREE.CapsuleGeometry(s[0], s[1], 6, 12);
    case 'box': return new THREE.BoxGeometry(...s);
    case 'cyl': return new THREE.CylinderGeometry(s[0], s[1], s[2], 16);
    case 'cone': return new THREE.ConeGeometry(s[0], s[1], 12);
    case 'tor': return new THREE.TorusGeometry(s[0], s[1], 10, 28, s[2] || PI * 2);
  }
}
const contorno = new THREE.MeshBasicMaterial({ color: 0x0b0806, side: THREE.BackSide });
const texLoader = new THREE.TextureLoader(); texLoader.setCrossOrigin('anonymous');
function retratoTex(nome, cor) {
  // placeholder com a sigla enquanto o retrato carrega (ou se o CDN falhar)
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const sigla = nome.split('_').map(w => w[0]).join('').toUpperCase().slice(0, 2) + (nome.includes('_') ? '' : nome[1].toUpperCase());
  const gr = g.createRadialGradient(110, 90, 20, 128, 128, 140); gr.addColorStop(0, '#3a2f24'); gr.addColorStop(1, '#14100c'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = cor; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, PI * 2); g.stroke();
  g.fillStyle = '#efe6d6'; g.font = '700 96px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sigla.slice(0, 2), 128, 136);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { const w = img.naturalWidth, h = img.naturalHeight, sz = Math.min(w, h) * .92; g.clearRect(0, 0, 256, 256); g.drawImage(img, (w - sz) / 2, (h - sz) * .2, sz, sz, 0, 0, 256, 256); tex.needsUpdate = true; };
  img.src = CDN + nome + '.png';
  return tex;
}
// anel de vida: arco de toro que começa no topo; as geometrias ficam em cache por degrau de 2,5%
const ARCOS = new Map();
function arcoVida(v, R) { const n = Math.max(0, Math.round(v * 40)), key = n + ':' + R.toFixed(3); if (!ARCOS.has(key)) ARCOS.set(key, n ? new THREE.TorusGeometry(R + .005, .045, 8, Math.max(4, n * 2), PI * 2 * n / 40).rotateZ(PI / 2) : new THREE.BufferGeometry()); return ARCOS.get(key); }
function construir(i) {
  const nome = D.retrato[i], A = ASSETS.herois[nome], cor = A.corpo;
  const root = new THREE.Group(), fig = new THREE.Group(); root.add(fig); fig.position.y = .07;
  const mats = [];
  const mat = pt => { const m = new THREE.MeshToonMaterial({ color: new THREE.Color(pt.c), gradientMap: TONS, emissive: pt.e ? new THREE.Color(pt.e) : new THREE.Color(0) }); m.userData.base = m.emissive.clone(); m.userData.cor = m.color.clone(); mats.push(m); return m; };
  PECAS[nome](cor).forEach(pt => {
    const ms = new THREE.Mesh(geoOf(pt), mat(pt)); ms.position.set(...pt.p); if (pt.r) ms.rotation.set(...pt.r);
    if (pt.g === 'sph') ms.scale.set(...(Array.isArray(pt.s) ? pt.s : [pt.s, pt.s, pt.s])); ms.castShadow = true; fig.add(ms);
    if (pt.nome) fig.userData[pt.nome] = ms;
    const o = new THREE.Mesh(ms.geometry, contorno); o.position.copy(ms.position); o.rotation.copy(ms.rotation); o.scale.copy(ms.scale).multiplyScalar(pt.g === 'sph' ? 1.07 : 1.12); fig.add(o);
  });
  // cabeção: disco grosso com o retrato na frente e atrás, borda na cor do time
  const esc = A.cabeca.escala || 1.6, R = .27 * esc / 1.6 * 1.25;
  const cab = new THREE.Group(); cab.position.set(0, nome === 'pudge' ? .9 : .98, .05); fig.add(cab);
  const tex = retratoTex(nome, A.cabeca.moldura);
  const lado = new THREE.MeshToonMaterial({ color: new THREE.Color(A.cabeca.moldura || TEAMC[TEAM(i)]), gradientMap: TONS }), face = new THREE.MeshBasicMaterial({ map: tex });
  mats.push(lado); lado.userData.base = new THREE.Color(0); lado.userData.cor = lado.color.clone();
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .09, 48), lado); disco.rotation.x = PI / 2; disco.castShadow = true; cab.add(disco);
  // o retrato vai num círculo plano na frente e atrás (UV reto, sem girar a foto)
  const fGeo = new THREE.CircleGeometry(R * .96, 48), frenteF = new THREE.Mesh(fGeo, face), tras = new THREE.Mesh(fGeo, face);
  frenteF.position.z = .047; tras.position.z = -.047; tras.rotation.y = PI; cab.add(frenteF, tras);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(R, .03, 8, 48), new THREE.MeshBasicMaterial({ color: 0x241c15 })); cab.add(aro);
  const vidaArc = new THREE.Mesh(arcoVida(1, R), new THREE.MeshBasicMaterial({ color: TEAMC[TEAM(i)] })); vidaArc.position.z = .02; vidaArc.userData.R = R; vidaArc.userData.n = 40; cab.add(vidaArc);
  const ol = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.12, R * 1.12, .07, 48), contorno); ol.rotation.x = PI / 2; cab.add(ol);
  const pesc = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .14, 10), mat({ c: cor.pele })); pesc.position.set(0, cab.position.y - .17, .02); fig.add(pesc);
  // base de miniatura
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.42, .45, .07, 40), new THREE.MeshToonMaterial({ color: 0x2a231c, gradientMap: TONS })); base.position.y = .035; base.receiveShadow = true; root.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.445, .02, 8, 48), new THREE.MeshBasicMaterial({ color: TEAMC[TEAM(i)] })); rim.rotation.x = PI / 2; rim.position.y = .06; root.add(rim);
  const ob = new THREE.Mesh(base.geometry, contorno); ob.position.copy(base.position); ob.scale.setScalar(1.05); root.add(ob);
  root.userData = { fig, mats, cab, vidaArc, base: [base, rim, ob], rotY: 0, mola: 0, molaV: 0 };
  return root;
}
function tingir(h, cor, k) { h.userData.mats.forEach(m => { m.color.copy(m.userData.cor).lerp(cor, k); }); }
function flash(h, k) { h.userData.mats.forEach(m => m.emissive.copy(m.userData.base).lerp(new THREE.Color(1, 1, 1), k)); }

// ===================== cena =====================
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.className = 'layer'; stage.prepend(renderer.domElement);
const ov = $('#ov'), og = ov.getContext('2d');
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e0c0a); scene.fog = new THREE.Fog(0x0e0c0a, 16, 34);
const camera = new THREE.PerspectiveCamera(40, 16 / 9, .05, 90);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = 1.35; controls.minDistance = 2; controls.maxDistance = 18;
let userAte = 0; controls.addEventListener('start', () => userAte = performance.now() + 5000);
scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x3a2a18, .9));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34 }); sun.shadow.bias = -.0006; scene.add(sun, sun.target);
const SZ = REG[2] * K, geo = new THREE.PlaneGeometry(SZ, SZ, 220, 220); geo.rotateX(-PI / 2);
const ps = geo.attributes.position;
for (let i = 0; i < ps.count; i++) { const u = REG[0] + REG[2] / 2 + ps.getX(i) / K, v = REG[1] + REG[2] / 2 - ps.getZ(i) / K; ps.setY(i, Hh(u, v)); }
geo.computeVertexNormals();
const offX = (REG[0] + REG[2] / 2 - C0[0]) * K, offZ = -(REG[1] + REG[2] / 2 - C0[1]) * K;
const terrTex = new THREE.CanvasTexture(getTerrain(1024, false, REG)); terrTex.colorSpace = THREE.SRGBColorSpace; terrTex.anisotropy = 8;
const ground = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: terrTex, gradientMap: TONS })); ground.position.set(offX, 0, offZ); ground.receiveShadow = true; scene.add(ground);
const waterMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uMask: { value: new THREE.CanvasTexture(m.canvas) }, uT: { value: 0 }, uReg: { value: new THREE.Vector3(...REG) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D uMask; uniform float uT; uniform vec3 uReg; varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){ vec2 g=uReg.xy+vUv*uReg.z; float r=texture2D(uMask,g).g; float a=smoothstep(.28,.4,r); if(a<.01)discard;
      float w=n(g*260.+vec2(uT*.7,-uT*.5))*n(g*200.-vec2(uT*.6,uT*.35)); float band=step(.5,fract(w*3.));
      vec3 c=mix(vec3(.12,.45,.6),vec3(.05,.25,.42),smoothstep(.4,.9,r))+band*vec3(.12,.2,.2)+step(.55,w)*vec3(.4,.6,.6);
      gl_FragColor=vec4(c,a*.9); }` });
const water = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ).rotateX(-PI / 2), waterMat); water.position.set(offX, -.2, offZ); scene.add(water);
// tabuleiro em cima de uma mesa escura, para a borda do mapa não virar um vazio preto
{ const mesa = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-PI / 2), new THREE.MeshToonMaterial({ color: 0x33261a, gradientMap: TONS })); mesa.position.y = -.55; mesa.receiveShadow = true; scene.add(mesa); }
// árvores que ficam em cima do caminho dos heróis viram clareira, senão escondem as miniaturas
const caminho = []; for (let s = 0; s < NHER; s++) for (let t = 0; t < DUR; t += .5) if (t < DEAD[s]) caminho.push(wp(...pos(s, t)));
const domoC = wp(...pos(VOID, 25));
const livre = p => caminho.every(c => (c.x - p.x) ** 2 + (c.z - p.z) ** 2 > .95 ** 2) && (domoC.x - p.x) ** 2 + (domoC.z - p.z) ** 2 > 2.4 ** 2;
{ const lista = getTrees().filter(t => naRegiao(t.u, t.v) && livre(wp(t.u, t.v)));
  const A = new THREE.InstancedMesh(new THREE.ConeGeometry(.26, .62, 7), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: TONS }), lista.length * 2), B = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04, .06, .25, 6), new THREE.MeshToonMaterial({ color: 0x4a3424, gradientMap: TONS }), lista.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color();
  lista.forEach((t, i) => { const p = wp(t.u, t.v), s = .8 + .5 * t.r; Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i);
    B.setMatrixAt(i, M.compose(p.clone().setY(p.y + .12 * s), Q, new THREE.Vector3(s, s, s)));
    const c = t.side < .5 ? col.setRGB(.12 + .06 * t.r, .36 + .1 * t.r, .14) : col.setRGB(.36, .17 + .05 * t.r, .14);
    A.setMatrixAt(i * 2, M.compose(p.clone().setY(p.y + .45 * s), Q, new THREE.Vector3(s, s, s))); A.setColorAt(i * 2, c);
    A.setMatrixAt(i * 2 + 1, M.compose(p.clone().setY(p.y + .72 * s), Q, new THREE.Vector3(s * .72, s * .8, s * .72))); A.setColorAt(i * 2 + 1, c.clone().multiplyScalar(1.25)); });
  A.castShadow = B.castShadow = true; A.receiveShadow = true; scene.add(A, B); }
TOWERS.filter(w => naRegiao(w[0], w[1])).forEach(w => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(.16, .24, 1.1, 6), new THREE.MeshToonMaterial({ color: 0x8a8274, gradientMap: TONS }));
  b.position.y = .55; b.castShadow = true; const top = new THREE.Mesh(new THREE.OctahedronGeometry(.14), new THREE.MeshBasicMaterial({ color: TEAMC[w[2]] })); top.position.y = 1.3; g.add(b, top); g.position.copy(wp(w[0], w[1])); scene.add(g); });

// ===================== efeitos (arquétipos lidos das fichas) =====================
const add = o => (scene.add(o), o);
const glow = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), S4 = new THREE.Vector3(), V4 = new THREE.Vector3();
const nPart = (k, d) => Math.min(300, SP(k).particulas || d);
function mkTP(k, s) { const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(.45, .62, 48).rotateX(-PI / 2), glow(C(k, 0, s), .9)); const beam = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, 3, 32, 1, true), glow(C(k, 1, s), .25)); beam.position.y = 1.5;
  const n = nPart(k, 40), sp = new THREE.InstancedMesh(new THREE.SphereGeometry(.03, 6, 4), glow(C(k, 1), .9), n); g.add(ring, beam, sp); g.userData = { ring, beam, sp, n }; g.visible = false; return add(g); }
const tps = ev('item_tpscroll').map(e => ({ e, g: mkTP('item_tpscroll', e.s) }));
const hookHead = new THREE.Group(); { const mt = new THREE.MeshToonMaterial({ color: C('pudge_meat_hook', 0), gradientMap: TONS });
  const a = new THREE.Mesh(new THREE.TorusGeometry(.16, .035, 10, 24, 4.4), mt); a.rotation.set(PI / 2, 0, PI * .8); const c = new THREE.Mesh(new THREE.ConeGeometry(.06, .16, 10), mt); c.position.set(.14, 0, .05); c.rotation.set(0, 0, -PI / 2); hookHead.add(a, c); }
hookHead.visible = false; add(hookHead);
const ELOS = 80, chain = new THREE.InstancedMesh(new THREE.TorusGeometry(.07, .032, 6, 12), new THREE.MeshToonMaterial({ color: 0x80868c, gradientMap: TONS }), ELOS); chain.castShadow = true; chain.visible = false; add(chain);
const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(.04, 6, 4), glow(C('pudge_meat_hook', 1)), 40); sparks.visible = false; add(sparks);
const sparkDir = [...Array(40)].map((_, i) => new THREE.Vector3(Math.cos(i * 2.4), .4 + h2(i, 1), Math.sin(i * 2.4)).normalize().multiplyScalar(1 + 2 * h2(i, 2)));
const ROTN = nPart('pudge_rot', 90), rot = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshToonMaterial({ color: C('pudge_rot', 0), gradientMap: TONS, transparent: true, opacity: .5, depthWrite: false }), ROTN); rot.visible = false; add(rot);
const rotRing = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.32, 64).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: C('pudge_rot', 1), transparent: true })); rotRing.visible = false; add(rotRing);
const DISN = nPart('pudge_dismember', 60), dism = new THREE.InstancedMesh(new THREE.SphereGeometry(.045, 6, 4), glow(C('pudge_dismember', 0)), DISN); dism.visible = false; add(dism);
const dismRing = new THREE.Mesh(new THREE.RingGeometry(.5, .7, 48).rotateX(-PI / 2), glow(C('pudge_dismember', 1), .7)); dismRing.visible = false; add(dismRing);
const shield = new THREE.Mesh(new THREE.SphereGeometry(.5, 32, 20), new THREE.MeshBasicMaterial({ color: C('pudge_flesh_heap', 0), side: THREE.BackSide, transparent: true, opacity: .8 })); shield.visible = false; add(shield);
const walkTrail = new THREE.Mesh(new THREE.BoxGeometry(1, .06, .25), glow(C('faceless_void_time_walk', 0), .7)); walkTrail.visible = false; add(walkTrail);
const ghostMat = new THREE.MeshToonMaterial({ color: C('faceless_void_time_walk', 0), gradientMap: TONS, transparent: true, opacity: .55, depthWrite: false });
const chegada = new THREE.Mesh(new THREE.RingGeometry(.3, .55, 40).rotateX(-PI / 2), glow(C('faceless_void_time_walk', 1), .9)); chegada.visible = false; add(chegada);
// Chronosphere: domo com faixas que giram e relógio no chão
const domoMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 0 }, c1: { value: C('faceless_void_chronosphere', 0) }, c2: { value: C('faceless_void_chronosphere', 1) }, c3: { value: C('faceless_void_chronosphere', 2) } },
  vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform float uT,uA; uniform vec3 c1,c2,c3; varying vec3 vP; varying vec3 vN;
    void main(){ float lat=asin(clamp(vP.y/length(vP),-1.,1.)); float lon=atan(vP.z,vP.x);
      float faixa=step(.86,fract(lat*3.-uT*.25))+step(.93,fract(lon*1.5/3.1416+uT*.12));
      float fr=pow(1.-abs(vN.z),2.); float borda=smoothstep(.72,.9,1.-abs(vN.z));
      vec3 c=mix(c2,c1,fr)+faixa*c3*.6; c+=borda*c3*.5; gl_FragColor=vec4(c,(.14+.3*fr+.35*faixa+.5*borda)*uA); }` });
const domo = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, PI * 2, 0, PI / 2), domoMat); domo.visible = false; add(domo);
const relogio = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.strokeStyle = '#c8b8ff'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 240, 0, 7); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 200, 0, 7); g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; g.lineWidth = i % 3 ? 5 : 12; g.beginPath(); g.moveTo(256 + Math.cos(a) * 205, 256 + Math.sin(a) * 205); g.lineTo(256 + Math.cos(a) * 235, 256 + Math.sin(a) * 235); g.stroke(); }
  const t = new THREE.CanvasTexture(c); return new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); })();
const ponteiro = new THREE.Mesh(new THREE.BoxGeometry(.04, .01, .8), glow(C('faceless_void_chronosphere', 2), .9)); ponteiro.geometry.translate(0, 0, -.4); relogio.add(ponteiro); relogio.visible = false; add(relogio);
// golpe do Void: arco de corte
const corte = new THREE.Mesh(new THREE.RingGeometry(.55, .75, 32, 1, 0, PI * .9), glow(C('ataque', 1, VOID), .9)); corte.visible = false; add(corte);

// ===================== heróis =====================
const herois = [...Array(NHER)].map((_, i) => { const h = construir(i); h.scale.setScalar(i === PUDGE ? 1.25 : 1.15); scene.add(h); return h; });
const fantasmas = [...Array(6)].map(() => { const f0 = herois[VOID].userData.fig, g = f0.clone(true); g.children[f0.children.indexOf(f0.userData.cab ?? herois[VOID].userData.cab)].visible = false; g.traverse(o => { if (o.isMesh) { if (o.material === contorno) o.visible = false; else o.material = ghostMat; o.castShadow = false; } }); g.scale.setScalar(1); g.visible = false; scene.add(g); return g; });
const DM = ev('pudge_dismember')[0], SH = ev('pudge_flesh_heap')[0];
const cabecaSolta = { ativo: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3() };

// ===================== HUD =====================
const marcas = $('#marcas');
[...EV.filter(e => e.k !== 'item_tpscroll' || e.s !== VOID).map(e => ({ t: e.a, txt: (USOS.find(u => Math.abs(u.t - e.a) < 1.2 && u.s === e.s)?.nome) || (e.k === 'morte' ? 'Pudge morre' : e.k), d: false })), ...DESTAQUES.map(d => ({ t: d.a, txt: d.titulo, d: true }))]
  .forEach(m => { const s = document.createElement('span'); s.className = m.d ? 'mk dq' : 'mk'; s.style.left = (m.t / DUR * 100) + '%'; s.title = m.txt; marcas.appendChild(s); });

// ===================== laço =====================
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .45, .4, .9)); composer.addPass(new OutputPass());
let W = 0, Hp = 0;
const fit = () => { const r = stage.getBoundingClientRect(); W = Math.round(r.width); Hp = Math.round(r.height); renderer.setSize(W, Hp, false); composer.setSize(W, Hp); camera.aspect = W / Hp; camera.updateProjectionMatrix();
  const dpr = Math.min(2, devicePixelRatio || 1); ov.width = W * dpr; ov.height = Hp * dpr; og.setTransform(dpr, 0, 0, dpr, 0, 0); };
new ResizeObserver(fit).observe(stage); fit();
const clock = { t: 0, playing: false, speed: 1, prev: 0 };
const cine = () => $('#cine').checked;
const destaque = t => DESTAQUES.find(d => t >= d.a - .4 && t <= d.b + .3);
const HITSTOP = [{ t: HOOK.acerto, d: .09 }, ...DANO.filter(e => e.src === VOID && e.amt > 400).map(e => ({ t: e.t, d: .08 })), { t: DEAD[PUDGE], d: .12 }];
const parado = t => HITSTOP.some(h => t >= h.t && t < h.t + h.d);
const escala = t => { if (parado(t)) return .08; if (!cine()) return 1; let w = 0; for (const d of DESTAQUES) w = Math.max(w, smooth(d.a - .3, d.a, t) * (1 - smooth(d.b, d.b + .3, t)) * (1 - d.lento)); return 1 - w; };
const camAlvo = new THREE.Vector3(), camPos = new THREE.Vector3();
let primeira = true, last = performance.now(), tremor = 0;
const mmss = t => { const g = Math.floor(D.t0 + t); return Math.floor(g / 60) + ':' + String(g % 60).padStart(2, '0'); };
const scrub = $('#scrub'); scrub.max = DUR; scrub.oninput = () => { clock.t = +scrub.value; clock.prev = clock.t; primeira = true; pararSons(); };
const setPlay = p => { clock.playing = p; if (!p) pararSons(); $('#play').textContent = p ? 'Pausar' : 'Tocar'; };
$('#play').onclick = () => { window.SFX?.desbloquear?.(); setPlay(!clock.playing); };
const palco = $('#palco');
const telaCheia = () => { try { if (!document.fullscreenElement) (palco.requestFullscreen || palco.webkitRequestFullscreen)?.call(palco)?.catch?.(() => { }); else document.exitFullscreen?.(); } catch (e) { } };
$('#cheia').onclick = telaCheia;
document.addEventListener('fullscreenchange', () => { $('#cheia').textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; fit(); });
$('#comecar').onclick = () => { if (matchMedia('(pointer: coarse)').matches || innerWidth < 900) { if (!document.fullscreenElement) telaCheia(); } window.SFX?.desbloquear?.(); $('#capa').hidden = true; clock.t = 0; clock.prev = 0; primeira = true; setPlay(true); };
$('#speed').onchange = e => clock.speed = +e.target.value;
$('#tini').textContent = mmss(0); $('#tfim').textContent = mmss(DUR);
const somLigado = () => $('#som').checked;

// sons contínuos (TP, Rot, Dismember) ficam guardados para parar quando o evento acaba, no scrub ou na pausa
const tocando = new Map();
function pararSons() { for (const h of tocando.values()) h.parar(); tocando.clear(); }
function sons(t0, t1) {
  if (window.SFX) SFX.velocidade = escala(t1) < .9 ? .3 : 1;
  if (!somLigado() || t1 <= t0 || t1 - t0 > .5) return;
  for (const e of EV) {
    const sp = SP(e.k, e.s);
    if (e.a > t0 && e.a <= t1) tocando.set(e, tocar(sp.som || e.k, { duracao_ms: (e.b - e.a) * 1000 / (escala(t1) || 1) }));
    if (e.acerto > t0 && e.acerto <= t1) { tocar(sp.som_impacto); tocar(sp.som_fim); }
    if (e.b > t0 && e.b <= t1) { tocando.get(e)?.parar(); tocando.delete(e); if (e.k === 'item_tpscroll') tocar(sp.som_impacto); }
  }
  const at = SP('ataque', VOID);
  for (const d of DANO) if (d.src === VOID && d.t > t0 && d.t <= t1 && d.amt >= 160) tocar(d.amt > 400 ? at.som_impacto : at.som);
}

function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000), now = ts / 1000; last = ts;
  if (clock.playing) { clock.t += dt * clock.speed * escala(clock.t); if (clock.t >= DUR) { clock.t = DUR; setPlay(false); $('#capa').hidden = false; $('#comecar').textContent = 'Ver de novo'; } }
  const t = clock.t; sons(clock.prev, t); clock.prev = t; scrub.value = t; $('#tlabel').textContent = mmss(t);
  waterMat.uniforms.uT.value = now; domoMat.uniforms.uT.value = ativo(CHRONO, t) ? CHRONO.a + (t - CHRONO.a) : now;
  // posições com distância mínima entre miniaturas
  const P = herois.map((_, s) => posBase(s, t));
  if (ativo(ev('pudge_dismember')[0], t) || (t >= 9.9 && t < 10.05)) P[VOID] = wp(...pos(PUDGE, t)).add(frente(PUDGE, VOID, Math.min(t, 9)).multiplyScalar(1.1));
  for (let it = 0; it < 2; it++) for (let a = 0; a < NHER; a++) for (let b = a + 1; b < NHER; b++) { if (!visivelHeroi(a, t) || !visivelHeroi(b, t)) continue; const d = P[b].clone().sub(P[a]).setY(0), L = d.length(); if (L < 1.05) { const n = L > 1e-3 ? d.divideScalar(L) : new THREE.Vector3(1, 0, 0); const push = (1.05 - L) / 2; P[a].addScaledVector(n, -push); P[b].addScaledVector(n, push); } }
  const vivos = [];
  herois.forEach((h, s) => {
    const p = P[s], vis = visivelHeroi(s, t), morto = t >= DEAD[s]; h.visible = vis; if (!vis) return; h.position.copy(p);
    const prev = posBase(s, Math.max(0, t - .15)), vel = p.clone().sub(prev).setY(0), andando = vel.length() > .06 && !congelado(s, t) && !morto;
    let alvoY = h.userData.rotY; const inim = s === VOID ? (t > 20 ? PUDGE : PUDGE) : VOID; const o = P[inim].clone().sub(p).setY(0);
    if ((s === PUDGE && t >= 7.7 && t < 14) || (s === VOID && (t >= 9 && t < 13.6 || t >= 25)) || (s === TB && t >= 25)) alvoY = Math.atan2(o.x, o.z); else if (andando) alvoY = Math.atan2(vel.x, vel.z);
    let dA = alvoY - h.userData.rotY; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); if (!congelado(s, t)) h.userData.rotY += dA * Math.min(1, dt * 10); h.rotation.y = h.userData.rotY;
    const U = h.userData, fig = U.fig, fz = congelado(s, t) ? CHRONO.a : now;
    fig.position.y = .07 + (andando ? Math.abs(Math.sin(fz * 11)) * .05 : 0); fig.rotation.set(andando ? .08 : 0, 0, andando ? Math.sin(fz * 11) * .04 : 0);
    if (s === PUDGE && t >= HOOK.a - .14 && t < HOOK.a) fig.rotation.x = -.3 * smooth(HOOK.a - .14, HOOK.a - .04, t);
    if (s === PUDGE && t >= HOOK.a && t < HOOK.a + .4) fig.rotation.x = .3 * (1 - smooth(HOOK.a + .1, HOOK.a + .4, t));
    if (s === PUDGE && ativo(DM, t)) fig.rotation.x = .18 + Math.sin(now * 9) * .05;
    if (s === VOID && ativo(DM, t)) { fig.position.y = .42 + Math.sin(now * 3) * .03; fig.rotation.z = Math.sin(now * 23) * .08; fig.rotation.x = -.3; }
    // golpe do Void: avanço curto a cada acerto
    if (s === VOID) { const g = recentes(DANO, t, .25).filter(e => e.src === VOID).pop(); if (g) { const k = 1 - (t - g.t) / .25; fig.position.z = .25 * Math.sin(k * PI); fig.rotation.x = -.25 * Math.sin(k * PI); } else fig.position.z = 0; }
    const hit = recentes(DANO, t, .14).some(e => e.tgt === s);
    if (hit && !congelado(s, t)) U.molaV += 6 * dt * 10;
    U.molaV += (-U.mola * 60 - U.molaV * 6) * dt; U.mola += U.molaV * dt;
    fig.scale.setScalar(s === PUDGE ? 1 + .1 * Math.sin(Math.min(1, Math.max(0, (t - SH.a) / .2)) * PI) : 1);
    const flashBranco = (s === VOID && t >= HOOK.acerto && t < HOOK.acerto + .06) || DANO.some(e => e.tgt === s && e.amt > 400 && t >= e.t && t < e.t + .06) || (s === PUDGE && t >= DEAD[s] && t < DEAD[s] + .06);
    flash(h, flashBranco ? 1 : hit ? .35 : 0);
    // dentro da Chronosphere tudo perde cor e escurece, menos o Void
    const naRot = s !== PUDGE && ev('pudge_rot').some(e => ativo(e, t)) && p.distanceTo(P[PUDGE]) < 1.35 && !congelado(s, t) && (now % .5) < .12;
    tingir(h, congelado(s, t) ? new THREE.Color('#4a4856') : naRot ? new THREE.Color('#7ee84a') : new THREE.Color('#8a78d8'), congelado(s, t) ? .75 : naRot ? .5 : (morto ? .6 : 0));
    // cabeção sempre de frente para a câmera, com mola
    const cab = U.cab; const yawCam = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    cab.rotation.set(0, yawCam - h.rotation.y, (congelado(s, t) ? 0 : Math.sin(fz * 2.3 + s) * .06) + U.mola * .5); const sq = recentes(DANO, t, .2).filter(e => e.tgt === s && e.amt >= 100).pop(); let amassa = 0;
    if (sq && !congelado(s, t)) { const k = (t - sq.t) / .2; amassa = k < .4 ? .15 * Math.sin(k / .4 * PI / 2) : .15 * Math.cos((k - .4) / .6 * PI) * (1 - k); }
    if (s === VOID && ativo(DM, t)) { const pul = (now - DM.a) % 1; if (pul < .15) amassa = Math.max(amassa, .15 * Math.sin(pul / .15 * PI)); }
    cab.scale.set(1 + amassa + Math.abs(U.mola) * .2, 1 - amassa + Math.abs(U.mola) * .2, 1);
    cab.visible = !(s === PUDGE && morto);
    if (morto) { fig.rotation.x = -Math.min(1.45, (t - DEAD[s]) * 4); fig.position.y = .07; }
    cab.position.x = 0; cab.position.z = .05;
    { const va = U.vidaArc, n = Math.round(vida(s, t) * 40); if (va.userData.n !== n) { va.userData.n = n; va.geometry = arcoVida(n / 40, va.userData.R); } }
    if (!morto) vivos.push(p);
  });
  { const dir = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(), olhar = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).setY(0).normalize();
    const ator = ((recentes(DANO, t, .6).filter(e => e.amt >= 100).pop() || {}).src) ?? (EV.filter(e => ativo(e, t) && e.k !== 'item_tpscroll').pop() || {}).s;
    for (let a = 0; a < NHER; a++) for (let b = a + 1; b < NHER; b++) { if (!herois[a].visible || !herois[b].visible || t >= DEAD[a] || t >= DEAD[b]) continue;
      const d = P[b].clone().sub(P[a]); if (Math.abs(d.dot(dir)) > .9 || d.length() > 1.6) continue;
      const lado = d.dot(dir) >= 0 ? 1 : -1;
      [[a, -lado], [b, lado]].forEach(([s, sg]) => { const h = herois[s], w = dir.clone().multiplyScalar(.35 * sg).add(olhar.clone().multiplyScalar(s === ator ? .35 : 0)); w.applyAxisAngle(new THREE.Vector3(0, 1, 0), -h.rotation.y); h.userData.cab.position.x += w.x; h.userData.cab.position.z += w.z; }); } }
  // cabeça do Pudge rolando depois da morte
  if (t >= DEAD[PUDGE]) { const k = t - DEAD[PUDGE], base = P[PUDGE]; const dir = frente(VOID, PUDGE, DEAD[PUDGE]);
    const cab = herois[PUDGE].userData.cab; if (!cabecaSolta.mesh) { cabecaSolta.mesh = cab.clone(true); scene.add(cabecaSolta.mesh); }
    const ms = cabecaSolta.mesh; ms.visible = true; ms.scale.setScalar(1.25); const quica = Math.abs(Math.sin(Math.min(k, 1.6) * 6)) * Math.exp(-k * 2.2) * 1.4;
    ms.position.copy(base).addScaledVector(dir, Math.min(k, 1.6) * 1.4).setY(base.y + .35 + quica); ms.rotation.set(Math.min(k, 1.6) * 5, Math.atan2(camera.position.x - ms.position.x, camera.position.z - ms.position.z), Math.min(k, 1.6) * 1.2); }
  else if (cabecaSolta.mesh) cabecaSolta.mesh.visible = false;
  // teleportes
  tps.forEach(({ e, g }) => { const fim = e.b + (e.cancela ? .5 : 0); const on = t >= e.a && t < fim && (e.onde ? naRegiao(...pos(e.s, e.onde)) : visivelHeroi(e.s, t)); g.visible = on; if (!on) return;
    g.position.copy(e.onde ? wp(...pos(e.s, e.onde)) : P[e.s]); const { ring, beam, sp, n } = g.userData, k = (t - e.a) / (e.b - e.a);
    if (e.cancela && t >= e.b) { const f = (t - e.b) / .5; ring.scale.setScalar(1 + f * 1.5); ring.material.opacity = .9 * (1 - f); beam.material.opacity = .25 * (1 - f) ** 2; sp.visible = false; return; }
    ring.scale.setScalar(1); ring.material.opacity = .5 + .4 * Math.sin(now * 8); ring.rotation.y = now; beam.material.opacity = .12 + .2 * k; beam.scale.set(1, .4 + k, 1); beam.position.y = 1.5 * (.4 + k); sp.visible = true;
    for (let i = 0; i < n; i++) { const a = i * 2.4 + now * 2, y = ((now * .8 + i / n) % 1) * 2.5; sp.setMatrixAt(i, M4.makeTranslation(Math.cos(a) * .5, y, Math.sin(a) * .5)); } sp.instanceMatrix.needsUpdate = true; });
  // Meat Hook
  const hookOn = t >= HOOK.a && t < HOOK.b; hookHead.visible = chain.visible = hookOn; const gHand = herois[PUDGE].userData.fig.userData.gancho; if (gHand) gHand.visible = !hookOn;
  if (hookOn) { const mao = P[PUDGE].clone().add(frente(PUDGE, VOID, Math.min(t, 9)).multiplyScalar(.5)).setY(P[PUDGE].y + .5);
    const alvoH = t < HOOK.acerto ? mao.clone().lerp(wp(...pos(VOID, HOOK.acerto)).setY(Hh(...pos(VOID, HOOK.acerto)) + .6), (t - HOOK.a) / (HOOK.acerto - HOOK.a)) : P[VOID].clone().setY(P[VOID].y + .6);
    hookHead.position.copy(alvoH); hookHead.lookAt(mao); hookHead.rotateY(PI);
    const L = alvoH.distanceTo(mao), n = Math.min(ELOS, Math.ceil(L / .11)); const rq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(mao, alvoH, new THREE.Vector3(0, 1, 0)));
    for (let i = 0; i < ELOS; i++) { if (i >= n) { chain.setMatrixAt(i, M4.makeScale(0, 0, 0)); continue; } const k = i / n; V4.copy(mao).lerp(alvoH, k); V4.y += Math.sin(k * PI) * .06;
      Q4.copy(rq).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), i % 2 ? PI / 2 : 0)); chain.setMatrixAt(i, M4.compose(V4, Q4, S4.set(1, 1, 1))); }
    chain.instanceMatrix.needsUpdate = true; }
  const sOn = t >= HOOK.acerto && t < HOOK.acerto + .6; sparks.visible = sOn;
  if (sOn) { const f = (t - HOOK.acerto) / .6, c = wp(...pos(VOID, HOOK.acerto)).setY(Hh(...pos(VOID, HOOK.acerto)) + .6); for (let i = 0; i < 40; i++) { V4.copy(sparkDir[i]).multiplyScalar(f * 1.5).add(c); V4.y -= f * f * 1.2; sparks.setMatrixAt(i, M4.compose(V4, Q4.identity(), S4.setScalar(1 - f))); } sparks.instanceMatrix.needsUpdate = true; }
  // Rot (congela junto dentro da Chronosphere)
  const rE = ev('pudge_rot').find(e => ativo(e, t)); rot.visible = rotRing.visible = !!rE && t < DEAD[PUDGE];
  if (rot.visible) { const c = P[PUDGE], tr = congelado(PUDGE, t) ? CHRONO.a : now; rotRing.position.copy(c).setY(c.y + .05); rotRing.material.opacity = .9;
    for (let i = 0; i < ROTN; i++) { const a = i * 2.399 + tr * (.6 + h2(i, 4) * .6), r = .55 + .75 * h2(i, 5), y = ((tr * .35 + h2(i, 6)) % 1); V4.set(c.x + Math.cos(a) * r, c.y + .04 + y * .22, c.z + Math.sin(a) * r);
      rot.setMatrixAt(i, M4.compose(V4, Q4.identity(), S4.setScalar(.04 + .07 * y * (1 - y) * 4 * h2(i, 7)))); } rot.instanceMatrix.needsUpdate = true; }
  // Dismember
  const dOn = ativo(DM, t); dism.visible = dismRing.visible = dOn;
  if (dOn) { const a = P[VOID].clone().setY(P[VOID].y + .8), b = P[PUDGE].clone().setY(P[PUDGE].y + 1.0); dismRing.position.copy(P[VOID]).setY(P[VOID].y + .05); dismRing.rotation.y = now * 2;
    for (let i = 0; i < DISN; i++) { const k = (now * .9 + i / DISN) % 1, fio = i % 4; V4.copy(a).lerp(b, k); V4.x += Math.sin(k * PI * 3 + fio * 1.6) * .12 * Math.sin(k * PI); V4.y += Math.sin(k * PI) * .25 + Math.cos(k * 9 + fio) * .05;
      dism.setMatrixAt(i, M4.compose(V4, Q4.identity(), S4.setScalar(.6 + .8 * Math.sin(k * PI)))); } dism.instanceMatrix.needsUpdate = true; }
  // Meat Shield
  const shOn = ativo(SH, t); shield.visible = shOn; if (shOn) { const f = (t - SH.a) / (SH.b - SH.a); shield.position.copy(P[PUDGE]).setY(P[PUDGE].y + .42); shield.scale.set(1.25, 1.0, 1.25).multiplyScalar(1 + .03 * Math.sin(now * 6)); shield.material.opacity = .8 * (1 - f * f); }
  // Time Walk
  const TW = ev('faceless_void_time_walk').find(w => t >= w.a && t < w.b + .5);
  fantasmas.forEach((g, i) => { g.visible = !!TW && t > TW.a + i * (TW.b - TW.a) / 6; if (!g.visible) return; const p = wp(...pos(VOID, TW.de)).lerp(wp(...pos(VOID, TW.para)), i / 6); g.position.copy(p).setY(p.y + .08); g.rotation.y = herois[VOID].rotation.y; });
  ghostMat.opacity = TW ? .55 * (1 - smooth(TW.b + .2, TW.b + .5, t)) : 0;
  chegada.visible = !!TW && t >= TW.b - .06 && t < TW.b + .35; if (chegada.visible) { const k = (t - TW.b + .06) / .41, c = wp(...pos(VOID, TW.para)); chegada.position.copy(c).setY(c.y + .06); chegada.scale.setScalar(.6 + k * 1.4); chegada.material.opacity = t < TW.b ? 1 : .8 * (1 - k); }
  walkTrail.visible = !!TW; if (TW) { const a = wp(...pos(VOID, TW.de)), b = wp(...pos(VOID, TW.para)); walkTrail.position.copy(a).lerp(b, .5).setY((a.y + b.y) / 2 + .1); walkTrail.scale.x = Math.max(.01, a.distanceTo(b)); walkTrail.lookAt(b.x, walkTrail.position.y, b.z); walkTrail.rotateY(PI / 2); walkTrail.material.opacity = .35 * (1 - smooth(TW.b, TW.b + .5, t)); }
  // Chronosphere
  const cOn = t >= CHRONO.a && t < CHRONO.b + .6; domo.visible = relogio.visible = cOn;
  const centroC = wp(...pos(PUDGE, CHRONO.a + .5)).lerp(wp(...pos(VOID, CHRONO.a + .5)), .5);
  if (cOn) { const abre = smooth(CHRONO.a, CHRONO.a + .35, t), fecha = 1 - smooth(CHRONO.b, CHRONO.b + .6, t), R = 2.4 * (SP('faceless_void_chronosphere').escala || 1);
    domo.position.copy(centroC); domo.scale.setScalar(R * (.2 + .8 * abre) * (1 + .15 * (1 - fecha))); domoMat.uniforms.uA.value = abre * fecha;
    relogio.position.copy(centroC).setY(centroC.y + .08); relogio.scale.setScalar(R * abre); relogio.material.opacity = abre * fecha; ponteiro.rotation.y = -(t - CHRONO.a) * .8; }
  // golpes do Void
  const g = recentes(DANO, t, .22).filter(e => e.src === VOID && visivelHeroi(e.tgt, t)).pop(); corte.visible = !!g;
  if (g) { const k = (t - g.t) / .22, alvo = P[g.tgt]; corte.position.copy(alvo).setY(alvo.y + .8); corte.lookAt(camera.position); corte.rotateZ(-1.2 + k * 2.2); corte.scale.setScalar(g.amt > 400 ? 1.5 : 1); corte.material.opacity = .9 * (1 - k); }
  // tremor de câmera
  for (const d of DANO) if (d.t > t - dt * 1.2 && d.t <= t && d.amt >= 300) tremor = Math.max(tremor, (SP(d.src === PUDGE ? 'pudge_meat_hook' : 'faceless_void_chronosphere').impacto?.tremor ?? .6) * Math.min(1, d.amt / 500));
  if (t >= HOOK.acerto && t - HOOK.acerto < dt * 1.5) tremor = Math.max(tremor, SP('pudge_meat_hook').impacto?.tremor ?? .7);
  tremor *= Math.pow(.02, dt);
  // câmera
  const dq = cine() ? destaque(t) : null;
  if (performance.now() > userAte) {
    // câmera perpendicular à linha do gancho, para a corrente atravessar a tela
    if (dq && dq.plano === 'hook') { const f = frente(PUDGE, VOID, Math.min(t, 9)), meio = P[PUDGE].clone().lerp(wp(...pos(VOID, 9)), .5); camAlvo.copy(meio).setY(meio.y + .6); camPos.copy(meio).add(new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(4.6)).sub(f.clone().multiplyScalar(.8)).setY(meio.y + 2.6); }
    else if (dq && dq.plano === 'chrono') { const a = (t - dq.a) * .35 + .6; camAlvo.copy(centroC).setY(centroC.y + .8); camPos.copy(centroC).add(new THREE.Vector3(Math.cos(a) * 6.4, 5.6, Math.sin(a) * 6.4)); }
    else { const c = vivos.length ? vivos.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / vivos.length) : P[VOID].clone(); let sp = 0; vivos.forEach(v => sp = Math.max(sp, v.distanceTo(c)));
      camAlvo.copy(c).setY(c.y + .5); camPos.copy(camAlvo).add(new THREE.Vector3(.3, .9, .9).normalize().multiplyScalar(Math.min(14, 6.5 + sp * 1.2))); }
    const e = primeira ? 1 : 1 - Math.pow(dq ? .03 : .15, dt); primeira = false; controls.target.lerp(camAlvo, e); camera.position.lerp(camPos, e);
  }
  controls.update();
  const sh = new THREE.Vector3((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(tremor * .25); camera.position.add(sh);
  sun.position.copy(controls.target).add(new THREE.Vector3(-6, 10, 5)); sun.target.position.copy(controls.target);
  composer.render(); camera.position.sub(sh);
  og.clearRect(0, 0, W, Hp);
  const proj = (v) => { v.project(camera); return [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * Hp, v.z]; };
  for (const e of recentes(DANO, t, 1)) { if (!visivelHeroi(e.tgt, t) || e.amt < 50) continue; const f = t - e.t, h = herois[e.tgt]; const v = h.position.clone(); v.y += 1.6 + f * .6; v.x += (h2(e.t * 10 | 0, e.amt) - .5) * .9; const [x, y, z] = proj(v); if (z > 1) continue;
    const big = e.amt >= 400; og.globalAlpha = 1 - f * f; og.font = `900 ${Math.max(13, W / 52) * (big ? 1.5 : 1) * (1 + .4 * Math.max(0, 1 - f * 6))}px "Alegreya Sans", sans-serif`; og.textAlign = 'center'; og.lineWidth = 4; og.strokeStyle = '#0b0806';
    og.fillStyle = big ? '#ffcf5a' : e.src === PUDGE && e.amt > 300 ? '#ffcf5a' : '#ff8a70'; const txt = (big ? '' : '-') + e.amt + (big ? '!' : ''); og.strokeText(txt, x, y); og.fillText(txt, x, y); og.globalAlpha = 1; }
  const lbK = dq ? smooth(dq.a - .4, dq.a, t) * (1 - smooth(dq.b, dq.b + .3, t)) : 0;
  if (lbK > 0) { const lb = lbK * Hp * .13; og.fillStyle = '#000'; og.fillRect(0, 0, W, lb); og.fillRect(0, Hp - lb, W, lb);
    const f = smooth(dq.a, dq.a + .3, t) * (1 - smooth(dq.b - .2, dq.b + .2, t)); og.globalAlpha = f; og.textAlign = 'center';
    og.textBaseline = 'middle'; og.fillStyle = '#e8b04a'; og.font = `900 ${Hp * .075}px Cinzel, serif`; og.fillText(dq.titulo, W / 2 + (1 - f) * 40, Hp - lb / 2);
    og.fillStyle = '#efe6d6'; og.font = `600 ${Hp * .035}px "Alegreya Sans", sans-serif`; og.fillText(dq.sub, W / 2, lb / 2); og.textBaseline = 'alphabetic'; og.globalAlpha = 1; }
  if (t >= DEAD[PUDGE] && t < DEAD[PUDGE] + 2.6) { const f = smooth(DEAD[PUDGE], DEAD[PUDGE] + .3, t) * (1 - smooth(DEAD[PUDGE] + 2.1, DEAD[PUDGE] + 2.6, t)); og.globalAlpha = f; og.textAlign = 'center';
    og.fillStyle = 'rgba(14,12,10,.75)'; og.fillRect(0, Hp * .12, W, Hp * .13); og.fillStyle = '#e5533d'; og.font = `900 ${Hp * .065}px Cinzel, serif`; og.fillText('PUDGE CAIU', W / 2, Hp * .19);
    og.fillStyle = '#c7b9a3'; og.font = `500 ${Hp * .032}px "Alegreya Sans", sans-serif`; og.fillText('o Void transformou a fuga em abate', W / 2, Hp * .235); og.globalAlpha = 1; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__pronto = true;
