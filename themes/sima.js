/* ============================================================
   SIMA — fábrica de temas de sprites para el "tubo-hoyo"
   ------------------------------------------------------------
   window.makeSimaTheme(config) crea un tema completo de pozo
   visto desde arriba: fondo pintado (o procedural de fallback),
   paredes de roca, torreta y bichos con escorzo, sombra de
   contacto, oscurecimiento por profundidad y cuerda opcional.

   Los temas concretos (marino, aranas, volcan...) son solo un
   objeto de configuración — ver themes/marino.js como ejemplo.

   Config:
     id, name, desc
     playerColor, engineColor, shotColor, spikeColor,
     spikeDangerColor, zapColor
     enemies: { flipper:{color,score}, tanker:{...}, spiker:{...} }
     dir: 'assets/themes/X/'   files: {player, flipper, tanker, spiker}
     fondo: true si hay fondo.png pintado en dir
     fondoDim: 0..1 oscurece el fondo pintado (def. 0.3)
     playerSize: tamaño base del sprite del jugador (def. 96)
     rope: color CSS de la cuerda bajo los bichos, o null
     flicker: true para que los bichos pulsen en tamaño (fuego)
     bright: [min, max] brillo según profundidad (def. [0.4, 1])
     squash: [min, max] escorzo radial (def. [0.38, 1])
     solid: true dibuja los bichos opacos sobre ctx (para sprites
            oscuros que el pipeline aditivo volvería transparentes)
     solidPlayer: igual que solid pero solo para el jugador
     spriteGain: 0..1 atenúa sprites en el buffer aditivo (def. 0.6)
     scorch: true (carbón) u objeto {types, color, alpha, bigAlpha,
            life} — los bichos dejan rastro en la pared (chamuscado,
            baba...) que se desvanece a los pocos segundos
     abyss: {inner, mid, edge} gradiente del hoyo
     wall: 'r,g,b' de las bandas de roca
     rimDark, rimLight: colores de la cornisa
     ground: {near, mid, far} fallback procedural de suelo
     glowCenter: 'r,g,b' o null — resplandor pulsátil del fondo
     glowAlpha: intensidad del resplandor (def. 0.16)
     motion: {flipper, tanker, spiker}: climb (def.), float, flap, pulse, flame
     scorch.flames: llamas persistentes que se apagan al pasar el agua
     shots: 'default' | 'agua'
   ============================================================ */
