// Leitura da build no LoL: o que cada um comprou e quando, contra que tipo de dano jogou, do que morreu e o que faltou.
// A Riot não dá build popular por campeão, então a sugestão sai da própria partida (dano do time inimigo, recibo das
// mortes, cura deles) e da classe do campeão. Itens e classes vêm de lol/itens.json e lol/campeoes.json (o coletor baixa
// do Data Dragon); item sugerido que não existe mais no jogo é descartado.
// Puro: roda no navegador (window.BuildLoL) e no Node (testes: node lol/teste_build.mjs).
(function (raiz) {
  'use strict';

  const ITEM_FINAL = 2000;          // a partir desse preço, item que não vira outro conta como item completo
  const TIPO_FORTE = 0.6;           // o time inimigo (ou o que te matou) foi pelo menos 60% de um tipo de dano
  const CURA_ALTA = 9000;           // cura de um inimigo que já pede corte de cura
  const BOLSO_FIM = 1500;           // ouro guardado no fim da partida
  const CONTROLE = 2055;            // Sentinela de Controle

  // sugestões por grupo de campeão: [armadura, resistência mágica, corte de cura, botas]
  const SUGESTOES = {
    Tank: { armadura: [3075, 3143, 3110], magica: [4401, 3065, 2504], cura: [3075], botas: { fisico: 3047, magico: 3111 } },
    Fighter: { armadura: [6333, 3143], magica: [3156, 3065], cura: [6609], botas: { fisico: 3047, magico: 3111 } },
    Assassin: { armadura: [3026, 6333], magica: [3156, 3814], cura: [6609], botas: { fisico: 3047, magico: 3111 } },
    Mage: { armadura: [3157], magica: [3102], cura: [3165], botas: { fisico: 3047, magico: 3111 } },
    Marksman: { armadura: [3026], magica: [3139, 3091], cura: [3033], botas: {} },
    Support: { armadura: [3190], magica: [3190, 3222], cura: [3165], botas: { fisico: 3047, magico: 3111 } },
  };
  const ANTICURA = new Set([3075, 3076, 3033, 3123, 6609, 3165, 3916, 3011]);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');

  function grupo(j, campeoes) {
    if (j.teamPosition === 'UTILITY') return 'Support';
    const tags = ((campeoes || {})[j.championName] || {}).t || [];
    return SUGESTOES[tags[0]] ? tags[0] : 'Fighter';
  }

  // itens completos na ordem em que saíram (sem repetir o mesmo item)
  function completos(j, itens) {
    const vistos = new Set();
    const out = [];
    for (const [t, id] of j.compras || []) {
      const it = itens[String(id)];
      if (!it || vistos.has(id)) continue;
      const bota = it.t.includes('Boots') && it.d >= 2;
      if ((it.g >= ITEM_FINAL && !it.f) || bota) {
        vistos.add(id);
        out.push({ t, id, nome: it.n, bota });
      }
    }
    return out;
  }

  // divisão do dano em físico, mágico e verdadeiro (dano causado a campeões pelo time inimigo)
  function perfil(js) {
    const f = js.reduce((s, j) => s + (j.physicalDamageDealtToChampions || 0), 0);
    const m = js.reduce((s, j) => s + (j.magicDamageDealtToChampions || 0), 0);
    const v = js.reduce((s, j) => s + (j.trueDamageDealtToChampions || 0), 0);
    const t = f + m + v;
    return t ? { fisico: f / t, magico: m / t, verdadeiro: v / t, total: t } : null;
  }

  // do que morreu: soma do recibo de todas as mortes (só dano de campeão)
  function morreuPara(partida, j) {
    let f = 0, m = 0, v = 0, n = 0;
    for (const e of partida.eventos) {
      if (e.tipo !== 'abate' || e.morreu !== j.id || !e.recibo) continue;
      n++;
      for (const x of e.recibo) if (x[0] && x.length >= 8) { f += x[5]; m += x[6]; v += x[7]; }
    }
    const t = f + m + v;
    return t ? { fisico: f / t, magico: m / t, verdadeiro: v / t, total: t, mortes: n } : null;
  }

  function temTag(j, itens, tag) {
    return (j.itens || []).some((id) => ((itens[String(id)] || {}).t || []).includes(tag));
  }

  function ouroNoFim(partida, j) {
    const q = partida.quadros[partida.quadros.length - 1];
    const f = q && q.p[String(j.id)];
    return f && f[6] != null ? f[6] : null;
  }

  function ler(partida, j, r, itens, campeoes) {
    itens = itens || {};
    const eles = partida.jogadores.filter((x) => x.teamId !== j.teamId);
    const g = grupo(j, campeoes);
    const sg = SUGESTOES[g];
    const lista = completos(j, itens);
    const leitura = [];
    const sugestoes = [];
    const existe = (id) => Boolean(itens[String(id)]);
    const tem = (id) => (j.itens || []).includes(id) || (j.compras || []).some((c) => c[1] === id);
    const sugerir = (ids, motivo) => {
      const id = (ids || []).find((x) => existe(x) && !tem(x) && !sugestoes.some((s) => s.id === x));
      if (id) sugestoes.push({ id, nome: itens[String(id)].n, motivo });
    };

    // tempo do primeiro item contra o rival de rota
    const rival = j.teamPosition && eles.find((x) => x.teamPosition === j.teamPosition);
    const primeiro = lista.find((x) => !x.bota);
    const primeiroRival = rival && completos(rival, itens).find((x) => !x.bota);
    if (primeiro) {
      const min = Math.round(primeiro.t / 60);
      if (primeiroRival) {
        const dif = Math.round((primeiroRival.t - primeiro.t) / 60);
        if (dif >= 2) leitura.push({ bom: true, texto: `Primeiro item (${primeiro.nome}) aos ${min} min, ${dif} min antes do rival de rota.` });
        else if (dif <= -2) leitura.push({ bom: false, texto: `Primeiro item (${primeiro.nome}) só aos ${min} min. O rival de rota fechou o dele ${-dif} min antes.` });
        else leitura.push({ bom: null, texto: `Primeiro item (${primeiro.nome}) aos ${min} min, no mesmo tempo do rival de rota.` });
      } else leitura.push({ bom: null, texto: `Primeiro item (${primeiro.nome}) aos ${min} min.` });
    } else if (partida.duracao >= 15 * 60 && j.teamPosition !== 'UTILITY') {
      leitura.push({ bom: false, texto: 'Não fechou nenhum item completo na partida.' });
    }

    // contra que dano jogou e do que morreu
    const pi = perfil(eles);
    const mp = morreuPara(partida, j);
    const armadura = temTag(j, itens, 'Armor');
    const magica = temTag(j, itens, 'SpellBlock');
    const forteFis = (pi && pi.fisico >= TIPO_FORTE) || (mp && mp.mortes >= 3 && mp.fisico >= 0.65);
    const forteMag = (pi && pi.magico >= TIPO_FORTE - 0.05) || (mp && mp.mortes >= 3 && mp.magico >= 0.65);
    const sofreu = (j.deaths || 0) >= (g === 'Marksman' || g === 'Mage' ? 5 : 3);
    if (forteFis) {
      const base = mp && mp.fisico >= 0.65 ? `${pct(mp.fisico)} do dano das mortes foi físico` : `o time deles foi ${pct(pi.fisico)} de dano físico`;
      if (armadura) leitura.push({ bom: true, texto: `Fez armadura, e ${base}: certo.` });
      else if (sofreu) { leitura.push({ bom: false, texto: `Nenhum item de armadura, e ${base}.` }); sugerir(sg.armadura, `armadura contra dano físico (${base})`); }
    }
    if (forteMag) {
      const base = mp && mp.magico >= 0.65 ? `${pct(mp.magico)} do dano das mortes foi mágico` : `o time deles foi ${pct(pi.magico)} de dano mágico`;
      if (magica) leitura.push({ bom: true, texto: `Fez resistência mágica, e ${base}: certo.` });
      else if (sofreu) { leitura.push({ bom: false, texto: `Nenhum item de resistência mágica, e ${base}.` }); sugerir(sg.magica, `resistência mágica (${base})`); }
    }
    if (sofreu && sg.botas && !(j.compras || []).some(([, id]) => ((itens[String(id)] || {}).t || []).includes('Boots') && (itens[String(id)] || {}).d >= 2)) {
      // sem bota de nível 2: a do tipo de dano que mais pesou
      const b = forteMag ? sg.botas.magico : forteFis ? sg.botas.fisico : null;
      if (b) sugerir([b], 'bota contra o dano que mais pesou');
    }

    // cura inimiga
    const nomeC = (x) => ((campeoes || {})[x.championName] || {}).n || x.championName;
    const curandeiro = eles.slice().sort((a, b) => (b.totalHeal || 0) - (a.totalHeal || 0))[0];
    const temCorte = (j.compras || []).some(([, id]) => ANTICURA.has(id));
    if (curandeiro && (curandeiro.totalHeal || 0) >= CURA_ALTA) {
      if (temCorte) leitura.push({ bom: true, texto: `Comprou corte de cura contra ${nomeC(curandeiro)}, que curou ${fmt(curandeiro.totalHeal)}.` });
      else if (g !== 'Support' || (curandeiro.totalHeal || 0) >= CURA_ALTA * 1.5) {
        sugerir(sg.cura, `${nomeC(curandeiro)} curou ${fmt(curandeiro.totalHeal)} na partida`);
        if (sugestoes.length) leitura.push({ bom: false, texto: `${nomeC(curandeiro)} curou ${fmt(curandeiro.totalHeal)} e não teve corte de cura na build.` });
      }
    }

    // visão e ouro parado
    const controles = (j.compras || []).filter(([, id]) => id === CONTROLE).length;
    if (partida.duracao >= 20 * 60) {
      if (!controles) leitura.push({ bom: false, texto: 'Nenhuma Sentinela de Controle comprada (75 de ouro).' });
      else if (controles >= 5) leitura.push({ bom: true, texto: `${plural(controles, 'Sentinela de Controle comprada', 'Sentinelas de Controle compradas')}.` });
    }
    const bolso = ouroNoFim(partida, j);
    if (bolso != null && bolso >= BOLSO_FIM) leitura.push({ bom: false, texto: `Terminou a partida com ${fmt(bolso)} de ouro guardado sem gastar.` });

    return { grupo: g, completos: lista, perfilInimigo: pi, morreuPara: mp, leitura, sugestoes: sugestoes.slice(0, 3), rival };
  }

  const api = { ler, completos, perfil, morreuPara, grupo, SUGESTOES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.BuildLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
