'use strict';

/* ============================================================
   TEMPEST — clon actualizado (edición gráficos espectaculares)
   Canvas 2D + WebAudio, sin dependencias.
   Pipeline: escena aditiva con estelas -> bloom por desenfoque
             -> pasada nítida -> viñeta.
   Controles: ← → / A D moverse · ESPACIO disparar
              SHIFT / Z superzapper · P pausa · ENTER empezar
   ============================================================ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scene = document.createElement('canvas');   // buffer aditivo (estelas + bloom)
const sctx = scene.getContext('2d');

let W = 0, H = 0, CX = 0, CY = 0, R = 0;
function resize() {
  W = canvas.width = scene.width = window.innerWidth;
  H = canvas.height = scene.height = window.innerHeight;
  CX = W / 2;
  CY = H / 2;
  R = Math.min(W, H) * 0.40;
  initStars();
}
window.addEventListener('resize', resize);

/* ---------------- efectos visuales: estado ---------------- */

let elapsed = 0;          // reloj visual global
let shake = 0;            // magnitud de sacudida de pantalla
let flash = 0;            // destello blanco a pantalla completa
let muzzle = 0;           // destello del disparo del jugador
let shockwaves = [];      // {x, y, r, vr, life, maxLife, color}
let zapBolts = [];        // {pts:[{x,y}...], life, maxLife}
let stars = [];           // {x, y, z, tw}
let webPulse = -1;        // profundidad del pulso de energía (-1 = inactivo)
let pulseTimer = 1.5;     // cuenta atrás para el próximo pulso

function initStars() {
  stars = [];
  const n = Math.floor((W * H) / 9000);
  for (let i = 0; i < n; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.25 + Math.random() * 0.75, tw: Math.random() * 6.28 });
  }
}

function addShake(n) { shake = Math.min(shake + n, 22); }

function addShockwave(x, y, color, big) {
  shockwaves.push({
    x, y,
    r: 4,
    vr: (big ? 700 : 420) * (R / 300),
    life: big ? 0.5 : 0.32,
    maxLife: big ? 0.5 : 0.32,
    color,
  });
}

// rayo dentado entre dos puntos
function makeBolt(x0, y0, x1, y1) {
  const pts = [{ x: x0, y: y0 }];
  const segs = 7;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const nx = x0 + (x1 - x0) * t;
    const ny = y0 + (y1 - y0) * t;
    const off = (Math.random() - 0.5) * 40 * (R / 300);
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    pts.push({ x: nx - (dy / len) * off, y: ny + (dx / len) * off });
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}

function fxUpdate(dt, warpK) {
  elapsed += dt;
  shake = Math.max(0, shake - dt * 26);
  flash = Math.max(0, flash - dt * 2.5);
  muzzle = Math.max(0, muzzle - dt);

  for (const s of shockwaves) { s.r += s.vr * dt; s.life -= dt; }
  shockwaves = shockwaves.filter(s => s.life > 0);
  for (const b of zapBolts) b.life -= dt;
  zapBolts = zapBolts.filter(b => b.life > 0);

  // estrellas: deriva sutil; en warp salen disparadas del centro
  for (const st of stars) {
    st.tw += dt * 3;
    const dx = st.x - CX, dy = st.y - CY;
    const d = Math.hypot(dx, dy) || 1;
    const sp = warpK > 0 ? (60 + 900 * warpK) * st.z : 6 * st.z;
    st.x += (dx / d) * sp * dt;
    st.y += (dy / d) * sp * dt;
    if (st.x < -20 || st.x > W + 20 || st.y < -20 || st.y > H + 20) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * R * 0.5;
      st.x = CX + Math.cos(a) * rr;
      st.y = CY + Math.sin(a) * rr;
    }
  }

  // pulso de energía recorriendo el tubo
  pulseTimer -= dt;
  if (pulseTimer <= 0 && webPulse < 0) { webPulse = 0; pulseTimer = 2 + Math.random() * 2; }
  if (webPulse >= 0) {
    webPulse += dt * 1.4;
    if (webPulse > 1.25) webPulse = -1;
  }
}

