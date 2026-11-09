/* Feedback por voz: a pessoa fala e o navegador transcreve no próprio campo de texto.
   Usa a Web Speech API (SpeechRecognition): grátis, sem servidor nosso e sem chave. Funciona no Chrome
   (computador e Android), Edge e Safari; no Firefox não existe, então o botão nem aparece e fica só o texto.
   O texto transcrito vai pelo mesmo POST /feedback de sempre (cai em feedback/ do mesmo jeito), com via: "voz".
   Usado pela home (index.html) e pelo /ranking/ (app.js). GTM: botão .fb-falar (#fb-falar no ranking), data-gtm="feedback-voz". */
(function () {
  const Reconhecer = window.SpeechRecognition || window.webkitSpeechRecognition;

  // ligarVozFeedback(campo, antesDe) põe o botão de falar antes do elemento `antesDe` e devolve { usouVoz(), parar() }.
  window.ligarVozFeedback = function (campo, antesDe) {
    const vazio = { usouVoz: () => false, parar: () => {}, zerar: () => {} };
    if (!Reconhecer || !campo || !antesDe) return vazio;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'fb-falar';
    botao.setAttribute('data-gtm', 'feedback-voz');
    botao.setAttribute('aria-pressed', 'false');
    const aviso = document.createElement('p');
    aviso.className = 'fb-voz-aviso';
    aviso.setAttribute('role', 'status');
    antesDe.parentNode.insertBefore(botao, antesDe);
    antesDe.parentNode.insertBefore(aviso, antesDe);

    let rec = null, gravando = false, usou = false, base = '', partes = [];
    const pintar = () => {
      botao.textContent = gravando ? '⏹ Parar de gravar' : '🎤 Falar em vez de escrever';
      botao.classList.toggle('gravando', gravando);
      botao.setAttribute('aria-pressed', String(gravando));
    };
    pintar();

    const juntar = (provisorio) => {
      const fala = partes.concat(provisorio ? [provisorio] : []).join(' ').replace(/\s+/g, ' ').trim();
      campo.value = (base ? base + (fala ? ' ' : '') : '') + fala;
      campo.scrollTop = campo.scrollHeight;
    };

    const parar = () => { if (rec) { try { rec.stop(); } catch (e) { /* já parou */ } } };

    const comecar = () => {
      rec = new Reconhecer();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      base = campo.value.trim();
      partes = [];
      rec.onresult = (ev) => {
        let provisorio = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript.trim();
          if (!ev.results[i].isFinal) { provisorio += (provisorio ? ' ' : '') + t; continue; }
          // no Chrome do Android cada resultado final às vezes repete o anterior inteiro: troca em vez de somar
          const ultimo = partes[partes.length - 1];
          if (ultimo && t.toLowerCase().startsWith(ultimo.toLowerCase())) partes[partes.length - 1] = t;
          else if (t) partes.push(t);
        }
        usou = true;
        juntar(provisorio);
      };
      rec.onerror = (ev) => {
        const msg = {
          'not-allowed': 'Libera o microfone no navegador (ícone do cadeado) e tenta de novo.',
          'service-not-allowed': 'Este navegador não deixou transcrever. Tenta no Chrome ou escreve aí.',
          'no-speech': 'Não ouvi nada. Toca de novo e fala perto do microfone.',
          'audio-capture': 'Não achei microfone neste aparelho.',
          'network': 'A transcrição precisa de internet. Tenta de novo daqui a pouco.',
        }[ev.error];
        if (msg) aviso.textContent = msg;
      };
      rec.onend = () => { gravando = false; rec = null; juntar(''); pintar(); if (aviso.textContent === 'Ouvindo… fala à vontade.') aviso.textContent = usou ? 'Confere o texto e manda. Pode tocar de novo para falar mais.' : ''; };
      try {
        rec.start();
        gravando = true;
        aviso.textContent = 'Ouvindo… fala à vontade.';
      } catch (e) {
        rec = null;
        aviso.textContent = 'Não deu para ligar o microfone. Escreve aí mesmo.';
      }
      pintar();
    };

    botao.addEventListener('click', () => (gravando ? parar() : comecar()));
    return { usouVoz: () => usou, parar, zerar: () => { usou = false; aviso.textContent = ''; } };
  };
})();
