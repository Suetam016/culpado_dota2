// Veredito do Culpado para LoL: quanto ouro cada jogador do time "entregou" (em pontos de 1.000 de ouro), a partir da
// partida compacta de lol/coletar.py. Roda no navegador (window.CulpadoLoL) e no Node (testes: node lol/teste_julgar.mjs).
(function (raiz) {
  'use strict';

  const ESCALA = 1000;              // 1 ponto de culpa = 1.000 de ouro entregue
  const CREDITO_MAX = 0.7;          // créditos tiram no máximo 70% da culpa
  const JANELA_SOZINHO_S = 12;      // morte sem outra morte (de ninguém) por perto: morreu sozinho
  const JANELA_OBJETIVO_S = 45;     // objetivo inimigo até 45 s depois da morte: entregou o objetivo
  const MINUTO_ROTA = 14;
  const VALOR_OBJETIVO = {
    DRAGON: 500, ELDER_DRAGON: 1500, BARON_NASHOR: 1500, RIFTHERALD: 600, HORDE: 200, ATAKHAN: 800,
    TOWER_BUILDING: 650, INHIBITOR_BUILDING: 900,
  };
  const NOME_OBJETIVO = {
    DRAGON: 'dragão', ELDER_DRAGON: 'Dragão Ancião', BARON_NASHOR: 'Barão', RIFTHERALD: 'Arauto', HORDE: 'Vastilarva',
    ATAKHAN: 'Atakhan', TOWER_BUILDING: 'torre', INHIBITOR_BUILDING: 'inibidor',
  };
  const PLURAL_OBJETIVO = { DRAGON: 'dragões', TOWER_BUILDING: 'torres', INHIBITOR_BUILDING: 'inibidores', HORDE: 'Vastilarvas' };
  const LABELS = {
    mortes: 'Mortes', sozinho: 'Morreu sozinho', objetivos: 'Objetivos entregues', rota: 'Rota',
    visao: 'Visão', abates: 'Abates e assistências',
  };

  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const arred = (x) => Math.round(x * 10) / 10;
  const soma = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  function objetivoDoEvento(e) {
    if (e.tipo === 'monstro') {
      const chave = e.monstro === 'DRAGON' && e.sub === 'ELDER_DRAGON' ? 'ELDER_DRAGON' : e.monstro;
      return VALOR_OBJETIVO[chave] ? { chave, time: e.time } : null;
    }
    if (e.tipo === 'estrutura') {
      // a estrutura é do "dono": quem ganhou foi o outro time
      return VALOR_OBJETIVO[e.estrutura] ? { chave: e.estrutura, time: e.dono === 100 ? 200 : 100 } : null;
    }
    return null;
  }

  function ouroNoMinuto(partida, id, minuto) {
    const q = partida.quadros[Math.min(minuto, partida.quadros.length - 1)];
    const f = q && q.p[String(id)];
    return f ? f[2] : null;
  }

  // ponto de vista: o time do jogador `puuid` (ou o time que perdeu, se não achar)
  function julgar(partida, puuid) {
    const jogs = partida.jogadores;
    const eu = jogs.find((j) => j.puuid === puuid);
    const timeNos = eu ? eu.teamId : (jogs.find((j) => !j.win) || jogs[0]).teamId;
    const nos = jogs.filter((j) => j.teamId === timeNos);
    const eles = jogs.filter((j) => j.teamId !== timeNos);
    const porId = new Map(jogs.map((j) => [j.id, j]));
    const abates = partida.eventos.filter((e) => e.tipo === 'abate');
    const objetivos = partida.eventos.map((e) => ({ e, o: objetivoDoEvento(e) })).filter((x) => x.o && x.o.time !== timeNos);
    const minutoRota = Math.min(MINUTO_ROTA, partida.quadros.length - 1);

    const vereditos = nos.map((j) => {
      const c = {};
      const add = (k, ouro, info) => {
        c[k] = c[k] || { ouro: 0, infos: [] };
        c[k].ouro += ouro;
        if (info) c[k].infos.push(info);
      };

      const mortes = abates.filter((e) => e.morreu === j.id);
      for (const m of mortes) {
        add('mortes', m.recompensa || 0, { t: m.t, por: porId.get(m.matou), x: m.x, y: m.y });
        const sozinho = !abates.some((o) => o !== m && Math.abs(o.t - m.t) <= JANELA_SOZINHO_S);
        if (sozinho) add('sozinho', 0.5 * (m.recompensa || 0), { t: m.t });
      }

      for (const { e, o } of objetivos) {
        const mortosAntes = abates.filter((m) => porId.get(m.morreu) && porId.get(m.morreu).teamId === timeNos
          && e.t - m.t >= 0 && e.t - m.t <= JANELA_OBJETIVO_S);
        const meus = mortosAntes.filter((m) => m.morreu === j.id);
        if (!meus.length) continue;
        const dividir = new Set(mortosAntes.map((m) => m.morreu)).size;
        add('objetivos', (0.5 * VALOR_OBJETIVO[o.chave]) / dividir, { t: e.t, chave: o.chave });
      }

      const rival = j.teamPosition && eles.find((x) => x.teamPosition === j.teamPosition);
      if (rival && minutoRota >= 5) {
        const a = ouroNoMinuto(partida, j.id, minutoRota);
        const b = ouroNoMinuto(partida, rival.id, minutoRota);
        if (a != null && b != null && Math.abs(a - b) >= 300) add('rota', 0.5 * (b - a), { dif: a - b, rival, minuto: minutoRota });
      }

      if (j.teamPosition === 'UTILITY' && rival && rival.visionScore > 0 && j.visionScore < 0.6 * rival.visionScore) {
        add('visao', 15 * (rival.visionScore - j.visionScore), { meu: j.visionScore, dele: rival.visionScore, rival });
      }

      let credito = 0;
      for (const m of abates) {
        if (m.matou === j.id) credito += m.recompensa || 0;
        else if ((m.assist || []).includes(j.id)) credito += 0.5 * (m.recompensa || 0);
      }
      if (credito) add('abates', -credito, null);

      const componentes = Object.entries(c)
        .filter(([, v]) => Math.abs(v.ouro) >= 0.05 * ESCALA)
        .map(([key, v]) => ({ key, label: LABELS[key], pontos: arred(v.ouro / ESCALA), evidencia: evidencia(key, v, j, mortes) }))
        .sort((a, b) => b.pontos - a.pontos);
      const culpa = soma(Object.values(c).filter((v) => v.ouro > 0), (v) => v.ouro);
      const cred = -soma(Object.values(c).filter((v) => v.ouro < 0), (v) => v.ouro);
      const liquido = Math.max((1 - CREDITO_MAX) * culpa, culpa - cred);
      return { jogador: j, score: arred(liquido / ESCALA), bruto: liquido, fatia: 0, componentes, mortes };
    });

    const total = soma(vereditos, (v) => v.bruto) || 1;
    for (const v of vereditos) {
      v.fatia = v.bruto / total;
      v.pesou = v.componentes.filter((x) => x.pontos >= 0.3).slice(0, 3);
      v.atenuantes = v.componentes.filter((x) => x.pontos < 0).slice(0, 2);
    }
    vereditos.sort((a, b) => b.bruto - a.bruto);
    return { timeNos, venceu: nos[0].win, nos, eles, vereditos, culpado: vereditos[0] };
  }

  function evidencia(key, v, j, mortes) {
    if (key === 'mortes') return `Morreu ${plural(mortes.length, 'vez', 'vezes')} e deu ${fmt(v.ouro)} de ouro aos inimigos.`;
    if (key === 'sozinho') {
      const ts = v.infos.map((i) => mmss(i.t)).slice(0, 3).join(', ');
      return `${plural(v.infos.length, 'morte', 'mortes')} sem nenhuma luta por perto (${ts}).`;
    }
    if (key === 'objetivos') {
      const cont = {};
      for (const i of v.infos) cont[i.chave] = (cont[i.chave] || 0) + 1;
      const lista = Object.entries(cont).map(([k, n]) => (n > 1 ? `${n} ${PLURAL_OBJETIVO[k] || NOME_OBJETIVO[k]}` : NOME_OBJETIVO[k])).join(', ');
      return `Inimigos pegaram ${lista} logo depois de você morrer.`;
    }
    if (key === 'rota') {
      const i = v.infos[0];
      return i.dif < 0
        ? `Aos ${i.minuto} min estava ${fmt(-i.dif)} de ouro atrás de ${i.rival.championName}, o rival de rota.`
        : `Aos ${i.minuto} min estava ${fmt(i.dif)} de ouro à frente de ${i.rival.championName}.`;
    }
    if (key === 'visao') {
      const i = v.infos[0];
      return `Placar de visão ${i.meu}, contra ${i.dele} do suporte inimigo (${i.rival.championName}).`;
    }
    if (key === 'abates') return `${j.kills}/${j.deaths}/${j.assists}: abates e assistências que renderam ${fmt(-v.ouro)} de ouro ao time.`;
    return '';
  }

  // diferença de ouro do nosso time por minuto (positivo = nós na frente)
  function ouroDoTime(partida, timeNos) {
    const ids = partida.jogadores.map((j) => [j.id, j.teamId === timeNos ? 1 : -1]);
    return partida.quadros.map((q) => ({ t: q.t, dif: soma(ids, ([id, s]) => s * ((q.p[String(id)] || [])[2] || 0)) }));
  }

  const api = { julgar, ouroDoTime, mmss, fmt, NOME_OBJETIVO, VALOR_OBJETIVO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.CulpadoLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
