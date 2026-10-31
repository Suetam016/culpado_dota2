// O cartaz para mandar no grupo, como o do Dota: uma imagem 1080x1350 com o papel da culpa (Procura-se, B.O., Interpol,
// Haia ou Tribunal) ou, na vitória, o craque da partida. Só navegador: window.CartazLoL.imagem(dados) → Promise<Blob>.
(function (raiz) {
  'use strict';

  const W = 1080, H = 1350, M = 80;
  // cores de cada papel: [fundo, fundo 2, tinta, tinta 2, destaque, faixa do topo ou null]
  const ESTILO = {
    wanted: ['#ecd7a6', '#c9a86b', '#2a1d10', '#5b4630', '#8a1c12', null],
    bo: ['#f7f5ef', '#e6e3da', '#1b2433', '#4a5568', '#1d3f78', '#1d3f78'],
    interpol: ['#10213f', '#0b1830', '#eef2fa', '#aab6cc', '#ff6b5b', '#b3261e'],
    haia: ['#eaf1f8', '#d3e1ef', '#10263f', '#46607d', '#1d5fa3', null],
    tpi: ['#141009', '#050403', '#f3e6c4', '#b9a77d', '#e8b04a', null],
    vitoria: ['#10261a', '#06120b', '#eefaf0', '#a9cdb3', '#e4ae39', null],
  };

  function carregarImagem(url) {
    return new Promise((ok) => {
      if (!url) return ok(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = url;
      setTimeout(() => ok(null), 6000);
    });
  }

  // quebra o texto em linhas que cabem na largura; devolve a altura usada
  function escrever(ctx, texto, x, y, larg, alt, max = 99) {
    const palavras = String(texto).split(/\s+/);
    const linhas = [];
    let atual = '';
    for (const p of palavras) {
      const t = atual ? `${atual} ${p}` : p;
      if (ctx.measureText(t).width > larg && atual) { linhas.push(atual); atual = p; } else atual = t;
    }
    if (atual) linhas.push(atual);
    const usadas = linhas.slice(0, max);
    if (linhas.length > max) usadas[max - 1] = usadas[max - 1].replace(/\s*\S*$/, '…');
    usadas.forEach((l, i) => ctx.fillText(l, x, y + i * alt));
    return usadas.length * alt;
  }

  async function imagem(d) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
    const [fundo, fundo2, tinta, tinta2, destaque, faixa] = ESTILO[d.papel] || ESTILO.wanted;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(W * 0.35, H * 0.2, 80, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, fundo); g.addColorStop(1, fundo2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = destaque; ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let y = 70;
    if (faixa) { ctx.fillStyle = faixa; ctx.fillRect(28, 28, W - 56, d.faixa ? 300 : 240); }
    const corTopo = faixa ? '#ffffff' : tinta;
    ctx.fillStyle = faixa ? 'rgba(255,255,255,.85)' : tinta2;
    ctx.font = '700 30px "Alegreya Sans", sans-serif';
    if (d.org) { y += 50; ctx.fillText(d.org.toUpperCase().split('').join(' '), W / 2, y); }
    ctx.fillStyle = faixa ? corTopo : destaque === '#e8b04a' || d.papel === 'vitoria' ? destaque : tinta;
    ctx.font = '900 112px Cinzel, Georgia, serif';
    y += 120;
    ctx.fillText(d.titulo.toUpperCase(), W / 2, y);
    if (d.faixa) { ctx.font = '700 38px Cinzel, Georgia, serif'; ctx.fillStyle = faixa ? corTopo : destaque; y += 56; ctx.fillText(d.faixa, W / 2, y); }
    y = faixa ? (d.faixa ? 370 : 310) : y + 50;

    // retrato
    const img = await carregarImagem(d.iconeUrl);
    const lado = 240;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(W / 2 - lado / 2 + 10, y + 12, lado, lado);
    ctx.fillStyle = fundo2;
    ctx.fillRect(W / 2 - lado / 2, y, lado, lado);
    if (img) {
      if (d.papel === 'wanted') ctx.filter = 'sepia(0.7) contrast(1.05)';
      ctx.drawImage(img, W / 2 - lado / 2, y, lado, lado);
      ctx.filter = 'none';
    }
    ctx.lineWidth = 10; ctx.strokeStyle = d.papel === 'vitoria' || d.papel === 'tpi' ? destaque : tinta;
    ctx.strokeRect(W / 2 - lado / 2, y, lado, lado);
    ctx.restore();
    y += lado + 76;

    ctx.fillStyle = tinta;
    ctx.font = '900 72px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    y += escrever(ctx, d.nome, W / 2, y, W - 2 * M, 76, 1);
    ctx.font = 'italic 500 38px "Alegreya Sans", sans-serif';
    ctx.fillStyle = tinta2;
    if (d.vulgo) { ctx.fillText(d.vulgo, W / 2, y + 4); y += 50; }
    y += 30;

    // acusações ou provas
    ctx.textAlign = 'left';
    const limite = H - 290; // o número grande e o rodapé ficam abaixo disso
    for (const l of d.linhas.slice(0, 3)) {
      if (y + (l.prova ? 80 : 44) > limite) break;
      ctx.fillStyle = destaque;
      ctx.font = '800 38px "Alegreya Sans", sans-serif';
      ctx.fillText('•', M, y);
      ctx.fillStyle = tinta;
      y += escrever(ctx, l.crime, M + 36, y, W - 2 * M - 36, 44, y + 130 > limite ? 1 : 2);
      if (l.prova) {
        ctx.fillStyle = tinta2;
        ctx.font = '500 30px "Alegreya Sans", sans-serif';
        y += escrever(ctx, l.prova, M + 36, y - 6, W - 2 * M - 36, 36, 1);
      }
      y += 18;
    }

    // número grande e rodapé
    ctx.textAlign = 'center';
    if (d.numero) {
      ctx.fillStyle = destaque;
      ctx.font = '900 96px Cinzel, Georgia, serif';
      ctx.fillText(d.numero, W / 2, H - 190);
      ctx.fillStyle = tinta2;
      ctx.font = '600 32px "Alegreya Sans", sans-serif';
      ctx.fillText(d.numeroRotulo || '', W / 2, H - 145);
    }
    ctx.fillStyle = tinta2;
    ctx.font = '700 28px "Alegreya Sans", sans-serif';
    ctx.fillText('QUEM É O CULPADO · LEAGUE OF LEGENDS', W / 2, H - 70);
    return new Promise((ok, erro) => {
      try { cv.toBlob((b) => (b ? ok(b) : erro(new Error('sem imagem'))), 'image/jpeg', 0.9); } catch (e) { erro(e); }
    });
  }

  raiz.CartazLoL = { imagem };
})(window);
