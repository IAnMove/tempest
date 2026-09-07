// Regression checks for sprite rendering, wall flames and water, without a browser.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls = [];
function context() {
  return new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => {
        for (const arg of args) if (typeof arg === 'number') assert(Number.isFinite(arg), `${key}: non-finite coordinate`);
        calls.push({ key, args });
      };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}
const sandbox = { window: {}, Image: class { complete = true; naturalWidth = 256; naturalHeight = 256; } };
vm.createContext(sandbox);
for (const file of ['placeholder', 'sima', 'marino', 'aranas', 'volcan', 'mazmorra', 'bomberos', 'cripta']) {
  vm.runInContext(fs.readFileSync(`themes/${file}.js`, 'utf8'), sandbox);
}
const g = {
  ctx: context(), sctx: context(), R: 300, W: 1280, H: 800, CX: 640, CY: 400,
  LANES: 16, level: 1, elapsed: 0, shape: {}, webPulse: -1, muzzle: 0.05,
  player: { lane: 0 }, enemies: [], shots: [], levelHue: () => 47, sStroke() {},
  webPoint(shape, lane, t) {
    const a = lane / 16 * Math.PI * 2 - Math.PI / 2;
    return { x: 640 + Math.cos(a) * (30 + t * 270), y: 400 + Math.sin(a) * (30 + t * 270), a };
  },
};
for (const theme of sandbox.window.TEMPEST_THEMES.filter(t => t.reset)) {
  theme.reset();
  g.enemies = ['flipper', 'tanker', 'spiker'].map((type, i) => ({ type, lane: i * 3, t: 0.3 + i * 0.2, rot: i }));
  for (let frame = 0; frame < 5; frame++) {
    g.elapsed += 1 / 60;
    g.enemies.forEach(e => e.t += 0.004);
    theme.drawBackground(g); theme.drawEnemies(g); theme.drawPlayer(g);
    if (theme.drawShots) { g.shots = [{ lane: 0, t: 0.7 }]; theme.drawShots(g); }
  }
  assert(calls.some(c => c.key === 'drawImage'), `${theme.id}: sprite not drawn`);
  calls.length = 0; g.shots = [];
}
const fire = sandbox.window.TEMPEST_THEMES.find(t => t.id === 'bomberos');
fire.reset(); g.enemies = [{ type: 'flipper', lane: 0, t: 0.5 }];
fire.drawBackground(g);
g.enemies = []; g.elapsed += 1;
calls.length = 0; fire.drawBackground(g);
assert(calls.some(c => c.key === 'bezierCurveTo'), 'Fire must remain after enemy leaves');
g.shots = [{ lane: 0, t: 0.3 }];
calls.length = 0; fire.drawBackground(g);
assert(!calls.some(c => c.key === 'bezierCurveTo'), 'Water must extinguish the crossed trail');
g.shots = []; g.enemies = [{ type: 'flipper', lane: 0, t: 0.5 }]; fire.drawBackground(g);
g.enemies = []; fire.reset(); calls.length = 0; fire.drawBackground(g);
assert(!calls.some(c => c.key === 'bezierCurveTo'), 'New level must clear wall fire');
console.log('VISUAL LOGIC OK — six sprite themes, persistent fire, water and reset');
