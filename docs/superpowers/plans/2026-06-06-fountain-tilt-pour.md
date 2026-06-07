# Fountain Tilt-to-Pour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/fountain/`, a phone-tilt sandbox where water pours from the Vaillancourt Fountain's spouts in the direction you lean.

**Architecture:** A new standalone page in `Guac Off 2026/fountain/`, sibling to `tilt/` and `find/`. Pure, unit-tested math lives in `helpers.js` (dual-mode: browser + Node). `index.js` owns the DOM, the iOS motion-permission flow (reused from `tilt/`), and a Canvas 2D particle loop whose gravity vector comes from device tilt. Water is drawn as streaks on a transparent canvas layered over a fountain `<img>` on a black page.

**Tech Stack:** Vanilla JS (ES5-style IIFE, matching the repo), Canvas 2D, `DeviceOrientationEvent`. No build step, no dependencies. Tests run with `node`.

---

## Conventions for this plan

- **Repo root:** `/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off`. All `cd` and relative paths are from there.
- **Branch:** all work happens on `vaillancourt_fountain`. Before every commit, confirm the branch (`git branch --show-current` must print `vaillancourt_fountain`) — this repo's working dir is shared with other agents.
- **Run unit tests:** `node "Guac Off 2026/fountain/helpers.test.js"`
- **Dev server (desktop sanity):** `cd "Guac Off 2026" && python3 -m http.server 8080 --bind 0.0.0.0`, then open `http://localhost:8080/fountain/`.
- **Device test (REQUIRED for tilt):** iOS Safari only fires `DeviceOrientationEvent` / shows the permission prompt in a **secure context (HTTPS)**. A plain `http://<lan-ip>` will NOT work. Use your usual HTTPS path for `find/` (a tunnel such as `cloudflared tunnel --url http://localhost:8080`, or the deployed site). On desktop with no device, water simply pours straight down — that's expected, not a bug.
- **Commits:** prefix `fountain:`. Do NOT add any `Co-Authored-By` line.

---

## Task 1: helpers.js skeleton + constants + `clamp` + `tiltToGravity`

**Files:**
- Create: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Write the failing tests + test harness**

