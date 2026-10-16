/* Ranking dos Marocas: lê ../amigos/ranking.json e monta o pódio e a lista, filtrando por aba. */

const DADOS_URL = '../amigos/ranking.json';

const ABAS = {
  geral: { filtro: null, dica: 'Todas as partidas dos amigos.' },
  stack: { filtro: true, dica: 'Só as partidas em que 2 ou mais amigos jogaram juntos, no mesmo grupo.' },
  solo: { filtro: false, dica: 'Só as partidas em que o amigo jogou sem outro amigo no grupo.' },
};

const ORDENS = {
  culpados: (j) => [j.culpados, j.taxaCulpa],
  craques: (j) => [j.craques, -j.culpados],
  taxa: (j) => [j.taxaCulpa, j.culpados],
};

const TIPOS = {
  culpado: { rotulo: 'Culpado', classe: 'culpado' },
  craque: { rotulo: 'Craque', classe: 'craque' },
  vitoria: { rotulo: 'Vitória', classe: 'vitoria' },
  derrota: { rotulo: 'Derrota', classe: 'derrota' },
};

const estado = { dados: null, aba: 'geral', ordem: 'culpados' };

function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    el.append(f.nodeType ? f : document.createTextNode(String(f)));
  }
  return el;
}

const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

function sequenciaDe(eventos) {
  const decisivos = eventos.filter((e) => e.tipo === 'culpado' || e.tipo === 'craque');
  if (decisivos.length < 2) return null;
  const ultimo = decisivos[decisivos.length - 1].tipo;
  let n = 0;
  for (let i = decisivos.length - 1; i >= 0 && decisivos[i].tipo === ultimo; i--) n++;
  return n >= 2 ? { tipo: ultimo, n } : null;
}

function estatisticas(dados, filtro) {
  return Object.entries(dados.historicos).map(([id, historico]) => {
    const nome = (dados.ranking.find((r) => r.accountId === id) || {}).nome || id;
    const eventos = historico
      .filter((e) => filtro === null || e.comStack === filtro)
      .sort((a, b) => (a.inicio || 0) - (b.inicio || 0));
    const culpados = eventos.filter((e) => e.tipo === 'culpado').length;
    const craques = eventos.filter((e) => e.tipo === 'craque').length;
    const derrotas = eventos.filter((e) => e.tipo === 'culpado' || e.tipo === 'derrota').length;
    return {
      id, nome, eventos, culpados, craques, derrotas,
      partidas: eventos.length,
      taxaCulpa: eventos.length ? culpados / eventos.length : 0,
      sequencia: sequenciaDe(eventos),
    };
  }).filter((j) => j.partidas > 0);
}

function ordenar(lista, ordem) {
  const chave = ORDENS[ordem];
  return lista.slice().sort((a, b) => {
    const [a1, a2] = chave(a);
    const [b1, b2] = chave(b);
    return b1 - a1 || b2 - a2 || a.nome.localeCompare(b.nome);
  });
}

