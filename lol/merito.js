// O lado bom no LoL, como na vitória do Dota: quem carregou a partida (mérito em ouro, do mesmo jeito que a culpa) e
// com que elo cada um jogou. Usa a chance de vitória de julgar.js para achar a Play of the Game de cada um.
// Puro: roda no navegador (window.MeritoLoL) e no Node (testes: node lol/teste_merito.mjs).
(function (raiz) {
  'use strict';

  const VALOR = { DRAGON: 500, ELDER_DRAGON: 1500, BARON_NASHOR: 1500, RIFTHERALD: 600, HORDE: 200, ATAKHAN: 800, TOWER_BUILDING: 650, INHIBITOR_BUILDING: 900 };
  const NOME = { DRAGON: ['dragão', 'dragões'], ELDER_DRAGON: ['Dragão Ancião', 'Dragões Anciões'], BARON_NASHOR: ['Barão', 'Barões'], RIFTHERALD: ['Arauto', 'Arautos'],
    HORDE: ['Vastilarva', 'Vastilarvas'], ATAKHAN: ['Atakhan', 'Atakhans'], TOWER_BUILDING: ['torre', 'torres'], INHIBITOR_BUILDING: ['inibidor', 'inibidores'] };
  const EMPATE = 0.05;            // dois craques quando a diferença de mérito é menor que isso
  const DUPLA_MIN = 0.25;
  const ELOS = ['Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Esmeralda', 'Diamante', 'Mestre', 'Grão-Mestre', 'Desafiante'];
  const ELO_COR = ['#6b5b53', '#a0603a', '#9aa4ad', '#d9a43b', '#4fb3a6', '#2fbf71', '#6f8ff0', '#b15ce0', '#e0533d', '#f2d27a'];

  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const pct = (x) => `${Math.round(x * 100)}%`;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const chaveObj = (e) => (e.tipo === 'monstro' ? (e.monstro === 'DRAGON' && e.sub === 'ELDER_DRAGON' ? 'ELDER_DRAGON' : e.monstro) : e.estrutura);

  function ouroNoMinuto(partida, id, min) {
    const q = partida.quadros[Math.min(partida.quadros.length - 1, min)];
    const f = q && q.p[String(id)];
    return f ? f[2] : null;
  }

  function merito(partida, timeNos, cv) {
    const nos = partida.jogadores.filter((j) => j.teamId === timeNos);
    const eles = partida.jogadores.filter((j) => j.teamId !== timeNos);
    const abates = partida.eventos.filter((e) => e.tipo === 'abate');
    const lista = nos.map((j) => {
      const c = [];
      // abates e assistências: o ouro que renderam ao time
      let credito = 0, k = 0, a = 0;
      for (const m of abates) {
        if (m.matou === j.id) { credito += m.recompensa || 0; k++; } else if ((m.assist || []).includes(j.id)) { credito += 0.5 * (m.recompensa || 0); a++; }
      }
      if (credito) c.push({ key: 'abates', label: 'Abates', ouro: credito, evidencia: `${plural(k, 'abate', 'abates')} e ${plural(a, 'assistência', 'assistências')} que renderam ${fmt(credito)} de ouro ao time.` });
      // golpe final em objetivos
      const objs = partida.eventos.filter((e) => (e.tipo === 'monstro' || e.tipo === 'estrutura') && e.quem === j.id && VALOR[chaveObj(e)]
        && (e.tipo === 'monstro' ? e.time === timeNos : e.dono !== timeNos));
      if (objs.length) {
        const cont = {};
        for (const e of objs) cont[chaveObj(e)] = (cont[chaveObj(e)] || 0) + 1;
        const txt = Object.entries(cont).map(([kk, n]) => (n > 1 ? `${n} ${NOME[kk][1]}` : NOME[kk][0]));
        c.push({ key: 'objetivos', label: 'Objetivos', ouro: objs.reduce((s, e) => s + VALOR[chaveObj(e)], 0),
          evidencia: `Golpe final em ${txt.length > 1 ? `${txt.slice(0, -1).join(', ')} e ${txt[txt.length - 1]}` : txt[0]}.` });
      }
      // dano: o que passar de uma fatia justa (20%) do dano do time
      const dano = (j.challenges || {}).teamDamagePercentage;
      if (typeof dano === 'number' && dano > 0.2) c.push({ key: 'dano', label: 'Dano', ouro: (dano - 0.2) * 10000, evidencia: `Fez ${pct(dano)} do dano do time aos campeões.` });
      // rota aos 14 min
      const rival = j.teamPosition && eles.find((x) => x.teamPosition === j.teamPosition);
      const min = Math.min(14, partida.quadros.length - 1);
      if (rival && min >= 5) {
        const d = (ouroNoMinuto(partida, j.id, min) || 0) - (ouroNoMinuto(partida, rival.id, min) || 0);
        if (d >= 300) c.push({ key: 'rota', label: 'Rota', ouro: 0.5 * d, evidencia: `Aos ${min} min estava ${fmt(d)} de ouro à frente de ${rival.championName}.` });
      }
      // visão contra o rival
      if (rival && j.visionScore > rival.visionScore * 1.3 && j.visionScore - rival.visionScore >= 10) {
        c.push({ key: 'visao', label: 'Visão', ouro: 15 * (j.visionScore - rival.visionScore), evidencia: `Placar de visão ${j.visionScore}, contra ${rival.visionScore} de ${rival.championName}.` });
      }
      // cura e escudo nos aliados
      const protecao = (j.totalHealsOnTeammates || 0) + (j.totalDamageShieldedOnTeammates || 0);
      if (protecao >= 3000) c.push({ key: 'protecao', label: 'Proteção', ouro: 0.1 * protecao, evidencia: `${fmt(protecao)} de cura e escudo nos aliados.` });
      // a Play of the Game
      const play = cv && cv.playDoJogo;
      if (play && play.matou && play.matou.id === j.id) {
        c.push({ key: 'play', label: 'Play of the Game', ouro: play.delta * 10000, evidencia: `Fez a Play of the Game: chance de vitória de ${pct(play.antes)} para ${pct(play.depois)}.` });
      }
      c.sort((x, y) => y.ouro - x.ouro);
      return { jogador: j, ouro: c.reduce((s, x) => s + x.ouro, 0), brilhou: c.map((x) => ({ ...x, pontos: Math.round(x.ouro / 100) / 10 })) };
    });
    const total = lista.reduce((s, x) => s + x.ouro, 0) || 1;
    for (const x of lista) x.fatia = x.ouro / total;
    lista.sort((x, y) => y.ouro - x.ouro);
    const craques = lista.length > 1 && lista[0].fatia - lista[1].fatia < EMPATE && lista[1].fatia >= DUPLA_MIN ? lista.slice(0, 2) : lista.slice(0, 1);
    return { lista, craques };
  }

  // elo da atuação: o jogador comparado aos outros 9 da partida (KDA, participação, dano, ouro, visão), de Ferro a Desafiante
  function elos(partida) {
    const js = partida.jogadores;
    const met = (j) => {
      const ch = j.challenges || {};
      const sup = j.teamPosition === 'UTILITY';
      return [
        [ch.kda != null ? ch.kda : (j.kills + j.assists) / Math.max(1, j.deaths), 1],
        [ch.killParticipation || 0, 1],
        [ch.teamDamagePercentage || 0, sup ? 0.4 : 1],
        [ch.goldPerMinute || 0, sup ? 0.3 : 1],
        [ch.visionScorePerMinute || 0, sup ? 1.5 : 0.4],
      ];
    };
    const ms = js.map(met);
    const z = ms[0].map((_, i) => {
      const xs = ms.map((m) => m[i][0]);
      const media = xs.reduce((s, x) => s + x, 0) / xs.length;
      const dp = Math.sqrt(xs.reduce((s, x) => s + (x - media) ** 2, 0) / xs.length) || 1;
      return { media, dp };
    });
    const out = new Map();
    js.forEach((j, n) => {
      let soma = 0, pesos = 0;
      ms[n].forEach(([x, w], i) => { soma += w * Math.max(-2.5, Math.min(2.5, (x - z[i].media) / z[i].dp)); pesos += w; });
      const nota = soma / pesos + (j.win ? 0.25 : -0.25);
      const i = Math.max(0, Math.min(ELOS.length - 1, Math.round(4.5 + nota * 3)));
      out.set(j.id, { nome: ELOS[i], cor: ELO_COR[i], indice: i, nota });
    });
    return out;
  }

  const api = { merito, elos, ELOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.MeritoLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
