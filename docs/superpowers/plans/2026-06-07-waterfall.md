# Waterfall (Photoreal Water) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the design handoff's ambient photoreal waterfall as a vanilla `/waterfall/` page (sibling to `fountain/`), porting `waterfall.js` faithfully into an engine factory + view split.

**Architecture:** `helpers.js` holds pure math + the physics-constant table `K`; `spouts.js` holds the hand-tuned spout data; `engine.js` exposes `createWaterfall({canvas,config,spouts}) → {destroy}` (the ported simulation owning pools, listeners, rAF loop); `index.js` is the view that builds config (defaults + debug hash), mounts the engine, and runs the hint/lifecycle. Photo plate under a transparent canvas, all physics in image space (2034×1136) scaled per frame.

**Tech Stack:** Vanilla JS (ES5-style), Canvas 2D (`screen` blend), no build step. Tests via `node`.

---

## Conventions

- **Repo root:** `/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off`. All paths from there.
- **Branch:** all work on `waterfall`. Confirm `git branch --show-current` prints `waterfall` before EVERY commit (shared working dir).
- **Authoritative reference:** `docs/design_handoff_waterfall/` (after the Task 3 rename) — `waterfall.js` is the source the port must match; `screenshots/` are the visual target.
- **Unit tests:** `node "Guac Off 2026/waterfall/helpers.test.js"`
- **Syntax check:** `node --check "Guac Off 2026/waterfall/<file>.js"`
- **Dev server:** `python3 -m http.server 8089 --bind 127.0.0.1 --directory "Guac Off 2026"`, open `http://localhost:8089/waterfall/`.
- **Visual behavior** (does it match the screenshots) is confirmed by serving + eyeballing — note it in the report; it's the human's call, like prod-verify on the fountain.
- **Commits:** prefix `waterfall:`. No `Co-Authored-By` trailers.

---

## Task 1: helpers.js — pure math + constants

**Files:**
- Create: `Guac Off 2026/waterfall/helpers.js`
- Test: `Guac Off 2026/waterfall/helpers.test.js`

- [ ] **Step 1: Write the failing tests**

Create `Guac Off 2026/waterfall/helpers.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/waterfall/helpers.test.js"`
Expected: FAIL — `Cannot find module './helpers.js'`.

- [ ] **Step 3: Create `helpers.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/waterfall/helpers.test.js"`
Expected: PASS — `18 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "waterfall" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/waterfall/helpers.js" "Guac Off 2026/waterfall/helpers.test.js"
git commit -m "waterfall: pure helpers + physics constants"
```

---

## Task 2: spouts.js — the hand-tuned spout table

Static data (browser-only globals), ported verbatim from the handoff. No unit test — it's data, exercised by the engine + visual review. This is the single file to re-author for a new background.

**Files:**
- Create: `Guac Off 2026/waterfall/spouts.js`

- [ ] **Step 1: Create `spouts.js`**

```js
'use strict';
// Hand-tuned spout table for the waterfall, authored against assets/fountain.png
// (image space 2034x1136). THIS IS THE FILE TO RE-AUTHOR if the background changes.
// Fields: x,y = emission point; w = sheet width (also scales flow); v0 = initial down
// speed; lean = horizontal velocity (negative pours left); splashY = pool/landing line;
// on = visible; behind = pours behind a foreground block (no splash, fades out).
// kind 'fall' = downward stream ('jet' = upward plume; supported by the engine, unused).
window.WaterfallSpouts = [
  { id: 'BL', kind: 'fall', x: 408,  y: 648, w: 30, v0: 2.0, lean: -3.2,  splashY: 812, on: true },
  { id: 'L',  kind: 'fall', x: 462,  y: 480, w: 42, v0: 4.6, lean: -0.30, splashY: 804, on: true },
  { id: 'A',  kind: 'fall', x: 547,  y: 690, w: 18, v0: 5.0, lean: -0.05, splashY: 814, on: true },
  { id: 'B',  kind: 'fall', x: 701,  y: 686, w: 22, v0: 5.0, lean:  0.04, splashY: 820, on: true },
  { id: 'H',  kind: 'fall', x: 842,  y: 440, w: 19, v0: 3.0, lean: -1.15, splashY: 566, on: true, behind: true },
  { id: 'DH', kind: 'fall', x: 1492, y: 352, w: 20, v0: 3.0, lean: -0.55, splashY: 808, on: true },
  { id: 'D',  kind: 'fall', x: 1118, y: 716, w: 16, v0: 5.2, lean:  0.10, splashY: 802, on: true },
  { id: 'R',  kind: 'fall', x: 1500, y: 694, w: 34, v0: 4.8, lean:  0.08, splashY: 816, on: true },
];
window.WaterfallConfigDefaults = {
  flow: 1.0, spray: 1.0, splash: 1.0, wind: 0.0, speed: 1.0,
  ripples: true, mist: true, tint: [232, 244, 255],
};
```

