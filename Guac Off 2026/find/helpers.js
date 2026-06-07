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
  const WARMTH_WINDOW_DEG = 80;   // diff at which the green glow/tone fades to 0 — wide so "warmer" guides you in from afar
  const LOCK_DEG = 5;             // within this many degrees counts as aligned (tight = precise aim; independent of the glow range)
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

  function angleDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function warmth(diff) {
    return clamp(1 - diff / WARMTH_WINDOW_DEG, 0, 1);
  }

  // W3C DeviceOrientation ZXY rotation matrix (device -> world; world: X=east, Y=north, Z=up).
  function rotationMatrix(alphaDeg, betaDeg, gammaDeg) {
    const z = toRad(alphaDeg), x = toRad(betaDeg), y = toRad(gammaDeg);
    const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z);
    const sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    return [
      [cZ * cY - sZ * sX * sY, -cX * sZ, cZ * sY + cY * sZ * sX],
      [cY * sZ + cZ * sX * sY,  cZ * cX, sZ * sY - cZ * cY * sX],
      [-cX * sY,                sX,      cX * cY],
    ];
  }

  const POINT_AXIS = [0, 0, -1]; // device camera axis (out the back). Top-edge = [0,-1,0].

  // Returns the compass azimuth (deg, clockwise from north) the camera axis points at.
  // NOTE: feed an *absolute*, north-referenced alpha (e.g. iOS: 360 - webkitCompassHeading;
  // Android: deviceorientationabsolute alpha). The math already accounts for alpha's
  // direction, so callers should NOT add their own `360 - heading` correction here.
  function pointingAzimuth(alphaDeg, betaDeg, gammaDeg) {
    const m = rotationMatrix(alphaDeg, betaDeg, gammaDeg);
    const [ax, ay, az] = POINT_AXIS;
    // world vector = m * axis
    const east  = m[0][0] * ax + m[0][1] * ay + m[0][2] * az;
    const north = m[1][0] * ax + m[1][1] * ay + m[1][2] * az;
    return (toDeg(Math.atan2(east, north)) + 360) % 360;
  }

  // --- 3D aim (heading AND elevation, not just compass) ---
  // Full unit vector in the world frame (x=east, y=north, z=up) the camera axis
  // points along. Unlike pointingAzimuth, this keeps the up/down tilt, so you have
  // to physically aim at the target — not just match its compass bearing.
  // Feed an absolute, north-referenced alpha (see pointingAzimuth note).
  function pointingVector(alphaDeg, betaDeg, gammaDeg) {
    const m = rotationMatrix(alphaDeg, betaDeg, gammaDeg);
    const [ax, ay, az] = POINT_AXIS;
    return {
      e: m[0][0] * ax + m[0][1] * ay + m[0][2] * az,
      n: m[1][0] * ax + m[1][1] * ay + m[1][2] * az,
      u: m[2][0] * ax + m[2][1] * ay + m[2][2] * az,
    };
  }

  // Unit vector toward a compass bearing at the horizon (the party is at ground
  // level, so the direction to it is horizontal — elevation 0).
  function bearingVector(bearingDeg) {
    const b = toRad(bearingDeg);
    return { e: Math.sin(b), n: Math.cos(b), u: 0 };
  }

  // Angle (deg) between two 3D vectors. This is the single "how far off your aim is"
  // number — it folds heading error and elevation error into one.
  function angleBetween(a, b) {
    const dot = a.e * b.e + a.n * b.n + a.u * b.u;
    const ma = Math.hypot(a.e, a.n, a.u), mb = Math.hypot(b.e, b.n, b.u);
    if (ma === 0 || mb === 0) return 180;
    return toDeg(Math.acos(clamp(dot / (ma * mb), -1, 1)));
  }

  // Rotate a vector about the vertical (up) axis — used to apply magnetic
  // declination, which shifts azimuth only and leaves elevation untouched.
  function rotateAboutUp(v, deg) {
    const r = toRad(deg), c = Math.cos(r), s = Math.sin(r);
    return { e: v.e * c + v.n * s, n: v.n * c - v.e * s, u: v.u };
  }

  // Low-pass smoothing of a direction: lerp components, renormalize. Smoothing in
  // vector space sidesteps the 0/360 seam entirely (no need for angleState here).
  function smoothVector(state, v, factor) {
    const f = (factor == null) ? SMOOTH_FACTOR : factor;
    const e = f * state.e + (1 - f) * v.e;
    const n = f * state.n + (1 - f) * v.n;
    const u = f * state.u + (1 - f) * v.u;
    const m = Math.hypot(e, n, u) || 1;
    return { e: e / m, n: n / m, u: u / m };
  }

  function angleState(deg) {
    const r = toRad(deg);
    return { sin: Math.sin(r), cos: Math.cos(r), deg: (deg % 360 + 360) % 360 };
  }

  function smoothAngle(state, newDeg, factor) {
    const f = (factor == null) ? SMOOTH_FACTOR : factor;
    const r = toRad(newDeg);
    const sin = f * state.sin + (1 - f) * Math.sin(r);
    const cos = f * state.cos + (1 - f) * Math.cos(r);
    const deg = (toDeg(Math.atan2(sin, cos)) + 360) % 360;
    return { sin, cos, deg };
  }

  const XOR_KEY = 'guacoff';
  function b64encode(s) {
    return (typeof btoa !== 'undefined') ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  }
  function b64decode(s) {
    return (typeof atob !== 'undefined') ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  }
  function xor(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      out += String.fromCharCode(s.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return out;
  }
  function enc(str) { return b64encode(xor(str)); }
  function dec(b64) { return xor(b64decode(b64)); }

  function shouldLock(diff, heldMs) {
    return diff < LOCK_DEG && heldMs >= LOCK_HOLD_MS;
  }

  return {
    bearing, haversineMeters, isNearVenue, clamp, toRad, toDeg,
    angleDiff, warmth,
    rotationMatrix, pointingAzimuth,
    pointingVector, bearingVector, angleBetween, rotateAboutUp, smoothVector,
    angleState, smoothAngle,
    enc, dec, shouldLock,
    constants: { WARMTH_WINDOW_DEG, LOCK_DEG, LOCK_HOLD_MS, NEAR_VENUE_M, ESCAPE_DELAY_MS, SMOOTH_FACTOR },
  };
});
