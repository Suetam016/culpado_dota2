// Tradução do site. Português é o idioma do HTML: nada muda em /.
// Em /es/ e /en/ (ou ?lang=es|en para testar), troca os textos marcados com
// data-i18n / data-i18n-placeholder / -title / -aria-label pelo dicionário.
// Ids, classes e eventos do GTM NUNCA mudam: só o texto visível.
// No JS: t('chave', 'texto em português {x}', {x: 1}).
(function () {
  var m = location.pathname.match(/^\/(es|en)(\/|$)/);
  var q = new URLSearchParams(location.search).get('lang');
  var lang = m ? m[1] : (q === 'es' || q === 'en' ? q : 'pt');
  var dic = {};
  function fmt(s, v) { return v ? s.replace(/\{(\w+)\}/g, function (a, k) { return k in v ? v[k] : a; }) : s; }
  window.I18N_LANG = lang;
  window.t = function (chave, pt, v) { return fmt(dic[chave] != null ? dic[chave] : pt, v); };
  if (lang === 'pt') return;
  document.documentElement.lang = lang;
  function aplicar(raiz) {
    raiz.querySelectorAll('[data-i18n]').forEach(function (el) {
      var s = dic[el.dataset.i18n]; if (s == null) return;
      var o = el.textContent, a = o.match(/^\s*/)[0], b = o.match(/\s*$/)[0];
      el.textContent = a + s + b;
    });
    ['placeholder', 'title', 'aria-label'].forEach(function (at) {
      raiz.querySelectorAll('[data-i18n-' + at + ']').forEach(function (el) {
        var s = dic[el.getAttribute('data-i18n-' + at)]; if (s != null) el.setAttribute(at, s);
      });
    });
  }
  var x = new XMLHttpRequest(); // síncrono de propósito: evita piscar português
  x.open('GET', '/i18n/' + lang + '.json', false);
  try { x.send(); if (x.status === 200) dic = JSON.parse(x.responseText); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { aplicar(document); });
  else aplicar(document);
  window.i18nAplicar = aplicar;
})();