function dataCurta(segundos) {
  if (!segundos) return '';
  return new Date(segundos * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function destaque(titulo, emoji, classe, jogador, valor, rotuloValor, detalhe) {
  if (!jogador || !valor) {
    return h('div', { class: `destaque ${classe} vazio` },
      h('p', { class: 'destaque-titulo' }, emoji, ' ', titulo),
      h('p', { class: 'destaque-nome' }, 'Ninguém ainda'));
  }
  return h('div', { class: `destaque ${classe}` },
    h('p', { class: 'destaque-titulo' }, emoji, ' ', titulo),
    h('p', { class: 'destaque-nome' }, jogador.nome),
    h('p', { class: 'destaque-numero' }, h('strong', {}, valor), ' ', rotuloValor),
    h('p', { class: 'destaque-detalhe' }, detalhe));
}

function podio(lista) {
  const culpado = ordenar(lista, 'culpados')[0];
  const craque = ordenar(lista, 'craques')[0];
  return h('div', { class: 'podio' },
    destaque('Culpado', '🚨', 'culpado', culpado, culpado && culpado.culpados, culpado && culpado.culpados === 1 ? 'culpa' : 'culpas',
      culpado && `em ${culpado.partidas} partidas (${pct(culpado.culpados, culpado.partidas)}%)`),
    destaque('Craque', '✨', 'craque', craque, craque && craque.craques, craque && craque.craques === 1 ? 'craque' : 'craques',
      craque && `em ${craque.partidas} partidas (${pct(craque.craques, craque.partidas)}%)`));
}

function forma(eventos) {
  const ultimos = eventos.slice(-10);
  return h('div', { class: 'forma', role: 'img', 'aria-label': `Últimas ${ultimos.length} partidas` },
    ultimos.map((e) => h('span', { class: `ponto ${TIPOS[e.tipo].classe}`, title: TIPOS[e.tipo].rotulo })));
}

function barra(rotulo, valor, maximo, classe) {
  return h('div', { class: `barra ${classe}` },
    h('span', { class: 'barra-rotulo' }, rotulo),
    h('span', { class: 'barra-trilho' }, h('span', { class: 'barra-cheia', style: `width:${maximo ? Math.max(valor ? 6 : 0, (valor / maximo) * 100) : 0}%` })),
    h('span', { class: 'barra-valor' }, valor));
}

function partidasDe(jogador) {
  const recentes = jogador.eventos.slice().reverse().slice(0, 10);
  return h('ul', { class: 'partidas' }, recentes.map((e) => h('li', {},
    h('span', { class: 'data' }, dataCurta(e.inicio)),
    h('span', { class: `selo ${TIPOS[e.tipo].classe}` }, TIPOS[e.tipo].rotulo),
    e.comStack ? h('span', { class: 'grupo' }, 'em grupo') : null,
    h('a', { class: 'ver', href: `../#${e.matchId}` }, 'Ver análise →'))));
}

function cartao(jogador, posicao, maxCulpados, maxCraques) {
  const seq = jogador.sequencia;
  return h('li', { class: 'cartao' },
    h('details', {},
      h('summary', {},
        h('span', { class: 'posicao' }, posicao),
        h('div', { class: 'corpo' },
          h('div', { class: 'linha-nome' },
            h('span', { class: 'nome' }, jogador.nome),
            seq ? h('span', { class: `sequencia ${seq.tipo}` }, `${seq.tipo === 'culpado' ? '🚨' : '✨'} ${seq.n} seguidos`) : null),
          h('div', { class: 'barras' },
            barra('Culpado', jogador.culpados, maxCulpados, 'culpado'),
            barra('Craque', jogador.craques, maxCraques, 'craque')),
          h('div', { class: 'meta' },
            h('span', {}, `${jogador.partidas} partidas`),
            h('span', {}, `${pct(jogador.culpados, jogador.partidas)}% de culpa`),
            forma(jogador.eventos))),
        h('span', { class: 'seta', 'aria-hidden': 'true' }, '›')),
      partidasDe(jogador)));
}

function renderizar() {
  const painel = document.getElementById('painel');
  const { dados, aba, ordem } = estado;
  document.getElementById('dica').textContent = ABAS[aba].dica;
  painel.setAttribute('aria-labelledby', `tab-${aba}`);

  const lista = estatisticas(dados, ABAS[aba].filtro);
  painel.replaceChildren();
  if (!lista.length) {
    painel.append(h('p', { class: 'estado' }, 'Ainda não tem partida nessa aba.'));
    return;
  }
  const maxCulpados = Math.max(...lista.map((j) => j.culpados));
  const maxCraques = Math.max(...lista.map((j) => j.craques));
  painel.append(
    podio(lista),
    h('ol', { class: 'lista' }, ordenar(lista, ordem).map((j, i) => cartao(j, i + 1, maxCulpados, maxCraques))));
}

function ligarControles() {
  document.querySelectorAll('.aba').forEach((botao) => {
    botao.addEventListener('click', () => {
      estado.aba = botao.dataset.aba;
      document.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b === botao)));
      renderizar();
    });
  });
  document.querySelectorAll('.chip').forEach((botao) => {
    botao.addEventListener('click', () => {
      estado.ordem = botao.dataset.ordem;
      document.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
      renderizar();
    });
  });
}

async function iniciar() {
  ligarControles();
  try {
    const resp = await fetch(DADOS_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    estado.dados = await resp.json();
    const quando = new Date(estado.dados.atualizadoEm);
    document.getElementById('atualizado-em').textContent =
      `Atualizado em ${quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
    renderizar();
  } catch (erro) {
    document.getElementById('painel').replaceChildren(
      h('p', { class: 'estado erro' }, 'Não consegui carregar o ranking. Tente recarregar a página.'));
  }
}

iniciar();
