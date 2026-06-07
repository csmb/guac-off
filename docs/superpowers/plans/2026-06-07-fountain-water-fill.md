# Fountain Water-Fill (Accumulating Pool) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fountain's falling water accumulate into a rising pool whose surface stays level to gravity (sloshes with tilt), fills the screen, and drains on tap.

**Architecture:** Four new pure geometry helpers in `helpers.js` (unit-tested) describe the pool surface as a half-plane perpendicular to the gravity vector. `index.js` absorbs submerged droplets into a `poolVol` counter, eases a smoothed surface normal for slosh, and paints the clipped pool polygon (translucent gradient + waterline) over the fountain. Tap drains.

**Tech Stack:** Vanilla JS (ES5-style IIFE), Canvas 2D, `DeviceOrientationEvent`. No build step. Tests run with `node`. Builds on the shipped `/fountain/` v1.

---

## Conventions for this plan

- **Repo root:** `/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off`. All paths/`cd` are from there.
- **Branch:** all work on `fountain-water-fill`. Confirm `git branch --show-current` prints `fountain-water-fill` before EVERY commit (shared working dir).
- **Run unit tests:** `node "Guac Off 2026/fountain/helpers.test.js"`
- **Syntax-check the engine:** `node --check "Guac Off 2026/fountain/index.js"`
- **Dev server:** `python3 -m http.server 8080 --bind 0.0.0.0 --directory "Guac Off 2026"`, open `http://localhost:8080/fountain/`.
- **Device behavior (slosh feel, drain, tilt) is verified in prod by the user** — same stance as v1. Automated checks here are: unit tests, syntax check, page serves.
- **Commits:** prefix `fountain:`. No `Co-Authored-By` trailers.

---

## Task 1: New constants + `gravityDir` helper

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

In `helpers.test.js`, insert before the final `console.log(...)` summary line:

```js
// --- gravityDir: unit "down" vector from a gravity vector; flat -> screen-down ---
eq('gravityDir down', H.gravityDir({ x: 0, y: 1600 }), { x: 0, y: 1 });
eq('gravityDir flat -> fallback down', H.gravityDir({ x: 0, y: 0 }), { x: 0, y: 1 });
eq('gravityDir 3-4-5', H.gravityDir({ x: 3, y: 4 }), { x: 0.6, y: 0.8 });
eq('gravityDir left', H.gravityDir({ x: -1000, y: 0 }), { x: -1, y: 0 });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.gravityDir is not a function`.

- [ ] **Step 3: Add the constants and the helper**

In `helpers.js`, in the constants block, add these lines immediately after `const CULL_MARGIN    = 60;     // px beyond the viewport before a droplet is retired`:

```js
  const POOL_CAPACITY  = 5000;   // absorbed droplets to fill the screen (tune for feel)
  const POOL_ALPHA     = 0.5;    // pool body opacity (deep end of the gradient)
  const DRAIN_TIME     = 0.8;    // seconds to fully drain on tap
  const SURFACE_SMOOTH = 0.06;   // per-frame easing of the surface normal (slosh lag)
  const GRAVITY_EPS    = 1e-3;   // |g| below this = treat the phone as flat
```

Add the helper, immediately after the `spoutToScreen` function:

```js
  // Unit "down" vector from a gravity vector; falls back to screen-down when flat.
  function gravityDir(g) {
    const m = Math.hypot(g.x, g.y);
    if (m < GRAVITY_EPS) return { x: 0, y: 1 };
    return { x: g.x / m, y: g.y / m };
  }
```

Update the exports. Change the first returned line from:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, SPOUTS,
```

to:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, gravityDir, SPOUTS,
```

And add the new constants to the `constants` object — change:

```js
      PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, STREAK_ALPHA, LINE_WIDTH, CULL_MARGIN,
```

to:

```js
      PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, STREAK_ALPHA, LINE_WIDTH, CULL_MARGIN,
      POOL_CAPACITY, POOL_ALPHA, DRAIN_TIME, SURFACE_SMOOTH, GRAVITY_EPS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `34 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "fountain-water-fill" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: pool constants + gravityDir helper"
