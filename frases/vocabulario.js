/* Vocabulário das zoeiras — o banco de frases dos momentos da vitória (e de quem mais quiser reaproveitar).
*
* Sem DOM: no navegador vira window.VOCABULARIO (o index.html carrega antes do motor); no Node, require().
* O motor (momentosDaVitoria no index.html) acha o lance e os números; aqui só mora o texto. Mudar frase aqui
* não muda a versão do motor, então o ranking não reanalisa nada.
*
* Tom pedido pelo Mat (04/11/2026): gíria de quem joga Dota no Brasil (solou, cancelou o CPF, fatiou e passou,
* botou pra mamar, arregaçou, dieback...), engraçado e meio absurdo, nada de metáfora de IA ("como quem procura
* Pokémon") nem termo de outro jogo ("surrender"). Cada lance precisa de muitas versões: a tela sorteia e foge das
* frases que a pessoa viu nas últimas partidas.
*
* frases.<tipo>(dados) devolve a lista de versões da frase em negrito de um momento; os tipos e os dados são os de
* r.momentos[idx][i].tipo e .dados.
*/
(function (root, factory) {
const v = factory();
if (typeof module === 'object' && module.exports) module.exports = v;
else root.VOCABULARIO = v;
})(typeof self !== 'undefined' ? self : this, function () {
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// matar alguém (x = nome do herói), no passado, terceira pessoa
const matar = (x) => [
`cancelou o CPF de ${x}`,
`fatiou ${x} e passou`,
`botou ${x} pra mamar`,
`desligou ${x}`,
`abateu ${x}`,
`arregaçou ${x}`,
`mandou ${x} de volta pra fonte`,
`apagou ${x}`,
`deletou ${x}`,
`amassou ${x}`,
`carimbou ${x}`,
`despachou ${x} pro cinza`,
`jantou ${x}`,
`passou o rodo em ${x}`,
];
// matar sozinho, sem ajuda
const solar = (x) => [
`solou ${x}`,
`pegou ${x} no x1`,
`fatiou ${x} sozinho e passou`,
`cancelou o CPF de ${x} no mano a mano`,
`botou ${x} pra mamar no x1`,
`foi sozinho buscar ${x} e voltou com a cabeça`,
`resolveu ${x} no mano a mano`,
`arregaçou ${x} sem pedir ajuda`,
];
// alguém morrer muito (x = nick do aliado)
const morrer = (x) => [
`${x} distribuía ouro pro inimigo`,
`${x} fazia turismo na fonte`,
`${x} mamava o inimigo`,
`${x} vivia no cinza`,
`${x} patrocinava o time deles`,
`${x} batia ponto na fonte`,
`${x} alimentava o inimigo de colherzinha`,
];

const frases = {
virada: ({ forte }) => [
...(forte ? [
'Pegou um jogo com cheiro de GG e virou no braço',
'Ressuscitou um jogo que já tinha atestado de óbito',
'O time já tinha escolhido o caixão; ele cancelou o velório',
'Quando o chat já pedia GG, ele pediu calma',
'Jogo perdido? Avisaram todo mundo, menos ele',
'Virada de novela das nove, com ele de protagonista',
'Tirou leite de pedra e ainda vendeu o queijo',
'Fez o inimigo se arrepender de não ter fechado o jogo',
] : []),
'Desatolou o jogo quando o time estava afundando',
'Pegou o jogo torto e endireitou na marra',
'Transformou o "dá pra ganhar?" em "ganhamos"',
'Tirou o time do buraco com as próprias mãos',
'O jogo tava escorregando e ele segurou pelo colarinho',
'O inimigo tava na frente até ele resolver jogar',
'Botou o time nas costas e saiu do buraco',
'Virou o jogo e ainda apagou a luz do outro lado',
],
solo: ({ vitima, rico, vezes }) => {
const x = vitima;
if (vezes >= 2) {
return [
`Solou ${x} ${vezes} vezes`,
`${x} foi pro x1 com ele ${vezes} vezes e perdeu todas`,
`Fez de ${x} freguês de x1: ${vezes} a 0`,
`Pegou ${x} sozinho ${vezes} vezes e nunca precisou de ajuda`,
`${x} pediu revanche e ele ${vezes === 2 ? 'solou de novo' : `solou ${vezes} vezes`}`,
];
}
return [
...solar(x).map(cap),
...(rico ? [
`${cap(solar(x)[0])}, o mais rico deles`,
`Pegou o dinheiro todo de ${x} no x1`,
`${x} tinha o maior patrimônio deles e mesmo assim foi solado`,
] : []),
`Chamou ${x} pro x1 e ${x} topou. Erro dele`,
`Mano a mano com ${x}: ganhou e ainda cobrou o ingresso`,
`${x} achou que dava pra trocar com ele. Não dava`,
];
},
rico: ({ vitima, vezes }) => {
const x = vitima;
if (vezes >= 2) {
return [
...matar(x).slice(0, 10).map((m) => `${cap(m)}, o mais rico deles, ${vezes} vezes`),
`Fez ${x} descobrir que dinheiro não compra respawn`,
`Cobrou IPTU da mansão de ${x} ${vezes} vezes`,
`Assaltou o banco deles: ${x} morreu ${vezes} vezes`,
`${x} tinha a carteira mais gorda do jogo e ele foi lá ${vezes} vezes buscar`,
];
}
return [
`Pegou ${x}, o mais rico deles, dando bobeira`,
`Achou ${x}, o dono do dinheiro deles, sozinho no mapa`,
`Fez ${x} descobrir que dinheiro não compra respawn`,
`${x} era o mais rico deles e ele fez questão de lembrar que isso não é imortalidade`,
...matar(x).slice(0, 6).map((m) => `${cap(m)}, o mais rico deles, longe de qualquer luta`),
];
},
pickoff: () => [
'Caçou os cores deles e não deu paz pra eles',
'Os cores deles não podiam farmar em paz',
'Fez os cores deles farmarem olhando pro minimapa',
'Rondou o mapa e botou os cores deles pra mamar',
'Os cores deles não tinham sossego nem na selva',
'Achava core deles sozinho e cancelava o CPF',
'Transformou o farm dos cores deles em esporte de risco',
],
split: ({ ancient, longe, grande, puxou, vivo }) => {
if (ancient) {
return [
'Fez o clássico "segura aí que eu vou no Ancestral"',
'Enquanto todo mundo brigava, ele foi lá e desligou o jogo',
'Entrou pela porta dos fundos e terminou o jogo',
'Ninguém viu ele chegar, todo mundo viu o Ancestral cair',
'Deixou a briga pros outros e foi direto no Ancestral',
];
}
const out = [];
if (puxou >= 2) {
out.push(
`Puxou ${puxou} deles de volta pra defender e ainda saiu vivo`,
`Fez ${puxou} deles largarem tudo pra voltar pra casa${vivo ? ', e escapou' : ''}`,
`Sozinho no split, prendeu ${puxou} deles na defesa`,
`Virou o problema de ${puxou} deles ao mesmo tempo`,
);
}
if (longe) {
out.push(
'Fez o clássico "segura aí que eu vou na torre"',
'Enquanto o time brigava, ele foi fazer obra na base deles',
'Sumiu do mapa e voltou com uma estrutura no bolso',
'Abriu uma segunda frente e eles não deram conta',
'Golpe do split: briga lá, prédio caindo cá',
'Deixou a luta com o time e foi cobrar pedágio na lane',
);
} else {
out.push(
...(grande ? [
'Time no cemitério e ele na base deles, demolindo',
'Com o time todo morto, ele seguiu batendo em prédio',
'Time todo na fonte e ele fazendo hora extra na base deles',
] : [
'Time no cemitério e ele batendo em torre',
'Com o time todo morto, ele seguiu trabalhando na obra',
]),
'O time morreu, mas a obra não parou',
'Enquanto o time esperava o respawn, ele seguia empurrando',
'Ficou sozinho no mapa e mesmo assim não parou de derrubar coisa',
);
}
if (vivo) out.push('Fez o split, derrubou e ainda voltou pra casa inteiro');
return out;
},
defesa: ({ sozinho }) => (sozinho ? [
'Segurou a base praticamente sozinho',
'Defesa da base no modo solo',
'Fez a defesa da base sozinho e nem pediu ajuda',
'Um contra a invasão inteira, e a invasão perdeu',
'Trancou a porta de casa sozinho e jogou a chave fora',
] : [
'Eles subiram a high ground e voltaram com o rabo entre as pernas',
'Trancou a porta de casa na cara deles',
'Eles vieram buscar o Ancestral e levaram um wipe',
'Subiram a rampa cheios de marra e desceram pela fonte',
'A high ground virou cemitério deles',
'Invadiram a casa errada',
'Eles tocaram a campainha e ele atendeu com a porrada',
]),
abriu: ({ quarteis }) => [
'Abriu a porta da base deles na porrada',
'Ganhou a luta e foi cobrar o aluguel na base deles',
'Limpou a frente e o time subiu a rampa',
'Ganhou a briga e já foi subindo a high ground',
...(quarteis ? [
'Ganhou a luta e foi direto nos quartéis',
'Wipe com entrega em domicílio nos quartéis',
'Apagou o time deles e foi demolir os quartéis',
'Luta ganha, quartel no chão, sem nem respirar',
] : []),
],
fechou: () => [
'Ganhou a última luta e foi pessoalmente desligar o jogo',
'Apagou o time deles e foi buscar o Ancestral',
'Fechou a partida do jeito certo: luta ganha e Ancestral no chão',
'Deu o último wipe e mandou o GG',
'Botou o time deles pra mamar uma última vez e encerrou o expediente',
'Apagou a luz, trancou a porta e foi embora com o Ancestral',
'Última luta, último wipe, último prego no caixão',
'Fez o time deles assistir o Ancestral cair da fonte',
],
buyback: ({ emCasa }) => (emCasa ? [
'Pagou o buyback e salvou a casa',
'Comprou a volta e salvou o Ancestral',
'Voltou da fonte de táxi pra salvar a base',
'O buyback mais bem pago da história daquela base',
'Pagou pra voltar e não deixou derrubarem a casa',
'Gastou o buyback e economizou uma derrota',
'Voltou correndo da fonte e fechou a porta na cara deles',
] : [
'Pagou o boleto do buyback e voltou pra resolver',
'Morreu, comprou a volta e ganhou a luta',
'Gastou o ouro do buyback e cobrou com juros',
'Voltou do além com o boleto pago',
'Comprou a volta e a luta virou dele',
'Pagou pra voltar e fez valer cada moeda',
]),
'buyback-deles': ({ vitima }) => {
const x = vitima;
return [
`Transformou o buyback de ${x} em dieback`,
`${x} pagou buyback só pra morrer pra ele de novo`,
`Mandou ${x} de volta pra fonte com o boleto do buyback ainda quente`,
`Fez o buyback de ${x} virar doação`,
`${x} comprou a volta e ele devolveu sem troco`,
`${x} pagou caro pra voltar e ele ${matar(x)[0]} de novo`,
`Buyback de ${x}? Dieback`,
];
},
item: ({ vitima, item, segundos }) => {
const x = vitima;
return [
`${x} comprou ${item} e não deu nem tempo de estrear`,
`${item} novinho, ainda com plástico, e ${x} já estava na fonte`,
`${x} saiu da loja com ${item} e entrou direto no cinza`,
`Nem deu tempo de ${x} tirar print do ${item}`,
`${x} montou ${item} e ele fez questão de estragar a estreia`,
`O ${item} de ${x} durou ${segundos} s, menos que a garantia`,
`${x} gastou tudo no ${item} e ele ${matar(x)[1]}`,
];
},
anulou: ({ rival, rota }) => {
const x = rival;
return [
`Acabou com o jogo de ${x} na rota, e ${x} nunca mais se recuperou`,
`Botou ${x} pra mamar na rota e ${x} nunca mais voltou pro jogo`,
`Arregaçou a rota de ${x} e o jogo dele acabou ali`,
`${x} saiu da rota precisando de terapia`,
`${x} entrou na rota com ele e saiu sem jogo`,
`Deixou ${x} sem ouro, sem XP e sem autoestima`,
...(rota === 'mid' ? [`Arrombou a mid de ${x}`, `Fez ${x} desistir da mid antes dos 10 min`] : []),
];
},
rota: ({ rival, rota }) => {
const x = rival;
const nome = { mid: 'a mid', safe: 'a safe', off: 'a offlane' }[rota] || 'a rota';
return [
`Atropelou ${x} na rota`,
`Arregaçou ${nome} contra ${x}`,
`Botou ${x} pra mamar na rota`,
`${x} passou a fase de rotas apanhando`,
`Fez ${x} farmar com medo`,
`${cap(nome)} contra ${x} foi um passeio`,
...(rota === 'mid' ? [`Arrombou a mid`, `Fez de ${x} saco de pancada na mid`] : []),
];
},
mid: () => [
'Saía da mid pra gankar e voltava com abate',
'Mid que não fica na mid: rodou o mapa e cobrou pedágio',
'Pegou runa e foi visitar os vizinhos',
'Rodou o mapa e deixou as outras rotas de luto',
'Gankou o mapa inteiro antes dos 12 min',
'Deixou a mid e foi arregaçar as outras rotas',
],
stack: ({ carry }) => [
`Montou o self-service da selva pro ${carry}`,
`Stackou a selva e entregou ${carry} pronto pra servir`,
`Encheu a selva de stack e ${carry} só passou a foice`,
`Fez a feira do ${carry} e ainda carregou as sacolas`,
`Deixou a selva no ponto pro ${carry} farmar`,
`Fez o ${carry} ficar rico sem sair do lugar`,
`Empilhou neutro pro ${carry} como quem enche a geladeira`,
],
enquanto: ({ parceiro }) => {
const x = parceiro;
return [
...morrer(x).map((m) => `Enquanto ${m}, ele resolvia`),
`Enquanto ${x} distribuía ouro pro inimigo, ele cobrava de volta com juros`,
`${x} abriu a torneira de ouro pro inimigo e ele foi fechando`,
`Enquanto ${x} fazia turismo na fonte, ele pagava as contas da casa`,
`${x} patrocinou o time deles; ele mandou a fatura de volta`,
`${x} morria de um lado, ele matava do outro`,
`${x} ficou no cinza, ele ficou no comando`,
];
},
};

return { cap, matar, solar, morrer, frases };
});
