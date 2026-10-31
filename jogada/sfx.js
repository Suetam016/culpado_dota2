// Sons da jogada, sintetizados no navegador com WebAudio. Nenhum arquivo de áudio, nada tirado do jogo.
// Uso:
//   SFX.desbloquear()                       // no primeiro clique (exigência dos navegadores)
//   const s = SFX.tocar('pudge_rot', { volume: 1, duracao_ms: 6000 })   // devolve { parar() }
//   SFX.velocidade = 0.3                    // câmera lenta: sons novos saem mais graves e lentos
//   SFX.mudo = true
// Todo impacto tem três camadas (grave, material, estalo), como manda o estilo.md.
(function () {
  let ctx = null, mestre = null, ruido = null;
  const SFX = { velocidade: 1, mudo: false, volume: 0.6 };

  function iniciar(c) {
    ctx = c;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    mestre = ctx.createGain(); mestre.gain.value = SFX.volume;
    mestre.connect(comp); comp.connect(ctx.destination);
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    ruido = b;
  }
  SFX.desbloquear = function () {
    if (!ctx) iniciar(new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
  };
  // para teste offline (Playwright): SFX._usarContexto(new OfflineAudioContext(...))
  SFX._usarContexto = iniciar;

  // ---------- blocos ----------
  const k = () => 1 / Math.max(0.2, SFX.velocidade);          // estica o tempo na câmera lenta
  const tom = f => f * Math.max(0.5, Math.pow(SFX.velocidade, 0.35)); // e desce o tom
  function env(g, t, a, pico, d, fim = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + a * k());
    g.gain.exponentialRampToValueAtTime(fim, t + (a + d) * k());
  }
  function saida(vol, alvo) { const g = ctx.createGain(); g.gain.value = vol; g.connect(alvo); return g; }
  function osc(tipo, f0, f1, t, a, pico, d, alvo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(tom(f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(tom(f1), t + (a + d) * k());
    env(g, t, a, pico, d); o.connect(g); g.connect(alvo);
    o.start(t); o.stop(t + (a + d) * k() + 0.05); return o;
  }
  function chiado(filtro, f0, f1, q, t, a, pico, d, alvo) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; s.loop = true; s.playbackRate.value = SFX.velocidade < 1 ? 0.7 : 1;
    f.type = filtro; f.Q.value = q; f.frequency.setValueAtTime(tom(f0), t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(tom(f1), t + (a + d) * k());
    env(g, t, a, pico, d); s.connect(f); f.connect(g); g.connect(alvo);
    s.start(t, Math.random()); s.stop(t + (a + d) * k() + 0.05); return s;
  }
  // impacto em três camadas
  function pancada(t, alvo, { grave = 70, material = 900, estalo = 4000, forca = 1 } = {}) {
    osc('sine', grave * 2, grave * 0.6, t, 0.004, 0.9 * forca, 0.28, alvo);
    chiado('bandpass', material, material * 0.6, 3, t, 0.002, 0.6 * forca, 0.16, alvo);
    chiado('highpass', estalo, estalo, 0.7, t, 0.001, 0.35 * forca, 0.04, alvo);
  }
  function metal(t, f, alvo, vol = 0.25, d = 0.35) {   // tilintar inarmônico
    [1, 2.76, 5.4].forEach((m, i) => osc('triangle', f * m, f * m * 0.98, t, 0.002, vol / (i + 1), d / (i * 0.5 + 1), alvo));
  }
  function elos(t, n, intervalo, alvo, f0, f1) {      // corrente: muitos tilintares curtos
    for (let i = 0; i < n; i++) {
      const ti = t + i * intervalo * k(), f = f0 + (f1 - f0) * (i / n);
      chiado('bandpass', f, f, 9, ti, 0.001, 0.7, 0.03, alvo);
      metal(ti, f * 0.5 + Math.random() * 80, alvo, 0.14, 0.06);
    }
  }
  // som contínuo: devolve parar() com fade de 150 ms
  function continuo(vol, montar, duracao_ms) {
    const t = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    g.connect(mestre);
    const fontes = montar(g, t);
    let parado = false;
    const parar = () => {
      if (parado) return; parado = true;
      const a = ctx.currentTime; g.gain.cancelScheduledValues(a); g.gain.setValueAtTime(g.gain.value || 0.0001, a);
      g.gain.exponentialRampToValueAtTime(0.0001, a + 0.15);
      fontes.forEach(f => { try { f.stop(a + 0.2); } catch (e) {} });
    };
    if (duracao_ms) setTimeout(parar, duracao_ms * k());
    return { parar };
  }
  function loopRuido(filtro, f, q) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter();
    s.buffer = ruido; s.loop = true; fl.type = filtro; fl.frequency.value = tom(f); fl.Q.value = q;
    s.connect(fl); return { s, fl };
  }

  // ---------- os sons ----------
  const SONS = {
    // TP: brilho que sobe durante o canal
    tp_canal(vol, o) {
      return continuo(vol * 0.5, (g, t) => {
        const dur = (o.duracao_ms || 3000) / 1000 * k();
        const a = ctx.createOscillator(), b = ctx.createOscillator(), trem = ctx.createOscillator(), tg = ctx.createGain(), mix = ctx.createGain();
        a.type = 'sine'; b.type = 'sine';
        a.frequency.setValueAtTime(tom(220), t); a.frequency.exponentialRampToValueAtTime(tom(660), t + dur);
        b.frequency.setValueAtTime(tom(331), t); b.frequency.exponentialRampToValueAtTime(tom(990), t + dur);
        trem.frequency.value = 9; tg.gain.value = 0.35; mix.gain.value = 0.5;
        trem.connect(tg); tg.connect(mix.gain); a.connect(mix); b.connect(mix); mix.connect(g);
        const { s, fl } = loopRuido('bandpass', 3000, 6); const ng = ctx.createGain(); ng.gain.value = 0.15; fl.connect(ng); ng.connect(g);
        fl.frequency.exponentialRampToValueAtTime(tom(7000), t + dur);
        [a, b, trem, s].forEach(x => x.start(t));
        return [a, b, trem, s];
      }, o.duracao_ms || 3000);
    },
    tp_chegada(vol, o, t, g) {
      chiado('bandpass', 400, 4000, 1.5, t, 0.15, 0.5, 0.2, g);       // whoosh
      osc('sine', 880, 880, t + 0.18 * k(), 0.002, 0.35, 0.9, g);     // sino
      osc('sine', 1320, 1320, t + 0.18 * k(), 0.002, 0.18, 0.7, g);
      pancada(t + 0.18 * k(), g, { grave: 60, material: 600, estalo: 5000, forca: 0.6 });
    },
    tp_cancelado(vol, o, t, g) {
      osc('sawtooth', 700, 120, t, 0.002, 0.25, 0.35, g);             // energia caindo
      for (let i = 0; i < 6; i++) metal(t + (0.02 + i * 0.035) * k(), 1800 + Math.random() * 1500, g, 0.12, 0.2); // vidro quebrando
      chiado('highpass', 5000, 3000, 1, t, 0.002, 0.4, 0.25, g);
    },
    // Hook: lançamento (zunido + corrente)
    pudge_meat_hook(vol, o, t, g) {
      osc('sawtooth', 160, 110, t, 0.02, 0.15, 0.14, g);              // grunhido da antecipação
      chiado('bandpass', 300, 2200, 2, t + 0.14 * k(), 0.08, 0.8, 0.5, g); // zunido
      elos(t + 0.14 * k(), 14, 0.045, g, 2600, 3600);
    },
    pudge_hook_acerto(vol, o, t, g) {
      pancada(t, g, { grave: 55, material: 700, estalo: 4500, forca: 1.2 });
      metal(t, 420, g, 0.35, 0.6);                                    // clangue
      chiado('lowpass', 900, 300, 1, t + 0.02, 0.01, 0.4, 0.22, g);   // carne
    },
    pudge_hook_puxa(vol, o, t, g) {
      elos(t, 18, 0.05, g, 3400, 2000);
      chiado('bandpass', 1200, 400, 1.5, t, 0.05, 0.6, 0.85, g);      // arrasto
    },
    // Rot: borbulha grave contínua
    pudge_rot(vol, o) {
      return continuo(vol * 0.55, (g, t) => {
        const { s, fl } = loopRuido('lowpass', 380, 4), lfo = ctx.createOscillator(), lg = ctx.createGain(), am = ctx.createGain();
        lfo.frequency.value = 5.5; lg.gain.value = 220; lfo.connect(lg); lg.connect(fl.frequency);
        am.gain.value = 0.8; fl.connect(am); am.connect(g);
        const zumbido = ctx.createOscillator(), zg = ctx.createGain(); zumbido.type = 'sawtooth'; zumbido.frequency.value = tom(48); zg.gain.value = 0.06;
        const zf = ctx.createBiquadFilter(); zf.type = 'lowpass'; zf.frequency.value = 200; zumbido.connect(zf); zf.connect(zg); zg.connect(g);
        // bolhas estourando
        const dur = (o.duracao_ms || 6000) / 1000 * k();
        for (let x = 0.1; x < dur; x += 0.12 + Math.random() * 0.25) osc('sine', 300 + Math.random() * 500, 900, t + x, 0.003, 0.12, 0.05, g);
        [s, lfo, zumbido].forEach(x => x.start(t));
        return [s, lfo, zumbido];
      }, o.duracao_ms || 6000);
    },
    // Dismember: rosnado + mastigadas a cada 1 s
    pudge_dismember(vol, o) {
      return continuo(vol * 0.7, (g, t) => {
        const r = ctx.createOscillator(), rf = ctx.createBiquadFilter(), rg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        r.type = 'sawtooth'; r.frequency.value = tom(62); rf.type = 'lowpass'; rf.frequency.value = 420; rg.gain.value = 0.25;
        lfo.frequency.value = 11; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(rg.gain);
        r.connect(rf); rf.connect(rg); rg.connect(g);
        const dur = (o.duracao_ms || 3600) / 1000 * k();
        for (let x = 0; x < dur; x += 1 * k()) {                       // pulso por segundo
          chiado('bandpass', 1400, 500, 2, t + x, 0.004, 0.55, 0.18, g);
          osc('sine', 110, 50, t + x, 0.003, 0.5, 0.2, g);
          chiado('highpass', 3500, 3500, 1, t + x + 0.05, 0.001, 0.2, 0.03, g);
        }
        [r, lfo].forEach(x => x.start(t));
        return [r, lfo];
      }, o.duracao_ms || 3600);
    },
    pudge_flesh_heap(vol, o, t, g) {
      osc('sine', 90, 160, t, 0.01, 0.6, 0.25, g);                    // infla
      chiado('lowpass', 700, 250, 2, t, 0.01, 0.4, 0.3, g);           // squish
      osc('sine', 140, 140, t + 0.1 * k(), 0.05, 0.12, 1.2, g);       // zumbido da bolha
    },
    morte(vol, o, t, g) {
      pancada(t, g, { grave: 45, material: 500, estalo: 3500, forca: 1.3 });
      osc('sawtooth', 220, 55, t + 0.05, 0.02, 0.2, 0.9, g);          // gemido descendo
      // cabeção quicando: dois toques, o segundo menor
      [0.55, 0.85].forEach((x, i) => { osc('sine', 180 - i * 30, 70, t + x * k(), 0.003, 0.5 / (i + 1), 0.15, g); chiado('lowpass', 800, 300, 1, t + x * k(), 0.002, 0.25 / (i + 1), 0.08, g); });
    },
    // Time Walk: chiado ao contrário + tique-taque + vidro
    faceless_void_time_walk(vol, o, t, g) {
      chiado('bandpass', 300, 5000, 2, t, 0.35, 0.5, 0.05, g);        // sobe e corta (som "ao contrário")
      for (let i = 0; i < 6; i++) chiado('highpass', 6000, 6000, 1, t + i * 0.06 * k(), 0.001, 0.25, 0.015, g);
      osc('sine', 1568, 1568, t + 0.4 * k(), 0.002, 0.25, 0.8, g);
      osc('sine', 2093, 2093, t + 0.42 * k(), 0.002, 0.15, 0.7, g);
    },
    // Chronosphere: estrondo + o mundo para (drone grave + relógio parando)
    faceless_void_chronosphere(vol, o, t, g) {
      pancada(t + 0.16 * k(), g, { grave: 38, material: 300, estalo: 2500, forca: 1.4 });
      chiado('lowpass', 2000, 120, 1, t, 0.15, 0.6, 0.6, g);          // sucção antes do domo
      const dur = (o.duracao_ms || 4000) / 1000;
      osc('sine', 55, 52, t + 0.16 * k(), 0.2, 0.45, dur, g);         // drone
      osc('triangle', 110, 104, t + 0.16 * k(), 0.3, 0.12, dur, g);
      for (let i = 0; i < 5; i++) chiado('highpass', 5000, 5000, 1, t + (0.4 + i * (0.25 + i * 0.12)) * k(), 0.001, 0.2, 0.02, g); // tique-taque desacelerando
      osc('sine', 784, 780, t + 0.16 * k(), 0.002, 0.2, 2.5, g);       // sino longo
    },
    void_ataque(vol, o, t, g) {
      chiado('bandpass', 500, 1800, 2, t, 0.1, 0.35, 0.08, g);        // maça cortando o ar
      pancada(t + 0.12 * k(), g, { grave: 80, material: 1100, estalo: 4000, forca: 0.7 });
    },
    void_critico(vol, o, t, g) {
      pancada(t, g, { grave: 50, material: 800, estalo: 5000, forca: 1.4 });
      metal(t, 520, g, 0.3, 0.5);
      osc('sine', 1046, 1046, t, 0.002, 0.15, 0.5, g);                // brilho roxo
    },
  };

  SFX.tocar = function (nome, op = {}) {
    if (!ctx || SFX.mudo || !SONS[nome]) return { parar() {} };
    mestre.gain.value = SFX.volume;
    const vol = op.volume == null ? 1 : op.volume, fn = SONS[nome];
    if (fn.length <= 2) return fn(vol, op);                           // contínuo
    const g = saida(vol, mestre); fn(vol, op, ctx.currentTime + 0.005, g);
    return { parar() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.04); } };
  };
  SFX.nomes = Object.keys(SONS);
  window.SFX = SFX;
})();
