/* TEMA: BOMBEROS — el fuego sube por la sima y tú lo apagas
   con la manguera desde la cornisa. Sin cuerdas: el fuego asciende
   solo, parpadeando. El fondo del hoyo brilla (brasa viva). */
(function () {
  'use strict';
  window.TEMPEST_THEMES = window.TEMPEST_THEMES || [];
  window.TEMPEST_THEMES.push(window.makeSimaTheme({
    id: 'bomberos',
    name: 'BOMBEROS',
    desc: 'el incendio sube por el hueco: apágalo con agua antes de que salga',

    playerColor: '#ffd24d',
    engineColor: '#ddbb44',
    shotColor: '#bfe6ff',
    spikeColor: '#ff6622',
    spikeDangerColor: '#ffee33',
    zapColor: '#66ccff',
    enemies: {
      flipper: { color: '#ffaa33', score: 150 }, // llamarada
      tanker:  { color: '#ff6622', score: 100 }, // fogata
      spiker:  { color: '#ff4422', score: 50  }, // brasa
    },

    dir: 'assets/themes/bomberos/',
    files: { player: 'bombero', flipper: 'llamarada', tanker: 'fogata', spiker: 'brasa' },
    fondo: true,
    fondoDim: 0.4,
    playerSize: 110,

    rope: null,
    flicker: true,
    bright: [0.7, 1.0],
    spriteGain: 0.8, // las llamas deben quedar brillantes
    scorch: true,    // el fuego va dejando la pared chamuscada
    shots: 'agua',
    glowCenter: '255,120,25',
    abyss: { inner: 'rgba(255,120,20,1)', mid: 'rgba(120,40,8,0.97)', edge: 'rgba(20,10,6,0.92)' },
    wall: '60,40,34',
    rimDark: 'rgba(10,6,6,0.95)',
    rimLight: 'rgba(255,110,40,0.5)',
    ground: { near: 'rgba(40,30,26,1)', mid: 'rgba(22,16,14,1)', far: 'rgba(8,6,5,1)' },
  }));
})();
