// Pure helpers for the tilt-to-guac game.
// Exposed on window.TiltHelpers for both index.js and index.test.html.
(function () {
  'use strict';

  const STRENGTH = 1.2;        // gravity magnitude at full tilt
  const TILT_FULL_DEG = 30;    // degrees of tilt that map to full gravity
  const SNAP_RADIUS = 40;      // px from bowl center within which an ingredient can lock
  const SNAP_SPEED = 1.5;      // max px/frame speed allowed for locking

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function tiltToGravity(beta, gamma) {
    const y = clamp(beta / TILT_FULL_DEG, -1, 1) * STRENGTH;
    const x = clamp(gamma / TILT_FULL_DEG, -1, 1) * STRENGTH;
    return { x, y };
  }

  function shouldLock(distance, speed) {
    return distance < SNAP_RADIUS && speed < SNAP_SPEED;
  }

  function allLocked(ingredients) {
    return ingredients.every(function (i) { return i.locked === true; });
  }

  // n slots in a regular polygon centered on the bowl, at 60% of the bowl radius.
  function slotPositions(center, bowlRadius, n) {
    const r = bowlRadius * 0.6;
    const out = [];
    // Start angle = -π/2 puts the first slot at the top.
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI / n);
      out.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    return out;
  }

  window.TiltHelpers = {
    tiltToGravity,
    shouldLock,
    allLocked,
    slotPositions,
    // also expose constants so index.js can use the same source of truth
    constants: { STRENGTH, TILT_FULL_DEG, SNAP_RADIUS, SNAP_SPEED }
  };
})();
