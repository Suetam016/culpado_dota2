/* Banco de falas do áudio da vitória: cada frase do roteiro (audio/roteiro.js) é gravada UMA vez na voz do Mat e
 * guardada em audios/banco/<chave>.mp3; o site monta o áudio da partida na hora, emendando as frases já gravadas.
 *
 *   Banco.frases(texto)  -> as frases do roteiro, do jeito que o banco guarda (frase inteira, com a pontuação)
 *   Banco.chave(frase)   -> nome do arquivo da frase no banco (hash curto do texto normalizado)
 *   Banco.audios(partes) -> o roteiro dividido em áudios curtos para a conversa do zap (?conversa=1): cada áudio é
 *                           gravado de uma vez só (sem emenda) e os amigos respondem entre um e outro
 *
 * Usado pelo site (window.Banco) e pelo robô que grava as frases que faltam (prototipos/banco-falas/faltam.js), para
 * os dois cortarem e nomearem as frases do mesmo jeito.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Banco = fabrica();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function frases(texto) {
    return (String(texto || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
      .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return /\p{L}/u.test(s); });
  }

  // FNV-1a de 32 bits sobre o texto normalizado (minúsculas, espaços simples); a pontuação fica, porque muda a fala
  function chave(frase) {
    var s = String(frase).toLowerCase().replace(/\s+/g, ' ').trim();
    var h = 0x811c9dc5;
    var bytes = unescape(encodeURIComponent(s));
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  // abre (abertura + carreguei), prova (os destaques), mochila (zoa o mais fraco do time) e fecho (inimigo + fecho)
  var GRUPOS = [['abre', ['abertura', 'carreguei']], ['prova', ['destaque']], ['mochila', ['mochila']], ['fecho', ['inimigo', 'fecho']]];
  function audios(partes) {
    return GRUPOS.map(function (g) {
      var t = (partes || []).filter(function (p) { return g[1].indexOf(p.bloco) >= 0; }).map(function (p) { return p.texto; }).join(' ');
      return { tipo: g[0], texto: t.replace(/\s+/g, ' ').trim() };
    }).filter(function (a) { return a.texto; });
  }

  return { frases: frases, chave: chave, audios: audios };
});