- [ ] **Step 2: Verify syntax**

Run: `node --check "Guac Off 2026/waterfall/spouts.js"`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "waterfall" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/waterfall/spouts.js"
git commit -m "waterfall: hand-tuned spout table + config defaults"
```

---

## Task 3: Shell — assets, handoff rename, index.html, index.css

**Files:**
- Rename: `docs/design_handoff_waterfall 2/` → `docs/design_handoff_waterfall/`
- Create: `Guac Off 2026/waterfall/assets/fountain.png` (copied)
- Create: `Guac Off 2026/waterfall/index.html`
- Create: `Guac Off 2026/waterfall/index.css`

- [ ] **Step 1: Rename the handoff folder (drop the iCloud `" 2"`) and copy the plate**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ -d "docs/design_handoff_waterfall 2" ] && mv "docs/design_handoff_waterfall 2" "docs/design_handoff_waterfall"
mkdir -p "Guac Off 2026/waterfall/assets"
cp "docs/design_handoff_waterfall/fountain.png" "Guac Off 2026/waterfall/assets/fountain.png"
ls -la "Guac Off 2026/waterfall/assets/"
```
Expected: `fountain.png` listed (~2034×1136 PNG). If the handoff folder is missing, STOP and report NEEDS_CONTEXT.

- [ ] **Step 2: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💦</text></svg>">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vaillancourt Fountain · SF GUAC OFF 2026</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="stage">
    <div class="frame">
      <img class="plate" src="assets/fountain.png" alt="Vaillancourt Fountain">
      <canvas id="water"></canvas>
    </div>
  </div>
  <div id="hint" class="hint">click a stream to toggle it · move the cursor to push the spray</div>

  <script src="helpers.js"></script>
  <script src="spouts.js"></script>
  <script src="engine.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `index.css`**

```css
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%;
  background: #000;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

/* black radial stage, fountain frame centered + letterboxed to the photo aspect */
.stage {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(120% 120% at 50% 30%, #07090c 0%, #000 70%);
}
.frame {
  position: relative;
  width: min(100vw, calc(100vh * 2034 / 1136));
  aspect-ratio: 2034 / 1136;
}

/* photo plate (no pointer events) + transparent water canvas on top (gets the clicks) */
.plate, #water { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.plate { object-fit: contain; user-select: none; -webkit-user-drag: none; pointer-events: none; }

/* hint pill (design tokens from the handoff) */
.hint {
  position: fixed; left: 50%; bottom: 5vh; transform: translateX(-50%);
  background: rgba(8, 12, 16, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(220, 232, 245, 0.55);
  font-size: 13px; padding: 8px 16px;
  border-radius: 999px;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  pointer-events: none;
  transition: opacity 800ms ease;
}
.hint.hide { opacity: 0; }
```

- [ ] **Step 4: Verify it serves (canvas blank — engine not built yet)**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off/Guac Off 2026"
python3 -m http.server 8089 --bind 127.0.0.1 & SRV=$!; sleep 1
curl -s -o /dev/null -w "page %{http_code}\n" http://localhost:8089/waterfall/
curl -s -o /dev/null -w "plate %{http_code}\n" http://localhost:8089/waterfall/assets/fountain.png
kill $SRV
```
Expected: `page 200`, `plate 200`. (Opening it shows the photo on black; `engine.js`/`index.js` 404 until the next tasks — fine.)

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "waterfall" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/waterfall/assets/fountain.png" "Guac Off 2026/waterfall/index.html" "Guac Off 2026/waterfall/index.css"
git commit -m "waterfall: page shell — stage, plate, canvas, hint"
```

(The renamed `docs/design_handoff_waterfall/` is committed in Task 7.)

---

## Task 4: engine.js — the ported simulation factory

