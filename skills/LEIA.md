# Esteira de animações das skills

Animação própria para cada skill no replay do site e no Plantão (que reaproveita o replay). Três camadas, a de cima ganha: desenho feito à mão em `skills/lote-N.js`, desenho à mão antigo no `ASSIN` do `index.html`, e a ficha em `skills/fichas.js` ("molde cor opções", montada por `skills/moldes.js`). Toda skill que o grupo já usou tem pelo menos a ficha.

1. `python3 skills/fila.py` recalcula `skills/fila.json`: skills usadas nas partidas do grupo (`mapas/*.json`), em ordem de quantas partidas usaram, marcando o que já tem desenho (objeto `ASSIN` do `index.html` ou um lote).
2. Skill nova (estado `generico` na fila) ganha uma ficha. As mais vistas podem virar desenho à mão: as 12 escolhidas viram `skills/lote-N.js`. Mesmo contrato do `ASSIN`: `(uso) => { ini, fim, chao, criar, desenhar(e, tt, F) }`. O lote recebe as ferramentas de `montarLances` em `K` e pode refazer uma skill que já existe.
3. `skills/catalogo.html` mostra o lote rodando numa cena de mentira (`?t=2.5` congela num instante). Cada skill nova precisa de uma cena em `CENAS`.
4. O Mat aprova a prévia, o lote ganha uma tag `script` no `index.html` e entra no site.

Estilo: traço nítido com contorno escuro por baixo, cor chapada, sem borrão nem partícula esfumaçada. Ults podem ser maiores, mas não cobrem a luta inteira.
