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
  const CULL_MARGIN    = 60;     // px beyond the viewport before a droplet is retired
  const POOL_CAPACITY  = 5000;   // absorbed droplets to fill the screen (tune for feel)
  const POOL_ALPHA     = 0.5;    // pool body opacity (deep end of the gradient)
  const DRAIN_TIME     = 0.8;    // seconds to fully drain on tap
  const SURFACE_SMOOTH = 0.06;   // per-frame easing of the surface normal (slosh lag)
  const GRAVITY_EPS    = 1e-3;   // |g| below this = treat the phone as flat

  // --- spout layout: PLACEHOLDER measured from the provided photo.
  // x,y are FRACTIONS [0..1] of the fountain image box; dir is emission angle in
  // radians (canvas convention: +y is down, so PI/2 ≈ straight down, >PI/2 leans
  // left, <PI/2 leans right). REPLACE x/y/dir when the final art + reference land.
  const SPOUTS = [
    { x: 0.235, y: 0.640, dir: 1.83 },
    { x: 0.305, y: 0.625, dir: 1.62 },
    { x: 0.500, y: 0.560, dir: Math.PI / 2 },
    { x: 0.620, y: 0.585, dir: 1.45 },
    { x: 0.775, y: 0.650, dir: Math.PI / 2 },
  ];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Phone tilt -> unit-ish gravity vector. beta=pitch (front/back), gamma=roll (L/R).
  function tiltToGravity(beta, gamma) {
    return {
      x: clamp(gamma / TILT_FULL_DEG, -1, 1) * STRENGTH,
      y: clamp(beta  / TILT_FULL_DEG, -1, 1) * STRENGTH,
    };
  }

  function gravityPx(beta, gamma) {
    const g = tiltToGravity(beta, gamma);
    return { x: g.x * GRAVITY_SCALE, y: g.y * GRAVITY_SCALE };
  }

  function spawnVelocity(dir, spread, speed, rnd) {
    const a = dir + (rnd - 0.5) * spread;
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
  }

  // Advance a droplet one tick (mutates and returns it). dt in seconds.
  // Semi-implicit Euler: gravity into velocity first, then drag (1 - drag*dt),
  // then advance position. The order is intentional — don't swap it.
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

  // True when a droplet should be retired: expired, off-screen, or hit the pool.
  function isDead(p, b) {
    if (p.life <= 0) return true;
    if (p.x < -b.margin || p.x > b.w + b.margin) return true;
    if (p.y < -b.margin || p.y > b.h + b.margin) return true;
    if (p.y >= b.poolY) return true;
    return false;
  }

  // Map a spout's fractional position to absolute screen px within the image box.
  function spoutToScreen(spout, imgBox) {
    return {
      x: imgBox.left + spout.x * imgBox.width,
      y: imgBox.top + spout.y * imgBox.height,
    };
  }

  // Projection value (along dir) of the pool surface. fillFrac 0 = empty (surface at
  // the deepest screen extent), 1 = full (surface past the shallowest extent).
  function surfaceLevel(dir, w, h, fillFrac) {
    const p0 = 0 * dir.x + 0 * dir.y;
    const p1 = w * dir.x + 0 * dir.y;
    const p2 = 0 * dir.x + h * dir.y;
    const p3 = w * dir.x + h * dir.y;
    const lo = Math.min(p0, p1, p2, p3);
    const hi = Math.max(p0, p1, p2, p3);
    return hi - fillFrac * (hi - lo);
  }

  // Unit "down" vector from a gravity vector; falls back to screen-down when flat.
  function gravityDir(g) {
    const m = Math.hypot(g.x, g.y);
    if (m < GRAVITY_EPS) return { x: 0, y: 1 };
    return { x: g.x / m, y: g.y / m };
  }

  return {
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, gravityDir, surfaceLevel, SPOUTS,
    constants: {
      TILT_FULL_DEG, STRENGTH, GRAVITY_SCALE, EMIT_RATE, INIT_SPEED, SPREAD,
      PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, STREAK_ALPHA, LINE_WIDTH, CULL_MARGIN,
      POOL_CAPACITY, POOL_ALPHA, DRAIN_TIME, SURFACE_SMOOTH, GRAVITY_EPS,
    },
  };
});
