// Pure helpers for the point-to-party compass hunt.
// Loads in Node (module.exports) and the browser (window.FindHelpers).
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FindHelpers = api;
})(function () {
  'use strict';

  // --- tunable constants (single source of truth) ---
  const WARMTH_WINDOW_DEG = 45;   // diff at which warmth hits 0
  const LOCK_DEG = 12;            // within this many degrees counts as aligned
  const LOCK_HOLD_MS = 500;       // must hold alignment this long to lock
  const NEAR_VENUE_M = 120;       // within this distance, skip the hunt
  const ESCAPE_DELAY_MS = 12000;  // hidden escape hatch fades in after this
  const SMOOTH_FACTOR = 0.8;      // unit-circle low-pass (higher = smoother/slower)

  const R_EARTH_M = 6371000;
  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function bearing(from, to) {
    const f1 = toRad(from.lat), f2 = toRad(to.lat);
    const dL = toRad(to.lng - from.lng);
    const y = Math.sin(dL) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dL);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function haversineMeters(from, to) {
    const f1 = toRad(from.lat), f2 = toRad(to.lat);
    const dF = toRad(to.lat - from.lat), dL = toRad(to.lng - from.lng);
    const a = Math.sin(dF / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dL / 2) ** 2;
    return R_EARTH_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function isNearVenue(meters) { return meters < NEAR_VENUE_M; }

  return {
    bearing, haversineMeters, isNearVenue, clamp, toRad, toDeg,
    constants: { WARMTH_WINDOW_DEG, LOCK_DEG, LOCK_HOLD_MS, NEAR_VENUE_M, ESCAPE_DELAY_MS, SMOOTH_FACTOR },
  };
});
