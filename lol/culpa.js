// O documento da culpa do LoL: o papel sobe com a gravidade (Procura-se ou B.O., Interpol, Haia, Tribunal Penal
// Internacional), igual ao do Dota, com frases do LoL. Os crimes saem do que a pessoa fez de fato (componentes do
// veredito e estatísticas da partida); o resto é sorteado com semente na partida, então o mesmo link mostra sempre
// o mesmo documento. Puro: roda no navegador (window.CulpaLoL) e no Node (testes: node lol/teste_culpa.mjs).
(function (raiz) {
  'use strict';

  // Gravidade = metade a fatia da culpa, metade o tamanho da culpa em pontos (1 ponto = 1.000 de ouro).
  // Calibrado nas 11 derrotas da primeira coleta (fatia de 23% a 43%, pontos de 1,3 a 5,2).
  const GRAVIDADE_CORTES = [0.25, 0.45, 0.62];
  const CULPA_TPI = 0.42; // a partir daqui vai direto para o Tribunal Penal Internacional
  const NIVEIS = ['Procurado', 'Criminoso', 'Criminoso internacional', 'Criminoso contra a humanidade', 'Genocida'];
  const RARIDADES = [['Raro', '#4b69ff'], ['Mítico', '#8847ff'], ['Lendário', '#d32ce6'], ['Imortal', '#e4ae39'], ['Arcana', '#ade55c']];
  const PAPEIS = ['wanted', 'bo', 'interpol', 'haia', 'tpi'];

  function gravidade(v) {
    if (v.fatia >= CULPA_TPI) return 4;
    const lim = (x) => Math.max(0, Math.min(1, x));
    const g = 0.5 * lim((v.fatia - 0.22) / 0.16) + 0.5 * lim((v.score - 1.5) / 3.5);
    return GRAVIDADE_CORTES.filter((c) => g >= c).length;
  }

  function sorteador(semente) {
    let a = 0;
    for (const ch of String(semente)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) | 0;
    const prox = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { um: (xs) => xs[Math.floor(prox() * xs.length)], num: (a_, b) => a_ + Math.floor(prox() * (b - a_ + 1)) };
  }

  // Crimes por componente do veredito e por nível do papel: [0] Procura-se, [1] B.O., [2] Interpol, [3] Haia, [4] Tribunal.
  const CRIMES = {
    mortes: [
      ['Doação ilegal de ouro ao inimigo', 'Visitas frequentes à fonte sem motivo', 'Morrer em local proibido', 'Deixar a tela cinza mais tempo que colorida',
        'Distribuição gratuita de ouro no rio', 'Uso indevido do tempo de renascimento', 'Passeio noturno sem sentinela', 'Alimentar o inimigo depois das 22h',
        'Pagar recompensa de abate em série', 'Fazer o atirador deles fechar item mais cedo', 'Renascer só pra cumprir tabela', 'Entregar o primeiro abate e os seguintes'],
      ['Art. 171: estelionato contra o próprio time', 'Lavagem de ouro na fonte deles', 'Desvio de verba para o caixa do adversário',
        'Contribuição para o enriquecimento ilícito do atirador deles', 'Abandono do próprio corpo em via pública', 'Resistência à prisão… sem resistir',
        'Pagamento de recompensa com dinheiro do time', 'Patrocínio ao power spike do inimigo'],
      ['Tráfico internacional de ouro pela fronteira do rio', 'Remessa ilegal de ouro ao exterior (lado deles)', 'Financiamento de facção inimiga',
        'Contrabando de recompensas pelo covil do Barão'],
      ['Entrega sistemática de ouro ao inimigo em tempo de guerra', 'Sabotagem da economia do próprio povo', 'Colaboracionismo com a força de ocupação'],
      ['Genocídio econômico do próprio time', 'Colapso financeiro de proporções históricas'],
    ],
    sozinho: [
      ['Andar sozinho em área de risco', 'Turismo na selva inimiga sem visto', 'Fazer trilha solo no rio sem sentinela',
        'Ignorar a placa de “área sem visão”', 'Explorar a selva deles sem lanterna', 'Andar no rio como se tivesse Anjo Guardião',
        'Fazer push lateral com o caçador deles sumido', 'Checar arbusto com o próprio rosto', 'Ir buscar a wave sozinho no minuto errado'],
      ['Exposição voluntária ao perigo', 'Vadiagem em área de risco', 'Invasão de propriedade alheia sem mandado', 'Facilitação de sequestro (da própria pessoa)'],
      ['Imigração clandestina para a selva deles', 'Missão solo sem autorização do comando', 'Entrada ilegal em território estrangeiro'],
      ['Expor-se como alvo civil em zona de conflito', 'Abandono de pelotão em território hostil'],
      ['Rendição solo em série', 'Entregar-se ao inimigo repetidas vezes'],
    ],
    objetivos: [
      ['Assistir ao dragão morrer da tela cinza', 'Deixar o Barão sem segurança', 'Dar ao inimigo a chave da torre', 'Guardar a base dormindo',
        'Ver a Arauta passear de longe', 'Deixar o dragão sair de graça', 'Recall bem na hora do objetivo', 'Chegar no Barão quando o Barão já era deles'],
      ['Omissão na defesa do patrimônio público', 'Dano ao patrimônio por ausência', 'Negligência com a Alma do Dragão alheia', 'Furto de torre assistido sem reação'],
      ['Entrega de instalações militares ao inimigo', 'Facilitação de saque internacional (Barão incluso)', 'Venda de dragões ancestrais ao exterior'],
      ['Destruição do patrimônio cultural da humanidade (o Nexus)', 'Rendição da capital sem resistência'],
      ['Entregar a Alma, o Barão e o Nexus na mesma tarde', 'Assistir à queda do Nexus e chamar de destino'],
    ],
    rota: [
      ['Abandono de rota', 'Perda culposa de lane', 'Ceder placas de torre sem pedir recibo', 'Deixar a tropa inimiga pastar em paz',
        'Ser dominado em duelo ao meio-dia', 'Furto de último golpe (sofrido)', 'Perder a wave pra torre', 'Ficar com metade do farm do rival',
        'Tomar o first blood e a rota junto'],
      ['Estelionato na fase de rotas', 'Dano ao patrimônio: placas entregues intactas', 'Abandono de posto de trabalho na rota',
        'Lesão corporal sofrida por insistência na lane'],
      ['Entrega de território soberano ao inimigo', 'Cessão ilegal de fronteira (rota inteira)', 'Contrabando de experiência para o país vizinho'],
      ['Rendição incondicional da rota', 'Capitulação vergonhosa na linha de frente'],
      ['Anexação da própria rota pelo inimigo'],
    ],
    abriu: [
      ['Começar briga que não podia ganhar', 'Engage solo sem avisar ninguém', 'Puxar a luta errada na hora errada', 'Chamar pro X1 e perder no X5', 'Entrar de Flash sem ninguém atrás', 'Iniciar a luta com o time ainda na base'],
      ['Incitação à violência (contra o próprio time)', 'Início de tumulto em via pública', 'Provocação seguida de fuga… sem fuga'],
      ['Início de conflito internacional sem consultar os aliados', 'Declaração de guerra unilateral'],
      ['Provocar a guerra que destruiu o próprio povo'],
      ['Acender o pavio do apocalipse'],
    ],
    ausente: [
      ['Ausência em luta coletiva', 'Presença só em espírito', 'Chegar depois do tiroteio pra contar história', 'Farmar enquanto a base pegava fogo',
        'Assistir à luta da janela', 'Chegar com o Teleporte quando já era tela de derrota', 'Ficar no lado oposto do mapa em toda luta'],
      ['Omissão de socorro em luta coletiva', 'Abandono de incapaz (o suporte)', 'Deserção em plena luta do time', 'Prevaricação: tinha Teleporte e não veio'],
      ['Não comparecer à convocação da coalizão', 'Fuga de zona de conflito com o farm debaixo do braço'],
      ['Deserção em tempo de guerra', 'Abandono dos aliados em pleno massacre'],
      ['Ausência no dia do juízo final'],
    ],
    visao: [
      ['Cegueira dolosa', 'Sonegação de sentinelas', 'Jogar o mapa no escuro', 'Guardar sentinela pra ocasião especial que nunca veio', 'Andar com o trinket sem usar', 'Deixar o rio inteiro no escuro'],
      ['Sonegação fiscal de Sentinelas de Controle', 'Ocultação de informação ao time', 'Apagão criminoso do mapa'],
      ['Blecaute internacional de inteligência', 'Espionagem a serviço do inimigo (deixou eles enxergarem tudo)'],
      ['Deixar o próprio povo às cegas durante a guerra'],
      ['Escuridão total imposta ao próprio povo'],
    ],
    ult: [
      ['Porte de ultimate sem uso', 'Esquecer que tinha o R', 'Ult guardada pra ocasião especial', 'Ultimate de enfeite'],
      ['Posse de arma pesada sem uso em legítima defesa', 'Omissão de ultimate em situação de perigo'],
      ['Guardar arma estratégica enquanto os aliados caíam'],
      ['Arsenal intacto no fim da guerra perdida'],
      ['Morreu com a bomba atômica no bolso'],
    ],
  };

  // Crimes que dependem de um número concreto da partida. Cada um traz a prova.
  const minutos = (p) => Math.round(p.duracao / 60);
  const GATILHOS = [
    { repete: 'mortes', teste: (j) => j.deaths >= 10, prova: (j) => `${j.deaths} mortes na partida`, frases: [
      ['Recordista de visitas à fonte', 'Assinante premium da tela cinza', 'Colecionador de mortes', 'Conhecer a tela de renascimento de cor'],
      ['Reincidência específica (10 mortes ou mais)', 'Vício em tela cinza'],
      ['Turismo mortuário internacional'], ['Morte em escala industrial'], ['Extermínio de si mesmo em série']] },
    { teste: (j) => j.kills === 0 && j.deaths >= 5, prova: (j) => `0 abates e ${j.deaths} mortes`, frases: [
      ['Pacifismo radical', 'Atirar só pro alto', 'Jogar a partida inteira sem tirar uma vida'], ['Porte de arma sem uso'], ['Missão de paz em plena guerra'],
      ['Pacifismo armado durante o massacre'], ['Zero baixas inimigas em guerra total']] },
    { teste: (j) => j.kills >= 10, prova: (j) => `${j.kills} abates e derrota mesmo assim`, frases: [
      ['Juntar abate e esquecer o objetivo', 'Caçar abate enquanto o Nexus caía'], ['Abuso de poder (10 abates e derrota)'], ['Mercenário sem causa'],
      ['Massacre sem propósito militar'], ['Matou muito e mesmo assim perdeu a guerra']] },
    { teste: (j, p) => j.teamPosition !== 'UTILITY' && minutos(p) >= 20 && (j.detectorWardsPlaced || 0) === 0, prova: () => 'nenhuma Sentinela de Controle',
      frases: [['Pão-duro da visão', 'Economizar 75 de ouro na sentinela'], ['Sonegação de Sentinela de Controle'], ['Embargo de visão ao próprio país'],
        ['Deixar o povo no escuro para guardar moedas'], ['Apagão total sob sua responsabilidade']] },
    { teste: (j, p) => j.teamPosition === 'UTILITY' && minutos(p) >= 20 && (j.wardsPlaced || 0) < minutos(p) * 0.6,
      prova: (j) => `${j.wardsPlaced || 0} sentinelas jogando de suporte`, frases: [
        ['Suporte sem lampião', 'Esquecer as sentinelas na base'], ['Falsidade ideológica: se dizia suporte'],
        ['Espionagem às avessas: deixou o mapa pro inimigo'], ['Deixar o povo no escuro em plena guerra'], ['Apagão total sob sua responsabilidade']] },
    { teste: (j) => ((j.pings || {}).enemyMissing || 0) >= 10, prova: (j) => `${j.pings.enemyMissing} pings de “?”`, frases: [
      ['Spam de “?” sem justa causa', 'Interrogatório ilegal do próprio time'], ['Perturbação do sossego por ping', 'Injúria por ponto de interrogação'],
      ['Guerra psicológica contra os aliados'], ['Tortura psicológica do próprio time'], ['Terrorismo de ping']] },
    { teste: (j, p) => (j.totalTimeSpentDead || 0) >= p.duracao * 0.2, prova: (j, p) => `${Math.round(100 * j.totalTimeSpentDead / p.duracao)}% da partida morto`,
      frases: [['Morador fixo da tela cinza'], ['Ausência por óbito reincidente'], ['Exílio voluntário na fonte'], ['Desaparecido em combate na maior parte da guerra'],
        ['Passou a guerra no além']] },
    { teste: (j, p) => p.duracao >= 40 * 60, prova: (j, p) => `jogo de ${minutos(p)} min`, frases: [
      ['Prolongar o sofrimento'], ['Cárcere privado do time por 40 minutos'], ['Guerra prolongada sem objetivo'],
      ['Guerra de atrito contra o próprio povo'], ['Fazer o apocalipse durar uma hora']] },
    { teste: (j, p) => p.duracao <= 24 * 60, prova: (j, p) => `derrota em ${minutos(p)} min`, frases: [
      ['Rendição antes do almoço'], ['Rendição precoce do time'], ['Capitulação relâmpago'], ['Derrota relâmpago da nação'], ['Extinção em tempo recorde']] },
  ];

  // quando falta frase: crimes genéricos do nível
  const CRIMES_DO_NIVEL = [
    ['Roubar o abate do atirador', 'Porte ilegal de Poção Reutilizável', 'Ping sem justa causa', 'Recall no meio da luta', 'Dar Flash na parede',
      'Atrapalhar o trânsito de tropas', 'Comprar sentinela e não colocar', 'Roubar o buff do caçador'],
    ['Perturbação do sossego no chat', 'Desacato ao caçador', 'Injúria contra o próprio suporte', 'Ameaça (de render aos 15)', 'Dano moral ao Poro', 'Estelionato no mute'],
    ['Formação de quadrilha com o atirador inimigo', 'Fuga internacional pelo rio', 'Pirataria de dragões em águas internacionais', 'Lavagem de ouro em paraíso fiscal'],
    ['Crime de guerra contra o próprio Nexus', 'Violação da Convenção de Genebra do Barão', 'Terrorismo contra o próprio PDL', 'Uso de tropas como escudo humano'],
    ['Extermínio do próprio PDL', 'Crimes contra a humanidade e contra o Nexus', 'Destruição em massa da paz do grupo'],
  ];

  const ALCUNHAS = ['O Patrocinador', 'Mão de Alface', 'O Fantasma da Rota', 'Doador Universal', 'O Turista', 'Rei do Feed', 'Flash na Parede',
    'O Cego do Rio', 'Banco Central do Inimigo', 'O Desaparecido', 'Tela Cinza', 'Caixa Eletrônico', 'Garçom do Inimigo', 
    'Mão Furada', 'O Sem-Sentinela', 'Ministro da Fazenda (deles)', 'Delivery de Ouro', 'Fiel da Fonte', 'Capitão Tela Cinza',
    'O Pacifista', 'Freguês do Barão', 'Professor de Feed', 'O Fiador', 'Pinga-Interrogação', 'Recall Eterno', 'O Poro Perdido', 'Sem Bota', 'Flash em Recarga', 'O Arbusto Errado', 'Wave Perdida', 'Ignite Desperdiçado', 'O Que Vai Sozinho', 'Trinket Intacto'];
  const PARADEIROS = ['visto pela última vez na selva deles, sem sentinela', 'avistado farmando enquanto o Nexus caía', 'localizado na fonte, esperando renascer',
    'flagrado no rio sem visão e sem plano', 'escondido atrás da torre interna com o Teleporte em recarga', 'avistado no Barão… do lado errado',
    'visto correndo de volta pra base sem Flash', 'encontrado na loja comprando poção', 'avistado na rota errada de novo',
    'visto pela última vez saindo da tela cinza', 'localizado em lugar incerto e não sabido (sem sentinela)', 'visto pela última vez pingando “?” e indo pro outro lado'];
  const RECOMPENSAS_LEVES = ['2 Poções de Vida e um abraço', 'uma Sentinela Invisível que ninguém colocou', 'um Lâmina de Doran amassado', 'uma bota sem velocidade',
    'meia Poção Reutilizável', 'um Biscoito da Vontade Total já mordido', 'um Elixir vencido', 'um Teleporte só de ida'];
  const PENAS = ['banimento perpétuo do atirador', 'jogar de suporte por 30 dias, sem direito a farm', 'comprar todas as Sentinelas de Controle até o fim da temporada',
    'assistir ao próprio replay em câmera lenta', 'jogar de Yuumi com o atirador mais tóxico do grupo', 'pedir desculpa no chat de voz antes de cada fila',
    'mutar o próprio ping até subir de elo', 'participar de todas as lutas, inclusive as perdidas', 'proibição de dar Flash por 10 partidas',
    'carregar o Poro no colo por 10 partidas', 'assistir a 10 partidas de pro player tomando nota'];
  const ESCRIVAES = ['Escrivã Caitlyn', 'Delegada Vi', 'Investigador Jayce', 'Delegado Garen', 'Escrivão Galio', 'Perita Camille', 'Investigador Lucian',
    'Escrivã Lux', 'Delegado Braum', 'Investigadora Ashe'];
  const FECHOS = ['Nada mais havendo, encerra-se o presente.', 'O autor alegou lag. Não foi encontrado lag.', 'O autor alegou que “o caçador não ajudou”. O caçador nega.',
    'O autor não quis se manifestar e entrou na fila de novo.', 'Lavrado o presente, segue para as providências cabíveis na próxima fila.',
    'Foi orientado a não se aproximar do atirador.'];
  const ALERTAS = ['⚠ Considerado perigoso para o próprio time. Se avistado, não passe o farm e avise o caçador.',
    '⚠ Não confiar em pings deste indivíduo. Pode estar indo para o lado errado.', '⚠ Se avistado no rio sem sentinela, não siga. Ele vai morrer e levar você junto.',
    '⚠ Se oferecer “bora de Barão”, recuse e acione as autoridades.', '⚠ Costuma agir de madrugada, sozinho, na selva inimiga.'];
  const DECISOES = ['A Câmara decide, por unanimidade, expedir o presente mandado.', 'A Câmara, após ver o replay três vezes, expede o presente mandado.',
    'Por unanimidade e com um minuto de silêncio pelo Nexus, expede-se o mandado.', 'A defesa pediu clemência alegando lag. Pedido negado. Expeça-se o mandado.'];
  const FAIXAS = ['Vivo ou na tela cinza', 'Vivo ou morto (de preferência morto)', 'Vivo, morto ou na fonte', 'Vivo ou sem Flash', 'Vivo ou de Yuumi'];
  const RODAPES = ['Perigoso e sempre sem sentinela', 'Armado e sem Teleporte', 'Atira primeiro e morre depois', 'Não negocia, não recua, não ganha',
    'Anda sozinho e não ouve ping', 'Procurado em todos os servidores do Brasil'];

  function frasesDoNivel(tabela, nivel, usadas) {
    for (let n = nivel; n >= 0; n--) {
      const xs = (tabela[n] || []).filter((x) => !usadas.has(x));
      if (xs.length) return xs;
    }
    return [];
  }

  function acusacoes(v, nivel, rnd, partida) {
    const usadas = new Set();
    const pegar = (tabela) => {
      const xs = frasesDoNivel(tabela, nivel, usadas);
      const x = xs.length ? rnd.um(xs) : null;
      if (x) usadas.add(x);
      return x;
    };
    const base = (v.pesou && v.pesou.length ? v.pesou : v.componentes.filter((c) => c.pontos > 0).slice(0, 2));
    const pesou = base.filter((c) => CRIMES[c.key]).map((c) => ({ crime: pegar(CRIMES[c.key]), evidencia: c.evidencia }));
    const chaves = new Set(base.map((c) => c.key));
    // o número de mortes já aparece na prova do componente "mortes": não repete
    const possiveis = GATILHOS.filter((g) => !(g.repete && chaves.has(g.repete))).filter((g) => { try { return g.teste(v.jogador, partida); } catch (e) { return false; } });
    const provados = [];
    for (let i = 0, n = nivel >= 3 ? 2 : 1; i < n && possiveis.length; i++) {
      const [g] = possiveis.splice(rnd.num(0, possiveis.length - 1), 1);
      const crime = pegar(g.frases);
      if (crime) provados.push({ crime, evidencia: g.prova(v.jogador, partida) });
    }
    const max = nivel >= 2 ? 4 : 3;
    const lista = [...pesou.slice(0, 2), ...provados, ...pesou.slice(2)];
    if (lista.length < 3 || (nivel >= 3 && lista.length < max)) lista.push({ crime: pegar(CRIMES_DO_NIVEL) || rnd.um(CRIMES_DO_NIVEL[0]), evidencia: null });
    return lista.slice(0, max);
  }

  // Tudo o que o papel precisa para o culpado da partida
  function documento(v, partida) {
    const nivel = gravidade(v);
    const j = v.jogador;
    const rnd = sorteador(`${partida.id}-${j.id}`);
    // metade dos casos mais leves vira o Procura-se do faroeste, a outra metade o B.O.
    const papel = nivel === 0 && sorteador(`papel-${partida.id}`).num(0, 1) ? 'bo' : PAPEIS[nivel];
    const entregue = (v.mortes || []).reduce((s, m) => s + (m.recompensa || 0), 0);
    return {
      nivel, papel, crime: NIVEIS[nivel], raridade: RARIDADES[nivel][0], cor: RARIDADES[nivel][1],
      acusacoes: acusacoes(v, nivel, rnd, partida).map((a) => ({ ...a, artigo: rnd.num(121, 359) })),
      alcunha: rnd.um(ALCUNHAS), paradeiro: rnd.um(PARADEIROS), pena: rnd.um(PENAS),
      escrivao: rnd.um(ESCRIVAES), fecho: rnd.um(FECHOS), alerta: rnd.um(ALERTAS), decisao: rnd.um(DECISOES),
      faixa: rnd.um(FAIXAS), rodape: rnd.um(RODAPES),
      entregue, recompensa: entregue > 0 ? null : rnd.um(RECOMPENSAS_LEVES),
      numero: `${String(partida.id).split('_').pop()}/${new Date(partida.inicio * 1000).getFullYear()}`,
    };
  }

  const api = { gravidade, documento, acusacoes, sorteador, NIVEIS, RARIDADES, CRIMES, GATILHOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.CulpaLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
