/* Ranking do grupo Marocas
 * Carrega amigos/ranking.json e renderiza as abas de ranking.
 */

const RANKING_URL = '../amigos/ranking.json';

let dados = null;
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
    const resp = await fetch(RANKING_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    dados = await resp.json();
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
      <td>${streak}</td>
    `;
    tbody.append(tr);
  });
}

function renderizarAbaStack(nomeAba) {
  const tbody = document.getElementById(`ranking-${nomeAba}`);
  const carregando = document.getElementById(`carregando-${nomeAba}`);

  if (!dados || !dados.historicos) {
    carregando.textContent = 'Sem dados ainda.';
    return;
  }

  // Contar culpados/craques com stack (partidas onde party_id tinha 2+ amigos)
  const rankingStack = {};

  for (const [accountId, historico] of Object.entries(dados.historicos)) {
    const jogador = dados.ranking.find(j => j.accountId === accountId);
    if (!jogador) continue;

    let culpados = 0, craques = 0, partidas = 0;

    historico.forEach(h => {
      // TODO: filtrar por party (quando o script adicionar)
      // Por enquanto, mostrar todos (igual ao geral)
      // Quando tiver h.comStack: if (!h.comStack) return;

      partidas++;
      if (h.tipo === 'culpado') culpados++;
      else if (h.tipo === 'craque') craques++;
    });

    if (partidas > 0) {
      rankingStack[accountId] = {
        ...jogador,
        culpados,
        craques,
        partidas,
        winRate: Math.round((craques / partidas) * 100)
      };
    }
  }

  const ranking = Object.values(rankingStack).sort((a, b) => b.culpados - a.culpados);
  carregando.style.display = 'none';
  renderizarAba(nomeAba, ranking);
}

function renderizarAbaSolo(nomeAba) {
  const tbody = document.getElementById(`ranking-${nomeAba}`);
  const carregando = document.getElementById(`carregando-${nomeAba}`);

  if (!dados || !dados.historicos) {
    carregando.textContent = 'Sem dados ainda.';
    return;
  }

  // Contar culpados/craques solo (partidas onde party_id tinha só esse jogador)
  const rankingSolo = {};

  for (const [accountId, historico] of Object.entries(dados.historicos)) {
    const jogador = dados.ranking.find(j => j.accountId === accountId);
    if (!jogador) continue;

    let culpados = 0, craques = 0, partidas = 0;

    historico.forEach(h => {
      // TODO: filtrar por party (quando o script adicionar)
      // Por enquanto, mostrar todos
      // Quando tiver h.comStack: if (h.comStack) return;

      partidas++;
      if (h.tipo === 'culpado') culpados++;
      else if (h.tipo === 'craque') craques++;
    });

    if (partidas > 0) {
      rankingSolo[accountId] = {
        ...jogador,
        culpados,
        craques,
        partidas,
        winRate: Math.round((craques / partidas) * 100)
      };
    }
  }

  const ranking = Object.values(rankingSolo).sort((a, b) => b.culpados - a.culpados);
  carregando.style.display = 'none';
  renderizarAba(nomeAba, ranking);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
