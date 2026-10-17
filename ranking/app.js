/* Ranking do grupo Marocas: culpados/craques (amigos/ranking.json), duplas e composições (amigos/parceiros.json)
 * e meta do Reddit (reddit/insights.json). */

const RANKING_URL = '../amigos/ranking.json';
const PARCEIROS_URL = '../amigos/parceiros.json';
const INSIGHTS_URL = '../reddit/insights.json';
const HEROI_IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';
const MIN_JOGOS_DUPLA = 5;   // abaixo disso a dupla vai pro fim (amostra pequena)
const MIN_JOGOS_GRUPO = 3;
// A Valve não expõe o MMR de cada partida: ±25 por ranqueada é uma estimativa
const MMR_POR_PARTIDA = 25;
const TAMANHO_FORMA = 10;

const POSICOES = { 1: 'Carry', 2: 'Mid', 3: 'Offlane', 4: 'Sup 4', 5: 'Sup 5' };

const VISOES = {
  geral: { filtro: () => true, desc: 'Últimas partidas de cada um. Culpado = quem mais pesou na derrota; craque = quem carregou a vitória.' },
  stack: { filtro: h => h.comStack === true, desc: 'Só partidas com 2 ou mais amigos do mesmo lado.' },
  solo: { filtro: h => h.comStack === false, desc: 'Só partidas sem outro amigo do lado.' },
};

let ranking = null;
let parceiros = null;
let insights = null;
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

  const pegar = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
  [ranking, parceiros, insights] = await Promise.all([pegar(RANKING_URL), pegar(PARCEIROS_URL), pegar(INSIGHTS_URL)]);

  if (!ranking || !ranking.historicos) {
    $('carregando').textContent = 'Não deu pra carregar o ranking. Tente recarregar.';
    return;
  }
  $('carregando').hidden = true;
  $('atualizado-em').textContent = `Atualizado em ${dataHora(ranking.atualizadoEm)}`;

  renderizarRanking();
  renderizarDuplas();
  renderizarComposicoes();
  renderizarMeta();

  const pelaUrl = () => {
    const aba = location.hash.slice(1);
    if (aba && document.querySelector(`.aba[data-aba="${aba}"]`)) mudarAba(aba);
  };
  window.addEventListener('hashchange', pelaUrl);
  pelaUrl();
});

function mudarAba(aba) {
  document.querySelectorAll('.aba').forEach(b => b.classList.toggle('aba-ativa', b.dataset.aba === aba));
  const secao = aba in VISOES ? 'ranking' : aba;
  document.querySelectorAll('.aba-conteudo').forEach(s => s.classList.toggle('aba-conteudo-ativa', s.id === `aba-${secao}`));
  history.replaceState(null, '', `#${aba}`);
  if (aba in VISOES) {
    visao = aba;
    renderizarRanking();
  }
}

/* ---------- Ranking (geral / stack / solo) ---------- */

function estatisticas(conta, nome, historico) {
  const eventos = historico.filter(VISOES[visao].filtro).sort((a, b) => (a.inicio || 0) - (b.inicio || 0));
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

  $('ranking-desc').textContent = VISOES[visao].desc;
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
      return `<span class="ponto ponto-${v ? 'v' : 'd'}" title="${rotuloTipo(h.tipo)}${h.inicio ? ' · ' + data(h.inicio * 1000) : ''}">${icone}</span>`;
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
  return parceiros.jogadores[conta] ? parceiros.jogadores[conta].nome : conta;
}

function corWr(wr, jogos) {
  const forca = Math.min(1, Math.abs(wr - 50) / 30) * (jogos >= MIN_JOGOS_DUPLA ? 1 : 0.5);
  const base = wr >= 50 ? 'var(--good)' : 'var(--bad)';
  return `background:color-mix(in srgb, ${base} ${Math.round(12 + forca * 58)}%, var(--surface))`;
}

function renderizarDuplas() {
  const grade = $('grade-sinergia');
  if (!parceiros || !parceiros.pares || !parceiros.pares.length) {
    grade.outerHTML = '<p class="carregando">Sem dados de duplas ainda.</p>';
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

  grade.addEventListener('click', e => {
    const casa = e.target.closest('td[data-a]');
    if (!casa) return;
    $('filtro-jogador').value = casa.dataset.a;
    renderizarListaDuplas(casa.dataset.b);
  });

  const select = $('filtro-jogador');
  contas.forEach(c => select.add(new Option(nomeJogador(c), c)));
  select.addEventListener('change', () => renderizarListaDuplas());
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

  div.innerHTML = `
    <div class="cartao-topo">
      <div>
        <div class="cartao-titulo">${nomeA} + ${nomeB}</div>
        <div class="cartao-sub">${p.vitorias} vitórias em ${p.jogos} jogos juntos${p.jogos < MIN_JOGOS_DUPLA ? ' · poucos jogos' : ''}</div>
      </div>
      <div class="wr-grande ${p.winRate > 50 ? 'bom' : p.winRate < 50 ? 'ruim' : ''}">${p.winRate}%</div>
    </div>
    <div class="bloco-titulo">Na lane · últimas partidas juntos</div>
    ${lane}
    ${p.herois.length || p.heroisPiores.length ? `<div class="bloco-titulo">Sinergias de heróis</div>
      <div class="sinergias">${p.herois.map(h => sinergia(h, true)).join('')}${p.heroisPiores.map(h => sinergia(h, false)).join('')}</div>` : ''}
    ${rotasBoas.length || p.rotasPiores.length ? `<div class="bloco-titulo">Rotas</div>
      <div class="rotas">${rotasBoas.map(r => rota(r, 'rota-boa')).join('')}${p.rotasPiores.map(r => rota(r, 'rota-ruim')).join('')}</div>` : ''}`;
  return div;
}

/* ---------- Composições ---------- */

function renderizarComposicoes() {
  const lista = $('lista-composicoes');
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

  const formacao = f => {
    const quem = {};
    Object.entries(f.posicoes).forEach(([c, pos]) => { quem[pos] = nomeJogador(c); });
    return `<div class="formacao">${[1, 2, 3, 4, 5].map(pos => `
      <div class="slot${quem[pos] ? '' : ' slot-vazio'}"><span>${POSICOES[pos]}</span><b>${quem[pos] ? esc(quem[pos]) : 'random'}</b></div>`).join('')}</div>
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

/* ---------- Meta ---------- */

function renderizarMeta() {
  const box = $('meta-topicos');
  const desc = $('meta-desc');
  if (!insights || !insights.topicos || !Object.keys(insights.topicos).length) {
    desc.textContent = 'Insights ainda não disponíveis.';
    return;
  }
  desc.textContent = insights.fonte === 'exemplo'
    ? 'Dados de exemplo: a coleta automática do Reddit ainda não rodou.'
    : `Coletado do r/DotA2 em ${dataHora(insights.atualizadoEm)}.`;

  Object.entries(insights.topicos).forEach(([chave, t]) => {
    const div = document.createElement('article');
    div.className = 'cartao';
    div.innerHTML = `
      <div class="cartao-topo">
        <div>
          <div class="cartao-titulo">${esc(chave.charAt(0).toUpperCase() + chave.slice(1))}</div>
          <div class="cartao-sub">${esc(t.descricao)}</div>
        </div>
        <div class="cartao-sub">${t.count} menções</div>
      </div>
      ${t.insights.map(i => `
        <div class="insight">
          <p>${esc(i.texto)}</p>
          <div class="insight-meta"><span>— ${esc(i.autor)}</span><span>👍 ${i.score}</span></div>
        </div>`).join('')}`;
    box.append(div);
  });
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
