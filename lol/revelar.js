// A revelação do culpado no LoL, igual à do Dota: os 5 do time giram como cartas e saem um a um, do menos culpado
// para o mais, no ritmo do som da abertura (../som/abertura.mp3), até sobrar o culpado na cor da raridade do crime.
// A partir do B.O. toca o alarme do nível (../som/alarme-*.mp3). Só navegador: window.RevelarLoL(opcoes) → Promise.
(function (raiz) {
  'use strict';

  const AUDIO_ABERTURA = '../som/abertura.mp3';
  const ALARMES = ['../som/alarme-procurado.mp3', '../som/alarme-bo.mp3', '../som/alarme-interpol.mp3', '../som/alarme-haia.mp3', '../som/alarme-tribunal.mp3'];
  const ALARME_MAX = 12;
  // marcos em segundos no áudio da abertura: onde cai cada carta, a parada e a batida
  const ABERTURA = { para: 9.45, revela: 10.1, fecha: 12.4 };
  const SEM_SOM = 1.6; // sem áudio, a mesma coreografia corre mais rápido
  const VOLUME = 0.6;

  function marcosDeSaida(n) {
    if (n === 4) return [2.25, 4.25, 6.7, 8.5];
    if (n === 3) return [2.75, 5.35, 8.5];
    return Array.from({ length: n }, (_, i) => (n === 1 ? 5.35 : 2.25 + (i * (8.5 - 2.25)) / (n - 1)));
  }

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function alarmeDoNivel(nivel) {
    if (!ALARMES[nivel]) return null;
    const a = new Audio(ALARMES[nivel]);
    a.preload = 'auto';
    a.volume = VOLUME;
    let ok = true;
    a.addEventListener('error', () => { ok = false; });
    return {
      tocar() { if (!ok) return 0; a.play().catch(() => {}); return Number.isFinite(a.duration) ? Math.min(ALARME_MAX, a.duration) : 0; },
      // celular: o áudio só toca depois de um toque; destrava o arquivo dentro do toque para tocar depois
      destravar() { a.muted = true; a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); },
      parar() { const p = () => { a.volume = Math.max(0, a.volume - 0.1); if (a.volume > 0.01) setTimeout(p, 35); else a.pause(); }; p(); },
    };
  }

  // opcoes: { jogadores: [{ id, rosto (html), peso }], culpado: id, nome, nivel, cor, crime, som (bool),
  //          e na vitória: finais (ids que ficam), titulo, final (o título no fim), alarme: false }
  function revelar(o) {
    return new Promise((resolve) => {
      const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const finais = o.finais || [o.culpado];
      const ordemSaida = o.jogadores.filter((p) => !finais.includes(p.id)).sort((a, b) => a.peso - b.peso);

      const ov = el('div', 'lrev');
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-label', 'Revelação do culpado');
      ov.style.setProperty('--raridade', o.cor);
      const titulo = el('p', 'lrev-titulo', o.titulo || 'O tribunal está reunido');
      const raios = el('div', 'lrev-raios');
      const fila = el('div', 'lrev-fila');
      const palco = el('div', 'lrev-palco');
      palco.setAttribute('aria-hidden', 'true');
      palco.append(raios, fila);
      const nome = el('p', 'lrev-nome', '');
      const selo = el('p', 'lrev-selo', '');
      const pular = el('button', 'lrev-pular', 'Pular');
      pular.type = 'button';
      ov.append(titulo, palco, nome, selo, pular);
      const cartas = o.jogadores.map((p, i) => {
        const gira = el('div', 'lrev-gira', `<div class="lrev-face lrev-frente">${p.rosto}<span class="lrev-x">✕</span></div><div class="lrev-face lrev-verso"><span>⚖</span></div>`);
        const c = el('div', 'lrev-carta');
        c.append(gira);
        fila.append(c);
        return { p, el: c, gira, vivo: true, ang: i * 47 };
      });
      document.body.append(ov);

      let fim = false;
      let quadro = 0;
      const relogios = [];
      let audio = o.som ? new Audio(AUDIO_ABERTURA) : null;
      if (audio) audio.volume = VOLUME;
      const alarme = o.som && o.alarme !== false ? alarmeDoNivel(o.nivel) : null;
      let alarmeTocando = null;
      let tocando = false;
      const calar = () => {
        if (!audio) return;
        const a = audio;
        const p = () => { a.volume = Math.max(0, a.volume - 0.08); if (a.volume > 0.01) setTimeout(p, 40); else a.pause(); };
        p();
      };
      const terminar = () => {
        if (fim) return;
        fim = true;
        calar();
        if (alarmeTocando) alarmeTocando.parar();
        cancelAnimationFrame(quadro);
        relogios.forEach(clearTimeout);
        ov.classList.add('saindo');
        document.removeEventListener('keydown', tecla);
        setTimeout(() => { ov.remove(); resolve(); }, 450);
      };
      const tecla = (e) => { if (e.key === 'Escape') terminar(); };
      document.addEventListener('keydown', tecla);
      pular.addEventListener('click', terminar);

      // sem um toque na página (link aberto direto) o navegador bloqueia o som: pede um toque antes de girar
      let pronto = Promise.resolve();
      if (audio) {
        pronto = audio.play().then(() => { tocando = !fim; }).catch(() => new Promise((ok) => {
          const botao = el('button', 'lrev-tocar', '🔊 Toque para abrir');
          botao.type = 'button';
          palco.append(botao);
          palco.removeAttribute('aria-hidden');
          let foi = false;
          const seguir = (comSom) => {
            if (foi) return;
            foi = true;
            botao.remove();
            if (comSom && audio) {
              if (alarme) alarme.destravar();
              audio.play().then(() => { tocando = !fim; }).catch(() => { audio = null; }).finally(ok);
            } else { audio = null; ok(); }
          };
          botao.addEventListener('click', () => seguir(true));
          relogios.push(setTimeout(() => seguir(false), 15000));
        }));
      }

      const mostrarFinal = () => {
        ov.classList.add('revelado');
        if (o.nivel >= 1 && alarme) ov.classList.add(o.nivel >= 4 ? 'nuclear' : 'policia');
        titulo.textContent = o.final || 'Culpado!';
        nome.textContent = o.nome;
        nome.setAttribute('aria-live', 'polite');
        selo.textContent = `★ ${o.crime} ★`;
        cartas.forEach((c) => c.el.classList.toggle('vencedor', finais.includes(c.p.id)));
        const dur = alarme ? alarme.tocar() : 0;
        alarmeTocando = alarme;
        // no Procura-se e no Tribunal o alarme entra no lugar do fim da abertura
        if (dur && (o.nivel === 0 || o.nivel >= 4) && audio) { audio.pause(); audio = null; }
        const resta = Math.max((ABERTURA.fecha - ABERTURA.revela) / (tocando ? 1 : SEM_SOM), dur ? dur + 0.3 : 0);
        relogios.push(setTimeout(terminar, reduz && !dur ? 900 : resta * 1000));
      };

      if (reduz) {
        cartas.forEach((c) => { if (!finais.includes(c.p.id)) c.el.hidden = true; });
        pronto.then(() => { if (!fim) mostrarFinal(); });
        return;
      }

      const saidas = marcosDeSaida(ordemSaida.length);
      const D_PARA = 0.85;
      const T_PARA = ABERTURA.para - D_PARA;
      const W_MAX = 1080; // graus por segundo
      const W_MIN = 380;
      let antes = 0;
      let proxElim = 0;
      let parada = null;
      let tRel = 0;
      let revelado = false;
      const passo = (agora) => {
        if (fim) return;
        const dtReal = Math.min(0.05, (agora - antes) / 1000);
        antes = agora;
        tRel = tocando && audio ? Math.max(tRel, audio.currentTime) : tRel + dtReal * SEM_SOM;
        const t = tRel;
        const dt = dtReal * (tocando && audio ? 1 : SEM_SOM);
        while (proxElim < ordemSaida.length && t >= saidas[proxElim]) {
          const c = cartas.find((x) => x.p === ordemSaida[proxElim]);
          c.vivo = false;
          c.el.classList.add('fora');
          proxElim++;
        }
        const vivas = cartas.filter((c) => c.vivo);
        if (t < T_PARA) {
          const w = t < 0.4 ? W_MAX * (t / 0.4) : W_MAX - (W_MAX - W_MIN) * Math.min(1, (t - 0.4) / Math.max(0.1, T_PARA - 0.4));
          vivas.forEach((c) => { c.ang += w * dt; });
        } else {
          // para de frente: cada carta vai até a próxima volta inteira, desacelerando
          if (!parada) parada = vivas.map((c) => ({ c, de: c.ang, ate: Math.ceil((c.ang + 200) / 360) * 360 }));
          const s = Math.min(1, (t - T_PARA) / D_PARA);
          parada.forEach((x) => { x.c.ang = x.de + (x.ate - x.de) * (1 - (1 - s) ** 3); });
        }
        cartas.forEach((c) => { if (c.vivo) c.gira.style.transform = `rotateY(${c.ang.toFixed(1)}deg)`; });
        if (!revelado && t >= ABERTURA.revela) { revelado = true; mostrarFinal(); return; }
        quadro = requestAnimationFrame(passo);
      };
      pronto.then(() => { if (fim) return; antes = performance.now(); quadro = requestAnimationFrame(passo); });
    });
  }

  raiz.RevelarLoL = revelar;
})(window);
