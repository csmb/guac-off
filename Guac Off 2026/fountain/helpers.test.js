'use strict';
// Node test runner for fountain/helpers.js — run: node "Guac Off 2026/fountain/helpers.test.js"
const H = require('./helpers.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = (typeof actual === 'object')
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
}

// --- clamp ---
eq('clamp inside', H.clamp(5, 0, 10), 5);
eq('clamp low',    H.clamp(-3, 0, 10), 0);
eq('clamp high',   H.clamp(99, 0, 10), 10);

// --- tiltToGravity: x from gamma (roll), y from beta (pitch), clamped to ±1 * STRENGTH ---
eq('tilt upright (beta=90) -> down', H.tiltToGravity(90, 0), { x: 0, y: 1 });
eq('tilt flat -> zero',              H.tiltToGravity(0, 0),  { x: 0, y: 0 });
eq('tilt gamma=30 -> full right',    H.tiltToGravity(0, 30), { x: 1, y: 0 });
eq('tilt gamma=-90 -> full left (clamped)', H.tiltToGravity(0, -90), { x: -1, y: 0 });
eq('tilt beta=15 -> half down',      H.tiltToGravity(15, 0), { x: 0, y: 0.5 });

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