A faithful port of `waterfall.js` wrapped in `createWaterfall(...)`: globals → passed `config`/`spouts`; constants → `K`; `tintStr`/`impactX`/`timeOfFlight` → helper calls; fractional emission → `emitStep`; plus `destroy()` that cancels the loop and removes listeners. The three look-critical details (velocity tails `K.TAIL_*`, clock speckles, `emitStep`) and all render math are preserved. Diff against `docs/design_handoff_waterfall/waterfall.js` to confirm fidelity.

**Files:**
- Create: `Guac Off 2026/waterfall/engine.js`

- [ ] **Step 1: Create `engine.js`**

```js
'use strict';
// Waterfall simulation engine — ported from docs/design_handoff_waterfall/waterfall.js.
// Factory: createWaterfall({ canvas, config, spouts }) -> { destroy }.
// All physics authored in image space (2034x1136), scaled to the canvas each frame.
(function () {
  const H = window.WaterfallHelpers;
  const K = H.K;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function createWaterfall(opts) {
    const canvas = opts.canvas;
    const CFG = opts.config;
    const SPOUTS = opts.spouts;
    const ctx = canvas.getContext('2d', { alpha: true });

    let CW = 0, CH = 0, S = 1; // S = canvas px per image px
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, K.DPR_CAP);
      const targetW = Math.min(rect.width * dpr, K.WIDTH_CAP);
      S = targetW / K.IMG_W;
      CW = Math.round(K.IMG_W * S);
      CH = Math.round(K.IMG_H * S);
      canvas.width = CW;
      canvas.height = CH;
    }

    // particle pools (plain mutable arrays — never reactive)
    const stream = [], mist = [], splash = [], ripples = [];

    // mouse wind
    const mouse = { x: -999, y: -999, px: -999, py: -999, vx: 0, vy: 0, active: false };
    function imgFromEvent(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * K.IMG_W, y: (e.clientY - r.top) / r.height * K.IMG_H };
    }
    function onMove(e) {
      const p = imgFromEvent(e);
      mouse.vx = p.x - mouse.x; mouse.vy = p.y - mouse.y;
      mouse.px = mouse.x; mouse.py = mouse.y;
      mouse.x = p.x; mouse.y = p.y; mouse.active = true;
    }
    function onLeave() { mouse.active = false; mouse.x = mouse.y = -999; }
    function onClick(e) {
      const p = imgFromEvent(e);
      let best = null, bd = 1e9;
      for (const s of SPOUTS) {
        const cx = s.x, cy = (s.y + s.splashY) / 2;
        const d = Math.hypot(p.x - cx, (p.y - cy) * 0.6);
        if (d < bd) { bd = d; best = s; }
      }
      if (best && bd < 170) {
        best.on = !best.on;
        if (typeof CFG.onSpoutToggle === 'function') CFG.onSpoutToggle();
      }
    }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', resize);

    // ---- spawning ----
    function spawnStream(s, dt) {
      if (!s.on) return;
      if (s.kind === 'jet') { spawnJet(s, dt); return; }
      const rate = CFG.flow * s.w * K.FALL_EMIT * dt;
      const step = H.emitStep(s._acc || 0, rate);
      s._acc = step.acc;
      let n = step.n;
      if (stream.length > K.MAX_STREAM) n = 0;
      for (let i = 0; i < n; i++) {
        const off = rnd(-s.w / 2, s.w / 2);
        stream.push({
          x: s.x + off, y: s.y + rnd(-3, 3),
          px: s.x + off, py: s.y,
          vx: s.lean + off * 0.008 + rnd(-0.1, 0.1),
          vy: s.v0 + rnd(-0.4, 0.8),
          w: rnd(1.1, 2.6) + Math.max(0, 1.4 - Math.abs(off) / (s.w / 2) * 1.4),
          b: rnd(0.55, 1.0),
          splashY: s.splashY + rnd(-6, 6),
          sp: s, jet: false,
        });
      }
      if (!s.behind && CFG.mist && Math.random() < 0.5 * CFG.spray * dt) spawnMist(s.x + rnd(-s.w / 2, s.w / 2), s.y + rnd(0, 40), 0.5);
    }

    function spawnJet(s, dt) {
      const rate = CFG.flow * s.w * K.JET_EMIT * dt;
      const step = H.emitStep(s._acc || 0, rate);
      s._acc = step.acc;
      let n = step.n;
      if (stream.length > K.MAX_STREAM) n = 0;
      for (let i = 0; i < n; i++) {
        const ang = rnd(-0.22, 0.22);
        const sp = s.v0 * rnd(0.62, 1.05);
        stream.push({
          x: s.x + rnd(-7, 7), y: s.y, px: s.x, py: s.y,
          vx: Math.sin(ang) * sp + rnd(-0.25, 0.25), vy: -Math.cos(ang) * sp,
          w: rnd(1.0, 2.2), b: rnd(0.55, 1.0),
          splashY: s.splashY + rnd(-4, 4), sp: s, jet: true,
        });
      }
      if (CFG.mist && Math.random() < 1.4 * CFG.spray * dt) spawnMist(s.x + rnd(-22, 22), s.y - rnd(0, 150), 1.0);
    }

    function spawnMist(x, y, scale) {
      if (mist.length > K.MAX_MIST) return;
      mist.push({ x, y, vx: rnd(-0.3, 0.3), vy: rnd(-0.5, -0.05), r: rnd(6, 22) * scale, life: 0, max: rnd(40, 95), a: rnd(0.05, 0.16) });
    }

    function doSplash(x, y, power) {
      const n = Math.round(rnd(4, 9) * CFG.splash * power);
      for (let i = 0; i < n; i++) {
        if (splash.length > K.MAX_SPLASH) break;
        const ang = -Math.PI / 2 + rnd(-1.05, 1.05);
        const sp = rnd(1.6, 5.2) * (0.7 + power * 0.4);
        splash.push({ x, y, px: x, py: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: rnd(16, 34), w: rnd(1.0, 2.2) });
      }
      if (CFG.mist) for (let i = 0; i < 2 * CFG.spray; i++) spawnMist(x + rnd(-12, 12), y - rnd(0, 14), 0.6);
      if (CFG.ripples && Math.random() < 0.35) ripples.push({ x, y, r: rnd(3, 7), vr: rnd(0.7, 1.2), life: 0, max: rnd(55, 90) });
    }

    // ---- update ----
    function update(dt) {
      const wind = CFG.wind;
      let w = 0;
      for (let i = 0; i < stream.length; i++) {
        const p = stream[i];
        p.px = p.x; p.py = p.y;
        p.vy += K.GRAV * dt;
        p.vx += wind * K.WIND_COEFF * dt;
        p.vx += rnd(-0.03, 0.03) * dt;
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y; const d2 = dx * dx + dy * dy;
          if (d2 < K.GUST_R1) {
            const f = (1 - d2 / K.GUST_R1) * 0.5;
            p.vx += (dx >= 0 ? 1 : -1) * f * (1.5 + Math.abs(mouse.vx) * 0.25) * dt;
            p.vy += mouse.vy * 0.04 * f * dt;
          }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (!p.sp.behind && CFG.mist && p.vy > 4 && Math.random() < 0.006 * CFG.spray * dt) spawnMist(p.x, p.y, 0.4);
        const landed = p.y >= p.splashY && p.vy > 0;
        if (landed) {
          if (!p.sp.behind) doSplash(p.x, p.splashY, Math.min(1.6, 0.4 + p.vy * 0.08));
          continue;
        }
        if (p.y > K.IMG_H + 30 || p.x < -60 || p.x > K.IMG_W + 60) continue;
        stream[w++] = p;
      }
      stream.length = w;

      w = 0;
      for (let i = 0; i < mist.length; i++) {
        const m = mist[i];
        m.life += dt; m.vx += wind * 0.01 * dt;
        if (mouse.active) {
          const dx = m.x - mouse.x, dy = m.y - mouse.y; const d2 = dx * dx + dy * dy;
          if (d2 < K.GUST_R2) { const f = (1 - d2 / K.GUST_R2) * 0.4; m.vx += (dx >= 0 ? 1 : -1) * f * dt; m.vy += mouse.vy * 0.03 * f * dt; }
        }
        m.x += m.vx * dt; m.y += m.vy * dt; m.vy -= 0.004 * dt; m.r += 0.18 * dt;
        if (m.life < m.max) mist[w++] = m;
      }
      mist.length = w;

      w = 0;
      for (let i = 0; i < splash.length; i++) {
        const p = splash[i];
        p.px = p.x; p.py = p.y; p.vy += K.GRAV * 1.05 * dt; p.vx += wind * 0.02 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life += dt;
        if (p.life < p.max) splash[w++] = p;
      }
      splash.length = w;

      w = 0;
      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i]; r.life += dt; r.r += r.vr * dt;
        if (r.life < r.max) ripples[w++] = r;
      }
      ripples.length = w;
    }

    // ---- render ----
    function tint(a, lighten) { return H.tintStr(CFG.tint, a, lighten); }

    function drawPlumeGlow(s, time) {
      const peak = s.y - (s.v0 * s.v0) / (2 * K.GRAV) * 0.62;
      const topW = s.w * 2.2, baseW = s.w * 0.5;
      const wob = Math.sin(time * 0.005 + s.x) * 4;
      ctx.beginPath();
      ctx.moveTo(s.x - baseW, s.y);
      ctx.quadraticCurveTo(s.x - topW * 0.5 + wob, (s.y + peak) / 2, s.x - topW * 0.5 + wob, peak);
      ctx.lineTo(s.x + topW * 0.5 + wob, peak);
      ctx.quadraticCurveTo(s.x + topW * 0.5 + wob, (s.y + peak) / 2, s.x + baseW, s.y);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, s.y, 0, peak);
      g.addColorStop(0, tint(0.22 * CFG.flow, 14));
      g.addColorStop(0.5, tint(0.12 * CFG.flow * CFG.spray, 10));
      g.addColorStop(1, tint(0.02 * CFG.flow));
      ctx.fillStyle = g; ctx.fill();
    }

    function drawRibbon(s, time) {
      const y0 = s.y, y1 = s.splashY, drop = y1 - y0;
      const v0 = s.v0;
      const tFall = H.timeOfFlight(v0, K.GRAV, drop);
      const wind = CFG.wind;
      const segs = 14;
      const wTop = s.w * 0.82, wBot = Math.max(4, s.w * 0.34);
      const tw = time * 0.004;
      function pt(f) {
        const t = f * tFall;
        const x = s.x + s.lean * t + 0.5 * wind * K.WIND_COEFF * t * t
          + Math.sin(tw + f * 3.4 + s.x * 0.01) * (1.5 + f * f * 9);
        const y = y0 + v0 * t + 0.5 * K.GRAV * t * t;
        return [x, y];
      }
      function edge(f, sign, hw) {
        const a = pt(Math.max(0, f - 0.02)), b = pt(Math.min(1, f + 0.02));
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const p = pt(f);
        return [p[0] - dy * sign * hw, p[1] + dx * sign * hw];
      }
      const hwAt = (f) => (wTop + (wBot - wTop) * f) * 0.5;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) { const f = i / segs, e = edge(f, 1, hwAt(f)); i === 0 ? ctx.moveTo(e[0], e[1]) : ctx.lineTo(e[0], e[1]); }
      for (let i = segs; i >= 0; i--) { const f = i / segs, e = edge(f, -1, hwAt(f)); ctx.lineTo(e[0], e[1]); }
      ctx.closePath();
      let g = ctx.createLinearGradient(0, y0, 0, y1);
      if (s.behind) {
        g.addColorStop(0, tint(0.46 * CFG.flow, 14));
        g.addColorStop(0.4, tint(0.2 * CFG.flow, 8));
        g.addColorStop(0.72, tint(0));
        g.addColorStop(1, tint(0));
      } else {
        g.addColorStop(0, tint(0.5 * CFG.flow, 14));
        g.addColorStop(0.45, tint(0.26 * CFG.flow, 8));
        g.addColorStop(1, tint(0.05 * CFG.flow));
      }
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) { const f = i / segs, p = pt(f); i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
      g = ctx.createLinearGradient(0, y0, 0, y1);
      if (s.behind) {
        g.addColorStop(0, tint(0.46 * CFG.flow, 24));
        g.addColorStop(0.45, tint(0.16 * CFG.flow, 14));
        g.addColorStop(0.72, tint(0));
      } else {
        g.addColorStop(0, tint(0.5 * CFG.flow, 24));
        g.addColorStop(0.6, tint(0.2 * CFG.flow, 14));
        g.addColorStop(1, tint(0));
      }
      ctx.strokeStyle = g; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, s.w * 0.26);
      ctx.stroke();
    }

    function render(time) {
      ctx.clearRect(0, 0, CW, CH);
      ctx.save();
      ctx.scale(S, S);
      ctx.globalCompositeOperation = 'screen';

      if (CFG.mist) {
        for (let i = 0; i < mist.length; i++) {
          const m = mist[i];
          const k = m.life / m.max;
          const a = m.a * Math.sin(Math.min(1, k) * Math.PI) * CFG.spray;
          if (a <= 0.002) continue;
          const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
          g.addColorStop(0, tint(a, 18));
          g.addColorStop(1, tint(0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
        }
      }

      if (CFG.ripples) {
        ctx.lineWidth = 1.4;
        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          const k = r.life / r.max;
          const a = (1 - k) * 0.22;
          ctx.strokeStyle = tint(a, 6);
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, r.r, r.r * K.RIPPLE_SQUASH, 0, 0, 6.2832);
          ctx.stroke();
        }
      }

      for (const s of SPOUTS) {
        if (!s.on) continue;
        if (s.kind === 'jet') { drawPlumeGlow(s, time); continue; }
        drawRibbon(s, time);
      }

      ctx.lineCap = 'round';
      for (let i = 0; i < stream.length; i++) {
        const p = stream[i];
        let a = Math.min(0.85, 0.30 + p.b * 0.5);
        if (p.sp.behind) {
          const frac = (p.y - p.sp.y) / (p.splashY - p.sp.y);
          a *= frac > 0.5 ? Math.max(0, 1 - (frac - 0.5) / 0.5) : 1;
        }
        if (a <= 0.01) continue;
        ctx.strokeStyle = tint(a, 14);
        ctx.lineWidth = p.w;
        const TAIL = K.TAIL_STREAM;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * TAIL, p.y - p.vy * TAIL);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      ctx.lineCap = 'round';
      for (let i = 0; i < splash.length; i++) {
        const p = splash[i];
        const a = (1 - p.life / p.max) * 0.9;
        ctx.strokeStyle = tint(a, 20);
        ctx.lineWidth = p.w;
        const ST = K.TAIL_SPLASH;
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * ST, p.y - p.vy * ST); ctx.lineTo(p.x, p.y); ctx.stroke();
      }

      for (const s of SPOUTS) {
        if (!s.on || s.behind) continue;
        const fx = H.impactX(s, K.GRAV, CFG.wind, K.WIND_COEFF), fy = s.splashY;
        const fl = (0.5 + 0.5 * Math.sin(time * 0.006 + s.x));
        const rad = (26 + s.w * 0.7) * (0.85 + 0.3 * fl);
        const a = 0.16 * CFG.splash * (0.7 + 0.3 * fl) * CFG.flow;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad);
        g.addColorStop(0, tint(a, 18));
        g.addColorStop(0.6, tint(a * 0.5, 8));
        g.addColorStop(1, tint(0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(fx, fy); ctx.scale(1, K.FOAM_SQUASH); ctx.translate(-fx, -fy);
        ctx.beginPath(); ctx.arc(fx, fy, rad, 0, 6.2832); ctx.fill();
        ctx.restore();
        // clock-driven speckles (seeded off `time`, never re-randomized) so they shimmer
        const nSp = Math.round(4 * CFG.splash);
        for (let i = 0; i < nSp; i++) {
          const seed = i * 12.9898 + s.x * 0.7;
          const ang = (time * 0.0011 + seed) % 6.2832;
          const rr = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 0.0018 + seed * 1.7))) * rad;
          const sx = fx + Math.cos(ang) * rr, sy = fy + Math.sin(ang) * rr * 0.36;
          const tw = 0.5 + 0.5 * Math.sin(time * 0.009 + seed * 3.1);
          ctx.fillStyle = tint(tw * 0.4 * CFG.splash, 24);
          ctx.fillRect(sx, sy, 1.6, 1.4);
        }
      }

      ctx.restore();
    }

    // ---- main loop ----
    let last = performance.now();
    let rafId = 0;
    function frame(now) {
      let dtMs = now - last; last = now;
      if (dtMs > 60) dtMs = 60; // clamp after tab-away
      const dt = (dtMs / 16.6667) * CFG.speed;
      for (const s of SPOUTS) spawnStream(s, dt);
      update(dt);
      render(now);
      rafId = requestAnimationFrame(frame);
    }

    resize();
    rafId = requestAnimationFrame(frame);

    function destroy() {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
    }
    return { destroy: destroy };
  }

  window.createWaterfall = createWaterfall;
})();
```