/* ---------------- geometría del tubo ---------------- */

const LANES = 16;

function poly(k) {
  return function (a) {
    const s = (2 * Math.PI) / k;
    const m = ((a % s) + s) % s;
    return Math.cos(Math.PI / k) / Math.cos(m - Math.PI / k);
  };
}

const SHAPES = [
  { name: 'CIRCLE',   fn: () => 1 },
  { name: 'SQUARE',   fn: poly(4) },
  { name: 'PLUS',     fn: a => 0.62 + 0.38 * Math.abs(Math.cos(2 * a)) },
  { name: 'TRIANGLE', fn: poly(3) },
  { name: 'STAR',     fn: a => 0.70 + 0.30 * Math.abs(Math.sin(2 * a)) },
  { name: 'PENTAGON', fn: poly(5) },
  { name: 'CLOVER',   fn: a => 0.75 + 0.25 * Math.cos(4 * a) },
];

function laneAngle(i) {
  return (i / LANES) * Math.PI * 2 - Math.PI / 2;
}

function wrapLane(l) {
  return ((l % LANES) + LANES) % LANES;
}

// distancia circular con signo entre dos carriles
function laneDist(a, b) {
  let d = wrapLane(a - b);
  if (d > LANES / 2) d -= LANES;
  return d;
}

// punto del tubo: carril (puede ser fraccionario) y profundidad t (0 = fondo, 1 = borde)
function webPoint(shape, lane, t) {
  const i = Math.floor(wrapLane(lane));
  const j = (i + 1) % LANES;
  const f = wrapLane(lane) - i;
  const a0 = laneAngle(i);
  const a1 = a0 + (Math.PI * 2) / LANES;
  const a = a0 + (a1 - a0) * f;
  const r0 = shape.fn(a0);
  const r1 = shape.fn(laneAngle(j));
  const rr = (r0 + (r1 - r0) * f) * R * (0.10 + 0.90 * t);
  return { x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, a };
}

/* ---------------- audio ---------------- */

let AC = null;
function audio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}

function beep(f0, f1, dur, type, vol) {
  const ac = audio();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(f0, 1), ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), ac.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  } catch (e) { /* sin audio */ }
}

const sfx = {
  shoot()     { beep(880, 220, 0.08, 'square', 0.06); },
  hit()       { beep(300, 40, 0.18, 'sawtooth', 0.12); },
  tanker()    { beep(180, 30, 0.25, 'sawtooth', 0.14); },
  spike()     { beep(500, 700, 0.05, 'triangle', 0.05); },
  death()     { beep(400, 20, 0.7, 'sawtooth', 0.18); },
  zap()       { beep(1200, 50, 0.5, 'sawtooth', 0.18); beep(60, 900, 0.4, 'square', 0.10); },
  warp()      { beep(100, 1200, 0.9, 'triangle', 0.12); },
  spawn()     { beep(220, 330, 0.06, 'triangle', 0.04); },
};

/* ---------------- entrada ---------------- */

const keys = {};
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'KeyA', 'KeyD', 'KeyZ', 'KeyP', 'ShiftLeft', 'ShiftRight'];

