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

// --- view/layout helpers ---
// run(): report a missing/throwing helper as a failed assertion instead of crashing the runner
function run(fn) { try { return fn(); } catch (e) { return String(e); } }

// screenGamma: device (beta,gamma) -> screen-relative left/right tilt for a rotated screen.
// Anchored to window.orientation semantics: 0 portrait, 90 rotated CCW (iOS home-right), 270/-90 rotated CW.
eq('screenGamma portrait passes gamma', run(() => P.screenGamma(30, 10, 0)), 10);
eq('screenGamma landscape 90 uses beta', run(() => P.screenGamma(30, 10, 90)), 30);
eq('screenGamma inverted negates gamma', run(() => P.screenGamma(30, 10, 180)), -10);
eq('screenGamma landscape 270 negates beta', run(() => P.screenGamma(30, 10, 270)), -30);
eq('screenGamma accepts -90 like 270', run(() => P.screenGamma(30, 10, -90)), -30);
eq('screenGamma no angle -> portrait', run(() => P.screenGamma(30, 10, undefined)), 10);

// fillToward: tilted-mode fill lerp toward the CURRENT rest level (regression: stale fillTarget
// captured at tilt-enable stranded the waterline after a URL-bar/rotation resize)
eq('fillToward moves toward target', run(() => P.fillToward(0, 1, 0.1)), 0.3, 1e-9);
eq('fillToward big dt snaps to target', run(() => P.fillToward(0.2, 0.9, 1)), 0.9, 1e-9);
eq('fillToward dt=0 unchanged', run(() => P.fillToward(0.4, 0.9, 0)), 0.4, 1e-9);
let fl = 0.548; // rest level changes mid-flight (0.548 -> 0.592, the URL-bar scenario) => must converge to the NEW level
for (let i = 0; i < 200; i++) fl = P.fillToward ? P.fillToward(fl, 0.592, 0.016) : NaN;
eq('fillToward converges to a changed rest level', fl, 0.592, 1e-3);

// clampStage: applied stage height must leave room for the details on short viewports
eq('clampStage keeps the lock when there is room', run(() => P.clampStage(405, 900)), 405);
eq('clampStage caps at STAGE_MAX_FRAC of the visible height', run(() => P.clampStage(405, 420)), 252);
eq('clampStage exact boundary keeps the lock', run(() => P.clampStage(405, 675)), 405);
eq('clampStage rounds the cap', run(() => P.clampStage(500, 601)), 361);

// isZoomed: a pinch-zoomed visualViewport must not drive relayout
eq('isZoomed unzoomed', run(() => P.isZoomed(1)), false);
eq('isZoomed missing scale', run(() => P.isZoomed(undefined)), false);
eq('isZoomed jitter tolerated', run(() => P.isZoomed(1.005)), false);
eq('isZoomed pinch', run(() => P.isZoomed(2)), true);

// frameWidth: fountain frame sized from the LOCKED stage height (not dvh), capped by the viewport
eq('frameWidth height-limited', run(() => P.frameWidth(1200, 405, 2034 / 1136)), 725);
eq('frameWidth viewport-capped', run(() => P.frameWidth(390, 405, 2034 / 1136)), 390);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
