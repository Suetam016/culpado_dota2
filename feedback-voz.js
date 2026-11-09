/* Feedback por voz: a pessoa fala e o navegador transcreve no próprio campo de texto.
   Usa a Web Speech API (SpeechRecognition): grátis, sem servidor nosso e sem chave. Funciona no Chrome
   (computador e Android), Edge e Safari; no Firefox não existe, então o botão nem aparece e fica só o texto.
   O texto transcrito vai pelo mesmo POST /feedback de sempre (cai em feedback/ do mesmo jeito), com via: "voz".
   Usado pela home (index.html) e pelo /ranking/ (app.js). GTM: botão .fb-falar (#fb-falar no ranking), data-gtm="feedback-voz".

   09/11: o navegador encerra a escuta sozinho depois de uns segundos de silêncio (no Android, a cada pausa).
   Agora a gravação religa por conta própria até a pessoa clicar em Parar (ou 3 min), e um painel mostra
   ao vivo o tempo gravando e o que está sendo ouvido. */
(function () {
  const Reconhecer = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LIMITE_MS = 3 * 60 * 1000;
  const FATAIS = {
    'not-allowed': 'O navegador bloqueou o microfone. Clica no cadeado ao lado do endereço, libera o microfone e tenta de novo.',
    'service-not-allowed': 'Este navegador não deixa transcrever voz. Tenta no Chrome, ou escreve aí.',
    'audio-capture': 'Não achei microfone neste aparelho.',
    'network': 'Este navegador não conseguiu falar com o serviço de transcrição (acontece no Brave e no Opera). Tenta no Chrome, ou escreve aí.',
    'language-not-supported': 'Este navegador não transcreve português. Tenta no Chrome, ou escreve aí.',
  };

  // ligarVozFeedback(campo, antesDe) põe o botão de falar antes do elemento `antesDe` e devolve { usouVoz(), parar(), zerar() }.
  window.ligarVozFeedback = function (campo, antesDe) {
    const vazio = { usouVoz: () => false, parar: () => {}, zerar: () => {} };
    if (!Reconhecer || !campo || !antesDe) return vazio;

    const criar = (tag, classe) => { const el = document.createElement(tag); el.className = classe; return el; };
    const botao = criar('button', 'fb-falar');
    botao.type = 'button';
    botao.setAttribute('data-gtm', 'feedback-voz');
    botao.setAttribute('aria-pressed', 'false');
    const painel = criar('div', 'fb-voz-painel');
    painel.hidden = true;
    const relogio = criar('span', 'fb-voz-relogio');
    const ouvido = criar('p', 'fb-voz-ouvido');
    ouvido.setAttribute('aria-live', 'polite');
    const topo = criar('div', 'fb-voz-topo');
    topo.append(criar('span', 'fb-voz-ponto'), relogio);
    painel.append(topo, ouvido);
    const aviso = criar('p', 'fb-voz-aviso');
    aviso.setAttribute('role', 'status');
    antesDe.parentNode.insertBefore(botao, antesDe);
    antesDe.parentNode.insertBefore(painel, antesDe);
    antesDe.parentNode.insertBefore(aviso, antesDe);

    let rec = null, querGravar = false, usou = false, base = '', antes = '', partes = [];
    let inicio = 0, tique = 0, erroFatal = '', ultimoErro = '', religadasRapidas = 0, comecouEm = 0;

    const fala = (provisorio) => [antes].concat(partes, provisorio ? [provisorio] : []).join(' ').replace(/\s+/g, ' ').trim();
    const juntar = (provisorio) => {
      const f = fala(provisorio);
      campo.value = (base ? base + (f ? ' ' : '') : '') + f;
      campo.scrollTop = campo.scrollHeight;
      ouvido.textContent = f || 'Fala que eu vou escrevendo aqui…';
      ouvido.classList.toggle('vazio', !f);
    };
    const pintar = () => {
      botao.textContent = querGravar ? '⏹ Parar e conferir' : (usou ? '🎤 Falar mais' : '🎤 Falar em vez de escrever');
      botao.classList.toggle('gravando', querGravar);
      botao.setAttribute('aria-pressed', String(querGravar));
      painel.hidden = !querGravar;
    };
    const contar = () => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      relogio.textContent = `Gravando ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (Date.now() - inicio > LIMITE_MS) parar();
    };

    const terminar = () => {
      querGravar = false;
      clearInterval(tique);
      antes = fala('');
      partes = [];
      pintar();
      if (erroFatal) aviso.textContent = erroFatal;
      else if (antes) aviso.textContent = 'Pronto! Confere o texto abaixo (pode corrigir) e clica em Enviar.';
      else aviso.textContent = 'Não captei nenhuma palavra' + (ultimoErro && ultimoErro !== 'no-speech' && ultimoErro !== 'aborted' ? ` (erro: ${ultimoErro})` : '') + '. Fala perto do microfone e tenta de novo, ou escreve aí.';
    };

    const ouvir = () => {
      rec = new Reconhecer();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      comecouEm = Date.now();
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
        if (provisorio || partes.length) usou = true;
        juntar(provisorio);
      };
      rec.onerror = (ev) => {
        ultimoErro = ev.error || '';
        if (FATAIS[ultimoErro]) erroFatal = FATAIS[ultimoErro];
      };
      rec.onend = () => {
        rec = null;
        antes = fala('');
        partes = [];
        juntar('');
        if (!querGravar || erroFatal) { terminar(); return; }
        // o navegador parou sozinho (silêncio, pausa): religa, a não ser que esteja caindo sem parar
        religadasRapidas = Date.now() - comecouEm < 1000 ? religadasRapidas + 1 : 0;
        if (religadasRapidas >= 5) { terminar(); return; }
        try { ouvir(); } catch (e) { terminar(); }
      };
      rec.start();
    };

    const parar = () => {
      querGravar = false;
      if (rec) { try { rec.stop(); } catch (e) { terminar(); } } else terminar();
    };

    const comecar = () => {
      base = campo.value.trim();
      antes = ''; partes = []; erroFatal = ''; ultimoErro = ''; religadasRapidas = 0;
      querGravar = true;
      inicio = Date.now();
      contar();
      tique = setInterval(contar, 250);
      aviso.textContent = 'Fala à vontade. Quando terminar, clica em Parar.';
      juntar('');
      pintar();
      try { ouvir(); } catch (e) { erroFatal = 'Não deu para ligar o microfone. Escreve aí mesmo.'; terminar(); }
    };

    pintar();
    botao.addEventListener('click', () => (querGravar ? parar() : comecar()));
    return { usouVoz: () => usou, parar: () => { if (querGravar) parar(); }, zerar: () => { usou = false; aviso.textContent = ''; pintar(); } };
  };
})();
