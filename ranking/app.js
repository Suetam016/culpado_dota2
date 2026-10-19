/* Ranking do grupo Marocas: culpados/craques (amigos/ranking.json), duplas e composições (amigos/parceiros.json)
 * e meta do Reddit (reddit/insights.json). */

const RANKING_URL = '../amigos/ranking.json';
const PARCEIROS_URL = '../amigos/parceiros.json';
const INSIGHTS_URL = '../reddit/insights.json';
const META_URL = '../meta/meta.json';
const ITEM_IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/';
const HEROI_IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';
const MIN_JOGOS_DUPLA = 5;   // abaixo disso a dupla vai pro fim (amostra pequena)
const MIN_JOGOS_GRUPO = 3;
// A Valve não expõe o MMR de cada partida: ±25 por ranqueada é uma estimativa
const MMR_POR_PARTIDA = 25;
const TAMANHO_FORMA = 10;
const PARTIDAS_JULGADAS = 20; // PARTIDAS_POR_AMIGO do gerar.js

const POSICOES = { 1: 'Carry', 2: 'Mid', 3: 'Offlane', 4: 'Sup 4', 5: 'Sup 5' };

const VISOES = {
  geral: { filtro: () => true, desc: 'Últimas partidas de cada um. Culpado = quem mais pesou na derrota; craque = quem carregou a vitória.' },
  stack: { filtro: h => h.comStack === true, desc: 'Só partidas com 2 ou mais amigos do mesmo lado.' },
  solo: { filtro: h => h.comStack === false, desc: 'Só partidas sem outro amigo do lado.' },
};

// Período escolhido no slider: vale para todas as abas
const PERIODOS = [
  ['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['3meses', 'Últimos 3 meses'], ['ano', 'Este ano'], ['tudo', 'Tudo'],
];
const CHAVE_PERIODO = 'ranking-periodo';

let ranking = null;
let parceiros = null;
let parceirosBase = null;
let periodo = 'tudo';
let insights = null;
let meta = null;
let visao = 'geral';
let ordem = 'culpados';

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => mudarAba(b.dataset.aba)));
  document.querySelectorAll('[data-ordem]').forEach(b => b.addEventListener('click', () => {
    ordem = b.dataset.ordem;
    document.querySelectorAll('[data-ordem]').forEach(x => x.classList.toggle('chip-ativo', x === b));
    renderizarRanking();
  }));

  montarFeedback();
  montarPeriodo();
  contarVisitas();
  document.querySelectorAll('[data-ordem-elo]').forEach(b => b.addEventListener('click', () => {
    ordemElo = b.dataset.ordemElo;
    document.querySelectorAll('[data-ordem-elo]').forEach(x => x.classList.toggle('chip-ativo', x === b));
    if (ranking) renderizarElo();
  }));

  const pegar = url => fetch(url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  [ranking, parceiros, insights, meta, estadoAtt] = await Promise.all([pegar(RANKING_URL), pegar(PARCEIROS_URL), pegar(INSIGHTS_URL), pegar(META_URL), estadoDoRanking()]);
  // o GitHub Pages pode levar minutos para publicar o ranking novo: se o repositório já tem um mais novo, usa ele
  if (estadoAtt && estadoAtt.atualizadoEm && (!ranking || Date.parse(estadoAtt.atualizadoEm) > Date.parse(ranking.atualizadoEm))) {
    const url = await urlDoCoach();
    const [r2, p2] = await Promise.all([pegar(`${url}/ranking/arquivo/ranking`), pegar(`${url}/ranking/arquivo/parceiros`)]);
    if (r2 && r2.historicos) ranking = r2;
    if (p2 && p2.pares) parceiros = p2;
  }

  if (!ranking || !ranking.historicos) {
    $('carregando').textContent = 'Não deu pra carregar o ranking. Tente recarregar.';
    return;
  }
  $('carregando').hidden = true;
  $('atualizado-em').textContent = `Atualizado em ${dataHora(ranking.atualizadoEm)}`;
  montarAtualizacao();

  parceirosBase = parceiros;
  aplicarPeriodo();

  const pelaUrl = () => {
    const aba = location.hash.slice(1);
    if (aba && document.querySelector(`.aba[data-aba="${aba}"]`)) mudarAba(aba);
  };
  window.addEventListener('hashchange', pelaUrl);
  pelaUrl();
});

function mudarAba(aba) {
  document.querySelectorAll('.aba').forEach(b => {
    b.classList.toggle('aba-ativa', b.dataset.aba === aba);
    b.setAttribute('aria-selected', String(b.dataset.aba === aba));
  });
  const secao = aba in VISOES ? 'ranking' : aba;
  document.querySelectorAll('.aba-conteudo').forEach(s => s.classList.toggle('aba-conteudo-ativa', s.id === `aba-${secao}`));
  history.replaceState(null, '', `#${aba}`);
  if (aba in VISOES) {
    visao = aba;
    renderizarRanking();
  }
  if (aba === 'elo' && ranking) renderizarElo(); // a corrida roda de novo toda vez que a aba abre
}

/* ---------- Ranking (geral / stack / solo) ---------- */

function estatisticas(conta, nome, historico) {
  const vistas = new Set();
  const eventos = historico
    .filter(h => !vistas.has(h.matchId) && vistas.add(h.matchId))
    .filter(VISOES[visao].filtro)
    .filter(h => (h.inicio || 0) >= desdePeriodo())
    .sort((a, b) => (a.inicio || 0) - (b.inicio || 0));
  const venceu = h => h.tipo === 'vitoria' || h.tipo === 'craque';
  const vitorias = eventos.filter(venceu).length;
  const temRanqueada = eventos.some(h => 'ranqueada' in h);
  const ranqueadas = eventos.filter(h => h.ranqueada);
  const vitRanq = ranqueadas.filter(venceu).length;
  return {
    conta, nome,
    partidas: eventos.length,
    vitorias,
    winRate: eventos.length ? Math.round(100 * vitorias / eventos.length) : 0,
    culpados: eventos.filter(h => h.tipo === 'culpado').length,
    craques: eventos.filter(h => h.tipo === 'craque').length,
    mmr: temRanqueada ? (2 * vitRanq - ranqueadas.length) * MMR_POR_PARTIDA : null,
    streak: sequencia(eventos.map(h => h.tipo)),
    forma: eventos.slice(-TAMANHO_FORMA),
  };
}

// 2+ culpados (ou craques) seguidos, ignorando partidas neutras
function sequencia(tipos) {
  const decisivos = tipos.filter(t => t === 'culpado' || t === 'craque');
  const ultimo = decisivos[decisivos.length - 1];
  let n = 0;
  for (let i = decisivos.length - 1; i >= 0 && decisivos[i] === ultimo; i--) n++;
  return n >= 2 ? { tipo: ultimo, n } : null;
}

function renderizarRanking() {
  const nomes = Object.fromEntries(ranking.ranking.map(j => [j.accountId, j.nome]));
  const lista = Object.entries(ranking.historicos)
    .map(([conta, h]) => estatisticas(conta, nomes[conta] || conta, h))
    .filter(j => j.partidas > 0);

  const criterio = {
    culpados: (a, b) => b.culpados - a.culpados || a.craques - b.craques,
    craques: (a, b) => b.craques - a.craques || a.culpados - b.culpados,
    winRate: (a, b) => b.winRate - a.winRate || b.partidas - a.partidas,
    mmr: (a, b) => (b.mmr ?? -Infinity) - (a.mmr ?? -Infinity),
  }[ordem];
  lista.sort(criterio);

  const fora = Object.keys(ranking.historicos).filter(c => !lista.some(j => j.conta === c)).map(c => nomes[c] || c);
  $('ranking-desc').textContent = `${VISOES[visao].desc} O robô julga as últimas ${PARTIDAS_JULGADAS} de cada um.` +
    (fora.length && periodo !== 'tudo' ? ` Sem partida nesse período: ${fora.join(', ')}.` : '');
  const ol = $('lista-jogadores');
  ol.innerHTML = lista.length ? '' : '<li class="carregando">Sem partidas nesse recorte ainda.</li>';

  lista.forEach((j, i) => {
    const li = document.createElement('li');
    li.className = 'jogador' + (i === 0 ? ' jogador-topo' : '');
    const selo = j.streak
      ? `<span class="selo selo-${j.streak.tipo}">${j.streak.tipo === 'culpado' ? '🚨' : '✨'} ${j.streak.n}× ${j.streak.tipo}</span>`
      : '';
    const mmr = j.mmr == null ? '' : ` · MMR ≈ <span class="${j.mmr > 0 ? 'mmr-pos' : j.mmr < 0 ? 'mmr-neg' : ''}">${j.mmr > 0 ? '+' : ''}${j.mmr}</span>`;
    const pontos = j.forma.map(h => {
      const v = h.tipo === 'vitoria' || h.tipo === 'craque';
      const icone = h.tipo === 'craque' ? '✨' : h.tipo === 'culpado' ? '🚨' : '';
      const titulo = `${rotuloTipo(h.tipo)}${h.inicio ? ' · ' + data(h.inicio * 1000) : ''} · ver partida`;
      return `<a class="ponto ponto-${v ? 'v' : 'd'}" href="../#${h.matchId}${h.lado ? '-' + h.lado : ''}" title="${titulo}" aria-label="${titulo}">${icone}</a>`;
    }).join('');

    li.innerHTML = `
      <div class="pos">${i + 1}</div>
      <div class="nome">${esc(j.nome)}${selo}<small>${j.partidas} partidas${mmr}</small></div>
      <div class="col-wr">
        <div class="wr-num">${j.winRate}% <span>${j.vitorias}V · ${j.partidas - j.vitorias}D</span></div>
        <div class="barra-wr"><div style="width:${j.winRate}%"></div></div>
      </div>
      <div class="contador contador-culpa"><b>${j.culpados}</b><span>🚨 culpado</span></div>
      <div class="contador contador-craque"><b>${j.craques}</b><span>✨ craque</span></div>
      <div class="col-forma">
        <div class="forma">${pontos}</div>
        <div class="forma-legenda"><span>mais antiga</span><span>última</span></div>
      </div>`;
    ol.append(li);
  });
}

function rotuloTipo(t) {
  return { culpado: 'Derrota · culpado', craque: 'Vitória · craque', vitoria: 'Vitória', derrota: 'Derrota' }[t] || t;
}

/* ---------- Duplas ---------- */

function heroi(id, classe = 'heroi') {
  const h = parceiros.herois && parceiros.herois[id];
  if (!h || !h[0]) return `<span class="heroi-falta">${h ? esc(h[1]) : '?'}</span>`;
  return `<img class="${classe}" src="${HEROI_IMG}${h[0]}.png" alt="${esc(h[1])}" title="${esc(h[1])}" loading="lazy" width="56" height="32">`;
}

function nomeHeroi(id) {
  const h = parceiros.herois && parceiros.herois[id];
  return h ? h[1] : `#${id}`;
}

function nomeJogador(conta) {
  if (parceiros.jogadores[conta]) return parceiros.jogadores[conta].nome;
  const r = ranking && ranking.ranking.find(j => j.accountId === conta);
  return r ? r.nome : conta;
}

function corWr(wr, jogos) {
  const forca = Math.min(1, Math.abs(wr - 50) / 30) * (jogos >= MIN_JOGOS_DUPLA ? 1 : 0.5);
  const base = wr >= 50 ? 'var(--good)' : 'var(--bad)';
  return `background:color-mix(in srgb, ${base} ${Math.round(12 + forca * 58)}%, var(--surface))`;
}

function renderizarDuplas() {
  const grade = $('grade-sinergia');
  const select = $('filtro-jogador');
  if (!parceiros || !parceiros.pares || !parceiros.pares.length) {
    grade.innerHTML = '';
    select.length = 1;
    $('lista-duplas').innerHTML = `<p class="carregando">${parceiros && parceiros.jogos ? 'Nenhuma dupla jogou junto nesse período.' : 'Sem dados de duplas ainda.'}</p>`;
    return;
  }

  const contas = Object.keys(parceiros.jogadores).sort((a, b) => nomeJogador(a).localeCompare(nomeJogador(b)));
  const parDe = (a, b) => parceiros.pares.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));

  grade.innerHTML = `<thead><tr><th></th>${contas.map(c => `<th scope="col">${esc(nomeJogador(c))}</th>`).join('')}</tr></thead>
    <tbody>${contas.map(a => `<tr><th scope="row">${esc(nomeJogador(a))}</th>${contas.map(b => {
      if (a === b) return '<td class="casa casa-eu"></td>';
      const p = parDe(a, b);
      if (!p) return '<td class="casa casa-vazia" title="Nunca jogaram juntos">—</td>';
      return `<td class="casa" style="${corWr(p.winRate, p.jogos)}" data-a="${a}" data-b="${b}"
        title="${esc(nomeJogador(a))} + ${esc(nomeJogador(b))}: ${p.vitorias}V em ${p.jogos}">${p.winRate}%<small>${p.jogos}j</small></td>`;
    }).join('')}</tr>`).join('')}</tbody>`;

  if (!grade.dataset.ouvindo) {
    grade.dataset.ouvindo = '1';
    grade.addEventListener('click', e => {
      const casa = e.target.closest('td[data-a]');
      if (!casa) return;
      $('filtro-jogador').value = casa.dataset.a;
      renderizarListaDuplas(casa.dataset.b);
    });
    select.addEventListener('change', () => renderizarListaDuplas());
  }

  const antes = select.value;
  select.length = 1;
  contas.forEach(c => select.add(new Option(nomeJogador(c), c)));
  select.value = contas.includes(antes) ? antes : '';
  renderizarListaDuplas();
}

// Deixa o jogador escolhido no filtro sempre como "A"
function inverterPar(p) {
  const troca = x => ({ ...x, posA: x.posB, posB: x.posA, heroiA: x.heroiB, heroiB: x.heroiA });
  return {
    ...p, a: p.b, b: p.a, nomeA: p.nomeB, nomeB: p.nomeA,
    rotas: p.rotas.map(troca), rotasPiores: p.rotasPiores.map(troca),
    herois: p.herois.map(troca), heroisPiores: p.heroisPiores.map(troca),
    partidas: (p.partidas || []).map(troca),
    lanes: p.lanes && { ...p.lanes, rotas: p.lanes.rotas.map(troca) },
  };
}

