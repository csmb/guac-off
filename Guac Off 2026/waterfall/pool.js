// Pure pool math for the waterfall tilt-slosh. Geometry ported from /fountain/;
// slosh/format helpers are new. UMD: Node (module.exports) + browser (window.WaterfallPool).
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.WaterfallPool = api;
})(function () {
  'use strict';

  // Feel dials — tune live on a phone.
  const K = {
    TILT_FULL_DEG: 16,    // degrees of tilt mapped to full gravity (smaller = far more aggressive)
    GRAVITY_SCALE: 1600,  // px/s^2 at full tilt (splash droplets)
    RESTING_FILL: 0.9,    // pool fill once the toy wakes (covers most of the section; a little slosh headroom)
    SLOSH_K: 90,          // surface spring stiffness (1/s^2)
    SLOSH_DAMP: 9,        // surface spring damping (1/s)
    SPLASH_SPEED: 1.6,    // slosh-speed threshold to throw spray
    SPLASH_CAP: 240,      // max live splash droplets
    SPLASH_DRAG: 0.12,    // per-second droplet damping
    SPLASH_LIFE: 1.4,     // seconds
    WIND_GAIN: 4.5,       // gravity.x -> engine wind (streams lean hard with tilt)
    WIND_CAP: 5.0,
    GRAVITY_EPS: 1e-3,
    TINT: '150, 205, 235',
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // phone tilt -> unit-ish gravity (gamma=L/R roll -> x, beta=F/B pitch -> y)
  function tiltToGravity(beta, gamma) {
    return { x: clamp(gamma / K.TILT_FULL_DEG, -1, 1), y: clamp(beta / K.TILT_FULL_DEG, -1, 1) };
  }

  // unit "down" vector; flat -> {0,1}
  function gravityDir(g) {
    const m = Math.hypot(g.x, g.y);
    if (m < K.GRAVITY_EPS) return { x: 0, y: 1 };
    return { x: g.x / m, y: g.y / m };
  }

  // projection of the pool surface for fill fraction (0 empty .. 1 full) in a w*h box
  function surfaceLevel(dir, w, h, fillFrac) {
    const p0 = 0, p1 = w * dir.x, p2 = h * dir.y, p3 = w * dir.x + h * dir.y;
    const lo = Math.min(p0, p1, p2, p3), hi = Math.max(p0, p1, p2, p3);
    return hi - fillFrac * (hi - lo);
  }

  // Sutherland-Hodgman clip of the w*h rect by { p : p.dir >= level } -> submerged polygon
  function clipRectBelow(w, h, dir, level) {
    const poly = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      const pa = (A.x * dir.x + A.y * dir.y) - level;
      const pb = (B.x * dir.x + B.y * dir.y) - level;
      const inA = pa >= 0, inB = pb >= 0;
      if (inA) out.push(A);
      if (inA !== inB) { const t = pa / (pa - pb); out.push({ x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) }); }
    }
    return out;
  }

  // splash droplet step (semi-implicit Euler + drag); gx,gy in px/s^2
  function integrate(p, gx, gy, dt, drag) {
    p.vx += gx * dt; p.vy += gy * dt;
    const d = 1 - drag * dt; p.vx *= d; p.vy *= d;
    p.px = p.x; p.py = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    return p;
  }

  // spring-damped surface normal with momentum (slosh). state = {dir:{x,y}, vel:{x,y}}.
  // Underdamping (small damp relative to k) => visible overshoot before it settles.
  function sloshStep(state, targetDir, dt, k, damp) {
    const ax = (targetDir.x - state.dir.x) * k - state.vel.x * damp;
    const ay = (targetDir.y - state.dir.y) * k - state.vel.y * damp;
    const vx = state.vel.x + ax * dt;
    const vy = state.vel.y + ay * dt;
    const dx = state.dir.x + vx * dt;
    const dy = state.dir.y + vy * dt;
    const m = Math.hypot(dx, dy) || 1;
    return { dir: { x: dx / m, y: dy / m }, vel: { x: vx, y: vy } };
  }

  // how many splash droplets for a slosh speed (0 below threshold), capped per call
  function splashCount(speed, threshold, cap) {
    if (speed <= threshold) return 0;
    return Math.min(cap, Math.round((speed - threshold) * 8));
  }

  // polygon vertices (px) -> CSS clip-path polygon() string; <3 points => hidden
  function pointsToClipPath(poly) {
    if (!poly || poly.length < 3) return 'polygon(0px 0px, 0px 0px, 0px 0px)';
    const pts = poly.map(function (p) {
      return (Math.round(p.x * 100) / 100) + 'px ' + (Math.round(p.y * 100) / 100) + 'px';
    });
    return 'polygon(' + pts.join(', ') + ')';
  }

  return { K, clamp, tiltToGravity, gravityDir, surfaceLevel, clipRectBelow, integrate, sloshStep, splashCount, pointsToClipPath };
});
