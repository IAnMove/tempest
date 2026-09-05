/* TEMA: MARINO — torreta arpón vigilando una sima abisal.
   Sprites de GLB de Meshy; fondo pintado con grok (fondo.png). */
(function () {
  'use strict';
  window.TEMPEST_THEMES = window.TEMPEST_THEMES || [];
  window.TEMPEST_THEMES.push(window.makeSimaTheme({
    id: 'marino',
    name: 'MARINO',
    desc: 'una sima en el lecho marino: los bichos escalan hacia tu torreta',

    playerColor: '#66ffee',
    engineColor: '#44ddcc',
    shotColor: '#ccffff',
    spikeColor: '#bb66ff',
    spikeDangerColor: '#ff4466',
    zapColor: '#66ccff',
    enemies: {
      flipper: { color: '#ff6644', score: 150 }, // cangrejo
      tanker:  { color: '#44ccaa', score: 100 }, // tortuga
      spiker:  { color: '#bb66ff', score: 50  }, // medusa
    },

    dir: 'assets/themes/marino/',
    files: { player: 'torreta', flipper: 'cangrejo', tanker: 'tortuga', spiker: 'medusa' },
    fondo: true,

    motion: { spiker: 'float' },
    rope: 'rgba(172,142,96,0.38)',
    abyss: { inner: 'rgba(0,0,2,1)', mid: 'rgba(2,8,12,0.97)', edge: 'rgba(6,18,22,0.92)' },
    wall: '58,102,96',
    rimDark: 'rgba(8,16,16,0.95)',
    rimLight: 'rgba(96,168,148,0.55)',
    ground: { near: 'rgba(26,52,54,1)', mid: 'rgba(12,30,40,1)', far: 'rgba(2,8,16,1)' },
  }));
})();
