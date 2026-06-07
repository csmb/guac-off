// Pure helpers for the tilt-to-pour fountain.
// Loads in Node (module.exports) and the browser (window.FountainHelpers).
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FountainHelpers = api;
})(function () {
  'use strict';

  // --- tunable constants (single source of truth — the "dials") ---
  const TILT_FULL_DEG  = 30;     // degrees of tilt mapped to full gravity
  const STRENGTH       = 1.0;    // unitless gravity magnitude at full tilt
  const GRAVITY_SCALE  = 1600;   // px/s^2 at full tilt
  const EMIT_RATE      = 70;     // droplets/sec per spout
  const INIT_SPEED     = 180;    // px/s initial droplet speed out of a spout
  const SPREAD         = 0.45;   // radians of angular jitter per droplet
  const PARTICLE_LIFE  = 5.0;    // seconds (safety cap; most exit sooner)
  const DRAG           = 0.12;   // per-second velocity damping
  const MAX_PARTICLES  = 800;    // hard cap on live droplets
  const POOL_FRAC      = 0.92;   // pool line at this fraction of viewport height
  const WATER_RGB      = '175, 215, 255';  // light blue
  const STREAK_ALPHA   = 0.5;    // per-streak opacity
  const LINE_WIDTH     = 2;      // streak width (px)

  // --- spout layout: PLACEHOLDER measured from the provided photo.
  // x,y are FRACTIONS [0..1] of the fountain image box; dir is emission angle in
  // radians (canvas convention: +y is down, so PI/2 ≈ straight down, >PI/2 leans
  // left, <PI/2 leans right). REPLACE x/y/dir when the final art + reference land.
  const SPOUTS = [
    { x: 0.235, y: 0.640, dir: 1.83 },
    { x: 0.305, y: 0.625, dir: 1.62 },
    { x: 0.500, y: 0.560, dir: 1.5708 },
    { x: 0.620, y: 0.585, dir: 1.45 },
    { x: 0.775, y: 0.650, dir: 1.5708 },
  ];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Phone tilt -> unit-ish gravity vector. beta=pitch (front/back), gamma=roll (L/R).
  function tiltToGravity(beta, gamma) {
    return {
      x: clamp(gamma / TILT_FULL_DEG, -1, 1) * STRENGTH,
      y: clamp(beta  / TILT_FULL_DEG, -1, 1) * STRENGTH,
    };
  }

  // True when a droplet should be retired: expired, off-screen, or hit the pool.
  function isDead(p, b) {
    if (p.life <= 0) return true;
    if (p.x < -b.margin || p.x > b.w + b.margin) return true;
    if (p.y < -b.margin || p.y > b.h + b.margin) return true;
    if (p.y >= b.poolY) return true;
    return false;
  }

  // Advance a droplet one tick (mutates and returns it). dt in seconds.
  function integrate(p, gx, gy, dt, drag) {
    p.vx += gx * dt;
    p.vy += gy * dt;
    const d = 1 - drag * dt;
    p.vx *= d;
    p.vy *= d;
    p.px = p.x;
    p.py = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    return p;
  }

  function spawnVelocity(dir, spread, speed, rnd) {
    const a = dir + (rnd - 0.5) * spread;
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
  }

  function gravityPx(beta, gamma) {
    const g = tiltToGravity(beta, gamma);
    return { x: g.x * GRAVITY_SCALE, y: g.y * GRAVITY_SCALE };
  }

  return {
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, SPOUTS,
    constants: {
      TILT_FULL_DEG, STRENGTH, GRAVITY_SCALE, EMIT_RATE, INIT_SPEED, SPREAD,
      PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, STREAK_ALPHA, LINE_WIDTH,
    },
  };
});