window.addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  handleKeyPress(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

/* ---------------- estado del juego ---------------- */

const ST = { TITLE: 0, PLAYING: 1, DYING: 2, WARP: 3, GAMEOVER: 4, PAUSED: 5 };
let state = ST.TITLE;

let score = 0;
let hiScore = 0;
try { hiScore = parseInt(localStorage.getItem('tempestHi') || '0', 10) || 0; } catch (e) { hiScore = 0; }
let lives = 3;
let level = 1;
let shape = SHAPES[0];
let zapAvail = true;

let player = { lane: 0, cool: 0, invuln: 0 };
let shots = [];      // {lane, t}
let enemies = [];    // {type, lane, t, speed, targetLane, flipWait, rim, rot}
let particles = [];  // {x, y, vx, vy, life, maxLife, color}
let spikes = new Array(LANES).fill(0);
let spawnQueue = []; // {time, type}
let gameTime = 0;
let stateTimer = 0;

const ENEMY_STYLE = {
  flipper: { color: '#ff4422', score: 150 },
  tanker:  { color: '#cc66ff', score: 100 },
  spiker:  { color: '#33ff66', score: 50  },
};

function levelHue() { return (level * 47) % 360; }

/* ---------------- oleadas ---------------- */

function buildWave(lv) {
  const q = [];
  const nFlip  = Math.min(5 + lv * 2, 22);
  const nTank  = Math.min(1 + lv, 8);
  const nSpike = lv >= 2 ? Math.min(Math.floor(lv / 2) + 1, 6) : 0;
  const bag = [];
  for (let i = 0; i < nFlip; i++) bag.push('flipper');
  for (let i = 0; i < nTank; i++) bag.push('tanker');
  for (let i = 0; i < nSpike; i++) bag.push('spiker');
  // mezclar
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  let t = 1.0;
  const gap = Math.max(0.35, 1.1 - lv * 0.06);
  for (const type of bag) {
    q.push({ time: t, type });
    t += gap * (0.6 + Math.random() * 0.8);
  }
  return q;
}

function spawnEnemy(type) {
  const lane = Math.floor(Math.random() * LANES);
  const base = Math.min(0.10 + level * 0.012, 0.22);
  const e = {
    type,
    lane,
    t: 0,
    speed: type === 'tanker' ? base * 0.55 : base * (0.9 + Math.random() * 0.4),
    targetLane: lane,
    flipWait: 0.3 + Math.random() * 0.7,
    rim: false,
    rot: Math.random() * Math.PI * 2,
  };
  enemies.push(e);
  sfx.spawn();
  const p = webPoint(shape, lane, 0.05);
  addShockwave(p.x, p.y, ENEMY_STYLE[type].color, false);
}

/* ---------------- ciclo de vida ---------------- */

function startGame() {
  score = 0;
  lives = 3;
  level = 1;
  startLevel();
}

function startLevel() {
  shape = SHAPES[(level - 1) % SHAPES.length];
  player = { lane: 0, cool: 0, invuln: 2 };
  shots = [];
  enemies = [];
  particles = [];
  spikes = new Array(LANES).fill(0);
  spawnQueue = buildWave(level);
  gameTime = 0;
  zapAvail = true;
  webPulse = -1;
  pulseTimer = 1;
  state = ST.PLAYING;
}

function killPlayer() {
  if (player.invuln > 0) return;
  sfx.death();
  const p = webPoint(shape, player.lane, 1);
  explode(p.x, p.y, '#ffee33', 40);
  addShockwave(p.x, p.y, '#ffee33', true);
  addShake(18);
  flash = Math.max(flash, 0.5);
  lives--;
  state = ST.DYING;
  stateTimer = 1.6;
}

function respawn() {
  if (lives < 0) {
    if (score > hiScore) {
      hiScore = score;
      try { localStorage.setItem('tempestHi', String(hiScore)); } catch (e) { /* sin storage */ }
    }
    state = ST.GAMEOVER;
    return;
  }
  player.invuln = 2.5;
  player.lane = 0;
  shots = [];
  // empujar a los enemigos del borde hacia dentro para dar aire
  for (const e of enemies) {
    if (e.t > 0.6) { e.t = 0.6; e.rim = false; }
  }
  state = ST.PLAYING;
}

function explode(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (60 + Math.random() * 260) * (R / 300);
    particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5 + Math.random() * 0.6,
      maxLife: 1.1,
      color,
    });
  }
  addShockwave(x, y, color, false);
  addShake(1.5);
}

