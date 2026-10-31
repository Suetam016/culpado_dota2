// Fase de rotas do LoL, como a balança do Dota: cada rota aos 10 e aos 14 min, rota contra rota (ouro, experiência e
// farm), com os abates entre os dois lados da rota. Pesa = desce: o lado que está atrás afunda a balança.
// Puro: roda no navegador (window.RotasLoL) e no Node (testes: node lol/teste_rotas.mjs).
(function (raiz) {
  'use strict';

  const ROTAS = [
    ['TOP', 'Topo', ['TOP']], ['JUNGLE', 'Selva', ['JUNGLE']], ['MIDDLE', 'Meio', ['MIDDLE']], ['BOTTOM', 'Bot', ['BOTTOM', 'UTILITY']],
  ];
  const FIM_ROTAS = 14;          // minuto em que a fase de rotas acaba (placas caem aos 14)
  const DECIDIU = 600;           // diferença de ouro (com metade da experiência) que decide a rota
  const ESMAGOU = 2000;

  function noMinuto(partida, js, min) {
    const q = partida.quadros[Math.min(partida.quadros.length - 1, min)];
    let ouro = 0, xp = 0, cs = 0;
    for (const j of js) {
      const f = (q && q.p[String(j.id)]) || [];
      ouro += f[2] || 0; xp += f[3] || 0; cs += f[4] || 0;
    }
    return { ouro, xp, cs };
  }

  function rotas(partida, timeNos) {
    if (partida.quadros.length < 11) return [];
    const fim = Math.min(FIM_ROTAS, partida.quadros.length - 1);
    const out = [];
    for (const [chave, nome, posicoes] of ROTAS) {
      const nos = partida.jogadores.filter((j) => j.teamId === timeNos && posicoes.includes(j.teamPosition));
      const eles = partida.jogadores.filter((j) => j.teamId !== timeNos && posicoes.includes(j.teamPosition));
      if (!nos.length || !eles.length) continue;
      const dif = (min) => {
        const a = noMinuto(partida, nos, min), b = noMinuto(partida, eles, min);
        return { ouro: a.ouro - b.ouro, xp: a.xp - b.xp, cs: a.cs - b.cs };
      };
      const m10 = dif(10), m14 = dif(fim);
      // abates entre os dois lados da rota até o fim da fase (o caçador deles entrando conta como ajuda, não como dono)
      const idsNos = new Set(nos.map((j) => j.id)), idsEles = new Set(eles.map((j) => j.id));
      const abates = partida.eventos.filter((e) => e.tipo === 'abate' && e.t <= fim * 60);
      const nossos = abates.filter((e) => idsEles.has(e.morreu) && (idsNos.has(e.matou) || (e.assist || []).some((x) => idsNos.has(x)))).length;
      const deles = abates.filter((e) => idsNos.has(e.morreu) && (idsEles.has(e.matou) || (e.assist || []).some((x) => idsEles.has(x)))).length;
      const peso = m14.ouro + m14.xp / 2;
      const resultado = peso >= DECIDIU ? 'ganhou' : peso <= -DECIDIU ? 'perdeu' : 'empate';
      out.push({ chave, nome, nos, eles, m10, m14, minutoFim: fim, abates: { nos: nossos, eles: deles }, peso, resultado, esmagou: Math.abs(peso) >= ESMAGOU });
    }
    return out;
  }

  const api = { rotas, ROTAS, DECIDIU, ESMAGOU };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.RotasLoL = api;
})(typeof window !== 'undefined' ? window : globalThis);