```

---

## Task 2: `surfaceLevel` helper

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

Insert before the summary line in `helpers.test.js`:

```js
// --- surfaceLevel: projection value of the pool surface for a fill fraction ---
eq('surfaceLevel empty', H.surfaceLevel({ x: 0, y: 1 }, 100, 200, 0), 200);
eq('surfaceLevel full',  H.surfaceLevel({ x: 0, y: 1 }, 100, 200, 1), 0);
eq('surfaceLevel half',  H.surfaceLevel({ x: 0, y: 1 }, 100, 200, 0.5), 100);
eq('surfaceLevel tilted half', H.surfaceLevel({ x: 0.6, y: 0.8 }, 100, 200, 0.5), 110);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.surfaceLevel is not a function`.

- [ ] **Step 3: Implement `surfaceLevel`**

Add after `gravityDir` in `helpers.js`:

```js
  // Projection value (along dir) of the pool surface. fillFrac 0 = empty (surface at
  // the deepest screen extent), 1 = full (surface past the shallowest extent).
  function surfaceLevel(dir, w, h, fillFrac) {
    const p0 = 0 * dir.x + 0 * dir.y;
    const p1 = w * dir.x + 0 * dir.y;
    const p2 = 0 * dir.x + h * dir.y;
    const p3 = w * dir.x + h * dir.y;
    const lo = Math.min(p0, p1, p2, p3);
    const hi = Math.max(p0, p1, p2, p3);
    return hi - fillFrac * (hi - lo);
  }
```

Add `surfaceLevel` to the exports' first returned line:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, gravityDir, surfaceLevel, SPOUTS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `38 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "fountain-water-fill" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: surfaceLevel — pool surface projection from fill fraction"
```

---

## Task 3: `isSubmerged` helper

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

Insert before the summary line in `helpers.test.js`:

```js
// --- isSubmerged: point is below the surface (projection along dir >= level) ---
eq('isSubmerged below horiz', H.isSubmerged({ x: 50, y: 150 }, { x: 0, y: 1 }, 100), true);
eq('isSubmerged above horiz', H.isSubmerged({ x: 50, y: 50 }, { x: 0, y: 1 }, 100), false);
eq('isSubmerged at surface (>=)', H.isSubmerged({ x: 50, y: 100 }, { x: 0, y: 1 }, 100), true);
eq('isSubmerged tilted in',  H.isSubmerged({ x: 10, y: 10 }, { x: 0.6, y: 0.8 }, 10), true);  // proj=14
eq('isSubmerged tilted out', H.isSubmerged({ x: 10, y: 10 }, { x: 0.6, y: 0.8 }, 20), false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.isSubmerged is not a function`.

- [ ] **Step 3: Implement `isSubmerged`**

Add after `surfaceLevel` in `helpers.js`:

```js
  // True when a point lies below the pool surface (deeper along dir than level).
  function isSubmerged(p, dir, level) {
    return p.x * dir.x + p.y * dir.y >= level;
  }
```

Add `isSubmerged` to the exports' first returned line:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, gravityDir, surfaceLevel, isSubmerged, SPOUTS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `43 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "fountain-water-fill" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: isSubmerged — droplet-below-surface test"
```

---

## Task 4: `clipRectBelow` helper

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js`
- Test: `Guac Off 2026/fountain/helpers.test.js`

- [ ] **Step 1: Add the failing tests**

Insert before the summary line in `helpers.test.js`:

```js
// --- clipRectBelow: screen-rect polygon on the submerged side of the surface ---
eq('clipRectBelow half (bottom rect)',
   H.clipRectBelow(100, 200, { x: 0, y: 1 }, 100),
   [{ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 100 }]);
eq('clipRectBelow full (whole rect)',
   H.clipRectBelow(100, 200, { x: 0, y: 1 }, 0),
   [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }]);
eq('clipRectBelow empty', H.clipRectBelow(100, 200, { x: 0, y: 1 }, 250), []);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: FAIL — `H.clipRectBelow is not a function`.

- [ ] **Step 3: Implement `clipRectBelow`**

Add after `isSubmerged` in `helpers.js`:

```js
  // Sutherland–Hodgman clip of the screen rectangle by the half-plane
  // { p : p·dir >= level }. Returns the pool polygon's vertices in order
  // ([] when nothing is submerged).
  function clipRectBelow(w, h, dir, level) {
    const poly = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i];
      const B = poly[(i + 1) % poly.length];
      const pa = (A.x * dir.x + A.y * dir.y) - level;
      const pb = (B.x * dir.x + B.y * dir.y) - level;
      const inA = pa >= 0;
      const inB = pb >= 0;
      if (inA) out.push(A);
      if (inA !== inB) {
        const t = pa / (pa - pb);
        out.push({ x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) });
      }
    }
    return out;
  }