function addScore(n) { score += n; }

function fireSuperzap() {
  if (!zapAvail || enemies.length === 0) return;
  zapAvail = false;
  flash = 1;
  addShake(14);
  sfx.zap();
  const from = webPoint(shape, player.lane, 1);
  for (const e of enemies) {
    const p = webPoint(shape, e.lane, e.t);
    zapBolts.push({ pts: makeBolt(from.x, from.y, p.x, p.y), life: 0.3, maxLife: 0.3 });
    explode(p.x, p.y, ENEMY_STYLE[e.type].color, 10);
    addScore(ENEMY_STYLE[e.type].score);
  }
  addShockwave(from.x, from.y, '#ff66ff', true);
  enemies = [];
}

function handleKeyPress(code) {
  if (code === 'Enter') {
    audio(); // desbloquear audio con gesto del usuario
    if (state === ST.TITLE || state === ST.GAMEOVER) startGame();
  }
  if (state === ST.PLAYING && (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyZ')) {
    fireSuperzap();
  }
  if (code === 'KeyP') {
    if (state === ST.PLAYING) state = ST.PAUSED;
    else if (state === ST.PAUSED) { state = ST.PLAYING; lastT = performance.now(); }
  }
}

/* ---------------- actualización ---------------- */

function update(dt) {
  gameTime += dt;

  // disparo
  player.cool -= dt;
  if (keys.Space && player.cool <= 0) {
    shots.push({ lane: Math.round(wrapLane(player.lane)) % LANES, t: 1 });
    player.cool = 0.13;
    muzzle = 0.06;
    sfx.shoot();
  }

  // movimiento del jugador
  let dir = 0;
  if (keys.ArrowLeft || keys.KeyA) dir -= 1;
  if (keys.ArrowRight || keys.KeyD) dir += 1;
  player.lane = wrapLane(player.lane + dir * 6.5 * dt);
  player.invuln = Math.max(0, player.invuln - dt);

  // estela del motor al moverse
  if (dir !== 0) {
    const p = webPoint(shape, player.lane, 1.03);
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: p.x, y: p.y,
        vx: (Math.random() - 0.5) * 60 * (R / 300),
        vy: (Math.random() - 0.5) * 60 * (R / 300),
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        color: '#ffcc44',
      });
    }
  }

  // aparición de enemigos
  while (spawnQueue.length && spawnQueue[0].time <= gameTime) {
    spawnEnemy(spawnQueue.shift().type);
  }

  // enemigos
  for (const e of enemies) {
    e.rot += dt * 4;
    if (e.rim) {
      // perseguir al jugador por el borde
      const d = laneDist(player.lane, e.lane);
      const rimSpeed = e.type === 'spiker' ? 1.4 : 2.2;
      e.lane = wrapLane(e.lane + Math.sign(d) * Math.min(Math.abs(d), rimSpeed * dt));
      if (Math.abs(laneDist(player.lane, e.lane)) < 0.4) killPlayer();
      continue;
    }
    e.t += e.speed * dt;

    if (e.type === 'flipper') {
      // saltar de carril en carril
      if (e.lane !== e.targetLane) {
        const d = laneDist(e.targetLane, e.lane);
        e.lane = wrapLane(e.lane + Math.sign(d) * Math.min(Math.abs(d), 3.5 * dt));
      } else {
        e.flipWait -= dt;
        if (e.flipWait <= 0 && e.t > 0.15) {
          e.targetLane = wrapLane(Math.round(e.lane) + (Math.random() < 0.5 ? 1 : -1));
          e.flipWait = 0.4 + Math.random() * 0.9;
        }
      }
    }

    if (e.type === 'spiker') {
      const l = Math.round(wrapLane(e.lane)) % LANES;
      if (e.t > spikes[l]) { spikes[l] = e.t; sfx.spike(); }
    }

    if (e.t >= 1) { e.t = 1; e.rim = true; }
  }

  // disparos
  for (const s of shots) {
    s.t -= 2.2 * dt;

    // colisión con pinchos (se recortan)
    const sl = spikes[s.lane];
    if (sl > 0.02 && s.t <= sl) {
      spikes[s.lane] = Math.max(0, sl - 0.12);
      s.dead = true;
      addScore(10);
      const p = webPoint(shape, s.lane, Math.max(0.02, sl));
      explode(p.x, p.y, '#33ff66', 4);
      continue;
    }

    // colisión con enemigos
    for (const e of enemies) {
      if (e.dead) continue;
      if (Math.abs(laneDist(e.lane, s.lane)) < 0.45 && Math.abs(e.t - s.t) < 0.07) {
        e.dead = true;
        s.dead = true;
        const p = webPoint(shape, e.lane, e.t);
        explode(p.x, p.y, ENEMY_STYLE[e.type].color, 14);
        addScore(ENEMY_STYLE[e.type].score);
        if (e.type === 'tanker') {
          sfx.tanker();
          addShockwave(p.x, p.y, ENEMY_STYLE.tanker.color, true);
          addShake(4);
          for (const off of [-1, 1]) {
            enemies.push({
              type: 'flipper',
              lane: wrapLane(e.lane + off),
              t: Math.max(0, e.t - 0.02),
              speed: Math.min(0.10 + level * 0.012, 0.22),
              targetLane: wrapLane(e.lane + off),
              flipWait: 0.3,
              rim: false,
              rot: 0,
            });
          }
        } else {
          sfx.hit();
        }
        break;
      }
    }
  }
  shots = shots.filter(s => !s.dead && s.t > 0);
  enemies = enemies.filter(e => !e.dead);

  // pincho que llega al borde mata si el jugador está en ese carril
  const pl = Math.round(wrapLane(player.lane)) % LANES;
  if (spikes[pl] >= 0.96 && player.invuln <= 0) killPlayer();

  updateParticles(dt);

  // nivel superado
  if (spawnQueue.length === 0 && enemies.length === 0) {
    addScore(level * 250);
    addShake(6);
    sfx.warp();
    state = ST.WARP;
    stateTimer = 1.8;
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

/* ---------------- dibujo en el buffer de escena (aditivo) ---------------- */

function sStroke(pts, close, color, width, glow) {
  sctx.strokeStyle = color;
  sctx.lineWidth = width;
  sctx.shadowColor = glow || color;
  sctx.shadowBlur = glow ? 14 : 0;
  sctx.beginPath();
  sctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) sctx.lineTo(pts[i].x, pts[i].y);
  if (close) sctx.closePath();
  sctx.stroke();
  sctx.shadowBlur = 0;
}

