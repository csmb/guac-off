'use strict';
// Node test runner for waterfall/flood.js — run: node "Guac Off 2026/waterfall/flood.test.js"
const F = require('./flood.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = tol ? Math.abs(actual - expected) <= tol : actual === expected;
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${expected} got ${actual}`); }
}

// easeOutCubic: 0→0, 1→1, 0.5→0.875 (1 - 0.5^3)
eq('ease 0', F.easeOutCubic(0), 0, 1e-9);
eq('ease 1', F.easeOutCubic(1), 1, 1e-9);
eq('ease 0.5', F.easeOutCubic(0.5), 0.875, 1e-9);

// floodLevel: endpoints, eased midpoint, clamping, degenerate duration
eq('flood start', F.floodLevel(0, 5000), 0, 1e-9);
eq('flood end', F.floodLevel(5000, 5000), 1, 1e-9);
eq('flood mid eased', F.floodLevel(2500, 5000), 0.875, 1e-9);
eq('flood past-end clamps', F.floodLevel(6000, 5000), 1, 1e-9);
eq('flood negative clamps', F.floodLevel(-100, 5000), 0, 1e-9);
eq('flood zero duration floods instantly', F.floodLevel(100, 0), 1, 1e-9);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
