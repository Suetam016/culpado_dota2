/* Banco de falas do áudio da vitória: cada frase do roteiro (audio/roteiro.js) é gravada UMA vez na voz do Mat e
 * guardada em audios/banco/<chave>.mp3; o site monta o áudio da partida na hora, emendando as frases já gravadas.
 *
 *   Banco.frases(texto)  -> as frases do roteiro, do jeito que o banco guarda (frase inteira, com a pontuação)
 *   Banco.chave(frase)   -> nome do arquivo da frase no banco (hash curto do texto normalizado)
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

  return { frases: frases, chave: chave };
});