function drawWeb(zoom, alpha) {
  const hue = levelHue();
  const breathe = 0.72 + 0.28 * Math.sin(elapsed * 2.2);
  const z = zoom || 1;
  const pt = (lane, t) => {
    const p = webPoint(shape, lane, t);
    return { x: CX + (p.x - CX) * z, y: CY + (p.y - CY) * z };
  };
  // anillos
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    const pts = [];
    for (let i = 0; i < LANES; i++) pts.push(pt(i, t));
    const rim = t === 1;
    const bright = (0.35 + 0.65 * t) * breathe * alpha;
    sctx.save();
    if (rim) {
      sctx.setLineDash([14, 18]);
      sctx.lineDashOffset = -elapsed * 90;
    }
    sStroke(pts, true, `hsla(${hue}, 100%, ${rim ? 65 : 55}%, ${bright})`, rim ? 3 : 1.4, rim);
    sctx.restore();
  }
  // carriles
  for (let i = 0; i < LANES; i++) {
    sStroke([pt(i, 0), pt(i, 1)], false, `hsla(${hue}, 100%, 55%, ${0.5 * breathe * alpha})`, 1.2);
  }
  // pulso de energía viajando por el tubo
  if (webPulse >= 0 && webPulse <= 1) {
    const pts = [];
    for (let i = 0; i < LANES; i++) pts.push(pt(i, webPulse));
    sStroke(pts, true, `hsla(${hue}, 100%, 85%, ${(1 - webPulse) * 0.9 * alpha})`, 3.5, true);
  }
}

