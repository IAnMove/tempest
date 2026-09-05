'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function noopCanvas() {
  return new Proxy({}, { get: () => () => noopCanvas(), set: () => true });
}
const sandbox = {
  window: { innerWidth: 1280, innerHeight: 800, addEventListener() {} },
  document: { getElementById: noopCanvas, createElement: noopCanvas },
  requestAnimationFrame() {}, performance: { now: () => 0 },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('game.js', 'utf8'), sandbox);
function run(code) { return vm.runInContext(code, sandbox); }
function reset() {
  run(`startGame(); spawnQueue = [{time: 10000, type: 'flipper'}]; enemies = []; shots = []; player.invuln = 100; Object.keys(keys).forEach(k => keys[k] = false);`);
}
for (const fps of [30, 60, 120]) {
  reset(); run('keys.ArrowRight = true; keys.Space = true;');
  for (let frame = 0; frame < fps; frame++) {
    run(`update(${1 / fps})`);
    assert(Number.isInteger(run('player.lane')), 'Player must always occupy a firing socket');
    assert(run('shots.every(s => Number.isInteger(s.lane))'), 'Shots must follow exact lanes');
  }
  assert.equal(run('player.lane'), 7, 'Held movement must have the same rate at all frame rates');
  run('keys.ArrowRight = false;');
  const lane = run('player.lane'); run('update(0.05)');
  assert.equal(run('player.lane'), lane, 'Releasing movement must stop on the socket');
}
reset(); run('keys.ArrowLeft = true; keys.Space = true; update(0.016)');
assert.equal(run('player.lane'), 15, 'Left movement wraps around the rim');
assert.equal(run('shots[0].lane'), 15, 'Simultaneous move and shot uses the new socket');
run('keys.ArrowLeft = false; keys.ArrowRight = true; update(0.016)');
assert.equal(run('player.lane'), 0, 'Direction reversal responds immediately');
assert.equal(run('wallDepth(0)'), 0);
assert.equal(run('wallDepth(1)'), 1);
assert(run('wallDepth(0.9) - wallDepth(0.8) > wallDepth(0.2) - wallDepth(0.1)'), 'Projection expands the ascent near the rim');
console.log('CONTROLS OK: discrete lanes, shooting alignment, wrap, reversal, 30/60/120 FPS and depth');
