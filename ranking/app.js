/* Ranking do grupo Marocas
 * Carrega amigos/ranking.json e renderiza as abas de ranking.
 */

const RANKING_URL = '../amigos/ranking.json';
const INSIGHTS_URL = '../reddit/insights.json';

let dados = null;
let insights = null;
let abaAtiva = 'geral';

// Carregar ranking ao iniciar
document.addEventListener('DOMContentLoaded', async () => {
  const abas = document.querySelectorAll('.aba');
  const voltar = document.getElementById('voltar');

  // Event listeners das abas
  abas.forEach(aba => {
    aba.addEventListener('click', (e) => {
      const novaAba = e.target.dataset.aba;
      mudarAba(novaAba);
    });
  });

  // Botão voltar
  voltar.addEventListener('click', () => {
    window.location.href = '../';
  });

  // Carregar dados
  try {
    const respRanking = await fetch(RANKING_URL);
    if (!respRanking.ok) throw new Error(`HTTP ${respRanking.status}`);
    dados = await respRanking.json();

    // Carregar insights (não é crítico se falhar)
    try {
      const respInsights = await fetch(INSIGHTS_URL);
      if (respInsights.ok) {
        insights = await respInsights.json();
      }
    } catch (e) {
      console.warn('Insights não disponíveis:', e);
    }

    renderizar();
  } catch (erro) {
    console.error('Erro ao carregar ranking:', erro);
    document.querySelector('.carregando').textContent = '❌ Erro ao carregar ranking. Tente recarregar.';
  }
});

function mudarAba(novaAba) {
  abaAtiva = novaAba;

  // Atualizar botões das abas
  document.querySelectorAll('.aba').forEach(aba => {
    aba.classList.toggle('aba-ativa', aba.dataset.aba === novaAba);
  });

  // Atualizar conteúdo
  document.querySelectorAll('.aba-conteudo').forEach(conteudo => {
    conteudo.classList.remove('aba-conteudo-ativa');
  });
  document.getElementById(`aba-${novaAba}`).classList.add('aba-conteudo-ativa');
}

function renderizar() {
  if (!dados || !dados.ranking) {
    console.error('Dados inválidos');
    return;
  }

  // Atualizar data
  const data = new Date(dados.atualizadoEm);
  const dataStr = data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
  document.getElementById('atualizado-em').textContent = `Atualizado em: ${dataStr}`;

  // Renderizar cada aba
  renderizarAba('geral', dados.ranking);
  renderizarAbaStack('stack');
  renderizarAbaSolo('solo');
  renderizarAbaMeta('meta');
}

function renderizarAba(nomeAba, ranking) {
  const tbody = document.getElementById(`ranking-${nomeAba}`);
  const carregando = document.getElementById(`carregando-${nomeAba}`);

  if (!ranking || ranking.length === 0) {
    carregando.textContent = 'Sem dados ainda. Rode o script de ranking.';
    return;
  }

  carregando.style.display = 'none';
  tbody.innerHTML = '';

  ranking.forEach((jogador, idx) => {
    const tr = document.createElement('tr');
    const streak = jogador.streak ? `<span class="ranking-streak streak-${jogador.streak}">${jogador.streak === 'culpado' ? '🚨' : '✨'} ${jogador.streak}</span>` : '<span class="ranking-streak streak-vazio">—</span>';

    tr.innerHTML = `
      <td class="ranking-posicao">#${idx + 1}</td>
      <td class="ranking-nome">${escapeHtml(jogador.nome)}</td>
      <td class="ranking-culpados">${jogador.culpados}</td>
      <td class="ranking-craques">${jogador.craques}</td>
      <td>${jogador.partidas}</td>
      <td>${jogador.winRate}%</td>
      <td>${formatarMmr(jogador)}</td>
      <td>${streak}</td>
    `;
    tbody.append(tr);
  });
}

// A Valve não expõe o MMR de cada partida: ±25 por ranqueada é uma estimativa
const MMR_POR_PARTIDA = 25;

// Históricos gerados antes do campo "ranqueada" não têm como saber: MMR fica indefinido
function mmrDe(partidas) {
  if (!partidas.some(h => 'ranqueada' in h)) return { mmrGanho: undefined, mmrPerdido: undefined };
  const ranqueadas = partidas.filter(h => h.ranqueada);
  const vitorias = ranqueadas.filter(h => h.tipo === 'vitoria' || h.tipo === 'craque').length;
  return {
    mmrGanho: vitorias * MMR_POR_PARTIDA,
    mmrPerdido: (ranqueadas.length - vitorias) * MMR_POR_PARTIDA
  };
}

