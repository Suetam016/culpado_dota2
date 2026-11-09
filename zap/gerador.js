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
  const RISO = ['kkkkkkk', 'KKKKKKKKKK', 'kkkkkkkkkkkkk', 'mkkkkkkk', 'hsuahsuahsua', 'hahahahahah', 'shaushuashuas', 'kkkk'];
  const UAU = ['slc', 'oloco', 'pqp', 'carai', 'Forte', 'oh man', 'oh my', 'absurdo', 'mt real', 'Nise', 'Ma brotha', 'Celoko', 'Auuu', 'vsf', 'brabo'];
  const EGO = ['izi', 'izi wiiin', 'o pai tá on', 'sigam o pai', 'quem sabe faz ao vivo', 'eu e a máquina', 'tá no papo', 'podem relaxar', 'lembra bem meus games', 'nem suei'];
  const ZOA = ['saco de batata', 'cry more', 'newba', 'tapete', 'eterno arconte', 'fider', 'arcontinho', 'hero batata', 'batendo ponto na fonte', 'turismo na fonte'];
  const DEFESA = ['eu tava abrindo espaço', 'foi o lag', 'tava sem item', 'tava comprando ward', 'o jogo me odeia', 'vou me mutar e seguir jogando', 'sem stress', 'eu sou o mais importante do time', 'tava dando visão', 'foi proposital, isca', 'meus advogados vão entrar em contato'];
  const FECHO = ['abrindo espaço no cemitério', 'abriu espaço pro inimigo farmar', 'isca de quê, de PA?', 'lag de caráter', 'sem item e sem vergonha', 'visão do cinza', 'mutou foi o cérebro', 'o advogado também morreu'];
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
      if (resto.length >= 2) op.push({ p: 1.6, f: { tpl: 'carrega', img: craque.heroi, imgs: resto.map((n) => n.heroi), cima: `O PAI E OS ${resto.length + (nos.length - amigos.length)} MOCHILAS` } });
    }
    if (intencao === 'exalta') {
      // quem elogia puxa o mérito pra si pelo papel que teve: a figurinha é o herói DELE, com o craque de "filho"
      const filho = craqueAmigo ? H1(craque) : `${H1(craque)} RANDOM`;
      if (de && de !== craque && (de.pos >= 4 || de.wards >= 8)) {
        op.push({ p: 1.6, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'EU QUE CRIEI', baixo: `${de.wards} WARDS PRO MEU FILHO` } });
        op.push({ p: 1.3, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'RESPEITA MEU FILHO', baixo: `${de.a} ASSISTÊNCIAS PRA ELE` } });
        op.push({ p: 1, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'POR TRÁS DE UM GRANDE ' + filho, baixo: 'TEM UM SUPORTE' } });
      } else if (de && de !== craque) {
        op.push({ p: 1.3, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: 'O ESPAÇO FUI EU', baixo: `${de.k} ABATES MEUS TAMBÉM` } });
        op.push({ p: 1, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: `SEM MIM O ${filho}`, baixo: 'NÃO FARMAVA' } });
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
    }
    if (intencao === 'contra' && craqueAmigo) {
      if (craque.d >= 3) meme(craque.heroi, `E O ${H1(craque)}?`, `${craque.d} MORTES TAMBÉM`, 1.5);
      // farm é o trabalho do carry: só cobra farm de quem não é pos 1
      if (craque.pos >= 2 && craque.pos <= 3) meme(craque.heroi, 'FARMOU O MAPA TODO', `${craque.gpm} DE GPM, NÉ`, 1.2);
      if (craque.pos >= 4) meme(craque.heroi, 'SUPORTE COM ' + craque.gpm + ' DE GPM', 'ROUBOU MEU FARM', 1.5);
      if (itemTop && craque.pos === 1) meme(craque.heroi, `CARREGAR COM ${itemTop[1].toUpperCase()} AOS ${itemTop[0]}`, 'ATÉ EU', 1.2);
      if (de && de.a >= 15) op.push({ p: 1.2, f: { tpl: 'criou', img: de.heroi, img2: craque.heroi, cima: `${de.a} ASSISTÊNCIAS MINHAS`, baixo: `E O MÉRITO É DO ${H1(craque)}` } });
      if (de && de.d >= 7) meme(de.heroi, 'EU MORRI', 'PRA ELE FARMAR EM PAZ', 1);
    }
    if (intencao === 'fregues' && fregues) {
      op.push({ p: 1.5, f: { tpl: 'rip', img: fregues.e.heroi, txt: `aqui jaz o ${curto(fregues.e.heroiNome)}`, sub: `${fregues.n}x pro ${fregues.q.nome}` } });
      meme(fregues.e.heroi, 'FREGUÊS', `${fregues.n}x PRO ${fregues.q.nome.toUpperCase()}`, 1.2);
      op.push({ p: 1, f: { tpl: 'duo', img: fregues.e.heroi, la: 'minuto 0', lb: `depois de ${fregues.n} mortes` } });
    }
    if (intencao === 'suporte' && alvo && alvo.wards >= 6) {
      meme(alvo.heroi, `${alvo.wards} WARDS`, 'E NINGUÉM AGRADECE', 1.3);
      op.push({ p: 1, f: { tpl: 'func', img: alvo.heroi, nome: alvo.nome, txt: `${alvo.wards} wards · ${alvo.a} assistências`, titulo: 'Herói invisível' } });
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
        if (fala && chance(0.7)) msg(fala, um([[l.tipo === 'fb' ? 'FIRST BLOOD' : 'solei', `o ${vit}`, um(['🩸', '😌', '🔪'])], [`${vit} veio sozinho`, 'voltou pra fonte'], [`x1 com o ${vit}?`, 'izi'], [um(EGO)], [`${vit} achou que ia me pegar`, um(RISO)]]));
        if (a) msg(a, um([[um(UAU), `${l.tipo === 'fb' ? 'first blood' : 'solo'} do ${fala ? fala.nome : 'random'}`], [um(UAU)], [um(RISO), `o ${vit} tá procurando o mouse até agora`], [`o ${vit} saiu de casa pra isso`], [`${l.n >= 2 ? `de novo o ${vit}? ${l.n}x` : `o ${vit} vai dar report`}`, um(RISO)]]), { rapido: true });
        if (l.n >= 3 && chance(0.7)) msg(qualquer(fala, a), um([`tá pessoal isso aí`, `o ${vit} virou freguês`, `cobra aluguel do ${vit} já`]), { rapido: true });
        if (fala && fregues && fregues.q === fala && l.n >= 2 && chance(0.5)) stk(fala, 'fregues');
        break;
      }
      case 'fbdeles': {
        const vit = nos[l.ab.vit[1]];
        if (vit.amigo) { const a = qualquer(vit); msg(a, um([[`${vit.nome} de first blood`, um(RISO)], [`começou cedo hj ${vit.nome}`], [`1 min de jogo e ${vit.nome} já foi`]])); msg(vit, um([[um(DEFESA)], ['nem tinha nascido direito'], ['ward deles tava lá']]), { rapido: true }); }
        break;
      }
      case 'morte': {
        const m = nos[l.ab.vit[1]]; const z = qualquer(m); const f = qualquer(m, z);
        const quemMatou = l.ab.de[0] === 'e' ? curto(heroiDeles(l.ab.de[1])) : 'creep';
        if (chance(0.6)) msg(m, um([[`morri de novo`, quemMatou], [`o ${quemMatou} me deu 3 hit`, 'e eu morri'], [`${quemMatou} só me olhou`], ['nem vi de onde veio']]));
        const z1 = comId({ t: 'msg', de: z && z.key, txt: um([`${m.nome} ${l.n} morte em ${Math.floor(l.ab.t / 60)} min`, `${m.nome} hj é ${um(ZOA)}`, `${m.nome} ${um(['batendo ponto na fonte', 'fazendo turismo na fonte', 'alimentando o inimigo de colherzinha', 'patrocinando o time deles'])}`, `${um(UAU)} ${m.nome}`]), rapido: true });
        if (z) out.push(z1);
        const d = um(DEFESA);
        msg(m, d, { rapido: true });
        if (f && chance(0.75)) msg(f, um(FECHO), { rapido: true, reply: { de: m.key, txt: d } });
        if (chance(0.4)) reac(um(['😂 3', '💀 2', '😂💀 4']));
        if (chance(0.45)) stk(z || f, 'zoa', m);
        break;
      }
      case 'morteCraque': {
        if (!craqueAmigo) break; const z = qualquer(craque);
        msg(z, um([`o ${craque.nome} morreu`, 'ninguém fala nada né'].concat(chance(0.5) ? [] : [um(RISO)])));
        msg(craque, um(['foi estratégico', 'tava farmando o respawn', 'não conta', 'deixa eu', 'cry more']), { rapido: true });
        break;
      }
      case 'luta': {
        const top = l.f.top ? nos[l.f.top[0]] : null;
        if (top && top.amigo && chance(0.6)) msg(top, um([['GIRAAA'], ['VEM'], ['entrei'], ['segura que eu vou'], ['agora']]), { rapido: true });
        const a = qualquer(top); const b = qualquer(top, a); const c = qualquer(top, a, b);
        if (a) out.push({ t: 'msg', de: a.key, txt: um([top && l.f.top[1] >= 3 ? `${['', '', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO'][Math.min(5, l.f.top[1])]}???` : 'pqp', 'CARALHO', 'que luta', 'absurdo']), rapido: true, duplo: b && b.key });
        if (b) msg(b, um([[um(UAU), 'o time deles evaporou'], ['eles sumiram', um(RISO)], [`${l.f.eles} no chão`, 'pode tirar print']]), { rapido: true });
        if (c && l.f.nos) msg(c, um([['eu morri no começo', 'voltei e o jogo tava ganho'], ['morri mas valeu'], ['eu fui a isca', 'de nada']]), { rapido: true });
        if (top && top === craque && craqueAmigo && chance(0.5)) stk(top, 'ego'); else if (chance(0.3)) stk(qualquer(top), 'exalta');
        if (chance(0.5)) reac(um(['🔥 4', '😂🔥 3', '🐐 4']));
        break;
      }
      case 'lutaRuim': {
        const a = qualquer(); const b = qualquer(a);
        msg(a, um([['quem chamou essa luta'], ['pq a gente foi'], ['cada um pulou numa hora'], ['tp atrasado de novo']]));
        if (b) msg(b, um([['calma que dá'], ['eles vão errar'], ['respira'], ['foi o lag']]), { rapido: true });
        break;
      }
      case 'item': {
        if (!craqueAmigo) { const a = qualquer(); msg(a, um([`o random fechou ${l.it} com ${Math.floor(l.t / 60)}`, `${l.it} com ${Math.floor(l.t / 60)} min, esse random é bom`])); break; }
        msg(craque, um([[`${l.it} com ${Math.floor(l.t / 60)}`, um(EGO)], [`${l.it} na mão`, 'agora é outro jogo'], [`${l.it} pronta`, 'podem relaxar']]));
        const a = qualquer(craque);
        if (a && chance(0.7)) msg(a, um([['relaxar vc fala né', 'eu tô apanhando aqui'], ['finalmente'], ['agora vai'], ['demorou']]), { rapido: true });
        break;
      }
      case 'aegis': {
        const q = nos[l.o.quem[1]];
        if (q.amigo) msg(q, um([['aegis comigo', 'sigam o pai'], ['aegis no bolso'], ['vida extra 😌']]));
        const a = qualquer(q); if (a && chance(0.6)) msg(a, um(['quem sabe faz ao vivo né', 'agora pula na frente', 'não desperdiça pfv']), { rapido: true });
        break;
      }
      case 'quartel': {
        const a = qualquer(); if (a && chance(0.7)) msg(a, um([['quartel caiu', 'acabou pra eles'], ['mega creep vindo'], ['podem pedir GG'], ['fecha logo que eu tô com fome']]));
        break;
      }
      case 'quartelNosso': {
        const a = qualquer(); const b = qualquer(a);
        msg(a, um([['PERDEMOS O QUARTEL'], ['defende defende defende'], ['TP TP TP']]));
        if (b) msg(b, um([['calma que eles não fecham'], ['eu tava farmando'], ['tô sem bb']]), { rapido: true });
        break;
      }
      case 'chat': {
        const deles = l.c.quem[0] === 'e';
        const a = qualquer(); const b = qualquer(a);
        if (deles) { msg(a, um([[`o ${curto(heroiDeles(l.c.quem[1]))} chorando no chat`, um(RISO)], ['olha o chat', um(RISO)], ['print disso pfv']])); if (b) msg(b, um(['cry more', 'chora mais', 'talk little']), { rapido: true }); }
        else { const q = nos[l.c.quem[1]]; if (a && a !== q) msg(a, um([[`${q.nome} humildade zero`], [`${q.nome} provocando`, 'vai dar ruim'], ['não provoca não', um(RISO)]])); }
        break;
      }
      case 'virada': {
        const a = qualquer(); const b = qualquer(a);
        msg(a, um([['VIROU'], ['tava -' + Math.round(Math.abs(l.pior) / 1000) + ' mil', 'e virou'], ['eu falei que dava']]));
        if (b) msg(b, um([['ninguém acreditou'], ['eu já tinha aceitado'], ['nunca duvidei']]), { rapido: true });
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
  const legCard = () => (craqueAmigo ? um(['carreguei, de nada', 'saiu o veredito 😌', 'o site não mente', 'podem conferir', 'printem', 'só deixando aqui']) : um(['o random carregou kkkk', 'nem foi a gente', 'obrigado random desconhecido', 'o site deu pro random']));
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
    if (!retaFinal && abre) { ev.push({ t: 'msg', de: abre.key, txt: um([['doots', 'o pai tá on'], ['bora que hj vai'], ['quem pickou isso'], ['vamo com calma hj'], ['essa é a da virada']]), min: 0.3 }); }
    if (!retaFinal && craqueAmigo && chance(0.6)) ev.push({ t: 'msg', de: craque.key, txt: um([[`${curto(craque.heroiNome)} hj`, 'deixa o pai farmar em paz'], ['me deixa farmar', 'depois eu resolvo'], ['tô de ' + curto(craque.heroiNome), 'confiem']]), min: 0.5, rapido: true });
    const lances = escolher(retaFinal ? 6 : 9 + Math.floor(r() * 3), ini);
    lances.forEach((l) => {
      const p = pilula(l); if (p) ev.push({ t: 'sys', cls: 'lance', txt: p, min: l.t / 60 });
      fio(l).forEach((m, k) => { if (m.de || m.t === 'react') ev.push({ ...m, min: l.t / 60 + 0.05 + k * 0.03 }); });
    });
    ev.push({ t: 'sys', cls: 'lance', txt: `🏆 Vitória · ${M.placar[0]} × ${M.placar[1]} em ${mmss(M.dur)}`, min: M.dur / 60 });
    const q = craqueAmigo ? craque : qualquer(); if (q) ev.push(card(q, { min: M.dur / 60 + 0.4, legenda: legCard() }));
    if (mochila && chance(0.8)) ev.push({ t: 'msg', de: mochila.key, txt: um([[`${String(mochila.merito).replace('.', ',')}%`, 'mas a vitória conta igual tá'], ['eu tava lá também tá'], [`${kda(mochila)} e nem uma menção`]]), min: M.dur / 60 + 0.6 });
    if (suporte && suporte !== mochila && suporte.wards >= 6 && chance(0.6)) ev.push({ t: 'msg', de: suporte.key, txt: [`${suporte.wards} ward, ${suporte.a} assistência`, 'e eu nem apareço no cartão 😭'], min: M.dur / 60 + 0.7 });
    if (craqueAmigo && chance(0.7)) { const e = chance(0.5) ? figEv(craque, 'ego', null, { min: M.dur / 60 + 0.8 }) : null; ev.push(e || { t: 'msg', de: craque.key, txt: um(['izi wiiin', 'obrigado grande irmão 🙏', 'sigam o pai', 'de nada']), min: M.dur / 60 + 0.8 }); }
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
    if (craqueAmigo && chance(0.5)) { const novo = um([`${craque.nome} e os 4 mochilas`, `${craque.merito.toFixed(0)}% é do ${craque.nome}`, `fã clube do ${curto(craque.heroiNome)}`, 'sigam o pai']); ev.push({ t: 'sys', txt: `<b>${craque.nome}</b> mudou o nome do grupo para “${novo}”`, h: H(), grupo: novo }); }
    if (craqueAmigo) { const e = figEv(craque, 'ego', null, { h: H(), id: 'st1' }); if (e) ev.push(e); } else { const e = figEv(qualquer(), 'exalta', null, { h: H(), id: 'st1' }); if (e) ev.push(e); }
    const z = qualquer(craque, quemManda); if (z) ev.push({ t: 'msg', de: z.key, txt: um([[um(RISO)], [um(UAU), 'humildade zero'], ['já começou'], ['lá vem'], ['pronto, agora aguenta']]), h: H(), reply: craqueAmigo ? { de: craque.key, txt: '🖼️ Figurinha' } : undefined });
    ev.push({ t: 'react', alvo: 'st1', emo: um(['😂 4', '😂🔥 3', '🙄 2']) });
    // lances lembrados com replay
    replays.forEach((l) => { ev.push({ t: 'sys', cls: 'lance', txt: '🔁 Replay ' + mmss(l.t) + ' · ' + pilula(l).replace(/^\S+\s/, ''), h: H() }); fio(l).slice(0, 3).forEach((m) => ev.push({ ...m, h: H() })); });
    if (morredor && chance(0.5)) { ev.push({ t: 'del', de: morredor.key, h: H() }); const a = qualquer(morredor); if (a) ev.push({ t: 'msg', de: a.key, txt: um([`deu tempo de ler ${morredor.nome} kkkkk`, 'apagou pq?', 'printei já']), h: H() }); }
    // enquete: a piada é sempre sobre UMA pessoa (o mochila), com resultado claro: a maioria vota na mesma opção,
    // o zoado vota na desculpa dele sozinho. Nada de porcentagem nem empate.
    const alvoE = morredor && morredor.d >= 6 ? morredor : null;
    const tipo = alvoE ? um(['mochila', 'oque', 'proxima', 'desculpa']) : 'play';
    const quemPerg = qualquer(alvoE) || craque;
    let q, ops, maioria = 0, desculpa = -1;
    if (tipo === 'mochila') {
      const outro = resto.filter((n) => n !== alvoE).sort((a, b) => b.d - a.d)[0];
      q = um(['Quem foi o mochila?', 'Quem foi carregado hoje?', 'Quem pesou na mochila?']);
      ops = [`${alvoE.nome} (${alvoE.d} mortes)`, ...(outro ? [`${outro.nome} (${outro.d} mortes)`] : []), um(['o lag', 'o servidor', 'o draft'])];
      desculpa = ops.length - 1;
    } else if (tipo === 'oque') {
      q = `O que o ${alvoE.nome} tava fazendo no jogo?`;
      ops = ['turismo na fonte', 'patrocinando o time deles', `isca profissional (${alvoE.d} mortes)`, 'abrindo espaço'];
      maioria = Math.floor(r() * 3); desculpa = 3;
    } else if (tipo === 'proxima') {
      q = `Na próxima o ${alvoE.nome} joga de quê?`;
      ops = ['espectador', 'coach do time deles', `${curto(alvoE.heroiNome)} de novo`, 'courier'];
      maioria = um([0, 1, 3]); desculpa = 2;
    } else if (tipo === 'desculpa') {
      q = `Melhor desculpa do ${alvoE.nome} pras ${alvoE.d} mortes`;
      ops = ['foi o lag', 'tava abrindo espaço', 'o draft era ruim', 'tava ruim mesmo'];
      maioria = 3; desculpa = um([0, 1, 2]);
    } else {
      const lutas = replays.filter((l) => l.tipo === 'luta' || l.tipo === 'solo').slice(0, 3);
      q = 'Melhor play da partida?';
      ops = lutas.map((l) => pilula(l).replace(/<[^>]+>/g, '').replace(/^\S+\s/, '').replace(/ \(perdemos \d+\)/, '').replace(/ \(\d+ª vez\)/, '').slice(0, 46));
      if (ops.length < 2) ops = [`${craque.amigo ? craque.nome : 'o random'} carregando`, 'o veredito do site'];
    }
    const votantes = embaralhar(amigos);
    const dissidente = votantes.length >= 5 ? votantes.find((n) => n !== alvoE && chance(0.35)) : null;
    const votoDe = (n) => (n === alvoE && desculpa >= 0 ? desculpa : n === dissidente ? (maioria + 1 + Math.floor(r() * (ops.length - 1))) % ops.length : maioria);
    ev.push({ t: 'poll', de: quemPerg.key, id: 'p', q, ops, h: H() });
    votantes.forEach((n) => ev.push({ t: 'vote', poll: 'p', de: n.key, op: votoDe(n) }));
    if (alvoE && tipo !== 'play') ev.push({ t: 'msg', de: alvoE.key, txt: um([[`eu tive ${alvoE.a} assistência`, 'quero recontagem'], ['enquete comprada'], ['vou chamar meus advogados'], ['votei certo pelo menos'], ['vcs não sabem perder', 'nem ganhar']]), h: H() });
    const mochila_ = alvoE;
    if (suporte && suporte.wards >= 6 && chance(0.5)) ev.push({ t: 'msg', de: suporte.key, txt: [`${suporte.wards} ward e ${suporte.a} assistência`, 'e ninguém faz enquete pra me elogiar 😭'], h: H() });
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
  const ult = qualquer(); if (ult && chance(0.6)) ev.push({ t: 'msg', de: ult.key, txt: um(['chega de figurinha', 'next?', 'mais uma?', 'quem joga a próxima']), h: H() });
  return { cenario: 'Guerra de figurinha', grupo, sub, strip: false, P, ev, memoria: [...usados] };
}

root.GERADOR = { gerar, CURTO };
})(typeof window !== 'undefined' ? window : globalThis);
