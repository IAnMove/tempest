/* ============================================================
   TEMA: PLACEHOLDER — plantilla base para nuevos temas
   ------------------------------------------------------------
   Copia este archivo, cambia id/name y adapta la paleta y los
   hooks. Reglas:

   · El tema se autorregistra en window.TEMPEST_THEMES y game.js
     lo recoge al cargar (los themes/*.js van ANTES de game.js
     en index.html).
   · Todos los hooks son OPCIONALES: si un hook no existe, se
     usa el dibujo vectorial por defecto con tu paleta.
     Hooks: drawPlayer, drawEnemies, drawSpikes, drawShots,
     drawBackground(g) (pasada opaca de fondo) y drawWeb(g, zoom,
     alpha) (el tubo; el tema marino lo usa para la sima).
   · Los hooks reciben `g` (ver hookCtx() en game.js):
       g.webPoint(shape, lane, t) -> {x, y, a}  punto del tubo
         (lane puede ser fraccionario; t: 0 = fondo, 1 = borde;
          `a` es el ángulo del punto respecto al centro)
       g.sctx        contexto 2D de la escena (modo aditivo)
       g.sStroke(pts, close, color, width, glow)
       g.player {lane, invuln}   g.enemies  g.shots  g.spikes
       g.shape  g.R  g.elapsed  g.levelHue()  g.LANES
   · Convención de orientación: para que un dibujo hecho "hacia
     arriba" apunte al CENTRO del tubo, usa rotate(p.a - PI/2);
     para que apunte al BORDE (hacia fuera), rotate(p.a + PI/2).
   · game.js ya se encarga del parpadeo de invulnerabilidad y de
     no dibujar al jugador durante la muerte.

   Este tema: somos una TORRETA en el borde y por el tubo suben
   CRIATURAS geométricas (crawler, bloque, alfiletero).
   ============================================================ */
(function () {
  'use strict';

  window.TEMPEST_THEMES = window.TEMPEST_THEMES || [];

  const placeholder = {
    id: 'placeholder',
    name: 'BASE',
    desc: 'torreta + criaturas geométricas · plantilla para nuevos temas',

    /* ---- paleta (úsala también en partículas y explosiones) ---- */
    playerColor: '#ffcc55',      // torreta
    engineColor: '#ff9944',      // estela al moverse
    shotColor: '#aaddff',        // proyectiles
    spikeColor: '#66ff88',       // pinchos
    spikeDangerColor: '#ff4444', // pinchos a punto de llegar al borde
    zapColor: '#ff66ff',         // superzapper
    enemies: {
      flipper: { color: '#ff8844', score: 150 }, // rápido, salta de carril
      tanker:  { color: '#66ccff', score: 100 }, // lento, se parte en dos
      spiker:  { color: '#99ff55', score: 50  }, // deja pinchos en su carril
    },

    /* ---- torreta del jugador (borde del tubo) ---- */
    drawPlayer(g) {
      const s = g.sctx;
      const p = g.webPoint(g.shape, g.player.lane, 1.0);
      const u = 16 * (g.R / 300); // unidad de tamaño
      s.save();
      s.translate(p.x, p.y);
      s.rotate(p.a - Math.PI / 2); // "arriba" local = hacia el centro
      s.strokeStyle = this.playerColor;
      s.lineWidth = 2.4;
      s.shadowColor = this.playerColor;
      s.shadowBlur = 7;
      // base: anillo doble
      s.beginPath(); s.arc(0, 0, u * 1.05, 0, Math.PI * 2); s.stroke();
      s.beginPath(); s.arc(0, 0, u * 0.62, 0, Math.PI * 2); s.stroke();
      // cañón hacia el centro
      s.strokeRect(-u * 0.26, -u * 1.9, u * 0.52, u * 1.6);
      // depósitos laterales
      s.beginPath(); s.arc(-u * 0.95, u * 0.5, u * 0.3, 0, Math.PI * 2); s.stroke();
      s.beginPath(); s.arc(u * 0.95, u * 0.5, u * 0.3, 0, Math.PI * 2); s.stroke();
      s.restore();
      // fogonazo en la boca del cañón
      if (g.muzzle > 0) {
        const tx = p.x + Math.cos(p.a + Math.PI) * u * 1.9;
        const ty = p.y + Math.sin(p.a + Math.PI) * u * 1.9;
        s.fillStyle = `rgba(255,255,255,${g.muzzle / 0.06})`;
        s.beginPath();
        s.arc(tx, ty, 10 * (g.R / 300) * (g.muzzle / 0.06) + 2, 0, Math.PI * 2);
        s.fill();
      }
    },

    /* ---- criaturas ---- */
    drawEnemies(g) {
      for (const e of g.enemies) this.drawEnemy(g, e);
    },

    // también expuesto para que otros temas lo usen de fallback
    drawEnemy(g, e) {
      const s = g.sctx;
      const p = g.webPoint(g.shape, e.lane, e.t);
      const u = (5 + 15 * e.t) * (g.R / 300); // crece al acercarse
      const color = this.enemies[e.type].color;
      s.save();
      s.translate(p.x, p.y);
      s.rotate(e.rot);
      s.strokeStyle = color;
      s.lineWidth = 2.2;
      s.shadowColor = color;
      s.shadowBlur = 6;
      s.beginPath();
      if (e.type === 'flipper') {
        // crawler: cuerpo redondo con 6 patas y 2 pinzas
        s.arc(0, 0, u * 0.55, 0, Math.PI * 2);
        s.moveTo(u * 0.55, 0); s.lineTo(u, 0);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          s.moveTo(Math.cos(a) * u * 0.55, Math.sin(a) * u * 0.55);
          s.lineTo(Math.cos(a) * u, Math.sin(a) * u);
        }
        s.moveTo(-u * 0.2, -u * 0.8); s.arc(0, -u * 0.8, u * 0.2, Math.PI, 0);
        s.moveTo(-u * 0.2, u * 0.8); s.arc(0, u * 0.8, u * 0.2, Math.PI, 0, true);
      } else if (e.type === 'tanker') {
        // bloque: hexágono blindado con núcleo
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const x = Math.cos(a) * u * 1.2, yy = Math.sin(a) * u * 1.2;
          if (k === 0) s.moveTo(x, yy); else s.lineTo(x, yy);
        }
        s.closePath();
        s.moveTo(u * 0.4, 0);
        s.arc(0, 0, u * 0.4, 0, Math.PI * 2);
      } else {
        // alfiletero: estrella de 8 puntas con núcleo
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const rr = k % 2 === 0 ? u : u * 0.4;
          const x = Math.cos(a) * rr, yy = Math.sin(a) * rr;
          if (k === 0) s.moveTo(x, yy); else s.lineTo(x, yy);
        }
        s.closePath();
        s.moveTo(u * 0.18, 0);
        s.arc(0, 0, u * 0.18, 0, Math.PI * 2);
      }
      s.stroke();
      s.restore();
    },

    /* Sin drawSpikes / drawShots / drawBackground:
       se usa el dibujo por defecto con esta paleta. */
  };

  window.TEMPEST_THEMES.push(placeholder);
})();
