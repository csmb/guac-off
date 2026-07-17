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
    STREAM_FULL_DEG: 12,  // gamma° for near-full stream lean (smaller = more aggressive)
    WIND_MAG: 8.0,        // stream lean magnitude at full tilt
    WIND_CAP: 9.0,        // hard cap on engine wind
    POOL_FULL_DEG: 30,    // gamma° to approach the pool's gentle max tilt (larger = less sensitive)
    POOL_MAX_SLOPE: 0.18, // tan of the pool surface's gentle max tilt (~10°)
    RESTING_FILL: 0.98,   // idle waterline right at the top of the event section (slosh can reach the seam)
    SLOSH_K: 50,          // soft surface spring — gentle slosh
    SLOSH_DAMP: 7,        // slightly underdamped — fluid, never a hard stop
    SURGE_GAIN: 0.30,     // slosh speed -> how high the water crashes up past the seam
    SURGE_MAX: 0.45,      // max crash-up (restFill + this can reach the page top)
    GRAVITY_SCALE: 1400,  // px/s^2 for splash droplets
    SPLASH_SPEED: 0.9,    // slosh-speed threshold to throw a little spray
    SPLASH_CAP: 200,      // max live splash droplets
    SPLASH_DRAG: 0.12,    // per-second droplet damping
    SPLASH_LIFE: 1.3,     // seconds
    WAVE_AMP: 2.6,        // primary ripple amplitude (px)
    WAVE_AMP2: 1.4,       // secondary ripple amplitude (px)
    WAVE_FREQ: 2.4,       // primary ripples across the surface
    WAVE_FREQ2: 4.3,      // secondary ripple count
    WAVE_SPEED: 1.7,      // ripple drift speed
    WAVE_EDGE: 0.5,       // base-ripple amplitude at the walls (1 = full) — ripples taper toward the edges
    WAVE_MID: 1.8,        // extra chop concentrated in the middle of the pool (px)
    WAVE_MID_FREQ: 3.3,   // frequency of the mid-pool chop
    TINT: '150, 205, 235',
    FILL_LERP: 3,         // tilted-mode fill approach rate (1/s toward the rest level)
    STAGE_MAX_FRAC: 0.6,  // the locked stage may take at most this fraction of the visible height
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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

  // --- view/layout helpers ---

  // Device-frame (beta,gamma) -> screen-relative left/right tilt (deg) for a rotated screen.
  // Anchored to window.orientation semantics: 0 portrait, 90 rotated CCW (iOS home-right),
  // 180 inverted, 270 (or -90) rotated CW. Unknown angles fall back to portrait.
  function screenGamma(beta, gamma, angle) {
    const a = (((angle || 0) % 360) + 360) % 360;
    if (a === 90) return beta;
    if (a === 180) return -gamma;
    if (a === 270) return -beta;
    return gamma;
  }

  // Tilted-mode fill lerp. Must be fed the LIVE rest level every frame so viewport
  // changes (URL bar, rotation) can't strand the waterline at a stale target.
  function fillToward(fill, target, dt) {
    return fill + (target - fill) * Math.min(1, dt * K.FILL_LERP);
  }

  // Applied stage height: honor the per-orientation px lock, but never starve the
  // details section when the visible height shrinks (split view, desktop resize).
  function clampStage(lockH, h) {
    return Math.min(lockH, Math.round(h * K.STAGE_MAX_FRAC));
  }

  // A pinch-zoomed visualViewport reports zoomed dimensions — not layout input.
  function isZoomed(scale) {
    return typeof scale === 'number' && scale > 1.01;
  }

  // Fountain frame width from the LOCKED stage height (keeps the art's aspect), viewport-capped.
  function frameWidth(w, stageH, aspect) {
    return Math.round(Math.min(w, stageH * aspect));
  }

  return { K, clamp, surfaceLevel, clipRectBelow, integrate, sloshStep, splashCount, pointsToClipPath,
           screenGamma, fillToward, clampStage, isZoomed, frameWidth };
});