- [ ] **Step 2: Verify**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
node --check "Guac Off 2026/waterfall/engine.js" && echo "syntax OK"
node "Guac Off 2026/waterfall/helpers.test.js"   # still 18 passed (engine doesn't change helpers)
```
Expected: `syntax OK`; `18 passed, 0 failed`.

- [ ] **Step 3: Fidelity diff (sanity)**

Run: `diff <(grep -oE "0\.34|22000|30000|1\.7|1\.5|0\.018|0\.9|1\.05|0\.4|0\.32" "docs/design_handoff_waterfall/waterfall.js" | sort -u) <(grep -oE "0\.34|22000|30000|1\.7|1\.5|0\.018|0\.9|1\.05|0\.4|0\.32" "Guac Off 2026/waterfall/helpers.js" | sort -u)`
Expected: the engine's constants (now in `helpers.js K`) cover the handoff's magic numbers. (Informational — eyeball that nothing's missing.)

- [ ] **Step 4: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "waterfall" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/waterfall/engine.js"
git commit -m "waterfall: ported simulation engine (createWaterfall factory + destroy)"
```

---

## Task 5: index.js — the view (config, mount, hint, lifecycle)

**Files:**
- Create: `Guac Off 2026/waterfall/index.js`

- [ ] **Step 1: Create `index.js`**

