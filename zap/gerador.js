// Gerador da conversa do zap da vitória. Função pura: (partida, semente, cenárioForçado?) -> roteiro.
// Sorteia o CENÁRIO (ao vivo / resenha com enquete / guerra de figurinha) e, dentro dele, quais lances entram,
// quem fala, qual fio de resenha, quais figurinhas e gírias. Mesma semente = mesma conversa.
(function (root) {
const CURTO = { 'Phantom Assassin': 'PA', 'Crystal Maiden': 'CM', 'Spirit Breaker': 'SB', 'Earth Spirit': 'ES', 'Outworld Devourer': 'OD', 'Treant Protector': 'Treant', 'Lone Druid': 'LD', 'Skywrath Mage': 'Sky', 'Witch Doctor': 'WD', "Nature's Prophet": 'Prophet', 'Faceless Void': 'Void', 'Templar Assassin': 'TA', 'Shadow Fiend': 'SF', 'Anti-Mage': 'Magina', 'Queen of Pain': 'QoP', 'Vengeful Spirit': 'Venge', 'Phantom Lancer': 'PL', 'Shadow Shaman': 'Rhasta', 'Ember Spirit': 'Ember', 'Storm Spirit': 'Storm', 'Dragon Knight': 'DK', 'Wraith King': 'WK', 'Monkey King': 'MK', 'Troll Warlord': 'Troll', 'Keeper of the Light': 'KotL', 'Ancient Apparition': 'AA', 'Night Stalker': 'NS', 'Bounty Hunter': 'BH', 'Centaur Warrunner': 'Centauro', 'Legion Commander': 'Legion', 'Lifestealer': 'Naix', 'Magnus': 'Magnus', 'Tidehunter': 'Tide', 'Juggernaut': 'Jugg', 'Bristleback': 'Bristle', 'Clockwerk': 'Clock', 'Timbersaw': 'Timber', 'Silencer': 'Silencer', 'Ring Master': 'Ringmaster' };
const CORES = ['#53bdeb', '#e26ab6', '#fc9775', '#a5b337', '#ffd279', '#06cf9c', '#c4a5ff'];
const ITEM_EMO = { 'Battle Fury': '🪓', 'Radiance': '☀️', 'Aghanim': '🔮', 'Blink': '⚡', 'BKB': '🛡️', 'Midas': '🪙' };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function gerar(M, semente, forcar, evitar) {
  // evitar: Set opcional com as chaves (JSON da frase / 'fig:...') que saíram nas últimas conversas; foge delas enquanto der
  const r = rng(semente);
  const usados = new Set();
  // sorteia sem repetir o que já saiu nesta conversa (enquanto houver opção nova)
  const ev0 = evitar instanceof Set ? evitar : new Set();
  const fresco = (k) => !usados.has(k) && !ev0.has(k);
  const um = (a) => { const ks = a.map((x) => JSON.stringify(x)); let ids = a.map((_, i) => i).filter((i) => fresco(ks[i])); if (!ids.length) ids = a.map((_, i) => i).filter((i) => !usados.has(ks[i])); if (!ids.length) ids = a.map((_, i) => i); const i = ids[Math.floor(r() * ids.length)]; const x = a[i]; if (typeof x !== 'object' || Array.isArray(x)) usados.add(ks[i]); return x; };
  const chance = (p) => r() < p;
  const embaralhar = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const V = (typeof VOCABULARIO !== 'undefined' && VOCABULARIO) || null;

  // ---------- elenco ----------
  const nos = M.nos.map((n, i) => ({ ...n, key: 'n' + i, i, nome: !n.amigo ? `${CURTO[n.heroiNome] || n.heroiNome} random` : n.nome === 'charlinho' ? 'Charlinho' : n.nome }));
  const amigos = nos.filter((n) => n.amigo);
  const P = {};
  nos.forEach((n, i) => { P[n.key] = { nome: n.nome, heroi: n.heroi, cor: CORES[i % CORES.length] }; });
  const craque = nos[M.craque];
  const craqueAmigo = craque.amigo;
  const resto = amigos.filter((n) => n !== craque);
  const mochila = resto.slice().sort((a, b) => a.merito - b.merito)[0] || null;
  const morredor = resto.slice().sort((a, b) => b.d - a.d)[0] || null;
  const suporte = resto.slice().sort((a, b) => b.wards - a.wards)[0] || null;
  const curto = (h) => CURTO[h] || h;
  const heroiDeles = (i) => M.eles[i].heroiNome;
  const qualquer = (...fora) => { const c = amigos.filter((n) => !fora.includes(n)); return c.length ? um(c) : null; };
  const nomeQ = (q) => (q[0] === 'n' ? nos[q[1]].nome : `o ${curto(heroiDeles(q[1]))} deles`);
  const fimS = M.inicio + M.dur;
  const relogio = (unix) => new Date(unix * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const dia = new Date(M.inicio * 1000).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });

  // ---------- bancos de fala (jeito do grupo) ----------
  const RISO = ['kkkkkkk', 'KKKKKKKKKK', 'kkkkkkkkkkkkk', 'mkkkkkkk', 'hsuahsuahsua', 'hahahahahah', 'shaushuashuas', 'kkkk', 'KKKKKKKKKKKKKKKKK', 'kkkkkkkkk socorro', 'rachei', 'chorando aqui', 'me mijei', 'kkkkkkk não aguento', 'AKSJDHAKSJDH', 'rsrsrs', 'kkkkk morri', 'tô passando mal kkkk', 'KKKKKKK PARA', 'eu ri alto aqui'];
  const UAU = ['slc', 'oloco', 'pqp', 'carai', 'Forte', 'oh man', 'oh my', 'absurdo', 'mt real', 'Nise', 'Ma brotha', 'Celoko', 'Auuu', 'vsf', 'brabo', 'puta que pariu', 'caralho mano', 'que isso', 'tá maluco', 'meu deus do céu', 'vai se foder kkkk', 'mds', 'ai sim', 'sinistro', 'monstro', 'cruzes', 'jesus amado', 'nossa senhora', 'é o bicho', 'covardia', 'apelação', 'ridículo', 'desumano', 'pai amado'];
  const EGO = ['izi', 'izi wiiin', 'o pai tá on', 'sigam o pai', 'quem sabe faz ao vivo', 'tá no papo', 'podem relaxar', 'nem suei', 'tô voando hj', 'hj não erro', 'deixa comigo', 'é só me dar espaço', 'tá fácil demais', 'aprende aí', 'anota aí', 'pode bater palma', 'vcs não tão prontos', 'mão quente', 'joga muito esse menino', 'hj é dia', 'é o meu jeito', 'tô no modo pro', 'chupa', 'segura essa'];
  const ZOA = ['saco de batata', 'cry more', 'newba', 'tapete', 'eterno arconte', 'fider', 'arcontinho', 'hero batata', 'batendo ponto na fonte', 'turismo na fonte', 'cone de trânsito', 'enfeite de mapa', 'creep com nick', 'peso morto', 'boneco de treino', 'figurante', 'saco de pancada', 'decoração da fonte', 'mascote do time deles', 'patrocinador oficial deles', 'sócio torcedor do respawn', 'cliente vip da fonte', 'estagiário do time', 'carta fora do baralho'];
  const DEFESA = ['eu tava abrindo espaço', 'foi o lag', 'tava sem item', 'tava comprando ward', 'o jogo me odeia', 'sem stress', 'eu sou o mais importante do time', 'tava dando visão', 'foi proposital, isca', 'vai tomar no cu', 'vsf', 'cala a boca', 'me erra', 'vai se foder', 'chupa meu ovo', 'o problema é o teclado', 'meu mouse tá zoado', 'minha mãe me chamou', 'tava no banheiro', 'o cachorro pisou no teclado', 'foi a internet da vivo', 'vai pra puta que pariu', 'enfia no cu', 'vc nem tava lá', 'fica quieto', 'ninguém te perguntou', 'segura teu choro', 'eu tava testando uma build', 'era o plano desde o começo', 'tava segurando a lane', 'quero ver vc fazer melhor', 'cuida da tua vida', 'nem fudendo que foi culpa minha', 'tava de olho no mapa', 'tô com sono', 'vou dormir já', 'tava ajudando o time de longe', 'deixa eu em paz', 'que inveja hein'];
  // resposta a uma defesa: as genéricas servem pra qualquer desculpa; RESPOSTA casa com a desculpa específica
  const FECHO = ['abrindo espaço no cemitério', 'sem item e sem vergonha', 'visão do cinza', 'olha quem fala, o patrocinador', 'chora no travesseiro', 'resposta de quem morreu muito', 'fala isso pro respawn', 'aceita que dói menos', 'cala a boca tu, morto', 'tá bom, tá bom', 'aham, senta lá', 'conta outra', 'mentira tem perna curta e tela cinza', 'falou o cadáver', 'nem tu acredita nisso', 'anotado, próxima', 'o replay discorda', 'chorou'];
  const RESPOSTA = {
    'eu tava abrindo espaço': ['abrindo espaço no cemitério', 'abriu espaço pro inimigo farmar'],
    'foi o lag': ['lag de caráter', 'o lag só acontece contigo né', 'engraçado, o meu ping tá 30'],
    'tava sem item': ['e vai continuar sem item morrendo assim', 'sem item e sem vergonha'],
    'tava comprando ward': ['comprando ward morto?', 'a ward tá no teu inventário até agora'],
    'o jogo me odeia': ['o jogo não, o time deles te ama', 'o jogo te odeia e o inimigo te agradece'],
    'tava dando visão': ['visão do cinza', 'visão pro time deles'],
    'foi proposital, isca': ['isca sem ninguém pra pescar', 'isca de quê, se ninguém foi'],
    'vai tomar no cu': ['tomar no cu é o teu KDA', 'vai tu, que tá cinza'],
    'vsf': ['vsf tu', 'perdeu a discussão e a lane'],
    'cala a boca': ['calo quando tu parar de morrer', 'cala a boca tu, morto'],
    'me erra': ['quem não erra é o time deles em ti', 'te errar é impossível, tu tá parado'],
    'vai se foder': ['nossa, nervosinho', 'eu vou, mas vivo'],
    'chupa meu ovo': ['chupa a tela cinza', 'ovo de quem, de creep?'],
    'o problema é o teclado': ['o teclado tá ótimo, quem tá zoado é tu', 'troca o jogador, não o teclado'],
    'meu mouse tá zoado': ['o mouse tá bom, o problema tá entre a cadeira e o teclado', 'clica no botão de não morrer'],
    'minha mãe me chamou': ['tua mãe joga melhor', 'manda ela no teu lugar então'],
    'tava no banheiro': ['banheiro de 40 segundos de respawn', 'ficou lá o jogo todo então'],
    'o cachorro pisou no teclado': ['cachorro joga melhor', 'deixa o cachorro jogar a próxima'],
    'foi a internet da vivo': ['a vivo pede desculpa', 'a vivo não tem culpa de tu ir sozinho'],
    'vai pra puta que pariu': ['nossa, que agressivo', 'tá nervoso pq morreu'],
    'enfia no cu': ['enfia tu, que tá na fonte', 'grosso'],
    'vc nem tava lá': ['eu tava vivo, já é mais que tu', 'tava vendo tu morrer de camarote'],
    'fica quieto': ['quieto tu ficou no respawn', 'fico, mas o replay fala'],
    'ninguém te perguntou': ['ninguém perguntou mas a tela cinza respondeu', 'o placar perguntou'],
    'segura teu choro': ['quem tá chorando é tu', 'segura tua vida primeiro'],
    'eu tava testando uma build': ['a build do caixão', 'teste reprovado'],
    'era o plano desde o começo': ['o plano era morrer?', 'plano do time deles então'],
    'tava segurando a lane': ['segurou a lane deitado', 'a lane te segurou'],
    'quero ver vc fazer melhor': ['fiz, olha meu KDA', 'faço melhor dormindo'],
    'cuida da tua vida': ['cuida da tua, que tu perdeu várias', 'a minha tá cheia, obrigado'],
    'nem fudendo que foi culpa minha': ['o site discorda', 'foi sim kkkk'],
    'tava de olho no mapa': ['de olho no mapa e de costas pro inimigo', 'olha o minimapa da fonte'],
    'tô com sono': ['dormiu no jogo inteiro', 'vai dormir que é melhor pro time'],
    'vou dormir já': ['dormir é o que tu fez o jogo inteiro', 'boa noite, descansa da fonte'],
    'tava ajudando o time de longe': ['de longe mesmo, lá da fonte', 'ajuda de longe é torcida'],
    'deixa eu em paz': ['descansa em paz mesmo, tu morreu muito', 'em paz tu ficou no respawn'],
    'que inveja hein': ['a inveja é de quem, de cadáver?', 'inveja do teu respawn? nunca'],
  };
  const fecharDefesa = (d) => um([...(RESPOSTA[d] || []), ...(RESPOSTA[d] ? [] : FECHO)]);
  const matar = (x) => (V ? V.matar(x) : [`matou ${x}`]);
  // ---------- fábrica de figurinhas: memes montados com o retrato do herói + número da partida ----------
  // intenção -> quem manda e sobre quem. Nada de legenda solta: toda figurinha diz algo da partida.
  const pctS = (n) => `${String(n.merito).replace('.', ',')}%`;
  const kdaS = (n) => `${n.k}/${n.d}/${n.a}`;
  const H1 = (n) => curto(n.heroiNome).toUpperCase();
  const fregues = (() => { const c = {}; M.abates.forEach((a) => { if (a.de[0] === 'n' && a.vit[0] === 'e' && nos[a.de[1]].amigo) { const k = a.de[1] + '-' + a.vit[1]; c[k] = (c[k] || 0) + 1; } }); const [k, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] || []; if (!k || n < 3) return null; const [q, e] = k.split('-').map(Number); return { q: nos[q], e: M.eles[e], n }; })();
  const itemTop = (craque.itens || []).find(([m, it]) => m <= 22 && ['Battle Fury', 'Radiance', 'Midas', 'Aghanim', 'Desolator', 'Maelstrom', 'Manta', 'BKB'].includes(it));
  function fig(intencao, alvo, de) {
    const op = [];
    const meme = (img, cima, baixo, peso = 1) => op.push({ p: peso, f: { tpl: 'meme', img, cima, baixo } });
    if (intencao === 'ego' && craqueAmigo) {
      meme(craque.heroi, 'NEM SUEI', kdaS(craque));
      meme(craque.heroi, 'O PAI', `${pctS(craque)} DO MÉRITO`);
      meme(craque.heroi, 'SIGAM O PAI', `${craque.gpm} DE GPM`);
      if (itemTop) meme(craque.heroi, `${itemTop[1].toUpperCase()} COM ${itemTop[0]} MIN`, 'PODEM RELAXAR', 1.3);
      if (craque.torre > 8000) meme(craque.heroi, 'DERRUBEI A BASE', `${(craque.torre / 1000).toFixed(0)} MIL EM TORRE`);
      meme(craque.heroi, 'CHUPA', `${kdaS(craque)} E ${pctS(craque)}`, 0.8);
      meme(craque.heroi, 'PODE APLAUDIR', `${craque.k} ABATES`, 0.9);
      meme(craque.heroi, 'É O PAI', `${(craque.dano / 1000).toFixed(0)} MIL DE DANO`, 0.9);
      meme(craque.heroi, 'APRENDE AÍ', `${pctS(craque)} DO MÉRITO`, 0.8);
      meme(craque.heroi, 'O JUIZ DECIDIU', `CRAQUE · ${pctS(craque)}`, 0.8);
      op.push({ p: 1, f: { tpl: 'func', img: craque.heroi, nome: craque.nome, txt: `${pctS(craque)} do mérito · ${kdaS(craque)}`, titulo: 'Funcionário do mês' } });
      op.push({ p: 0.9, f: { tpl: 'duo', img: craque.heroi, la: 'o time', lb: `eu: ${pctS(craque)}` } });
      if (craque.d <= 2) meme(craque.heroi, `${craque.d === 0 ? 'ZERO' : craque.d} MORTE${craque.d === 1 ? '' : 'S'}`, 'INTOCÁVEL', 1.3);
      if (resto.length >= 2) op.push({ p: 1.6, f: { tpl: 'carrega', img: craque.heroi, imgs: resto.map((n) => n.heroi), cima: `O PAI E OS ${resto.length + (nos.length - amigos.length)} MOCHILAS` } });
    }
    if (intencao === 'exalta') {
      // quem elogia puxa o mérito pra si pelo papel que teve: a figurinha é o herói DELE, com o craque de "filho"
      const filho = craqueAmigo ? H1(craque) : `${H1(craque)} RANDOM`;
      if (de && de !== craque && (de.pos >= 4 || de.wards >= 8)) {
        op.push({ p: 1.6, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'EU QUE CRIEI', baixo: `${de.wards} WARDS PRO MEU FILHO` } });
        op.push({ p: 1.3, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'RESPEITA MEU FILHO', baixo: `${de.a} ASSISTÊNCIAS PRA ELE` } });
        op.push({ p: 1, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'POR TRÁS DE UM GRANDE ' + filho, baixo: 'TEM UM SUPORTE' } });
        op.push({ p: 1, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'PAI DE CARRY', baixo: 'ORGULHOSO' } });
        op.push({ p: 0.9, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'CRIEI, ALIMENTEI', baixo: 'AGORA ELE CARREGA' } });
        op.push({ p: 0.9, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'O CRAQUE É ELE', baixo: 'A BABÁ SOU EU' } });
      } else if (de && de !== craque) {
        op.push({ p: 1.3, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'O ESPAÇO FUI EU', baixo: `${de.k} ABATES MEUS TAMBÉM` } });
        op.push({ p: 1, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: `SEM MIM O ${filho}`, baixo: 'NÃO FARMAVA' } });
        op.push({ p: 0.9, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'DIVIDE O MÉRITO', baixo: `${de.a} ASSISTÊNCIAS AQUI` } });
        op.push({ p: 0.8, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'ELE SÓ BRILHOU', baixo: 'PQ EU SEGUREI' } });
      }
      if (!craqueAmigo) { op.push({ p: 1.5, f: { tpl: 'func', img: craque.heroi, nome: `${curto(craque.heroiNome)} random`, txt: `${pctS(craque)} do mérito · ${kdaS(craque)}` } }); meme(craque.heroi, 'NEM É DO GRUPO', 'E CARREGOU', 1.5); }
    }
    if (intencao === 'zoa' && alvo) {
      const m = alvo;
      meme(m.heroi, 'CRY MORE', kdaS(m), 1.4);
      if (m.d >= 6) meme(m.heroi, 'ABRINDO ESPAÇO', `NO CEMITÉRIO · ${m.d}x`, 1.2);
      if (m.d >= 6) meme(m.heroi, 'BATENDO PONTO', `NA FONTE · ${m.d}x`);
      if (m.d >= 6) op.push({ p: 1.5, f: { tpl: 'procurado', img: m.heroi, crime: 'por patrocinar o time deles', recompensa: `${m.d} mortes` } });
      op.push({ p: 1.3, f: { tpl: 'duo', img: m.heroi, la: 'expectativa', lb: `realidade: ${pctS(m)}` } });
      meme(m.heroi, `${pctS(m)} DO MÉRITO`, 'MAS VENCEU IGUAL');
      meme(m.heroi, 'PASSAGEIRO', `${pctS(m)} DO MÉRITO`, 1);
      meme(m.heroi, 'GANHOU DE CARONA', kdaS(m), 1);
      op.push({ p: 1, f: { tpl: 'duo', img: m.heroi, la: 'como eu me vejo', lb: `o site: ${pctS(m)}` } });
      op.push({ p: 1, f: { tpl: 'duo', img: m.heroi, la: 'eu no draft', lb: `eu no jogo: ${kdaS(m)}` } });
      if (m.d >= 6) op.push({ p: 1.2, f: { tpl: 'rip', img: m.heroi, txt: `aqui jaz ${m.nome}`, sub: `${m.d} vezes, ${m.d} enterros` } });
      if (m.d >= 6) meme(m.heroi, 'DOADOR UNIVERSAL', `${m.d} MORTES`, 1.2);
      if (m.d >= 6) op.push({ p: 1.1, f: { tpl: 'procurado', img: m.heroi, crime: 'por doação ilegal de ouro', recompensa: `${m.d} mortes` } });
      if (m.d >= 6) op.push({ p: 1, f: { tpl: 'func', img: m.heroi, nome: m.nome, txt: `${m.d} mortes de dedicação`, titulo: 'Funcionário do mês deles' } });
    }
    if (intencao === 'contra' && craqueAmigo) {
      if (craque.d >= 3) meme(craque.heroi, `E O ${H1(craque)}?`, `${craque.d} MORTES TAMBÉM`, 1.5);
      // farm é o trabalho do carry: só cobra farm de quem não é pos 1
      if (craque.pos >= 2 && craque.pos <= 3) meme(craque.heroi, 'FARMOU O MAPA TODO', `${craque.gpm} DE GPM, NÉ`, 1.2);
      if (craque.pos >= 4) meme(craque.heroi, 'SUPORTE COM ' + craque.gpm + ' DE GPM', 'ROUBOU MEU FARM', 1.5);
      if (itemTop && craque.pos === 1) meme(craque.heroi, `CARREGAR COM ${itemTop[1].toUpperCase()} AOS ${itemTop[0]}`, 'ATÉ EU', 1.2);
      if (de && de.a >= 15) op.push({ p: 1.2, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: `${de.a} ASSISTÊNCIAS MINHAS`, baixo: `E O MÉRITO É DO ${H1(craque)}` } });
      if (de && de.d >= 7) meme(de.heroi, 'EU MORRI', 'PRA ELE FARMAR EM PAZ', 1);
      if (de) meme(de.heroi, 'VAI TOMAR NO CU', `${H1(craque)} E SEUS ${pctS(craque)}`, 1);
      if (de) meme(de.heroi, 'O SITE É COMPRADO', `${pctS(craque)} PRO ${H1(craque)}?`, 0.9);
      if (de && craque.d >= 4) op.push({ p: 1, f: { tpl: 'duo', img: craque.heroi, la: 'o craque', lb: `${craque.d} mortes` } });
    }
    if (intencao === 'fregues' && fregues) {
      op.push({ p: 1.5, f: { tpl: 'rip', img: fregues.e.heroi, txt: `aqui jaz o ${curto(fregues.e.heroiNome)}`, sub: `${fregues.n}x pro ${fregues.q.nome}` } });
      meme(fregues.e.heroi, 'FREGUÊS', `${fregues.n}x PRO ${fregues.q.nome.toUpperCase()}`, 1.2);
      op.push({ p: 1, f: { tpl: 'duo', img: fregues.e.heroi, la: 'minuto 0', lb: `depois de ${fregues.n} mortes` } });
      op.push({ p: 1.1, f: { tpl: 'procurado', img: fregues.e.heroi, crime: `por fugir do ${fregues.q.nome} e não conseguir`, recompensa: `${fregues.n} abates` } });
      meme(fregues.e.heroi, 'CLIENTE FIEL', `${fregues.n}x NO ${fregues.q.nome.toUpperCase()}`, 1);
      meme(fregues.e.heroi, 'ALUGUEL PAGO', `${fregues.n} VEZES`, 0.9);
    }
    if (intencao === 'suporte' && alvo && alvo.wards >= 6) {
      meme(alvo.heroi, `${alvo.wards} WARDS`, 'E NINGUÉM AGRADECE', 1.3);
      op.push({ p: 1, f: { tpl: 'func', img: alvo.heroi, nome: alvo.nome, txt: `${alvo.wards} wards · ${alvo.a} assistências`, titulo: 'Herói invisível' } });
      meme(alvo.heroi, 'COMPREI WARD', 'PRA ELES BRILHAREM', 1);
      op.push({ p: 1, f: { tpl: 'duo', img: alvo.heroi, la: `${alvo.wards} wards`, lb: '0 obrigados' } });
      meme(alvo.heroi, 'SUPORTE NÃO CHORA', `SÓ PLANTA ${alvo.wards} WARDS`, 0.9);
    }
    if (!op.length) return null;
    const tot = op.reduce((a, o) => a + o.p, 0); let x = r() * tot;
    const kf = (o) => 'fig:' + o.f.tpl + (o.f.cima || o.f.la || o.f.crime || o.f.txt || '');
    const frescos = op.filter((o) => fresco(kf(o))); const novos = frescos.length ? frescos : op.filter((o) => !usados.has(kf(o)));
    const lista = novos.length ? novos : op; const tot2 = lista.reduce((a, o) => a + o.p, 0); x = r() * tot2;
    const o = lista.find((o) => (x -= o.p) < 0) || lista[0];
    usados.add(kf(o));
    return o.f;
  }
  const figEv = (de, intencao, alvo, extra = {}) => { if (!de) return null; const f = fig(intencao, alvo, de); return f ? { t: 'stk', de: de.key, ...f, id: 'f' + Math.floor(r() * 1e9), ...extra } : null; };

  const solar = (x) => (V ? V.solar(x) : [`solou ${x}`]);

  // ---------- lances tirados da partida ----------
  const L = [];
  const add = (o) => L.push(o);
  const fb = M.abates[0];
  if (fb) add({ t: fb.t, tipo: fb.de[0] === 'n' ? 'fb' : 'fbdeles', ab: fb, peso: 2 });
  const vezesSolo = {};
  M.abates.forEach((a) => {
    if (a.de[0] === 'n' && a.vit[0] === 'e' && a.solo) { const k = a.de[1] + '-' + a.vit[1]; vezesSolo[k] = (vezesSolo[k] || 0) + 1; add({ t: a.t, tipo: 'solo', ab: a, n: vezesSolo[k], peso: nos[a.de[1]] === craque ? 3 : 2 }); }
  });
  const mortes = {};
  M.abates.forEach((a) => {
    if (a.vit[0] === 'n') { mortes[a.vit[1]] = (mortes[a.vit[1]] || 0) + 1; if (morredor && a.vit[1] === morredor.i && mortes[a.vit[1]] >= 2) add({ t: a.t, tipo: 'morte', ab: a, n: mortes[a.vit[1]], peso: 2 }); if (nos[a.vit[1]] === craque && chance(0.5)) add({ t: a.t, tipo: 'morteCraque', ab: a, peso: 1 }); }
  });
  M.lutas.forEach((f) => { if (f.eles >= 3 && f.eles > f.nos) add({ t: f.fim, tipo: 'luta', f, peso: 3 + (f.top && f.top[1] >= 3 ? 2 : 0) }); else if (f.nos >= 3 && f.nos > f.eles) add({ t: f.fim, tipo: 'lutaRuim', f, peso: 2 }); });
  (craque.itens || []).slice(0, 4).forEach(([m, it]) => { if (m >= 8) add({ t: m * 60 + 20, tipo: 'item', it, quem: craque, peso: 1.5 }); });
  M.obj.forEach((o) => {
    if (o.tipo === 'aegis' && o.quem && o.quem[0] === 'n') add({ t: o.t, tipo: 'aegis', o, peso: 1.5 });
    if (o.tipo === 'quartel' && o.deles) add({ t: o.t, tipo: 'quartel', o, peso: 1 });
    if (o.tipo === 'quartel' && !o.deles) add({ t: o.t, tipo: 'quartelNosso', o, peso: 2.5 });
  });
  M.chat.forEach((c) => add({ t: c.t, tipo: 'chat', c, peso: 2 }));
  // virada de ouro
  const pior = Math.min(...M.ouro);
  if (pior <= -4000) { const iMin = M.ouro.indexOf(pior); const vira = M.ouro.findIndex((g, i) => i > iMin && g > 0); if (vira > 0) add({ t: vira * 60, tipo: 'virada', pior, peso: 4 }); }
  // quartéis do mesmo minuto viram um lance só
  const Lq = []; L.sort((a, b) => a.t - b.t).forEach((l) => { const ant = Lq[Lq.length - 1]; if (ant && ant.tipo === l.tipo && ['quartel', 'quartelNosso'].includes(l.tipo) && l.t - ant.t < 60) { ant.faixas = [...(ant.faixas || [ant.o.faixa]), l.o.faixa]; return; } Lq.push(l); });

  // texto da pílula de cada lance (o "evento da play")
  const faixaPt = { top: 'de cima', bot: 'de baixo', mid: 'do meio', '': '' };
  function pilula(l) {
    const quem = (q) => (q[0] === 'n' ? `<b>${nos[q[1]].nome}</b>` : `o ${heroiDeles(q[1])}`);
    switch (l.tipo) {
      case 'fb': return `🩸 First blood: ${quem(l.ab.de)} ${um(matar('o ' + heroiDeles(l.ab.vit[1])))}`;
      case 'fbdeles': return `🩸 First blood deles: ${quem(l.ab.de)} pegou ${nos[l.ab.vit[1]].nome}`;
      case 'solo': return `⚔️ ${quem(l.ab.de)} ${um(solar('o ' + heroiDeles(l.ab.vit[1])))}${l.n >= 2 ? ` (${l.n}ª vez)` : ''}`;
      case 'morte': return `💀 ${quem(l.ab.vit)} morreu pro ${heroiDeles(l.ab.de[1] ?? 0) || 'inimigo'} (${l.n}ª morte)`;
      case 'morteCraque': return `💀 ${quem(l.ab.vit)} caiu pro ${l.ab.de[0] === 'e' ? heroiDeles(l.ab.de[1]) : 'inimigo'}`;
      case 'luta': return `💥 Luta aos ${Math.floor(l.f.ini / 60)} min: ${l.f.eles} deles no chão${l.f.top && l.f.top[1] >= 2 ? `, <b>${nos[l.f.top[0]].nome}</b> pegou ${l.f.top[1]}` : ''}${l.f.nos ? ` (perdemos ${l.f.nos})` : ''}`;
      case 'lutaRuim': return `😬 Luta aos ${Math.floor(l.f.ini / 60)} min: perdemos ${l.f.nos}${l.f.eles ? `, levamos ${l.f.eles}` : ''}`;
      case 'item': return `${ITEM_EMO[l.it] || '🛒'} <b>${l.quem.nome}</b> fechou ${l.it} aos ${Math.floor(l.t / 60)} min`;
      case 'aegis': return `🛡️ <b>${nos[l.o.quem[1]].nome}</b> pegou o Aegis`;
      case 'quartel': return `🏚️ Quartéis ${(l.faixas || [l.o.faixa]).map((f) => faixaPt[f]).join(' e ')} deles caíram`;
      case 'quartelNosso': return `🚨 Perdemos o quartel ${faixaPt[l.o.faixa]}`;
      case 'chat': return `💬 Chat do jogo · ${l.c.quem[0] === 'n' ? `<b>${nos[l.c.quem[1]].nome}</b>` : heroiDeles(l.c.quem[1])}: “${l.c.txt}”`;
      case 'virada': return `📈 Virada: o ouro saiu de −${(Math.abs(l.pior) / 1000).toFixed(1).replace('.', ',')} mil para o nosso lado`;
      default: return '';
    }
  }

  // fios de resenha para cada lance: lista de mensagens {de, txt|[...], reply, stk, react}
  function fio(l) {
    const out = [];
    const msg = (q, txt, extra = {}) => { if (q) out.push({ t: 'msg', de: q.key, txt, ...extra }); };
    const stk = (q, intencao, alvo) => { const e = figEv(q, intencao, alvo); if (e) out.push(e); };
    const reac = (emo) => { const alvo = [...out].reverse().find((x) => x.id); if (alvo) out.push({ t: 'react', alvo: alvo.id, emo }); };
    const comId = (o) => { o.id = 'm' + Math.floor(r() * 1e9); return o; };
    switch (l.tipo) {
      case 'fb': case 'solo': {
        const autor = nos[l.ab.de[1]];
        const vit = curto(heroiDeles(l.ab.vit[1]));
        const fala = autor.amigo ? autor : null;
        const a = qualquer(fala);
        if (fala && chance(0.7)) msg(fala, um([[l.tipo === 'fb' ? 'FIRST BLOOD' : 'solei', `o ${vit}`, um(['🩸', '😌', '🔪', '🫡', '😎'])], [`${vit} veio sozinho`, 'voltou pra fonte'], [`x1 com o ${vit}?`, 'izi'], [um(EGO)], [`${vit} achou que ia me pegar`, um(RISO)], [`tchau ${vit}`], [`${vit} veio de graça`], [`alguém avisa o ${vit} que é 5v5`], [`o ${vit} esqueceu que eu existo`], [`segura ${vit}`, 'vai chorando pra fonte'], [`${vit} pediu`, 'eu só entreguei'], ['quem é o próximo'], [`o ${vit} tava com saudade da fonte`], ['deu nem graça']]));
        if (a) msg(a, um([[um(UAU), `${l.tipo === 'fb' ? 'first blood' : 'solo'} do ${fala ? fala.nome : 'random'}`], [um(UAU)], [um(RISO), `o ${vit} tá procurando o mouse até agora`], [`o ${vit} saiu de casa pra isso`], [`${l.n >= 2 ? `de novo o ${vit}? ${l.n}x` : `o ${vit} vai dar report`}`, um(RISO)], [`o ${vit} desinstalando`], [`humilhou o ${vit}`], [`o ${vit} vai pedir pra trocar de lane`], ['assassinato', um(RISO)], [`coitado do ${vit}`, 'mentira, bem feito'], [`deixa o ${vit} jogar, porra`], [`${vit} levou um sacode`], ['tá com raiva hj hein'], [`o ${vit} já tá digitando no chat`, um(RISO)]]), { rapido: true });
        if (l.n >= 3 && chance(0.7)) msg(qualquer(fala, a), um([`tá pessoal isso aí`, `o ${vit} virou freguês`, `cobra aluguel do ${vit} já`, `o ${vit} tá pagando pensão pra ele`, `deixa o ${vit} em paz, ele tem família`, `o ${vit} vai bloquear ele na steam`, `isso já é bullying`, `alguém chama o conselho tutelar pro ${vit}`]), { rapido: true });
        if (fala && fregues && fregues.q === fala && l.n >= 2 && chance(0.5)) stk(fala, 'fregues');
        break;
      }
      case 'fbdeles': {
        const vit = nos[l.ab.vit[1]];
        if (vit.amigo) { const a = qualquer(vit); msg(a, um([[`${vit.nome} de first blood`, um(RISO)], [`começou cedo hj ${vit.nome}`], [`1 min de jogo e ${vit.nome} já foi`], [`${vit.nome} abrindo os trabalhos`], [`o ${vit.nome} nem esperou o jogo começar`], [`já? ${vit.nome}?`, um(RISO)], [`${vit.nome} doando o first blood como sempre`], [`${vit.nome} pagou o pedágio`]])); msg(vit, um([[um(DEFESA)], ['nem tinha nascido direito'], ['ward deles tava lá'], ['vieram 3'], ['tava pegando a runa porra'], ['faz parte'], ['first blood não ganha jogo'], ['aquece primeiro, depois cobra']]), { rapido: true }); }
        break;
      }
      case 'morte': {
        const m = nos[l.ab.vit[1]]; const z = qualquer(m); const f = qualquer(m, z);
        const quemMatou = l.ab.de[0] === 'e' ? curto(heroiDeles(l.ab.de[1])) : 'creep';
        if (chance(0.6)) msg(m, um([[`morri de novo`, quemMatou], [`o ${quemMatou} me deu 3 hit`, 'e eu morri'], [`${quemMatou} só me olhou`], ['nem vi de onde veio'], [`esse ${quemMatou} tá roubado`], [`o ${quemMatou} tá com tudo`], [`cadê a ward caralho`], ['ninguém veio né', 'obrigado time'], [`${quemMatou} de novo`, 'vou caçar esse filho da puta'], ['ué'], ['como assim'], ['tava full vida', 'juro']]));
        const z1 = comId({ t: 'msg', de: z && z.key, txt: um([`${m.nome} ${l.n} morte em ${Math.floor(l.ab.t / 60)} min`, `${m.nome} hj é ${um(ZOA)}`, `${m.nome} ${um(['batendo ponto na fonte', 'fazendo turismo na fonte', 'alimentando o inimigo de colherzinha', 'patrocinando o time deles', 'dando aula de como morrer', 'com milhas no respawn', 'virou caixa eletrônico deles', 'pagando o salário do ' + quemMatou, 'fazendo delivery de ouro', 'morando no cinza'])}`, `${um(UAU)} ${m.nome}`, `de novo ${m.nome}???`, `${m.nome} parou de jogar e começou a doar`, `alguém tira o ${m.nome} da frente do ${quemMatou}`, `${m.nome} tá jogando pelo time deles?`, `o ${quemMatou} já agradeceu o ${m.nome}?`, `${m.nome} pelo amor de deus`, `${m.nome} desliga o pc`]), rapido: true });
        if (z) out.push(z1);
        const d = um(DEFESA);
        msg(m, d, { rapido: true });
        if (f && chance(0.75)) msg(f, fecharDefesa(d), { rapido: true, reply: { de: m.key, txt: d } });
        if (chance(0.4)) reac(um(['😂 3', '💀 2', '😂💀 4']));
        if (chance(0.45)) stk(z || f, 'zoa', m);
        break;
      }
      case 'morteCraque': {
        if (!craqueAmigo) break; const z = qualquer(craque);
        msg(z, um([[`o ${craque.nome} morreu`, 'ninguém fala nada né'], [`ih o pai caiu`, um(RISO)], [`${craque.nome} morreu e ninguém vai zoar?`], ['o intocável morreu'], [`opa, ${craque.nome} no chão`, 'print'], ['agora sim um jogo justo']]));
        msg(craque, um(['foi estratégico', 'tava farmando o respawn', 'não conta', 'deixa eu', 'cry more', 'morri por vcs', 'o pai também é humano', 'volto já', 'foi o buyback mental', 'vsf, uma morte só', 'deixa eu respirar porra']), { rapido: true });
        break;
      }
      case 'luta': {
        const top = l.f.top ? nos[l.f.top[0]] : null;
        if (top && top.amigo && chance(0.6)) msg(top, um([['GIRAAA'], ['VEM'], ['entrei'], ['segura que eu vou'], ['agora'], ['VAI VAI VAI'], ['PULA'], ['CHAMA'], ['é agora porra'], ['ninguém recua'], ['tô indo']]), { rapido: true });
        const a = qualquer(top); const b = qualquer(top, a); const c = qualquer(top, a, b);
        if (a) out.push({ t: 'msg', de: a.key, txt: um([top && l.f.top[1] >= 3 ? `${['', '', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO'][Math.min(5, l.f.top[1])]}???` : 'pqp', 'CARALHO', 'que luta', 'absurdo', 'PUTA QUE PARIU', 'O QUE FOI ISSO', 'MASSACRE', 'que porra foi essa', 'tô tremendo', 'CHACINA', 'ACABOU COM ELES', 'sacode']), rapido: true, duplo: b && b.key });
        if (b) msg(b, um([[um(UAU), 'o time deles evaporou'], ['eles sumiram', um(RISO)], [`${l.f.eles} no chão`, 'pode tirar print'], ['limpou'], ['passou o rodo'], ['o time deles tá no lobby já'], ['tão no cinza tudo', um(RISO)], ['wipe'], ['virou cemitério ali'], [`${l.f.eles} pra conta`], ['eles vão abandonar'], ['manda o GG pra eles']]), { rapido: true });
        if (c && l.f.nos) msg(c, um([['eu morri no começo', 'voltei e o jogo tava ganho'], ['morri mas valeu'], ['eu fui a isca', 'de nada'], ['morri primeiro mas tô contando como assistência'], ['eu segurei o stun deles todo', 'aplausos pra mim'], ['meu sacrifício não será esquecido'], ['morri feliz'], ['eu tava no cinza torcendo'], ['quem morreu primeiro? não interessa'], ['assisti do respawn, lindo'], ['eu abri, vcs fecharam'], ['tomei tudo na cara', 'mas valeu'], ['entrei, apanhei, ganhamos']]), { rapido: true });
        if (top && top === craque && craqueAmigo && chance(0.5)) stk(top, 'ego'); else if (chance(0.3)) stk(qualquer(top), 'exalta');
        if (chance(0.5)) reac(um(['🔥 4', '😂🔥 3', '🐐 4', '🔥🔥 5', '😱 3', '👏 4']));
        break;
      }
      case 'lutaRuim': {
        const a = qualquer(); const b = qualquer(a);
        msg(a, um([['quem chamou essa luta'], ['pq a gente foi'], ['cada um pulou numa hora'], ['tp atrasado de novo'], ['que merda foi essa'], ['jogaram fora'], ['não tinha nem visão'], ['ninguém tinha bkb ali né'], ['quem iniciou isso', 'quero nome e cpf'], ['caralho que luta horrível']]));
        if (b) msg(b, um([['calma que dá'], ['eles vão errar'], ['respira'], ['foi o lag'], ['faz parte'], ['jogo longo, relaxa'], ['ninguém surta'], ['ainda dá, porra'], ['eles vão pushar sozinho e morrer']]), { rapido: true });
        break;
      }
      case 'item': {
        if (!craqueAmigo) { const a = qualquer(); msg(a, um([`o random fechou ${l.it} com ${Math.floor(l.t / 60)}`, `${l.it} com ${Math.floor(l.t / 60)} min, esse random é bom`, `adota esse random`, `o random tá jogando sério`, `alguém adiciona esse random`])); break; }
        msg(craque, um([[`${l.it} com ${Math.floor(l.t / 60)}`, um(EGO)], [`${l.it} na mão`, 'agora é outro jogo'], [`${l.it} pronto`, 'podem relaxar'], [`${l.it} ✅`], [`fechei ${l.it}`, 'agora me segue'], [`${l.it} saiu`, 'acabou a brincadeira'], [`agora com ${l.it}`, 'deixa comigo']]));
        const a = qualquer(craque);
        if (a && chance(0.7)) msg(a, um([['relaxar vc fala né', 'eu tô apanhando aqui'], ['finalmente'], ['agora vai'], ['demorou'], ['agora joga porra'], ['tá bom, agora carrega'], ['vou cobrar hein'], ['amém'], ['nem mais uma desculpa agora']]), { rapido: true });
        break;
      }
      case 'aegis': {
        const q = nos[l.o.quem[1]];
        if (q.amigo) msg(q, um([['aegis comigo', 'sigam o pai'], ['aegis no bolso'], ['vida extra 😌'], ['aegis é meu', 'ninguém discute'], ['peguei o queijo também?', 'não? ok'], ['aegis + eu = gg']]));
        const a = qualquer(q); if (a && chance(0.6)) msg(a, um(['quem sabe faz ao vivo né', 'agora pula na frente', 'não desperdiça pfv', 'se morrer com aegis eu saio do grupo', 'gasta essa vida direito', 'agora sim, vai lá morrer duas vezes']), { rapido: true });
        break;
      }
      case 'quartel': {
        const a = qualquer(); if (a && chance(0.7)) msg(a, um([['quartel caiu', 'acabou pra eles'], ['mega creep vindo'], ['podem pedir GG'], ['fecha logo que eu tô com fome'], ['quebra tudo'], ['não para não'], ['agora é só empurrar'], ['casa caindo'], ['tchau base deles'], ['fecha que amanhã tem trampo']]));
        break;
      }
      case 'quartelNosso': {
        const a = qualquer(); const b = qualquer(a);
        msg(a, um([['PERDEMOS O QUARTEL'], ['defende defende defende'], ['TP TP TP'], ['CADÊ TODO MUNDO'], ['caralho, a base'], ['volta volta volta']]));
        if (b) msg(b, um([['calma que eles não fecham'], ['eu tava farmando'], ['tô sem bb'], ['era só um quartel'], ['respira, dá'], ['tava do outro lado do mapa porra']]), { rapido: true });
        break;
      }
      case 'chat': {
        const deles = l.c.quem[0] === 'e';
        const a = qualquer(); const b = qualquer(a);
        if (deles) { msg(a, um([[`o ${curto(heroiDeles(l.c.quem[1]))} chorando no chat`, um(RISO)], ['olha o chat', um(RISO)], ['print disso pfv'], [`o ${curto(heroiDeles(l.c.quem[1]))} tá puto`], ['eles tão brigando entre eles kkkk'], ['o chat deles tá pegando fogo']])); if (b) msg(b, um(['cry more', 'chora mais', 'talk little', 'responde não', 'deixa chorar', 'manda um ?', 'ignora e ganha']), { rapido: true }); }
        else { const q = nos[l.c.quem[1]]; if (a && a !== q) msg(a, um([[`${q.nome} humildade zero`], [`${q.nome} provocando`, 'vai dar ruim'], ['não provoca não', um(RISO)], [`${q.nome} para de digitar e joga`], [`${q.nome} arrumando briga`, 'clássico']])); }
        break;
      }
      case 'virada': {
        const a = qualquer(); const b = qualquer(a);
        msg(a, um([['VIROU'], ['tava -' + Math.round(Math.abs(l.pior) / 1000) + ' mil', 'e virou'], ['eu falei que dava'], ['VIRADAAA'], ['QUE VIRADA PORRA'], ['do nada', 'virou']]));
        if (b) msg(b, um([['ninguém acreditou'], ['eu já tinha aceitado'], ['nunca duvidei'], ['eu já ia dar alt f4', 'ainda bem que não'], ['time de guerreiro'], ['isso que é time']]), { rapido: true });
        break;
      }
    }
    return out;
  }

  // escolhe os lances do roteiro: os de mais peso + sorteio, espaçados, sempre em ordem
  const TETO = { luta: 2, solo: 2, morte: 2, lutaRuim: 1, item: 1, aegis: 1, quartel: 1, quartelNosso: 1, chat: 2, virada: 1, fb: 1, fbdeles: 1, morteCraque: 1 };
  function escolher(qtos, depois = 0) {
    const porTipo = {};
    Lq.filter((l) => l.t >= depois).forEach((l) => { (porTipo[l.tipo] = porTipo[l.tipo] || []).push({ l, s: l.peso + r() * 2.5 }); });
    Object.values(porTipo).forEach((a) => a.sort((x, y) => y.s - x.s));
    const sel = [];
    // rodadas: em cada uma, cada tipo (em ordem sorteada pelo peso) põe o seu melhor lance que ainda cabe
    for (let rodada = 0; sel.length < qtos && rodada < 4; rodada++) {
      const tipos = Object.keys(porTipo).map((t) => ({ t, s: (porTipo[t][rodada] || { s: -1 }).s })).filter((x) => x.s >= 0 && rodada < (TETO[x.t] || 1)).sort((a, b) => b.s - a.s);
      for (const { t } of tipos) { if (sel.length >= qtos) break; const c = porTipo[t][rodada].l; if (!sel.some((x) => Math.abs(x.t - c.t) < 40)) sel.push(c); }
    }
    return sel.sort((a, b) => a.t - b.t);
  }

  const card = (de, extra = {}) => ({ t: 'card', de: de.key, ...extra });
  const legCard = () => (craqueAmigo ? um(['carreguei, de nada', 'saiu o veredito 😌', 'o site não mente', 'podem conferir', 'printem', 'só deixando aqui', 'documento oficial', 'contra fatos não há argumentos', 'lê e chora', 'vou emoldurar', 'tá registrado', 'chupa', 'quem duvida clica no link', 'o juiz decidiu', 'vou mandar pra minha mãe', 'agradecimentos ao time, mas né']) : um(['o random carregou kkkk', 'nem foi a gente', 'obrigado random desconhecido', 'o site deu pro random', 'vergonha', 'o random carregou 4 marmanjos', 'alguém adiciona esse cara', 'que humilhação']));
  const pick5 = (f) => amigos.length ? f : null;
  const cenarios = ['aovivo', 'enquete', 'figurinha'];
  const pesos = { aovivo: 4, enquete: 3, figurinha: 2 };
  let cen = forcar && cenarios.includes(forcar) ? forcar : null;
  if (!cen) { const tot = cenarios.reduce((a, c) => a + pesos[c], 0); let x = r() * tot; cen = cenarios.find((c) => (x -= pesos[c]) < 0) || 'aovivo'; }

  const ev = [{ t: 'day', txt: dia }];
  const grupo = 'DOTA - CULPADOS';
  const sub = amigos.map((n) => n.nome).sort().join(', ');
  const kda = (n) => `${n.k}/${n.d}/${n.a}`;
  const vereditoTxt = craqueAmigo ? `${craque.nome} carregou` : `o random carregou`;
  const depoisH = (min) => relogio(fimS + min * 60);
  const P2 = { P, craque: craque.key };

  if (cen === 'aovivo') {
    const retaFinal = chance(0.3) && M.dur > 1800;
    const ini = retaFinal ? M.dur - 12 * 60 : 0;
    ev.push({ t: 'sys', txt: retaFinal ? `Reta final · ${mmss(ini)} de jogo` : `A partida começou · vocês são ${M.lado === 'radiant' ? 'Radiant' : 'Dire'}`, min: ini / 60 });
    const abre = qualquer();
    if (!retaFinal && abre) { ev.push({ t: 'msg', de: abre.key, txt: um([['doots', 'o pai tá on'], ['bora que hj vai'], ['quem pickou isso'], ['vamo com calma hj'], ['essa é a da virada'], ['draft deles é bom hein'], ['hj ninguém tilta'], ['bora porra'], ['esse draft vai dar merda'], ['foco hj'], ['quem morrer primeiro paga a pizza'], ['joga sério hj pfv'], ['vai ser rápido']]), min: 0.3 }); }
    if (!retaFinal && craqueAmigo && chance(0.6)) ev.push({ t: 'msg', de: craque.key, txt: um([[`${curto(craque.heroiNome)} hj`, 'deixa o pai farmar em paz'], ['me deixa farmar', 'depois eu resolvo'], ['tô de ' + curto(craque.heroiNome), 'confiem'], ['me protejam que eu carrego'], ['hj eu tô com a mão quente'], ['só me dar 20 min'], [`${curto(craque.heroiNome)} na mão do pai`, 'é outro herói']]), min: 0.5, rapido: true });
    const lances = escolher(retaFinal ? 6 : 9 + Math.floor(r() * 3), ini);
    lances.forEach((l) => {
      const p = pilula(l); if (p) ev.push({ t: 'sys', cls: 'lance', txt: p, min: l.t / 60 });
      fio(l).forEach((m, k) => { if (m.de || m.t === 'react') ev.push({ ...m, min: l.t / 60 + 0.05 + k * 0.03 }); });
    });
    ev.push({ t: 'sys', cls: 'lance', txt: `🏆 Vitória · ${M.placar[0]} × ${M.placar[1]} em ${mmss(M.dur)}`, min: M.dur / 60 });
    const q = craqueAmigo ? craque : qualquer(); if (q) ev.push(card(q, { min: M.dur / 60 + 0.4, legenda: legCard() }));
    if (mochila && chance(0.8)) ev.push({ t: 'msg', de: mochila.key, txt: um([[`${String(mochila.merito).replace('.', ',')}%`, 'mas a vitória conta igual tá'], ['eu tava lá também tá'], [`${kda(mochila)} e nem uma menção`], ['esse site é comprado'], ['vitória é vitória porra'], ['o importante é o time'], ['ganhei e é isso que importa'], ['vou processar esse site'], ['o mérito é coletivo'], ['quem fez esse site me odeia']]), min: M.dur / 60 + 0.6 });
    if (suporte && suporte !== mochila && suporte.wards >= 6 && chance(0.6)) ev.push({ t: 'msg', de: suporte.key, txt: um([[`${suporte.wards} ward, ${suporte.a} assistência`, 'e eu nem apareço no cartão 😭'], [`${suporte.wards} wards`, 'e o mérito é dele'], ['suporte nesse grupo é invisível'], [`quem comprou as ${suporte.wards} wards?`, 'ninguém pergunta'], ['da próxima eu pego carry e quero ver']]), min: M.dur / 60 + 0.7 });
    if (craqueAmigo && chance(0.7)) { const e = chance(0.5) ? figEv(craque, 'ego', null, { min: M.dur / 60 + 0.8 }) : null; ev.push(e || { t: 'msg', de: craque.key, txt: um(['izi wiiin', 'obrigado grande irmão 🙏', 'sigam o pai', 'próxima', 'aceito pix', 'mais uma?', 'sem esforço', 'carregar cansa viu', 'de nada de novo']), min: M.dur / 60 + 0.8 }); }
    if (mochila && craqueAmigo && chance(0.35)) { const e = figEv(mochila, 'contra', null, { min: M.dur / 60 + 0.9 }); if (e) ev.push(e); }
    return { cenario: 'Ao vivo' + (retaFinal ? ' · reta final' : ''), grupo, sub, strip: true, P, ev, memoria: [...usados], inicio: M.inicio, ouro: M.ouro, dur: M.dur };
  }

  // ---------- pós-jogo: começa com o veredito encaminhado ----------
  ev.push({ t: 'sys', cls: 'lance', txt: `🏆 Vitória · ${M.placar[0]} × ${M.placar[1]} em ${mmss(M.dur)}`, h: depoisH(0) });
  let h = 0.5; const H = () => depoisH((h += 0.2 + r() * 0.5));
  const quemManda = craqueAmigo ? craque : (qualquer() || amigos[0]);
  ev.push(card(quemManda, { h: H(), legenda: legCard() }));
  const replays = escolher(cen === 'enquete' ? 3 : 2);

  if (cen === 'enquete') {
    if (craqueAmigo && chance(0.5)) { const novo = um([`${craque.nome} e os 4 mochilas`, `${craque.merito.toFixed(0)}% é do ${craque.nome}`, `fã clube do ${curto(craque.heroiNome)}`, 'sigam o pai', `${craque.nome} carrega, o resto assiste`, `escola do ${craque.nome}`, `os protegidos do ${craque.nome}`, 'DOTA - CARREGADOS', `${curto(craque.heroiNome)} e os figurantes`, `obrigado ${craque.nome}`]); ev.push({ t: 'sys', txt: `<b>${craque.nome}</b> mudou o nome do grupo para “${novo}”`, h: H(), grupo: novo }); }
    if (craqueAmigo) { const e = figEv(craque, 'ego', null, { h: H(), id: 'st1' }); if (e) ev.push(e); } else { const e = figEv(qualquer(), 'exalta', null, { h: H(), id: 'st1' }); if (e) ev.push(e); }
    const z = qualquer(craque, quemManda); if (z) ev.push({ t: 'msg', de: z.key, txt: um([[um(RISO)], [um(UAU), 'humildade zero'], ['já começou'], ['lá vem'], ['pronto, agora aguenta'], ['alguém tira o admin dele'], ['vai ficar assim a semana toda'], ['o ego não cabe no grupo'], ['silencia ele'], ['ah pronto']]), h: H(), reply: craqueAmigo ? { de: craque.key, txt: '🖼️ Figurinha' } : undefined });
    ev.push({ t: 'react', alvo: 'st1', emo: um(['😂 4', '😂🔥 3', '🙄 2']) });
    // lances lembrados com replay
    replays.forEach((l) => { ev.push({ t: 'sys', cls: 'lance', txt: '🔁 Replay ' + mmss(l.t) + ' · ' + pilula(l).replace(/^\S+\s/, ''), h: H() }); fio(l).slice(0, 3).forEach((m) => ev.push({ ...m, h: H() })); });
    if (morredor && chance(0.5)) { ev.push({ t: 'del', de: morredor.key, h: H() }); const a = qualquer(morredor); if (a) ev.push({ t: 'msg', de: a.key, txt: um([`deu tempo de ler ${morredor.nome} kkkkk`, 'apagou pq?', 'printei já', 'apagou mas eu vi', 'tarde demais, tá no print', 'fala de novo, covarde', 'o que tu escreveu aí hein', 'apagou o xingamento kkkk']), h: H() }); }
    // enquete: a piada é sempre sobre UMA pessoa (o mochila), com resultado claro: a maioria vota na mesma opção,
    // o zoado vota na desculpa dele sozinho. Nada de porcentagem nem empate.
    const alvoE = morredor && morredor.d >= 6 ? morredor : null;
    const tipo = alvoE ? um(['mochila', 'oque', 'proxima', 'desculpa', 'castigo', 'apelido', 'nota', 'culpa']) : 'play';
    const quemPerg = qualquer(alvoE) || craque;
    // opções: uma lista grande de onde saem 3 (+ a desculpa do zoado, quando tem)
    const tres = (xs) => embaralhar(xs).slice(0, 3);
    let q, ops, maioria = 0, desculpa = -1;
    if (tipo === 'mochila') {
      const outro = resto.filter((n) => n !== alvoE).sort((a, b) => b.d - a.d)[0];
      q = um(['Quem foi o mochila?', 'Quem foi carregado hoje?', 'Quem pesou na mochila?', 'Quem foi de passageiro?', 'Quem pegou carona na vitória?', 'Quem só assistiu?']);
      ops = [`${alvoE.nome} (${alvoE.d} mortes)`, ...(outro ? [`${outro.nome} (${outro.d} mortes)`] : []), um(['o lag', 'o servidor', 'o draft', 'a internet da vivo', 'o patch novo', 'o mouse de alguém'])];
      desculpa = ops.length - 1;
    } else if (tipo === 'oque') {
      q = um([`O que o ${alvoE.nome} tava fazendo no jogo?`, `Qual era a função do ${alvoE.nome} hoje?`, `${alvoE.nome} tava jogando o quê?`]);
      ops = [...tres(['turismo na fonte', 'patrocinando o time deles', `isca profissional (${alvoE.d} mortes)`, 'delivery de ouro', 'estágio no time deles', 'tour pelo respawn', 'assistindo o jogo de graça', 'treinando o time deles', 'decorando o mapa']), um(['abrindo espaço', 'segurando a lane', 'dando visão', 'jogando pro time'])];
      maioria = Math.floor(r() * 3); desculpa = 3;
    } else if (tipo === 'proxima') {
      q = um([`Na próxima o ${alvoE.nome} joga de quê?`, `Qual a função do ${alvoE.nome} na próxima?`, `O que fazer com o ${alvoE.nome} na próxima?`]);
      ops = [...tres(['espectador', 'coach do time deles', 'courier', 'ward ambulante', 'banco de reserva', 'torcida', 'cameraman', 'pausa pro lanche']), `${curto(alvoE.heroiNome)} de novo`];
      maioria = Math.floor(r() * 3); desculpa = 3;
    } else if (tipo === 'desculpa') {
      q = um([`Melhor desculpa do ${alvoE.nome} pras ${alvoE.d} mortes`, `Por que o ${alvoE.nome} morreu ${alvoE.d} vezes?`, `${alvoE.d} mortes do ${alvoE.nome}: o que houve?`]);
      ops = [...tres(['foi o lag', 'tava abrindo espaço', 'o draft era ruim', 'a mãe chamou', 'o cachorro pisou no teclado', 'tava no banheiro', 'mouse zoado', 'internet da vivo']), um(['tava ruim mesmo', 'é ruim mesmo', 'joga mal e pronto', 'falta de vergonha'])];
      maioria = 3; desculpa = Math.floor(r() * 3);
    } else if (tipo === 'castigo') {
      q = um([`Castigo do ${alvoE.nome} pelas ${alvoE.d} mortes`, `O que o ${alvoE.nome} paga pelas ${alvoE.d} mortes?`, `Pena do ${alvoE.nome}`]);
      ops = [...tres(['paga a pizza', 'joga de suporte a semana toda', 'compra todas as wards', 'muda o nick pra "doador"', 'foto de perfil de Pudge', 'fica sem falar no grupo 1 dia']), um(['absolvido', 'perdão pq ganhamos', 'nada, foi o time'])];
      maioria = Math.floor(r() * 3); desculpa = 3;
    } else if (tipo === 'apelido') {
      q = um([`Apelido novo do ${alvoE.nome}`, `Como a gente chama o ${alvoE.nome} agora?`, `Nick novo pro ${alvoE.nome}`]);
      ops = [...tres(['Doador Universal', 'Cliente VIP da Fonte', 'Patrocinador', 'Caixa Eletrônico', 'Saco de Pancada', 'Delivery', 'Turista']), um([alvoE.nome + ' mesmo', 'Lenda', 'Abridor de Espaço'])];
      maioria = Math.floor(r() * 3); desculpa = 3;
    } else if (tipo === 'nota') {
      q = um([`Nota pro jogo do ${alvoE.nome}`, `De 0 a 10, o ${alvoE.nome} hoje`, `Avaliação do ${alvoE.nome}`]);
      ops = [um(['0', 'zero']), um(['2, pela presença', '1, pq conectou']), um(['5, pq ganhou', '4, com boa vontade']), um(['10', '10, injustiçado'])];
      maioria = um([0, 1]); desculpa = 3;
    } else if (tipo === 'culpa') {
      q = um([`De quem é a culpa das ${alvoE.d} mortes do ${alvoE.nome}?`, `Quem matou o ${alvoE.nome} ${alvoE.d} vezes?`]);
      ops = [`do ${alvoE.nome}`, ...tres(['do time deles, que é bom', 'do suporte, sem ward', 'do Icefrog', 'da mãe dele']).slice(0, 2), um(['do lag', 'do draft', 'da vivo'])];
      maioria = 0; desculpa = 3;
    } else {
      const lutas = replays.filter((l) => l.tipo === 'luta' || l.tipo === 'solo').slice(0, 3);
      q = um(['Melhor play da partida?', 'Lance da partida?', 'Qual foi o momento?', 'Replay da noite?']);
      ops = lutas.map((l) => pilula(l).replace(/<[^>]+>/g, '').replace(/^\S+\s/, '').replace(/ \(perdemos \d+\)/, '').replace(/ \(\d+ª vez\)/, '').slice(0, 46));
      if (ops.length < 2) ops = [`${craque.amigo ? craque.nome : 'o random'} carregando`, 'o veredito do site'];
    }
    const votantes = embaralhar(amigos);
    const dissidente = votantes.length >= 5 ? votantes.find((n) => n !== alvoE && chance(0.35)) : null;
    const votoDe = (n) => (n === alvoE && desculpa >= 0 ? desculpa : n === dissidente ? (maioria + 1 + Math.floor(r() * (ops.length - 1))) % ops.length : maioria);
    ev.push({ t: 'poll', de: quemPerg.key, id: 'p', q, ops, h: H() });
    votantes.forEach((n) => ev.push({ t: 'vote', poll: 'p', de: n.key, op: votoDe(n) }));
    if (alvoE && tipo !== 'play') ev.push({ t: 'msg', de: alvoE.key, txt: um([[`eu tive ${alvoE.a} assistência`, 'quero recontagem'], ['enquete comprada'], ['vai tomar no cu', 'todos vocês'], ['votei certo pelo menos'], ['vcs não sabem perder', 'nem ganhar'], ['vsf'], ['fraude'], ['vou sair do grupo'], ['cambada de filho da puta', 'kkkkk'], ['enquete manipulada', 'quero auditoria'], ['denunciei a enquete'], ['tô rindo mas tô puto'], ['lembrarei disso'], ['ok, anotei o nome de cada um']]), h: H() });
    const mochila_ = alvoE;
    if (suporte && suporte.wards >= 6 && chance(0.5)) ev.push({ t: 'msg', de: suporte.key, txt: um([[`${suporte.wards} ward e ${suporte.a} assistência`, 'e ninguém faz enquete pra me elogiar 😭'], ['cadê a enquete do melhor suporte?'], [`${suporte.wards} wards e nem uma opção na enquete`], ['suporte nesse grupo só aparece quando morre']]), h: H() });
    if (mochila && chance(0.7)) { const e = figEv(qualquer(mochila), 'zoa', mochila, { h: H(), id: 'st2' }); if (e) { ev.push(e); ev.push({ t: 'react', alvo: 'st2', emo: um(['💀 3', '😂 4', '😂💀 3']) }); if (craqueAmigo && chance(0.5)) { const c = figEv(mochila, 'contra', null, { h: H() }); if (c) ev.push(c); } } }
    ev.push({ t: 'pin', txt: `${vereditoTxt} · ${curto(craque.heroiNome)} · ${String(craque.merito).replace('.', ',')}% do mérito` });
    return { cenario: 'Resenha com enquete', grupo, sub, strip: false, P, ev, memoria: [...usados] };
  }

  // figurinha: quase sem texto, uma guerra de figurinha com 1-2 replays; cada uma com quem manda e sobre quem fazendo sentido
  const seq = [];
  if (craqueAmigo) seq.push([craque, 'ego']); else seq.push([qualquer(), 'exalta']);
  if (craqueAmigo && chance(0.5)) seq.push([qualquer(craque), 'exalta']);
  if (mochila) seq.push([qualquer(mochila), 'zoa', mochila]);
  if (mochila && craqueAmigo && chance(0.7)) seq.push([mochila, 'contra']);
  if (fregues) seq.push([fregues.q, 'fregues']);
  if (suporte && suporte.wards >= 6 && chance(0.6)) seq.push([suporte, 'suporte', suporte]);
  if (morredor && morredor !== mochila) seq.push([qualquer(morredor), 'zoa', morredor]);
  replays.forEach((l, k) => {
    ev.push({ t: 'sys', cls: 'lance', txt: '🔁 Replay ' + mmss(l.t) + ' · ' + pilula(l).replace(/^\S+\s/, ''), h: H() });
    const [q, i, al] = seq.shift() || [];
    const e = q && figEv(q, i, al, { h: H() }); if (e) { ev.push(e); if (chance(0.5)) ev.push({ t: 'react', alvo: e.id, emo: um(['😂 3', '💀 2', '🔥 3', '😂💀 4']) }); }
    const b = qualquer(q); if (b && chance(0.5)) ev.push({ t: 'msg', de: b.key, txt: um(RISO), h: H() });
  });
  seq.forEach(([q, i, al]) => { const e = q && figEv(q, i, al, { h: H() }); if (e) { ev.push(e); if (chance(0.4)) ev.push({ t: 'react', alvo: e.id, emo: um(['😂 3', '💀 2', '🔥 3']) }); } });
  const ult = qualquer(); if (ult && chance(0.6)) ev.push({ t: 'msg', de: ult.key, txt: um(['chega de figurinha', 'next?', 'mais uma?', 'quem joga a próxima', 'para de figurinha porra', 'vcs não trabalham não?', 'bora outra', 'amanhã tem mais', 'quem fez essas figurinhas tá desempregado', 'salvei todas']), h: H() });
  return { cenario: 'Guerra de figurinha', grupo, sub, strip: false, P, ev, memoria: [...usados] };
}

root.GERADOR = { gerar, CURTO };
})(typeof window !== 'undefined' ? window : globalThis);