function renderizarListaDuplas(destaque) {
  const filtro = $('filtro-jogador').value;
  const lista = $('lista-duplas');
  const pares = parceiros.pares
    .filter(p => !filtro || p.a === filtro || p.b === filtro)
    .map(p => (filtro && p.b === filtro ? inverterPar(p) : p))
    .sort((x, y) => (y.jogos >= MIN_JOGOS_DUPLA) - (x.jogos >= MIN_JOGOS_DUPLA) || y.winRate - x.winRate || y.jogos - x.jogos);

  lista.innerHTML = '';
  pares.forEach(p => lista.append(cartaoDupla(p, p.b === destaque)));
  if (destaque) {
    const alvo = lista.querySelector('.cartao-destaque');
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function cartaoDupla(p, destaque) {
  const div = document.createElement('article');
  div.className = 'cartao' + (p.jogos < MIN_JOGOS_DUPLA ? ' cartao-poucos' : '') + (destaque ? ' cartao-destaque' : '');
  const nomeA = esc(p.nomeA), nomeB = esc(p.nomeB);
  const partidas = p.partidas || [];

  const lane = partidas.length
    ? `<div class="lane">${partidas.map(m => `
        <div class="par par-${m.venceu ? 'v' : 'd'}" title="${m.venceu ? 'Vitória' : 'Derrota'} · ${data(m.inicio * 1000)} · ${esc(nomeHeroi(m.heroiA))} + ${esc(nomeHeroi(m.heroiB))}">
          <div class="par-herois">${heroi(m.heroiA)}${heroi(m.heroiB)}</div>
          <div class="legenda-par"><span>${POSICOES[m.posA] || '?'}</span><span>${m.venceu ? 'V' : 'D'}</span><span>${POSICOES[m.posB] || '?'}</span></div>
          ${m.lane == null ? '' : `<div class="par-lane par-lane-${m.lane > 0 ? 'v' : m.lane < 0 ? 'd' : 'e'}" title="Na mesma lane: ${m.lane > 0 ? 'ganharam' : m.lane < 0 ? 'perderam' : 'empataram'} a lane">lane ${m.lane > 0 ? '✔' : m.lane < 0 ? '✖' : '='}</div>`}
        </div>`).join('')}</div>`
    : '<div class="lane"><span class="lane-vazia">Sem heróis registrados.</span></div>';

  const sinergia = (h, boa) => `
    <div class="sinergia">
      <div class="sinergia-herois">${heroi(h.heroiA)}${heroi(h.heroiB)}</div>
      <div class="sinergia-txt"><b>${esc(nomeHeroi(h.heroiA))} + ${esc(nomeHeroi(h.heroiB))}</b>${nomeA} de ${esc(nomeHeroi(h.heroiA))}, ${nomeB} de ${esc(nomeHeroi(h.heroiB))}</div>
      <div class="sinergia-num ${boa ? 'bom' : 'ruim'}">${h.vitorias}/${h.jogos}</div>
    </div>`;

  const rota = (r, classe) => `<span class="rota ${classe}">${nomeA} <b>${POSICOES[r.posA] || r.posA}</b> + ${nomeB} <b>${POSICOES[r.posB] || r.posB}</b> · ${r.winRate}% em ${r.jogos}</span>`;
  const rotasBoas = p.rotas.filter(r => r.winRate > 50).slice(0, 3);
  const l = p.lanes;
  const lanes = l && l.jogos ? `<div class="bloco-titulo">Duo lane · ouro + XP aos ${MINUTO_LANE} min</div>
    <div class="duo-lane">
      <div class="duo-lane-num"><b class="${l.ganhas > l.perdidas ? 'bom' : l.ganhas < l.perdidas ? 'ruim' : ''}">${l.ganhas}/${l.jogos}</b><span>lanes ganhas</span></div>
      <div class="duo-lane-barra" title="${l.ganhas} ganhas · ${l.empates} empatadas · ${l.perdidas} perdidas">
        <div class="dl-v" style="flex:${l.ganhas}"></div><div class="dl-e" style="flex:${l.empates}"></div><div class="dl-d" style="flex:${l.perdidas}"></div>
      </div>
      <div class="duo-lane-legenda"><span class="bom">${l.ganhas} ganha${l.ganhas === 1 ? '' : 's'}</span><span>${l.empates} empate${l.empates === 1 ? '' : 's'}</span><span class="ruim">${l.perdidas} perdida${l.perdidas === 1 ? '' : 's'}</span></div>
      ${l.rotas.length ? `<div class="duo-lane-rotas">${l.rotas.slice(0, 3).map(r => `<span class="rota ${r.ganhas > r.perdidas ? 'rota-boa' : r.ganhas < r.perdidas ? 'rota-ruim' : ''}">${nomeA} <b>${POSICOES[r.posA] || '?'}</b> + ${nomeB} <b>${POSICOES[r.posB] || '?'}</b> · ${r.ganhas}/${r.jogos} lanes</span>`).join('')}</div>` : ''}
    </div>` : `<div class="bloco-titulo">Duo lane</div><p class="cartao-sub">Não caíram na mesma lane ${periodo === 'tudo' ? 'nas partidas guardadas' : 'nesse período'}.</p>`;

  div.innerHTML = `
    <div class="cartao-topo">
      <div>
        <div class="cartao-titulo">${nomeA} + ${nomeB}</div>
        <div class="cartao-sub">${p.vitorias} vitórias em ${p.jogos} jogos juntos${p.jogos < MIN_JOGOS_DUPLA ? ' · poucos jogos' : ''}</div>
      </div>
      <div class="wr-grande ${p.winRate > 50 ? 'bom' : p.winRate < 50 ? 'ruim' : ''}">${p.winRate}%</div>
    </div>
    ${lanes}
    <div class="bloco-titulo">Últimas partidas juntos</div>
    ${lane}
    ${p.herois.length || p.heroisPiores.length ? `<div class="bloco-titulo">Sinergias de heróis</div>
      <div class="sinergias">${p.herois.map(h => sinergia(h, true)).join('')}${p.heroisPiores.map(h => sinergia(h, false)).join('')}</div>` : ''}
    ${rotasBoas.length || p.rotasPiores.length ? `<div class="bloco-titulo">Rotas</div>
      <div class="rotas">${rotasBoas.map(r => rota(r, 'rota-boa')).join('')}${p.rotasPiores.map(r => rota(r, 'rota-ruim')).join('')}</div>` : ''}`;
  return div;
}

/* ---------- Composições ---------- */

function renderizarComposicoes() {
  montarSugestao();
  renderizarPool();
  const lista = $('lista-composicoes');
  lista.innerHTML = '';
  const grupos = (parceiros && parceiros.composicoes) || [];
  if (!grupos.length) {
    lista.innerHTML = '<p class="carregando">Ainda não tem partida com 3 ou mais amigos do mesmo lado.</p>';
    return;
  }
  [...grupos]
    .sort((x, y) => (y.jogos >= MIN_JOGOS_GRUPO) - (x.jogos >= MIN_JOGOS_GRUPO) || y.winRate - x.winRate || y.jogos - x.jogos)
    .forEach(g => lista.append(cartaoComposicao(g)));
}

function cartaoComposicao(g) {
  const div = document.createElement('article');
  div.className = 'cartao' + (g.jogos < MIN_JOGOS_GRUPO ? ' cartao-poucos' : '');
  const tamanho = { 3: 'Trio', 4: 'Quarteto', 5: 'Time fechado' }[g.membros.length] || 'Grupo';

  // herói que cada um mais jogou (e ganhou) com esse grupo
  const heroiDoGrupo = c => ((g.herois || {})[c] || [])[0];
  const formacao = f => {
    const quem = {};
    Object.entries(f.posicoes).forEach(([c, pos]) => { quem[pos] = c; });
    return `<div class="formacao">${[1, 2, 3, 4, 5].map(pos => {
      const c = quem[pos], h = c && heroiDoGrupo(c);
      return `<div class="slot${c ? '' : ' slot-vazio'}"><span>${POSICOES[pos]}</span>${h ? heroi(h.heroi) : ''}<b>${c ? esc(nomeJogador(c)) : 'random'}</b>${h ? `<small>${esc(nomeHeroi(h.heroi))} ${h.vitorias}/${h.jogos}</small>` : ''}</div>`;
    }).join('')}</div>
      <div class="formacao-num">${f.winRate}% · ${f.vitorias}V em ${f.jogos}</div>`;
  };

  const partida = m => {
    const herois = Object.entries(m.herois).sort((a, b) => (a[1].pos || 9) - (b[1].pos || 9));
    return `<div class="time-partida">
      <div class="time-res ${m.venceu ? 'bom' : 'ruim'}" title="${data(m.inicio * 1000)}">${m.venceu ? 'V' : 'D'}</div>
      <div class="time-herois">${herois.map(([c, h]) => `
        <div class="time-heroi">${heroi(h.heroi)}<span>${esc(nomeJogador(c))}</span></div>`).join('')}</div>
    </div>`;
  };

  div.innerHTML = `
    <div class="cartao-topo">
      <div>
        <div class="cartao-titulo">${tamanho}</div>
        <div class="membros">${g.membros.map(c => `<span class="membro">${esc(nomeJogador(c))}</span>`).join('')}</div>
      </div>
      <div style="text-align:right">
        <div class="wr-grande ${g.winRate > 50 ? 'bom' : g.winRate < 50 ? 'ruim' : ''}">${g.winRate}%</div>
        <div class="cartao-sub">${g.vitorias}V em ${g.jogos}</div>
      </div>
    </div>
    ${g.formacoes.length ? `<div class="bloco-titulo">Formação que mais se repete</div>${formacao(g.formacoes[0])}` : ''}
    <div class="bloco-titulo">Últimas partidas</div>
    ${g.partidas.map(partida).join('')}`;
  return div;
}

/* ---------- Traços dos heróis (estilo TFT) ----------
 * Cada herói tem alguns traços (lista à mão, pelo nome interno da imagem). O time ativa sinergias quando junta
 * heróis com o mesmo traço (2 = bronze, 3 = prata, 4+ = ouro) ou combinações (carry de late + babá). As sinergias
 * dão um bônus pequeno na nota do time e aparecem na montagem. */

const { TRACOS } = HeroisTracos; // herois-tracos.js (compartilhado com o painel da partida)

function slugDoHeroi(id) {
  const h = parceiros && parceiros.herois && parceiros.herois[id];
  return h ? h[0] : null;
}
const tracosDe = id => HeroisTracos.tracos(slugDoHeroi(id));

// sinergias ativas, quase ativas e alertas de um time (lista de ids de herói)
const sinergiasDoTime = herois => HeroisTracos.sinergias(herois.map(slugDoHeroi));

// selo de power-up no herói: forte ou fraco no patch atual
function powerUp(wr) {
  if (wr == null) return '';
  if (wr >= 54) return `<span class="power power-2" title="Muito forte no patch: ${wr.toLocaleString('pt-BR')}% de vitória">⚡⚡</span>`;
  if (wr >= 52) return `<span class="power power-1" title="Forte no patch: ${wr.toLocaleString('pt-BR')}% de vitória">⚡</span>`;
  if (wr <= 47) return `<span class="power power-fraco" title="Fraco no patch: ${wr.toLocaleString('pt-BR')}% de vitória">🧊</span>`;
  return '';
}

function iconesTracos(id) {
  return `<div class="tracos">${tracosDe(id).map(t =>
    `<span class="traco" title="${esc(TRACOS[t].nome)}: ${esc(TRACOS[t].desc)}">${TRACOS[t].icone}</span>`).join('')}</div>`;
}

function painelSinergias(s) {
  const nivelNome = ['', 'bronze', 'prata', 'ouro'];
  const ordem = [...s.lista].sort((a, b) => b.nivel - a.nivel || b.n - a.n);
  const chips = ordem.filter(x => x.n > 0).map(x => `
    <div class="sinergia-chip ${x.nivel ? `nivel-${nivelNome[Math.min(3, x.nivel)]}` : 'inativa'}" title="${esc(x.desc)}">
      <span class="sinergia-icone">${x.icone}</span>
      <div><b>${esc(x.nome)}</b>
        <span class="pips">${x.niveis.map(l => `<i class="${x.n >= l ? 'on' : ''}">${l}</i>`).join('')}</span></div>
    </div>`).join('');
  return `<div class="sinergias-time">
    <div class="bloco-titulo">Sinergias do time</div>
    <div class="sinergia-chips">${chips || '<span class="cartao-sub">Nenhuma ainda.</span>'}</div>
    ${s.alertas.length ? `<ul class="alertas-time">${s.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
  </div>`;
}


/* ---------- Sugestão de time ----------
 * Nota de cada pick = proficiência do amigo no herói/posição (win rate puxada pra 50% quando há poucos jogos, prior
 * de PESO_PRIOR partidas, mais um bônus de experiência por número de jogos) + força do herói no meta atual (win rate
 * do OpenDota no patch). O time soma os picks, as duplas de heróis que já deram certo entre dois amigos e as
 * formações (3+ amigos nas mesmas posições) que já jogaram juntas. Busca exaustiva: no máximo 5 amigos × 120 jeitos
 * de distribuir as posições × 3 heróis por amigo/posição. */

const PESO_PRIOR = 10;
const MIN_JOGOS_PICK = 2;
const PESO_SINERGIA = 0.5;
const PESO_EXPERIENCIA = 0.15; // × ln(1 + jogos): 4 jogos ≈ +0,24, 20 jogos ≈ +0,46
const PESO_META = 2;           // × logit(win rate do meta): 55% ≈ +0,4, 45% ≈ -0,4
const PESO_FORMACAO = 1;
const MAX_TIME = 5;
let escolhidos = null;
let fixos = {};      // conta -> { heroi, pos } escolhido na mão (clicando no herói)
let abertoPick = null; // conta com a lista de opções aberta

const suavizado = (v, j) => (v + PESO_PRIOR / 2) / (j + PESO_PRIOR);
const logit = p => Math.log(p / (1 - p));

function candidatos(conta) {
  const pool = (parceiros.pool || {})[conta] || [];
  const porPos = {};
  for (const minimo of [MIN_JOGOS_PICK, 1]) {
    pool.filter(x => x.pos && x.jogos >= minimo).forEach(x => {
      const wrMeta = metaDoHeroi(x.heroi);
      const notaMeta = wrMeta == null ? 0 : PESO_META * logit(wrMeta / 100);
      const notaJogador = logit(suavizado(x.vitorias, x.jogos)) + PESO_EXPERIENCIA * Math.log(1 + x.jogos);
      (porPos[x.pos] = porPos[x.pos] || []).push({ ...x, wrMeta, nota: notaJogador + notaMeta });
    });
    if (Object.keys(porPos).length) break;
  }
  Object.values(porPos).forEach(l => l.sort((a, b) => b.nota - a.nota));
  return porPos;
}

function sinergiaEntre(ca, ha, cb, hb) {
  const p = parceiros.pares.find(x => (x.a === ca && x.b === cb) || (x.a === cb && x.b === ca));
  if (!p) return null;
  const [h1, h2] = p.a === ca ? [ha, hb] : [hb, ha];
  return [...p.herois, ...p.heroisPiores].find(x => x.heroiA === h1 && x.heroiB === h2) || null;
}

function permutacoes(n, livres = [1, 2, 3, 4, 5]) {
  if (!n) return [[]];
  return livres.flatMap(pos => permutacoes(n - 1, livres.filter(x => x !== pos)).map(r => [pos, ...r]));
}

// win rate do herói no patch atual (última foto do meta.json), ou null
function metaDoHeroi(id) {
  const h = meta && meta.historico && meta.historico[meta.historico.length - 1];
  const wr = h && h.wr && h.wr[id];
  return typeof wr === 'number' ? wr : null;
}

// formações já jogadas (3+ amigos, cada um numa posição) cujos membros estão todos entre os escolhidos
function formacoesDe(contas) {
  return ((parceiros && parceiros.composicoes) || []).filter(g => g.membros.every(c => contas.includes(c)))
    .flatMap(g => g.formacoes.map(f => ({ ...f, membros: g.membros })));
}

function melhoresTimes(contas) {
  const cand = Object.fromEntries(contas.map(c => [c, candidatos(c)]));
  const formacoes = formacoesDe(contas);
  const times = [];
  for (const posicoes of permutacoes(contas.length)) {
    const posDe = Object.fromEntries(contas.map((c, i) => [c, posicoes[i]]));
    const formacao = formacoes.filter(f => f.membros.every(c => f.posicoes[c] === posDe[c]));
    const notaFormacao = formacao.reduce((s, f) => s + PESO_FORMACAO * logit(suavizado(f.vitorias, f.jogos)), 0);
    const opcoes = contas.map((c, i) => {
      const lista = cand[c][posicoes[i]] || [];
      const f = fixos[c];
      if (!f) return lista.slice(0, 3);
      return f.pos === posicoes[i] ? lista.filter(x => x.heroi === f.heroi) : [];
    });
    if (opcoes.some(o => !o.length)) continue;
    const combinar = (i, atual) => {
      if (i === contas.length) {
        const herois = new Set(atual.map(x => x.heroi));
        if (herois.size < atual.length) return;
        let nota = notaFormacao + sinergiasDoTime(atual.map(x => x.heroi)).nota + atual.reduce((s, x) => s + x.nota, 0);
        const sinergias = [];
        for (let a = 0; a < atual.length; a++) for (let b = a + 1; b < atual.length; b++) {
          const sn = sinergiaEntre(contas[a], atual[a].heroi, contas[b], atual[b].heroi);
          if (sn) {
            nota += PESO_SINERGIA * logit(suavizado(sn.vitorias, sn.jogos));
            sinergias.push({ a: contas[a], b: contas[b], ...sn, ha: atual[a].heroi, hb: atual[b].heroi });
          }
        }
        times.push({ nota, picks: atual.map((x, k) => ({ ...x, conta: contas[k], pos: posicoes[k] })), sinergias, formacao });
        return;
      }
      opcoes[i].forEach(o => combinar(i + 1, [...atual, o]));
    };
    combinar(0, []);
  }
  times.sort((a, b) => b.nota - a.nota);
  return { times, semDados: contas.filter(c => !Object.keys(cand[c]).length) };
}

function montarSugestao() {
  const box = $('escolha-jogadores');
  if (!parceiros || !parceiros.pool) { $('time-sugerido').innerHTML = '<p class="carregando">Sem histórico de heróis ainda.</p>'; return; }
  const total = c => ((parceiros.pool || {})[c] || []).reduce((s, x) => s + x.jogos, 0);
  const contas = Object.keys(parceiros.pool).sort((a, b) => total(b) - total(a));
  // trocar de período mantém quem já foi marcado
  escolhidos = escolhidos ? new Set([...escolhidos].filter(c => contas.includes(c))) : new Set(contas.slice(0, MAX_TIME));
  box.innerHTML = '';
  if (!contas.length) { $('time-sugerido').innerHTML = '<p class="carregando">Ninguém jogou nesse período.</p>'; return; }

  const aviso = document.createElement('p');
  aviso.className = 'escolha-aviso';
  contas.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = nomeJogador(c);
    b.setAttribute('aria-pressed', String(escolhidos.has(c)));
    b.addEventListener('click', () => {
      aviso.textContent = '';
      if (escolhidos.has(c)) escolhidos.delete(c);
      else if (escolhidos.size >= MAX_TIME) { aviso.textContent = 'Time cheio: desmarque alguém antes.'; return; }
      else escolhidos.add(c);
      b.setAttribute('aria-pressed', String(escolhidos.has(c)));
      if (!escolhidos.has(c)) delete fixos[c];
      renderizarSugestao();
    });
    box.append(b);
  });
  box.append(aviso);
  renderizarSugestao();
}

function seloMeta(wr) {
  if (wr == null) return '';
  const forte = wr >= 52, fraco = wr <= 48;
  return `<span class="selo-meta ${forte ? 'bom' : fraco ? 'ruim' : ''}" title="Win rate do herói no patch atual (OpenDota)">${forte ? '🔥' : fraco ? '🧊' : '⚖️'} meta ${wr.toLocaleString('pt-BR')}%</span>`;
}

function renderizarSugestao() {
  const alvo = $('time-sugerido');
  if (!alvo.dataset.ouvindo) {
    alvo.dataset.ouvindo = '1';
    alvo.addEventListener('click', e => {
      const abrir = e.target.closest('[data-abrir]');
      const opcao = e.target.closest('[data-opcao]');
      const soltar = e.target.closest('[data-soltar]');
      if (opcao) {
        const [c, heroi, pos] = opcao.dataset.opcao.split('|');
        fixos[c] = { heroi: Number(heroi), pos: Number(pos) };
        // quem já estava travado nessa posição sai dela
        Object.keys(fixos).forEach(o => { if (o !== c && fixos[o].pos === Number(pos)) delete fixos[o]; });
        abertoPick = null;
      } else if (soltar) {
        if (soltar.dataset.soltar === '*') fixos = {};
        else delete fixos[soltar.dataset.soltar];
        abertoPick = null;
      } else if (abrir) {
        abertoPick = abertoPick === abrir.dataset.abrir ? null : abrir.dataset.abrir;
      } else return;
      renderizarSugestao();
    });
  }
  const contas = [...escolhidos];
  Object.keys(fixos).forEach(c => { if (!escolhidos.has(c)) delete fixos[c]; });
  if (!contas.length) { alvo.innerHTML = '<p class="carregando">Marque quem vai jogar.</p>'; return; }
  const { times, semDados } = melhoresTimes(contas);
  if (!times.length) {
    alvo.innerHTML = Object.keys(fixos).length
      ? `<p class="carregando">Com esses heróis travados não dá pra fechar o time. <button type="button" class="chip" data-soltar="*">Voltar à sugestão</button></p>`
      : `<p class="carregando">Não deu pra montar um time sem repetir posição com o histórico de ${esc(semDados.map(nomeJogador).join(', ') || 'vocês')}. Tente outra combinação.</p>`;
    return;
  }
  const [melhor] = times;
  const media = Math.round(100 * melhor.picks.reduce((s, x) => s + suavizado(x.vitorias, x.jogos), 0) / melhor.picks.length);
  const ordenados = [...melhor.picks].sort((a, b) => a.pos - b.pos);
  const pct = x => Math.round((100 * x.vitorias) / x.jogos);
  const classe = x => (x.vitorias / x.jogos > 0.5 ? 'bom' : x.vitorias / x.jogos < 0.5 ? 'ruim' : '');

  // opções de quem foi clicado: outros heróis na mesma posição e o melhor de cada outra posição
  const painel = () => {
    const x = melhor.picks.find(p => p.conta === abertoPick);
    if (!x) return '';
    const cand = candidatos(x.conta);
    const usados = new Set(melhor.picks.filter(p => p.conta !== x.conta).map(p => p.heroi));
    const opcao = o => `<button type="button" class="opcao${o.heroi === x.heroi && o.pos === x.pos ? ' opcao-atual' : ''}" data-opcao="${x.conta}|${o.heroi}|${o.pos}"
        ${usados.has(o.heroi) ? 'disabled title="Outro jogador do time já está com esse herói"' : ''}>
        <span class="opcao-img">${heroi(o.heroi)}${powerUp(o.wrMeta)}</span><b>${esc(nomeHeroi(o.heroi))}</b>${iconesTracos(o.heroi)}<span>${POSICOES[o.pos]}</span>
        <span class="opcao-num ${classe(o)}">${o.vitorias}/${o.jogos} · ${pct(o)}%</span>${seloMeta(o.wrMeta)}</button>`;
    const mesma = (cand[x.pos] || []).slice(0, 8);
    const outras = [1, 2, 3, 4, 5].filter(p => p !== x.pos).flatMap(p => (cand[p] || []).slice(0, 2));
    return `<div class="opcoes">
      <div class="opcoes-cab"><b>Outras opções de ${esc(nomeJogador(x.conta))}</b>
        <button type="button" class="opcoes-fechar" data-abrir="${x.conta}" aria-label="Fechar">✕</button></div>
      <div class="bloco-titulo">De ${POSICOES[x.pos]}</div>
      <div class="opcoes-lista">${mesma.map(opcao).join('') || '<span class="cartao-sub">Só esse herói nessa posição.</span>'}</div>
      ${outras.length ? `<div class="bloco-titulo">Em outra posição</div><div class="opcoes-lista">${outras.map(opcao).join('')}</div>` : ''}
      <p class="time-nota">Escolher um herói trava esse pick e remonta o resto do time em volta dele.</p>
    </div>`;
  };

  alvo.innerHTML = `
    <div class="time">
      <div class="time-cab">
        <div><h3>Time sugerido</h3><p>${contas.length} ${contas.length === 1 ? 'jogador' : 'jogadores'} · aproveitamento médio nesses picks ≈ ${media}% · toque no herói pra ver outras opções</p></div>
        ${Object.keys(fixos).length ? '<button type="button" class="chip" data-soltar="*">↺ Voltar à sugestão</button>' : ''}
      </div>
      <div class="escalacao">${ordenados.map(x => `<div class="pick${fixos[x.conta] ? ' pick-fixo' : ''}${abertoPick === x.conta ? ' pick-aberto' : ''}">
          <div class="pick-pos">${POSICOES[x.pos]}${fixos[x.conta] ? ' · 🔒' : ''}</div>
          <button type="button" class="pick-trocar" data-abrir="${x.conta}" aria-expanded="${abertoPick === x.conta}" title="Ver outras opções de ${esc(nomeJogador(x.conta))}">
            ${heroi(x.heroi)}${powerUp(x.wrMeta)}<span class="pick-trocar-txt">⇄ opções</span></button>
          <div class="pick-heroi">${esc(nomeHeroi(x.heroi))}</div>
          ${iconesTracos(x.heroi)}
          <div class="pick-quem">${esc(nomeJogador(x.conta))}</div>
          <div class="pick-num ${classe(x)}">${x.vitorias}V em ${x.jogos} (${pct(x)}%)</div>
          ${seloMeta(x.wrMeta)}
          ${fixos[x.conta] ? `<button type="button" class="pick-soltar" data-soltar="${x.conta}">destravar</button>` : ''}
        </div>`).join('')}</div>
      ${painelSinergias(sinergiasDoTime(melhor.picks.map(p => p.heroi)))}
      ${painel()}
      ${melhor.formacao.length ? `<div class="sinergia-time">Formação que vocês já jogaram: ${melhor.formacao.map(f =>
        `${f.membros.map(c => `${esc(nomeJogador(c))} ${POSICOES[f.posicoes[c]]}`).join(', ')} <b>${f.vitorias}/${f.jogos}</b>`).join(' · ')}</div>` : ''}
      ${melhor.sinergias.length ? `<div class="sinergia-time">Sinergia: ${melhor.sinergias.map(sn =>
        `${esc(nomeHeroi(sn.ha))} (${esc(nomeJogador(sn.a))}) + ${esc(nomeHeroi(sn.hb))} (${esc(nomeJogador(sn.b))}) <b>${sn.vitorias}/${sn.jogos}</b>`).join(' · ')}</div>` : ''}
      <p class="time-nota">A nota junta a proficiência de cada um no herói (win rate e quantos jogos tem com ele), a força do herói no meta atual (⚡), as sinergias do time, as duplas de heróis e as formações que já deram certo entre vocês. Com poucos jogos o modelo puxa a win rate pra 50%, então quem tem muitos jogos bons pesa mais que um 2/2. É o histórico de vocês${periodo === 'tudo' ? '' : ' no período escolhido'}, não leva em conta o draft do inimigo.</p>
    </div>`;
}

function renderizarPool() {
  const alvo = $('pool-jogadores');
  alvo.innerHTML = '';
  if (!parceiros || !parceiros.pool) return;
  const total = c => parceiros.pool[c].reduce((s, x) => s + x.jogos, 0);
  Object.keys(parceiros.pool).sort((a, b) => total(b) - total(a)).forEach(c => {
    // junta as posições: aqui interessa o herói
    const porHeroi = {};
    parceiros.pool[c].forEach(x => {
      const h = porHeroi[x.heroi] = porHeroi[x.heroi] || { heroi: x.heroi, jogos: 0, vitorias: 0, pos: {} };
      h.jogos += x.jogos; h.vitorias += x.vitorias;
      if (x.pos) h.pos[x.pos] = (h.pos[x.pos] || 0) + x.jogos;
    });
    const herois = Object.values(porHeroi).filter(h => h.jogos >= MIN_JOGOS_PICK)
      .map(h => ({ ...h, nota: suavizado(h.vitorias, h.jogos), posPrincipal: Object.entries(h.pos).sort((a, b) => b[1] - a[1])[0] }));
    const bons = [...herois].sort((a, b) => b.nota - a.nota).filter(h => h.vitorias / h.jogos > 0.5).slice(0, 4);
    const ruins = [...herois].sort((a, b) => a.nota - b.nota).filter(h => h.vitorias / h.jogos < 0.5 && h.jogos >= 3).slice(0, 2);
    const item = (h, boa) => `<div class="pool-item">${heroi(h.heroi)}
      <div class="pool-txt"><b>${esc(nomeHeroi(h.heroi))}</b><span>${h.posPrincipal ? POSICOES[h.posPrincipal[0]] : ''}</span></div>
      <div class="pool-num ${boa ? 'bom' : 'ruim'}">${h.vitorias}/${h.jogos}<br>${Math.round(100 * h.vitorias / h.jogos)}%</div></div>`;
    const card = document.createElement('article');
    card.className = 'cartao';
    card.innerHTML = `
      <div class="cartao-topo"><div class="cartao-titulo">${esc(nomeJogador(c))}</div><div class="cartao-sub">${total(c)} partidas · ${Object.keys(porHeroi).length} heróis</div></div>
      <div class="bloco-titulo">✅ Picks que ganham</div>
      <div class="pool-lista">${bons.length ? bons.map(h => item(h, true)).join('') : '<span class="cartao-sub">Ainda sem herói com 2+ jogos e mais vitórias que derrotas.</span>'}</div>
      ${ruins.length ? `<div class="bloco-titulo">🚫 Melhor deixar no banco</div><div class="pool-lista">${ruins.map(h => item(h, false)).join('')}</div>` : ''}`;
    alvo.append(card);
  });
}

/* ---------- Meta ---------- */

const FUNCOES = { Carry: 'Carry', Support: 'Suporte', Nuker: 'Nuker', Disabler: 'Controle', Initiator: 'Iniciador',
  Durable: 'Resistente', Escape: 'Fuga', Pusher: 'Push', Jungler: 'Selva' };
const FASES = [['inicio', 'Começo'], ['cedo', 'Cedo'], ['meio', 'Meio'], ['tarde', 'Tarde']];

function retrato(slug, nome) {
  return slug
    ? `<img class="heroi heroi-g" src="${HEROI_IMG}${slug}.png" alt="${esc(nome)}" title="${esc(nome)}" loading="lazy" width="72" height="40">`
    : `<span class="heroi-falta">${esc(nome)}</span>`;
}

function iconeItem(chave) {
  const nome = (meta.itens && meta.itens[chave]) || chave;
  return `<img class="item" src="${ITEM_IMG}${chave}.png" alt="${esc(nome)}" title="${esc(nome)}" loading="lazy" width="44" height="32">`;
}

// quem do grupo já jogou esse herói (todas as posições juntas)
function noGrupo(heroiId) {
  if (!parceiros || !parceiros.pool) return [];
  return Object.entries(parceiros.pool).map(([c, l]) => {
    const xs = l.filter(x => x.heroi === heroiId);
    return { conta: c, jogos: xs.reduce((s, x) => s + x.jogos, 0), vitorias: xs.reduce((s, x) => s + x.vitorias, 0) };
  }).filter(x => x.jogos >= 2).sort((a, b) => b.jogos - a.jogos);
}

function renderizarMeta() {
  const desc = $('meta-desc');
  if (!meta || !meta.fortes || !meta.fortes.length) {
    desc.textContent = 'O meta do patch ainda não foi gerado. O robô "Meta do patch" atualiza todo dia.';
  } else {
    desc.textContent = `${meta.patch ? `Patch ${meta.patch} · ` : ''}partidas de ${meta.faixa} na OpenDota · atualizado em ${dataHora(meta.atualizadoEm)}`;
    $('meta-fortes').innerHTML = '';
    meta.fortes.forEach((x, i) => $('meta-fortes').append(cartaoHeroiMeta(x, i)));

    if (meta.subindo && meta.subindo.length) {
      $('meta-subindo-bloco').hidden = false;
      $('meta-subindo').innerHTML = meta.subindo.map(x => `
        <div class="subindo-item">${retrato(x.slug, x.nome)}<b>${esc(x.nome)}</b>
          <span class="bom">+${x.variacao.toLocaleString('pt-BR')} pts</span><small>${x.winRate.toLocaleString('pt-BR')}%</small></div>`).join('');
    }

    const lista = (titulo, itens, num) => `
      <article class="cartao"><div class="bloco-titulo">${titulo}</div>
        <div class="pool-lista">${itens.map(x => `<div class="pool-item">${retrato(x.slug, x.nome)}
          <div class="pool-txt"><b>${esc(x.nome)}</b><span>${esc((x.funcoes || []).slice(0, 2).map(f => FUNCOES[f] || f).join(' · '))}</span></div>
          <div class="pool-num">${num(x)}</div></div>`).join('')}</div></article>`;
    const wr = x => `<span class="${x.winRate >= 50 ? 'bom' : 'ruim'}">${x.winRate.toLocaleString('pt-BR')}%</span>`;
    $('meta-listas').innerHTML =
      lista('🔥 Mais escolhidos', meta.populares || [], x => `${wr(x)}<br><small>${x.pickRate.toLocaleString('pt-BR')}% dos jogos</small>`) +
      lista('🏆 Os pros estão pegando', meta.pros || [], x => `${x.proPicks} picks<br><small>${x.proWinRate == null ? '' : x.proWinRate.toLocaleString('pt-BR') + '%'}</small>`) +
      lista('🧊 Fuja desses', meta.fracos || [], x => wr(x));
  }
  renderizarReddit();
}

function cartaoHeroiMeta(x, i) {
  const card = document.createElement('article');
  card.className = 'cartao meta-heroi';
  const build = meta.builds && meta.builds[x.id];
  const grupo = noGrupo(x.id);
  card.innerHTML = `
    <div class="meta-topo">
      <span class="meta-pos">${i + 1}</span>
      ${retrato(x.slug, x.nome)}
      <div class="meta-nome"><b>${esc(x.nome)}</b><span>${esc((x.funcoes || []).slice(0, 3).map(f => FUNCOES[f] || f).join(' · '))}</span></div>
      <div class="meta-wr"><b class="${x.winRate >= 50 ? 'bom' : 'ruim'}">${x.winRate.toLocaleString('pt-BR')}%</b>
        <span>${x.pickRate.toLocaleString('pt-BR')}% dos jogos${x.variacao ? ` · <span class="${x.variacao > 0 ? 'bom' : 'ruim'}">${x.variacao > 0 ? '▲' : '▼'} ${Math.abs(x.variacao).toLocaleString('pt-BR')}</span>` : ''}</span></div>
    </div>
    ${build ? `<div class="bloco-titulo">Build mais comprada</div>
      <div class="build">${FASES.filter(([k]) => build[k] && build[k].length).map(([k, nome]) => `
        <div class="fase"><span>${nome}</span><div>${build[k].map(iconeItem).join('')}</div></div>`).join('')}</div>` : ''}
    ${grupo.length ? `<div class="no-grupo">Quem de vocês joga: ${grupo.map(g =>
      `<span class="${g.vitorias / g.jogos > 0.5 ? 'bom' : g.vitorias / g.jogos < 0.5 ? 'ruim' : ''}">${esc(nomeJogador(g.conta))} ${g.vitorias}/${g.jogos}</span>`).join(' · ')}</div>`
      : `<div class="no-grupo">Ninguém do grupo jogou ${periodo === 'tudo' ? 'ainda' : 'nesse período'}. Bora testar?</div>`}`;
  return card;
}

function renderizarReddit() {
  const desc = $('reddit-desc');
  if (!insights || insights.fonte !== 'reddit') {
    desc.textContent = 'Comentários da semana no r/DotA2 sobre o meta e dicas gerais. Aparece aqui quando a chave do Reddit for configurada no robô.';
    return;
  }
  desc.textContent = `Os comentários mais votados da semana no r/DotA2, coletados em ${dataHora(insights.atualizadoEm)}.`;
  $('reddit-meta').innerHTML = '';
  $('meta-topicos').innerHTML = '';

  const herois = parceiros && parceiros.herois;
  const nomeH = id => (herois && herois[id] ? herois[id][1] : (meta && [...(meta.fortes || []), ...(meta.populares || [])].find(x => x.id === id) || {}).nome) || `#${id}`;
  const comentario = i => `
    <div class="insight">
      <p>${esc(i.texto)}</p>
      <div class="insight-meta"><span>${(i.herois || []).map(h => `<b>${esc(nomeH(h))}</b>`).join(' · ')} — ${esc(i.autor)}</span>
        <span>👍 ${i.score}${i.url ? ` · <a href="${esc(i.url)}" target="_blank" rel="noopener">ver</a>` : ''}</span></div>
    </div>`;

  if (insights.meta && insights.meta.length) {
    const div = document.createElement('article');
    div.className = 'cartao';
    div.innerHTML = `<div class="cartao-titulo">O que a galera fala do meta</div>
      ${insights.heroisCitados && insights.heroisCitados.length ? `<div class="cartao-sub">Mais citados: ${insights.heroisCitados.slice(0, 6).map(h => `${esc(nomeH(h.heroi))} (${h.vezes})`).join(', ')}</div>` : ''}
      ${insights.meta.slice(0, 8).map(comentario).join('')}`;
    $('reddit-meta').append(div);
  }

  Object.entries(insights.topicos || {}).forEach(([chave, t]) => {
    const div = document.createElement('article');
    div.className = 'cartao';
    div.innerHTML = `
      <div class="cartao-topo"><div><div class="cartao-titulo">Dicas: ${esc(chave.charAt(0).toUpperCase() + chave.slice(1))}</div>
        <div class="cartao-sub">${esc(t.descricao)}</div></div><div class="cartao-sub">${t.count} menções</div></div>
      ${t.insights.map(comentario).join('')}`;
    $('meta-topicos').append(div);
  });
}

/* ---------- Período (slider de todas as abas) ---------- */

const MINUTO_LANE = 10; // MINUTO_LANE do parceiros.py

// início do período em segundos (hora local; a semana começa no domingo)
function desdePeriodo(chave = periodo) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (chave === 'hoje') return d / 1000;
  if (chave === 'semana') { d.setDate(d.getDate() - d.getDay()); return d / 1000; }
  if (chave === 'mes') { d.setDate(1); return d / 1000; }
  if (chave === '3meses') { d.setMonth(d.getMonth() - 3); return d / 1000; }
  if (chave === 'ano') { d.setMonth(0, 1); return d / 1000; }
  return 0;
}

function montarPeriodo() {
  try {
    const salvo = localStorage.getItem(CHAVE_PERIODO);
    if (PERIODOS.some(([k]) => k === salvo)) periodo = salvo;
  } catch (e) { /* sem localStorage: fica "tudo" */ }
  const slider = $('periodo');
  slider.max = PERIODOS.length - 1;
  slider.value = PERIODOS.findIndex(([k]) => k === periodo);
  $('periodo-marcas').innerHTML = PERIODOS.map(([k, nome], i) =>
    `<button type="button" data-i="${i}">${nome}</button>`).join('');
  const escolher = i => {
    slider.value = i;
    periodo = PERIODOS[i][0];
    try { localStorage.setItem(CHAVE_PERIODO, periodo); } catch (e) { /* ok */ }
    if (ranking) aplicarPeriodo();
    else pintarPeriodo();
  };
  slider.addEventListener('input', () => escolher(+slider.value));
  $('periodo-marcas').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (b) escolher(+b.dataset.i);
  });
  pintarPeriodo();
}

