/* TEMA: VOLCÁN — cañón de obsidiana sobre un cráter: las
   criaturas de lava ascienden brillando desde el fondo. */
(function () {
  'use strict';
  window.TEMPEST_THEMES = window.TEMPEST_THEMES || [];
  window.TEMPEST_THEMES.push(window.makeSimaTheme({
    id: 'volcan',
    name: 'VOLCÁN',
    desc: 'un cráter que hierve: criaturas de magma suben por la roca',

    playerColor: '#ffd24d',
    engineColor: '#ff9944',
    shotColor: '#ffcc66',
    spikeColor: '#ff8844',
    spikeDangerColor: '#ffee33',
    zapColor: '#ffaa55',
    enemies: {
      flipper: { color: '#ff7733', score: 150 }, // cangrejo de lava
      tanker:  { color: '#cc5522', score: 100 }, // tortuga de magma
      spiker:  { color: '#ffaa33', score: 50  }, // salamandra
    },

    dir: 'assets/themes/volcan/',
    files: { player: 'canon_magma', flipper: 'cangrejo_lava', tanker: 'tortuga_magma', spiker: 'salamandra' },
    fondo: true,
    fondoDim: 0.4,
    solid: true, // cangrejos muy oscuros: opacos sobre el fondo de lava
    scorch: { color: '255,95,18', alpha: 0.4, bigAlpha: 0.7, life: 2.5, glow: true }, // ascuas que se enfrían

    rope: null,
    flicker: true,
    bright: [0.75, 1.0], // brillan: son de fuego
    glowCenter: '255,110,20',
    glowAlpha: 0.05,
    abyss: { inner: 'rgba(70,22,6,1)', mid: 'rgba(40,12,5,0.97)', edge: 'rgba(20,9,5,0.92)' },
    wall: '70,44,36',
    rimDark: 'rgba(12,8,6,0.95)',
    rimLight: 'rgba(255,140,60,0.5)',
    ground: { near: 'rgba(44,28,24,1)', mid: 'rgba(24,14,12,1)', far: 'rgba(8,4,4,1)' },
  }));
})();