function drawPlayer() {
  if (state === ST.DYING) return;
  if (player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0) return; // parpadeo
  const l = player.lane;
  const pts = [
    webPoint(shape, l - 0.42, 1.01),
    webPoint(shape, l - 0.15, 0.97),
    webPoint(shape, l, 1.09),
    webPoint(shape, l + 0.15, 0.97),
    webPoint(shape, l + 0.42, 1.01),
  ];
  sStroke(pts, false, '#ffee33', 3, true);
  // núcleo brillante
  const c = webPoint(shape, l, 1.0);
  sctx.fillStyle = '#fff7cc';
  sctx.shadowColor = '#ffee33';
  sctx.shadowBlur = 18;
  sctx.beginPath();
  sctx.arc(c.x, c.y, 3.5 * (R / 300) + 1.5, 0, Math.PI * 2);
  sctx.fill();
  sctx.shadowBlur = 0;
  // fogonazo del disparo
  if (muzzle > 0) {
    sctx.fillStyle = `rgba(255,255,255,${muzzle / 0.06})`;
    sctx.beginPath();
    sctx.arc(c.x, c.y, 12 * (R / 300) * (muzzle / 0.06) + 3, 0, Math.PI * 2);
    sctx.fill();
  }
}

function drawShots() {
  for (const s of shots) {
    const p1 = webPoint(shape, s.lane, Math.max(0, s.t - 0.06));
    const p2 = webPoint(shape, s.lane, s.t);
    sStroke([p1, p2], false, '#aaddff', 2.5, true);
    sctx.fillStyle = '#ffffff';
    sctx.shadowColor = '#aaddff';
    sctx.shadowBlur = 14;
    sctx.beginPath();
    sctx.arc(p2.x, p2.y, 3 * (R / 300) + 1, 0, Math.PI * 2);
    sctx.fill();
    sctx.shadowBlur = 0;
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const p = webPoint(shape, e.lane, e.t);
    const s = (5 + 15 * e.t) * (R / 300);
    const color = ENEMY_STYLE[e.type].color;
    sctx.save();
    sctx.translate(p.x, p.y);
    sctx.rotate(e.rot);
    sctx.strokeStyle = color;
    sctx.lineWidth = 2.2;
    sctx.shadowColor = color;
    sctx.shadowBlur = 14;
    sctx.beginPath();
    if (e.type === 'flipper') {
      sctx.rect(-s / 2, -s / 2, s, s);
      sctx.stroke();
      sctx.rotate(Math.PI / 4);
      sctx.beginPath();
      sctx.rect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
    } else if (e.type === 'tanker') {
      sctx.moveTo(0, -s * 0.9);
      sctx.lineTo(s * 0.9, 0);
      sctx.lineTo(0, s * 0.9);
      sctx.lineTo(-s * 0.9, 0);
      sctx.closePath();
    } else {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rr = k % 2 === 0 ? s : s * 0.4;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (k === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
      }
      sctx.closePath();
    }
    sctx.stroke();
    sctx.restore();
  }
  sctx.shadowBlur = 0;
}