function formatarMmr(jogador) {
  if (jogador.mmrGanho == null) return '<span class="ranking-mmr">—</span>';
  const saldo = jogador.mmrGanho - jogador.mmrPerdido;
  const classe = saldo > 0 ? 'mmr-positivo' : saldo < 0 ? 'mmr-negativo' : '';
  return `<span class="ranking-mmr ${classe}">${saldo > 0 ? '+' : ''}${saldo}</span>` +
    `<span class="ranking-mmr-detalhe">+${jogador.mmrGanho} / −${jogador.mmrPerdido}</span>`;
}

function renderizarAbaStack(nomeAba) {
  renderizarAbaFiltrada(nomeAba, h => h.comStack === true);
}

function renderizarAbaSolo(nomeAba) {
  renderizarAbaFiltrada(nomeAba, h => h.comStack === false);
}

// Ranking só com as partidas do histórico que passam no filtro (com stack = 2+ amigos do mesmo lado)
function renderizarAbaFiltrada(nomeAba, filtro) {
  const carregando = document.getElementById(`carregando-${nomeAba}`);

  if (!dados || !dados.historicos) {
    carregando.textContent = 'Sem dados ainda.';
    return;
  }

  const ranking = [];

  for (const [accountId, historico] of Object.entries(dados.historicos)) {
    const jogador = dados.ranking.find(j => j.accountId === accountId);
    if (!jogador) continue;

    const partidasFiltradas = historico.filter(filtro);
    if (partidasFiltradas.length === 0) continue;

    const culpados = partidasFiltradas.filter(h => h.tipo === 'culpado').length;
    const craques = partidasFiltradas.filter(h => h.tipo === 'craque').length;
    ranking.push({
      ...jogador,
      culpados,
      craques,
      partidas: partidasFiltradas.length,
      winRate: Math.round((craques / partidasFiltradas.length) * 100),
      ...mmrDe(partidasFiltradas)
    });
  }

  ranking.sort((a, b) => b.culpados - a.culpados);
  carregando.style.display = 'none';
  renderizarAba(nomeAba, ranking);
}

function renderizarAbaMeta(nomeAba) {
  const container = document.getElementById('meta-topicos');
  const carregando = document.getElementById(`carregando-${nomeAba}`);

  if (!insights || !insights.topicos) {
    carregando.textContent = 'Insights não disponíveis. Execute reddit/insights.py para coletar dados.';
    return;
  }

  carregando.style.display = 'none';
  container.innerHTML = '';

  // Renderizar cada tópico
  const topicos = Object.entries(insights.topicos);
  if (topicos.length === 0) {
    carregando.textContent = 'Nenhum insight coletado ainda.';
    carregando.style.display = 'block';
    return;
  }

  // aviso quando ainda não tem coleta real do Reddit
  if (insights.fonte === 'exemplo') {
    const aviso = document.createElement('div');
    aviso.className = 'meta-aviso';
    aviso.textContent = 'Dados de exemplo: a coleta automática do Reddit ainda não rodou.';
    container.appendChild(aviso);
  } else if (insights.atualizadoEm) {
    const quando = document.createElement('div');
    quando.className = 'meta-aviso';
    quando.textContent = `Coletado do r/DotA2 em ${new Date(insights.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
    container.appendChild(quando);
  }

  topicos.forEach(([topicoKey, topico]) => {
    const topicoDiv = document.createElement('div');
    topicoDiv.className = 'topico-card';

    const titulo = document.createElement('div');
    titulo.className = 'topico-titulo';
    titulo.textContent = topicoKey.charAt(0).toUpperCase() + topicoKey.slice(1);

    const descricao = document.createElement('div');
    descricao.className = 'topico-descricao';
    descricao.textContent = topico.descricao;

    const stats = document.createElement('div');
    stats.className = 'topico-stats';
    stats.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Menções:</span>
        <span class="stat-valor">${topico.count}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Score médio:</span>
        <span class="stat-valor">${topico.avgScore}</span>
      </div>
    `;

    const insightsList = document.createElement('div');
    insightsList.className = 'insights-list';

    topico.insights.forEach(insight => {
      const insightDiv = document.createElement('div');
      insightDiv.className = 'insight-item';

      const texto = document.createElement('div');
      texto.className = 'insight-texto';
      texto.textContent = insight.texto;

      const meta = document.createElement('div');
      meta.className = 'insight-meta';
      meta.innerHTML = `
        <span class="insight-autor">— ${escapeHtml(insight.autor)}</span>
        <span class="insight-score">👍 ${insight.score}</span>
      `;

      insightDiv.append(texto, meta);
      insightsList.append(insightDiv);
    });

    topicoDiv.append(titulo, descricao, stats, insightsList);
    container.append(topicoDiv);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
