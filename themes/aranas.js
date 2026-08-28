/* TEMA: ARANAS — ballesta contra el enjambre que sube por sus
   propios hilos de seda desde un nido-pozo. */
(function () {
  'use strict';
  window.TEMPEST_THEMES = window.TEMPEST_THEMES || [];
  window.TEMPEST_THEMES.push(window.makeSimaTheme({
    id: 'aranas',
    name: 'NIDO DE ARAÑAS',
    desc: 'cuelgan de sus hilos de seda: no dejes que alcancen el borde',

    playerColor: '#e8c86a',
    engineColor: '#c9a24a',
    shotColor: '#e8e8ff',
    spikeColor: '#d8f0f0',
    spikeDangerColor: '#ff5544',
    zapColor: '#c9a0ff',
    enemies: {
      flipper: { color: '#cc7744', score: 150 }, // araña
      tanker:  { color: '#8877cc', score: 100 }, // escorpión
      spiker:  { color: '#aaddaa', score: 50  }, // araña tejedora
    },

    dir: 'assets/themes/aranas/',
    files: { player: 'ballesta', flipper: 'arana', tanker: 'escorpion', spiker: 'arana_tejedora' },
    fondo: true,

    rope: 'rgba(235,238,244,0.5)', // hilos de seda
    // la tejedora deja seda pegada a la pared; al morir, un copo de telaraña
    scorch: { types: ['spiker'], color: '200,204,216', alpha: 0.26, bigAlpha: 0.55, life: 9, glow: true },
    abyss: { inner: 'rgba(2,0,4,1)', mid: 'rgba(8,4,12,0.97)', edge: 'rgba(14,10,18,0.92)' },
    wall: '74,64,80',
    rimDark: 'rgba(14,10,18,0.95)',
    rimLight: 'rgba(150,130,160,0.55)',
    ground: { near: 'rgba(40,34,44,1)', mid: 'rgba(22,18,28,1)', far: 'rgba(6,4,10,1)' },
  }));
})();
