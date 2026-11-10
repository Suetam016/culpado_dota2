// Zap da vitória: desenha no celular a conversa que zap/gerador.js sorteia para a partida.
// O site monta a partida no formato do gerador (index.html, partidaDoZap) e chama ZapConversa.montar(caixa, M, opções).
// Memória entre conversas: as falas e figurinhas que saíram ficam no navegador (localStorage 'zap-memoria'), e a
// próxima conversa foge delas enquanto houver opção nova. A semente sai da partida, então a mesma vitória tende a
// reabrir com a mesma conversa.
(function (root) {
const CHAVE = 'zap-memoria';
const MAX_MEMORIA = 360; // ~10 conversas

function lerMemoria() {
  try { const m = JSON.parse(localStorage.getItem(CHAVE) || '{}'); return { recentes: Array.isArray(m.recentes) ? m.recentes : [] }; } catch (e) { return { recentes: [] }; }
}
// o que saiu em OUTRAS partidas (a mesma partida não foge de si mesma, para reabrir igual)
function evitarPara(partida) {
  const id = String(partida);
  return new Set(lerMemoria().recentes.filter((y) => y.p !== id).map((y) => y.k));
}
function lembrar(chaves, partida) {
  const id = String(partida);
  const m = lerMemoria();
  m.recentes = m.recentes.filter((y) => y.p !== id);
  for (const k of chaves) m.recentes.push({ k, p: id });
  if (m.recentes.length > MAX_MEMORIA) m.recentes.splice(0, m.recentes.length - MAX_MEMORIA);
  try { localStorage.setItem(CHAVE, JSON.stringify(m)); } catch (e) { /* cheio ou bloqueado */ }
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// rajadas: txt em lista vira várias mensagens seguidas da mesma pessoa
function expandir(evs) { const out = []; for (const ev of evs) { if (ev.t === 'msg' && Array.isArray(ev.txt)) ev.txt.forEach((tx, i) => out.push(i === 0 ? { ...ev, txt: tx } : { t: 'msg', de: ev.de, txt: tx, min: ev.min, h: ev.h, rajada: true })); else out.push(ev); } return out; }
let ctxSom = null;
function blip() {
  try {
    ctxSom = ctxSom || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctxSom.createOscillator(); const g = ctxSom.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, ctxSom.currentTime); o.frequency.exponentialRampToValueAtTime(1320, ctxSom.currentTime + 0.05);
    g.gain.setValueAtTime(0.0001, ctxSom.currentTime); g.gain.exponentialRampToValueAtTime(0.05, ctxSom.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctxSom.currentTime + 0.12);
    o.connect(g).connect(ctxSom.destination); o.start(); o.stop(ctxSom.currentTime + 0.13);
  } catch (e) { /* sem áudio */ }
}

function montar(alvo, M, opc = {}) {
  const IMG = (hh) => (M.img && M.img[hh]) || '';
  const figura = (f) => {
    const im = (hh, cls = '') => el('img', { src: IMG(hh), alt: '', class: cls ? 'z-' + cls : null });
    if (f.tpl === 'meme') return el('div', { class: 'z-arte z-meme' }, im(f.img), el('span', { class: 'z-cima' }, f.cima), el('span', { class: 'z-baixo' }, f.baixo));
    if (f.tpl === 'duo') return el('div', { class: 'z-arte z-duo' }, el('div', {}, im(f.img), el('span', {}, f.la)), el('div', {}, im(f.img, 'cinza'), el('span', {}, f.lb)));
    if (f.tpl === 'procurado') return el('div', { class: 'z-arte z-procurado' }, el('b', {}, 'PROCURADO'), im(f.img, 'sepia'), el('em', {}, f.crime), el('small', {}, 'recompensa: ' + f.recompensa));
    if (f.tpl === 'rip') return el('div', { class: 'z-arte z-rip' }, el('b', {}, 'R.I.P.'), im(f.img, 'cinza'), el('em', {}, f.txt), el('small', {}, f.sub));
    if (f.tpl === 'func') return el('div', { class: 'z-arte z-func' }, el('b', {}, f.titulo || 'Funcionário do mês'), im(f.img), el('em', {}, f.nome), el('small', {}, f.txt));
    if (f.tpl === 'criou') return el('div', { class: 'z-arte z-meme z-criou' }, im(f.img), el('span', { class: 'z-cima' }, f.cima), el('i', { class: 'z-filho' }, im(f.img2)), el('span', { class: 'z-baixo' }, f.baixo));
    if (f.tpl === 'carrega') return el('div', { class: 'z-arte z-carrega' }, im(f.img), el('span', { class: 'z-cima' }, f.cima), el('div', { class: 'z-peso' }, (f.imgs || []).map((hh) => im(hh))));
    return el('div', { class: 'z-arte z-meme' }, im(f.img), el('span', { class: 'z-baixo' }, f.txt || ''));
  };

  const chat = el('div', { class: 'wa-chat', role: 'log', 'aria-label': 'Conversa do grupo' });
  const nomeG = el('b', {}, '');
  const subG = el('small', {}, '');
  const fotoG = el('img', { src: '', alt: '' });
  const pin = el('div', { class: 'wa-pin', hidden: true });
  const stripTx = el('span', {}, '');
  const stripSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  stripSvg.setAttribute('viewBox', '0 0 120 26'); stripSvg.setAttribute('preserveAspectRatio', 'none');
  const strip = el('div', { class: 'wa-strip', hidden: true }, stripTx, stripSvg);
  const phone = el('div', { class: 'zapc' },
    el('div', { class: 'wa-top' }, el('span', { class: 'z-voltar', 'aria-hidden': 'true' }, '‹'), fotoG, el('div', { class: 'z-tx' }, nomeG, subG)),
    pin, strip, chat,
    el('div', { class: 'wa-bottom', 'aria-hidden': 'true' }, el('div', { class: 'z-campo' }, 'Mensagem'), el('div', { class: 'z-mic' }, '🎤')));
  const btPlay = el('button', { class: 'z-play', type: 'button', 'data-gtm': 'vitoria-zap-tocar' }, '▶ Ver chegando');
  alvo.append(el('div', { class: 'zap-ctrl' }, btPlay), phone); // uma conversa só por vitória: sem botão de sortear outra

  let g = null; let rodada = 0;
  const est = { ultimo: null, ids: {}, polls: {}, hora: '' };
  const quem = (k) => g.P[k];

  function desenharStrip(min) {
    if (!g.strip || !M.ouro || !M.ouro.length) return;
    min = Math.min(min, M.dur / 60);
    const O = M.ouro; const m = Math.max(0, Math.min(O.length - 1, Math.floor(min)));
    stripTx.innerHTML = `⏱ <b>${mmss(min * 60)}</b> · ${O[m] >= 0 ? 'nós +' : 'eles +'}${(Math.abs(O[m]) / 1000).toFixed(1).replace('.', ',')} mil`;
    const max = Math.max(4000, ...O.map(Math.abs)) * 1.05; const W = 120; const Hh = 26; const y = (v) => Hh / 2 - (v / max) * (Hh / 2 - 2);
    const pts = O.slice(0, m + 1).map((v, i) => `${(i / Math.max(1, O.length - 1)) * W},${y(v)}`).join(' ');
    stripSvg.innerHTML = `<line x1="0" x2="${W}" y1="${Hh / 2}" y2="${Hh / 2}" stroke="#3b4a54" stroke-width=".6"/><polyline points="${pts}" fill="none" stroke="#00a884" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
  }
  const horaDe = (ev) => { if (ev.h) est.hora = ev.h; else if (ev.min != null) est.hora = new Date((M.inicio + ev.min * 60) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); return est.hora; };
  // nome com a figurinha do herói que a pessoa jogou
  const autor = (k) => { const p = quem(k); return el('span', { class: 'z-autor', style: `color:${p.cor}` }, el('img', { src: IMG(p.heroi), alt: '' }), p.nome); };

  function cartao() {
    const c = M.nos[M.craque];
    const nome = c.amigo ? c.nome : 'O random';
    const mil = (n) => `${((n || 0) / 1000).toFixed(1).replace('.', ',')} mil`;
    return el('div', { class: 'z-vd' },
      el('div', { class: 'z-faixa' }, el('img', { src: IMG(c.heroi), alt: '' }), el('div', {}, el('small', {}, 'Veredito oficial'), el('b', {}, `${nome} carregou`), el('span', {}, `${c.heroiNome} · ${String(c.merito).replace('.', ',')}% do mérito · ${c.k}/${c.d}/${c.a}`))),
      el('div', { class: 'z-num' }, el('span', {}, el('b', {}, String(c.gpm)), ' de GPM'), '·', el('span', {}, el('b', {}, mil(c.dano)), ' de dano'), '·', el('span', {}, el('b', {}, mil(c.torre)), ' em torre')),
      el('div', { class: 'z-link' }, `oculpado.com.br · vitória ${M.placar[0]} × ${M.placar[1]} em ${mmss(M.dur)}`));
  }

  function render(ev, animar) {
    const hora = horaDe(ev);
    if (ev.min != null) desenharStrip(ev.min);
    let no = null;
    const cont = est.ultimo === ev.de && ev.t === 'msg';
    if (ev.t === 'day') no = el('div', { class: 'z-dia' }, ev.txt);
    else if (ev.t === 'sys') { no = el('div', { class: `z-sys ${ev.cls ? 'z-' + ev.cls : ''}`, html: ev.txt }); if (ev.grupo) nomeG.textContent = ev.grupo; }
    else if (ev.t === 'msg') no = el('div', { class: `z-bol ${cont ? 'z-cont' : ''}` }, cont ? null : autor(ev.de),
      ev.reply ? el('div', { class: 'z-quote', style: `--qc:${quem(ev.reply.de).cor}` }, el('b', {}, quem(ev.reply.de).nome), ev.reply.txt) : null,
      el('p', {}, ev.txt, el('span', { class: 'z-hora' }, hora)));
    else if (ev.t === 'stk') no = el('div', { class: 'z-stk' }, autor(ev.de), figura(ev), el('span', { class: 'z-hora' }, hora));
    else if (ev.t === 'card') no = el('div', { class: 'z-bol' }, autor(ev.de), el('span', { class: 'z-fw' }, '↪ Encaminhada com frequência'), cartao(), el('p', {}, ev.legenda || '', el('span', { class: 'z-hora' }, hora)));
    else if (ev.t === 'del') no = el('div', { class: 'z-bol z-apagada' }, autor(ev.de), el('p', {}, '🚫 Esta mensagem foi apagada', el('span', { class: 'z-hora' }, hora)));
    else if (ev.t === 'poll') {
      const ops = ev.ops.map((lb) => { const qt = el('span', { class: 'z-qt' }); const bar = el('i'); return { op: el('div', { class: 'z-op' }, el('span', { class: 'z-ck' }), el('span', { class: 'z-lb' }, lb), qt, el('span', { class: 'z-bar' }, bar)), qt, bar, votos: [] }; });
      est.polls[ev.id] = ops;
      no = el('div', { class: 'z-bol z-poll' }, autor(ev.de), el('div', { class: 'z-q' }, '📊 ' + ev.q), el('div', { class: 'z-sub' }, 'Selecione uma opção'), ops.map((o) => o.op), el('p', {}, el('span', { class: 'z-hora' }, hora)));
    } else if (ev.t === 'vote') {
      const ops = est.polls[ev.poll]; if (!ops) return null; ops[ev.op].votos.push(ev.de);
      const tot = M.nos.filter((n) => n.amigo).length || 5;
      ops.forEach((x) => { x.bar.style.width = `${(x.votos.length / tot) * 100}%`; x.qt.replaceChildren(...x.votos.map((d) => el('img', { src: IMG(quem(d).heroi), alt: quem(d).nome, title: quem(d).nome })), x.votos.length ? el('span', { style: 'margin-left:4px' }, String(x.votos.length)) : ''); });
      if (animar) { subG.textContent = `${quem(ev.de).nome} votou na enquete`; subG.classList.add('ativo'); }
      return null;
    } else if (ev.t === 'react') {
      const a = est.ids[ev.alvo]; if (!a) return null;
      a.classList.add('z-tem-reac');
      const rr = a.querySelector('.z-reac') || a.appendChild(el('span', { class: 'z-reac' }));
      rr.textContent = ev.emo; if (animar) rr.classList.add('z-entra');
      return null;
    } else if (ev.t === 'pin') { pin.hidden = false; pin.replaceChildren(el('span', {}, '📌'), el('span', {}, ev.txt)); return null; }
    if (!no) return null;
    if (ev.id) est.ids[ev.id] = no;
    if (animar) no.classList.add('z-entra');
    chat.append(no);
    est.ultimo = ev.t === 'msg' ? ev.de : null;
    return no;
  }

  function limpar() {
    chat.replaceChildren(); est.ultimo = null; est.ids = {}; est.polls = {}; est.hora = '';
    nomeG.textContent = g.grupo; fotoG.src = IMG(M.nos[M.craque].heroi); subG.textContent = g.sub; subG.classList.remove('ativo'); pin.hidden = true;
    strip.hidden = !g.strip; if (g.strip) desenharStrip((g.ev.find((e) => e.min != null) || {}).min || 0);
  }
  function mostrarTudo() { rodada++; limpar(); g.ev.forEach((ev) => render(ev, false)); chat.scrollTop = 0; btPlay.textContent = '▶ Ver chegando'; }

  async function tocar() {
    const minha = ++rodada;
    limpar(); btPlay.textContent = '↺ De novo';
    const lento = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const z = (ms) => dormir(lento ? ms : ms * 0.3);
    let ultimoMin = null;
    for (const ev of g.ev) {
      if (minha !== rodada || !phone.isConnected) return;
      if (ev.min != null && !ev.rajada) { if (ultimoMin != null) await z(Math.min(1700, Math.max(0, ev.min - ultimoMin) * 240)); ultimoMin = ev.min; }
      if (minha !== rodada) return;
      if (['msg', 'stk', 'poll', 'card', 'del'].includes(ev.t)) {
        const len = (ev.txt || ev.q || '').length;
        const t = ev.rajada ? Math.min(1100, 260 + len * 22) : ev.t === 'stk' ? 650 : ev.t === 'card' ? 800 : Math.min(2300, 450 + len * 30);
        subG.textContent = ev.duplo ? `${quem(ev.de).nome} e ${quem(ev.duplo).nome} estão digitando…` : `${quem(ev.de).nome} ${ev.t === 'stk' ? 'está escolhendo uma figurinha…' : 'está digitando…'}`; subG.classList.add('ativo');
        await z(ev.rapido && !ev.rajada ? t * 0.5 : t);
      } else if (ev.t === 'vote') await z(650);
      else if (ev.t === 'react') await z(450);
      else await z(ev.cls === 'lance' ? 700 : 500);
      if (minha !== rodada) return;
      render(ev, true);
      if (ev.t !== 'vote') { subG.textContent = g.sub; subG.classList.remove('ativo'); }
      blip();
      chat.scrollTop = chat.scrollHeight;
      await z(ev.rajada ? 80 : ev.rapido ? 120 : 220 + Math.random() * 420);
    }
    if (minha === rodada) { subG.textContent = g.sub; subG.classList.remove('ativo'); btPlay.textContent = '▶ Ver chegando'; }
  }

  function sortear(semente) {
    const evitar = evitarPara(M.id);
    g = root.GERADOR.gerar(M, semente, opc.cenario || undefined, evitar);
    g.ev = expandir(g.ev);
    lembrar(g.memoria || [], M.id);
    phone.dataset.cenario = g.cenario;
    mostrarTudo();
    if (opc.aoSortear) opc.aoSortear(g);
  }
  btPlay.addEventListener('click', tocar);
  sortear(opc.semente || 1);
  // a conversa vai chegando quando o celular aparece na tela pela primeira vez (antes disso fica tudo à mostra)
  if (opc.tocar && 'IntersectionObserver' in window) {
    // opc.livre(): a página diz se nada cobre a conversa (a abertura do veredito fica por cima no começo)
    const livre = opc.livre || (() => true);
    let visivel = false;
    const tentar = () => { if (!phone.isConnected || rodada > 1) return; if (visivel && livre()) tocar(); else if (visivel) setTimeout(tentar, 400); };
    const io = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) { io.disconnect(); visivel = true; tentar(); } }, { threshold: 0.35 });
    io.observe(phone);
  }
  return { sortear, tocar };
}

root.ZapConversa = { montar };
})(typeof window !== 'undefined' ? window : globalThis);