```js
'use strict';

// Defensive: this project does not use a service worker — clear any stale one
// left by a sibling project on a shared origin (see global dev-isolation rule).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (rs) {
    rs.forEach(function (r) { r.unregister(); });
  });
}

// View layer: owns the <canvas> + lifecycle, builds the config (defaults + debug hash),
// mounts the engine, runs the hint-pill fade. Particle data stays inside the engine.
(function () {
  // Debug hash overrides (the only runtime path to presets now the panel is dropped):
  //   #flow=..&spray=..&splash=..&wind=..&speed=..&zoom=cx,cy,scale
  function parseHash() {
    const out = {};
    const h = location.hash.replace(/^#/, '');
    if (!h) return out;
    h.split('&').forEach(function (kv) {
      const i = kv.indexOf('=');
      if (i < 0) return;
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (k === 'zoom') { out.zoom = v.split(',').map(Number); return; }
      const num = parseFloat(v);
      if (!isNaN(num) && ['flow', 'spray', 'splash', 'wind', 'speed'].indexOf(k) >= 0) out[k] = num;
    });
    return out;
  }

  const defaults = window.WaterfallConfigDefaults;
  const overrides = parseHash();
  const config = Object.assign({}, defaults, overrides);
  config.tint = (defaults.tint || [232, 244, 255]).slice(); // own copy

  const canvas = document.getElementById('water');
  const spouts = window.WaterfallSpouts;

  // optional debug zoom of the frame
  if (overrides.zoom && overrides.zoom.length === 3) {
    const cx = overrides.zoom[0], cy = overrides.zoom[1], scale = overrides.zoom[2];
    const frame = document.querySelector('.frame');
    if (frame) {
      frame.style.transformOrigin = (cx / 2034 * 100) + '% ' + (cy / 1136 * 100) + '%';
      frame.style.transform = 'scale(' + scale + ')';
    }
  }

  const wf = window.createWaterfall({ canvas: canvas, config: config, spouts: spouts });

  // hint pill: fade after 7s or on first click
  const hint = document.getElementById('hint');
  let hintGone = false;
  function hideHint() { if (hintGone) return; hintGone = true; if (hint) hint.classList.add('hide'); }
  setTimeout(hideHint, 7000);
  canvas.addEventListener('click', hideHint, { once: true });

  // lifecycle: tear the engine down when the page is hidden/unloaded
  window.addEventListener('pagehide', function () { wf.destroy(); });
})();
```