Create `Guac Off 2026/fountain/helpers.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `Cannot find module './helpers.js'` (file doesn't exist yet).

- [ ] **Step 3: Create `helpers.js` with constants, SPOUTS, `clamp`, `tiltToGravity`**

Create `Guac Off 2026/fountain/helpers.js`:

```js
// Pure helpers for the tilt-to-pour fountain.
// Loads in Node (module.exports) and the browser (window.FountainHelpers).
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FountainHelpers = api;
})(function () {
  'use strict';

  // --- tunable constants (single source of truth — the "dials") ---
  const TILT_FULL_DEG  = 30;     // degrees of tilt mapped to full gravity
  const STRENGTH       = 1.0;    // unitless gravity magnitude at full tilt
  const GRAVITY_SCALE  = 1600;   // px/s^2 at full tilt
  const EMIT_RATE      = 70;     // droplets/sec per spout
  const INIT_SPEED     = 180;    // px/s initial droplet speed out of a spout
  const SPREAD         = 0.45;   // radians of angular jitter per droplet
  const PARTICLE_LIFE  = 5.0;    // seconds (safety cap; most exit sooner)
  const DRAG           = 0.12;   // per-second velocity damping
  const MAX_PARTICLES  = 800;    // hard cap on live droplets
  const POOL_FRAC      = 0.92;   // pool line at this fraction of viewport height
  const WATER_RGB      = '175, 215, 255';  // light blue
  const STREAK_ALPHA   = 0.5;    // per-streak opacity
  const LINE_WIDTH     = 2;      // streak width (px)

  // --- spout layout: PLACEHOLDER measured from the provided photo.
  // x,y are FRACTIONS [0..1] of the fountain image box; dir is emission angle in
  // radians (canvas convention: +y is down, so PI/2 ≈ straight down, >PI/2 leans
  // left, <PI/2 leans right). REPLACE x/y/dir when the final art + reference land.
  const SPOUTS = [
    { x: 0.235, y: 0.640, dir: 1.83 },
    { x: 0.305, y: 0.625, dir: 1.62 },
    { x: 0.500, y: 0.560, dir: 1.5708 },
    { x: 0.620, y: 0.585, dir: 1.45 },
    { x: 0.775, y: 0.650, dir: 1.5708 },
  ];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Phone tilt -> unit-ish gravity vector. beta=pitch (front/back), gamma=roll (L/R).
  function tiltToGravity(beta, gamma) {
    return {
      x: clamp(gamma / TILT_FULL_DEG, -1, 1) * STRENGTH,
      y: clamp(beta  / TILT_FULL_DEG, -1, 1) * STRENGTH,
    };
  }

  return {
    clamp, tiltToGravity, SPOUTS,
    constants: {
      TILT_FULL_DEG, STRENGTH, GRAVITY_SCALE, EMIT_RATE, INIT_SPEED, SPREAD,
      PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, STREAK_ALPHA, LINE_WIDTH,
    },
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `8 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: helpers scaffold — clamp, tiltToGravity, constants, spouts"
```

---

## Task 2: `gravityPx` (scale tilt gravity to px/s²)

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing test**

In `helpers.test.js`, insert before the `console.log(\`${passed}...\`)` summary line:

```js
// --- gravityPx: tiltToGravity scaled by GRAVITY_SCALE (1600) ---
eq('gravityPx upright -> 1600 down', H.gravityPx(90, 0), { x: 0, y: 1600 });
eq('gravityPx gamma=30 -> 1600 right', H.gravityPx(0, 30), { x: 1600, y: 0 });
eq('gravityPx flat -> zero', H.gravityPx(0, 0), { x: 0, y: 0 });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.gravityPx is not a function`.

- [ ] **Step 3: Implement `gravityPx`**

In `helpers.js`, add after `tiltToGravity`:

```js
  function gravityPx(beta, gamma) {
    const g = tiltToGravity(beta, gamma);
    return { x: g.x * GRAVITY_SCALE, y: g.y * GRAVITY_SCALE };
  }
```

Update the `return` object to include it:

```js
  return {
    clamp, tiltToGravity, gravityPx, SPOUTS,
    constants: {
      TILT_FULL_DEG, STRENGTH, GRAVITY_SCALE, EMIT_RATE, INIT_SPEED, SPREAD,
      PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, STREAK_ALPHA, LINE_WIDTH,
    },
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `11 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: gravityPx — scale tilt gravity to px/s^2"
```

---

## Task 3: `spawnVelocity` (droplet launch vector)

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

Insert before the summary line in `helpers.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.spawnVelocity is not a function`.

- [ ] **Step 3: Implement `spawnVelocity`**

Add after `gravityPx` in `helpers.js`:

```js
  function spawnVelocity(dir, spread, speed, rnd) {
    const a = dir + (rnd - 0.5) * spread;
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
  }
```

Add `spawnVelocity` to the `return` object's first line:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, SPOUTS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `16 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: spawnVelocity — droplet launch vector with jitter"
```

---

## Task 4: `integrate` (advance one droplet one tick)

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

Insert before the summary line in `helpers.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.integrate is not a function`.

- [ ] **Step 3: Implement `integrate`**

Add after `spawnVelocity` in `helpers.js`:

```js
  // Advance a droplet one tick (mutates and returns it). dt in seconds.
  function integrate(p, gx, gy, dt, drag) {
    p.vx += gx * dt;
    p.vy += gy * dt;
    const d = 1 - drag * dt;
    p.vx *= d;
    p.vy *= d;
    p.px = p.x;
    p.py = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    return p;
  }
```

Add `integrate` to the `return` object's first line:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, SPOUTS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `21 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: integrate — per-tick droplet motion with drag"
```

---

## Task 5: `isDead` (droplet retirement test)

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

Insert before the summary line in `helpers.test.js`:

```js
// --- isDead: bounds = { w, h, margin, poolY } ---
const B = { w: 100, h: 200, margin: 40, poolY: 184 };
eq('isDead alive in-bounds', H.isDead({ x: 50, y: 50, life: 1 }, B), false);
eq('isDead off right', H.isDead({ x: 200, y: 50, life: 1 }, B), true);
eq('isDead off left',  H.isDead({ x: -50, y: 50, life: 1 }, B), true);
eq('isDead off top',   H.isDead({ x: 50, y: -50, life: 1 }, B), true);
eq('isDead life expired', H.isDead({ x: 50, y: 50, life: 0 }, B), true);
eq('isDead below pool', H.isDead({ x: 50, y: 190, life: 1 }, B), true);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.isDead is not a function`.

- [ ] **Step 3: Implement `isDead`**

Add after `integrate` in `helpers.js`:

```js
  // True when a droplet should be retired: expired, off-screen, or hit the pool.
  function isDead(p, b) {
    if (p.life <= 0) return true;
    if (p.x < -b.margin || p.x > b.w + b.margin) return true;
    if (p.y < -b.margin || p.y > b.h + b.margin) return true;
    if (p.y >= b.poolY) return true;
    return false;
  }
```

Add `isDead` to the `return` object's first line:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, SPOUTS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `27 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: isDead — retire droplets off-screen / expired / pooled"
```

---

## Task 6: `spoutToScreen` (spout fraction → pixel position)

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

Insert before the summary line in `helpers.test.js`:

```js
// --- spoutToScreen: fraction within imgBox -> absolute px ---
const IB = { left: 100, top: 50, width: 200, height: 400 };
eq('spoutToScreen center', H.spoutToScreen({ x: 0.5, y: 0.5 }, IB), { x: 200, y: 250 });
eq('spoutToScreen top-left', H.spoutToScreen({ x: 0, y: 0 }, IB), { x: 100, y: 50 });
eq('spoutToScreen bottom-right', H.spoutToScreen({ x: 1, y: 1 }, IB), { x: 300, y: 450 });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.spoutToScreen is not a function`.

- [ ] **Step 3: Implement `spoutToScreen`**

Add after `isDead` in `helpers.js`:

```js
  // Map a spout's fractional position to absolute screen px within the image box.
  function spoutToScreen(spout, imgBox) {
    return {
      x: imgBox.left + spout.x * imgBox.width,
      y: imgBox.top + spout.y * imgBox.height,
    };
  }
```

Add `spoutToScreen` to the `return` object's first line:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, SPOUTS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `30 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: spoutToScreen — map spout fractions to pixels"
```

---

## Task 7: Page scaffold (assets + HTML + CSS)

No unit tests — this is markup/layout, verified visually. The placeholder photo still has its own background (sky/people), so the page will show the photo rectangle on black, NOT the final black-bg look. That's expected; the real transparent cutout replaces it later.

**Files:**
- Create: `Guac Off 2026/fountain/assets/fountain-placeholder.png` (copied)
- Create: `Guac Off 2026/fountain/index.html`
- Create: `Guac Off 2026/fountain/index.css`

- [ ] **Step 1: Copy the placeholder image**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
mkdir -p "Guac Off 2026/fountain/assets"
cp "/Users/christopherbunting/Downloads/Vaillancourt_Fountain_no_background (1).png" \
   "Guac Off 2026/fountain/assets/fountain-placeholder.png"
ls -la "Guac Off 2026/fountain/assets/"
```
Expected: `fountain-placeholder.png` listed (~1.2 MB). If the source file is gone, ask the user for any fountain image and save it to that path.

- [ ] **Step 2: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛲</text></svg>">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Tilt the Fountain · SF GUAC OFF 2026</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <img class="fountain" src="assets/fountain-placeholder.png" alt="Vaillancourt Fountain">
  <canvas id="water"></canvas>

  <div id="hint" class="hint" aria-hidden="true"></div>

  <div id="cover" class="overlay cover" aria-hidden="false">
    <button id="play-btn" class="play-btn" type="button">⛲ Tap to start</button>
    <p id="cover-sub" class="cover-sub">Tilt your phone to pour the water</p>
  </div>

  <script src="helpers.js"></script>
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
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
  touch-action: none;
  overflow: hidden;
}

/* Fountain image: contained, centered; element box == visible image (uniform scale),
   so spout fractions map correctly. Kept grayish per the design. */
.fountain {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  max-width: 96vw;
  max-height: 96vh;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
  filter: grayscale(0.15) brightness(0.95);
}

/* Transparent water layer on top of the fountain */
#water {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}

/* Auto-fading hint toast */
.hint {
  position: absolute;
  left: 50%; bottom: 6vh;
  transform: translateX(-50%) translateY(8px);
  max-width: 80vw;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #eaf4ff;
  font-size: 0.95rem;
  text-align: center;
  opacity: 0;
  transition: opacity 400ms ease, transform 400ms ease;
  pointer-events: none;
  z-index: 5;
}
.hint.show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* Cover / overlay (same pattern as tilt/) */
.overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 1.25rem; padding: 2rem; text-align: center;
  z-index: 10;
}
.overlay[hidden] { display: none; }
.cover { background: rgba(0, 0, 0, 0.35); }
.play-btn {
  font: inherit; font-size: 1.35rem; font-weight: 700; letter-spacing: 0.02em;
  color: #eaf4ff;
  background: rgba(10, 20, 30, 0.85);
  border: 1.5px solid #5cc8ff;
  border-radius: 999px;
  padding: 1rem 1.75rem;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(92, 200, 255, 0.35);
}
.play-btn:active { transform: translateY(1px); }
.cover-sub {
  margin: 0; font-size: 1rem; color: #cfe6ff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  max-width: 18rem; line-height: 1.4;
}
```

- [ ] **Step 4: Verify visually**

Run: `cd "Guac Off 2026" && python3 -m http.server 8080 --bind 0.0.0.0`
Open `http://localhost:8080/fountain/`.
Expected: black page, the fountain photo centered, a "⛲ Tap to start" button with subtitle. No console errors. (Water/tilt not wired yet — clicking does nothing.) Stop the server with Ctrl+C when done.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/assets/fountain-placeholder.png" \
        "Guac Off 2026/fountain/index.html" "Guac Off 2026/fountain/index.css"
git commit -m "fountain: page scaffold — black bg, fountain image, cover screen"
```

---

## Task 8: index.js — the water engine

The core: permission flow (reused from `tilt/`), layout, particle pool, emission, integration, streak rendering. Verified by observation (water pours; tilt steers on device).

**Files:**
- Create: `Guac Off 2026/fountain/index.js`

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

// Water-pour interaction for the Vaillancourt Fountain.
// Tilt the phone to steer gravity; droplets pour from each spout and fall.
(function () {
  const H = window.FountainHelpers;
  const C = H.constants;
  const SPOUTS = H.SPOUTS;

  // --- DOM ---
  const fountainImg = document.querySelector('.fountain');
  const canvas = document.getElementById('water');
  const ctx = canvas.getContext('2d');
  const coverEl = document.getElementById('cover');
  const coverSub = document.getElementById('cover-sub');
  const playBtn = document.getElementById('play-btn');
  const hintEl = document.getElementById('hint');

  // --- Layout (recomputed on start + resize) ---
  let DPR = 1, VW = 0, VH = 0, poolY = 0;
  let imgBox = { left: 0, top: 0, width: 0, height: 0 };

  function computeLayout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    VW = window.innerWidth;
    VH = window.innerHeight;
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    canvas.style.width = VW + 'px';
    canvas.style.height = VH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // draw in CSS pixels
    const r = fountainImg.getBoundingClientRect();
    imgBox = { left: r.left, top: r.top, width: r.width, height: r.height };
    poolY = VH * C.POOL_FRAC;
  }

  // --- Particle pool (fixed size, recycled via a free-index stack) ---
  const N = C.MAX_PARTICLES;
  const pool = new Array(N);
  for (let i = 0; i < N; i++) pool[i] = { x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, life: 0 };
  const free = [];
  for (let i = N - 1; i >= 0; i--) free.push(i);
  const active = [];

  function spawn(x, y, vx, vy) {
    if (free.length === 0) return;
    const i = free.pop();
    const p = pool[i];
    p.x = x; p.y = y; p.px = x; p.py = y;
    p.vx = vx; p.vy = vy; p.life = C.PARTICLE_LIFE;
    active.push(i);
  }

  // --- Tilt input (default upright so water falls before the first event) ---
  let smoothBeta = 90, smoothGamma = 0, tiltActive = false;
  function onOrientation(e) {
    tiltActive = true;
    const beta = e.beta || 0;
    const gamma = e.gamma || 0;
    smoothBeta = smoothBeta * 0.85 + beta * 0.15;
    smoothGamma = smoothGamma * 0.85 + gamma * 0.15;
  }

  // --- Per-spout emission accumulators ---
  const acc = SPOUTS.map(function () { return 0; });

  // --- Render loop ---
  let last = 0;
  const bounds = { w: 0, h: 0, margin: 60, poolY: 0 };

  function tick(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;   // clamp big steps after backgrounding

    const g = H.gravityPx(smoothBeta, smoothGamma);

    // Emit from each spout (framerate-independent via the accumulator)
    for (let s = 0; s < SPOUTS.length; s++) {
      const sp = SPOUTS[s];
      const rate = sp.rate || C.EMIT_RATE;
      const spread = (sp.spread != null) ? sp.spread : C.SPREAD;
      const speed = sp.speed || C.INIT_SPEED;
      acc[s] += rate * dt;
      const scr = H.spoutToScreen(sp, imgBox);
      while (acc[s] >= 1) {
        acc[s] -= 1;
        if (free.length === 0) { acc[s] = 0; break; }
        const v = H.spawnVelocity(sp.dir, spread, speed, Math.random());
        spawn(scr.x, scr.y, v.vx, v.vy);
      }
    }

    // Integrate + cull (swap-remove dead from active)
    bounds.w = VW; bounds.h = VH; bounds.poolY = poolY;
    for (let k = active.length - 1; k >= 0; k--) {
      const i = active[k];
      const p = pool[i];
      H.integrate(p, g.x, g.y, dt, C.DRAG);
      if (H.isDead(p, bounds)) {
        active[k] = active[active.length - 1];
        active.pop();
        free.push(i);
      }
    }

    // Draw streaks (one batched path)
    ctx.clearRect(0, 0, VW, VH);
    ctx.strokeStyle = 'rgba(' + C.WATER_RGB + ', ' + C.STREAK_ALPHA + ')';
    ctx.lineWidth = C.LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < active.length; k++) {
      const p = pool[active[k]];
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    requestAnimationFrame(tick);
  }

  // --- iOS 13+ motion permission (reused discipline from tilt/) ---
  async function requestMotionPermission() {
    const need = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (!need) return 'granted';   // non-iOS browsers fire events freely
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      return r === 'granted' ? 'granted' : 'denied';
    } catch (e) { return 'denied'; }
  }

  function showHint(text) {
    hintEl.textContent = text;
    hintEl.classList.add('show');
    setTimeout(function () { hintEl.classList.remove('show'); }, 3200);
  }

  function start() {
    coverEl.hidden = true;
    coverEl.setAttribute('aria-hidden', 'true');
    computeLayout();
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('resize', computeLayout);
    window.addEventListener('orientationchange', function () { setTimeout(computeLayout, 200); });
    last = performance.now();
    requestAnimationFrame(tick);
    // After a beat, tailor the hint to whether real tilt is arriving.
    setTimeout(function () {
      showHint(tiltActive
        ? 'Tilt your phone to steer the water 💧'
        : 'Motion is off — water falls straight down 💧');
    }, 1200);
  }

  playBtn.addEventListener('click', async function () {
    // First await MUST be the permission request to stay inside the gesture frame.
    await requestMotionPermission();
    start();
  });
})();
```

- [ ] **Step 2: Verify on desktop (water pours down)**

Run: `cd "Guac Off 2026" && python3 -m http.server 8080 --bind 0.0.0.0`
Open `http://localhost:8080/fountain/`, click "Tap to start".
Expected: streams of light-blue droplets fall straight down from ~5 points on the fountain; after ~1s the hint reads "Motion is off…". No console errors. Smooth (no stutter). Ctrl+C to stop.

- [ ] **Step 3: Verify on a phone (tilt steers) — REQUIRED**

Serve over HTTPS (see "Device test" in Conventions) and open `/fountain/` on an iPhone. Tap start, allow motion.
Expected: water pours from the spouts; tilting the phone left/right/back visibly bends the streams in that direction. Note the actual tilt→flow mapping for Task 9 calibration (it may be mirrored).

- [ ] **Step 4: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/index.js"
git commit -m "fountain: water engine — tilt-driven particle streams"
```

---

## Task 9: Polish & on-device calibration

Pool shimmer, calibrate the tilt-direction sign, and tune the dials by feel.

**Files:**
- Modify: `Guac Off 2026/fountain/index.js`
- Modify: `Guac Off 2026/fountain/helpers.js` (only if calibration/tuning requires it)

- [ ] **Step 1: Add a pool shimmer band**

In `index.js`, inside `tick`, immediately AFTER `ctx.clearRect(0, 0, VW, VH);` and BEFORE setting `ctx.strokeStyle`, insert:

```js
    // Faint pool shimmer at the bottom
    const grad = ctx.createLinearGradient(0, poolY, 0, VH);
    grad.addColorStop(0, 'rgba(' + C.WATER_RGB + ', 0.04)');
    grad.addColorStop(1, 'rgba(' + C.WATER_RGB + ', 0.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, poolY, VW, VH - poolY);
```

- [ ] **Step 2: Calibrate the tilt-direction sign (on device)**

Re-test on the phone. If tilting LEFT makes water pour RIGHT (or vice-versa for front/back), flip the offending axis in `onOrientation`. Apply ONLY the change that matches the observed mirroring:

- Mirrored left/right → change `const gamma = e.gamma || 0;` to `const gamma = -(e.gamma || 0);`
- Mirrored front/back → change `const beta = e.beta || 0;` to `const beta = -(e.beta || 0);`

If the mapping already feels correct, make no change. Document the decision in a one-line code comment above the changed (or unchanged) lines, e.g. `// gamma sign verified on iPhone 2026-06-06: tilt-left pours left`.

- [ ] **Step 3: Tune the dials by feel (on device)**

Adjust constants in `helpers.js` until it feels good (re-test after each change; unit tests still pass because they assert on relationships, not feel — but re-run them anyway):
- Too sparse/dense → `EMIT_RATE`
- Streams too weak/violent off the spout → `INIT_SPEED`
- Reacts too gently/aggressively to tilt → `GRAVITY_SCALE`
- Streams too narrow/fan too wide → `SPREAD`
- Water too dim/bright → `STREAK_ALPHA`, `LINE_WIDTH`, `WATER_RGB`

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: still `30 passed, 0 failed` (update the `GRAVITY_SCALE` expectations in the gravityPx test if and only if you changed `GRAVITY_SCALE`).

- [ ] **Step 4: Final visual verification**

Confirm on device: smooth 60fps, water steers correctly, pool shimmer reads, hint appears. Confirm on desktop: pours straight down, no errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/index.js" "Guac Off 2026/fountain/helpers.js"
git commit -m "fountain: pool shimmer, tilt calibration, tuned dials"
```

---

## Task 10: Final verification & spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-06-06-fountain-tilt-pour-design.md`

- [ ] **Step 1: Full test run**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: `30 passed, 0 failed` (or higher if dials changed test counts).

- [ ] **Step 2: Confirm no stray iCloud conflicted copies**

Run: `cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off" && git status --porcelain && ls "Guac Off 2026/fountain/" | grep -E " 2\\.| 2$" || echo "no conflicted copies"`
Expected: clean tree, "no conflicted copies".

- [ ] **Step 3: Mark the spec done**

In `docs/superpowers/specs/2026-06-06-fountain-tilt-pour-design.md`, change the `**Status:**` line to:
`- **Status:** Implemented (v1) — pending final art swap`

- [ ] **Step 4: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "vaillancourt_fountain" ] || { echo "WRONG BRANCH"; exit 1; }
git add "docs/superpowers/specs/2026-06-06-fountain-tilt-pour-design.md"
git commit -m "fountain: mark v1 implemented (pending final art)"
```

---

## Art swap-in (after the real cutout + reference arrive)

Not a numbered task (depends on user-provided art). When the high-quality transparent cutout + "where water falls" reference land:

1. Save the cutout to `Guac Off 2026/fountain/assets/fountain.png` and update the `<img src>` in `index.html`.
2. Measure each spout on the new image and update `SPOUTS` in `helpers.js` (x/y fractions + `dir` facing). The numbered-overlay confirmation loop (agreed during brainstorming) happens here.
3. Re-test on device; the tuned dials should carry over. Commit `fountain: swap in final art + real spout positions`.

---

## Self-review notes (for the implementer)

- **Spec coverage:** page structure (T7), reuse of permission/cover flow (T8), canvas particle streams + gravity-from-tilt (T8), spouts-as-fractions (T1 data, T6 mapping), pool/death (T5, T9), perf cap + pooling + DPR (T8), streak rendering (T8), the dials in one constants block (T1), pure helpers + node tests (T1–T6), placeholder + swap-in (T7 + Art swap section), calibration of the two flagged ambiguities (T9). Sandbox-only / no-goal / no-collision are honored by omission.
- **No new identifiers are referenced before they're defined:** `helpers.js` exports `clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, SPOUTS, constants`; `index.js` consumes exactly those plus `constants.{TILT_FULL_DEG, STRENGTH, GRAVITY_SCALE, EMIT_RATE, INIT_SPEED, SPREAD, PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, STREAK_ALPHA, LINE_WIDTH}`.