```

Add `clipRectBelow` to the exports' first returned line:

```js
    clamp, tiltToGravity, gravityPx, spawnVelocity, integrate, isDead, spoutToScreen, gravityDir, surfaceLevel, isSubmerged, clipRectBelow, SPOUTS,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/fountain/helpers.test.js"`
Expected: PASS — `46 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "fountain-water-fill" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/helpers.test.js"
git commit -m "fountain: clipRectBelow — pool polygon via half-plane clip"
```

---

## Task 5: Integrate the pool into `index.js`

Replace the v1 static shimmer band with the accumulating, sloshing, drainable pool. Also remove the now-unused `POOL_FRAC` constant.

**Files:**
- Modify: `Guac Off 2026/fountain/helpers.js` (remove `POOL_FRAC`)
- Modify: `Guac Off 2026/fountain/index.js` (full replace)

- [ ] **Step 1: Remove the unused `POOL_FRAC` constant from `helpers.js`**

Delete this line from the constants block:

```js
  const POOL_FRAC      = 0.92;   // pool line at this fraction of viewport height
```

And remove `POOL_FRAC,` from the `constants` export object (the line currently reads `PARTICLE_LIFE, DRAG, MAX_PARTICLES, POOL_FRAC, WATER_RGB, ...` — drop just `POOL_FRAC,`), so it becomes:

```js
      PARTICLE_LIFE, DRAG, MAX_PARTICLES, WATER_RGB, STREAK_ALPHA, LINE_WIDTH, CULL_MARGIN,
      POOL_CAPACITY, POOL_ALPHA, DRAIN_TIME, SURFACE_SMOOTH, GRAVITY_EPS,
```

- [ ] **Step 2: Replace `index.js` entirely**

