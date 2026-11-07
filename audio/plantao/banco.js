// Banco FECHADO do locutor do Plantão: toda fala possível é gravada uma vez só (na voz do Mat) e o site só escolhe
// e toca. Zero espera em qualquer partida, de qualquer pessoa.
//
// Para o banco ser finito, nenhuma fala tem nick ou número livre dentro:
//  - falas genéricas por tipo de lance (o grosso da variedade);
//  - "etiquetas" curtas por herói (127 heróis x 2), ditas como um grito à parte: "O Grimstroke no chão!";
//  - etiquetas dos amigos do grupo (amigos.json): "Chama a mamãe, Suéter!";
//  - números arredondados (dano de 500 a 3.000, de 100 em 100) e quantidades de 2 a 5.
// Cada lance toca 1 a 3 falas inteiras em sequência, com o rádio entre elas: nada é emendado no meio da frase.
//
// Trejeitos do apresentador de programa policial usados nas genéricas: fala com a produção ("me dá imagem",
// "volta a imagem", "segura o helicóptero"), indignação com a segurança, repetição em crescendo, conversa com quem
// está em casa ("minha senhora"), desabafo ("eu tô passando mal"), ironia ("vai chorar pra quem?"), pausa antes do grito.
(function (raiz) {
  'use strict';

  const UNI = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
    'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function extenso(n) {
    n = Math.round(n);
    if (n < 20) return UNI[n];
    if (n < 100) return DEZ[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNI[n % 10] : '');
    if (n === 100) return 'cem';
    if (n < 1000) return CEM[Math.floor(n / 100)] + (n % 100 ? ' e ' + extenso(n % 100) : '');
    const m = Math.floor(n / 1000), r = n % 1000;
    return (m === 1 ? 'mil' : extenso(m) + ' mil') + (r ? (r < 100 || r % 100 === 0 ? ' e ' : ' ') + extenso(r) : '');
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ref: trecho da voz do Mat ("c" indignado, "b" comemoração), escolhido por ele
  const GENERICAS = {
    abertura: ['c', [
      'Atenção, Brasil! Imagens exclusivas do nosso helicóptero!',
      'Me dá imagem! Me dá imagem! Olha isso, minha senhora!',
      'Segura o helicóptero aí em cima! Tem gente invadindo a base!',
      'Você que tá em casa, pode largar o almoço!',
      'Interrompemos a programação! Fecha nele, fecha nele!',
      'Olha... olha... OLHA! Ao vivo, Brasil!',
    ]],
    abate: ['c', [
      'Cê pê efe cancelado!',
      'Caiu! Caiu! Caiu!',
      'Volta a imagem! Volta a imagem!',
      'Fatiou! Vai chorar pra quem agora?',
      'Coitadinho... virou estatística!',
      'Mais um! Mais um! Não volta pra casa hoje!',
      'Eu tô passando mal! Na frente das câmeras!',
      'Botou pra mamar, minha gente!',
    ]],
    abate2: ['c', [
      'De novo! De novo!',
      'Outro! Não para, não para, não para!',
      'Até quando, Brasil? Até quando?',
      'Acabou a brincadeira!',
      'Virou freguês!',
      'Me dá o replay disso!',
      'Mais um pro caderninho!',
      'A lista só aumenta, Brasil!',
      'Olha o placar subindo!',
    ]],
    // morte com contexto (06/11, pedido do Mat: menos zoeira automática, mais leitura do lance)
    abate_solo: ['c', [
      'Sozinho! Foi no mano a mano, sem pedir ajuda!',
      'Um contra um! Encarou e levou!',
      'Ninguém ajudou! Resolveu sozinho, minha gente!',
      'Solou! Solou! Sem dó nem piedade!',
    ]],
    abate_pickoff: ['c', [
      'Tava desgarrado! Andando sozinho na selva, olha o que dá!',
      'Pegou o desgarrado! Quem manda passear sozinho?',
      'Pegou o coitado longe do time! Ninguém veio salvar!',
      'Saiu sozinho pra farmar... e não voltou mais!',
    ]],
    abate_luta: ['c', [
      'No meio da pancadaria! Foi no bolo!',
      'Briga generalizada, Brasil! E ele lá no meio!',
      'Confusão na selva! Um a menos do lado de lá!',
    ]],
    abate_torre: ['c', [
      'Debaixo da torre! Foi buscar dentro de casa!',
      'Mergulhou na torre! Isso é falta de respeito!',
      'Entrou debaixo da torre e saiu vivo! Que coragem!',
    ]],
    abate_equipe: ['c', [
      'Trabalho em equipe! Cercaram e pegaram!',
      'Foi a quadrilha toda! Não sobrou nada!',
      'Fecharam o cerco! Não tinha pra onde correr!',
    ]],
    // elogio ao jogador: 1 ou 2 por vídeo, no melhor lance (pedido do Mat)
    elogio: ['b', [
      'Esse cara é muito bom, minha gente!',
      'Que jogada absurda, Brasil! Absurda!',
      'Isso aqui é aula, minha senhora! Aula!',
      'Joga muito! Joga muito! Eu tô arrepiado!',
      'Que jogador! Me dá o replay disso, produção!',
    ]],
    torre: ['c', [
      'Caiu a torre! Cadê a segurança dessa base?',
      'Derrubou a torre! Isso é um absurdo, minha gente!',
      'A torre foi pro chão! Tá dentro da casa deles!',
      'Mais uma torre! Eu tô cansado de ver isso, Brasil!',
    ]],
    quartel: ['c', [
      'Quartel no chão! Onde é que nós vamos parar?',
      'Derrubou o quartel! E a segurança tava onde? Tava dormindo!',
      'Quartel no chão! Alguém liga pra polícia, pelo amor de Deus!',
    ]],
    torre4: ['c', [
      'Torre do trono! Não para, não para, não para!',
      'Foram as torres do trono! Tá sem freio, Brasil!',
      'As torres do trono! Eu não acredito no que eu tô vendo!',
    ]],
    skill: ['c', [
      'Mirou... soltou!',
      'Olha a skill! Olha a skill! Pegou!',
      'Fecha a câmera! Pegou em cheio!',
    ]],
    sumiu: ['c', [
      'Sumiu! Sumiu! Cadê, produção?',
      'Ficou invisível! O helicóptero perdeu! Acha, acha!',
      'Desapareceu do mapa! Isso não é possível!',
    ]],
    enquanto: ['c', [
      'Enquanto isso, o time deles faz reunião de emergência na fonte...',
      'Acelera a imagem, produção! Tão tudo escondido na fonte...',
      'Enquanto isso, ninguém tem coragem de sair da base...',
    ]],
    fim: ['b', [
      'Acabou! Acabou! O trono caiu! Botou o time inteiro na mochila!',
      'É o fim! O trono foi pro chão! Pode desligar a câmera!',
      'Acabou, Brasil! Trono no chão! Vão chorar no banho!',
      'Missão cumprida! O trono caiu! Eu tô emocionado, minha gente!',
    ]],
  };
  const QUANTOS = ['{N} de uma vez! Que isso, minha gente?', 'Pegou {n} de uma vez! Me dá o replay disso!', '{N} de uma vez só! Você que tá em casa viu isso?'];
  const NUMEROS = ['{Num} de dano num tapa só!', 'Olha o número, Brasil: {num} de dano!'];
  const HEROI = { quem: 'É {o_heroi}! {O_heroi} tá na base deles!', vitima: '{O_heroi} no chão!' };
  const AMIGO = { quem: 'É o {nick}! O {nick} não tem limite!', dono: 'Chama a mamãe, {nick}!', elogio: 'O {nick} fez uma jogada absurda! Que jogador!' };
  // nick do jeito que se fala (o TTS não lê número, colchete nem sigla grudada)
  const FALADO = { '3rvinha': 'Ervinha', 'ptn': 'pê tê ene', '[Pau]DeCamelo': 'Pau de Camelo', 'gustavoDotinhaPro': 'Gustavo Dotinha Pró' };

  const FEM = new Set(['mirana', 'drow_ranger', 'crystal_maiden', 'lina', 'windrunner', 'luna', 'medusa', 'templar_assassin',
    'vengefulspirit', 'death_prophet', 'queenofpain', 'phantom_assassin', 'spectre', 'naga_siren', 'enchantress', 'broodmother',
    'legion_commander', 'winter_wyvern', 'snapfire', 'marci', 'hoodwink', 'dark_willow', 'muerta', 'ursa', 'dawnbreaker', 'lanaya',
    'mortred', 'rylai', 'night_stalker_x']);
  const art = (h) => (FEM.has(h) ? 'a' : 'o');
  const danoBalde = (v) => Math.max(500, Math.min(3000, Math.round(v / 100) * 100));

  function preencher(t, v) {
    return t.replace(/\{(\w+)\}/g, (m, k) => { const c = k.charAt(0).toLowerCase() + k.slice(1); const x = v[c]; return x == null ? m : k === c ? x : cap(x); });
  }

  // todas as falas do banco: [{id, texto, ref}]; herois = {slug: nome}, amigos = [nick]
  function todas(herois, amigos) {
    const out = [];
    for (const [tipo, [ref, fs]] of Object.entries(GENERICAS)) fs.forEach((t, i) => out.push({ id: `g.${tipo}.${i}`, texto: t, ref }));
    for (let n = 2; n <= 5; n++) QUANTOS.forEach((t, i) => out.push({ id: `n.${n}.${i}`, texto: preencher(t, { n: extenso(n) }), ref: 'c' }));
    for (let v = 500; v <= 3000; v += 100) NUMEROS.forEach((t, i) => out.push({ id: `d.${v}.${i}`, texto: preencher(t, { num: extenso(v) }), ref: 'c' }));
    for (const [h, nome] of Object.entries(herois)) for (const [k, t] of Object.entries(HEROI)) out.push({ id: `h.${h}.${k}`, texto: preencher(t, { o_heroi: `${art(h)} ${nome}` }), ref: k === 'quem' ? 'c' : 'c' });
    for (const nick of amigos) for (const [k, t] of Object.entries(AMIGO)) out.push({ id: `a.${slug(nick)}.${k}`, texto: preencher(t, { nick: FALADO[nick] || nick }), ref: 'c' });
    return out;
  }
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function sorteador(semente) {
    let s = semente >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // eventos: [{t, tipo, vitima (slug), dono (nick ou ''), n, num}]; ctx: {heroi (slug do carregador), quem (nick se for
  // amigo do grupo, senão ''), amigos: Set de nicks, semente}. Devolve [{t, ids: [id, ...]}]: falas inteiras em sequência.
  function montar(eventos, ctx) {
    const rnd = sorteador(ctx.semente || 1);
    const usadas = {};
    const tira = (tipo) => {
      const fs = GENERICAS[tipo][1];
      let livres = fs.map((f, i) => i).filter((i) => !(usadas[tipo] || []).includes(i));
      if (!livres.length) { usadas[tipo] = []; livres = fs.map((f, i) => i); }
      const i = livres[Math.floor(rnd() * livres.length)];
      (usadas[tipo] = usadas[tipo] || []).push(i);
      return `g.${tipo}.${i}`;
    };
    const amigo = (nick) => nick && ctx.amigos && ctx.amigos.has(nick);
    const tem = (id) => !ctx.tem || ctx.tem(id); // só fala que já foi gravada
    let abates = 0; let mamae = false; let calado = 0;
    const saida = eventos.map((e) => {
      const ids = [];
      if (e.tipo === 'abertura') {
        ids.push(tira('abertura'));
        ids.push(amigo(ctx.quem) && rnd() < 0.6 ? `a.${slug(ctx.quem)}.quem` : `h.${ctx.heroi}.quem`);
      } else if (e.tipo === 'abate') {
        // nem toda morte ganha fala (no máximo 2 seguidas), e o lance é lido pelo contexto: solado, pick-off, briga,
        // debaixo da torre ou em equipe. A zoeira do amigo ("chama a mamãe") sai uma vez só por sorteio.
        const primeiro = !abates++;
        if (!primeiro && calado < 1 && abates > 2 && rnd() < 0.45) { calado++; return { t: e.t, tipo: e.tipo, ids }; }
        calado = 0;
        const tipoCtx = e.ctx && GENERICAS[`abate_${e.ctx}`] ? `abate_${e.ctx}` : null;
        const ctxId = tipoCtx ? tira(tipoCtx) : null;
        const ctxOk = ctxId && tem(ctxId);
        if (ctxOk && rnd() < 0.75) ids.push(ctxId);
        else ids.push(tira(primeiro ? 'abate' : 'abate2'));
        if (rnd() < 0.6) ids.push(`h.${e.vitima}.vitima`);
        if (amigo(e.dono) && !mamae && rnd() < 0.5) { mamae = true; ids.push(`a.${slug(e.dono)}.dono`); }
      } else if (e.tipo === 'varios') ids.push(`n.${Math.max(2, Math.min(5, e.n))}.${Math.floor(rnd() * QUANTOS.length)}`);
      else if (e.tipo === 'dano') ids.push(`d.${danoBalde(e.num)}.${Math.floor(rnd() * NUMEROS.length)}`);
      else if (GENERICAS[e.tipo]) ids.push(tira(e.tipo));
      return { t: e.t, tipo: e.tipo, ids };
    });
    // elogio no melhor lance (vários de uma vez > dano grande > abate a partir do 2º), no máximo 2 e longe um do outro
    const nota = { varios: 3, dano: 2, abate: 1 };
    const cand = saida.map((x, i) => ({ x, i, p: (nota[x.tipo] || 0) + (x.tipo === 'abate' && i === saida.findIndex((y) => y.tipo === 'abate') ? -1 : 0) }))
      .filter((c) => c.p > 0 && c.x.ids.length).sort((a, b) => b.p - a.p || rnd() - 0.5);
    const escolhidos = [];
    for (const c of cand) { if (escolhidos.length >= 2) break; if (escolhidos.some((o) => Math.abs(o.i - c.i) < 3)) continue; escolhidos.push(c); }
    escolhidos.forEach((c, k) => {
      const meu = amigo(ctx.quem) && k === 0 && `a.${slug(ctx.quem)}.elogio`;
      const id = meu && tem(meu) ? meu : tira('elogio');
      if (!tem(id)) return;
      if (c.x.ids.length >= 3) c.x.ids.pop();
      c.x.ids.push(id);
    });
    return saida;
  }

  const API = { GENERICAS, QUANTOS, NUMEROS, HEROI, AMIGO, todas, montar, extenso, slug };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.BancoPlantao = API;
})(typeof window !== 'undefined' ? window : globalThis);
