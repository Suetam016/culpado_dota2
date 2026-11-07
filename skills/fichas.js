// Ficha de cada skill que não tem desenho feito à mão: "molde cor opções" (ver skills/moldes.js).
// Para melhorar uma skill: troque a ficha aqui, ou faça um desenho à mão num lote (o lote ganha da ficha).
window.SKILL_FICHAS = {
  // Abaddon
  abaddon_death_coil: 'proj vazio gota', abaddon_aphotic_shield: 'aura vazio escudo d5', abaddon_borrowed_time: 'aura verde escudo d6 r250',
  // Underlord
  abyssal_underlord_pit_of_malice: 'area sombra r375 espiral d4', abyssal_underlord_firestorm: 'chuva fogo r400 d6 fogo', abyssal_underlord_dark_portal: 'vortice vazio r300 d6',
  // Alchemist
  alchemist_unstable_concoction: 'aura acido d5', alchemist_acid_spray: 'area acido r475 d8 gota', alchemist_unstable_concoction_throw: 'proj acido bola', alchemist_chemical_rage: 'aura vermelho r200 d10', alchemist_berserk_potion: 'proj vermelho gota',
  // Ancient Apparition
  ancient_apparition_ice_vortex: 'vortice gelo r275 d6', ancient_apparition_ice_blast: 'proj gelo estrela', ancient_apparition_cold_feet: 'marca gelo gelo d4',
  // Anti-Mage
  antimage_blink: 'salto azul', antimage_mana_void: 'area azul r500 a.2 raios', antimage_counterspell: 'aura verde escudo d1.2',
  // Arc Warden
  arc_warden_flux: 'corrente eletrico d6', arc_warden_magnetic_field: 'cupula eletrico r300 d5', arc_warden_spark_wraith: 'area eletrico r375 a2 raio', arc_warden_tempest_double: 'invoca eletrico n1 bicho d6 eu',
  // Bane
  bane_brain_sap: 'feixe roxo reto', bane_fiends_grip: 'corrente roxo d6', bane_enfeeble: 'marca roxo espiral d5', bane_nightmare: 'marca roxo olho d4', bane_nightmare_end: 'golpe roxo',
  // Batrider
  batrider_firefly: 'aura fogo r200 d6', batrider_flamebreak: 'proj fogo bola', batrider_flaming_lasso: 'corrente fogo d3', batrider_sticky_napalm: 'area brasa r375 gota',
  // Beastmaster
  beastmaster_summon_razorback: 'invoca marrom n1 bicho d6', beastmaster_primal_roar: 'onda laranja r600 n200', beastmaster_summon_raptor: 'invoca verde n1 bicho d6', beastmaster_wild_axes: 'proj metal lamina',
  // Bloodseeker
  bloodseeker_blood_bath: 'area sangue r600 a2.6 gota', bloodseeker_bloodrage: 'marca sangue gota d6', bloodseeker_rupture: 'marca sangue gota d8',
  // Bounty Hunter
  bounty_hunter_track: 'marca ouro olho d6', bounty_hunter_wind_walk: 'aura branco d2', bounty_hunter_shuriken_toss: 'proj metal estrela', bounty_hunter_wind_walk_ally: 'aura branco d2',
  // Brewmaster
  brewmaster_thunder_clap: 'area terra r400 raios', brewmaster_primal_split: 'invoca laranja n3 bicho d6 eu', brewmaster_drunken_brawler: 'aura laranja d4', brewmaster_cinder_brew: 'area brasa r400 d5 gota', brewmaster_liquid_courage: 'aura laranja escudo d4',
  // Bristleback
  bristleback_viscous_nasal_goo: 'proj veneno gota', bristleback_quill_spray: 'area metal r700 raios eu', bristleback_hairball: 'proj marrom bola', bristleback_bristleback: 'aura metal escudo d3',
  // Broodmother
  broodmother_spin_web: 'area branco r900 d8 raios', broodmother_spawn_spiderlings: 'proj veneno gota', broodmother_insatiable_hunger: 'aura vermelho d6',
  // Centaur
  centaur_stampede: 'aura terra r200 d4', centaur_hoof_stomp: 'area terra r315 raios eu', centaur_double_edge: 'golpe vermelho cruz', centaur_khan_war_stomp: 'area terra r315 raios eu', centaur_mount: 'aura marrom d4', centaur_work_horse: 'aura marrom escudo d4',
  // Chaos Knight
  chaos_knight_chaos_bolt: 'proj vermelho estrela', chaos_knight_reality_rift: 'salto roxo', chaos_knight_phantasm: 'invoca vermelho n3 bicho d5 eu',
  // Chen
  chen_divine_favor: 'aura luz d3', chen_penitence: 'proj luz bola', chen_hand_of_god: 'area luz r500 ceu eu', chen_holy_persuasion: 'feixe luz reto', chen_zealot: 'aura luz d5',
  // Clinkz
  clinkz_death_pact: 'feixe fogo reto', clinkz_strafe: 'aura brasa d3', clinkz_wind_walk: 'aura sombra d2', clinkz_burning_barrage: 'onda fogo r700 n120', clinkz_burning_army: 'invoca fogo n5 totem d6',
  // Crystal Maiden
  crystal_maiden_crystal_clone: 'invoca gelo n1 pedra d4 eu',
  // Dark Seer
  dark_seer_vacuum: 'vortice roxo r450 d.6', dark_seer_wall_of_replica: 'linha roxo gelo d6', dark_seer_surge: 'aura azul d3', dark_seer_ion_shell: 'aura eletrico r250 d10',
  // Dark Willow
  dark_willow_shadow_realm: 'aura sombra d4', dark_willow_terrorize: 'area roxo r400 a1.2 caveira', dark_willow_bramble_maze: 'invoca natureza n8 arvore d6', dark_willow_bedlam: 'giro rosa r300 d5', dark_willow_cursed_crown: 'marca roxo estrela d4',
  // Dawnbreaker
  dawnbreaker_fire_wreath: 'giro brasa r300 d1.5', dawnbreaker_converge: 'salto luz', dawnbreaker_solar_guardian: 'area luz r500 a1.7 estrela', dawnbreaker_celestial_hammer: 'proj luz lamina',
  // Dazzle
  dazzle_poison_touch: 'proj veneno gota', dazzle_shallow_grave: 'aura laranja escudo d5', dazzle_nothl_projection: 'aura rosa d6', dazzle_shadow_wave: 'area rosa r350 raios', dazzle_nothl_projection_end: 'area rosa r300 estrela',
  // Death Prophet
  death_prophet_exorcism: 'giro espirito r500 d8', death_prophet_carrion_swarm: 'onda verde r810 n150', death_prophet_spirit_siphon: 'corrente verde d5', death_prophet_silence: 'area verde r425 cruz',
  // Disruptor
  disruptor_kinetic_fence: 'cupula azul r350 d3',
  // Doom
  doom_bringer_scorched_earth: 'area fogo r600 d10 chama eu', doom_bringer_doom: 'marca fogo caveira d10', doom_bringer_devour: 'golpe fogo',
  // Dragon Knight
  dragon_knight_breathe_fire: 'onda fogo r650 n200', dragon_knight_elder_dragon_form: 'aura verde r250 d6', dragon_knight_dragon_tail: 'golpe laranja cruz', dragon_knight_fireball: 'area fogo r350 d5 chama',
  // Drow Ranger
  drow_ranger_wave_of_silence: 'onda azul r900 n200', drow_ranger_multishot: 'onda gelo r900 n120', drow_ranger_glacier: 'invoca gelo n1 pedra d5 eu',
  // Earthshaker
  earthshaker_enchant_totem: 'area terra r300 raios eu', earthshaker_fissure: 'linha terra rachadura r1400 d6', earthshaker_echo_slam: 'area terra r700 anel eu',
  // Elder Titan
  elder_titan_echo_stomp: 'area azul r500 a1.3 raios', elder_titan_ancestral_spirit: 'invoca azul n1 bicho d4', elder_titan_return_spirit: 'area azul r300 anel', elder_titan_earth_splitter: 'linha verde rachadura r2400 a3',
  // Ember Spirit
  ember_spirit_fire_remnant: 'proj fogo bola', ember_spirit_searing_chains: 'marca fogo cruz d2', ember_spirit_sleight_of_fist: 'area fogo r250 cruz', ember_spirit_activate_fire_remnant: 'salto fogo', ember_spirit_flame_guard: 'aura fogo escudo d8',
  // Enchantress
  enchantress_natures_attendants: 'giro natureza r275 d8', enchantress_enchant: 'marca rosa coracao d4', enchantress_little_friends: 'marca natureza raios d3', enchantress_bunny_hop: 'salto rosa',
  // Enigma
  enigma_demonic_conversion: 'invoca vazio n3 bicho d6', enigma_malefice: 'marca vazio espiral d4', enigma_black_hole: 'vortice vazio r420 d4', enigma_midnight_pulse: 'area vazio r550 d9 espiral',
  // Faceless Void
  faceless_void_time_dilation: 'area roxo r775 espiral eu', faceless_void_time_walk_reverse: 'salto roxo',
  // Nature's Prophet
  furion_teleportation: 'area natureza r200 a3 anel', furion_curse_of_the_forest: 'marca natureza raios d5',
  // Grimstroke
  grimstroke_dark_portrait: 'invoca sombra n1 bicho d6',
  // Gyrocopter
  gyrocopter_homing_missile: 'proj metal flecha', gyrocopter_flak_cannon: 'aura metal r600 d8', gyrocopter_rocket_barrage: 'chuva laranja r400 d3 flecha eu', gyrocopter_call_down: 'area vermelho r600 a2 cruz',
  // Hoodwink
  hoodwink_hunters_boomerang: 'proj natureza lamina', hoodwink_decoy: 'invoca natureza n1 bicho d4 eu',
  // Huskar
  huskar_inner_fire: 'area fogo r500 chama eu', huskar_life_break: 'salto sangue', huskar_berserkers_blood: 'aura sangue d4',
  // Invoker
  invoker_forge_spirit: 'invoca fogo n2 bicho d6 eu', invoker_alacrity_ad: 'aura laranja r150 d9', invoker_sun_strike_ad: 'area brasa r175 a1.7 ceu',
  // Jakiro
  jakiro_ice_path: 'linha gelo gelo r1200 d2', jakiro_dual_breath: 'onda gelo r750 n200', jakiro_macropyre: 'linha fogo fogo r1400 d6',
  // Juggernaut
  juggernaut_healing_ward: 'invoca verde n1 totem d6', juggernaut_swift_slash: 'golpe laranja cruz',
  // Keeper of the Light
  keeper_of_the_light_illuminate: 'onda luz r1500 n300', keeper_of_the_light_radiant_bind: 'corrente luz d4', keeper_of_the_light_blinding_light: 'area luz r675 raios', keeper_of_the_light_spirit_form: 'aura luz r200 d10', keeper_of_the_light_chakra_magic: 'feixe azul reto', keeper_of_the_light_will_o_wisp: 'area luz r725 d6 espiral', keeper_of_the_light_illuminate_end: 'onda luz r1500 n300',
  // Kez
  kez_grappling_claw: 'proj metal flecha', kez_raptor_dance: 'giro azul r400 d1.5', kez_falcon_rush: 'aura azul d4', kez_switch_weapons: 'aura metal d1', kez_echo_slash: 'onda azul r600 n150', kez_shodo_sai: 'aura metal escudo d2', kez_ravens_veil: 'area sombra r800 anel eu', kez_talon_toss: 'proj metal lamina',
  // Kunkka
  kunkka_x_marks_the_spot: 'marca vermelho cruz d4', kunkka_torrent: 'area agua r225 a1.6 raios', kunkka_ghostship: 'onda espirito r2000 n300', kunkka_return: 'salto vermelho', kunkka_tidal_wave: 'onda agua r1500 n400',
  // Largo
  largo_amphibian_rhapsody: 'aura verde r600 d8', largo_song_double_time: 'aura ciano nota d6', largo_song_fight_song: 'aura vermelho nota d6', largo_croak_of_genius: 'marca verde nota d4', largo_catchy_lick: 'proj rosa bola', largo_frogstomp: 'area verde r350 raios', largo_song_good_vibrations: 'aura verde nota d6',
  // Legion Commander
  legion_commander_press_the_attack: 'aura ouro escudo d5', legion_commander_overwhelming_odds: 'area ouro r600 estrela', legion_commander_duel: 'cupula ouro r250 d4 escudo',
  // Leshrac
  leshrac_pulse_nova: 'area eletrico r450 d8 raio eu', leshrac_split_earth: 'area terra r200 a.35 rachadura', leshrac_lightning_storm: 'feixe eletrico ceu', leshrac_diabolic_edict: 'area vermelho r500 d10 raios eu', leshrac_greater_lightning_storm: 'chuva eletrico r500 d6',
  // Lich
  lich_frost_shield: 'aura gelo escudo d6', lich_chain_frost: 'proj gelo estrela', lich_sinister_gaze: 'corrente verde d2.5', lich_frost_nova: 'area gelo r200 gelo', lich_death_charge: 'aura gelo d6', lich_ice_spire: 'invoca gelo n1 torre d10',
  // Lifestealer
  life_stealer_infest: 'aura sangue d6', life_stealer_open_wounds: 'marca sangue gota d8', life_stealer_rage: 'aura vermelho escudo d6', life_stealer_consume: 'area sangue r250 raios',
  // Lina
  lina_dragon_slave: 'onda fogo r1075 n275', lina_light_strike_array: 'area brasa r250 a.5 chama', lina_laguna_blade: 'feixe vermelho a.25', lina_flame_cloak: 'aura fogo r150 d5',
  // Lion
  lion_mana_drain: 'corrente azul d5', lion_voodoo: 'marca verde coracao d3',
  // Lone Druid
  lone_druid_entangle: 'marca natureza raios d2', lone_druid_true_form: 'aura marrom r250 d8', lone_druid_spirit_bear: 'invoca marrom n1 bicho d4 eu', lone_druid_savage_roar: 'area marrom r350 raios eu',
  // Luna
  luna_lucent_beam: 'feixe lua ceu', luna_eclipse: 'chuva lua r675 d5 eu', luna_lunar_orbit: 'giro lua r300 d4',
  // Lycan
  lycan_shapeshift: 'aura vermelho r200 d18', lycan_howl: 'area vermelho r600 anel eu', lycan_summon_wolves: 'invoca metal n2 bicho d6 eu', lycan_wolf_bite: 'golpe vermelho',
  // Magnus
  magnataur_reverse_polarity: 'area azul r410 anel eu', magnataur_skewer: 'salto azul', magnataur_empower: 'aura laranja d6', magnataur_shockwave: 'onda azul r1150 n150', magnataur_horn_toss: 'area azul r325 raios eu',
  // Marci
  marci_companion_run: 'salto rosa', marci_unleash: 'aura rosa r200 d16', marci_grapple: 'golpe rosa', marci_bodyguard: 'corrente rosa d6', marci_special_delivery: 'proj rosa bola',
  // Mars
  mars_spear: 'proj ouro lanca', mars_gods_rebuke: 'onda ouro r500 n300', mars_arena_of_blood: 'cupula vermelho r550 d5 escudo', mars_bulwark: 'aura ouro escudo d6',
  // Medusa
  medusa_gorgon_grasp: 'area verde r400 a1 espiral', medusa_split_shot: 'aura verde d6', medusa_stone_gaze: 'area verde r1000 d5 olho eu', medusa_mystic_snake: 'proj verde gota',
  // Meepo
  meepo_poof: 'area azul r375 a1.5 anel', meepo_earthbind: 'proj azul bola', meepo_megameepo: 'aura azul r250 d6', meepo_petrify: 'aura pedra escudo d3',
  // Mirana
  mirana_starfall: 'chuva lua r650 d1.5 estrela eu', mirana_arrow: 'proj lua flecha', mirana_leap: 'salto lua', mirana_invis: 'aura lua r300 d4',
  // Monkey King
  monkey_king_tree_dance: 'salto natureza', monkey_king_untransform: 'aura ouro d1', monkey_king_wukongs_command: 'cupula ouro r750 d10', monkey_king_mischief: 'aura ouro d1', monkey_king_boundless_strike: 'linha ouro espinhos r1100', monkey_king_transfiguration: 'aura ouro d3', monkey_king_primal_spring: 'area ouro r375 a1.6 raios', monkey_king_primal_spring_early: 'area ouro r375 raios',
  // Morphling
  morphling_adaptive_strike_agi: 'proj agua gota', morphling_waveform: 'salto agua', morphling_replicate: 'invoca agua n1 bicho d4', morphling_morph_replicate: 'salto agua',
  // Muerta
  muerta_the_calling: 'cupula espirito r575 d5 caveira', muerta_pierce_the_veil: 'aura espirito r200 d5', muerta_dead_shot: 'proj espirito bola', muerta_gunslinger: 'aura espirito d3',
  // Naga Siren
  naga_siren_song_of_the_siren: 'area agua r1000 d7 nota eu', naga_siren_ensnare: 'proj agua bola', naga_siren_mirror_image: 'invoca agua n3 bicho d6 eu',
  // Necrophos
  necrolyte_reapers_scythe: 'marca verde caveira d1.5', necrolyte_ghost_shroud: 'aura verde r500 d4', necrolyte_death_pulse: 'area verde r500 anel eu', necrolyte_death_seeker: 'proj verde bola',
  // Shadow Fiend
  nevermore_shadowraze1: 'area sombra r250 raios', nevermore_shadowraze2: 'area sombra r250 raios', nevermore_shadowraze3: 'area sombra r250 raios', nevermore_frenzy: 'aura vermelho d8', nevermore_requiem: 'area sombra r1000 a1.6 raios eu',
  // Night Stalker
  night_stalker_crippling_fear: 'aura roxo r375 d4', night_stalker_darkness: 'cupula sombra r1000 d6 olho', night_stalker_void: 'golpe sombra', night_stalker_midnight_feast: 'golpe vermelho',
  // Nyx
  nyx_assassin_jolt: 'golpe azul cruz', nyx_assassin_impale: 'linha verde espinhos r700', nyx_assassin_vendetta: 'aura roxo d4', nyx_assassin_spiked_carapace: 'aura verde escudo d1.5', nyx_assassin_unburrow: 'area terra r200 raios eu', nyx_assassin_burrow: 'area terra r200 raios eu',
  // Outworld Destroyer
  obsidian_destroyer_astral_imprisonment: 'marca arcano anel d4', obsidian_destroyer_sanity_eclipse: 'area arcano r450 estrela', obsidian_destroyer_objurgation: 'aura arcano escudo d5',
  // Ogre Magi
  ogre_magi_bloodlust: 'aura vermelho d6', ogre_magi_fireblast: 'golpe fogo cruz', ogre_magi_ignite: 'proj fogo bola', ogre_magi_unrefined_fireblast: 'golpe fogo cruz', ogre_magi_smash: 'aura laranja escudo d6',
  // Omniknight
  omniknight_purification: 'area luz r260 estrela', omniknight_martyr: 'aura luz escudo d4', omniknight_guardian_angel: 'aura luz r1200 d6',
  // Oracle
  oracle_fortunes_end: 'proj laranja bola', oracle_false_promise: 'aura laranja escudo d8', oracle_purifying_flames: 'golpe laranja', oracle_fates_edict: 'aura laranja d4', oracle_rain_of_destiny: 'chuva laranja r500 d6 gota',
  // Pangolier
  pangolier_gyroshell: 'aura metal r300 d8', pangolier_shield_crash: 'area metal r500 raios eu', pangolier_swashbuckle: 'onda metal r900 n150', pangolier_rollup: 'aura metal escudo d3',
  // Phantom Assassin
  phantom_assassin_phantom_strike: 'salto vermelho', phantom_assassin_blur: 'aura branco d1.5', phantom_assassin_fan_of_knives: 'area metal r600 raios eu',
  // Phantom Lancer
  phantom_lancer_doppelwalk: 'salto azul', phantom_lancer_spirit_lance: 'proj azul lanca', phantom_lancer_juxtapose: 'invoca azul n3 bicho d6 eu', phantom_lancer_phantom_edge: 'salto azul',
  // Phoenix
  phoenix_launch_fire_spirit: 'proj fogo bola', phoenix_fire_spirits: 'giro fogo r200 d6', phoenix_icarus_dive: 'salto fogo', phoenix_supernova: 'cupula fogo r1300 d6 estrela', phoenix_sun_ray: 'feixe fogo reto d6',
  // Primal Beast
  primal_beast_trample: 'aura terra r230 d3.5', primal_beast_onslaught: 'salto vermelho', primal_beast_pulverize: 'area terra r600 d2 raios', primal_beast_uproar: 'area vermelho r900 raios eu', primal_beast_rock_throw: 'area pedra r250 a1 raios',
  // Puck
  puck_phase_shift: 'aura arcano escudo d1.5', puck_ethereal_jaunt: 'salto arcano', puck_waning_rift: 'area arcano r400 estrela eu', puck_illusory_orb: 'proj arcano bola', puck_dream_coil: 'cupula arcano r375 d6 estrela',
  // Pugna
  pugna_life_drain: 'corrente verde d5', pugna_nether_ward: 'invoca verde n1 totem d18', pugna_decrepify: 'marca verde caveira d3', pugna_nether_blast: 'area verde r400 a.9 raios',
  // Queen of Pain
  queenofpain_sonic_wave: 'onda rosa r900 n450', queenofpain_shadow_strike: 'proj vinho lamina', queenofpain_scream_of_pain: 'area vinho r550 raios eu', queenofpain_blink: 'salto vinho',
  // Clockwerk
  rattletrap_battery_assault: 'aura eletrico r275 d10', rattletrap_power_cogs: 'invoca metal n8 torre d5 eu', rattletrap_hookshot: 'proj metal flecha', rattletrap_rocket_flare: 'proj laranja flecha', rattletrap_jetpack: 'aura laranja d5', rattletrap_overclocking: 'aura eletrico escudo d7',
  // Razor
  razor_plasma_field: 'area eletrico r700 anel eu', razor_static_link: 'corrente eletrico d8', razor_eye_of_the_storm: 'chuva eletrico r500 d20 eu',
  // Riki
  riki_tricks_of_the_trade: 'area roxo r450 d3 raios eu', riki_smoke_screen: 'area sombra r325 d6 espiral', riki_blink_strike: 'salto roxo',
  // Ringmaster
  ringmaster_summon_unicycle: 'aura laranja d4', ringmaster_the_box: 'aura rosa escudo d3', ringmaster_tame_the_beasts: 'onda vermelho r900 n150', ringmaster_funhouse_mirror: 'invoca rosa n2 bicho d4 eu', ringmaster_whoopee_cushion: 'area rosa r250 anel eu', ringmaster_strongman_tonic: 'aura vermelho d5', ringmaster_impalement: 'proj metal lamina', ringmaster_wheel: 'proj laranja estrela', ringmaster_tame_the_beasts_crack: 'onda vermelho r900 n150', ringmaster_spotlight: 'area luz r300 d5 estrela',
  // Rubick
  rubick_fade_bolt: 'proj verde bola', rubick_spell_steal: 'feixe verde reto', rubick_telekinesis_land_self: 'area verde r325 raios',
  // Sand King
  sandking_sand_storm: 'vortice terra r500 d10 eu', sandking_epicenter: 'area terra r700 d2.5 anel eu', sandking_burrowstrike: 'linha terra espinhos r650', sandking_scorpion_strike: 'area terra r350 cruz',
  // Shadow Demon
  shadow_demon_disruption: 'marca roxo espiral d2.5', shadow_demon_demonic_purge: 'marca vermelho caveira d5', shadow_demon_shadow_poison: 'onda roxo r1500 n200', shadow_demon_disseminate: 'marca roxo raios d6', shadow_demon_demonic_cleanse: 'marca verde estrela d1',
  // Shadow Shaman
  shadow_shaman_ether_shock: 'onda eletrico r500 n250', shadow_shaman_voodoo: 'marca verde coracao d3', shadow_shaman_urnaconda: 'invoca verde n1 bicho d4',
  // Timbersaw
  shredder_timber_chain: 'proj metal flecha', shredder_chakram: 'area metal r200 d8 raios', shredder_return_chakram: 'proj metal lamina', shredder_whirling_death: 'giro metal r300 d.6', shredder_reactive_armor: 'aura metal escudo d6', shredder_flamethrower: 'onda fogo r500 n200',
  // Silencer
  silencer_last_word: 'marca roxo cruz d4', silencer_curse_of_the_silent: 'area roxo r425 d6 cruz', silencer_global_silence: 'area roxo r1200 cruz eu',
  // Wraith King
  skeleton_king_bone_guard: 'invoca verde n4 bicho d6 eu', skeleton_king_hellfire_blast: 'proj verde bola', skeleton_king_reincarnation: 'area verde r900 caveira eu',
  // Skywrath
  skywrath_mage_mystic_flare: 'area arcano r170 d2.2 raios', skywrath_mage_concussive_shot: 'proj azul estrela', skywrath_mage_ancient_seal: 'marca arcano olho d4', skywrath_mage_arcane_bolt: 'proj arcano bola',
  // Slardar
  slardar_sprint: 'aura agua d6', slardar_amplify_damage: 'marca vermelho olho d8', slardar_slithereen_crush: 'area agua r350 raios eu',
  // Slark
  slark_dark_pact: 'area sombra r325 a1.5 raios eu', slark_pounce: 'salto sombra', slark_shadow_dance: 'aura sombra r200 d4', slark_depth_shroud: 'area sombra r300 d3 espiral',
  // Snapfire
  snapfire_scatterblast: 'onda laranja r800 n225', snapfire_lil_shredder: 'aura laranja d4', snapfire_mortimer_kisses: 'chuva fogo r400 d5 bola', snapfire_firesnap_cookie: 'salto laranja', snapfire_spit_creep: 'area fogo r300 a1 chama', snapfire_gobble_up: 'golpe laranja',
  // Sniper
  sniper_take_aim: 'aura metal d3', sniper_concussive_grenade: 'area metal r375 raios',
  // Spectre
  spectre_shadow_step: 'salto roxo', spectre_spectral_dagger: 'linha roxo espinhos r2000 d4', spectre_reality: 'salto roxo', spectre_haunt: 'invoca roxo n5 bicho d5 eu', spectre_dispersion: 'aura roxo escudo d4',
  // Spirit Breaker
  spirit_breaker_nether_strike: 'golpe roxo cruz', spirit_breaker_bulldoze: 'aura roxo d8', spirit_breaker_planar_pocket: 'cupula roxo r400 d4',
  // Storm Spirit
  storm_spirit_static_remnant: 'area eletrico r235 a1 raio', storm_spirit_ball_lightning: 'salto eletrico', storm_spirit_electric_vortex: 'corrente eletrico d2', storm_spirit_overload: 'aura eletrico d3',
  // Sven
  sven_storm_bolt: 'proj azul bola', sven_warcry: 'aura azul escudo d8', sven_gods_strength: 'aura vermelho r200 d10',
  // Techies
  techies_land_mines: 'invoca vermelho n1 totem d4', techies_sticky_bomb: 'proj laranja bola', techies_suicide: 'area fogo r400 raios', techies_reactive_tazer: 'aura eletrico d4', techies_minefield_sign: 'invoca ouro n1 totem d4', techies_focused_detonate: 'area fogo r700 raios', techies_mutually_assured_destruction: 'area fogo r400 raios',
  // Templar Assassin
  templar_assassin_psionic_trap: 'invoca roxo n1 pedra d6', templar_assassin_trap: 'area roxo r400 espiral', templar_assassin_refraction: 'aura rosa escudo d6', templar_assassin_meld: 'aura roxo d2', templar_assassin_trap_teleport: 'salto roxo',
  // Terrorblade
  terrorblade_conjure_image: 'invoca azul n1 bicho d6 eu', terrorblade_metamorphosis: 'aura azul r250 d10', terrorblade_reflection: 'area azul r900 d4 olho eu', terrorblade_sunder: 'corrente azul d1', terrorblade_demon_zeal: 'aura vermelho d6',
  // Tidehunter
  tidehunter_kraken_shell: 'aura agua escudo d2', tidehunter_anchor_smash: 'area agua r375 raios eu', tidehunter_gush: 'proj agua gota', tidehunter_ravage: 'linha agua espinhos r1250', tidehunter_dead_in_the_water: 'corrente agua d4',
  // Tinker
  tinker_march_of_the_machines: 'chuva metal r900 d6 bola', tinker_rearm: 'aura azul d2', tinker_keen_teleport: 'area azul r300 a4 anel eu', tinker_deploy_turrets: 'invoca metal n3 torre d8', tinker_laser: 'feixe vermelho reto', tinker_warp_grenade: 'proj azul bola',
  // Tiny
  tiny_toss: 'salto pedra', tiny_avalanche: 'area pedra r400 d1.5 raios', tiny_tree_grab: 'aura natureza d6', tiny_toss_tree: 'proj natureza bola', tiny_tree_channel: 'chuva natureza r400 d3',
  // Treant
  treant_living_armor: 'aura natureza escudo d8', treant_natures_grasp: 'linha natureza fogo r1500 d6', treant_overgrowth: 'area natureza r800 d4 raios eu', treant_natures_guise: 'aura natureza d3', treant_eyes_in_the_forest: 'invoca natureza n1 arvore d6',
  // Troll Warlord
  troll_warlord_whirling_axes_ranged: 'onda metal r1000 n150', troll_warlord_switch_stance: 'aura metal d1', troll_warlord_whirling_axes_melee: 'giro metal r450 d3', troll_warlord_battle_trance: 'aura vermelho r200 d6',
  // Tusk
  tusk_walrus_punch: 'golpe gelo cruz', tusk_ice_shards: 'linha gelo gelo r750 d5', tusk_snowball: 'salto gelo', tusk_tag_team: 'area gelo r350 d6 raios eu', tusk_launch_snowball: 'salto gelo', tusk_walrus_kick: 'golpe gelo', tusk_drinking_buddies: 'corrente laranja d2',
  // Undying
  undying_flesh_golem: 'aura verde r200 d10',
  // Ursa
  ursa_earthshock: 'area terra r385 raios eu', ursa_overpower: 'aura laranja d4', ursa_enrage: 'aura vermelho r200 d4',
  // Vengeful Spirit
  vengefulspirit_wave_of_terror: 'onda azul r1400 n300', vengefulspirit_nether_swap: 'corrente azul d.6', vengefulspirit_magic_missile: 'proj azul estrela',
  // Venomancer
  venomancer_plague_ward: 'invoca veneno n1 totem d8', venomancer_snakebite: 'proj veneno gota', venomancer_noxious_plague: 'marca veneno caveira d5', venomancer_venomous_gale: 'onda veneno r800 n125',
  // Viper
  viper_viper_strike: 'proj veneno gota', viper_nethertoxin: 'area veneno r400 d6 gota', viper_nose_dive: 'salto veneno',
  // Visage
  visage_grave_chill: 'corrente gelo d4', visage_gravekeepers_cloak: 'aura pedra escudo d4', visage_stone_form_self_cast: 'aura pedra escudo d4', visage_silent_as_the_grave: 'aura sombra d4', visage_summon_familiars: 'invoca pedra n2 bicho d6 eu', visage_soul_assumption: 'proj azul bola',
  // Void Spirit
  void_spirit_aether_remnant: 'linha arcano gelo r900 d2', void_spirit_dissimilate: 'invoca arcano n5 pedra d1.5 eu', void_spirit_astral_step: 'salto arcano', void_spirit_resonant_pulse: 'area arcano r500 anel eu',
  // Warlock
  warlock_rain_of_chaos: 'area fogo r600 a.5 chama', warlock_fatal_bonds: 'marca roxo espiral d6', warlock_upheaval: 'area vinho r650 d10 espiral', warlock_shadow_word: 'marca roxo gota d5',
  // Weaver
  weaver_shukuchi: 'aura roxo d3', weaver_time_lapse: 'salto roxo', weaver_the_swarm: 'onda marrom r3000 n300',
  // Windranger
  windrunner_windrun: 'aura branco d4', windrunner_powershot: 'onda branco r2600 n125', windrunner_shackleshot: 'proj natureza flecha', windrunner_focusfire: 'marca verde olho d8', windrunner_gale_force: 'area branco r600 d3 espiral',
  // Winter Wyvern
  winter_wyvern_arctic_burn: 'aura gelo d6', winter_wyvern_winters_curse: 'marca gelo gelo d4', winter_wyvern_cold_embrace: 'aura gelo escudo d4', winter_wyvern_splinter_blast: 'proj gelo estrela',
  // Io
  wisp_overcharge: 'aura ciano d6', wisp_tether: 'corrente ciano d8', wisp_relocate: 'area ciano r300 a3 anel eu', wisp_tether_break: 'golpe ciano', wisp_spirits_out: 'giro ciano r500 d6', wisp_spirits: 'giro ciano r400 d8', wisp_spirits_in: 'giro ciano r250 d6',
  // Witch Doctor
  witch_doctor_voodoo_restoration: 'aura verde r500 d6',
  // Zeus
  zuus_heavenly_jump: 'salto eletrico', zuus_lightning_bolt: 'feixe eletrico ceu', zuus_arc_lightning: 'feixe eletrico', zuus_thundergods_wrath: 'area eletrico r300 ceu eu', zuus_cloud: 'area eletrico r450 d10 raio', zuus_lightning_hands: 'aura eletrico d3',
  // Criaturas neutras que heróis controlam
  black_dragon_fireball: 'area fogo r300 d6 chama', dark_troll_warlord_ensnare: 'proj branco bola', enraged_wildkin_hurricane: 'vortice branco r300 d2', forest_troll_high_priest_heal: 'aura verde d1', frogmen_tendrils_of_the_deep: 'area agua r300 raios', frogmen_water_bubble_medium: 'aura agua escudo d3', frogmen_arm_of_the_deep: 'linha agua espinhos r600', frogmen_water_bubble_small: 'aura agua escudo d3', giant_wolf_intimidate: 'area metal r300 raios eu', mud_golem_hurl_boulder: 'proj pedra bola', polar_furbolg_ursa_warrior_thunder_clap: 'area azul r300 raios eu', satyr_soulstealer_mana_burn: 'feixe azul reto', satyr_hellcaller_shockwave: 'onda vermelho r800 n150', spawnlord_master_stomp: 'area terra r400 raios eu',
};
