'use strict';
// Node test runner for waterfall/pool.js — run: node "Guac Off 2026/waterfall/pool.test.js"
const P = require('./pool.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = (typeof actual === 'object')
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
}

// clamp
eq('clamp hi', P.clamp(5, 0, 1), 1);
eq('clamp lo', P.clamp(-1, 0, 1), 0);
eq('clamp mid', P.clamp(0.5, 0, 1), 0.5);

// tiltToGravity: x=gamma/TILT_FULL_DEG clamped, y=beta/TILT_FULL_DEG clamped
eq('tilt flat', P.tiltToGravity(0, 0), { x: 0, y: 0 });
eq('tilt right', P.tiltToGravity(0, 60), { x: 1, y: 0 });
eq('tilt back', P.tiltToGravity(-60, 0), { x: 0, y: -1 });
eq('tilt clamp', P.tiltToGravity(0, 999), { x: 1, y: 0 });
eq('tilt half', P.tiltToGravity(P.K.TILT_FULL_DEG / 2, P.K.TILT_FULL_DEG / 2), { x: 0.5, y: 0.5 });

// gravityDir: unit down; flat -> {0,1}
eq('gdir flat', P.gravityDir({ x: 0, y: 0 }), { x: 0, y: 1 });
eq('gdir 345', P.gravityDir({ x: 3, y: 4 }), { x: 0.6, y: 0.8 });

// surfaceLevel: projection for a fill fraction in a w*h box
eq('surf flat empty', P.surfaceLevel({ x: 0, y: 1 }, 100, 200, 0), 200, 1e-9);
eq('surf flat full', P.surfaceLevel({ x: 0, y: 1 }, 100, 200, 1), 0, 1e-9);
eq('surf flat half', P.surfaceLevel({ x: 0, y: 1 }, 100, 200, 0.5), 100, 1e-9);
eq('surf tilted half', P.surfaceLevel({ x: 1, y: 0 }, 100, 200, 0.5), 50, 1e-9);

// clipRectBelow: submerged polygon of the w*h rect
eq('clip flat half', P.clipRectBelow(100, 200, { x: 0, y: 1 }, 100),
   [{ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 100 }]);
eq('clip full', P.clipRectBelow(100, 200, { x: 0, y: 1 }, 0),
   [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }]);
eq('clip empty', P.clipRectBelow(100, 200, { x: 0, y: 1 }, 300), []);

// integrate: semi-implicit Euler + drag
const p = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 1 };
P.integrate(p, 0, 100, 0.1, 0);
eq('integrate vy', p.vy, 10, 1e-9);
eq('integrate y', p.y, 1, 1e-9);
eq('integrate life', p.life, 0.9, 1e-9);

// sloshStep: spring-damped normal with momentum
const rest = P.sloshStep({ dir: { x: 0, y: 1 }, vel: { x: 0, y: 0 } }, { x: 0, y: 1 }, 0.016, 90, 9);
eq('slosh at rest dir', rest.dir, { x: 0, y: 1 });
eq('slosh at rest vel', rest.vel, { x: 0, y: 0 });

const step1 = P.sloshStep({ dir: { x: 0, y: 1 }, vel: { x: 0, y: 0 } }, { x: 1, y: 0 }, 0.016, 90, 9);
eq('slosh moves toward target (dir.x up)', step1.dir.x > 0, true);
eq('slosh gains velocity', step1.vel.x > 0, true);
eq('slosh dir stays unit', Math.hypot(step1.dir.x, step1.dir.y), 1, 1e-9);

let st = { dir: { x: 0, y: 1 }, vel: { x: 0, y: 0 } };
for (let i = 0; i < 400; i++) st = P.sloshStep(st, { x: 1, y: 0 }, 0.016, 90, 9);
eq('slosh converges to target', st.dir.x > 0.95, true);

// splashCount: 0 below threshold, scales above, capped
eq('splash below', P.splashCount(1.0, 1.6, 24), 0);
eq('splash above', P.splashCount(2.6, 1.6, 24), 8);
eq('splash capped', P.splashCount(10, 1.6, 24), 24);

// pointsToClipPath: CSS polygon() string; degenerate -> hidden
eq('clip empty hidden', P.pointsToClipPath([]), 'polygon(0px 0px, 0px 0px, 0px 0px)');
eq('clip triangle', P.pointsToClipPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]),
   'polygon(0px 0px, 10px 0px, 0px 10px)');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
