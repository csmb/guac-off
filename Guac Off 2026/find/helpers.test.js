'use strict';
// Node test runner for find/helpers.js — run: node "Guac Off 2026/find/helpers.test.js"
const H = require('./helpers.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = (typeof actual === 'object')
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
}

// --- bearing: great-circle initial bearing, degrees [0,360) ---
eq('bearing due north', H.bearing({lat:0,lng:0}, {lat:1,lng:0}), 0, 0.001);
eq('bearing due east',  H.bearing({lat:0,lng:0}, {lat:0,lng:1}), 90, 0.001);
eq('bearing due west',  H.bearing({lat:0,lng:0}, {lat:0,lng:-1}), 270, 0.001);
eq('bearing due south', H.bearing({lat:1,lng:0}, {lat:0,lng:0}), 180, 0.001);

// --- haversineMeters ---
eq('haversine same point', H.haversineMeters({lat:0,lng:0}, {lat:0,lng:0}), 0, 0.001);
eq('haversine 1deg lng @equator ~111195m', H.haversineMeters({lat:0,lng:0}, {lat:0,lng:1}), 111195, 60);

// --- isNearVenue (constant NEAR_VENUE_M = 120) ---
eq('isNearVenue 50m true', H.isNearVenue(50), true);
eq('isNearVenue 200m false', H.isNearVenue(200), false);

// --- pointingAzimuth: camera axis (device -Z). Hand-verified cases. ---
// Phone tilted up 90deg (held upright, aiming); alpha rotates the aim around.
eq('aim alpha=0,beta=90 -> north(0)',   H.pointingAzimuth(0,   90, 0), 0,   0.01);
eq('aim alpha=90,beta=90 -> west(270)', H.pointingAzimuth(90,  90, 0), 270, 0.01);
eq('aim alpha=180,beta=90 -> south(180)', H.pointingAzimuth(180, 90, 0), 180, 0.01);
eq('aim alpha=270,beta=90 -> east(90)', H.pointingAzimuth(270, 90, 0), 90,  0.01);
// Tilting forward (beta=60) at alpha=0 still aims north.
eq('aim alpha=0,beta=60 -> north(0)',   H.pointingAzimuth(0,   60, 0), 0,   0.01);

// --- 3D aim: pointingVector / bearingVector / angleBetween / rotateAboutUp ---
// Held bolt upright (beta=90) aiming north: level vector straight at the horizon.
const vUp = H.pointingVector(0, 90, 0);
eq('pointingVector(0,90,0).u ~ 0 (level)', vUp.u, 0, 1e-6);
eq('pointingVector(0,90,0) aims due north', H.angleBetween(vUp, H.bearingVector(0)), 0, 0.01);
// Correct heading but phone tilted 20deg off level -> 20deg of aim error (compass alone wouldn't notice).
eq('pitch 20deg off -> 20deg 3D error', H.angleBetween(H.pointingVector(0, 70, 0), H.bearingVector(0)), 20, 0.1);
// Heading 90deg off but level -> 90deg error.
eq('heading 90deg off + level -> 90', H.angleBetween(H.pointingVector(90, 90, 0), H.bearingVector(0)), 90, 0.01);
// bearingVector basics (horizon-level unit vectors).
eq('bearingVector(0).n ~ 1 (north)', H.bearingVector(0).n, 1, 1e-6);
eq('bearingVector(90).e ~ 1 (east)', H.bearingVector(90).e, 1, 1e-6);
// angleBetween orthogonals.
eq('angleBetween north vs east = 90', H.angleBetween({e:0,n:1,u:0}, {e:1,n:0,u:0}), 90, 1e-6);
eq('angleBetween north vs up = 90', H.angleBetween({e:0,n:1,u:0}, {e:0,n:0,u:1}), 90, 1e-6);
// rotateAboutUp shifts azimuth, leaves elevation: north + 90 -> east, up unchanged.
const rot = H.rotateAboutUp({e:0, n:1, u:0}, 90);
eq('rotateAboutUp north+90 -> east (e~1)', rot.e, 1, 1e-6);
eq('rotateAboutUp keeps up component', rot.u, 0, 1e-6);
// smoothVector converges to a steady direction.
let sv = {e:1, n:0, u:0};
for (let i = 0; i < 50; i++) sv = H.smoothVector(sv, {e:0, n:1, u:0}, 0.8);
eq('smoothVector converges to north (n~1)', sv.n, 1, 0.01);

// --- enc/dec round-trip (light obfuscation, not crypto) ---
eq('dec(enc) round-trips', H.dec(H.enc('Dolores Park, SF')), 'Dolores Park, SF');
eq('enc output is not plaintext', H.enc('Dolores Park, SF').includes('Dolores'), false);

// --- shouldLock: aligned (within LOCK_DEG=5) AND held long enough ---
eq('shouldLock aligned+held -> true', H.shouldLock(3, 600), true);
eq('shouldLock aligned+brief -> false', H.shouldLock(3, 200), false);
eq('shouldLock just-outside-cone+held -> false', H.shouldLock(8, 600), false);
eq('shouldLock misaligned+held -> false', H.shouldLock(20, 600), false);

// --- smoothing across the 0/360 seam ---
// Average of 358 and 2 must be ~0, never ~180.
const st = H.angleState(358);
const sm = H.smoothAngle(st, 2, 0.5);
eq('smoothAngle 358->2 ~ 0 (not 180)', ((sm.deg + 360) % 360), 0, 0.001);
// Smoothing toward a steady reading converges to it.
let s2 = H.angleState(0);
for (let i = 0; i < 50; i++) s2 = H.smoothAngle(s2, 90, 0.8);
eq('smoothAngle converges to steady 90', s2.deg, 90, 0.5);

// --- angleDiff: smallest absolute difference [0,180] ---
eq('angleDiff 350,10 -> 20', H.angleDiff(350, 10), 20, 0.001);
eq('angleDiff 10,350 -> 20', H.angleDiff(10, 350), 20, 0.001);
eq('angleDiff 12,0 -> 12', H.angleDiff(12, 0), 12, 0.001);
eq('angleDiff 0,180 -> 180', H.angleDiff(0, 180), 180, 0.001);

// --- warmth: 1 at aligned, 0 by WARMTH_WINDOW_DEG (80) — wide guiding range ---
eq('warmth 0 -> 1', H.warmth(0), 1, 0.001);
eq('warmth 80 -> 0 (window edge)', H.warmth(80), 0, 0.001);
eq('warmth 120 -> 0 (clamped)', H.warmth(120), 0, 0.001);
eq('warmth 40 -> 0.5', H.warmth(40), 0.5, 0.001);
// glow is visible well before the 5deg lock: a 20deg-off aim still reads "warm".
eq('warmth 20 -> 0.75 (green visible, but wont lock)', H.warmth(20), 0.75, 0.001);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
