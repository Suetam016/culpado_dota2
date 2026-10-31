// O tribunal do LoL, como o do Dota: para cada um do time, o lance que mais custou (em chance de vitória e em ouro)
// e uma coisa para fazer na próxima partida. Usa o veredito e os lances de julgar.js e, se tiver, a leitura da build.
// Puro: roda no navegador (window.TribunalLoL) e no Node (testes: node lol/teste_tribunal.mjs).
(function (raiz) {
  'use strict';

  const pct = (x) => `${Math.round(x * 100)}%`;
  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const VALOR = { DRAGON: 500, ELDER_DRAGON: 1500, BARON_NASHOR: 1500, RIFTHERALD: 600, HORDE: 200, ATAKHAN: 800, TOWER_BUILDING: 650, INHIBITOR_BUILDING: 900 };
  const valorDe = (o) => (o.tipo === 'monstro' ? VALOR[o.monstro === 'DRAGON' && o.sub === 'ELDER_DRAGON' ? 'ELDER_DRAGON' : o.monstro] : VALOR[o.estrutura]) || 0;

  // o lance (morte + objetivos dos 45 s seguintes) do jogador que mais derrubou a chance de vitória
  function piorLance(j, cv, L) {
    const meus = (cv.lances || []).filter((l) => l.nossaMorte && l.morte.morreu === j.id);
    if (!meus.length) return null;
    const l = meus.slice().sort((a, b) => a.delta - b.delta)[0];
    const ouro = (l.morte.recompensa || 0) + l.objetivos.reduce((s, o) => s + valorDe(o), 0);
    const onde = L.lugar(l.morte);
    const por = l.matou ? ` para ${l.matou.championName}` : '';
    const obj = l.objetivos.length ? ` Logo depois os inimigos pegaram ${L.descreverObjetivos(l.objetivos)}.` : '';
    return {
      t: l.t, delta: l.delta, ouro,
      texto: `Aos ${mmss(l.t)} morreu${por} ${onde}.${obj} A chance de vitória foi de ${pct(l.antes)} para ${pct(l.depois)}, e o lance custou ${fmt(ouro)} de ouro.`,
    };
  }

  // sem morte que pesou: o que mais pesou no veredito
  function lanceSemMorte(v) {
    const c = v.componentes.find((x) => x.pontos > 0);
    return c ? { t: null, delta: 0, ouro: c.pontos * 1000, texto: c.evidencia } : null;
  }

  const DICAS = {
    sozinho: (v, c) => `${c.evidencia} Antes de andar pela selva ou pelo rio, olhe o mapa: se dois inimigos sumiram, espere ou vá junto com alguém.`,
    mortes: (v, c, L) => {
      // onde mais morreu: a dica fala daquele lugar
      const cont = {};
      for (const m of v.mortes) if (m.x != null) { const k = L.lugar(m); cont[k] = (cont[k] || 0) + 1; }
      const [onde, n] = Object.entries(cont).sort((a, b) => b[1] - a[1])[0] || [];
      const ouro = fmt(v.mortes.reduce((s, m) => s + (m.recompensa || 0), 0));
      return n >= 2 && n / v.mortes.length >= 0.4
        ? `${n} das ${v.mortes.length} mortes foram ${onde}, e todas juntas deram ${ouro} de ouro ao time deles. Ali, jogue mais atrás e só avance com visão.`
        : `${v.mortes.length === 1 ? 'A única morte deu' : `As ${v.mortes.length} mortes deram`} ${ouro} de ouro ao time deles. Recue mais cedo quando a vida passar da metade.`;
    },
    objetivos: (v, c) => `${c.evidencia} Depois de cada morte eles correm para o objetivo mais perto: quando dragão, Barão ou torre estiverem em jogo, fique perto do time.`,
    rota: (v, c) => `${c.evidencia} Na rota, priorize o farm: pegue as tropas antes de trocar dano e chame o caçador quando o rival forçar.`,
    abriu: (v, c) => `${c.evidencia} Não entre na luta na frente do time: espere o tanque ou o engage e entre logo depois.`,
    ausente: (v, c) => `${c.evidencia} Quando o time agrupar, chegue junto: o farm espera, a luta não.`,
    visao: () => 'Compre uma Sentinela de Controle a cada volta para a base e use a lente para tirar a visão deles antes dos objetivos.',
    ult: () => 'Use a ultimate. O R guardado não ganha luta: solte quando dois inimigos estiverem no alcance.',
  };

  // a dica sai do que mais pesou fora "mortes" (quase todo mundo tem e é genérica); "mortes" só quando nada mais pesou
  const DICA_MIN = 0.5;
  const ORDEM = ['abriu', 'ausente', 'sozinho', 'rota', 'ult', 'visao', 'objetivos'];

  function dica(v, build, L) {
    const cs = v.componentes.filter((x) => x.pontos >= 0.3 && DICAS[x.key]);
    const c = ORDEM.map((k) => cs.find((x) => x.key === k && x.pontos >= DICA_MIN)).find(Boolean) || cs.find((x) => x.key === 'mortes') || cs[0];
    const out = [];
    if (c) out.push(DICAS[c.key](v, c, L));
    const sg = build && build.sugestoes && build.sugestoes[0];
    if (sg) out.push(`Na build, faltou ${sg.nome}: ${sg.motivo}.`);
    if (!out.length) out.push('Partida sem nada pesando contra. Continue assim.');
    return out;
  }

  // v: um veredito; cv: chanceDeVitoria; L: julgar.js; build: leitura da build (opcional)
  function parecer(v, cv, L, build) {
    const lance = piorLance(v.jogador, cv, L) || lanceSemMorte(v);
    return { lance, dicas: dica(v, build, L) };
  }

  const api = { parecer, piorLance, dica };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.TribunalLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