function drawSpikes() {
  for (let i = 0; i < LANES; i++) {
    if (spikes[i] > 0.02) {
      const p1 = webPoint(shape, i, 0.02);
      const p2 = webPoint(shape, i, spikes[i]);
      const danger = spikes[i] > 0.8;
      const blink = danger ? (0.6 + 0.4 * Math.sin(elapsed * 12)) : 1;
      sStroke([p1, p2], false, danger ? `rgba(255,51,51,${blink})` : '#33ff66', 2.2, danger);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    sctx.strokeStyle = p.color;
    sctx.globalAlpha = a;
    sctx.lineWidth = 2.2;
    sctx.beginPath();
    sctx.moveTo(p.x, p.y);
    sctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
}

function drawShockwaves() {
  for (const s of shockwaves) {
    const a = Math.max(0, s.life / s.maxLife);
    sctx.strokeStyle = s.color;
    sctx.globalAlpha = a * 0.8;
    sctx.lineWidth = 2.5 * a + 0.5;
    sctx.beginPath();
    sctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    sctx.stroke();
  }
  sctx.globalAlpha = 1;
}

function drawZapBolts() {
  for (const b of zapBolts) {
    const a = Math.max(0, b.life / b.maxLife);
    sStroke(b.pts, false, `rgba(255,120,255,${a})`, 3.5, true);
    sStroke(b.pts, false, `rgba(255,255,255,${a})`, 1.2, false);
  }
}

/* ---------------- fondo y postprocesado ---------------- */

function drawNebula() {
  const hue = levelHue();
  for (let i = 0; i < 3; i++) {
    const px = CX + Math.sin(level * 3.7 + i * 2.4 + elapsed * 0.05) * W * 0.28;
    const py = CY + Math.cos(level * 2.9 + i * 1.7 + elapsed * 0.04) * H * 0.26;
    const rr = R * (1.1 + i * 0.5);
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, `hsla(${(hue + i * 60) % 360}, 90%, 45%, 0.10)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawStarsMain(warpK) {
  for (const st of stars) {
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(st.tw));
    ctx.fillStyle = `rgba(200,220,255,${tw * st.z})`;
    const sz = st.z * 1.8;
    if (warpK > 0.05) {
      const dx = st.x - CX, dy = st.y - CY;
      const d = Math.hypot(dx, dy) || 1;
      const len = warpK * 90 * st.z;
      ctx.strokeStyle = `rgba(180,220,255,${tw * st.z})`;
      ctx.lineWidth = sz;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x - (dx / d) * len, st.y - (dy / d) * len);
      ctx.stroke();
    } else {
      ctx.fillRect(st.x, st.y, sz, sz);
    }
  }
}

function drawVignette() {
  const g = ctx.createRadialGradient(CX, CY, R * 0.55, CX, CY, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ---------------- textos e HUD (pasada nítida) ---------------- */

function text(str, x, y, size, color, align) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px 'Courier New', monospace`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

function drawHUD() {
  text('SCORE ' + score, 20, 24, 20, '#00ffee', 'left');
  text('HI ' + hiScore, W / 2, 24, 16, '#008888');
  text('LEVEL ' + level + ' — ' + shape.name, W - 20, 24, 16, `hsl(${levelHue()},100%,60%)`, 'right');
  // vidas
  for (let i = 0; i < Math.max(0, lives); i++) {
    text('Y', W - 24 - i * 22, 52, 18, '#ffee33');
  }
  if (zapAvail) text('SUPERZAPPER LISTO [SHIFT]', W / 2, H - 24, 14, '#ff66ff');
}

function drawTitle() {
  const pulse = 1 + 0.04 * Math.sin(elapsed * 3);
  const size = Math.min(72, W / 12) * pulse;
  text('T E M P E S T', W / 2, H * 0.30, size, '#00ffee');
  text('un clon actualizado del clásico de 1981', W / 2, H * 0.30 + 58, 16, '#008888');
  const lines = [
    '← →  o  A D    moverse por el borde',
    'ESPACIO        disparar',
    'SHIFT / Z      superzapper (1 por nivel)',
    'P              pausa',
    '',
    'destruye todo lo que suba por el tubo',
    'cuidado con los pinchos verdes: dispárales para recortarlos',
  ];
  lines.forEach((l, i) => text(l, W / 2, H * 0.52 + i * 26, 16, '#aaaaaa'));
  if (hiScore > 0) text('RÉCORD ' + hiScore, W / 2, H * 0.76, 16, '#ffee33');
  if (Math.floor(elapsed * 2) % 2 === 0) {
    text('PULSA ENTER', W / 2, H * 0.85, 22, '#ffee33');
  }
}

function drawGameOver() {
  text('GAME OVER', W / 2, H * 0.38, 56, '#ff3333');
  text('SCORE ' + score, W / 2, H * 0.50, 24, '#00ffee');
  if (score >= hiScore && score > 0) text('¡NUEVO RÉCORD!', W / 2, H * 0.56, 20, '#ffee33');
  if (Math.floor(elapsed * 2) % 2 === 0) {
    text('PULSA ENTER PARA REINTENTAR', W / 2, H * 0.68, 18, '#aaaaaa');
  }
}

/* ---------------- pipeline de render ---------------- */

function drawScene(warpK) {
  // estelas: fundir el frame anterior en vez de borrar
  sctx.globalCompositeOperation = 'source-over';
  sctx.fillStyle = 'rgba(2,2,10,0.30)';
  sctx.fillRect(0, 0, W, H);
  sctx.globalCompositeOperation = 'lighter';

  if (state === ST.TITLE || state === ST.GAMEOVER) {
    drawWeb(1, 0.35);
    drawParticles();
    return;
  }
  if (state === ST.WARP) {
    drawWeb(1 + warpK * 2.5, 1 - warpK * 0.7);
    drawParticles();
    drawShockwaves();
    return;
  }
  drawWeb(1, 1);
  drawSpikes();
  drawShots();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawShockwaves();
  drawZapBolts();
}

function render(warpK) {
  // fondo
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#02020a';
  ctx.fillRect(0, 0, W, H);
  drawNebula();
  drawStarsMain(warpK);

  // escena con estelas -> bloom -> nítida
  drawScene(warpK);
  const sx = (Math.random() * 2 - 1) * shake;
  const sy = (Math.random() * 2 - 1) * shake;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.globalCompositeOperation = 'lighter';
  try {
    ctx.filter = 'blur(6px)';
    ctx.drawImage(scene, 0, 0);
    ctx.filter = 'none';
  } catch (e) { /* navegador sin ctx.filter */ }
  ctx.drawImage(scene, 0, 0);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';

  // textos y HUD por encima, sin estelas
  if (state === ST.TITLE) drawTitle();
  else if (state === ST.GAMEOVER) drawGameOver();
  else if (state === ST.WARP) {
    text('NIVEL ' + level + ' SUPERADO', W / 2, H * 0.42, 30, '#00ffee');
    text('BONUS +' + level * 250, W / 2, H * 0.42 + 42, 20, '#ffee33');
  } else {
    drawHUD();
    if (state === ST.DYING) text('¡ZAS!', W / 2, H * 0.4, 44, '#ffee33');
    if (state === ST.PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      text('PAUSA', W / 2, H / 2, 40, '#00ffee');
      text('P para continuar', W / 2, H / 2 + 45, 16, '#aaaaaa');
    }
  }

  drawVignette();
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------------- bucle principal ---------------- */

let lastT = performance.now();
function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  const warpK = state === ST.WARP ? (1 - stateTimer / 1.8) : 0;

  if (state !== ST.PAUSED) {
    fxUpdate(dt, warpK);

    switch (state) {
      case ST.PLAYING:
        update(dt);
        break;
      case ST.DYING:
        stateTimer -= dt;
        updateParticles(dt);
        if (stateTimer <= 0) respawn();
        break;
      case ST.WARP:
        stateTimer -= dt;
        updateParticles(dt);
        if (stateTimer <= 0) {
          level++;
          startLevel();
        }
        break;
    }
  }

  render(warpK);
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