function pintarPeriodo() {
  const i = PERIODOS.findIndex(([k]) => k === periodo);
  $('periodo-nome').textContent = PERIODOS[i][1];
  $('periodo').style.setProperty('--p', `${(100 * i) / (PERIODOS.length - 1)}%`);
  $('periodo').setAttribute('aria-valuetext', PERIODOS[i][1]);
  document.querySelectorAll('#periodo-marcas button').forEach((b, k) => b.classList.toggle('ativo', k === i));
  if (!parceirosBase) return;
  const desde = desdePeriodo();
  const jogos = (parceirosBase.jogos || []).filter(g => g.t >= desde).length;
  const julgadas = new Set(Object.values(ranking.historicos).flat().filter(h => (h.inicio || 0) >= desde).map(h => h.matchId)).size;
  $('periodo-info').textContent = periodo === 'tudo'
    ? `${julgadas} partidas julgadas · ${jogos} partidas guardadas${parceirosBase.desde ? ` desde ${new Date(parceirosBase.desde + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}`
    : `${desde ? `desde ${data(desde * 1000)} · ` : ''}${julgadas} partidas julgadas · ${jogos} guardadas`;
}

function aplicarPeriodo() {
  parceiros = parceirosBase && parceirosBase.jogos ? agregar(parceirosBase, desdePeriodo()) : parceirosBase;
  pintarPeriodo();
  renderizarRanking();
  renderizarDuplas();
  renderizarComposicoes();
  renderizarMeta();
  renderizarElo();
  renderizarTimeFechado();
}

/* Mesma conta do parceiros.py, só que sobre as partidas do período (parceiros.jogos: um registro por lado de partida
 * com amigo; j = [conta, herói, posição, rota física, resultado da lane]). */
const MIN_JOGOS_ROTA = 2;
const MIN_JOGOS_HEROIS = 2;
const TOP = 5;
const MIN_JOGOS_FORMACAO = 2;
const PARTIDAS_POR_GRUPO = 8;

const wrDe = (v, j) => (j ? Math.round((100 * v) / j) : 0);
function resumir(contagens, minimo, rotulo) {
  return [...contagens].filter(([, [j]]) => j >= minimo)
    .map(([k, [j, v]]) => ({ ...rotulo(k), jogos: j, vitorias: v, winRate: wrDe(v, j) }))
    .sort((a, b) => b.winRate - a.winRate || b.jogos - a.jogos);
}
const somar = (mapa, chave, venceu) => {
  const x = mapa.get(chave) || [0, 0];
  x[0]++; x[1] += venceu;
  mapa.set(chave, x);
};

function agregar(base, desde) {
  const nomes = base.nomes || {};
  const pares = new Map();
  const grupos = new Map();
  const pool = new Map();
  const individuais = new Map();
  for (const g of base.jogos) {
    if (g.t < desde) continue;
    const venceu = g.v;
    for (const [c, h, pos] of g.j) if (h) somar(pool.get(c) || pool.set(c, new Map()).get(c), `${h}|${pos}`, venceu);
    if (g.j.length < 2) continue;
    const doLado = [...g.j].sort((a, b) => Number(a[0]) - Number(b[0]));
    doLado.forEach(([c]) => somar(individuais, c, venceu));
    if (doLado.length >= 3) {
      const chave = doLado.map(x => x[0]).join(',');
      const gr = grupos.get(chave) || grupos.set(chave, { jogos: 0, vitorias: 0, formacoes: new Map(), herois: {}, partidas: [] }).get(chave);
      gr.jogos++; gr.vitorias += venceu;
      if (doLado.every(x => x[2])) somar(gr.formacoes, doLado.map(x => x[2]).join(','), venceu);
      doLado.forEach(([c, h]) => { if (h) somar(gr.herois[c] = gr.herois[c] || new Map(), h, venceu); });
      gr.partidas.push({ matchId: g.id, inicio: g.t, venceu: !!venceu,
        herois: Object.fromEntries(doLado.map(([c, h, pos]) => [c, { heroi: h || null, pos: pos || null }])) });
    }
    for (let i = 0; i < doLado.length; i++) for (let k = i + 1; k < doLado.length; k++) {
      const [ca, ha, pa, la, ra] = doLado[i], [cb, hb, pb, lb] = doLado[k];
      const chave = `${ca}|${cb}`;
      const par = pares.get(chave) || pares.set(chave, { a: ca, b: cb, jogos: 0, vitorias: 0, rotas: new Map(), herois: new Map(), partidas: [],
        lanes: { jogos: 0, ganhas: 0, empates: 0, perdidas: 0, rotas: new Map() } }).get(chave);
      par.jogos++; par.vitorias += venceu;
      if (pa && pb) somar(par.rotas, `${pa}|${pb}`, venceu);
      // duo lane: os dois na mesma rota física e a lane teve resultado
      const lane = la && la === lb && ra != null ? ra : null;
      if (lane != null) {
        const l = par.lanes;
        l.jogos++;
        l[lane > 0 ? 'ganhas' : lane < 0 ? 'perdidas' : 'empates']++;
        const r = l.rotas.get(`${pa}|${pb}`) || l.rotas.set(`${pa}|${pb}`, { posA: pa, posB: pb, jogos: 0, ganhas: 0, perdidas: 0 }).get(`${pa}|${pb}`);
        r.jogos++;
        if (lane > 0) r.ganhas++;
        if (lane < 0) r.perdidas++;
      }
      if (ha && hb) {
        somar(par.herois, `${ha}|${hb}`, venceu);
        par.partidas.push({ matchId: g.id, inicio: g.t, venceu: !!venceu, heroiA: ha, heroiB: hb, posA: pa || null, posB: pb || null, lane });
      }
    }
  }

  const doPar = k => k.split('|').map(Number);
  const listaPares = [...pares.values()].map(par => {
    const rotas = resumir(par.rotas, MIN_JOGOS_ROTA, k => { const [posA, posB] = doPar(k); return { posA, posB }; });
    const duplas = resumir(par.herois, MIN_JOGOS_HEROIS, k => { const [heroiA, heroiB] = doPar(k); return { heroiA, heroiB }; });
    return {
      a: par.a, b: par.b, nomeA: nomes[par.a] || par.a, nomeB: nomes[par.b] || par.b,
      jogos: par.jogos, vitorias: par.vitorias, winRate: wrDe(par.vitorias, par.jogos),
      rotas: rotas.slice(0, TOP),
      rotasPiores: [...rotas].reverse().filter(r => r.winRate < 50).slice(0, 3),
      herois: duplas.filter(h => h.winRate > 50).slice(0, TOP),
      heroisPiores: [...duplas].reverse().filter(h => h.winRate < 50).slice(0, 3),
      partidas: par.partidas.sort((x, y) => y.inicio - x.inicio).slice(0, PARTIDAS_POR_GRUPO),
      lanes: { ...par.lanes, rotas: [...par.lanes.rotas.values()].sort((x, y) => y.jogos - x.jogos || y.ganhas - x.ganhas) },
    };
  }).sort((x, y) => y.winRate - x.winRate || y.jogos - x.jogos);

  const composicoes = [...grupos].map(([chave, gr]) => {
    const membros = chave.split(',');
    return {
      membros,
      herois: Object.fromEntries(membros.map(c => [c, resumir(gr.herois[c] || new Map(), 1, k => ({ heroi: Number(k) })).slice(0, 3)])),
      jogos: gr.jogos, vitorias: gr.vitorias, winRate: wrDe(gr.vitorias, gr.jogos),
      formacoes: resumir(gr.formacoes, MIN_JOGOS_FORMACAO, k => {
        const ps = k.split(',').map(Number);
        return { posicoes: Object.fromEntries(membros.map((c, i) => [c, ps[i]])) };
      }).slice(0, 3),
      partidas: gr.partidas.sort((x, y) => y.inicio - x.inicio).slice(0, PARTIDAS_POR_GRUPO),
    };
  }).sort((x, y) => y.winRate - x.winRate || y.jogos - x.jogos);

  return {
    ...base,
    jogadores: Object.fromEntries([...individuais].map(([c, [j, v]]) => [c, { nome: nomes[c] || c, jogos: j, vitorias: v, winRate: wrDe(v, j) }])),
    pares: listaPares,
    composicoes,
    pool: Object.fromEntries([...pool].map(([c, hs]) => [c, [...hs].map(([k, [j, v]]) => {
      const [heroi, pos] = doPar(k);
      return { heroi, pos, jogos: j, vitorias: v };
    }).sort((x, y) => y.jogos - x.jogos || y.vitorias - x.vitorias)])),
  };
}

/* ---------- Corrida de elo ----------
 * A Valve não mostra o MMR: parte da medalha atual (OpenDota) e volta no tempo ±25 a cada ranqueada guardada. */

const MEDALHAS = { 1: 'Arauto', 2: 'Guardião', 3: 'Cruzado', 4: 'Arconte', 5: 'Lenda', 6: 'Ancestral', 7: 'Divino', 8: 'Imortal' };
const RANK_IMG = 'https://www.opendota.com/assets/images/dota2/rank_icons/';
const CORES_ELO = ['#e8b04a', '#4fb3e8', '#e5533d', '#6fd17c', '#c38bf0', '#f08bc3', '#f0a35a', '#5ad1c2', '#b8c25a', '#9aa7ff'];
let ordemElo = 'subiu';

const nomeMedalha = t => (t ? `${MEDALHAS[Math.floor(t / 10)] || '?'}${Math.floor(t / 10) < 8 && t % 10 ? ` ${t % 10}` : ''}` : 'Sem medalha');
// faixas da Valve: 770 de MMR por medalha, 154 por estrela
const mmrDaMedalha = t => {
  const m = Math.floor(t / 10), e = Math.max(1, t % 10);
  return m >= 8 ? 5620 : (m - 1) * 770 + (e - 1) * 154 + 77;
};

function curvaDeElo(conta, tier) {
  const ranqueadas = (parceirosBase.jogos || []).filter(g => g.r && g.j.some(x => x[0] === conta)).sort((a, b) => a.t - b.t);
  let mmr = mmrDaMedalha(tier);
  const pontos = [{ t: Date.now() / 1000, mmr }];
  for (let i = ranqueadas.length - 1; i >= 0; i--) {
    pontos.push({ t: ranqueadas[i].t, mmr, v: ranqueadas[i].v, id: ranqueadas[i].id });
    mmr -= ranqueadas[i].v ? MMR_POR_PARTIDA : -MMR_POR_PARTIDA;
  }
  pontos.push({ t: ranqueadas.length ? ranqueadas[0].t - 1 : 0, mmr });
  return pontos.reverse(); // do mais antigo pro atual; cada ponto é o MMR logo depois daquela partida
}

function renderizarElo() {
  const alvo = $('elo-corrida');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    alvo.querySelectorAll('.palito').forEach(p => { p.style.left = `${p.dataset.para}%`; });
    alvo.querySelectorAll('.rastro').forEach(r => r.classList.add('rastro-vai'));
  }));
  const perfis = ranking.perfis || {};
  const medalhas = (parceirosBase && parceirosBase.medalhas) || {};
  const nomes = Object.fromEntries(ranking.ranking.map(j => [j.accountId, j.nome]));
  const desde = desdePeriodo();
  const agora = Date.now() / 1000;
  const lista = Object.keys(ranking.historicos).map((conta, i) => {
    const p = perfis[conta] || {};
    const tier = p.rankTier || medalhas[conta] || null;
    if (!tier || !parceirosBase) return null;
    const curva = curvaDeElo(conta, tier);
    const antes = [...curva].reverse().find(x => x.t < desde) || curva[0];
    const noPeriodo = curva.filter(x => x.t >= desde && x.id);
    const v = noPeriodo.filter(x => x.v).length;
    return { conta, nome: nomes[conta] || conta, avatar: p.avatar, tier, cor: CORES_ELO[i % CORES_ELO.length], curva,
      inicio: antes.mmr, atual: curva[curva.length - 1].mmr, v, d: noPeriodo.length - v };
  }).filter(Boolean);

  if (!lista.length) {
    alvo.innerHTML = '<p class="carregando">Sem medalha de ninguém ainda: aparece quando o robô do ranking rodar de novo.</p>';
    return;
  }
  lista.forEach(x => { x.delta = x.atual - x.inicio; });
  lista.sort(ordemElo === 'subiu' ? (a, b) => b.delta - a.delta || b.atual - a.atual : (a, b) => b.atual - a.atual);

  // régua de medalhas: x = MMR estimado; cada um é um palito com a cara em cima, saindo de onde estava no
  // começo do período e correndo até onde está agora
  const MEDALHA = 770;
  const todos = lista.flatMap(x => [x.inicio, x.atual]);
  const xMin = Math.max(0, Math.floor(Math.min(...todos) / MEDALHA) * MEDALHA);
  const xMax = Math.min(8 * MEDALHA, Math.ceil((Math.max(...todos) + 1) / MEDALHA) * MEDALHA);
  const pct = m => (100 * (Math.min(Math.max(m, xMin), xMax) - xMin)) / (xMax - xMin);
  const faixas = [];
  for (let m = xMin; m < xMax; m += MEDALHA) faixas.push(Math.floor(m / MEDALHA) + 1);

  // quem está perto sobe um andar para as caras não se taparem
  const largura = Math.max(560, (alvo.clientWidth || 900) - 68); // .regua tem min-width 560 e 34px de margem de cada lado
  const folga = (100 * 50) / largura;
  const andares = [];
  [...lista].sort((a, b) => a.atual - b.atual).forEach(x => {
    let k = andares.findIndex(ult => pct(x.atual) - ult >= folga);
    if (k < 0) { andares.push(0); k = andares.length - 1; }
    andares[k] = pct(x.atual);
    x.andar = k;
  });
  const altura = 96 + andares.length * 58;

  const inicial = x => esc((x.nome.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase());
  const avatar = (x, tam) => {
    const letra = `<span class="elo-avatar elo-inicial" style="--cor:${x.cor};width:${tam}px;height:${tam}px">${inicial(x)}</span>`;
    // foto da Steam; se não carregar, fica a inicial
    return x.avatar
      ? `<img class="elo-avatar" src="${esc(x.avatar)}" alt="" width="${tam}" height="${tam}" loading="lazy" style="--cor:${x.cor}" onerror="this.outerHTML=this.nextElementSibling.innerHTML"><template>${letra}</template>`
      : letra;
  };

  alvo.innerHTML = `
    <div class="regua-wrap">
      <div class="regua" style="height:${altura}px">
        ${faixas.map(m => `<div class="faixa faixa-${m}" style="left:${pct((m - 1) * MEDALHA)}%;width:${(100 * MEDALHA) / (xMax - xMin)}%">
          ${[1, 2, 3, 4].map(e => `<i style="left:${20 * e}%"></i>`).join('')}
          <div class="faixa-nome"><img src="${RANK_IMG}rank_icon_${m}.png" alt="" width="34" height="34" loading="lazy" onerror="this.remove()"><span>${MEDALHAS[m]}</span></div>
        </div>`).join('')}
        ${lista.map(x => `<div class="palito" data-de="${pct(x.inicio)}" data-para="${pct(x.atual)}"
            style="left:${pct(x.inicio)}%;--cor:${x.cor};--alto:${40 + x.andar * 58}px"
            title="${esc(x.nome)} · ${nomeMedalha(x.tier)} · ≈ ${x.atual.toLocaleString('pt-BR')} MMR (${x.delta > 0 ? '+' : ''}${x.delta} no período)">
          <div class="palito-cara">${avatar(x, 40)}<span class="palito-nome">${esc(x.nome)}</span></div>
          <div class="palito-haste"></div>
        </div>`).join('')}
        ${lista.filter(x => x.delta).map(x => `<div class="rastro ${x.delta > 0 ? 'sobe' : 'desce'}"
          style="left:${Math.min(pct(x.inicio), pct(x.atual))}%;width:${Math.abs(pct(x.atual) - pct(x.inicio))}%;--cor:${x.cor};bottom:${30 + x.andar * 4}px"></div>`).join('')}
      </div>
    </div>
    <ol class="elo-lista">${lista.map((x, i) => `
      <li class="elo-item${i === 0 ? ' elo-lider' : ''}" style="--cor:${x.cor}">
        <span class="elo-pos">${i === 0 ? '👑' : i + 1}</span>
        ${avatar(x, 44)}
        <div class="elo-nome"><b>${esc(x.nome)}</b>
          <span class="elo-medalha"><img src="${RANK_IMG}rank_icon_${Math.floor(x.tier / 10)}.png" alt="" width="22" height="22" loading="lazy" onerror="this.remove()">${nomeMedalha(x.tier)}</span><span class="elo-mmr">≈ ${x.atual.toLocaleString('pt-BR')} MMR</span></div>
        <div class="elo-delta ${x.delta > 0 ? 'bom' : x.delta < 0 ? 'ruim' : ''}"><b>${x.delta > 0 ? '+' : ''}${x.delta}</b>
          <span>${x.v + x.d ? `${x.v}V · ${x.d}D` : 'sem ranqueada'}</span></div>
      </li>`).join('')}</ol>
    <p class="time-nota">Cada palito sai de onde a pessoa estava no começo do período e corre até onde está agora. MMR estimado: começa na medalha atual de cada um no OpenDota e volta no tempo ±${MMR_POR_PARTIDA} por ranqueada que o robô guardou. Partidas que o robô ainda não baixou não entram, e a Valve não mostra o MMR exato.</p>`;
}

/* ---------- Worker do coach (feedback e botão de atualizar) ---------- */

let coachPromessa = null;
let estadoAtt = null;
const urlDoCoach = () => (coachPromessa = coachPromessa || fetch('../config.json', { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : {})).then(j => (/^https:\/\//.test(j.coach || '') ? j.coach.replace(/\/$/, '') : ''))
  .catch(() => ''));

/* ---------- Time fechado: as partidas com os 5 do grupo do mesmo lado ----------
 * Cada partida ganha marcadores (o que aconteceu nela: virada, começo ruim, draft sem iniciação, o que o inimigo
 * tinha...). Nada de marcador por pessoa: a aba é pra melhorar o time, não pra apontar dedo. Os marcadores viram o resumo e o filtro: tocar num mostra só os jogos com ele.
 * Dados: parceiros.timeFechado (parceiros.py). */

const VIRADA = 5000;          // vantagem de ouro que conta como "jogo na mão"
const TIPOS_MARCADOR = { jogo: 'O jogo', draft: 'Nosso draft', inimigo: 'O time deles' };
let filtroFechado = null;

function marcadoresDe(g) {
  const ms = [];
  const add = (id, tipo, icone, nome, desc) => ms.push({ id, tipo, icone, nome, desc, resultado: ['virada', 'jogaram-fora', 'atropelo', 'atropelados'].includes(id) });
  const o10 = g.ouro && g.ouro['10'];
  const saldo = g.lanes && g.lanes.length ? g.lanes.filter(x => x > 0).length - g.lanes.filter(x => x < 0).length : null;
  if (g.v && g.menor != null && g.menor <= -VIRADA) add('virada', 'jogo', '🔄', 'Virada', `Chegaram a estar ${(-g.menor / 1000).toFixed(1).replace('.', ',')}k atrás e ganharam`);
  if (!g.v && g.maior != null && g.maior >= VIRADA) add('jogaram-fora', 'jogo', '💸', 'Jogaram fora', `Chegaram a estar ${(g.maior / 1000).toFixed(1).replace('.', ',')}k na frente e perderam`);
  if (g.v && g.menor != null && g.menor > -2000 && g.maior >= 10000) add('atropelo', 'jogo', '🚀', 'Atropelaram', 'Nunca ficaram 2k atrás e abriram 10k+');
  if (!g.v && g.maior != null && g.maior < 2000 && g.menor <= -10000) add('atropelados', 'jogo', '🧱', 'Atropelados', 'Nunca abriram 2k e tomaram 10k+');
  if (o10 != null && o10 <= -1500) add('comeco-ruim', 'jogo', '🐢', 'Começo ruim', 'Mais de 1,5k de ouro atrás aos 10 min');
  if (o10 != null && o10 >= 1500) add('comeco-forte', 'jogo', '🔥', 'Começo forte', 'Mais de 1,5k de ouro na frente aos 10 min');
  if (saldo != null && saldo <= -2) add('lanes-perdidas', 'jogo', '🛣️', 'Lanes perdidas', 'Perderam 2 lanes a mais do que ganharam');
  if (saldo != null && saldo >= 2) add('lanes-ganhas', 'jogo', '🛣️', 'Lanes ganhas', 'Ganharam 2 lanes a mais do que perderam');
  if (g.dur != null && g.dur >= 2700) add('longo', 'jogo', '⏳', 'Jogo longo', 'Passou de 45 min');
  if (g.dur != null && g.dur < 1680) add('curto', 'jogo', '⏱️', 'Jogo curto', 'Acabou antes dos 28 min');
  if (g.roshans && g.roshans[1] > 0 && !g.roshans[0]) add('rosh-deles', 'jogo', '🐉', 'Roshan deles', 'O outro time pegou Roshan e vocês nenhum');
  g.sinNos.alertas.forEach(a => add(`alerta:${a}`, 'draft', '⚠️', a.replace(/^\S+\s/, '').split(':')[0], a));
  g.sinNos.lista.filter(s => s.nivel >= 2 || (s.id === 'babysit' && s.nivel)).forEach(s => add(`nos:${s.id}`, 'draft', s.icone, s.nome, s.desc));
  g.sinEles.lista.filter(s => s.nivel >= 2 || (['push', 'bkb', 'invis'].includes(s.id) && s.nivel)).forEach(s =>
    add(`eles:${s.id}`, 'inimigo', s.icone, `Inimigo: ${s.nome}`, `O time deles tinha ${s.nome.toLowerCase()} (${s.desc.toLowerCase()})`));
  return ms;
}

/* Gráficos do time fechado: mapa dos marcadores (frequência × win rate), grade "contra a comp deles, o que
 * funciona". Tocar numa bolha filtra igual aos marcadores (data-marcador). */
const CORES_TIPO = { jogo: '#e8b04a', draft: '#4f9dff', inimigo: '#e5533d' };
const FREQUENTE = 25; // % dos jogos a partir do qual um marcador é "frequente"
const pctDe = (v, n) => (n ? Math.round((100 * v) / n) : 0);

function graficoMarcadores(marcadores, total, wrGeral) {
  const xs = marcadores.filter(m => !m.resultado && m.tipo !== 'inimigo' && m.n >= 2).map(m => ({ ...m, f: (100 * m.n) / total, wr: pctDe(m.v, m.n) }));
  if (xs.length < 3) return '';
  const W = 760, H = 420, M = { e: 46, d: 20, c: 40, b: 42 };
  const maxF = Math.min(100, Math.ceil((Math.max(...xs.map(m => m.f)) + 6) / 10) * 10);
  const corteX = Math.min(FREQUENTE, maxF / 2);
  const px = f => M.e + (f / maxF) * (W - M.e - M.d);
  const py = wr => M.c + (1 - wr / 100) * (H - M.c - M.b);
  const raio = n => 8 + Math.sqrt(n) * 3.4;
  // bolhas no mesmo lugar se afastam um pouco
  const ocupado = new Map();
  xs.sort((a, b) => b.n - a.n).forEach(m => {
    const k = `${Math.round(px(m.f) / 14)}|${Math.round(py(m.wr) / 14)}`;
    const i = ocupado.get(k) || 0;
    ocupado.set(k, i + 1);
    m.cx = px(m.f) + (i ? Math.cos(i * 2.1) * 16 : 0);
    m.cy = py(m.wr) + (i ? Math.sin(i * 2.1) * 16 : 0);
  });
  // nomes só nas bolhas que mais dizem algo (longe da média e com mais jogos), sem encavalar um no outro
  const interesse = m => Math.abs(m.wr - wrGeral) * Math.sqrt(m.n);
  const caixas = [];
  [...xs].sort((a, b) => interesse(b) - interesse(a)).forEach(m => {
    if (caixas.length >= 12 && filtroFechado !== m.id) return;
    const larg = m.nome.length * 6.6 + 4, alt = 15;
    const dir = m.cx > W * 0.72 ? -1 : 1;
    const x1 = dir > 0 ? m.cx + raio(m.n) + 4 : m.cx - raio(m.n) - 4 - larg;
    const caixa = { x1, x2: x1 + larg, y1: m.cy - alt / 2, y2: m.cy + alt / 2 };
    const bate = caixas.some(c => caixa.x1 < c.x2 && caixa.x2 > c.x1 && caixa.y1 < c.y2 && caixa.y2 > c.y1)
      || xs.some(o => o !== m && o.cx + raio(o.n) > caixa.x1 && o.cx - raio(o.n) < caixa.x2 && o.cy + raio(o.n) > caixa.y1 && o.cy - raio(o.n) < caixa.y2);
    if (!bate || filtroFechado === m.id) { caixas.push(caixa); m.rotulo = dir; }
  });
  const quad = (x1, y1, x2, y2, cls) => `<rect class="${cls}" x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"/>`;
  const xc = px(corteX), yc = py(wrGeral);
  const filtro = filtroFechado;
  const bolha = m => {
    const ladoDir = m.rotulo === -1;
    const ativo = filtro === m.id;
    return `<g class="tf-bolha${ativo ? ' ativa' : ''}${filtro && !ativo ? ' apagada' : ''}" data-marcador="${esc(m.id)}" tabindex="0" role="button">
      <title>${esc(m.nome)}: ${m.v}V ${m.n - m.v}D (${m.wr}%) · aparece em ${Math.round(m.f)}% dos jogos. ${esc(textoExplicado(m))}</title>
      <circle cx="${m.cx.toFixed(1)}" cy="${m.cy.toFixed(1)}" r="${raio(m.n).toFixed(1)}" style="fill:${CORES_TIPO[m.tipo]}"/>
      <text class="tf-bolha-ic" x="${m.cx.toFixed(1)}" y="${(m.cy + 5).toFixed(1)}" text-anchor="middle">${m.icone}</text>
      ${m.rotulo ? `<text class="tf-bolha-nome" x="${(m.cx + (ladoDir ? -1 : 1) * (raio(m.n) + 5)).toFixed(1)}" y="${(m.cy + 4).toFixed(1)}" text-anchor="${ladoDir ? 'end' : 'start'}">${esc(m.nome)}</text>` : ''}
    </g>`;
  };
  const ticksY = [0, 25, 50, 75, 100];
  const ticksX = []; for (let f = 0; f <= maxF; f += maxF > 50 ? 20 : 10) ticksX.push(f);
  // leitura: o que corrigir e o que usar mais (mínimo de jogos pra não ser sorte)
  const vicios = xs.filter(m => m.f >= corteX && m.wr < wrGeral - 10 && m.n >= 3).sort((a, b) => a.wr - b.wr).slice(0, 3);
  const armas = xs.filter(m => m.f < corteX && m.wr > wrGeral + 10 && m.n >= 2).sort((a, b) => b.wr - a.wr).slice(0, 3);
  const cara = xs.filter(m => m.f >= corteX && m.wr > wrGeral + 10 && m.n >= 3).sort((a, b) => b.wr - a.wr).slice(0, 2);
  const botao = m => `<button type="button" data-marcador="${esc(m.id)}">${m.icone} ${esc(m.nome)} <small>${m.v}/${m.n}</small></button>`;
  return `<article class="cartao tf-grafico">
    <div class="tf-graf-cab"><h3>Mapa dos marcadores</h3>
      <div class="tf-legenda">${Object.entries(TIPOS_MARCADOR).filter(([t]) => t !== 'inimigo').map(([t, n]) => `<span><i style="background:${CORES_TIPO[t]}"></i>${n}</span>`).join('')}</div></div>
    <div class="tf-svg-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cada marcador: quantas vezes aparece e quanto vocês ganham quando ele aparece">
      ${quad(xc, M.c, W - M.d, yc, 'q-cara')}${quad(xc, yc, W - M.d, H - M.b, 'q-vicio')}${quad(M.e, M.c, xc, yc, 'q-arma')}
      ${ticksY.map(t => `<line class="tf-eixo-l" x1="${M.e}" x2="${W - M.d}" y1="${py(t)}" y2="${py(t)}"/><text class="tf-eixo" x="${M.e - 8}" y="${py(t) + 4}" text-anchor="end">${t}%</text>`).join('')}
      ${ticksX.map(t => `<text class="tf-eixo" x="${px(t)}" y="${H - M.b + 18}" text-anchor="middle">${t}%</text>`).join('')}
      <text class="tf-eixo-t" x="${(M.e + W - M.d) / 2}" y="${H - 6}" text-anchor="middle">em quantos jogos aparece →</text>
      <text class="tf-eixo-t" x="14" y="${(M.c + H - M.b) / 2}" text-anchor="middle" transform="rotate(-90 14 ${(M.c + H - M.b) / 2})">win rate quando aparece →</text>
      <line class="tf-media" x1="${M.e}" x2="${W - M.d}" y1="${yc}" y2="${yc}"/>
      <text class="tf-media-t" x="${W - M.d - 4}" y="${yc - 6}" text-anchor="end">média de vocês: ${wrGeral}%</text>
      <line class="tf-corte" x1="${xc}" x2="${xc}" y1="${M.c}" y2="${H - M.b}"/>
      <text class="tf-quad-t bom" x="${W - M.d - 8}" y="${M.c - 10}" text-anchor="end">A cara do time</text>
      <text class="tf-quad-t ruim" x="${W - M.d - 8}" y="${H - M.b - 10}" text-anchor="end">Vício: corrigir</text>
      <text class="tf-quad-t bom" x="${M.e + 8}" y="${M.c - 10}">Arma pouco usada</text>
      <text class="tf-quad-t" x="${M.e + 8}" y="${H - M.b - 10}">Raro e perde</text>
      ${xs.map(bolha).join('')}
    </svg></div>
    ${filtro && xs.some(m => m.id === filtro) ? (() => {
      const m = xs.find(x => x.id === filtro);
      return `<div class="tf-selecionado"><b>${m.icone} ${esc(m.nome)}</b> <span>${m.v}V ${m.n - m.v}D (${m.wr}%) · aparece em ${Math.round(m.f)}% dos jogos</span>
        <p>${esc(textoExplicado(m))}</p><button type="button" data-marcador="">✕ limpar</button></div>`;
    })() : '<p class="tf-dica">Toque numa bolha pra ver o que ela significa e os jogos dela.</p>'}
    <div class="tf-leituras">
      ${vicios.length ? `<p class="ruim"><b>Corrigir:</b> ${vicios.map(botao).join('')}</p>` : ''}
      ${armas.length ? `<p class="bom"><b>Usar mais:</b> ${armas.map(botao).join('')}</p>` : ''}
      ${cara.length ? `<p class="bom"><b>Já é a cara de vocês:</b> ${cara.map(botao).join('')}</p>` : ''}
    </div>
  </article>`;
}

// cabecinha do herói como no minimapa do Dota
function iconeHeroi(id, classe = 'ico') {
  const h = parceiros && parceiros.herois && parceiros.herois[id];
  if (!h || !h[0]) return `<span class="${classe} ico-falta" title="${esc(h ? h[1] : '?')}">${esc((h ? h[1] : '?').slice(0, 2))}</span>`;
  const sigla = esc(h[1].split(/[\s-]+/).map(x => x[0]).join('').slice(0, 2));
  // sem a imagem, vira uma bolinha com a sigla (o nome fica no title)
  return `<img class="${classe}" src="${HEROI_IMG}icons/${h[0]}.png" alt="${esc(h[1])}" title="${esc(h[1])}" data-sigla="${sigla}" loading="lazy" width="24" height="24"
    onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: this.className + ' ico-falta', textContent: this.dataset.sigla, title: this.alt }))">`;
}

let casaFechado = null; // "linha|coluna" da grade (coluna "*" = a linha toda)

function jogosDaCasa(todos, casa) {
  if (!casa) return null;
  const [l, c] = casa.split('|');
  const ativo = (sin, id) => ((sin.lista.find(x => x.id === id) || {}).nivel || 0) > 0;
  return todos.filter(g => (l === '*' || ativo(g.sinEles, l)) && (c === '*' || ativo(g.sinNos, c)));
}

function painelDaCasa(todos, casa, info) {
  const xs = jogosDaCasa(todos, casa);
  if (!xs) return `<aside class="tf-casa-painel vazio"><p>Toque numa casa da grade pra ver os jogos dela: os heróis de vocês contra os deles.</p></aside>`;
  const [l, c] = casa.split('|');
  const v = xs.filter(g => g.v).length;
  const jogo = g => `<li class="${g.v ? 'v' : 'd'}">
      <span class="tf-casa-res">${g.v ? 'V' : 'D'}</span>
      <span class="tf-icos">${[...g.nos].sort((a, b) => (a[2] || 9) - (b[2] || 9)).map(x => (x[1] ? iconeHeroi(x[1]) : '')).join('')}</span>
      <span class="tf-casa-vs">×</span>
      <span class="tf-icos eles">${g.eles.map(h => (h ? iconeHeroi(h) : '')).join('')}</span>
      <a href="../#${g.id}" title="Julgar essa partida · ${data(g.t * 1000)}">${data(g.t * 1000)}</a>
    </li>`;
  return `<aside class="tf-casa-painel">
    <div class="tf-casa-cab">
      <b>${l === '*' ? `${info[c].icone} ${esc(info[c].nome)} de vocês` : `${info[l].icone} ${esc(info[l].nome)} deles${c === '*' ? '' : ` × ${info[c].icone} ${esc(info[c].nome)} de vocês`}`}</b>
      <button type="button" data-casa="" aria-label="Fechar">✕</button>
    </div>
    <p class="tf-casa-placar"><span class="${v * 2 > xs.length ? 'bom' : v * 2 < xs.length ? 'ruim' : ''}">${v}V · ${xs.length - v}D</span> em ${xs.length} jogo${xs.length === 1 ? '' : 's'} · vocês à esquerda, eles à direita</p>
    <ul class="tf-casa-jogos">${[...xs].reverse().map(jogo).join('')}</ul>
  </aside>`;
}

function gradeRespostas(todos) {
  const ativo = (sin, id) => ((sin.lista.find(s => s.id === id) || {}).nivel || 0) > 0;
  const info = {};
  todos.forEach(g => [...g.sinNos.lista, ...g.sinEles.lista].forEach(s => { info[s.id] = s; }));
  const contar = (lado, id) => todos.filter(g => ativo(g[lado], id)).length;
  const eixo = lado => [...new Set(todos.flatMap(g => g[lado].lista.filter(s => s.nivel).map(s => s.id)))]
    // o que aparece em quase todo jogo (ex.: uma linha de frente) não separa nada: fica de fora
    .map(id => ({ id, n: contar(lado, id) })).filter(x => x.n >= 3 && x.n <= todos.length - 3).sort((a, b) => b.n - a.n).slice(0, 8);
  const linhas = eixo('sinEles'), colunas = eixo('sinNos');
  if (linhas.length < 2 || colunas.length < 2) return '';
  if (casaFechado) {
    const [l, c] = casaFechado.split('|');
    if ((l !== '*' && !linhas.some(x => x.id === l)) || (c !== '*' && !colunas.some(x => x.id === c))) casaFechado = null;
  }
  const cor = (wr, n) => {
    const forca = Math.min(1, Math.abs(wr - 50) / 40) * Math.min(1, n / 3);
    return `background:color-mix(in srgb, ${wr >= 50 ? 'var(--good)' : 'var(--bad)'} ${Math.round(10 + forca * 60)}%, var(--surface))`;
  };
  const corpo = linhas.map(l => {
    const daLinha = todos.filter(g => ativo(g.sinEles, l.id));
    const vL = daLinha.filter(g => g.v).length;
    const casas = colunas.map(c => {
      const xs = daLinha.filter(g => ativo(g.sinNos, c.id));
      return { c, n: xs.length, v: xs.filter(g => g.v).length };
    });
    const melhor = casas.filter(x => x.n >= 2 && pctDe(x.v, x.n) > pctDe(vL, daLinha.length)).sort((a, b) => pctDe(b.v, b.n) - pctDe(a.v, a.n) || b.n - a.n)[0];
    return `<tr><th scope="row" data-casa="${l.id}|*" tabindex="0" role="button" class="${casaFechado === `${l.id}|*` ? 'tf-casa-ativa' : ''}" title="${esc(textoExplicado({ id: `eles:${l.id}`, desc: '' }))} Toque pra ver todos os jogos contra essa comp."><span>${info[l.id].icone} ${esc(info[l.id].nome)}</span><small>${vL}/${daLinha.length} · ${pctDe(vL, daLinha.length)}%</small></th>
      ${casas.map(x => (x.n ? `<td style="${cor(pctDe(x.v, x.n), x.n)}" data-casa="${l.id}|${x.c.id}" tabindex="0" role="button" class="${x === melhor ? 'tf-melhor' : ''}${x.n < 2 ? ' tf-pouco' : ''}${casaFechado === `${l.id}|${x.c.id}` ? ' tf-casa-ativa' : ''}" title="Contra ${esc(info[l.id].nome)} deles, com ${esc(info[x.c.id].nome)}: ${x.v} vitórias em ${x.n}">
        ${x === melhor ? '<i>★</i>' : ''}<b>${pctDe(x.v, x.n)}%</b><small>${x.v}/${x.n}</small></td>` : '<td class="tf-vazio">—</td>')).join('')}</tr>`;
  }).join('');
  return `<article class="cartao tf-grafico">
    <div class="tf-graf-cab"><h3>Contra cada comp deles, o que funciona</h3></div>
    <p class="tf-graf-sub">Linha: o que o time deles tinha. Coluna: o que vocês tinham. ★ = a melhor resposta (2+ jogos, acima do geral daquela linha). Toque numa casa pra ver os jogos; o que cada nome significa está em “O que significa cada marcador”.</p>
    <div class="tf-grade-e-jogos">
    <div class="tf-grade-wrap"><table class="tf-grade">
      <thead><tr><th class="tf-canto"><span>Deles ↓ · Vocês →</span></th>${colunas.map(c => `<th scope="col" data-casa="*|${c.id}" tabindex="0" role="button" class="${casaFechado === `*|${c.id}` ? 'tf-casa-ativa' : ''}" title="${esc(textoExplicado({ id: `nos:${c.id}`, desc: '' }))} Toque pra ver todos os jogos em que vocês tinham isso."><span class="tf-col-ic">${info[c.id].icone}</span><span>${esc(info[c.id].nome)}</span></th>`).join('')}</tr></thead>
      <tbody>${corpo}</tbody>
    </table></div>
    ${painelDaCasa(todos, casaFechado, info)}
    </div>
  </article>`;
}

/* O que significa cada marcador, em português claro, com exemplos de heróis (herois-tracos.js). */
const ALERTAS_EXPLICADOS = [
  [/linha de frente/i, ['frente'], 'O time não tinha ninguém de linha de frente: herói que aguenta pancada e entra primeiro na luta.'],
  [/controle/i, ['controle'], 'Ninguém com stun, hex ou silêncio confiável pra segurar um alvo enquanto o time mata.'],
  [/abrir a luta/i, ['iniciacao'], 'Ninguém que abre a luta de longe (blink, salto, carga). Aí o time depende de pegar alguém sozinho ou de esperar o outro time errar.'],
  [/sem babá/i, ['baba'], 'O time tinha um carry que só fica forte no fim do jogo, mas nenhum suporte de proteção (cura, salvar, escudo) pra cuidar dele até lá.'],
  [/dois carries/i, ['late'], 'Dois heróis que precisam de muito farm pra funcionar: um acaba atrasando o outro.', 'Carries de late'],
  [/dano físico/i, ['dps', 'push'], 'Pouco herói que bate forte no auto-ataque ou derruba torre rápido: o jogo trava na hora de fechar.'],
];
let nomesPorSlug = null;

function exemplosDoTraco(ids, quantos = 4) {
  if (!nomesPorSlug) {
    nomesPorSlug = {};
    Object.values((parceirosBase && parceirosBase.herois) || {}).forEach(([slug, nome]) => { if (slug) nomesPorSlug[slug] = nome; });
  }
  const nomes = [];
  ids.forEach(id => {
    const t = TRACOS[id];
    if (!t) return;
    t.herois.split(' ').filter(sl => nomesPorSlug[sl]).slice(0, Math.ceil(quantos / ids.length)).forEach(sl => nomes.push(nomesPorSlug[sl]));
  });
  return nomes;
}

// marcador (ou id de sinergia "nos:x"/"eles:x") -> { texto, exemplos }
function explicarMarcador(m) {
  const [lado, chave] = m.id.includes(':') ? [m.id.slice(0, m.id.indexOf(':')), m.id.slice(m.id.indexOf(':') + 1)] : [null, m.id];
  if (lado === 'alerta') {
    const a = ALERTAS_EXPLICADOS.find(([re]) => re.test(chave));
    return a ? { texto: a[2], exemplos: exemplosDoTraco(a[1]), rotulo: a[3] || 'Quem resolve' } : { texto: m.desc, exemplos: [] };
  }
  if (lado === 'nos' || lado === 'eles') {
    const deles = lado === 'eles';
    if (chave === 'babysit') {
      return { texto: `${deles ? 'O time deles tinha' : 'O time tinha'} um carry que fica forte no fim do jogo junto com um suporte de proteção (cura, salvar, escudo) pra segurar ele vivo até lá.`,
        exemplos: exemplosDoTraco(['late', 'baba']) };
    }
    const sin = HeroisTracos.SINERGIAS.find(x => x.id === chave);
    const t = TRACOS[chave];
    if (!t) return { texto: m.desc, exemplos: [] };
    const min = sin ? sin.niveis[0] : 2;
    return {
      texto: `${deles ? 'O time deles tinha' : 'O time tinha'} ${min === 1 ? 'pelo menos 1 herói' : `${min} ou mais heróis`} de ${t.nome.toLowerCase()}: ${t.desc.charAt(0).toLowerCase() + t.desc.slice(1)}.`,
      exemplos: exemplosDoTraco([chave]),
    };
  }
  return { texto: m.desc ? `${m.desc}.` : '', exemplos: [] };
}

function textoExplicado(m) {
  const e = explicarMarcador(m);
  return `${e.texto}${e.exemplos.length ? ` ${e.rotulo || 'Ex.'}: ${e.exemplos.join(', ')}.` : ''}`;
}

function glossarioFechado(marcadores, idsSinergia) {
  const jogo = marcadores.filter(m => m.tipo === 'jogo').sort((a, b) => a.nome.localeCompare(b.nome));
  const alertas = marcadores.filter(m => m.id.startsWith('alerta:'));
  const sinergias = [...new Set(idsSinergia)].map(id => {
    const deUmLado = marcadores.find(m => m.id === `nos:${id}` || m.id === `eles:${id}`);
    const t = id === 'babysit' ? { icone: '🍼🛡️' } : TRACOS[id] || {};
    const nome = (HeroisTracos.SINERGIAS.find(x => x.id === id) || {}).nome || (id === 'babysit' ? 'Babysit' : id);
    return { id: `nos:${id}`, icone: deUmLado ? deUmLado.icone : t.icone, nome, desc: '' };
  }).sort((a, b) => a.nome.localeCompare(b.nome));
  const item = m => `<li><span class="tf-gl-ic">${m.icone}</span><div><b>${esc(m.nome.replace(/^Inimigo: /, ''))}</b><p>${esc(textoExplicado(m))}</p></div></li>`;
  const bloco = (titulo, xs, nota) => (xs.length ? `<div class="tf-gl-bloco"><h4>${titulo}</h4>${nota ? `<p class="tf-gl-nota">${nota}</p>` : ''}<ul>${xs.map(item).join('')}</ul></div>` : '');
  return `<details class="cartao tf-glossario">
    <summary>ⓘ O que significa cada marcador</summary>
    ${bloco('Como foi o jogo', jogo)}
    ${bloco('Sinergias de time', sinergias, 'Contam os heróis de cada time. Quando é do outro time, aparece como “Inimigo: …”.')}
    ${bloco('Alertas do draft', alertas.map(m => ({ ...m, nome: m.nome })), 'Coisas que faltaram no draft de vocês.')}
  </details>`;
}

function renderizarTimeFechado() {
  const alvo = $('fechado-conteudo');
  const desde = desdePeriodo();
  const todos = ((parceirosBase && parceirosBase.timeFechado) || []).filter(g => g.t >= desde).map(g => {
    const x = { ...g, sinNos: sinergiasDoTime(g.nos.map(n => n[1]).filter(Boolean)), sinEles: sinergiasDoTime(g.eles.filter(Boolean)) };
    x.marcadores = marcadoresDe(x);
    return x;
  });
  if (!todos.length) {
    alvo.innerHTML = `<p class="carregando">${parceirosBase && parceirosBase.timeFechado ? 'Nenhuma partida com os 5 juntos nesse período.' : 'O raio-x aparece depois da próxima atualização do ranking.'}</p>`;
    return;
  }
  const pct = (v, n) => (n ? Math.round((100 * v) / n) : 0);
  const mil = x => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${(Math.abs(x) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`);

  // cada marcador: em quantos jogos apareceu e quantos ganharam
  const porMarcador = new Map();
  todos.forEach(g => g.marcadores.forEach(m => {
    const x = porMarcador.get(m.id) || porMarcador.set(m.id, { ...m, n: 0, v: 0 }).get(m.id);
    x.n++; x.v += g.v;
  }));
  const marcadores = [...porMarcador.values()];
  if (filtroFechado && !porMarcador.has(filtroFechado)) filtroFechado = null;
  const jogos = filtroFechado ? todos.filter(g => g.marcadores.some(m => m.id === filtroFechado)) : todos;
  const vit = todos.filter(g => g.v).length;
  const wrGeral = pct(vit, todos.length);

  const chip = m => `<button type="button" class="tf-marcador tm-${m.tipo}${filtroFechado === m.id ? ' ativo' : ''}" data-marcador="${esc(m.id)}" title="${esc(textoExplicado(m))}">
      <span>${m.icone}</span>${esc(m.nome)}${m.n != null ? `<small class="${pct(m.v, m.n) > 55 ? 'bom' : pct(m.v, m.n) < 45 ? 'ruim' : ''}">${m.v}V ${m.n - m.v}D</small>` : ''}</button>`;
  const grupos = Object.entries(TIPOS_MARCADOR).map(([tipo, nome]) => {
    const xs = marcadores.filter(m => m.tipo === tipo).sort((a, b) => b.n - a.n);
    return xs.length ? `<div class="tf-grupo"><span class="tf-grupo-nome">${nome}</span><div class="tf-marcadores">${xs.map(chip).join('')}</div></div>` : '';
  }).join('');

  const forma = [...todos].slice(-15).map(g => `<i class="${g.v ? 'v' : 'd'}" title="${g.v ? 'Vitória' : 'Derrota'} · ${data(g.t * 1000)}"></i>`).join('');
  const ouro = (g, m) => {
    const x = g.ouro && g.ouro[m];
    return x == null ? '' : `<span class="tf-ouro ${x >= 0 ? 'bom' : 'ruim'}"><small>${m}'</small>${mil(x)}</span>`;
  };
  const ficha = g => `
    <article class="tf-jogo ${g.v ? 'tf-v' : 'tf-d'}">
      <div class="tf-res"><b>${g.v ? 'V' : 'D'}</b><small>${data(g.t * 1000)}</small><small>${g.dur != null ? `${Math.round(g.dur / 60)} min` : ''}</small></div>
      <div class="tf-meio">
        <div class="tf-times">
          <div class="tf-lado">${[...g.nos].sort((a, b) => (a[2] || 9) - (b[2] || 9)).map(x => `
            <div class="tf-heroi">${x[1] ? heroi(x[1], 'heroi heroi-mini') : ''}<small>${esc(nomeJogador(x[0]))}</small></div>`).join('')}</div>
          <span class="tf-vs">vs</span>
          <div class="tf-lado tf-eles">${g.eles.map(h => `<div class="tf-heroi">${h ? heroi(h, 'heroi heroi-mini') : ''}</div>`).join('')}</div>
        </div>
        <div class="tf-linha">
          ${ouro(g, '10')}${ouro(g, '20')}${ouro(g, '30')}
          ${g.marcadores.map(m => chip({ ...m, n: null })).join('')}
        </div>
      </div>
      <a class="tf-julgar" href="../#${g.id}" title="Julgar essa partida">⚖️</a>
    </article>`;

  const vF = jogos.filter(g => g.v).length;
  const mF = filtroFechado && porMarcador.get(filtroFechado);
  alvo.innerHTML = `
    <div class="tf-topo">
      <div class="tf-placar-num"><b class="${wrGeral > 50 ? 'bom' : wrGeral < 50 ? 'ruim' : ''}">${wrGeral}%</b><span>${vit}V · ${todos.length - vit}D em ${todos.length} jogos com os 5</span></div>
      <div class="tf-forma" title="Últimos ${Math.min(15, todos.length)} jogos, do mais antigo pro mais novo">${forma}</div>
    </div>

    <div class="tf-graficos">
      ${gradeRespostas(todos)}
      ${graficoMarcadores(marcadores, todos.length, wrGeral)}
      ${glossarioFechado(marcadores, todos.flatMap(g => [...g.sinNos.lista, ...g.sinEles.lista].filter(x => x.nivel).map(x => x.id)))}
    </div>

    <div class="secao-titulo"><h2>Marcadores</h2><p>Toque num pra ver só os jogos em que ele aparece.</p></div>
    <div class="tf-filtros">${grupos}</div>

    <div class="tf-lista-cab">
      ${mF ? `<span>Jogos com <b>${mF.icone} ${esc(mF.nome)}</b>: ${vF}V · ${jogos.length - vF}D (${pct(vF, jogos.length)}%)<small class="tf-explica">${esc(textoExplicado(mF))}</small></span>
        <button type="button" class="chip" data-marcador="">✕ Ver todos</button>` : `<span>Todos os ${todos.length} jogos, do mais novo pro mais antigo</span>`}
    </div>
    <div class="tf-lista">${[...jogos].reverse().map(ficha).join('')}</div>`;

  if (!alvo.dataset.ouvindo) {
    alvo.dataset.ouvindo = '1';
    alvo.addEventListener('click', e => {
      const casa = e.target.closest('[data-casa]');
      if (casa) {
        casaFechado = casa.dataset.casa && casa.dataset.casa !== casaFechado ? casa.dataset.casa : null;
        renderizarTimeFechado();
        const painel = $('fechado-conteudo').querySelector('.tf-casa-painel');
        if (casaFechado && painel && painel.getBoundingClientRect().top > innerHeight - 120) painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      const b = e.target.closest('[data-marcador]');
      if (!b) return;
      const doGrafico = Boolean(b.closest('svg'));
      filtroFechado = b.dataset.marcador && b.dataset.marcador !== filtroFechado ? b.dataset.marcador : null;
      renderizarTimeFechado();
      // tocar numa bolha deixa a tela no gráfico (o destaque aparece no ouro jogo a jogo); nas tags, desce pra lista
      if (!doGrafico) $('fechado-conteudo').querySelector('.tf-lista-cab').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    alvo.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-marcador], [data-casa][role="button"]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
  }
}

/* ---------- Visitas (contador no Worker: código aleatório por navegador, sem nome nem IP) ---------- */

const AVISO_VISITA_MS = 2 * 60_000;

function idDoVisitante() {
  try {
    let id = localStorage.getItem('culpado-visitante');
    if (!/^[a-z0-9]{12,40}$/.test(id || '')) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => (b % 36).toString(36)).join('');
      localStorage.setItem('culpado-visitante', id);
    }
    return id;
  } catch (e) { return null; }
}

async function contarVisitas() {
  const url = await urlDoCoach();
  const id = idDoVisitante();
  if (!url || !id) return;
  const avisar = () => fetch(`${url}/visita`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, pagina: 'ranking' }), keepalive: true }).catch(() => null);
  await avisar();
  // enquanto a aba está aberta e visível, conta como "online agora"
  setInterval(() => { if (!document.hidden) avisar(); }, AVISO_VISITA_MS);
  const d = await fetch(`${url}/visitas`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!d) return;
  const el = $('visitas');
  const pessoas = n => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;
  el.innerHTML = `<span class="visitas-online"><i></i>${d.online} online agora</span> · ${pessoas(d.hoje)} no site hoje · ${pessoas(d.semana)} nos últimos 7 dias · ${pessoas(d.mes)} em 30 dias`;
  el.title = (d.porDia || []).map(x => `${x.dia.split('-').reverse().slice(0, 2).join('/')}: ${pessoas(x.pessoas)}`).join('\n');
  el.hidden = false;
}

