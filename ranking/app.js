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

const POSICOES = { 1: 'Carry', 2: 'Mid', 3: 'Offlane', 4: 'Sup 4', 5: 'Sup 5' };

const VISOES = {
  geral: { filtro: () => true, desc: 'Últimas partidas de cada um. Culpado = quem mais pesou na derrota; craque = quem carregou a vitória.' },
  stack: { filtro: h => h.comStack === true, desc: 'Só partidas com 2 ou mais amigos do mesmo lado.' },
  solo: { filtro: h => h.comStack === false, desc: 'Só partidas sem outro amigo do lado.' },
};

let ranking = null;
let parceiros = null;
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

  const pegar = url => fetch(url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  [ranking, parceiros, insights, meta] = await Promise.all([pegar(RANKING_URL), pegar(PARCEIROS_URL), pegar(INSIGHTS_URL), pegar(META_URL)]);

  if (!ranking || !ranking.historicos) {
    $('carregando').textContent = 'Não deu pra carregar o ranking. Tente recarregar.';
    return;
  }
  $('carregando').hidden = true;
  $('atualizado-em').textContent = `Atualizado em ${dataHora(ranking.atualizadoEm)}`;
  montarAtualizacao();

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
}

/* ---------- Ranking (geral / stack / solo) ---------- */

