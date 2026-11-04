/* Roteiro do áudio da vitória: quem carregou manda um áudio debochado no grupo, em primeira pessoa,
 * no estilo daqueles áudios de carioca que viralizam. Cada frase sai de um número real da partida
 * (o resultado do motor do index.html) e vem escrita por extenso, do jeito que a voz vai falar.
 *
 *   Roteiro.fatos(r)            -> os fatos da partida usados no roteiro (ou null se não houver craque)
 *   Roteiro.gerar(fatos, sem)   -> {texto, partes:[{bloco, texto}]} ; a mesma semente dá sempre o mesmo texto
 *   Roteiro.total(fatos)        -> quantos roteiros diferentes dá para montar com esses fatos
 *
 * Fica fora do script do motor de propósito: mexer aqui não muda a versão do motor (que refaria todas as análises).
 * Roda no navegador (window.Roteiro) e no Node (require), sem dependências.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Roteiro = fabrica();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------- números por extenso (a voz lê "trinta e dois", não "32") ----------
  var UN = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
    'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  var DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  var CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function ate999(n, fem) {
    if (n === 100) return 'cem';
    var c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(fem ? CEM[c].replace(/os$/, 'as') : CEM[c]);
    if (r) {
      if (r < 20) p.push(UN[r]);
      else p.push(DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UN[r % 10] : ''));
    }
    var t = p.join(' e ');
    if (fem) t = t.replace(/\bum$/, 'uma').replace(/\bdois$/, 'duas');
    return t;
  }
  function extenso(n, fem) {
    n = Math.round(Math.abs(Number(n) || 0));
    if (n < 1000) return n === 0 ? 'zero' : ate999(n, fem);
    var mil = Math.floor(n / 1000), r = n % 1000;
    var t = (mil === 1 ? '' : ate999(mil, false) + ' ') + 'mil';
    if (r) t += (r < 100 || r % 100 === 0 ? ' e ' : ' ') + ate999(r, fem);
    return t;
  }

  // ---------- sorteio com semente ----------
  function rng(semente) {
    var s = 0, txt = String(semente == null ? 1 : semente);
    for (var i = 0; i < txt.length; i++) s = (s * 31 + txt.charCodeAt(i)) % 2147483646;
    s = ((s * 2654435761) % 2147483646) + 1;
    var f = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    f(); f(); f();
    return f;
  }
  function um(r, a) { return a[Math.floor(r() * a.length)]; }
  function cap(t) { return t.replace(/(^|[.!?]\s+)([a-záéíóúâêôãõç])/g, function (m, a, b) { return a + b.toUpperCase(); }); }

  // nome que dá pra falar: "[Pau]DeCamelo" -> "Pau De Camelo", "Zero™" -> "Zero"
  function falavel(nome) {
    var t = String(nome || '').replace(/[\[\](){}_|™®©]+/g, ' ').replace(/[^\p{L}\p{N}' -]+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!t || !/\p{L}/u.test(t) || !/^[\p{Script=Latin}\d' -]+$/u.test(t)) return null;
    return t.split(' ').map(function (w) {
      var mai = (w.match(/\p{Lu}/gu) || []).length;
      // "MOsCaNdO", "CORREDOR": caixa bagunçada vira "Moscando", "Corredor"; "DeCamelo" vira "De Camelo"
      if (mai >= 3 || (mai >= 2 && w === w.toUpperCase() && w.length > 3)) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w.replace(/([a-z])([A-Z][a-z])/g, '$1 $2');
    }).join(' ');
  }

  var num = function (v) { return Number(v) || 0; };
  var maxChave = function (o) { var m = 0; for (var k in o || {}) if (num(o[k]) > 0 && num(k) > m) m = num(k); return m; };

  // ---------- fatos da partida ----------
  function fatos(r) {
    if (!r || !r.partida || !r.partida.venceu || !(r.craques || []).length) return null;
    var c = r.craques[0], p = c.jogador, raw = p.raw || {};
    var nos = r.nos || [], eles = r.eles || [];
    var outros = nos.filter(function (q) { return q.idx !== p.idx; });
    var soma = function (arr, f) { return arr.reduce(function (a, q) { return a + num(f(q)); }, 0); };
    var nomeDe = function (q) { return falavel(q.nome) || q.heroi.nome; };
    var min = Math.max(1, Math.round(num(r.partida.duracao) / 60));
    var f = {
      partida: r.partida.id,
      conta: p.conta || null,
      eu: falavel(p.nome) || p.heroi.nome,
      heroi: p.heroi.nome,
      fatia: Math.round(c.fatia * 100),
      kills: num(raw.kills), deaths: num(raw.deaths), assists: num(raw.assists),
      gpm: num(raw.gold_per_min),
      dano: num(raw.hero_damage),
      danoPct: Math.round(100 * num(raw.hero_damage) / (soma(nos, function (q) { return q.raw.hero_damage; }) || 1)),
      torre: num(raw.tower_damage),
      torrePct: Math.round(100 * num(raw.tower_damage) / (soma(nos, function (q) { return q.raw.tower_damage; }) || 1)),
      cura: num(raw.hero_healing),
      lh: num(raw.last_hits),
      streak: maxChave(raw.kill_streaks),
      multi: maxChave(raw.multi_kills),
      lado: r.partida.ladoRadiant ? 'Iluminados' : 'Temidos',
      ladoInimigo: r.partida.ladoRadiant ? 'Temidos' : 'Iluminados',
      placarNos: num(r.partida.placarNos), placarEles: num(r.partida.placarEles),
      minutos: min,
      posicao: p.posicao,
    };
    // o inimigo que eu mais matei
    if (r.mortes) {
      var vit = eles.map(function (e) {
        return { e: e, n: (r.mortes[e.idx] || []).filter(function (d) { return d.assassino === p.idx; }).length };
      }).sort(function (a, b) { return b.n - a.n; })[0];
      if (vit && vit.n >= 3) f.vitima = { heroi: vit.e.heroi.nome, nome: nomeDe(vit.e), n: vit.n };
    }
    // o mochila: quem teve menos mérito no meu time
    var lanterna = r.craques.slice().reverse().find(function (v) { return v.jogador.idx !== p.idx; });
    if (lanterna) {
      var w = lanterna.jogador;
      f.mochila = { nome: nomeDe(w), heroi: w.heroi.nome, fatia: Math.round(lanterna.fatia * 100), kills: num(w.raw.kills),
        deaths: num(w.raw.deaths), assists: num(w.raw.assists), gpm: num(w.raw.gold_per_min), dano: num(w.raw.hero_damage),
        posicao: w.posicao };
    }
    // quem mais morreu do meu time (pode ser o mesmo mochila)
    var morredor = outros.slice().sort(function (a, b) { return num(b.raw.deaths) - num(a.raw.deaths); })[0];
    if (morredor && num(morredor.raw.deaths) >= 9) f.morredor = { nome: nomeDe(morredor), heroi: morredor.heroi.nome, deaths: num(morredor.raw.deaths) };
    // o parceiro que ajudou de verdade (o 2º do mérito, se foi longe)
    var vice = r.craques[1];
    if (vice && vice.fatia >= 0.2) f.parceiro = { nome: nomeDe(vice.jogador), heroi: vice.jogador.heroi.nome, fatia: Math.round(vice.fatia * 100) };
    // o mais rico deles e o que mais morreu deles
    var rico = eles.slice().sort(function (a, b) { return num(b.raw.net_worth) - num(a.raw.net_worth); })[0];
    if (rico) f.ricoDeles = { heroi: rico.heroi.nome, nome: nomeDe(rico) };
    var saco = eles.slice().sort(function (a, b) { return num(b.raw.deaths) - num(a.raw.deaths); })[0];
    if (saco && num(saco.raw.deaths) >= 10) f.sacoDeles = { heroi: saco.heroi.nome, nome: nomeDe(saco), deaths: num(saco.raw.deaths) };
    // momentos que o motor achou para mim (virada com a chance de vitória, item caro que não salvou, buyback)
    var ms = ((r.momentos || {})[p.idx] || []);
    ms.forEach(function (m) {
      var x;
      if (m.tipo === 'virada' && (x = /chance de vitória de (\d+)%/.exec(m.prova || ''))) f.virada = { chance: num(x[1]) };
      if (m.tipo === 'item' && !f.itemDeles && (x = /\(([^)]+)\) comprou (.+?) \(/.exec(m.prova || ''))) f.itemDeles = { heroi: x[1], item: x[2] };
      if (m.tipo === 'buyback-deles' && !f.buyback && (x = /\(([^)]+)\) pagou/.exec(m.prova || ''))) f.buyback = { heroi: x[1] };
    });
    return f;
  }

  // ---------- os blocos ----------

  function blocos(f) {
    var X = extenso, xf = function (n) { return extenso(n, true); };
    var pc = X(f.fatia) + ' por cento';
    var b = {};

    b.abertura = [
      'Ô, rapaziada… porra. Bom dia pra quem tá vivo, né, porque os ' + f.ladoInimigo + ' não tão.',
      'Alô, alô, grupo. Aqui é o ' + f.eu + ', tá? Grava aí, grava aí.',
      'Mermão… tô até rouco aqui, tá ligado? Rouco de tanto carregar.',
      'Seguinte, rapaziada, papo reto, sem neurose:',
      'Ih, ó, tá gravando? Tá gravando. Então presta atenção, hein.',
      'Rapaziada, bom dia, boa tarde, boa noite, e boa sorte pra quem jogou contra mim.',
      'Ó o áudio do pai aí, ó. Pode botar no viva-voz que eu deixo.',
      'Caralho, mermão. Ainda tô tremendo aqui. Escuta só.',
      'Vou mandar áudio porque digitando não dá pra sentir a emoção, tá ligado?',
      'Fala, grupo dos dependentes. Aqui é o responsável de vocês falando.',
      'Aê, ' + X(f.placarNos) + ' a ' + X(f.placarEles) + ', hein? ' + X(f.placarNos) + ' a ' + X(f.placarEles) + '. Senta que lá vem história.',
      'Antes de qualquer coisa: eu avisei. Eu avisei no lobby que hoje era dia.',
    ];

    b.carreguei = [
      'O site tá aí pra provar: ' + pc + ' do mérito na minha conta. Na minha conta, rapá!',
      'De ' + f.heroi + ', mermão, de ' + f.heroi + '! ' + cap(pc) + ' do mérito. Não é o boneco, é quem tá jogando.',
      'Quem carregou? Eu. ' + cap(pc) + ', porra! Podia cobrar frete de vocês, sério.',
      'Craque da partida, tá ligado? Eu. O site falou, não fui eu que falei. ' + cap(pc) + ' do mérito.',
    ];
    if (f.fatia >= 30) b.carreguei.push(
      'Carreguei essa merda, tá ligado? ' + pc + ' do mérito! ' + cap(X(f.fatia)) + '! O resto vocês dividiram igual pão de sal no fim da festa.',
      'Fiz ' + pc + ' do jogo. Se fosse empresa, eu era o sócio majoritário e vocês eram estagiário sem vale-transporte.',
      'Peguei o time no colo, botei pra arrotar e ainda troquei a fralda. ' + cap(pc) + ' do mérito, tá bom?',
      cap(pc) + '. Repete comigo: ' + pc + '. Isso não é carregar, isso é mudança, é caminhão de mudança.'
    );
    else b.carreguei.push(
      cap(pc) + ' do mérito. Não carreguei sozinho não, vou ser humilde. Mas o volante era meu, tá ligado? O volante era meu.',
      'Foi trabalho em equipe, tá? Eu trabalhei e a equipe assistiu. ' + cap(pc) + ' do mérito.',
      cap(pc) + '. Num time de cinco, mermão, isso é ser o pai da família. O resto é filho que mora em casa com trinta anos.'
    );
    if (f.fatia >= 35) b.carreguei.push(
      cap(pc) + ' do mérito, mermão. Eu sozinho. Vocês quatro juntos não fizeram metade do que eu fiz.',
      'Mais de um terço do jogo foi eu, porra. ' + cap(pc) + '. O resto foi figurante da Globo, só passando no fundo.'
    );

    // destaques: cada grupo é um fato; o áudio usa dois fatos diferentes
    var d = [];
    if (f.vitima) {
      var v = f.vitima, n = xf(v.n);
      d.push([
        'A porra do ' + v.heroi + ' deles? Matei ' + n + ' vezes, porra! ' + cap(n) + '! O cara mudou de rota, mudou de vida, mudou de CPF, e eu lá, em cima dele.',
        'O maluco de ' + v.heroi + ' morreu pra mim ' + n + ' vezes. ' + cap(n) + '! Já tava pagando aluguel na minha fonte.',
        'Esse ' + v.heroi + ' aí virou meu freguês, tá ligado? ' + cap(n) + ' vezes. ' + (v.n >= 5 ? 'Na próxima eu dou cartão fidelidade, a décima é grátis.' : 'Já tá no meu caderninho de fiado.'),
        'Pergunta pro ' + v.heroi + ' deles quem é o pai. Pergunta! ' + cap(n) + ' vezes ele foi pra fonte por minha causa.',
        'Cancelei o CPF do ' + v.heroi + ' ' + n + ' vezes, mermão. ' + cap(n) + '! O cara tá no Serasa da fonte até agora.',
        'Fatiei o ' + v.heroi + ' deles ' + n + ' vezes. Fatiei igual pão de forma, rapá.',
        'Botei o ' + v.heroi + ' pra mamar ' + n + ' vezes, tá ligado? ' + cap(n) + '! Mamou e ainda pediu mais.',
        'Arregacei o ' + v.heroi + ' ' + n + ' vezes. ' + cap(n) + '. Se ele abrir o Dota amanhã, vai abrir com medo.',
      ]);
    }
    if (f.streak >= 7) {
      var s = X(f.streak);
      d.push([
        'Fiz ' + s + ' de sequência sem morrer, caralho. ' + cap(s) + '! Os caras já tavam pedindo música no Fantástico.',
        cap(s) + ' abates seguidos, mermão, sem morrer! O narrador já tava sem voz de tanto gritar.',
        'Sequência de ' + s + ', porra. Os caras só respawnavam pra me dar ouro de novo. Eu cancelando CPF e eles pagando a taxa de entrega.',
      ]);
    }
    // triple kill não conta (o Mat acha irrelevante); rampage, sim
    if (f.multi >= 5) d.push([
      'Rampage, porra! Cancelei o CPF do time inteiro de uma vez. Cinco! O chat deles ficou mudo.',
      'Fiz rampage, mermão. Arregacei os cinco numa luta só. Pode procurar no replay, tá lá.',
    ]);
    if (f.dano >= 25000) {
      var dm = X(Math.round(f.dano / 1000)) + ' mil';
      var gd = [
        cap(dm) + ' de dano nos heróis, rapá. ' + cap(dm) + '! Eu não tava batendo, eu tava cobrando dívida.',
        'Dei ' + dm + ' de dano, ' + X(f.danoPct) + ' por cento do time. Os outros quatro dividiram as sobras igual marmita.',
      ];
      if (f.mochila && f.mochila.dano > 0 && f.dano >= 2 * f.mochila.dano) gd.push(cap(dm) + ' de dano, mais que o dobro do ' + f.mochila.nome + '. Mais que o dobro, porra! E ainda querem dividir o mérito.');
      d.push(gd);
    }
    if (f.deaths <= 2 && f.minutos >= 25) {
      d.push(f.deaths === 0
        ? ['Zero mortes, tá ligado? Zero! O respawn nem sabe quem eu sou. Minha fonte tá com plástico ainda.',
          'Não morri nenhuma vez, mermão. Nenhuma! Os caras nem sabem a cor da minha tela cinza.']
        : ['Morri ' + xf(f.deaths) + ' ' + (f.deaths === 1 ? 'vez' : 'vezes') + ' em ' + X(f.minutos) + ' minutos. Tava jogando de tornozeleira, na humildade, sem me expor.']);
    }
    if (f.gpm >= 600) d.push([
      cap(X(f.gpm)) + ' de ouro por minuto, mermão. O mapa pagava pensão pra mim. Eu tava farmando igual agiota cobrando.',
      cap(X(f.gpm)) + ' de ouro por minuto. Eu não farmo, eu faço declaração de imposto de renda.',
    ]);
    if (f.torre >= 6000 && f.torrePct >= 40) d.push(['Derrubei ' + X(f.torrePct) + ' por cento das torre sozinho, porra. Demolição sem alvará. A prefeitura deles tá até agora tentando entender.']);
    if (f.cura >= 6000) d.push(['Curei ' + X(Math.round(f.cura / 1000)) + ' mil de vida. Virei o SUS do time, só que com atendimento rápido, sem fila.']);
    if (f.virada) d.push([
      'E presta atenção: a gente tava com ' + X(f.virada.chance) + ' por cento de chance. ' + cap(X(f.virada.chance)) + '! Eu virei essa porra nas costas, tá ligado? Virei!',
      'Os caras tavam comemorando, mermão. A gente com ' + X(f.virada.chance) + ' por cento de chance. Aí o papai acordou.',
    ]);
    if (f.itemDeles) d.push(['O ' + f.itemDeles.heroi + ' deles comprou ' + f.itemDeles.item + ', todo pimpão. Nem estreou, mermão. Morreu com a nota fiscal na mão.']);
    if (f.buyback) d.push(['O ' + f.buyback.heroi + ' pagou buyback e voltou correndo… pra morrer pra mim de novo. Jogou dinheiro fora, igual aposta no tigrinho.']);
    if (f.kills >= 15) d.push([
      'Arregacei ' + X(f.kills) + ' vezes. ' + cap(X(f.kills)) + '! Tem time inteiro que não faz isso numa semana.',
      cap(X(f.kills)) + ' abates, porra. Fatiei esses caras igual churrasco de domingo.',
    ]);
    if (d.length < 2) d.push([
      'Fiz ' + X(f.kills) + ', morri ' + xf(f.deaths) + ' e dei ' + X(f.assists) + ' assistências. Isso aí é currículo, mermão, isso é Lattes.',
      'Tava em todas as lutas, igual Wi-Fi de shopping. Onde tinha briga, tinha eu.',
    ]);
    b.destaque = d;

    var m = [];
    if (f.mochila) {
      var w = f.mochila, wd = xf(w.deaths);
      m.push(
        'Agora, ' + w.nome + '… de ' + w.heroi + ', ' + X(w.fatia) + ' por cento do mérito. Mochila de pedra, irmão. Eu carregando e tu sentado lá dentro.',
        'Vou ser justo com o ' + w.nome + ': ele tava no jogo. Tava. Isso eu não posso negar. Mais nada.',
        w.nome + ' de ' + w.heroi + ' sumiu igual pai que foi comprar cigarro. ' + cap(X(w.fatia)) + ' por cento do mérito. Volta pra casa, ' + w.nome + '!'
      );
      if (w.deaths >= 8) m.push(
        'E o ' + w.nome + ', hein? De ' + w.heroi + ', ' + wd + ' mortes. ' + cap(wd) + '! O cara não é carry, é delivery: entregou tudo.',
        w.nome + ' morreu ' + wd + ' vezes, rapaziada. ' + cap(wd) + '. Os inimigo já tavam botando ele no orçamento do mês.'
      );
      if (w.gpm && f.gpm >= w.gpm + 150) m.push('Eu com ' + X(f.gpm) + ' de ouro por minuto e ' + w.nome + ' com ' + X(w.gpm) + '. Tava farmando ou tava passeando no shopping, porra?');
      if (w.posicao === 1) m.push('O nosso carry, ' + w.nome + '… carry de quê, mermão? Carry de sacola de mercado? ' + cap(X(w.fatia)) + ' por cento do mérito!');
    }
    if (f.morredor && (!f.mochila || f.morredor.nome !== f.mochila.nome)) m.push('E o ' + f.morredor.nome + ' morreu ' + xf(f.morredor.deaths) + ' vezes. Não é jogador, é patrocinador do time deles.');
    if (f.parceiro) m.push('Vou dar o crédito: ' + f.parceiro.nome + ' ajudou, ' + X(f.parceiro.fatia) + ' por cento. O resto foi torcida organizada, só gritando.');
    if (!m.length) m.push('O resto do time? Bonito de ver. Igual enfeite de bolo, não serve pra nada mas fica bonito.');
    b.mochila = m;

    var z = [
      'Os ' + f.ladoInimigo + ' tão até agora no chat digitando report. Pode reportar, meu filho, o replay tá aí.',
      cap(X(f.placarEles)) + ' abates eles fizeram. ' + cap(X(f.placarEles)) + '. Eu fiz ' + X(f.kills) + ' sozinho, vê se pode.',
    ];
    if (f.sacoDeles) z.push('O ' + f.sacoDeles.heroi + ' deles morreu ' + xf(f.sacoDeles.deaths) + ' vezes. Coitado. Vou até mandar um pix pra ele comprar um mouse novo.');
    if (f.ricoDeles && (!f.vitima || f.ricoDeles.heroi !== f.vitima.heroi)) z.push('O ' + f.ricoDeles.heroi + ' deles era o mais rico do jogo. Rico e morto, igual herdeiro de novela.');
    if (f.minutos <= 30) z.push('Acabou em ' + X(f.minutos) + ' minutos, rapá. Nem deu tempo de esquentar o miojo.');
    if (f.minutos >= 50) z.push(cap(X(f.minutos)) + ' minutos de jogo, mermão. Joguei um campeonato inteiro numa partida só.');
    b.inimigo = z;

    b.fecho = [
      'É isso. Pode mandar o pix, tá tranquilo. Tá no replay, ó. Tá no replay!',
      'Respeita, sacou? Respeita. Beijo pros ' + f.ladoInimigo + ' que tão chorando na fonte até agora.',
      'Valeu, rapaziada. Amanhã tem mais, se vocês não me atrapalharem.',
      'Fui. Vou tomar uma água que eu carreguei peso demais hoje.',
      'Pode printar, pode mandar pra família. É o ' + f.eu + ', porra!',
      'E não precisa agradecer não, tá? Mas se quiser agradecer, eu aceito.',
      'Quem quiser aula particular, é só chamar. Cobro barato, aceito pix.',
      'Beijo, me liga. Na verdade não liga não, que eu tô ocupado carregando outro jogo.',
      'Tá bom? Tá bom. Fica com Deus, que comigo vocês já ficaram.',
    ];
    return b;
  }

  var ORDEM = ['abertura', 'carreguei', 'destaque', 'destaque', 'mochila', 'inimigo', 'fecho'];

  var MAX_PALAVRAS = 100;   // ~35 s de áudio: mais que isso o grupo não escuta (e a voz demora mais para gravar)
  var palavras = function (t) { return t.split(/\s+/).length; };

  function gerar(f, semente) {
    if (!f) return null;
    var r = rng(semente), b = blocos(f), usadas = {}, partes = [];
    var comInimigo = r() < 0.35;
    var grupos = b.destaque.slice();
    ORDEM.forEach(function (k) {
      if (k === 'inimigo' && !comInimigo) return;
      if (k === 'destaque') {
        if (!grupos.length) return;
        var gi = Math.floor(r() * grupos.length);
        partes.push({ bloco: k, texto: cap(um(r, grupos.splice(gi, 1)[0])) });
        return;
      }
      var livres = b[k].filter(function (t) { return !usadas[t]; });
      if (!livres.length) return;
      var t = um(r, livres);
      usadas[t] = 1;
      partes.push({ bloco: k, texto: cap(t) });
    });
    // passou do tamanho: sai a zoeira do inimigo, depois o segundo destaque
    ['inimigo', 'destaque'].forEach(function (k) {
      var total = partes.reduce(function (a, p) { return a + palavras(p.texto); }, 0);
      if (total <= MAX_PALAVRAS) return;
      for (var i = partes.length - 1; i >= 0; i--) {
        if (partes[i].bloco === k && partes.filter(function (p) { return p.bloco === k; }).length > (k === 'destaque' ? 1 : 0)) { partes.splice(i, 1); break; }
      }
    });
    return { texto: partes.map(function (p) { return p.texto; }).join(' '), partes: partes };
  }

  function total(f) {
    if (!f) return 0;
    var b = blocos(f), pares = 0, g = b.destaque.map(function (x) { return x.length; });
    for (var i = 0; i < g.length; i++) for (var j = 0; j < g.length; j++) if (i !== j) pares += g[i] * g[j];
    var n = b.abertura.length * b.carreguei.length * Math.max(1, pares) * b.mochila.length * b.fecho.length;
    return n + n * b.inimigo.length;
  }

  return { fatos: fatos, gerar: gerar, total: total, extenso: extenso, falavel: falavel };
});