/* ---------- Atualizar agora (no máximo a cada 30 min; a regra vale no Worker) ---------- */

// estado lido direto do repositório pelo Worker (sem o cache do GitHub Pages)
async function estadoDoRanking() {
  const url = await urlDoCoach();
  if (!url) return null;
  return fetch(`${url}/ranking`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
}

const INTERVALO_ATT_MIN = 30;
const ESPERA_ROBO_MS = 15 * 60_000;
let timerAtt = 0;

function relativo(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min)) return '';
  if (min < 1) return '(agora há pouco)';
  if (min < 60) return `(há ${min} min)`;
  const h = Math.floor(min / 60);
  return h < 24 ? `(há ${h} h${min % 60 ? ` ${min % 60} min` : ''})` : `(há ${Math.floor(h / 24)} ${Math.floor(h / 24) === 1 ? 'dia' : 'dias'})`;
}

function montarAtualizacao() {
  const botao = $('att-botao'); const status = $('att-status');
  const pintarData = () => {
    $('att-data').textContent = dataHora(ranking.atualizadoEm);
    $('att-rel').textContent = relativo(ranking.atualizadoEm);
    const n = ranking.semAnalise || 0;
    $('att-pendentes').textContent = n ? `${n === 1 ? '1 partida recente ainda espera' : `${n} partidas recentes ainda esperam`} a análise do replay na OpenDota e ${n === 1 ? 'entra' : 'entram'} numa próxima atualização.` : '';
  };
  const travarAte = (liberaEm) => {
    clearInterval(timerAtt);
    const tick = () => {
      pintarData();
      const falta = Math.ceil((Date.parse(liberaEm) - Date.now()) / 60_000);
      if (falta > 0) { botao.disabled = true; status.textContent = `Libera em ${falta} min (uma atualização a cada ${INTERVALO_ATT_MIN} min).`; return; }
      clearInterval(timerAtt); botao.disabled = false; status.textContent = '';
    };
    tick();
    timerAtt = setInterval(tick, 30_000);
  };
  let conferir = null;
  const esperarRobo = (desde) => {
    clearInterval(timerAtt);
    botao.disabled = true;
    status.textContent = 'Atualizando… o robô leva uns 3 minutos. A página recarrega sozinha.';
    const antes = Date.parse(ranking.atualizadoEm) || 0;
    const inicio = Date.now();
    conferir = async () => {
      // pergunta ao Worker (lê o repositório na hora); sem Worker, olha a cópia do site
      const est = await estadoDoRanking();
      const novo = est || await fetch(RANKING_URL, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const t = novo && Date.parse(novo.atualizadoEm);
      if (t && t > antes && t >= Date.parse(desde || 0) - 60_000) {
        clearInterval(timerAtt); conferir = null;
        status.textContent = 'Pronto! Recarregando…';
        setTimeout(() => location.reload(), 600);
      } else if (Date.now() - inicio > ESPERA_ROBO_MS) {
        clearInterval(timerAtt); conferir = null;
        status.textContent = 'O robô está demorando mais que o normal. Recarregue a página daqui a pouco.';
      }
    };
    timerAtt = setInterval(conferir, 15_000);
  };
  // celular com a tela apagada ou aba em segundo plano congela o timer: confere assim que a página volta
  document.addEventListener('visibilitychange', () => { if (!document.hidden && conferir) conferir(); });

  pintarData();
  const localLibera = new Date(Date.parse(ranking.atualizadoEm) + INTERVALO_ATT_MIN * 60_000).toISOString();
  if (estadoAtt && estadoAtt.atualizando) esperarRobo(estadoAtt.pedidoEm);
  else travarAte(estadoAtt && estadoAtt.liberaEm ? estadoAtt.liberaEm : localLibera);

  botao.addEventListener('click', async () => {
    botao.disabled = true;
    status.textContent = 'Pedindo ao robô…';
    const url = await urlDoCoach();
    if (!url) { status.textContent = 'A atualização está desligada agora.'; return; }
    try {
      const r = await fetch(`${url}/ranking`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { esperarRobo(j.pedidoEm); return; }
      if (r.status === 429 && j.liberaEm) { if (j.atualizando) esperarRobo(); else travarAte(j.liberaEm); return; }
      status.textContent = j.msg || 'Não deu pra pedir agora. Tente de novo em um minuto.';
      botao.disabled = false;
    } catch (e) {
      status.textContent = 'Não deu pra pedir agora. Tente de novo em um minuto.';
      botao.disabled = false;
    }
  });
}

/* ---------- Feedback (mesmo worker do painel: POST <coach>/feedback grava em feedback/) ---------- */

function montarFeedback() {
  const caixa = $('fb-caixa'), botao = $('fb-botao'), campo = $('fb-texto'), nome = $('fb-nome');
  const status = $('fb-status'), enviar = $('fb-enviar');

  try { nome.value = localStorage.getItem('culpado:fb-nome') || ''; } catch (e) { /* sem storage */ }

  botao.addEventListener('click', () => {
    caixa.hidden = !caixa.hidden;
    botao.setAttribute('aria-expanded', String(!caixa.hidden));
    if (!caixa.hidden) { urlDoCoach(); campo.focus(); }
  });

  caixa.addEventListener('submit', async ev => {
    ev.preventDefault();
    const texto = campo.value.trim();
    if (texto.length < 3) { status.textContent = 'Escreve um pouquinho mais.'; return; }
    const url = await urlDoCoach();
    if (!url) { status.textContent = 'O envio está desligado agora.'; return; }
    const aba = (document.querySelector('.aba-ativa') || {}).dataset?.aba || 'geral';
    enviar.disabled = true;
    status.textContent = 'Enviando…';
    try {
      const r = await fetch(`${url}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto, nome: nome.value.trim(), partida: `ranking-${aba}` }),
      });
      if (!r.ok) throw new Error(r.status);
      try { localStorage.setItem('culpado:fb-nome', nome.value.trim()); } catch (e) { /* sem storage */ }
      campo.value = '';
      status.textContent = 'Valeu! Recebido.';
      setTimeout(() => { caixa.hidden = true; botao.setAttribute('aria-expanded', 'false'); status.textContent = ''; }, 1800);
    } catch (e) {
      status.textContent = r429(e) ? 'Muitos envios seguidos. Tenta daqui a pouco.' : 'Não deu pra enviar. Tenta de novo daqui a pouco.';
    }
    enviar.disabled = false;
  });
}

function r429(e) {
  return String(e && e.message) === '429';
}

/* ---------- utilidades ---------- */

function data(ms) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function dataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
