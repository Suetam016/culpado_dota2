// Lista todas as falas do banco fechado (banco/lista.json), para o robô gravar as que faltam.
const B = require('./banco.js');
const herois = require('./herois.json');
const amigos = Object.values(require('../../../amigos.json'));
const fs = require('fs');
const lista = B.todas(herois, amigos);
fs.mkdirSync(__dirname + '/banco', { recursive: true });
fs.writeFileSync(__dirname + '/banco/lista.json', JSON.stringify(lista, null, 0).replace(/\},\{/g, '},\n{'));
const por = {};
lista.forEach((x) => { const k = x.id.split('.')[0]; por[k] = (por[k] || 0) + 1; });
console.log(lista.length, por);