- [ ] **Step 2: Verify it serves + runs**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
node --check "Guac Off 2026/waterfall/index.js" && echo "syntax OK"
cd "Guac Off 2026" && python3 -m http.server 8089 --bind 127.0.0.1 & SRV=$!; sleep 1
for f in "" index.js engine.js helpers.js spouts.js assets/fountain.png; do
  curl -s -o /dev/null -w "$f %{http_code}\n" "http://localhost:8089/waterfall/$f"
done
kill $SRV
```
Expected: `syntax OK`; every path `200`.

- [ ] **Step 3: Visual check (human / serve-and-look)**

Serve and open `http://localhost:8089/waterfall/` in a browser. Compare against `docs/design_handoff_waterfall/screenshots/`:
- Default load ≈ `01-full-scene.png`: bright water columns from all spouts into a foamy pool, ripples, the "Hidden spill" (`H`) pouring right-to-left and fading behind the block with no splash.
- `#flow=1.8&spray=1.6&splash=1.6&speed=1.2` ≈ `03-raging-preset.png`.
- Clicking a stream toggles it; moving the cursor pushes the spray; the hint fades after ~7s/first click.
Report any visual mismatch; tuning lives in `helpers.js K` + `spouts.js`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "waterfall" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/waterfall/index.js"
git commit -m "waterfall: view layer — config, mount, hint, lifecycle"
```

---

## Task 6: Home-page link

**Files:**
- Modify: `Guac Off 2026/index.html`

- [ ] **Step 1: Add the footer link**

In `Guac Off 2026/index.html`, find the fountain link line:
```html
      <p style="text-align:center;margin-top:18px"><a href="fountain/" style="color:#7cb342;text-decoration:none;font-size:.9rem">⛲ → 💧 tilt to pour the fountain</a></p>
