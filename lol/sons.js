// Sons do replay do LoL, feitos na hora com Web Audio (nada de áudio do jogo): abate do seu time, morte do seu time,
// objetivo (dragão, Barão, Arauto) e estrutura caindo. Lembra se o som está ligado. Só navegador: window.SonsLoL.
(function (raiz) {
  'use strict';

  const CHAVE = 'culpado-lol:som';
  let ctx = null, mestre = null, ruido = null;
  let ligado = true;
  try { ligado = localStorage.getItem(CHAVE) !== '0'; } catch (e) { /* sem armazenamento: fica ligado */ }

  // o navegador só deixa tocar depois de um clique: chame dentro do clique do play
  function preparar() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      mestre = ctx.createGain();
      mestre.gain.value = 0.35;
      mestre.connect(ctx.destination);
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function nota(freq, t0, dur, vol, tipo = 'sine', ate = null) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(mestre);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function chiado(t0, dur, vol, filtro, freq) {
    const f = ctx.createBufferSource();
    f.buffer = ruido;
    const bq = ctx.createBiquadFilter();
    bq.type = filtro;
    bq.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    f.connect(bq).connect(g).connect(mestre);
    f.start(t0);
    f.stop(t0 + dur + 0.05);
  }

  const SONS = {
    // abate do seu time: corte rápido e duas notas subindo
    abateBom: (t) => { chiado(t, 0.12, 0.5, 'highpass', 3000); nota(784, t + 0.03, 0.18, 0.3, 'triangle'); nota(1175, t + 0.1, 0.25, 0.25, 'triangle'); },
    // morte do seu time: pancada grave descendo
    abateMau: (t) => { chiado(t, 0.18, 0.6, 'lowpass', 900); nota(220, t, 0.45, 0.45, 'sawtooth', 70); },
    // objetivo: rugido grave (bom) ou o mesmo rugido mais escuro (deles)
    monstroBom: (t) => { nota(110, t, 0.9, 0.35, 'sawtooth', 55); chiado(t, 0.7, 0.25, 'bandpass', 400); nota(523, t + 0.25, 0.4, 0.2, 'sine'); nota(659, t + 0.4, 0.5, 0.2, 'sine'); },
    monstroMau: (t) => { nota(98, t, 1.0, 0.4, 'sawtooth', 45); chiado(t, 0.8, 0.3, 'bandpass', 300); },
    // estrutura caindo: desmoronar
    estruturaBom: (t) => { chiado(t, 0.6, 0.6, 'lowpass', 1400); nota(330, t + 0.05, 0.3, 0.2, 'square', 165); nota(988, t + 0.3, 0.3, 0.15, 'triangle'); },
    estruturaMau: (t) => { chiado(t, 0.7, 0.7, 'lowpass', 900); nota(196, t + 0.05, 0.5, 0.25, 'square', 80); },
  };

  // toca os eventos que passaram (no máximo 3 por vez, espaçados, para não virar barulho)
  function tocar(eventos) {
    if (!ligado || !ctx || ctx.state !== 'running' || !eventos.length) return;
    const t0 = ctx.currentTime + 0.01;
    eventos.slice(-3).forEach((e, i) => {
      const s = SONS[e.tipo + (e.bom ? 'Bom' : 'Mau')];
      if (s) s(t0 + i * 0.12);
    });
  }

  function alternar() {
    ligado = !ligado;
    try { localStorage.setItem(CHAVE, ligado ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
    if (ligado) preparar();
    return ligado;
  }

  raiz.SonsLoL = { preparar, tocar, alternar, ligado: () => ligado };
})(window);
