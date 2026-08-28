/* TEMA: MAZMORRA — ballesta enana sobre el pozo: ratas, slimes
   y cienpiés trepan por los muros de piedra. */
(function () {
  'use strict';
  window.TEMPEST_THEMES = window.TEMPEST_THEMES || [];
  window.TEMPEST_THEMES.push(window.makeSimaTheme({
    id: 'mazmorra',
    name: 'MAZMORRA',
    desc: 'el pozo de la mazmorra hierve de bichos: defiende la cornisa',

    playerColor: '#d8c080',
    engineColor: '#b09860',
    shotColor: '#e0e0ff',
    spikeColor: '#9fe05f',
    spikeDangerColor: '#ff5544',
    zapColor: '#a0c0ff',
    enemies: {
      flipper: { color: '#aa9988', score: 150 }, // rata gigante
      tanker:  { color: '#77dd66', score: 100 }, // slime
      spiker:  { color: '#cc5555', score: 50  }, // cienpiés
    },

    dir: 'assets/themes/mazmorra/',
    files: { player: 'ballesta_enana', flipper: 'rata', tanker: 'slime', spiker: 'cienpies' },
    fondo: true,

    rope: 'rgba(150,150,160,0.30)', // cadenas viejas
    scorch: { types: ['tanker'], color: '40,95,22', alpha: 0.75, bigAlpha: 0.9, life: 6 }, // baba del slime
    abyss: { inner: 'rgba(0,0,1,1)', mid: 'rgba(4,4,6,0.97)', edge: 'rgba(10,10,14,0.92)' },
    wall: '70,70,78',
    rimDark: 'rgba(10,10,12,0.95)',
    rimLight: 'rgba(140,140,150,0.5)',
    ground: { near: 'rgba(36,36,40,1)', mid: 'rgba(20,20,24,1)', far: 'rgba(6,6,8,1)' },
  }));
})();