```
Insert immediately AFTER it:
```html
      <p style="text-align:center;margin-top:18px"><a href="waterfall/" style="color:#7cb342;text-decoration:none;font-size:.9rem">💦 watch the fountain flow</a></p>
```

- [ ] **Step 2: Verify**

Run: `grep -n "waterfall/" "Guac Off 2026/index.html"`
Expected: one match, the new link.

- [ ] **Step 3: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "waterfall" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/index.html"
git commit -m "waterfall: link from home page footer"
```

---

## Task 7: Final verification, handoff reference, spec status

**Files:**
- Add: `docs/design_handoff_waterfall/` (the renamed reference bundle)
- Modify: `docs/superpowers/specs/2026-06-07-waterfall-design.md`

- [ ] **Step 1: Full checks**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
node "Guac Off 2026/waterfall/helpers.test.js"   # 18 passed
for f in helpers spouts engine index; do node --check "Guac Off 2026/waterfall/$f.js" && echo "$f OK"; done
```
Expected: `15 passed`; all four `OK`.

- [ ] **Step 2: Conflicted-copy sweep (iCloud hazard)**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
found=$(find "Guac Off 2026/waterfall" docs -name "* 2" -o -name "* 2.*" 2>/dev/null); [ -n "$found" ] && echo "FOUND: $found" || echo "none"
```
Expected: `none` (the handoff folder was renamed off its `" 2"` in Task 3).

