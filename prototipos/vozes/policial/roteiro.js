// Roteiro do locutor do Plantão (tela de vitória): falas no estilo de apresentador de programa policial da tarde,
// sorteadas por partida a partir dos lances reais. Mesmo arquivo serve ao site (navegador) e ao Node (gravação).
//
// Trejeitos do gênero que o banco usa (para variar, cada fala sorteia um deles sem repetir na mesma partida):
//  1. Fala com a produção: "me dá imagem", "segura o helicóptero", "fecha nela", "volta a imagem".
//  2. Indignação com a segurança do lugar: "cadê a segurança?", "até quando?", "isso é um absurdo".
//  3. Repetição em crescendo: "não para, não para, não para!".
//  4. Conversa com quem está em casa: "minha senhora, meu senhor", "você que tá em casa", "olha isso, Brasil".
//  5. Desabafo pessoal: "eu tô cansado", "eu não aguento", "eu tô passando mal".
//  6. Urgência de ao vivo e de exclusiva: "atenção", "ao vivo", "imagens exclusivas".
//  7. Ironia com quem apanha: "coitadinho", "vai chorar pra quem?", "chama a mamãe".
//  8. Pausa dramática antes do grito: "olha... olha... OLHA!".
// O protagonista é tratado como suspeito à solta na base inimiga; a indignação é com a "segurança" dos inimigos.
//
// ref: trecho da voz do Mat usado na gravação ("c" = indignado, escolhido para abertura e abate; "b" = comemoração,
// escolhido para o fim). Ver prototipos/vozes/policial/ref_*.wav.
(function (raiz) {
  'use strict';

  const UNI = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
    'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  // número por extenso (o TTS lê melhor que algarismo)
  function extenso(n) {
    n = Math.round(n);
    if (n < 20) return UNI[n];
    if (n < 100) return DEZ[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNI[n % 10] : '');
    if (n === 100) return 'cem';
    if (n < 1000) return CEM[Math.floor(n / 100)] + (n % 100 ? ' e ' + extenso(n % 100) : '');
    if (n < 1000000) {
      const m = Math.floor(n / 1000), r = n % 1000;
      return (m === 1 ? 'mil' : extenso(m) + ' mil') + (r ? (r < 100 || r % 100 === 0 ? ' e ' : ' ') + extenso(r) : '');
    }
    return String(n);
  }

  // {quem} = nick de quem carregou, {heroi} = herói dele, {vitima} = herói abatido, {dono} = nick do abatido,
  // {lado} = time inimigo, {num} = número por extenso, {n} = quantidade por extenso, {skill} = nome da skill
  const BANCO = {
    abertura: { ref: 'c', falas: [
      'Atenção, Brasil! Imagens exclusivas do nosso helicóptero: {o_heroi} do {quem} tá {solta} na base dos {lado}!',
      'Me dá imagem! Me dá imagem! Olha isso, minha senhora: {o_heroi} do {quem} invadiu a base dos {lado} ao vivo!',
      'Segura o helicóptero aí em cima! Tem {um_heroi} do {quem} dentro da base dos {lado} e ninguém faz nada!',
      'Você que tá em casa, pode largar o almoço: o {quem} entrou na base dos {lado} de {heroi}!',
      'Interrompemos a programação! O {quem} tá aprontando na base dos {lado}! Fecha nele, fecha nele!',
      'Olha... olha... OLHA! É o {quem} de {heroi} na base dos {lado}! Ao vivo, Brasil!',
    ] },
    abate: { ref: 'c', falas: [
      'Cê pê efe cancelado! {O_vitima} do {dono} tá no chão!',
      'Caiu! Caiu! {O_vitima} do {dono} caiu! Chama a mamãe, {dono}!',
      'Volta a imagem! Volta a imagem! Olha {o_vitima} do {dono} indo pro chão!',
      '{O_vitima} do {dono} foi fatiado! Vai chorar pra quem agora?',
      'Coitadinho do {dono}... {o_vitima} dele virou estatística!',
      'Mais um! Mais um! {O_vitima} do {dono} não volta pra casa hoje!',
      'Eu tô passando mal! Derrubou {o_vitima} do {dono} na frente das câmeras!',
    ] },
    abate2: { ref: 'c', falas: [
      '{O_vitima} no chão também! Virou freguês!',
      'De novo! De novo! {O_vitima} levou outra!',
      'Outro! {Ela} não para, não para, não para!',
      'Até quando, Brasil? Até quando? Mais um: {o_vitima}!',
      '{O_vitima} caiu! Acabou a brincadeira!',
    ] },
    torre: { ref: 'c', falas: [
      'Caiu a torre! Cadê a segurança dessa base?',
      'Derrubou a torre! Isso é um absurdo, minha gente!',
      'A torre foi pro chão! Tá dentro da casa deles!',
      'Mais uma torre! Eu tô cansado de ver isso, Brasil!',
    ] },
    quartel: { ref: 'c', falas: [
      'Quartel no chão! Onde é que nós vamos parar?',
      'Derrubou o quartel! E a segurança tava onde? Tava dormindo!',
      'Quartel no chão! Alguém liga pra polícia, pelo amor de Deus!',
    ] },
    torre4: { ref: 'c', falas: [
      'Torre do trono! Não para, não para, não para!',
      'Foram as torres do trono! Tá sem freio, Brasil!',
      'As duas torres do trono! Eu não acredito no que eu tô vendo!',
    ] },
    skill: { ref: 'c', falas: [
      'Mirou... soltou {skill}!',
      'Olha {skill}! Olha {skill}! Pegou!',
      'Fecha a câmera! Soltou {skill}!',
    ] },
    varios: { ref: 'c', falas: [
      '{Skill} em cima de {n}! Que isso, minha gente?',
      'Pegou {n} de uma vez! Me dá o replay disso!',
      '{N} de uma vez só! Você que tá em casa viu isso?',
    ] },
    sumiu: { ref: 'c', falas: [
      'Sumiu! Sumiu! Cadê {ela}, produção?',
      'Ficou invisível! O helicóptero perdeu! Acha {ela}, acha {ela}!',
      'Desapareceu do mapa! Isso não é possível!',
    ] },
    dano: { ref: 'c', falas: [
      '{Num} de dano {no_vitima} num tapa só!',
      'Olha o número, Brasil: {num} de dano! Num tapa só!',
      '{Num}! Repete! {Num} de dano {no_vitima}!',
    ] },
    enquanto: { ref: 'c', falas: [
      'Enquanto isso, os {lado} fazem reunião de emergência na fonte...',
      'Acelera a imagem, produção! Os {lado} tão escondidos na fonte...',
      'Enquanto isso, ninguém dos {lado} tem coragem de sair da base...',
    ] },
    fim: { ref: 'b', falas: [
      'Acabou! Acabou! O trono caiu! {quem} botou o time inteiro na mochila!',
      'É o fim! O trono dos {lado} foi pro chão! Pode desligar a câmera, {quem} resolveu sozinho!',
      'Acabou, Brasil! Trono no chão! E os {lado}? Os {lado} vão chorar no banho!',
      'Missão cumprida! O trono caiu! Eu tô emocionado, minha gente! {quem}, você é o carregador do ano!',
    ] },
  };

  const ART = { mirana: 'a', drow_ranger: 'a', crystal_maiden: 'a', lina: 'a', windranger: 'a', luna: 'a', medusa: 'a',
    templar_assassin: 'a', vengefulspirit: 'a', death_prophet: 'a', queenofpain: 'a', phantom_assassin: 'a', spectre: 'a',
    naga_siren: 'a', enchantress: 'a', broodmother: 'a', legion_commander: 'a', winter_wyvern: 'a', snapfire: 'a',
    marci: 'a', hoodwink: 'a', dark_willow: 'a', muerta: 'a', kez: 'o', ursa: 'a', dawnbreaker: 'a', mars: 'o' };
  const art = (h) => ART[h] || 'o';
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function sorteador(semente) {
    let s = semente >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // eventos: [{t, tipo, vitima, dono, skill, n, num}] já em ordem; ctx: {quem, heroi, nomeHeroi(h), lado, semente}
  function montar(eventos, ctx) {
    const rnd = sorteador(ctx.semente || 1);
    const usadas = JSON.parse(JSON.stringify(ctx.evitar || {})); // tipo -> índices já usados (ex.: na última vez)
    let abates = 0;
    return eventos.map((e) => {
      let tipo = e.tipo;
      if (tipo === 'abate') tipo = abates++ ? 'abate2' : 'abate';
      const b = BANCO[tipo];
      if (!b) return null;
      let livres = b.falas.map((f, i) => i).filter((i) => !(usadas[tipo] || []).includes(i));
      if (!livres.length) { usadas[tipo] = []; livres = b.falas.map((f, i) => i); }
      const i = livres[Math.floor(rnd() * livres.length)];
      (usadas[tipo] = usadas[tipo] || []).push(i);
      const nomeV = e.vitima ? ctx.nomeHeroi(e.vitima) : '';
      const v = {
        quem: ctx.quem, heroi: ctx.nomeHeroi(ctx.heroi), lado: ctx.lado, dono: e.dono || '',
        o_heroi: `${art(ctx.heroi)} ${ctx.nomeHeroi(ctx.heroi)}`, um_heroi: `${art(ctx.heroi) === 'a' ? 'uma' : 'um'} ${ctx.nomeHeroi(ctx.heroi)}`,
        vitima: nomeV, no_vitima: e.vitima ? `${art(e.vitima) === 'a' ? 'na' : 'no'} ${nomeV}` : '', ela: art(ctx.heroi) === 'a' ? 'ela' : 'ele', solta: art(ctx.heroi) === 'a' ? 'solta' : 'solto', o_vitima: e.vitima ? `${art(e.vitima)} ${nomeV}` : '', skill: e.skill || 'a skill',
        n: e.n ? extenso(e.n) : '', num: e.num ? extenso(e.num) : '',
      };
      const texto = b.falas[i].replace(/\{(\w+)\}/g, (m, k) => {
        const chave = k.charAt(0).toLowerCase() + k.slice(1);
        const val = v[chave] != null ? v[chave] : m;
        return k === chave ? val : cap(val);
      });
      return { t: e.t, tipo, i, texto, ref: b.ref };
    }).filter(Boolean);
  }

  const API = { BANCO, montar, extenso };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.RoteiroPlantao = API;
})(typeof window !== 'undefined' ? window : globalThis);
