'use strict';
// Node test runner for waterfall/helpers.js — run: node "Guac Off 2026/waterfall/helpers.test.js"
const H = require('./helpers.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = (typeof actual === 'object')
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
}

// --- K: the physics constant table is present ---
eq('K GRAV', H.K.GRAV, 0.34);
eq('K IMG_W', H.K.IMG_W, 2034);
eq('K TAIL_STREAM', H.K.TAIL_STREAM, 1.7);

// --- timeOfFlight: (-v0 + sqrt(v0^2 + 2*g*drop)) / g ---
eq('timeOfFlight v0=0 g=2 drop=4', H.timeOfFlight(0, 2, 4), 2, 1e-9);
eq('timeOfFlight v0=0 g=10 drop=5', H.timeOfFlight(0, 10, 5), 1, 1e-9);
eq('timeOfFlight v0=2 drop=0', H.timeOfFlight(2, 2, 0), 0, 1e-9);

// --- impactX: x + lean*tFall + 0.5*wind*windCoeff*tFall^2 (jet returns x) ---
const sp = { x: 100, y: 0, splashY: 4, v0: 0, lean: 5, kind: 'fall' };
eq('impactX no wind', H.impactX(sp, 2, 0, 0.018), 110, 1e-9);
eq('impactX with wind', H.impactX(sp, 2, 10, 0.018), 110 + 0.5 * 10 * 0.018 * 4, 1e-9);
eq('impactX jet returns x', H.impactX({ x: 77, kind: 'jet' }, 2, 0, 0.018), 77);

// --- tintStr: rgba string, per-channel clamp to 255 ---
eq('tintStr basic', H.tintStr([232, 244, 255], 0.5, 0), 'rgba(232,244,255,0.5)');
eq('tintStr lighten clamps', H.tintStr([250, 250, 250], 0.3, 14), 'rgba(255,255,255,0.3)');
eq('tintStr no lighten arg', H.tintStr([10, 20, 30], 1), 'rgba(10,20,30,1)');

// --- emitStep: fractional accumulator (smooth emission, no random rounding) ---
const e1 = H.emitStep(0.5, 0.7);
eq('emitStep n', e1.n, 1);
eq('emitStep acc', e1.acc, 0.2, 1e-9);
const e2 = H.emitStep(0, 0.3);
eq('emitStep below-1 n', e2.n, 0);
eq('emitStep below-1 acc', e2.acc, 0.3, 1e-9);
const e3 = H.emitStep(0.9, 2.3);
eq('emitStep multi n', e3.n, 3);
eq('emitStep multi acc', e3.acc, 0.2, 1e-9);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
