/* Traços dos heróis de Dota 2 (estilo TFT), usados pelo painel da partida e pela página do ranking.
 * Cada herói tem alguns traços (lista à mão, pelo nome interno: npc_dota_hero_<nome>). O time ativa sinergias quando
 * junta heróis com o mesmo traço (2 = bronze, 3 = prata, 4+ = ouro) ou combinações (carry de late + babá), e ganha
 * alertas quando falta algo (linha de frente, controle, iniciação...). Expõe window.HeroisTracos. */
(function (raiz) {
  const TRACOS = {
    area: { icone: '🌀', nome: 'Ult em área', desc: 'Ultimate ou combo que pega o time todo',
      herois: 'enigma magnataur tidehunter faceless_void earthshaker dark_seer warlock phoenix puck treant mars sand_king axe kunkka jakiro disruptor invoker centaur elder_titan primal_beast snapfire winter_wyvern lich crystal_maiden necrolyte medusa ember_spirit gyrocopter void_spirit queenofpain leshrac ringmaster largo dawnbreaker' },
    pickoff: { icone: '🎯', nome: 'Pickoff', desc: 'Pega herói sozinho no mapa',
      herois: 'bounty_hunter riki nyx_assassin spirit_breaker rattletrap pudge mirana batrider bane shadow_shaman lion legion_commander slark storm_spirit earth_spirit tusk night_stalker vengefulspirit hoodwink marci grimstroke weaver templar_assassin clinkz void_spirit monkey_king primal_beast kez bloodseeker pangolier' },
    dps: { icone: '⚔️', nome: 'Dano físico', desc: 'Bate forte no auto-ataque e derruba torre',
      herois: 'phantom_assassin troll_warlord ursa sven drow_ranger juggernaut life_stealer slark faceless_void luna medusa morphling spectre terrorblade antimage phantom_lancer gyrocopter sniper chaos_knight skeleton_king monkey_king lycan naga_siren arc_warden muerta clinkz weaver templar_assassin razor viper alchemist bloodseeker kez windrunner lone_druid huskar meepo' },
    late: { icone: '🍼', nome: 'Carry de late', desc: 'Fica monstro no fim, mas precisa de espaço e proteção',
      herois: 'antimage spectre medusa terrorblade phantom_lancer naga_siren morphling faceless_void luna arc_warden alchemist gyrocopter drow_ranger muerta sniper slark troll_warlord phantom_assassin meepo' },
    baba: { icone: '🛡️', nome: 'Babá', desc: 'Salva, cura ou protege o carry',
      herois: 'oracle dazzle abaddon omniknight treant wisp winter_wyvern shadow_demon vengefulspirit chen witch_doctor undying marci lich ancient_apparition keeper_of_the_light dark_willow snapfire elder_titan grimstroke' },
    burst: { icone: '💥', nome: 'Burst mágico', desc: 'Mata rápido com magia',
      herois: 'lina lion zuus leshrac tinker skywrath_mage queenofpain invoker storm_spirit earthshaker pugna ember_spirit puck void_spirit nyx_assassin nevermore obsidian_destroyer dark_willow death_prophet jakiro crystal_maiden lich witch_doctor venomancer hoodwink snapfire ringmaster tiny morphling necrolyte techies' },
    controle: { icone: '🔒', nome: 'Controle', desc: 'Stun, hex ou silêncio confiável',
      herois: 'lion shadow_shaman bane rubick disruptor silencer doom_bringer beastmaster batrider legion_commander magnataur enigma earthshaker faceless_void sand_king centaur tidehunter axe ogre_magi dragon_knight slardar sven skeleton_king jakiro crystal_maiden vengefulspirit tusk elder_titan mars primal_beast dawnbreaker marci grimstroke winter_wyvern kunkka chaos_knight storm_spirit void_spirit nyx_assassin ancient_apparition earth_spirit' },
    frente: { icone: '🪨', nome: 'Linha de frente', desc: 'Aguenta pancada e entra primeiro',
      herois: 'axe centaur tidehunter bristleback mars dragon_knight abyssal_underlord primal_beast shredder legion_commander pudge abaddon skeleton_king sand_king night_stalker doom_bringer slardar ogre_magi brewmaster tiny huskar dawnbreaker beastmaster spirit_breaker chaos_knight lycan earth_spirit tusk elder_titan magnataur' },
    push: { icone: '🏰', nome: 'Push', desc: 'Derruba torre rápido',
      herois: 'furion lycan death_prophet pugna jakiro shadow_shaman dragon_knight broodmother lone_druid chen enchantress leshrac visage terrorblade luna drow_ranger beastmaster venomancer naga_siren tinker razor troll_warlord' },
    global: { icone: '🌍', nome: 'Global', desc: 'Aparece em qualquer canto do mapa',
      herois: 'spectre zuus furion silencer ancient_apparition storm_spirit spirit_breaker wisp dawnbreaker abyssal_underlord invoker tinker bloodseeker' },
    cedo: { icone: '⏱️', nome: 'Tempo cedo', desc: 'Forte no começo: dá pra acelerar o jogo',
      herois: 'batrider huskar ursa bristleback viper razor venomancer bounty_hunter mirana pudge clinkz legion_commander night_stalker dragon_knight monkey_king ember_spirit void_spirit queenofpain leshrac death_prophet lycan beastmaster brewmaster bloodseeker juggernaut primal_beast' },
    iniciacao: { icone: '🦘', nome: 'Iniciação', desc: 'Abre a luta de longe (blink, salto, carga) pegando o time',
      herois: 'earthshaker enigma magnataur tidehunter axe centaur mars batrider sand_king slardar primal_beast legion_commander dark_seer elder_titan spirit_breaker puck void_spirit storm_spirit faceless_void rattletrap earth_spirit tusk pangolier phoenix nyx_assassin marci dawnbreaker beastmaster' },
    bkb: { icone: '🗡️', nome: 'Atravessa BKB', desc: 'Ultimate que pega mesmo com Black King Bar',
      herois: 'enigma magnataur faceless_void bane batrider legion_commander beastmaster axe doom_bringer primal_beast winter_wyvern ancient_apparition necrolyte spirit_breaker' },
    invis: { icone: '👻', nome: 'Invisibilidade', desc: 'Some do mapa pra emboscar ou fugir',
      herois: 'riki bounty_hunter clinkz weaver nyx_assassin templar_assassin mirana invoker sand_king treant' },
    deteccao: { icone: '👁️', nome: 'Detecção', desc: 'Revela herói invisível sem gastar pó',
      herois: 'slardar bounty_hunter zuus bloodseeker' },
    dispel: { icone: '✨', nome: 'Dispel', desc: 'Tira stun, silêncio ou debuff de aliado (ou buff de inimigo)',
      herois: 'oracle abaddon legion_commander omniknight shadow_demon brewmaster slark life_stealer juggernaut weaver phantom_lancer' },
    ilusao: { icone: '🪞', nome: 'Caça-ilusão', desc: 'Dano em área que limpa ilusões e invocações',
      herois: 'sven magnataur kunkka leshrac ember_spirit medusa gyrocopter luna sand_king axe bristleback shredder jakiro death_prophet phoenix earthshaker tinker' },
    anticura: { icone: '🩸', nome: 'Anti-cura', desc: 'Corta cura e regeneração do inimigo',
      herois: 'ancient_apparition necrolyte' },
  };
  // slug -> [chave do traço]
  const DO_HEROI = {};
  Object.entries(TRACOS).forEach(([k, t]) => t.herois.split(' ').forEach(s => { (DO_HEROI[s] = DO_HEROI[s] || []).push(k); }));

  // sinergias: quantos heróis com o traço ativam cada nível (bronze, prata, ouro)
  const SINERGIAS = [
    { id: 'area', niveis: [2, 3, 4], nome: 'Wombo combo' },
    { id: 'pickoff', niveis: [2, 3, 4], nome: 'Caçadores' },
    { id: 'controle', niveis: [2, 3, 4], nome: 'Cadeia de stun' },
    { id: 'burst', niveis: [2, 3, 4], nome: 'Chuva de magia' },
    { id: 'dps', niveis: [2, 3], nome: 'Pancadaria' },
    { id: 'push', niveis: [2, 3, 4], nome: 'Derruba-torre' },
    { id: 'global', niveis: [2, 3], nome: 'Rotação global' },
    { id: 'cedo', niveis: [3, 4], nome: 'Acelera o jogo' },
    { id: 'frente', niveis: [1, 2, 3], nome: 'Muralha' },
    { id: 'iniciacao', niveis: [1, 2, 3], nome: 'Quem abre a luta' },
    { id: 'bkb', niveis: [2, 3], nome: 'Atravessa BKB' },
    { id: 'invis', niveis: [2, 3], nome: 'Emboscada' },
    { id: 'dispel', niveis: [1, 2], nome: 'Purificação' },
    { id: 'ilusao', niveis: [1, 2], nome: 'Caça-ilusão' },
    { id: 'anticura', niveis: [1], nome: 'Anti-cura' },
    { id: 'deteccao', niveis: [1], nome: 'Olho de águia' },
  ];
  // Posições em que cada herói é jogado de verdade no pub/competitivo (1 carry, 2 mid, 3 offlane, 4 e 5 suporte),
  // da mais comum para a menos. Serve pra não sugerir Legion de suporte 5 só porque ela tem controle.
  const POSICOES = {
    1: 'alchemist antimage arc_warden bloodseeker chaos_knight clinkz drow_ranger faceless_void gyrocopter juggernaut kez life_stealer luna lycan medusa meepo monkey_king morphling muerta naga_siren nevermore phantom_assassin phantom_lancer razor riki skeleton_king slark spectre sven terrorblade troll_warlord ursa weaver windrunner templar_assassin lone_druid huskar dragon_knight sniper tiny furion ember_spirit',
    2: 'arc_warden batrider death_prophet dragon_knight ember_spirit huskar invoker kunkka leshrac lina meepo necrolyte nevermore obsidian_destroyer pangolier primal_beast puck pugna queenofpain razor sniper storm_spirit templar_assassin tinker tiny viper void_spirit zuus windrunner lone_druid broodmother shredder beastmaster magnataur muerta clinkz visage earth_spirit keeper_of_the_light kez monkey_king morphling alchemist snapfire',
    3: 'abaddon abyssal_underlord axe batrider beastmaster brewmaster bristleback centaur dark_seer dawnbreaker doom_bringer enigma legion_commander mars magnataur night_stalker primal_beast sand_king slardar spirit_breaker tidehunter shredder viper visage venomancer razor broodmother death_prophet necrolyte omniknight pangolier kunkka earthshaker dragon_knight lycan furion phoenix pudge rattletrap chaos_knight tiny',
    4: 'bane batrider rattletrap dark_willow earth_spirit earthshaker elder_titan furion grimstroke hoodwink jakiro lion marci mirana nyx_assassin pudge pugna rubick shadow_demon shadow_shaman skywrath_mage snapfire spirit_breaker techies tiny tusk venomancer windrunner bounty_hunter magnataur phoenix weaver enchantress largo ringmaster silencer treant ancient_apparition slardar zuus undying ogre_magi dazzle disruptor crystal_maiden lich witch_doctor wisp vengefulspirit winter_wyvern abaddon sand_king monkey_king riki keeper_of_the_light invoker lina',
    5: 'oracle chen dazzle disruptor crystal_maiden lich witch_doctor warlock wisp vengefulspirit winter_wyvern omniknight abaddon bane jakiro shadow_demon treant elder_titan enchantress keeper_of_the_light pugna silencer ancient_apparition ogre_magi undying grimstroke lion shadow_shaman skywrath_mage techies snapfire ringmaster largo rubick venomancer zuus phoenix dark_willow visage',
  };
  const POS_DO_HEROI = {};
  Object.entries(POSICOES).forEach(([pos, lista]) => lista.split(' ').forEach(h => { (POS_DO_HEROI[h] = POS_DO_HEROI[h] || []).push(Number(pos)); }));

  const PESO_TRACO = 0.15;   // por nível ativo
  const PESO_ALERTA = 0.3;

    // sinergias ativas, quase ativas e alertas de um time (lista de nomes internos dos heróis, ex.: "skeleton_king")
  function sinergias(slugs) {
    const herois = slugs.filter(Boolean);
    const conta = {};
    herois.forEach(h => (DO_HEROI[h] || []).forEach(t => { conta[t] = (conta[t] || 0) + 1; }));
    const n = k => conta[k] || 0;
    const lista = SINERGIAS.map(s => {
      const nivel = s.niveis.filter(x => n(s.id) >= x).length;
      return { ...TRACOS[s.id], ...s, n: n(s.id), nivel, proximo: s.niveis[nivel] || null };
    });
    // combinação: carry de late com babá
    const babysit = { id: 'babysit', icone: '🍼🛡️', nome: 'Babysit', desc: 'Carry de late com alguém pra proteger ele',
      n: Math.min(n('late'), n('baba')), niveis: [1, 2], nivel: n('late') && n('baba') ? (n('baba') >= 2 ? 2 : 1) : 0, proximo: null };
    lista.unshift(babysit);
    const alertas = [];
    if (herois.length >= 4 && !n('frente')) alertas.push('🪨 Sem linha de frente: ninguém pra iniciar ou segurar a luta');
    if (herois.length >= 4 && !n('controle')) alertas.push('🔒 Sem controle confiável');
    if (herois.length >= 4 && !n('iniciacao')) alertas.push('🦘 Ninguém pra abrir a luta: vai depender de pickoff ou de esperar o outro time errar');
    if (n('late') && !n('baba') && herois.length >= 4) alertas.push('🍼 Carry de late sem babá: vai precisar de muito espaço');
    if (n('late') >= 2) alertas.push('🍼 Dois carries de late disputando farm');
    if (herois.length >= 4 && !n('dps') && n('push') < 2) alertas.push('⚔️ Pouco dano físico pra derrubar torre');
    return { lista, alertas, nota: lista.reduce((s, x) => s + x.nivel * PESO_TRACO, 0) - alertas.length * PESO_ALERTA };
  }

  raiz.HeroisTracos = { TRACOS, SINERGIAS, PESO_TRACO, PESO_ALERTA, tracos: (slug) => DO_HEROI[slug] || [], posicoes: (slug) => POS_DO_HEROI[slug] || [], sinergias };
})(typeof window !== 'undefined' ? window : globalThis);
