// Canvas regressions for the title layout and shared camera transform.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let transform = [0, 0, 1, 1];
const stack = [], labels = [], images = [];
const context = new Proxy({
  save() { stack.push([...transform]); },
  restore() { transform = stack.pop(); },
  translate(x, y) { transform[0] += x * transform[2]; transform[1] += y * transform[3]; },
  scale(x, y) { transform[2] *= x; transform[3] *= y; },
  fillText(label, x, y) { labels.push({ label, x: transform[0] + x * transform[2], y: transform[1] + y * transform[3] }); },
  drawImage() { images.push([...transform]); },
  createRadialGradient() { return { addColorStop() {} }; },
}, { get: (target, key) => key in target ? target[key] : () => {} });
const canvas = { getContext: () => context };
const sandbox = { window: { innerWidth: 1280, innerHeight: 800, addEventListener() {} },
  document: { getElementById: () => canvas, createElement: () => canvas },
  requestAnimationFrame() {}, performance: { now: () => 0 },
  recordSolid() { sandbox.solidTransform = [...transform]; },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('game.js', 'utf8'), sandbox);
for (const [w, h] of [[1280, 800], [1280, 360], [375, 667], [640, 240]]) {
  labels.length = 0;
  vm.runInContext(`W = ${w}; H = ${h}; hiScore = 100; elapsed = 0; THEMES.push({}); drawTitle();`, sandbox);
  assert(labels.some(p => p.label === 'PULSA ENTER'));
  for (const p of labels) assert(p.y > 0 && p.y < h, `${p.label} outside ${w}x${h}`);
  assert.equal(stack.length, 0);
}
images.length = 0;
vm.runInContext('drawScene = () => recordSolid(); shake = 12; render(0);', sandbox);
assert(images.length >= 2);
for (const t of images) assert.deepEqual(t, sandbox.solidTransform, 'Sprites and scene must share camera transform');
assert.deepEqual(transform, [0, 0, 1, 1], 'Camera transform must be restored for HUD');
console.log('RENDER OK: title stays in short/mobile windows; sprites and effects share camera shake');