Overwrite `Guac Off 2026/fountain/index.js` with:

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
// Tilt the phone to steer gravity; droplets pour from each spout, fall, and
// collect into a rising pool whose surface stays level to gravity. Tap to drain.
(function () {
  const H = window.FountainHelpers;
  const C = H.constants;
  const SPOUTS = H.SPOUTS;
  const STROKE_STYLE   = 'rgba(' + C.WATER_RGB + ', ' + C.STREAK_ALPHA + ')';      // streaks (invariant)
  const POOL_BODY_TOP  = 'rgba(' + C.WATER_RGB + ', ' + (C.POOL_ALPHA * 0.55) + ')';
  const POOL_BODY_DEEP = 'rgba(' + C.WATER_RGB + ', ' + C.POOL_ALPHA + ')';
  const SURFACE_STYLE  = 'rgba(' + C.WATER_RGB + ', 0.85)';

  // --- DOM ---
  const fountainImg = document.querySelector('.fountain');
  const canvas = document.getElementById('water');
  const ctx = canvas.getContext('2d');
  const coverEl = document.getElementById('cover');
  const playBtn = document.getElementById('play-btn');
  const hintEl = document.getElementById('hint');

  // --- Layout (recomputed on start + resize) ---
  let DPR = 1, VW = 0, VH = 0;
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
    // gamma = left/right roll, beta = front/back pitch. The mapping is verified by
    // math but NOT yet on a device: tilt-left should pour water left. If it reads
    // mirrored in prod, negate the offending axis here, e.g.:
    //   const gamma = -(e.gamma || 0);   // flip if left/right is reversed
    const beta = e.beta || 0;
    const gamma = e.gamma || 0;
    smoothBeta = smoothBeta * 0.85 + beta * 0.15;
    smoothGamma = smoothGamma * 0.85 + gamma * 0.15;
  }

  // --- Pool state ---
  let poolVol = 0;                 // absorbed droplet count
  let draining = false;            // tap-to-drain in progress
  const surfDir = { x: 0, y: 1 };  // smoothed surface normal ("down"), eased for slosh

  // --- Per-spout emission accumulators ---
  const acc = SPOUTS.map(function () { return 0; });

  // --- Render loop ---
  let last = 0;
  const bounds = { w: 0, h: 0, margin: C.CULL_MARGIN, poolY: Infinity };  // pool handled separately

  function tick(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;   // clamp big steps after backgrounding

    const g = H.gravityPx(smoothBeta, smoothGamma);

    // Ease the surface normal toward gravity (slosh lag), then renormalize.
    const gd = H.gravityDir(g);
    surfDir.x += (gd.x - surfDir.x) * C.SURFACE_SMOOTH;
    surfDir.y += (gd.y - surfDir.y) * C.SURFACE_SMOOTH;
    const sm = Math.hypot(surfDir.x, surfDir.y) || 1;
    surfDir.x /= sm; surfDir.y /= sm;

    // Drain, then derive the current fill level.
    if (draining) {
      poolVol -= (C.POOL_CAPACITY / C.DRAIN_TIME) * dt;
      if (poolVol <= 0) { poolVol = 0; draining = false; }
    }
    const fillFrac = Math.min(poolVol / C.POOL_CAPACITY, 1);
    const level = H.surfaceLevel(surfDir, VW, VH, fillFrac);

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

    // Integrate; absorb submerged droplets into the pool, else cull off-screen/expired.
    bounds.w = VW; bounds.h = VH;
    for (let k = active.length - 1; k >= 0; k--) {
      const i = active[k];
      const p = pool[i];
      H.integrate(p, g.x, g.y, dt, C.DRAG);
      let gone = false;
      if (!draining && H.isSubmerged(p, surfDir, level)) {
        if (fillFrac < 1) poolVol++;
        gone = true;
      } else if (H.isDead(p, bounds)) {
        gone = true;
      }
      if (gone) {
        active[k] = active[active.length - 1];
        active.pop();
        free.push(i);
      }
    }

    // --- Draw ---
    ctx.clearRect(0, 0, VW, VH);

    // Streaks first, so they dim into the pool.
    ctx.strokeStyle = STROKE_STYLE;
    ctx.lineWidth = C.LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < active.length; k++) {
      const p = pool[active[k]];
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Pool body + waterline, over the fountain so it submerges as it fills.
    if (fillFrac > 0) {
      const poly = H.clipRectBelow(VW, VH, surfDir, level);
      if (poly.length >= 3) {
        // Depth gradient along the surface normal: lighter at the waterline, deeper below.
        const cdot = (VW / 2) * surfDir.x + (VH / 2) * surfDir.y;
        const maxProj = H.surfaceLevel(surfDir, VW, VH, 0);   // deepest projection
        const sx = VW / 2 + surfDir.x * (level - cdot);
        const sy = VH / 2 + surfDir.y * (level - cdot);
        const dx = VW / 2 + surfDir.x * (maxProj - cdot);
        const dy = VH / 2 + surfDir.y * (maxProj - cdot);
        const grad = ctx.createLinearGradient(sx, sy, dx, dy);
        grad.addColorStop(0, POOL_BODY_TOP);
        grad.addColorStop(1, POOL_BODY_DEEP);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let v = 1; v < poly.length; v++) ctx.lineTo(poly[v].x, poly[v].y);
        ctx.closePath();
        ctx.fill();

        // Waterline: stroke only the surface edge (skip edges lying on a screen border).
        ctx.strokeStyle = SURFACE_STYLE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let v = 0; v < poly.length; v++) {
          const A = poly[v], B = poly[(v + 1) % poly.length];
          const onBorder =
            (A.x < 0.5 && B.x < 0.5) ||
            (A.x > VW - 0.5 && B.x > VW - 0.5) ||
            (A.y < 0.5 && B.y < 0.5) ||
            (A.y > VH - 0.5 && B.y > VH - 0.5);
          if (!onBorder) { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
        }
        ctx.stroke();
      }
    }

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
    hintEl.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      hintEl.classList.remove('show');
      hintEl.setAttribute('aria-hidden', 'true');
    }, 3200);
  }

  function start() {
    coverEl.hidden = true;
    coverEl.setAttribute('aria-hidden', 'true');
    computeLayout();
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('resize', computeLayout);
    window.addEventListener('orientationchange', function () { setTimeout(computeLayout, 200); });
    if (!fountainImg.complete) fountainImg.addEventListener('load', computeLayout);
    // Tap anywhere to drain the pool.
    window.addEventListener('pointerdown', function () { if (poolVol > 0) draining = true; });
    last = performance.now();
    requestAnimationFrame(tick);
    setTimeout(function () {
      showHint(tiltActive
        ? 'Tilt to steer · tap to drain 💧'
        : 'Motion is off — water falls straight down · tap to drain 💧');
    }, 1200);
  }

  playBtn.addEventListener('click', async function () {
    // First await MUST be the permission request to stay inside the gesture frame.
    await requestMotionPermission();
    start();
  });
})();
```

- [ ] **Step 3: Verify (automated)**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
node --check "Guac Off 2026/fountain/index.js" && echo "syntax OK"
node "Guac Off 2026/fountain/helpers.test.js"          # expect 46 passed, 0 failed
grep -c "POOL_FRAC" "Guac Off 2026/fountain/helpers.js" "Guac Off 2026/fountain/index.js"  # expect 0 in both
```
Expected: syntax OK; `46 passed, 0 failed`; `POOL_FRAC` count `0` in both files.