function estatisticas(conta, nome, historico) {
  const vistas = new Set();
  const eventos = historico
    .filter(h => !vistas.has(h.matchId) && vistas.add(h.matchId))
    .filter(VISOES[visao].filtro)
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
  montarSugestao();
  renderizarPool();
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

/* ---------- Sugestão de time ----------
 * Win rate de cada amigo em cada (herói, posição), puxada pra 50% quando há poucos jogos (prior de PESO_PRIOR
 * partidas), mais um bônus para duplas de heróis que já deram certo entre dois amigos. Busca exaustiva: no
 * máximo 5 amigos × 120 jeitos de distribuir as posições × 3 heróis por amigo/posição. */

const PESO_PRIOR = 10;
const MIN_JOGOS_PICK = 2;
const PESO_SINERGIA = 0.5;
const MAX_TIME = 5;
let escolhidos = null;

const suavizado = (v, j) => (v + PESO_PRIOR / 2) / (j + PESO_PRIOR);
const logit = p => Math.log(p / (1 - p));

function candidatos(conta) {
  const pool = (parceiros.pool || {})[conta] || [];
  const porPos = {};
  for (const minimo of [MIN_JOGOS_PICK, 1]) {
    pool.filter(x => x.pos && x.jogos >= minimo).forEach(x => {
      (porPos[x.pos] = porPos[x.pos] || []).push({ ...x, nota: logit(suavizado(x.vitorias, x.jogos)) });
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

function melhoresTimes(contas) {
  const cand = Object.fromEntries(contas.map(c => [c, candidatos(c)]));
  const times = [];
  for (const posicoes of permutacoes(contas.length)) {
    const opcoes = contas.map((c, i) => (cand[c][posicoes[i]] || []).slice(0, 3));
    if (opcoes.some(o => !o.length)) continue;
    const combinar = (i, atual) => {
      if (i === contas.length) {
        const herois = new Set(atual.map(x => x.heroi));
        if (herois.size < atual.length) return;
        let nota = atual.reduce((s, x) => s + x.nota, 0);
        const sinergias = [];
        for (let a = 0; a < atual.length; a++) for (let b = a + 1; b < atual.length; b++) {
          const sn = sinergiaEntre(contas[a], atual[a].heroi, contas[b], atual[b].heroi);
          if (sn) {
            nota += PESO_SINERGIA * logit(suavizado(sn.vitorias, sn.jogos));
            sinergias.push({ a: contas[a], b: contas[b], ...sn, ha: atual[a].heroi, hb: atual[b].heroi });
          }
        }
        times.push({ nota, picks: atual.map((x, k) => ({ ...x, conta: contas[k], pos: posicoes[k] })), sinergias });
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
  escolhidos = new Set(contas.slice(0, MAX_TIME));

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
      renderizarSugestao();
    });
    box.append(b);
  });
  box.append(aviso);
  renderizarSugestao();
}

function renderizarSugestao() {
  const alvo = $('time-sugerido');
  const contas = [...escolhidos];
  if (!contas.length) { alvo.innerHTML = '<p class="carregando">Marque quem vai jogar.</p>'; return; }
  const { times, semDados } = melhoresTimes(contas);
  if (!times.length) {
    alvo.innerHTML = `<p class="carregando">Não deu pra montar um time sem repetir posição com o histórico de ${esc(semDados.map(nomeJogador).join(', ') || 'vocês')}. Tente outra combinação.</p>`;
    return;
  }
  const [melhor] = times;
  const media = Math.round(100 * melhor.picks.reduce((s, x) => s + suavizado(x.vitorias, x.jogos), 0) / melhor.picks.length);
  // segunda opção de cada um: o melhor time em que essa pessoa joga outro herói
  const alternativa = c => {
    const atual = melhor.picks.find(x => x.conta === c).heroi;
    const t = times.find(t => t.picks.find(x => x.conta === c).heroi !== atual);
    return t && t.picks.find(x => x.conta === c);
  };
  const ordenados = [...melhor.picks].sort((a, b) => a.pos - b.pos);
  alvo.innerHTML = `
    <div class="time">
      <div class="time-cab">
        <div><h3>Time sugerido</h3><p>${contas.length} ${contas.length === 1 ? 'jogador' : 'jogadores'} · aproveitamento médio nesses picks ≈ ${media}%</p></div>
      </div>
      <div class="escalacao">${ordenados.map(x => {
        const alt = alternativa(x.conta);
        return `<div class="pick">
          <div class="pick-pos">${POSICOES[x.pos]}</div>
          ${heroi(x.heroi)}
          <div class="pick-heroi">${esc(nomeHeroi(x.heroi))}</div>
          <div class="pick-quem">${esc(nomeJogador(x.conta))}</div>
          <div class="pick-num ${x.vitorias / x.jogos > 0.5 ? 'bom' : x.vitorias / x.jogos < 0.5 ? 'ruim' : ''}">${x.vitorias}V em ${x.jogos} (${Math.round(100 * x.vitorias / x.jogos)}%)</div>
          ${alt ? `<div class="pick-alt">ou ${esc(nomeHeroi(alt.heroi))} de ${POSICOES[alt.pos]} (${alt.vitorias}/${alt.jogos})</div>` : ''}
        </div>`;
      }).join('')}</div>
      ${melhor.sinergias.length ? `<div class="sinergia-time">Sinergia: ${melhor.sinergias.map(sn =>
        `${esc(nomeHeroi(sn.ha))} (${esc(nomeJogador(sn.a))}) + ${esc(nomeHeroi(sn.hb))} (${esc(nomeJogador(sn.b))}) <b>${sn.vitorias}/${sn.jogos}</b>`).join(' · ')}</div>` : ''}
      <p class="time-nota">Com poucos jogos num herói o modelo puxa a nota pra 50%, então quem tem muitos jogos bons pesa mais que um 2/2. É o histórico de vocês, não leva em conta o draft do inimigo.</p>
    </div>`;
}

function renderizarPool() {
  const alvo = $('pool-jogadores');
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
    desc.textContent = `${meta.patch ? `Patch ${meta.patch} · ` : ''}partidas de ${meta.faixa} na OpenDota · atualizado em ${dataHora(meta.atualizadoEm)}. ` +
      'Os heróis que mais ganham agora, com a build mais comprada e quem de vocês já joga.';
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
      : '<div class="no-grupo">Ninguém do grupo jogou ainda. Bora testar?</div>'}`;
  return card;
}

function renderizarReddit() {
  const desc = $('reddit-desc');
  if (!insights || insights.fonte !== 'reddit') {
    desc.textContent = 'Comentários da semana no r/DotA2 sobre o meta e dicas gerais. Aparece aqui quando a chave do Reddit for configurada no robô.';
    return;
  }
  desc.textContent = `Os comentários mais votados da semana no r/DotA2, coletados em ${dataHora(insights.atualizadoEm)}.`;

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

/* ---------- Worker do coach (feedback e botão de atualizar) ---------- */

let coachPromessa = null;
const urlDoCoach = () => (coachPromessa = coachPromessa || fetch('../config.json', { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : {})).then(j => (/^https:\/\//.test(j.coach || '') ? j.coach.replace(/\/$/, '') : ''))
  .catch(() => ''));

/* ---------- Atualizar agora (no máximo a cada 30 min; a regra vale no Worker) ---------- */

const INTERVALO_ATT_MIN = 30;
const ESPERA_ROBO_MS = 12 * 60_000;
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
  const esperarRobo = (desde) => {
    clearInterval(timerAtt);
    botao.disabled = true;
    status.textContent = 'Atualizando… o robô leva uns 3 minutos. A página recarrega sozinha.';
    const antes = ranking.atualizadoEm;
    const inicio = Date.now();
    timerAtt = setInterval(async () => {
      const novo = await fetch(RANKING_URL, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (novo && novo.atualizadoEm && novo.atualizadoEm !== antes && Date.parse(novo.atualizadoEm) >= Date.parse(desde || 0) - 60_000) {
        clearInterval(timerAtt);
        status.textContent = 'Pronto! Recarregando…';
        setTimeout(() => location.reload(), 800);
      } else if (Date.now() - inicio > ESPERA_ROBO_MS) {
        clearInterval(timerAtt);
        status.textContent = 'O robô está demorando mais que o normal. Recarregue a página daqui a pouco.';
      }
    }, 20_000);
  };

  pintarData();
  const localLibera = new Date(Date.parse(ranking.atualizadoEm) + INTERVALO_ATT_MIN * 60_000).toISOString();
  urlDoCoach().then(async url => {
    if (!url) { travarAte(localLibera); return; }
    const est = await fetch(`${url}/ranking`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (est && est.atualizando) esperarRobo(est.pedidoEm);
    else travarAte(est && est.liberaEm ? est.liberaEm : localLibera);
  });

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