- [ ] **Step 3: Mark spec implemented**

In `docs/superpowers/specs/2026-06-07-waterfall-design.md`, change the `**Status:**` line to:
`- **Status:** Implemented on \`waterfall\` (helpers node-tested; visual fidelity confirmed by serving + matching screenshots).`

- [ ] **Step 4: Commit the reference bundle + spec status**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "waterfall" ] || { echo "WRONG BRANCH"; exit 1; }
git add "docs/design_handoff_waterfall" "docs/superpowers/specs/2026-06-07-waterfall-design.md"
git commit -m "waterfall: commit design-handoff reference; mark spec implemented"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** file layout (T1–T6), engine/view split + `destroy` (T4 engine, T5 view), particles-plain + config/`on` as only shared state — no `window.WATER` (T4 takes `config`/`spouts` args), layering/coordinate scale + `resize` (T4), constants/tail/speckle/emit fidelity (T1 `K`+`emitStep`, T4 render), ribbon path + `impactX` non-lerp (T1 `impactX`/`timeOfFlight`, T4 `drawRibbon`), `behind` fade (T4), click/cursor/hint/debug-hash (T4 listeners, T5 hash+hint), keep `fountain.png` + spouts verbatim (T2, T3), rename handoff off `" 2"` + commit reference (T3, T7), home link (T6), mobile renders via the letterboxed frame (T3 CSS). Panel/jet/WebGL are out of scope by omission.
- **Identifier consistency:** `helpers.js` exports `K, timeOfFlight, impactX, tintStr, emitStep`; `engine.js` consumes exactly those (`H.K`, `H.timeOfFlight`, `H.impactX`, `H.tintStr`, `H.emitStep`) plus `window.WaterfallSpouts` and a `config` arg; `index.js` reads `window.WaterfallConfigDefaults`, `window.WaterfallSpouts`, `window.createWaterfall`. Canvas-size locals are `CW/CH/S` (helpers module alias is `H`, no clash).
- **Per-frame allocation** (gradients, ribbon points) is inherent to this Canvas-2D look and matches the handoff; not a regression to fix.
