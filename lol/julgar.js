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
    visao: 'Visão', ult: 'Ultimate', abriu: 'Abriu a luta morrendo', ausente: 'Não foi para a luta', abates: 'Abates e assistências',
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

  // ---------------------------------------------------------------- lutas
  // Abates a menos de 20 s e 3.500 unidades do anterior formam uma luta (3 abates ou mais; menos que isso é troca).
  const LUTA_GAP_S = 20, LUTA_DIST = 3500, LONGE_DA_LUTA = 5000;
  const COVIL_DRAGAO = { x: 9866, y: 4414 }, COVIL_BARAO = { x: 5007, y: 10471 };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function lugar(p) {
    if (dist(p, COVIL_DRAGAO) < 2200) return 'no dragão';
    if (dist(p, COVIL_BARAO) < 2200) return 'no Barão';
    if (p.x < 2600 && p.y < 2600) return 'na base azul';
    if (p.x > 12300 && p.y > 12300) return 'na base vermelha';
    if ((p.x < 2600 && p.y > 9000) || (p.y > 12300 && p.x < 6000)) return 'no topo';
    if ((p.y < 2600 && p.x > 9000) || (p.x > 12300 && p.y < 6000)) return 'no bot';
    if (Math.abs(p.x - p.y) < 1700) return 'no meio';
    if (Math.abs(p.x + p.y - 14800) < 1600) return 'no rio';
    return 'na selva';
  }

  function posNoMinuto(partida, id, t) {
    const q = partida.quadros[Math.min(partida.quadros.length - 1, Math.round(t / 60))];
    const f = q && q.p[String(id)];
    return f && f[0] != null ? { x: f[0], y: f[1] } : null;
  }

  function lutas(partida, timeNos) {
    const porId = new Map(partida.jogadores.map((j) => [j.id, j]));
    const abates = partida.eventos.filter((e) => e.tipo === 'abate' && e.x != null).sort((a, b) => a.t - b.t);
    const grupos = [];
    for (const a of abates) {
      const g = grupos[grupos.length - 1];
      if (g && a.t - g[g.length - 1].t <= LUTA_GAP_S && g.some((b) => dist(a, b) <= LUTA_DIST)) g.push(a);
      else grupos.push([a]);
    }
    return grupos.filter((g) => g.length >= 3).map((g) => {
      const inicio = g[0].t, fim = g[g.length - 1].t;
      const centro = { x: soma(g, (a) => a.x) / g.length, y: soma(g, (a) => a.y) / g.length };
      const nossa = (id) => (porId.get(id) || {}).teamId === timeNos;
      const mortesNos = g.filter((a) => nossa(a.morreu)).length;
      const mortesEles = g.length - mortesNos;
      const resultado = mortesEles > mortesNos ? 'venceu' : mortesEles < mortesNos ? 'perdeu' : 'empate';
      const envolvidos = new Set();
      for (const a of g) { envolvidos.add(a.morreu); if (a.matou) envolvidos.add(a.matou); for (const x of a.assist || []) envolvidos.add(x); }
      // quem do time estava vivo, longe e não participou
      const ausentes = partida.jogadores.filter((j) => j.teamId === timeNos && !envolvidos.has(j.id)).filter((j) => {
        const p = posNoMinuto(partida, j.id, inicio);
        return p && dist(p, centro) > LONGE_DA_LUTA;
      });
      const primeira = g[0];
      const objetivos = partida.eventos.filter((e) => e.t >= inicio && e.t <= fim + JANELA_OBJETIVO_S
        && (e.tipo === 'monstro' || (e.tipo === 'estrutura' && VALOR_OBJETIVO[e.estrutura])));
      const deQuem = (e) => (e.tipo === 'monstro' ? e.time : e.dono === 100 ? 200 : 100);
      return {
        inicio, fim, centro, lugar: lugar(centro), abates: g, mortesNos, mortesEles, resultado, ausentes,
        abriu: porId.get(primeira.morreu), abriuNosso: nossa(primeira.morreu),
        objetivosNos: objetivos.filter((e) => deQuem(e) === timeNos), objetivosEles: objetivos.filter((e) => deQuem(e) !== timeNos),
      };
    });
  }

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
    const asLutas = lutas(partida, timeNos);

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

      // luta perdida: quem abriu morrendo e quem estava longe sem participar
      for (const l of asLutas.filter((x) => x.resultado === 'perdeu')) {
        if (l.abriuNosso && l.abriu.id === j.id) add('abriu', 250, { t: l.inicio, lugar: l.lugar, placar: `${l.mortesEles} x ${l.mortesNos}` });
        if (l.ausentes.some((a) => a.id === j.id)) add('ausente', 150, { t: l.inicio, lugar: l.lugar, placar: `${l.mortesEles} x ${l.mortesNos}` });
      }

      if (j.spell4Casts === 0 && partida.duracao >= 15 * 60) add('ult', 300, { minutos: Math.round(partida.duracao / 60) });

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
    return { timeNos, venceu: nos[0].win, nos, eles, vereditos, culpado: vereditos[0], lutas: asLutas };
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
    if (key === 'abriu' || key === 'ausente') {
      const ls = v.infos.map((i) => `${mmss(i.t)} ${i.lugar} (${i.placar})`).slice(0, 3).join('; ');
      return key === 'abriu'
        ? `Foi o primeiro a morrer em ${plural(v.infos.length, 'luta perdida', 'lutas perdidas')}: ${ls}.`
        : `Estava longe e não participou de ${plural(v.infos.length, 'luta perdida', 'lutas perdidas')}: ${ls}.`;
    }
    if (key === 'ult') return `Não usou a ultimate nenhuma vez em ${v.infos[0].minutos} min de jogo.`;
    if (key === 'abates') return `${j.kills}/${j.deaths}/${j.assists}: abates e assistências que renderam ${fmt(-v.ouro)} de ouro ao time.`;
    return '';
  }

  // diferença de ouro do nosso time por minuto (positivo = nós na frente)
  function ouroDoTime(partida, timeNos) {
    const ids = partida.jogadores.map((j) => [j.id, j.teamId === timeNos ? 1 : -1]);
    return partida.quadros.map((q) => ({ t: q.t, dif: soma(ids, ([id, s]) => s * ((q.p[String(id)] || [])[2] || 0)) }));
  }


  // ---------------------------------------------------------------- chance de vitória
  // Modelo simples (não treinado, como o do Dota ainda não dá com poucas partidas): ouro pesa menos no fim de jogo,
  // torres, inibidores, dragões e Barão/Ancião ativos contam a favor de quem tem.
  const PESO = { ouro: 0.45, torre: 0.15, inibidor: 0.5, dragao: 0.12, barao: 0.9, anciao: 1.2, abate: 0.03 };
  const DURA_BARAO = 180, DURA_ANCIAO = 150, JANELA_LANCE_S = 45;

  function ouroNoSegundo(partida, timeNos, t) {
    const q = partida.quadros;
    if (!q.length) return 0;
    const dif = (f) => soma(partida.jogadores, (j) => (j.teamId === timeNos ? 1 : -1) * ((f.p[String(j.id)] || [])[2] || 0));
    const i = Math.min(q.length - 1, Math.floor(t / 60));
    const a = q[i], b = q[Math.min(q.length - 1, i + 1)];
    if (a === b || b.t === a.t) return dif(a);
    return dif(a) + (dif(b) - dif(a)) * Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  }

  // estado do jogo no segundo t, do ponto de vista do nosso time; `ate` decide se o evento no próprio segundo t conta
  function estado(partida, timeNos, t, incluirT = true) {
    const conta = (e) => (incluirT ? e.t <= t : e.t < t);
    const e = { t, ouro: ouroNoSegundo(partida, timeNos, t), torres: 0, inibidores: 0, dragoes: 0, barao: 0, anciao: 0, abates: 0 };
    const time = (id) => (partida.jogadores.find((j) => j.id === id) || {}).teamId;
    for (const ev of partida.eventos) {
      if (!conta(ev)) continue;
      if (ev.tipo === 'abate') e.abates += time(ev.morreu) === timeNos ? -1 : 1;
      else if (ev.tipo === 'estrutura') {
        const s = ev.dono === timeNos ? -1 : 1;
        if (ev.estrutura === 'TOWER_BUILDING') e.torres += s;
        else if (ev.estrutura === 'INHIBITOR_BUILDING') e.inibidores += s;
      } else if (ev.tipo === 'monstro') {
        const s = ev.time === timeNos ? 1 : -1;
        if (ev.monstro === 'DRAGON' && ev.sub === 'ELDER_DRAGON') { if (t - ev.t < DURA_ANCIAO) e.anciao += s; }
        else if (ev.monstro === 'DRAGON') e.dragoes += s;
        else if (ev.monstro === 'BARON_NASHOR' && t - ev.t < DURA_BARAO) e.barao += s;
      }
    }
    return e;
  }

  function chance(e) {
    const min = e.t / 60;
    const z = (PESO.ouro * e.ouro) / 1000 / (1 + min / 20) + PESO.torre * e.torres + PESO.inibidor * e.inibidores
      + PESO.dragao * e.dragoes + PESO.barao * e.barao + PESO.anciao * e.anciao + PESO.abate * e.abates;
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  }

  // curva por minuto e os lances (morte + objetivos que vieram logo depois) com quanto mudaram a chance
  function chanceDeVitoria(partida, timeNos) {
    const fim = partida.duracao;
    const curva = [];
    for (let t = 0; t < fim; t += 60) curva.push({ t, p: chance(estado(partida, timeNos, t)) });
    const venceu = (partida.jogadores.find((j) => j.teamId === timeNos) || {}).win;
    curva.push({ t: fim, p: venceu ? 1 : 0 });

    const porId = new Map(partida.jogadores.map((j) => [j.id, j]));
    const lances = [];
    for (const m of partida.eventos.filter((e) => e.tipo === 'abate')) {
      const vitima = porId.get(m.morreu);
      if (!vitima) continue;
      const nossaMorte = vitima.teamId === timeNos;
      const antes = chance(estado(partida, timeNos, m.t, false));
      // os objetivos que o time de quem matou pegou nos 45 s seguintes entram no lance
      const fimLance = Math.min(fim - 1, m.t + JANELA_LANCE_S);
      const objetivos = partida.eventos.filter((e) => e.t >= m.t && e.t <= fimLance && (
        (e.tipo === 'monstro' && (e.time === timeNos) !== nossaMorte) ||
        (e.tipo === 'estrutura' && (e.dono === timeNos) === nossaMorte)));
      const depois = chance(estado(partida, timeNos, objetivos.length ? objetivos[objetivos.length - 1].t : m.t));
      lances.push({ t: m.t, morte: m, vitima, matou: porId.get(m.matou), nossaMorte, antes, depois, delta: depois - antes, objetivos });
    }
    // dois abates no mesmo lance: fica o primeiro (o que abriu a luta) com o efeito do lance todo
    lances.sort((a, b) => a.t - b.t);
    const throwDoJogo = lances.filter((l) => l.nossaMorte && l.delta <= -0.03).sort((a, b) => a.delta - b.delta)[0] || null;
    const playDoJogo = lances.filter((l) => !l.nossaMorte && l.matou && l.matou.teamId === timeNos && l.delta >= 0.03).sort((a, b) => b.delta - a.delta)[0] || null;
    return { curva, lances, throwDoJogo, playDoJogo };
  }

  const NOMES_OBJ_CURTO = { DRAGON: 'dragão', BARON_NASHOR: 'Barão', RIFTHERALD: 'Arauto', HORDE: 'Vastilarva', ATAKHAN: 'Atakhan',
    TOWER_BUILDING: 'torre', INHIBITOR_BUILDING: 'inibidor' };
  function descreverObjetivos(objs) {
    const cont = {};
    for (const o of objs) {
      const k = o.tipo === 'monstro' ? (o.sub === 'ELDER_DRAGON' ? 'Dragão Ancião' : NOMES_OBJ_CURTO[o.monstro]) : NOMES_OBJ_CURTO[o.estrutura];
      if (k) cont[k] = (cont[k] || 0) + 1;
    }
    const lista = Object.entries(cont).map(([k, n]) => (n > 1 ? `${n} ${PLURAL_OBJETIVO[{ 'dragão': 'DRAGON', torre: 'TOWER_BUILDING', inibidor: 'INHIBITOR_BUILDING', Vastilarva: 'HORDE' }[k]] || k}` : k));
    return lista.length > 1 ? `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}` : lista[0] || '';
  }

  const api = { julgar, lutas, lugar, ouroDoTime, chanceDeVitoria, descreverObjetivos, mmss, fmt, NOME_OBJETIVO, VALOR_OBJETIVO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.CulpadoLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