- [ ] **Step 4: Verify (serves)**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off/Guac Off 2026"
python3 -m http.server 8087 --bind 127.0.0.1 &
SRV=$!; sleep 1
curl -s -o /dev/null -w "page %{http_code}\n" http://localhost:8087/fountain/
curl -s -o /dev/null -w "js %{http_code}\n" http://localhost:8087/fountain/index.js
kill $SRV
```
Expected: `page 200`, `js 200`. (Slosh/drain/tilt feel is verified in prod by the user, per Conventions.)

- [ ] **Step 5: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "fountain-water-fill" ] || { echo "WRONG BRANCH"; exit 1; }
git add "Guac Off 2026/fountain/index.js" "Guac Off 2026/fountain/helpers.js"
git commit -m "fountain: accumulating tilt-aware pool — absorb, slosh, render, tap-to-drain"
```

---

## Task 6: Final verification & spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-06-07-fountain-water-fill-design.md`

- [ ] **Step 1: Full test + syntax run**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
node "Guac Off 2026/fountain/helpers.test.js"      # expect 46 passed, 0 failed
node --check "Guac Off 2026/fountain/index.js" && echo OK
```

- [ ] **Step 2: Conflicted-copy sweep (iCloud hazard)**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
found=$(find "Guac Off 2026/fountain" docs -name "* 2.*" 2>/dev/null); [ -n "$found" ] && echo "FOUND: $found" || echo "none"
git status --porcelain
```
Expected: `none`; clean tree (after the Task 5 commit).

- [ ] **Step 3: Mark the spec implemented**

In `docs/superpowers/specs/2026-06-07-fountain-water-fill-design.md`, change the `**Status:**` line to:
`- **Status:** Implemented on \`fountain-water-fill\` — slosh/drain feel verified in prod (per v1 stance).`

- [ ] **Step 4: Commit**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
[ "$(git branch --show-current)" = "fountain-water-fill" ] || { echo "WRONG BRANCH"; exit 1; }
git add "docs/superpowers/specs/2026-06-07-fountain-water-fill-design.md"
git commit -m "fountain: mark water-fill spec implemented"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** absorb-into-rising-pool (T5 loop + T3 `isSubmerged`), `fillFrac`/`POOL_CAPACITY` (T1 const, T5), surface perpendicular to gravity + slosh lag (T1 `gravityDir`, T2 `surfaceLevel`, `SURFACE_SMOOTH`, T5 easing), pool polygon (T4 `clipRectBelow`), render order streaks→body→waterline (T5), submerge-the-fountain (canvas over img, unchanged), tap-to-drain (T5 `pointerdown` + `DRAIN_TIME`), remove v1 static band + `POOL_FRAC` (T5), flat-phone fallback (T1), full cap + mid-fill drain (T5). Tests for all four helpers (T1–T4).
- **Identifier consistency:** `helpers.js` exports `gravityDir, surfaceLevel, isSubmerged, clipRectBelow` + constants `POOL_CAPACITY, POOL_ALPHA, DRAIN_TIME, SURFACE_SMOOTH, GRAVITY_EPS`; `index.js` consumes exactly those plus the v1 set (minus the removed `POOL_FRAC`). `surfDir`/`poolVol`/`draining`/`fillFrac`/`level` are the only new locals.
- **Intentional per-frame alloc:** the pool gradient is rebuilt each frame because the surface moves; this is unavoidable (unlike v1's cached static band) and is one alloc/frame, not per-particle.