(function () {
  'use strict';

  function placeholder() {
    return (window.TEMPEST_THEMES || []).find(t => t.id === 'placeholder');
  }

  window.makeSimaTheme = function (cfg) {
    const IMG = {};
    if (typeof Image !== 'undefined') {
      const files = Object.assign({}, cfg.files, cfg.fondo ? { fondo: 'fondo' } : {});
      for (const k in files) {
        const img = new Image();
        img.src = cfg.dir + files[k] + '.png';
        IMG[k] = img;
      }
    }

    function sprite(k) {
      const img = IMG[k];
      return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    function shapePath(c, g, t) {
      c.beginPath();
      for (let i = 0; i < g.LANES; i++) {
        const p = g.webPoint(g.shape, i, t);
        if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      }
      c.closePath();
    }

    /* rocas del suelo (fallback), estables entre frames */
    let rocks = null, rocksKey = '';
    function groundRocks(g) {
      const key = cfg.id + ':' + g.W + 'x' + g.H + ':' + Math.round(g.R);
      if (rocks && rocksKey === key) return rocks;
      rocksKey = key;
      rocks = [];
      for (let i = 0; i < 130; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = g.R * (1.04 + Math.random() * 0.85);
        const x = g.CX + Math.cos(a) * rr;
        const y = g.CY + Math.sin(a) * rr;
        if (x < -10 || x > g.W + 10 || y < -10 || y > g.H + 10) continue;
        rocks.push({ x, y, r: 1.5 + Math.random() * 5.5, tone: 18 + Math.floor(Math.random() * 30) });
      }
      return rocks;
    }

    /* pseudo-aleatorio determinista (texturas estables entre frames) */
    function rnd(a, b) {
      const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return x - Math.floor(x);
    }

    /* motas y grietas de la pared, en coordenadas (carril, profundidad)
       para que sigan la forma del nivel; se regeneran por nivel/tamaño */
    let specks = null, specksKey = '';
    function wallSpecks(g) {
      const key = cfg.id + ':' + g.level + ':' + g.W + 'x' + g.H + ':' + Math.round(g.R);
      if (specks && specksKey === key) return specks;
      specksKey = key;
      specks = { dots: [], cracks: [] };
      for (let i = 0; i < 110; i++) {
        specks.dots.push({
          lane: rnd(i, 1) * g.LANES,
          t: 0.06 + rnd(i, 2) * 0.88,
          r: 0.5 + rnd(i, 3) * 2.2,
          light: rnd(i, 4) > 0.45,
          a: 0.10 + rnd(i, 5) * 0.22,
        });
      }
      for (let i = 0; i < 26; i++) {
        specks.cracks.push({
          lane: rnd(i, 11) * g.LANES,
          t: 0.10 + rnd(i, 12) * 0.82,
          dl: (rnd(i, 13) - 0.5) * 1.4,
          dt: (rnd(i, 14) - 0.5) * 0.10,
          a: 0.12 + rnd(i, 15) * 0.20,
        });
      }
      return specks;
    }

    /* rastros en la pared (chamuscado del fuego, baba del slime...):
       los bichos marcan la pared a su paso y al morir; las marcas
       se desvanecen a los pocos segundos.
       cfg.scorch: true (carbón negro) u objeto:
         types: qué enemigos dejan rastro (def. todos)
         color: 'r,g,b' de la marca (def. '6,3,2')
         alpha / bigAlpha: intensidad normal / al morir
         life: segundos hasta desaparecer (def. 4.5)
         glow: true dibuja la marca en aditivo (ascuas, seda
               brillante) en vez de oscurecer la pared */
    const SC = cfg.scorch ? Object.assign(
      { types: null, color: '6,3,2', alpha: 0.8, bigAlpha: 0.92, life: 4.5, glow: false },
      cfg.scorch === true ? {} : cfg.scorch) : null;
    let scorches = [], scorchPrev = new Set(), scorchLast = -1;
    let shotPrev = new WeakMap();
    const poses = new WeakMap();

    // Ciclo ligado al avance: las patas apoyadas tiran del cuerpo hacia arriba.
    function pose(g, e) {
      let v = poses.get(e);
      if (!v) {
        v = { t: e.t, lane: e.lane, phase: e.rot || e.lane, turn: 0 };
        poses.set(e, v);
      }
      const dl = ((e.lane - v.lane + g.LANES * 1.5) % g.LANES) - g.LANES / 2;
      const advance = e.t - v.t;
      v.phase += Math.abs(advance) * 110 + Math.abs(dl) * 2.5;
      v.turn = Math.abs(dl) > 0.0001 ? Math.sign(dl) * 0.20 : v.turn * 0.8;
      v.t = e.t; v.lane = e.lane;
      return v;
    }

    function flame(c, x, y, radius, clock, alpha) {
      c.save();
      c.translate(x, y);
      c.globalAlpha *= alpha;
      for (let i = 0; i < 3; i++) {
        const w = radius * (0.48 - i * 0.10);
        const h = radius * (1.6 - i * 0.34) * (1 + 0.16 * Math.sin(clock * 9 + i));
        const sway = Math.sin(clock * 7 + i * 2) * radius * 0.25;
        c.fillStyle = ['#ed3910', '#ff951c', '#fff1a0'][i];
        c.beginPath();
        c.moveTo(-w, radius * 0.25);
        c.bezierCurveTo(-w * 1.5, -h * 0.35, sway - w * 0.3, -h * 0.65, sway, -h);
        c.bezierCurveTo(sway + w * 0.4, -h * 0.45, w * 1.5, -h * 0.1, w, radius * 0.25);
        c.closePath(); c.fill();
      }
      c.restore();
    }
    function updateScorch(g) {
      const dt = scorchLast < 0 ? 0 : Math.min(0.1, Math.max(0, g.elapsed - scorchLast));
      scorchLast = g.elapsed;
      const marked = e => !SC.types || SC.types.indexOf(e.type) >= 0;
      for (const e of g.enemies) {
        if (!marked(e)) continue;
        if (e._scorchT === undefined || Math.abs(e.t - e._scorchT) > (SC.flames ? 0.016 : 0.035) || (SC.flames && Math.abs(e.lane - (e._scorchLane ?? e.lane)) > 0.12)) {
          e._scorchT = e.t; e._scorchLane = e.lane;
          scorches.push({ lane: e.lane, t: e.t, age: 0, big: false });
        }
      }
      for (const e of scorchPrev) {
        // desaparecio sin llegar a la cornisa: lo matamos -> marca grande
        if (!SC.flames && marked(e) && g.enemies.indexOf(e) < 0 && e.t < 0.92) {
          scorches.push({ lane: e.lane, t: e.t, age: 0, big: true });
        }
      }
      scorchPrev = new Set(g.enemies);
      if (SC.flames) {
        for (const sh of g.shots) {
          const last = shotPrev.get(sh) ?? 1;
          scorches = scorches.filter(m => {
            const dl = Math.abs(((m.lane - sh.lane + g.LANES * 1.5) % g.LANES) - g.LANES / 2);
            if (dl < 0.45 && m.t >= sh.t - 0.04 && m.t <= last + 0.04) m.extinguished = true;
            return true;
          });
          shotPrev.set(sh, sh.t);
        }
      }
      for (const m of scorches) m.age += dt;
      scorches = scorches.filter(m => m.age < SC.life);
      if (scorches.length > 400) scorches.splice(0, scorches.length - 400);
    }
    function drawScorch(g) {
      const c = g.ctx;
      if (SC.glow && !SC.flames) c.globalCompositeOperation = 'lighter';
      for (const m of scorches) {
        const p = g.webPoint(g.shape, m.lane, m.t);
        if (SC.flames) {
          c.save(); c.translate(p.x, p.y); c.rotate(p.a + Math.PI / 2);
          const fade = Math.min(1, (SC.life - m.age) / 3);
          const depth = g.wallDepth ? g.wallDepth(m.t) : m.t;
          const r = (4 + depth * 17) * (g.R / 300);
          const clock = g.elapsed + m.lane * 3 + m.t * 17;
          // Carbon sobre la roca, con luz local y varios frentes de llama.
          c.fillStyle = `rgba(12,5,2,${0.7 * fade})`;
          c.beginPath(); c.ellipse(0, 0, r * 1.1, r * 1.5, 0, 0, Math.PI * 2); c.fill();
          if (!m.extinguished) {
            const glow = c.createRadialGradient(0, 0, 0, 0, 0, r * 3.5);
            glow.addColorStop(0, `rgba(255,108,12,${0.32 * fade})`);
            glow.addColorStop(1, 'rgba(255,50,0,0)');
            c.fillStyle = glow; c.fillRect(-r * 3.5, -r * 3.5, r * 7, r * 7);
            for (let j = 0; j < 3; j++) {
              const shift = (rnd(j, m.t * 13 + m.lane) - 0.5) * r * 1.6;
              flame(c, shift, j * r * 0.25, r * (0.65 + rnd(j, m.lane) * 0.5), clock + j * 1.7, fade);
            }
            const rise = (g.elapsed * 0.7 + m.t * 9) % 1;
            c.fillStyle = `rgba(255,185,65,${(1 - rise) * fade})`;
            c.beginPath(); c.arc(Math.sin(clock * 2) * r, -rise * r * 4, r * 0.10, 0, Math.PI * 2); c.fill();
          }
          c.restore();
          continue;
        }
        const pr = (13 + m.t * 26) * (g.R / 300) * (m.big ? 1.9 : 1);
        // prende rapido, tarda en enfriarse
        const k = Math.min(1, m.age * 6) * (1 - m.age / SC.life);
        const a = (m.big ? SC.bigAlpha : SC.alpha) * k;
        if (a <= 0.01) continue;
        const grd = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr);
        grd.addColorStop(0, `rgba(${SC.color},${a})`);
        grd.addColorStop(0.65, `rgba(${SC.color},${a * 0.55})`);
        grd.addColorStop(1, `rgba(${SC.color},0)`);
        c.fillStyle = grd;
        c.beginPath();
        c.arc(p.x, p.y, pr, 0, Math.PI * 2);
        c.fill();
      }
      if (SC.glow && !SC.flames) c.globalCompositeOperation = 'source-over';
    }

    const bright = cfg.bright || [0.4, 1.0];
    const squashR = cfg.squash || [0.38, 1.0];
    const playerSize = cfg.playerSize || 96;

    return {
      reset() {
        scorches = []; scorchPrev.clear(); scorchLast = -1;
        shotPrev = new WeakMap();
      },
      id: cfg.id,
      name: cfg.name,
      desc: cfg.desc,
      playerColor: cfg.playerColor,
      engineColor: cfg.engineColor,
      shotColor: cfg.shotColor,
      spikeColor: cfg.spikeColor,
      spikeDangerColor: cfg.spikeDangerColor,
      zapColor: cfg.zapColor,
      enemies: cfg.enemies,

      drawBackground(g) {
        const c = g.ctx;
        const bg = sprite('fondo');
        if (bg) {
          const sc = Math.max(g.W / bg.naturalWidth, g.H / bg.naturalHeight);
          const bw = bg.naturalWidth * sc, bh = bg.naturalHeight * sc;
          c.drawImage(bg, (g.W - bw) / 2, (g.H - bh) / 2, bw, bh);
          // atenuar: la escena se compone en aditivo y un fondo claro
          // "lava" los sprites
          c.fillStyle = `rgba(0,0,0,${cfg.fondoDim ?? 0.3})`;
          c.fillRect(0, 0, g.W, g.H);
        } else {
          const g0 = c.createRadialGradient(g.CX, g.CY, g.R * 0.9, g.CX, g.CY, Math.max(g.W, g.H) * 0.75);
          g0.addColorStop(0, cfg.ground.near);
          g0.addColorStop(0.45, cfg.ground.mid);
          g0.addColorStop(1, cfg.ground.far);
          c.fillStyle = g0;
          c.fillRect(0, 0, g.W, g.H);
          for (const r of groundRocks(g)) {
            c.fillStyle = `rgba(${r.tone},${r.tone + 14},${r.tone + 12},0.55)`;
            c.beginPath();
            c.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            c.fill();
          }
        }
        // el hoyo (siempre procedural: coincide con la forma del nivel)
        const grad = c.createRadialGradient(g.CX, g.CY, 0, g.CX, g.CY, g.R * 1.05);
        grad.addColorStop(0, cfg.abyss.inner);
        grad.addColorStop(0.55, cfg.abyss.mid);
        grad.addColorStop(1, cfg.abyss.edge);
        shapePath(c, g, 1);
        c.fillStyle = grad;
        c.fill();
        // Caras del pozo: luces distintas y convergencia hacia un fondo desplazado.
        c.save(); shapePath(c, g, 1); c.clip();
        for (let lane = 0; lane < g.LANES; lane++) {
          const outer = g.webPoint(g.shape, lane + 0.5, 1);
          const inner = g.webPoint(g.shape, lane + 0.5, 0);
          const face = c.createLinearGradient(inner.x, inner.y, outer.x, outer.y);
          const light = 0.10 + 0.12 * (0.5 + 0.5 * Math.cos(lane * Math.PI * 2 / g.LANES - 0.8));
          face.addColorStop(0, 'rgba(0,0,0,0.95)');
          face.addColorStop(0.35, 'rgba(0,0,0,0.5)');
          face.addColorStop(1, `rgba(155,159,165,${light})`);
          const corners = [[lane, 0], [lane, 1], [lane + 1, 1], [lane + 1, 0]];
          c.beginPath();
          corners.forEach(([l, t], i) => { const p = g.webPoint(g.shape, l, t); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
          c.closePath(); c.fillStyle = face; c.fill();
        }
        shapePath(c, g, 0); c.fillStyle = 'rgba(0,0,0,0.92)'; c.fill();
        c.restore();
        // bandas de roca con jitter: estratos irregulares, no geometricos
        for (let bi = 0; bi < 10; bi++) {
          const t = 0.08 + bi * 0.098;
          c.beginPath();
          for (let i = 0; i <= g.LANES; i++) {
            const tj = Math.max(0.03, Math.min(0.99, t + (rnd(i, bi * 7 + 1) - 0.5) * 0.07));
            const p = g.webPoint(g.shape, i, tj);
            if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
          }
          c.strokeStyle = `rgba(${cfg.wall},${0.06 + t * 0.30})`;
          c.lineWidth = 0.8 + t * 6 + rnd(bi, 99) * 2.5;
          c.stroke();
        }
        // vetas radiales (ligeramente quebradas)
        for (let i = 0; i < g.LANES; i++) {
          const p1 = g.webPoint(g.shape, i, 0.05);
          const pm = g.webPoint(g.shape, i + (rnd(i, 55) - 0.5) * 0.35, 0.5);
          const p2 = g.webPoint(g.shape, i, 1);
          c.strokeStyle = `rgba(${cfg.wall},0.28)`;
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(p1.x, p1.y);
          c.quadraticCurveTo(pm.x, pm.y, p2.x, p2.y);
          c.stroke();
        }
        // textura de la pared: motas claras/oscuras y grietas
        const sp = wallSpecks(g);
        for (const d of sp.dots) {
          const p = g.webPoint(g.shape, d.lane, d.t);
          const r = d.r * (0.2 + (g.wallDepth ? g.wallDepth(d.t) : d.t) * 2) * (g.R / 300);
          c.fillStyle = d.light ? `rgba(${cfg.wall},${d.a + d.t * 0.12})` : `rgba(0,0,0,${d.a})`;
          c.beginPath();
          c.arc(p.x, p.y, r, 0, Math.PI * 2);
          c.fill();
        }
        for (const k of sp.cracks) {
          const p1 = g.webPoint(g.shape, k.lane, k.t);
          const p2 = g.webPoint(g.shape, k.lane + k.dl, Math.max(0.03, Math.min(0.99, k.t + k.dt)));
          c.strokeStyle = `rgba(0,0,0,${k.a})`;
          c.lineWidth = (0.6 + k.t * 1.4) * (g.R / 300) + 0.4;
          c.beginPath();
          c.moveTo(p1.x, p1.y);
          c.lineTo(p2.x, p2.y);
          c.stroke();
        }
        // luz cenital suave: arriba-izquierda mas claro, abajo-derecha en sombra
        const lg = c.createLinearGradient(0, 0, g.W, g.H);
        lg.addColorStop(0, 'rgba(255,255,255,0.05)');
        lg.addColorStop(0.5, 'rgba(0,0,0,0)');
        lg.addColorStop(1, 'rgba(0,0,0,0.15)');
        c.fillStyle = lg;
        c.fillRect(0, 0, g.W, g.H);
        // chamuscado del fuego (solo temas con scorch)
        if (cfg.scorch) { updateScorch(g); drawScorch(g); }
        // cornisa
        shapePath(c, g, 1);
        c.strokeStyle = cfg.rimDark;
        c.lineWidth = 16 * (g.R / 300);
        c.stroke();
        shapePath(c, g, 1);
        c.strokeStyle = cfg.rimLight;
        c.lineWidth = 2;
        c.stroke();
        // sombra interior bajo la cornisa (oclusion) + vineta de camara
        shapePath(c, g, 0.93);
        c.strokeStyle = 'rgba(0,0,0,0.30)';
        c.lineWidth = g.R * 0.045;
        c.stroke();
        const vg = c.createRadialGradient(g.CX, g.CY, Math.min(g.W, g.H) * 0.42, g.CX, g.CY, Math.max(g.W, g.H) * 0.72);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.42)');
        c.fillStyle = vg;
        c.fillRect(0, 0, g.W, g.H);
      },

      drawWeb(g, zoom, alpha) {
        const hue = g.levelHue();
        const breathe = 0.72 + 0.28 * Math.sin(g.elapsed * 2.2);
        const pt = (lane, t) => {
          const p = g.webPoint(g.shape, lane, t);
          return { x: g.CX + (p.x - g.CX) * zoom, y: g.CY + (p.y - g.CY) * zoom };
        };
        // resplandor del fondo del hoyo (fuego, lava...)
        if (cfg.glowCenter) {
          const amp = cfg.glowAlpha || 0.16;
          const pulse = amp * (0.6 + 0.4 * Math.sin(g.elapsed * 3.1));
          const s = g.sctx;
          const grad = s.createRadialGradient(g.CX, g.CY, 0, g.CX, g.CY, g.R * 0.75 * zoom);
          grad.addColorStop(0, `rgba(${cfg.glowCenter},${pulse * alpha})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');          s.fillStyle = grad;
          s.fillRect(0, 0, g.W, g.H);
        }
        const c = g.sctx;
        c.save();
        for (let lane = 0; lane < g.LANES; lane++) {
          const active = lane === g.player.lane;
          const p = pt(lane, 1);
          if (active) g.sStroke([pt(lane, 0.04), p], false, 'rgba(160,215,235,0.13)', 1);
          c.fillStyle = active ? 'rgba(185,237,255,0.8)' : 'rgba(170,181,189,0.25)';
          c.beginPath(); c.arc(p.x, p.y, (active ? 4 : 2) * g.R / 300, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      },

      drawPlayer(g) {
        const img = sprite('player');
        if (!img) { placeholder().drawPlayer(g); return; }
        const p = g.webPoint(g.shape, g.player.lane, 1.0);
        const size = playerSize * (g.R / 300);
        // solidPlayer: sprite oscuro -> opaco sobre ctx (ver drawEnemies)
        const s = cfg.solidPlayer ? g.ctx : g.sctx;
        s.save();
        s.translate(p.x, p.y);
        s.rotate(p.a - Math.PI / 2); // boca hacia el fondo del hoyo
        s.globalCompositeOperation = 'source-over';
        const gain = cfg.solidPlayer ? 1 : (cfg.spriteGain ?? 0.6);
        try { s.filter = `brightness(${gain.toFixed(2)})`; } catch (err) { /* sin filter */ }
        s.drawImage(img, -size / 2, -size / 2, size, size);
        s.restore();
        if (g.muzzle > 0 && cfg.shots !== 'agua') {
          const tx = p.x + Math.cos(p.a + Math.PI) * size * 0.42;
          const ty = p.y + Math.sin(p.a + Math.PI) * size * 0.42;
          g.sctx.fillStyle = `rgba(255,255,255,${g.muzzle / 0.06})`;
          g.sctx.beginPath();
          g.sctx.arc(tx, ty, 10 * (g.R / 300) * (g.muzzle / 0.06) + 2, 0, Math.PI * 2);
          g.sctx.fill();
        }
      },

      drawEnemies(g) {
        const ph = placeholder();
        for (const e of [...g.enemies].sort((a, b) => a.t - b.t)) {
          const p = g.webPoint(g.shape, e.lane, e.t);
          const img = sprite(e.type);
          if (!img) { ph.drawEnemy(g, e); continue; }
          const depth = g.wallDepth ? g.wallDepth(e.t) : e.t;
          let size = (22 + 142 * depth) * (g.R / 300);
          if (cfg.flicker) size *= 1 + 0.09 * Math.sin(g.elapsed * 13 + e.lane * 2.7);
          const squash = squashR[0] + (squashR[1] - squashR[0]) * depth;
          const motion = (cfg.motion || {})[e.type] || 'climb';
          const v = pose(g, e);
          const cycle = motion === 'climb' ? v.phase : g.elapsed * 5 + e.lane * 2;
          const stride = Math.sin(cycle);
          const h = size * squash * (1 + Math.cos(cycle * 2) * (motion === 'flame' ? 0.09 : 0.025));
          const wobble = v.turn + stride * (motion === 'climb' ? 0.045 : 0.08);
          // cuerda desde el abismo hasta el extremo profundo del bicho
          if (cfg.rope) {
            const pr = g.webPoint(g.shape, e.lane, Math.max(0.02, e.t - 0.24));
            const bx = p.x + Math.cos(p.a + Math.PI) * (h / 2);
            const by = p.y + Math.sin(p.a + Math.PI) * (h / 2);
            g.sStroke([pr, { x: bx, y: by }], false, cfg.rope, 1.5);
          }
          // con solid: sombra + sprite opacos sobre el canvas principal
          // (el buffer de escena se compone en aditivo y los sprites
          //  oscuros se vuelven transparentes sobre un fondo claro)
          const solid = cfg.solid ?? motion !== 'flame';
          const s = solid ? g.ctx : g.sctx;
          s.save();
          s.translate(p.x, p.y);
          s.rotate(p.a + Math.PI / 2 + wobble); // cabeza hacia el borde
          s.globalCompositeOperation = 'source-over';
          // sombra de contacto sobre la pared
          s.fillStyle = motion === 'float' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.48)';
          s.beginPath();
          s.ellipse(0, h * 0.08, size * 0.36, h * 0.40, 0, 0, Math.PI * 2);
          s.fill();
          // brillo según profundidad + escorzo
          // (spriteGain compensa la doble pasada aditiva del pipeline;
          //  con solid se dibuja opaco sobre ctx y no hace falta)
          const b = (bright[0] + (bright[1] - bright[0]) * depth) * (solid ? 1 : (cfg.spriteGain ?? 0.6));
          try { s.filter = `brightness(${b.toFixed(2)})`; } catch (err) { /* sin filter */ }
          // Las patas alternan apoyos sin desplazar el centro de colision.
          if (motion === 'climb') {
            const sw = img.naturalWidth, sh = img.naturalHeight;
            const cuts = [0, 0.30, 0.70, 1];
            for (let band = 0; band < 3; band++) {
              const left = cuts[band], width = cuts[band + 1] - left;
              const reach = band === 1 ? -Math.cos(cycle * 2) * h * 0.015 : stride * h * 0.065 * (band === 0 ? 1 : -1);
              s.drawImage(img, sw * left, 0, sw * width, sh,
                (left - 0.5) * size, -h / 2 + reach, size * width + 0.5, h);
            }
          } else {
            s.scale(1 + stride * (motion === 'flap' ? 0.20 : 0.035), 1);
            s.drawImage(img, -size / 2, -h / 2 + stride * h * 0.035, size, h);
          }
          s.restore();
        }
      },

      // chorro de agua (bomberos) u omitir para el disparo por defecto
      drawShots: cfg.shots === 'agua' ? function (g) {
        const c = g.sctx, unit = g.R / 300;
        c.save(); c.lineCap = 'round';
        for (const sh of g.shots) {
          const head = g.webPoint(g.shape, sh.lane, Math.max(0, sh.t));
          const tail = g.webPoint(g.shape, sh.lane, Math.min(1, sh.t + 0.24));
          const points = [];
          for (let i = 0; i <= 8; i++) {
            const f = i / 8, ripple = Math.sin(g.elapsed * 30 + f * 15 + sh.lane) * 2 * unit;
            points.push({ x: tail.x + (head.x - tail.x) * f - Math.sin(head.a) * ripple,
              y: tail.y + (head.y - tail.y) * f + Math.cos(head.a) * ripple });
          }
          g.sStroke(points, false, 'rgba(50,155,240,0.55)', 8 * unit);
          g.sStroke(points, false, '#9cddff', 3.5 * unit);
          g.sStroke(points, false, '#e5faff', 1.2 * unit);
          for (let i = 0; i < 7; i++) {
            const f = (g.elapsed * 3 + i / 7) % 1;
            const spread = Math.sin(i * 14 + sh.lane) * (3 + 8 * f) * unit;
            const x = tail.x + (head.x - tail.x) * f - Math.sin(head.a) * spread;
            const y = tail.y + (head.y - tail.y) * f + Math.cos(head.a) * spread;
            c.fillStyle = 'rgba(185,233,255,0.85)';
            c.beginPath(); c.arc(x, y, (1 + f) * unit, 0, Math.PI * 2); c.fill();
          }
        }
        c.restore();
      } : undefined,
    };
  };
})();
