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
    function updateScorch(g) {
      const dt = scorchLast < 0 ? 0 : Math.min(0.1, Math.max(0, g.elapsed - scorchLast));
      scorchLast = g.elapsed;
      const marked = e => !SC.types || SC.types.indexOf(e.type) >= 0;
      for (const e of g.enemies) {
        if (!marked(e)) continue;
        if (e._scorchT === undefined || Math.abs(e.t - e._scorchT) > 0.035) {
          e._scorchT = e.t;
          scorches.push({ lane: e.lane, t: e.t, age: 0, big: false });
        }
      }
      for (const e of scorchPrev) {
        // desaparecio sin llegar a la cornisa: lo matamos -> marca grande
        if (marked(e) && g.enemies.indexOf(e) < 0 && e.t < 0.92) {
          scorches.push({ lane: e.lane, t: e.t, age: 0, big: true });
        }
      }
      scorchPrev = new Set(g.enemies);
      for (const m of scorches) m.age += dt;
      scorches = scorches.filter(m => m.age < SC.life);
      if (scorches.length > 400) scorches.splice(0, scorches.length - 400);
    }
    function drawScorch(g) {
      const c = g.ctx;
      if (SC.glow) c.globalCompositeOperation = 'lighter';
      for (const m of scorches) {
        const p = g.webPoint(g.shape, m.lane, m.t);
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
      if (SC.glow) c.globalCompositeOperation = 'source-over';
    }

    const bright = cfg.bright || [0.4, 1.0];
    const squashR = cfg.squash || [0.38, 1.0];
    const playerSize = cfg.playerSize || 96;

    return {
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
        // bandas de roca con jitter: estratos irregulares, no geometricos
        for (let bi = 0; bi < 6; bi++) {
          const t = 0.15 + bi * 0.15;
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
          const r = d.r * (0.4 + d.t * 1.8) * (g.R / 300);
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
        c.lineWidth = 9;
        c.stroke();
        shapePath(c, g, 1);
        c.strokeStyle = cfg.rimLight;
        c.lineWidth = 2;
        c.stroke();
        // sombra interior bajo la cornisa (oclusion) + vineta de camara
        shapePath(c, g, 0.93);
        c.strokeStyle = 'rgba(0,0,0,0.30)';
        c.lineWidth = g.R * 0.09;
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
        for (const t of [0.2, 0.4, 0.6, 0.8]) {
          const pts = [];
          for (let i = 0; i < g.LANES; i++) pts.push(pt(i, t));
          g.sStroke(pts, true, `hsla(${hue}, 70%, 45%, ${0.10 * breathe * alpha})`, 1.2);
        }
        const rim = [];
        for (let i = 0; i < g.LANES; i++) rim.push(pt(i, 1));
        g.sctx.save();
        g.sctx.setLineDash([14, 18]);
        g.sctx.lineDashOffset = -g.elapsed * 90;
        g.sStroke(rim, true, `hsla(${hue}, 90%, 60%, ${0.55 * breathe * alpha})`, 2.5, true);
        g.sctx.restore();
        if (g.webPulse >= 0 && g.webPulse <= 1) {
          const pts = [];
          for (let i = 0; i < g.LANES; i++) pts.push(pt(i, g.webPulse));
          g.sStroke(pts, true, `hsla(${hue}, 80%, 70%, ${(1 - g.webPulse) * 0.5 * alpha})`, 2.5, true);
        }
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
        if (g.muzzle > 0) {
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
        for (const e of g.enemies) {
          const p = g.webPoint(g.shape, e.lane, e.t);
          const img = sprite(e.type);
          if (!img) { ph.drawEnemy(g, e); continue; }
          let size = (44 + 120 * e.t) * (g.R / 300);
          if (cfg.flicker) size *= 1 + 0.09 * Math.sin(g.elapsed * 13 + e.lane * 2.7);
          const squash = squashR[0] + (squashR[1] - squashR[0]) * e.t;
          const h = size * squash;
          const wobble = Math.sin(e.rot * 1.5) * 0.12;
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
          const s = cfg.solid ? g.ctx : g.sctx;
          s.save();
          s.translate(p.x, p.y);
          s.rotate(p.a + Math.PI / 2 + wobble); // cabeza hacia el borde
          s.globalCompositeOperation = 'source-over';
          // sombra de contacto sobre la pared
          s.fillStyle = 'rgba(0,0,0,0.45)';
          s.beginPath();
          s.ellipse(0, size * 0.10, size * 0.40, h * 0.42, 0, 0, Math.PI * 2);
          s.fill();
          // brillo según profundidad + escorzo
          // (spriteGain compensa la doble pasada aditiva del pipeline;
          //  con solid se dibuja opaco sobre ctx y no hace falta)
          const b = (bright[0] + (bright[1] - bright[0]) * e.t) * (cfg.solid ? 1 : (cfg.spriteGain ?? 0.6));
          try { s.filter = `brightness(${b.toFixed(2)})`; } catch (err) { /* sin filter */ }
          s.drawImage(img, -size / 2, -size / 2, size, h);
          s.restore();
        }
      },

      // chorro de agua (bomberos) u omitir para el disparo por defecto
      drawShots: cfg.shots === 'agua' ? function (g) {
        for (const sh of g.shots) {
          const p1 = g.webPoint(g.shape, sh.lane, Math.max(0, sh.t - 0.09));
          const p2 = g.webPoint(g.shape, sh.lane, sh.t);
          g.sStroke([p1, p2], false, '#bfe6ff', 5, true);
          g.sStroke([p1, p2], false, '#ffffff', 1.8);
          g.sctx.fillStyle = '#eaf7ff';
          g.sctx.beginPath();
          g.sctx.arc(p2.x, p2.y, 3.5 * (g.R / 300) + 1, 0, Math.PI * 2);
          g.sctx.fill();
        }
      } : undefined,
    };
  };
})();
