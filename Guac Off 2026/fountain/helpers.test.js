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

// --- spawnVelocity: angle = dir + (rnd-0.5)*spread; magnitude == speed ---
const sv0 = H.spawnVelocity(Math.PI / 2, 0.4, 100, 0.5); // rnd=0.5 -> no jitter, straight down
eq('spawnVelocity rnd=0.5 vx ~ 0', sv0.vx, 0, 1e-6);
eq('spawnVelocity rnd=0.5 vy ~ 100', sv0.vy, 100, 1e-6);
const sv1 = H.spawnVelocity(1.0, 0.6, 250, 0.2);
eq('spawnVelocity preserves speed', Math.hypot(sv1.vx, sv1.vy), 250, 1e-6);
const svL = H.spawnVelocity(0, 0.4, 100, 0);   // rnd=0 -> angle = dir - spread/2 = -0.2
eq('spawnVelocity rnd=0 angle = dir - spread/2', Math.atan2(svL.vy, svL.vx), -0.2, 1e-6);
const svR = H.spawnVelocity(0, 0.4, 100, 1);   // rnd=1 -> angle = dir + spread/2 = +0.2
eq('spawnVelocity rnd=1 angle = dir + spread/2', Math.atan2(svR.vy, svR.vx), 0.2, 1e-6);

// --- integrate: semi-implicit Euler with per-second drag; records prev pos ---
const p1 = { x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, life: 4 };
H.integrate(p1, 0, 1000, 0.1, 0);   // gy=1000, dt=0.1, no drag
eq('integrate vy = g*dt', p1.vy, 100, 1e-9);
eq('integrate y = vy*dt', p1.y, 10, 1e-9);
eq('integrate life -= dt', p1.life, 3.9, 1e-9);
eq('integrate px captured', p1.px, 0, 1e-9);
const p2 = { x: 0, y: 0, vx: 100, vy: 0, px: 0, py: 0, life: 4 };
H.integrate(p2, 0, 0, 0.1, 2);      // drag=2 -> vx *= (1 - 0.2) = 0.8
eq('integrate drag slows vx', p2.vx, 80, 1e-9);

// --- isDead: bounds = { w, h, margin, poolY } ---
const B = { w: 100, h: 200, margin: 40, poolY: 184 };
eq('isDead alive in-bounds', H.isDead({ x: 50, y: 50, life: 1 }, B), false);
eq('isDead off right', H.isDead({ x: 200, y: 50, life: 1 }, B), true);
eq('isDead off left',  H.isDead({ x: -50, y: 50, life: 1 }, B), true);
eq('isDead off top',   H.isDead({ x: 50, y: -50, life: 1 }, B), true);
eq('isDead life expired', H.isDead({ x: 50, y: 50, life: 0 }, B), true);
eq('isDead below pool', H.isDead({ x: 50, y: 190, life: 1 }, B), true);

// --- spoutToScreen: fraction within imgBox -> absolute px ---
const IB = { left: 100, top: 50, width: 200, height: 400 };
eq('spoutToScreen center', H.spoutToScreen({ x: 0.5, y: 0.5 }, IB), { x: 200, y: 250 });
eq('spoutToScreen top-left', H.spoutToScreen({ x: 0, y: 0 }, IB), { x: 100, y: 50 });
eq('spoutToScreen bottom-right', H.spoutToScreen({ x: 1, y: 1 }, IB), { x: 300, y: 450 });

// --- gravityPx: tiltToGravity scaled by GRAVITY_SCALE (1600) ---
eq('gravityPx upright -> 1600 down', H.gravityPx(90, 0), { x: 0, y: 1600 });
eq('gravityPx gamma=30 -> 1600 right', H.gravityPx(0, 30), { x: 1600, y: 0 });
eq('gravityPx flat -> zero', H.gravityPx(0, 0), { x: 0, y: 0 });

// --- clipRectBelow: screen-rect polygon on the submerged side of the surface ---
eq('clipRectBelow half (bottom rect)',
   H.clipRectBelow(100, 200, { x: 0, y: 1 }, 100),
   [{ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 100 }]);
eq('clipRectBelow full (whole rect)',
   H.clipRectBelow(100, 200, { x: 0, y: 1 }, 0),
   [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }]);
eq('clipRectBelow empty', H.clipRectBelow(100, 200, { x: 0, y: 1 }, 250), []);

// --- isSubmerged: point is below the surface (projection along dir >= level) ---
eq('isSubmerged below horiz', H.isSubmerged({ x: 50, y: 150 }, { x: 0, y: 1 }, 100), true);
eq('isSubmerged above horiz', H.isSubmerged({ x: 50, y: 50 }, { x: 0, y: 1 }, 100), false);
eq('isSubmerged at surface (>=)', H.isSubmerged({ x: 50, y: 100 }, { x: 0, y: 1 }, 100), true);
eq('isSubmerged tilted in',  H.isSubmerged({ x: 10, y: 10 }, { x: 0.6, y: 0.8 }, 10), true);
eq('isSubmerged tilted out', H.isSubmerged({ x: 10, y: 10 }, { x: 0.6, y: 0.8 }, 20), false);

// --- surfaceLevel: projection value of the pool surface for a fill fraction ---
eq('surfaceLevel empty', H.surfaceLevel({ x: 0, y: 1 }, 100, 200, 0), 200);
eq('surfaceLevel full',  H.surfaceLevel({ x: 0, y: 1 }, 100, 200, 1), 0);
eq('surfaceLevel half',  H.surfaceLevel({ x: 0, y: 1 }, 100, 200, 0.5), 100);
eq('surfaceLevel tilted half', H.surfaceLevel({ x: 0.6, y: 0.8 }, 100, 200, 0.5), 110);

// --- gravityDir: unit "down" vector from a gravity vector; flat -> screen-down ---
eq('gravityDir down', H.gravityDir({ x: 0, y: 1600 }), { x: 0, y: 1 });
eq('gravityDir flat -> fallback down', H.gravityDir({ x: 0, y: 0 }), { x: 0, y: 1 });
eq('gravityDir 3-4-5', H.gravityDir({ x: 3, y: 4 }), { x: 0.6, y: 0.8 });
eq('gravityDir left', H.gravityDir({ x: -1000, y: 0 }), { x: -1, y: 0 });

// --- clipRectBelow: tilted direction (property checks; exact verts are float-messy) ---
const tiltPoly = H.clipRectBelow(100, 200, { x: 0.6, y: 0.8 }, 110);
eq('clipRectBelow tilted non-empty', tiltPoly.length >= 3, true);
eq('clipRectBelow tilted verts in-bounds',
   tiltPoly.every(function (v) { return v.x >= -1e-9 && v.x <= 100 + 1e-9 && v.y >= -1e-9 && v.y <= 200 + 1e-9; }), true);
eq('clipRectBelow tilted verts all submerged',
   tiltPoly.every(function (v) { return v.x * 0.6 + v.y * 0.8 >= 110 - 1e-9; }), true);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
