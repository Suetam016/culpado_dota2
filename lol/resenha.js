// Resenha do LoL: pings, medalhas (conquistas da Riot), ouro parado no bolso e o recibo de cada morte.
// Puro: roda no navegador (window.ResenhaLoL) e no Node (testes: node lol/teste_resenha.mjs).
(function (raiz) {
  'use strict';

  const NOME_PING = {
    enemyMissing: '?', allIn: 'Tudo dentro', assistMe: 'Me ajuda', basic: 'Ping comum', command: 'Comando', danger: 'Perigo',
    enemyVision: 'Visão inimiga', getBack: 'Volta', hold: 'Segura', needVision: 'Precisa de visão', onMyWay: 'Tô indo',
    push: 'Empurra', retreat: 'Recua', visionCleared: 'Visão limpa',
  };
  const BOLSO_MIN = 2000;   // ouro guardado a partir disso conta como "parado"
  const BOLSO_MINUTOS = 3;  // por pelo menos tantos minutos seguidos

  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  // ---------------------------------------------------------------- pings
  function pings(jogadores) {
    const linhas = jogadores.filter((j) => j.pings).map((j) => {
      const tipos = Object.entries(j.pings).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      return { jogador: j, total: tipos.reduce((a, [, n]) => a + n, 0), interrogacoes: j.pings.enemyMissing || 0,
        tipos: tipos.map(([k, n]) => ({ chave: k, nome: NOME_PING[k] || k, n })) };
    }).sort((a, b) => b.total - a.total);
    const rei = linhas.slice().sort((a, b) => b.interrogacoes - a.interrogacoes)[0];
    return { linhas, reiDoInterrogacao: rei && rei.interrogacoes >= 5 ? rei : null };
  }

  // ---------------------------------------------------------------- ouro parado
  function ouroParado(partida, j) {
    let melhor = null, ini = null, pico = 0, picoT = 0;
    const fecha = (fim) => {
      if (ini == null) return;
      const minutos = Math.round((fim - ini) / 60);
      if (minutos >= BOLSO_MINUTOS && (!melhor || minutos > melhor.minutos)) melhor = { inicio: ini, minutos, pico, picoT };
      ini = null; pico = 0;
    };
    for (const q of partida.quadros) {
      const f = q.p[String(j.id)];
      const ouro = f && f[6];
      if (ouro == null) { fecha(q.t); continue; }
      if (ouro >= BOLSO_MIN) {
        if (ini == null) ini = q.t;
        if (ouro > pico) { pico = ouro; picoT = q.t; }
      } else fecha(q.t);
    }
    fecha(partida.quadros.length ? partida.quadros[partida.quadros.length - 1].t : 0);
    return melhor;
  }

  // ---------------------------------------------------------------- medalhas
  // [chave, condição, título, texto, bom?]; n = valor da conquista
  const REGRAS = [
    ['perfectGame', (n) => n >= 1, 'Partida perfeita', () => 'Não morreu nenhuma vez.', true],
    ['epicMonsterSteals', (n) => n >= 1, 'Ladrão', (n) => `Roubou ${plural(n, 'objetivo épico', 'objetivos épicos')}.`, true],
    ['saveAllyFromDeath', (n) => n >= 1, 'Anjo da guarda', (n) => `Salvou ${plural(n, 'aliado', 'aliados')} da morte.`, true],
    ['flawlessAces', (n) => n >= 1, 'Ace limpo', (n) => `${plural(n, 'ace', 'aces')} sem perder ninguém do time.`, true],
    ['multikills', (n) => n >= 2, 'Multiabate', (n) => `${n} multiabates na partida.`, true],
    ['soloKills', (n) => n >= 3, 'Resolve sozinho', (n) => `${n} abates no um contra um.`, true],
    ['outnumberedKills', (n) => n >= 2, 'Contra todos', (n) => `${n} abates em desvantagem numérica.`, true],
    ['skillshotsDodged', (n) => n >= 40, 'Liso', (n) => `Desviou de ${n} skillshots.`, true],
    ['survivedSingleDigitHpCount', (n) => n >= 1, 'Por um fio', (n) => `Sobreviveu ${plural(n, 'vez', 'vezes')} com menos de 10 de vida.`, true],
    ['enemyChampionImmobilizations', (n) => n >= 40, 'Prende-prende', (n) => `Imobilizou inimigos ${n} vezes.`, true],
    ['effectiveHealAndShielding', (n) => n >= 8000, 'Médico do time', (n) => `${fmt(n)} de cura e escudo nos aliados.`, true],
    ['stealthWardsPlaced', (n) => n >= 30, 'Olho que tudo vê', (n) => `${n} sentinelas colocadas.`, true],
    ['turretPlatesTaken', (n) => n >= 4, 'Come placa', (n) => `Arrancou ${n} placas de torre.`, true],
    ['buffsStolen', (n) => n >= 2, 'Ladrão de buff', (n) => `Roubou ${n} buffs da selva inimiga.`, true],
    ['killsUnderOwnTurret', (n) => n >= 2, 'Dono da casa', (n) => `${n} abates debaixo da própria torre.`, true],
    ['dancedWithRiftHerald', (n) => n >= 1, 'Dançou com o Arauto', () => 'Parou para dançar com o Arauto. Prioridades.', true],
    ['deathsByEnemyChamps', (n) => n >= 10, 'Doador oficial', (n) => `Morreu ${n} vezes para campeões inimigos.`, false],
  ];

  function medalhas(partida, j, pg) {
    const ch = j.challenges || {};
    const minutos = partida.duracao / 60;
    const out = [];
    for (const [k, cond, titulo, texto, bom] of REGRAS) {
      if (typeof ch[k] === 'number' && cond(ch[k])) out.push({ titulo, texto: texto(ch[k]), bom });
    }
    if (minutos >= 20 && typeof ch.killParticipation === 'number' && ch.killParticipation < 0.3) {
      out.push({ titulo: 'Turista', texto: `Participou de só ${Math.round(ch.killParticipation * 100)}% dos abates do time.`, bom: false });
    }
    if (minutos >= 20 && ch.controlWardsPlaced === 0) {
      out.push({ titulo: 'Pão-duro da visão', texto: 'Nenhuma sentinela de controle a partida inteira.', bom: false });
    }
    if (j.teamPosition !== 'UTILITY' && minutos >= 20 && typeof ch.visionScorePerMinute === 'number' && ch.visionScorePerMinute < 0.4) {
      out.push({ titulo: 'Jogando no escuro', texto: `Placar de visão de ${ch.visionScorePerMinute.toFixed(1)} por minuto.`, bom: false });
    }
    if (j.spell4Casts === 0 && minutos >= 15) out.push({ titulo: 'Ult de enfeite', texto: 'Não usou a ultimate nenhuma vez.', bom: false });
    const bolso = ouroParado(partida, j);
    if (bolso) out.push({ titulo: 'Cofrinho', texto: `Ficou ${bolso.minutos} min com mais de ${fmt(BOLSO_MIN)} de ouro no bolso (pico de ${fmt(bolso.pico)} aos ${Math.floor(bolso.picoT / 60)} min).`, bom: false });
    const meuPing = pg && pg.linhas.find((l) => l.jogador.id === j.id);
    if (meuPing && meuPing.interrogacoes >= 10) out.push({ titulo: 'Rei do ?', texto: `Pingou "?" ${meuPing.interrogacoes} vezes.`, bom: false });
    return out;
  }

  // ---------------------------------------------------------------- recibo da morte
  const FEITICO_POR_NOME = { summonerdot: 'Incendiar', summonerflash: 'Flash', summonersmite: 'Golpear', summonerexhaust: 'Exaustão',
    summonerteleport: 'Teleporte', summonerheal: 'Curar', summonerbarrier: 'Barreira', summonerboost: 'Purificar' };

  // [quem, fonte, habilidade, slot, dano] -> { quem, fonte, golpe, dano }; nomesQWER(campeão) devolve os 4 nomes ou null
  function linhaRecibo(item, nomesQWER) {
    const [quem, fonte, hab, slot, dano] = item;
    const f = String(fonte || '');
    let nomeFonte = f;
    if (!quem) nomeFonte = /turret/i.test(f) ? 'Torre' : /minion/i.test(f) ? 'Tropas' : /^SRU_|monster/i.test(f) ? 'Monstro' : f || 'Outro';
    let golpe;
    const h = String(hab || '').toLowerCase();
    if (!quem) golpe = '';
    else if (Number.isInteger(slot) && slot >= 0 && slot <= 3) {
      const nomes = nomesQWER && nomesQWER(f);
      golpe = nomes && nomes[slot] ? `${'QWER'[slot]} · ${nomes[slot]}` : 'QWER'[slot];
    } else if (slot === 4 || slot === 5 || h.startsWith('summoner')) golpe = FEITICO_POR_NOME[h] || 'Feitiço';
    else if (/basicattack|critattack/.test(h) || slot === 64 || slot === 65 || slot === 66) golpe = 'Ataque básico';
    else if (/passive/.test(h) || slot === 63) golpe = 'Passiva';
    else golpe = 'Item ou efeito';
    return { quem, fonte: nomeFonte, golpe, dano };
  }

  function recibo(abate, nomesQWER, max = 6) {
    // a mesma habilidade pode vir com nomes internos diferentes (ex.: Q e o ataque do Q): junta pelo rótulo
    const juntas = new Map();
    for (const x of abate.recibo || []) {
      const l = linhaRecibo(x, nomesQWER);
      const k = l.fonte + '|' + l.golpe;
      if (juntas.has(k)) juntas.get(k).dano += l.dano; else juntas.set(k, l);
    }
    const linhas = [...juntas.values()].sort((a, b) => b.dano - a.dano);
    const total = linhas.reduce((a, l) => a + l.dano, 0);
    // por quem: quanto do dano veio de cada um
    const porQuem = {};
    for (const l of linhas) porQuem[l.fonte] = (porQuem[l.fonte] || 0) + l.dano;
    return { total, linhas: linhas.slice(0, max), resto: linhas.slice(max).reduce((a, l) => a + l.dano, 0),
      porQuem: Object.entries(porQuem).sort((a, b) => b[1] - a[1]) };
  }

  const api = { pings, medalhas, ouroParado, recibo, linhaRecibo, NOME_PING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.ResenhaLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
