// Pure helpers + physics constants for the waterfall engine.
// Loads in Node (module.exports) and the browser (window.WaterfallHelpers).
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.WaterfallHelpers = api;
})(function () {
  'use strict';

  // Physics constants ("the real tokens of this piece") — single source of truth.
  const K = {
    IMG_W: 2034, IMG_H: 1136,
    GRAV: 0.34,
    MAX_STREAM: 9000, MAX_MIST: 2600, MAX_SPLASH: 2600,
    WIDTH_CAP: 1900, DPR_CAP: 2,
    WIND_COEFF: 0.018,
    FALL_EMIT: 0.9, JET_EMIT: 1.05,
    TAIL_STREAM: 1.7, TAIL_SPLASH: 1.5,
    GUST_R1: 22000, GUST_R2: 30000,
    FOAM_SQUASH: 0.4, RIPPLE_SQUASH: 0.32,
  };

  // Projectile time-of-flight for initial down-speed v0 falling `drop` px under `grav`.
  function timeOfFlight(v0, grav, drop) {
    return (-v0 + Math.sqrt(v0 * v0 + 2 * grav * drop)) / grav;
  }

  // Where a fall spout's water lands in x (same physics as the droplets — not a lerp).
  function impactX(spout, grav, wind, windCoeff) {
    if (spout.kind === 'jet') return spout.x;
    const drop = spout.splashY - spout.y;
    const tFall = timeOfFlight(spout.v0, grav, drop);
    return spout.x + spout.lean * tFall + 0.5 * wind * windCoeff * tFall * tFall;
  }

  // rgba() string from a base tint, per-channel lightened and clamped to 255.
  function tintStr(tint, a, lighten) {
    const L = lighten || 0;
    const r = Math.min(255, tint[0] + L) | 0;
    const g = Math.min(255, tint[1] + L) | 0;
    const b = Math.min(255, tint[2] + L) | 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // Smooth fractional emission: carry the remainder so density is stutter-free at any speed.
  function emitStep(acc, rate) {
    const total = acc + rate;
    const n = Math.floor(total);
    return { n: n, acc: total - n };
  }

  return { K, timeOfFlight, impactX, tintStr, emitStep };
});
