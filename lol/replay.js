// Replay do LoL no mapinha: a Riot só dá a posição de cada jogador uma vez por minuto, então o boneco anda em linha reta
// entre esses pontos e entre as posições exatas de cada abate (vítima, matador e assistências estavam ali naquele segundo).
// Morto some do mapa pelo tempo de renascer (estimado pelo nível) e volta na base. Puro: roda no navegador
// (window.ReplayLoL) e no Node (testes: node lol/teste_replay.mjs).
(function (raiz) {
  'use strict';

  // tempo de renascer por nível (1 a 18), em segundos, antes do acréscimo do fim de jogo
  const RENASCER = [6, 6, 8, 8, 10, 12, 16, 21, 26, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5];
  const BASE = { 100: { x: 554, y: 581 }, 200: { x: 14102, y: 14193 } };
  const COVIL = {
    DRAGON: { x: 9866, y: 4414 }, BARON_NASHOR: { x: 5007, y: 10471 }, RIFTHERALD: { x: 5007, y: 10471 },
    HORDE: { x: 5007, y: 10471 }, ATAKHAN: { x: 5007, y: 10471 },
  };
  const MONSTRO = {
    DRAGON: 'o dragão', ELDER_DRAGON: 'o Dragão Ancião', BARON_NASHOR: 'o Barão', RIFTHERALD: 'o Arauto',
    HORDE: 'uma Vastilarva', ATAKHAN: 'o Atakhan',
  };
  const ESTRUTURA = { TOWER_BUILDING: 'uma torre', INHIBITOR_BUILDING: 'um inibidor' };

  function tempoRenascer(nivel, t) {
    const base = RENASCER[Math.max(1, Math.min(18, nivel || 1)) - 1];
    // depois dos 15 min o tempo cresce um pouco a cada minuto (aproximação)
    const extra = t > 900 ? Math.min(0.5, ((t - 900) / 60) * 0.02) : 0;
    return base * (1 + extra);
  }

  function nivelEm(partida, id, t) {
    const q = partida.quadros[Math.min(partida.quadros.length - 1, Math.max(0, Math.floor(t / 60)))];
    const f = q && q.p[String(id)];
    return f ? f[5] : 1;
  }

  function preparar(partida, timeNos) {
    const porId = new Map(partida.jogadores.map((j) => [j.id, j]));
    const abates = partida.eventos.filter((e) => e.tipo === 'abate' && e.x != null).sort((a, b) => a.t - b.t);
    const jogadores = partida.jogadores.map((j) => {
      const mortes = abates.filter((m) => m.morreu === j.id).map((m) => {
        const fim = m.t + tempoRenascer(nivelEm(partida, j.id, m.t), m.t);
        return [m.t, fim];
      });
      const morto = (t) => mortes.some(([a, b]) => t > a && t < b);
      const chaves = [];
      for (const q of partida.quadros) {
        const f = q.p[String(j.id)];
        if (f && f[0] != null && !morto(q.t)) chaves.push({ t: q.t, x: f[0], y: f[1] });
      }
      for (const m of abates) {
        if (m.morreu === j.id || m.matou === j.id || (m.assist || []).includes(j.id)) chaves.push({ t: m.t, x: m.x, y: m.y });
      }
      for (const [, fim] of mortes) chaves.push({ t: fim, ...BASE[j.teamId] });
      chaves.sort((a, b) => a.t - b.t);
      // dois pontos no mesmo segundo: fica o do abate (mais exato), que entrou depois
      const limpas = [];
      for (const c of chaves) {
        if (limpas.length && limpas[limpas.length - 1].t === c.t) limpas[limpas.length - 1] = c;
        else limpas.push(c);
      }
      return { id: j.id, teamId: j.teamId, campeao: j.championName, nome: j.riotIdGameName || j.championName, chaves: limpas, mortes };
    });

    const nomeCamp = (id) => (porId.get(id) || {}).championName || 'a torre';
    const lado = (time, um, varios) => (time === timeNos ? `Seu time ${um}` : `Os inimigos ${varios}`);
    const eventos = [];   // bom = bom para o seu time
    for (const e of partida.eventos) {
      if (e.tipo === 'abate' && e.x != null) {
        const v = porId.get(e.morreu);
        eventos.push({ t: e.t, tipo: 'abate', x: e.x, y: e.y, bom: !(v && v.teamId === timeNos), morreu: e.morreu,
          texto: e.matou ? `${nomeCamp(e.matou)} matou ${nomeCamp(e.morreu)}` : `${nomeCamp(e.morreu)} foi executado` });
      } else if (e.tipo === 'monstro' && MONSTRO[e.sub === 'ELDER_DRAGON' ? 'ELDER_DRAGON' : e.monstro]) {
        const nome = MONSTRO[e.sub === 'ELDER_DRAGON' ? 'ELDER_DRAGON' : e.monstro];
        const p = COVIL[e.monstro] || COVIL.DRAGON;
        eventos.push({ t: e.t, tipo: 'monstro', x: p.x, y: p.y, bom: e.time === timeNos, texto: `${lado(e.time, 'pegou', 'pegaram')} ${nome}` });
      } else if (e.tipo === 'estrutura' && ESTRUTURA[e.estrutura] && e.x != null) {
        const ganhou = e.dono === 100 ? 200 : 100;
        eventos.push({ t: e.t, tipo: 'estrutura', x: e.x, y: e.y, bom: ganhou === timeNos,
          texto: `${lado(ganhou, 'derrubou', 'derrubaram')} ${ESTRUTURA[e.estrutura]}` });
      }
    }
    eventos.sort((a, b) => a.t - b.t);
    return { duracao: partida.duracao, jogadores, eventos };
  }

  // posição do jogador no segundo t (interpolada) e se está vivo
  function posicao(j, t) {
    if (j.mortes.some(([a, b]) => t > a && t < b)) return { vivo: false };
    const c = j.chaves;
    if (!c.length) return { vivo: false };
    if (t <= c[0].t) return { vivo: true, x: c[0].x, y: c[0].y };
    let lo = 0, hi = c.length - 1;
    if (t >= c[hi].t) return { vivo: true, x: c[hi].x, y: c[hi].y };
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m].t <= t) lo = m; else hi = m;
    }
    const a = c[lo], b = c[hi];
    const k = (t - a.t) / (b.t - a.t || 1);
    return { vivo: true, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  const api = { preparar, posicao, tempoRenascer, BASE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.ReplayLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
