/* TEMA: CRIPTA — una gárgola escupe fuego sagrado sobre el pozo
   de la cripta: fantasmas, momias y murciélagos ascienden por
   los muros. Los fantasmas dejan estela de ectoplasma frío. */
(function () {
  'use strict';
  window.TEMPEST_THEMES = window.TEMPEST_THEMES || [];
  window.TEMPEST_THEMES.push(window.makeSimaTheme({
    id: 'cripta',
    name: 'CRIPTA',
    desc: 'los muertos suben por los muros: la gárgola guarda la cornisa',

    playerColor: '#9fd8ff',
    engineColor: '#6fa8d8',
    shotColor: '#cfe8ff',
    spikeColor: '#8fd0c0',
    spikeDangerColor: '#ff5544',
    zapColor: '#b0d0ff',
    enemies: {
      flipper: { color: '#c8d8ee', score: 150 }, // fantasma
      tanker:  { color: '#d8cba8', score: 100 }, // momia
      spiker:  { color: '#8a7a9a', score: 50  }, // murciélago
    },

    dir: 'assets/themes/cripta/',
    files: { player: 'gargola', flipper: 'fantasma', tanker: 'momia', spiker: 'murcielago' },
    fondo: true,
    fondoDim: 0.35,
    solidPlayer: true, // la gárgola es piedra oscura: opaca sobre la cornisa

    motion: { flipper: 'float', spiker: 'flap' },
    rope: null,
    bright: [0.5, 1.0],
    // ectoplasma frío: estela azulada que dejan los fantasmas
    scorch: { types: ['flipper'], color: '110,160,255', alpha: 0.3, bigAlpha: 0.6, life: 7, glow: true },
    glowCenter: '90,140,220',
    glowAlpha: 0.10,
    abyss: { inner: 'rgba(6,10,20,1)', mid: 'rgba(8,12,22,0.97)', edge: 'rgba(12,14,22,0.92)' },
    wall: '60,64,76',
    rimDark: 'rgba(8,10,14,0.95)',
    rimLight: 'rgba(140,160,190,0.5)',
    ground: { near: 'rgba(30,32,40,1)', mid: 'rgba(18,19,26,1)', far: 'rgba(6,7,10,1)' },
  }));
})();
