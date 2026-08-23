// Prueba de humo: ejecuta game.js con un DOM simulado y corre el bucle principal.
'use strict';

const handlers = {};
let rafCb = null;

// proxy universal: cualquier método devuelve otro proxy, cualquier propiedad se puede leer/escribir
function makeAny() {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      return makeAny();
    },
    set() { return true; },
    apply() { return makeAny(); },
  });
}

global.window = {
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener: (type, fn) => { handlers[type] = fn; },
};
global.document = {
  getElementById: () => makeAny(),
  createElement: () => makeAny(),
};
global.requestAnimationFrame = cb => { rafCb = cb; };

require('./game.js');

function key(code, down = true) {
  handlers[down ? 'keydown' : 'keyup']({ code, preventDefault: () => {} });
}

let now = 0;
function step(ms) {
  now += ms;
  const cb = rafCb;
  rafCb = null;
  cb(now);
  if (!rafCb) throw new Error('el bucle no pidió otro frame');
}

// título
for (let i = 0; i < 10; i++) step(16);

// empezar partida
key('Enter');
for (let i = 0; i < 60; i++) step(16);

// jugar ~120 segundos simulados: moverse, disparar, superzap, pausa
key('Space');
key('ArrowLeft');
let zapped = false;
for (let i = 0; i < 120 * 60; i++) {
  if (i === 300) { key('ArrowLeft', false); key('ArrowRight'); }
  if (i === 900) { key('ArrowRight', false); key('KeyA'); }
  if (i === 1500) { key('KeyA', false); key('KeyD'); }
  if (i === 2000 && !zapped) { key('ShiftLeft'); zapped = true; }
  if (i === 2500) { key('KeyP'); }
  if (i === 2600) { key('KeyP'); }
  if (i === 4000) { key('KeyD', false); }
  if (i === 4500) { key('ArrowLeft'); }
  step(16.7);
}

console.log('SMOKE TEST OK — 120s simulados sin errores');
