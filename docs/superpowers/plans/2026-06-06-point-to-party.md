# Point Your Phone at the Party — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-only easter-egg page where the guest aims their phone at the real venue and a warmer/colder compass hunt unlocks the party address.

**Architecture:** A new self-contained `Guac Off 2026/find/` mini-app mirroring the existing `tilt/` structure. Pure math + obfuscation live in `find/helpers.js` (Node- and browser-loadable, unit-tested); `find/index.js` orchestrates permissions, sensors, the warmth/lock loop, reveal, and the hidden escape hatch. The risky orientation math is isolated and TDD'd against hand-verified oracles.

**Tech Stack:** Vanilla JS (no build step), Web APIs: `DeviceOrientationEvent` (+ iOS `webkitCompassHeading`), `navigator.geolocation`, Web Audio, `navigator.vibrate`, `localStorage`. Tests run under Node (`node helpers.test.js`) plus a browser parity harness.

---

## File Structure

```
Guac Off 2026/find/
  helpers.js        PURE functions: geo (bearing/haversine), angles, orientation→azimuth,
                    unit-circle smoothing, enc/dec, lock logic + constants. UMD-lite so it
                    loads in Node (require) and browser (window.FindHelpers).
  helpers.test.js   Node test runner for helpers.js (the TDD red/green loop).
  index.test.html   Browser parity harness (loads helpers.js, mirrors key asserts).
  index.html        cover → prime explainer → hunt stage → reveal card + escape hatch.
  index.css         dark theme (matches tilt), warmth glow, reveal + escape fade-in.
  index.js          orchestration: permission flow, geolocation, heading source selection,
                    iOS alpha-anchoring + declination, RAF warmth/lock loop, reveal, persist,
                    escape-hatch timing, error states. Self-contained audio (copied chime).
```

Modify: `Guac Off 2026/index.html` footer — add the `🧭 point your phone to the party` link.

**Conventions to match (from `tilt/`):** dark theme (`#0d0221` bg, `#39ff14` accent, `#f5e6c8` text), overlay pattern (`.overlay[hidden]{display:none}` + `aria-hidden`), `viewport` with `maximum-scale=1.0, user-scalable=no`, the 🥑 SVG favicon, audio initialized synchronously inside the user gesture, and `DeviceOrientationEvent.requestPermission()` as the **first await** in the gesture handler.

---

## Task 1: Scaffold `find/helpers.js` + geo math (bearing, haversine, near-venue)

**Files:**
- Create: `Guac Off 2026/find/helpers.js`
- Create: `Guac Off 2026/find/helpers.test.js`

- [ ] **Step 1: Create the helpers test runner with the first failing tests**

Create `Guac Off 2026/find/helpers.test.js`:

```js
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

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: FAIL — `Cannot find module './helpers.js'`.

- [ ] **Step 3: Create `find/helpers.js` with the UMD-lite wrapper and geo math**

Create `Guac Off 2026/find/helpers.js`:

```js
// Pure helpers for the point-to-party compass hunt.
// Loads in Node (module.exports) and the browser (window.FindHelpers).
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FindHelpers = api;
})(function () {
  'use strict';

  // --- tunable constants (single source of truth) ---
  const WARMTH_WINDOW_DEG = 45;   // diff at which warmth hits 0
  const LOCK_DEG = 12;            // within this many degrees counts as aligned
  const LOCK_HOLD_MS = 500;       // must hold alignment this long to lock
  const NEAR_VENUE_M = 120;       // within this distance, skip the hunt
  const ESCAPE_DELAY_MS = 12000;  // hidden escape hatch fades in after this
  const SMOOTH_FACTOR = 0.8;      // unit-circle low-pass (higher = smoother/slower)

  const R_EARTH_M = 6371000;
  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function bearing(from, to) {
    const f1 = toRad(from.lat), f2 = toRad(to.lat);
    const dL = toRad(to.lng - from.lng);
    const y = Math.sin(dL) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dL);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function haversineMeters(from, to) {
    const f1 = toRad(from.lat), f2 = toRad(to.lat);
    const dF = toRad(to.lat - from.lat), dL = toRad(to.lng - from.lng);
    const a = Math.sin(dF / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dL / 2) ** 2;
    return R_EARTH_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function isNearVenue(meters) { return meters < NEAR_VENUE_M; }

  return {
    bearing, haversineMeters, isNearVenue, clamp, toRad, toDeg,
    constants: { WARMTH_WINDOW_DEG, LOCK_DEG, LOCK_HOLD_MS, NEAR_VENUE_M, ESCAPE_DELAY_MS, SMOOTH_FACTOR },
  };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: PASS — `8 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/helpers.js" "Guac Off 2026/find/helpers.test.js"
git commit -m "find: geo math helpers (bearing, haversine, near-venue) + Node test runner"
```

---

## Task 2: Angle math (angleDiff, warmth)

**Files:**
- Modify: `Guac Off 2026/find/helpers.js`
- Modify: `Guac Off 2026/find/helpers.test.js`

- [ ] **Step 1: Add failing tests**

In `helpers.test.js`, add before the final `console.log`:

```js
// --- angleDiff: smallest absolute difference [0,180] ---
eq('angleDiff 350,10 -> 20', H.angleDiff(350, 10), 20, 0.001);
eq('angleDiff 10,350 -> 20', H.angleDiff(10, 350), 20, 0.001);
eq('angleDiff 12,0 -> 12', H.angleDiff(12, 0), 12, 0.001);
eq('angleDiff 0,180 -> 180', H.angleDiff(0, 180), 180, 0.001);

// --- warmth: 1 at aligned, 0 by WARMTH_WINDOW_DEG (45) ---
eq('warmth 0 -> 1', H.warmth(0), 1, 0.001);
eq('warmth 45 -> 0', H.warmth(45), 0, 0.001);
eq('warmth 90 -> 0 (clamped)', H.warmth(90), 0, 0.001);
eq('warmth 22.5 -> 0.5', H.warmth(22.5), 0.5, 0.001);
```

- [ ] **Step 2: Run to verify failure**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: FAIL — `H.angleDiff is not a function`.

- [ ] **Step 3: Implement**

In `helpers.js`, add after `isNearVenue`:

```js
  function angleDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function warmth(diff) {
    return clamp(1 - diff / WARMTH_WINDOW_DEG, 0, 1);
  }
```

And add `angleDiff, warmth,` to the returned object.

- [ ] **Step 4: Run to verify pass**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: PASS — `16 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/helpers.js" "Guac Off 2026/find/helpers.test.js"
git commit -m "find: angle helpers (angleDiff, warmth)"
```

---

## Task 3: Orientation → pointing azimuth (the risky math)

This converts `(alpha, beta, gamma)` into the compass azimuth the phone is **aiming**, using the device **camera axis (device −Z, out the back)** — the axis that stays horizontal and well-defined when the phone is held upright to aim. (Top-edge `[0,-1,0]` is the documented alternative: change `POINT_AXIS` to flip.)

**Files:**
- Modify: `Guac Off 2026/find/helpers.js`
- Modify: `Guac Off 2026/find/helpers.test.js`

- [ ] **Step 1: Add failing tests (hand-verified oracles)**

In `helpers.test.js`, add:

```js
// --- pointingAzimuth: camera axis (device -Z). Hand-verified cases. ---
// Phone tilted up 90deg (held upright, aiming); alpha rotates the aim around.
eq('aim alpha=0,beta=90 -> north(0)',   H.pointingAzimuth(0,   90, 0), 0,   0.01);
eq('aim alpha=90,beta=90 -> west(270)', H.pointingAzimuth(90,  90, 0), 270, 0.01);
eq('aim alpha=180,beta=90 -> south(180)', H.pointingAzimuth(180, 90, 0), 180, 0.01);
eq('aim alpha=270,beta=90 -> east(90)', H.pointingAzimuth(270, 90, 0), 90,  0.01);
// Tilting forward (beta=60) at alpha=0 still aims north.
eq('aim alpha=0,beta=60 -> north(0)',   H.pointingAzimuth(0,   60, 0), 0,   0.01);
```

- [ ] **Step 2: Run to verify failure**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: FAIL — `H.pointingAzimuth is not a function`.

- [ ] **Step 3: Implement**

In `helpers.js`, add after `warmth`:

```js
  // W3C DeviceOrientation ZXY rotation matrix (device -> world; world: X=east, Y=north, Z=up).
  function rotationMatrix(alphaDeg, betaDeg, gammaDeg) {
    const z = toRad(alphaDeg), x = toRad(betaDeg), y = toRad(gammaDeg);
    const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z);
    const sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    return [
      [cZ * cY - sZ * sX * sY, -cX * sZ, cZ * sY + cY * sZ * sX],
      [cY * sZ + cZ * sX * sY,  cZ * cX, sZ * sY - cZ * cY * sX],
      [-cX * sY,                sX,      cX * cY],
    ];
  }

  const POINT_AXIS = [0, 0, -1]; // device camera axis (out the back). Top-edge = [0,-1,0].

  function pointingAzimuth(alphaDeg, betaDeg, gammaDeg) {
    const m = rotationMatrix(alphaDeg, betaDeg, gammaDeg);
    const [ax, ay, az] = POINT_AXIS;
    // world vector = m * axis
    const east  = m[0][0] * ax + m[0][1] * ay + m[0][2] * az;
    const north = m[1][0] * ax + m[1][1] * ay + m[1][2] * az;
    return (toDeg(Math.atan2(east, north)) + 360) % 360;
  }
```

And add `rotationMatrix, pointingAzimuth,` to the returned object.

- [ ] **Step 4: Run to verify pass**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: PASS — `21 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/helpers.js" "Guac Off 2026/find/helpers.test.js"
git commit -m "find: orientation->pointing azimuth (camera axis) with hand-verified tests"
```

---

## Task 4: Unit-circle angle smoothing (no 0/360 seam flip)

**Files:**
- Modify: `Guac Off 2026/find/helpers.js`
- Modify: `Guac Off 2026/find/helpers.test.js`

- [ ] **Step 1: Add failing tests**

In `helpers.test.js`, add:

```js
// --- smoothing across the 0/360 seam ---
// Average of 358 and 2 must be ~0, never ~180.
const st = H.angleState(358);
const sm = H.smoothAngle(st, 2, 0.5);
eq('smoothAngle 358->2 ~ 0 (not 180)', ((sm.deg + 360) % 360), 0, 0.001);
// Smoothing toward a steady reading converges to it.
let s2 = H.angleState(0);
for (let i = 0; i < 50; i++) s2 = H.smoothAngle(s2, 90, 0.8);
eq('smoothAngle converges to steady 90', s2.deg, 90, 0.5);
```

- [ ] **Step 2: Run to verify failure**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: FAIL — `H.angleState is not a function`.

- [ ] **Step 3: Implement**

In `helpers.js`, add after `pointingAzimuth`:

```js
  function angleState(deg) {
    const r = toRad(deg);
    return { sin: Math.sin(r), cos: Math.cos(r), deg: (deg % 360 + 360) % 360 };
  }

  function smoothAngle(state, newDeg, factor) {
    const f = (factor == null) ? SMOOTH_FACTOR : factor;
    const r = toRad(newDeg);
    const sin = f * state.sin + (1 - f) * Math.sin(r);
    const cos = f * state.cos + (1 - f) * Math.cos(r);
    const deg = (toDeg(Math.atan2(sin, cos)) + 360) % 360;
    return { sin, cos, deg };
  }
```

And add `angleState, smoothAngle,` to the returned object.

- [ ] **Step 4: Run to verify pass**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: PASS — `23 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/helpers.js" "Guac Off 2026/find/helpers.test.js"
git commit -m "find: unit-circle angle smoothing"
```

---

## Task 5: Obfuscation (enc/dec) + lock logic

**Files:**
- Modify: `Guac Off 2026/find/helpers.js`
- Modify: `Guac Off 2026/find/helpers.test.js`

- [ ] **Step 1: Add failing tests**

In `helpers.test.js`, add:

```js
// --- enc/dec round-trip (light obfuscation, not crypto) ---
eq('dec(enc) round-trips', H.dec(H.enc('Dolores Park, SF')), 'Dolores Park, SF');
eq('enc output is not plaintext', H.enc('Dolores Park, SF').includes('Dolores'), false);

// --- shouldLock: aligned AND held long enough ---
eq('shouldLock aligned+held -> true', H.shouldLock(8, 600), true);
eq('shouldLock aligned+brief -> false', H.shouldLock(8, 200), false);
eq('shouldLock misaligned+held -> false', H.shouldLock(20, 600), false);
```

- [ ] **Step 2: Run to verify failure**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: FAIL — `H.dec is not a function`.

- [ ] **Step 3: Implement**

In `helpers.js`, add after `smoothAngle`:

```js
  const XOR_KEY = 'guacoff';
  function b64encode(s) {
    return (typeof btoa !== 'undefined') ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  }
  function b64decode(s) {
    return (typeof atob !== 'undefined') ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  }
  function xor(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      out += String.fromCharCode(s.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return out;
  }
  function enc(str) { return b64encode(xor(str)); }
  function dec(b64) { return xor(b64decode(b64)); }

  function shouldLock(diff, heldMs) {
    return diff < LOCK_DEG && heldMs >= LOCK_HOLD_MS;
  }
```

And add `enc, dec, shouldLock,` to the returned object.

- [ ] **Step 4: Run to verify pass**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: PASS — `28 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/helpers.js" "Guac Off 2026/find/helpers.test.js"
git commit -m "find: obfuscation (enc/dec) + lock logic"
```

---

## Task 6: Browser parity test harness

Mirror `tilt/index.test.html` so the helpers can also be verified in-browser (and so `window.FindHelpers` wiring is confirmed).

**Files:**
- Create: `Guac Off 2026/find/index.test.html`

- [ ] **Step 1: Create the harness**

Create `Guac Off 2026/find/index.test.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Find helpers — tests</title>
  <style>
    body { font-family: ui-monospace, monospace; padding: 1rem; background: #111; color: #eee; }
    .pass { color: #39ff14; } .fail { color: #ff007f; }
    h1 { font-size: 1rem; } pre { margin: 0.2rem 0; }
  </style>
</head>
<body>
  <h1>Find helpers — tests</h1>
  <div id="out"></div>
  <script src="helpers.js"></script>
  <script>
    const out = document.getElementById('out');
    let passed = 0, failed = 0;
    function eq(name, actual, expected, tol = 0) {
      const ok = (typeof actual === 'object')
        ? JSON.stringify(actual) === JSON.stringify(expected)
        : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
      const line = document.createElement('pre');
      line.textContent = (ok ? '✓ ' : '✗ ') + name +
        (ok ? '' : `   expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
      line.className = ok ? 'pass' : 'fail';
      out.appendChild(line);
      ok ? passed++ : failed++;
    }
    const H = window.FindHelpers;
    eq('bearing due east', H.bearing({lat:0,lng:0},{lat:0,lng:1}), 90, 0.001);
    eq('angleDiff 350,10 -> 20', H.angleDiff(350,10), 20, 0.001);
    eq('warmth 22.5 -> 0.5', H.warmth(22.5), 0.5, 0.001);
    eq('aim alpha=90,beta=90 -> west(270)', H.pointingAzimuth(90,90,0), 270, 0.01);
    eq('dec(enc) round-trips', H.dec(H.enc('hello')), 'hello');
    eq('shouldLock aligned+held', H.shouldLock(8,600), true);
    const summary = document.createElement('h1');
    summary.textContent = `${passed} passed, ${failed} failed`;
    summary.className = failed ? 'fail' : 'pass';
    out.prepend(summary);
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Run: `cd "Guac Off 2026" && python3 -m http.server 8095`
Open: `http://guacoff.localhost:8095/find/index.test.html`
Expected: `6 passed, 0 failed` (green).

- [ ] **Step 3: Commit**

```bash
git add "Guac Off 2026/find/index.test.html"
git commit -m "find: browser parity test harness"
```

---

## Task 7: Generate obfuscated placeholder venue strings

Produce the encoded placeholder values so the source never contains a plaintext address.

**Files:**
- (none yet — generates strings pasted in Task 10)

- [ ] **Step 1: Generate the encoded strings**

Run:

```bash
node -e "const H=require('./Guac Off 2026/find/helpers.js'); console.log('GEO ', H.enc(JSON.stringify({lat:37.7596,lng:-122.4269}))); console.log('ADDR', H.enc('Dolores Park, San Francisco, CA'));"
```

Expected: two lines like `GEO  <base64>` and `ADDR <base64>`.

- [ ] **Step 2: Record the two strings**

Copy both base64 strings into the scratch area of the task tracker; they are pasted into `find/index.js` `VENUE_GEO` / `VENUE_ADDR` in Task 10. (No commit — this step only produces values.)

---

## Task 8: `find/index.html` structure

**Files:**
- Create: `Guac Off 2026/find/index.html`

- [ ] **Step 1: Create the page**

Create `Guac Off 2026/find/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥑</text></svg>">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Point to the Party · SF GUAC OFF 2026</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <main id="stage" class="stage">
    <div id="glow" class="glow" aria-hidden="true"></div>

    <!-- Cover -->
    <div id="cover" class="overlay" aria-hidden="false">
      <h1 class="title">🧭 Point to the Party</h1>
      <p class="sub">The party's location? IYKYK. Aim your phone at it to find out.</p>
      <button id="start-btn" class="btn" type="button">🥑 Start the hunt</button>
    </div>

    <!-- Pre-prime explainer -->
    <div id="prime" class="overlay" aria-hidden="true" hidden>
      <p class="sub" id="prime-text">We'll use your phone's compass + location to point you at the party.
        Nothing is stored. Hold your phone up and aim it at the horizon like a camera.</p>
      <button id="prime-btn" class="btn" type="button">Got it — let's go</button>
    </div>

    <!-- Transient status (locating / errors / calibration) -->
    <div id="status" class="overlay" aria-hidden="true" hidden role="status">
      <p class="sub" id="status-text"></p>
    </div>

    <!-- Hunt hint -->
    <div id="hunt" class="hunt" aria-hidden="true" hidden>
      <p class="hunt-hint" id="hunt-hint">Slowly turn around… you're getting warmer 🔥</p>
    </div>

    <!-- Reveal card -->
    <div id="reveal" class="overlay reveal" aria-hidden="true" hidden>
      <p class="reveal-burst" id="reveal-burst" aria-hidden="true">🥑🎉🥑</p>
      <h2 class="reveal-headline">YOU FOUND THE PARTY</h2>
      <p class="reveal-payoff" id="reveal-payoff">Told you. Now bring chips.</p>
      <p class="reveal-address" id="reveal-address"></p>
      <p class="reveal-when">Sept 12 · 1pm 'til the last chip</p>
      <a id="maps-link" class="btn maps" href="#" target="_blank" rel="noopener">Open in Maps ↗</a>
      <button id="play-again" class="link-btn" type="button" hidden>play the hunt again</button>
    </div>

    <!-- Hidden escape hatch -->
    <button id="escape" class="escape" type="button" hidden>can't find it? just show me</button>
  </main>

  <script src="helpers.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add "Guac Off 2026/find/index.html"
git commit -m "find: page structure (cover, prime, hunt, reveal, escape)"
```

---

## Task 9: `find/index.css`

**Files:**
- Create: `Guac Off 2026/find/index.css`

- [ ] **Step 1: Create the stylesheet**

Create `Guac Off 2026/find/index.css`:

```css
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%;
  background: #0d0221;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #f5e6c8;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
  touch-action: none;
}

.stage { position: relative; width: 100%; height: 100%; overflow: hidden; }

/* Warmth glow: brightness/scale driven by --warmth (0..1) set from JS */
.glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 45%,
    rgba(57,255,20, calc(var(--warmth, 0) * 0.85)) 0%,
    rgba(57,255,20, calc(var(--warmth, 0) * 0.25)) 35%,
    transparent 70%);
  transition: background 120ms linear;
  pointer-events: none;
}

/* Overlays (same pattern as tilt) */
.overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 1.1rem; padding: 2rem; text-align: center; z-index: 10;
}
.overlay[hidden] { display: none; }

.title { margin: 0; font-size: 1.7rem; font-weight: 800; letter-spacing: 0.01em; }
.sub {
  margin: 0; font-size: 1.05rem; line-height: 1.45; max-width: 20rem;
  text-shadow: 0 1px 2px rgba(0,0,0,0.7);
}

.btn {
  font: inherit; font-size: 1.2rem; font-weight: 700; letter-spacing: 0.02em;
  color: #f5e6c8; background: rgba(20,10,4,0.85);
  border: 1.5px solid #39ff14; border-radius: 999px;
  padding: 0.9rem 1.6rem; cursor: pointer; text-decoration: none;
  box-shadow: 0 0 24px rgba(57,255,20,0.35);
}
.btn:active { transform: translateY(1px); }
.btn.maps { font-size: 1.05rem; }

/* Hunt hint */
.hunt {
  position: absolute; left: 0; right: 0; bottom: 14%;
  display: flex; justify-content: center; padding: 0 2rem;
  text-align: center; z-index: 9; pointer-events: none;
}
.hunt[hidden] { display: none; }
.hunt-hint { margin: 0; font-size: 1.15rem; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

/* Reveal */
.reveal { background: rgba(13,2,33,0.92); }
.reveal-burst { margin: 0; font-size: 2.4rem; animation: pop 600ms ease forwards; }
.reveal-headline {
  margin: 0; font-size: 1.5rem; font-weight: 800; color: #39ff14;
  opacity: 0; animation: fadeIn 500ms ease 200ms forwards;
}
.reveal-payoff { margin: 0; font-size: 1rem; opacity: 0; animation: fadeIn 500ms ease 500ms forwards; }
.reveal-address {
  margin: 0.2rem 0 0; font-size: 1.3rem; font-weight: 700; line-height: 1.35;
  opacity: 0; animation: fadeIn 500ms ease 700ms forwards;
}
.reveal-when { margin: 0; font-size: 0.95rem; opacity: 0.85; }
.link-btn {
  font: inherit; background: none; border: none; color: #f5e6c8;
  text-decoration: underline; cursor: pointer; opacity: 0.8; font-size: 0.9rem;
}

/* Escape hatch — hidden until JS reveals it, then fades in */
.escape {
  position: absolute; left: 50%; bottom: 5%; transform: translateX(-50%);
  font: inherit; font-size: 0.95rem; color: #f5e6c8;
  background: rgba(20,10,4,0.7); border: 1px solid rgba(245,230,200,0.4);
  border-radius: 999px; padding: 0.6rem 1.1rem; cursor: pointer;
  z-index: 12; opacity: 0; animation: fadeIn 700ms ease forwards;
}
.escape[hidden] { display: none; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); } }

@media (prefers-reduced-motion: reduce) {
  .glow { transition: none; }
  .reveal-burst, .reveal-headline, .reveal-payoff, .reveal-address, .escape { animation: none; opacity: 1; }
}
```

- [ ] **Step 2: Commit**

```bash
git add "Guac Off 2026/find/index.css"
git commit -m "find: styles (warmth glow, reveal, escape hatch)"
```

---

## Task 10: `find/index.js` orchestration

The big one. Permission flow, geolocation, per-platform heading source + iOS anchoring + declination, the RAF warmth/lock loop, reveal + persistence, escape-hatch timing, and all error states. Paste the encoded strings from Task 7 into `VENUE_GEO` / `VENUE_ADDR`.

**Files:**
- Create: `Guac Off 2026/find/index.js`

- [ ] **Step 1: Create the orchestration file**

Create `Guac Off 2026/find/index.js`:

```js
'use strict';

(function () {
  const H = window.FindHelpers;
  const { bearing, haversineMeters, isNearVenue, angleDiff, warmth,
          pointingAzimuth, angleState, smoothAngle, shouldLock, dec } = H;
  const C = H.constants;

  // ===== EDIT THIS ONE BLOCK (real venue) =====
  // Generate replacements with:
  //   node -e "const H=require('./helpers.js'); console.log(H.enc(JSON.stringify({lat:LAT,lng:LNG}))); console.log(H.enc('FULL ADDRESS'));"
  const VENUE_GEO  = 'PASTE_GEO_FROM_TASK_7';   // enc('{"lat":37.7596,"lng":-122.4269}') — Dolores Park placeholder
  const VENUE_ADDR = 'PASTE_ADDR_FROM_TASK_7';  // enc('Dolores Park, San Francisco, CA')
  const MAGNETIC_DECLINATION_DEG = 13;          // SF; retune per venue (only applied to iOS magnetic heading)
  // ============================================

  const STORE_KEY = 'guacPartyFound';
  const venue = JSON.parse(dec(VENUE_GEO)); // {lat,lng} — decoded at load for the live math

  // --- DOM ---
  const $ = function (id) { return document.getElementById(id); };
  const stage = $('stage'), glow = $('glow');
  const cover = $('cover'), prime = $('prime'), status = $('status'), statusText = $('status-text');
  const hunt = $('hunt'), huntHint = $('hunt-hint');
  const reveal = $('reveal'), revealAddress = $('reveal-address'), mapsLink = $('maps-link'), playAgain = $('play-again');
  const escape = $('escape');

  function show(el) { el.hidden = false; el.setAttribute('aria-hidden', 'false'); }
  function hide(el) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); }
  function setStatus(msg) { statusText.textContent = msg; hide(cover); hide(prime); hide(hunt); show(status); }

  // --- Audio (self-contained; mirrors tilt's chime + a warmth tone) ---
  let audioCtx = null, toneOsc = null, toneGain = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }
  function startTone() {
    const ctx = ensureAudio(); if (!ctx || toneOsc) return;
    toneOsc = ctx.createOscillator(); toneOsc.type = 'sine';
    toneGain = ctx.createGain(); toneGain.gain.value = 0;
    toneOsc.connect(toneGain).connect(ctx.destination); toneOsc.start();
  }
  function updateTone(w) {
    const ctx = ensureAudio(); if (!ctx || !toneOsc) return;
    const now = ctx.currentTime;
    toneOsc.frequency.setTargetAtTime(220 + w * 660, now, 0.05); // 220Hz cool -> 880Hz hot
    toneGain.gain.setTargetAtTime(w > 0.05 ? w * 0.12 : 0, now, 0.05);
  }
  function stopTone() {
    if (toneGain) toneGain.gain.setTargetAtTime(0, ensureAudio().currentTime, 0.05);
  }
  function playChime() {
    const ctx = ensureAudio(); if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach(function (freq, i) {
      const t0 = now + i * 0.12;
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, t0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(gain).connect(ctx.destination); osc.start(t0); osc.stop(t0 + 0.55);
    });
  }

  // --- Haptics ---
  let lastVibe = 0;
  function tickHaptic(w) {
    if (!navigator.vibrate || w < 0.15) return;
    const now = performance.now();
    const interval = 700 - w * 620; // 700ms cool -> 80ms hot
    if (now - lastVibe >= interval) { navigator.vibrate(15); lastVibe = now; }
  }

  // --- Reveal + persistence ---
  function doReveal(persist) {
    stopTone();
    const addr = dec(VENUE_ADDR);
    revealAddress.textContent = addr;
    mapsLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
    hide(cover); hide(prime); hide(status); hide(hunt); hide(escape);
    show(reveal);
    if (persist) { try { localStorage.setItem(STORE_KEY, '1'); } catch (e) {} playChime(); }
    if (persist) show(playAgain);
  }

  // --- Hunt loop ---
  let heading = null;         // smoothed angleState
  let targetBearing = 0;
  let usesDeclination = false;
  let gotOrientation = false;
  let lockStart = 0;
  let running = false;

  function onOrientation(e) {
    gotOrientation = true;
    let az;
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      // iOS: anchor absolute (magnetic) north; webkitCompassHeading ~ 360 - alpha when flat.
      az = pointingAzimuth(360 - e.webkitCompassHeading, e.beta || 0, e.gamma || 0);
      usesDeclination = true;
      if (typeof e.webkitCompassAccuracy === 'number' && (e.webkitCompassAccuracy < 0 || e.webkitCompassAccuracy > 25)) {
        huntHint.textContent = 'Wave your phone in a figure-8 to calibrate 🧭';
        return; // don't update heading while accuracy is unusable
      }
    } else if (e.absolute === true && typeof e.alpha === 'number') {
      az = pointingAzimuth(e.alpha, e.beta || 0, e.gamma || 0); // Android absolute ~ true north
      usesDeclination = false;
    } else {
      return; // relative-only orientation: not usable as a compass
    }
    if (usesDeclination) az = (az + MAGNETIC_DECLINATION_DEG + 360) % 360;
    heading = heading ? smoothAngle(heading, az) : angleState(az);
  }

  function tick() {
    if (!running) return;
    if (heading) {
      const diff = angleDiff(heading.deg, targetBearing);
      const w = warmth(diff);
      glow.style.setProperty('--warmth', w.toFixed(3));
      huntHint.textContent = w > 0.8 ? "🔥 SO close — hold it there!"
        : w > 0.4 ? "Getting warmer… 🔥"
        : "Slowly turn around to find the party ❄️";
      updateTone(w); tickHaptic(w);
      if (diff < C.LOCK_DEG) {
        if (!lockStart) lockStart = performance.now();
        if (shouldLock(diff, performance.now() - lockStart)) { running = false; doReveal(true); return; }
      } else { lockStart = 0; }
    }
    requestAnimationFrame(tick);
  }

  function startHunt() {
    hide(cover); hide(prime); hide(status); show(hunt);
    targetBearing = bearing(currentPos, venue);
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);
    running = true; startTone(); requestAnimationFrame(tick);
    // Escape hatch fades in after the delay.
    setTimeout(function () { if (running) show(escape); }, C.ESCAPE_DELAY_MS);
    // Watchdog: no orientation events => desktop / unsupported.
    setTimeout(function () {
      if (!gotOrientation) {
        setStatus("Best on a phone — open this page on your phone 📱");
        show(escape);
      }
    }, 3000);
  }

  // --- Geolocation ---
  let currentPos = null;
  function getLocation() {
    setStatus('Getting your location… 📍');
    if (!navigator.geolocation) { setStatus("I need your location to point you at the party 🧭"); show(escape); return; }
    navigator.geolocation.getCurrentPosition(
      function (p) {
        currentPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (isNearVenue(haversineMeters(currentPos, venue))) {
          huntHint.textContent = '';
          doReveal(true); // basically here — skip the hunt
        } else {
          startHunt();
        }
      },
      function () { setStatus("I need your location to point you at the party 🧭"); show(escape); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  // --- Motion permission (iOS) — mirrors tilt's gesture-safe flow ---
  async function requestMotionPermission() {
    const need = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
    if (!need) return 'granted';
    try { return (await DeviceOrientationEvent.requestPermission()) === 'granted' ? 'granted' : 'denied'; }
    catch (e) { return 'denied'; }
  }

  // --- Wiring ---
  $('start-btn').addEventListener('click', function () { hide(cover); show(prime); });

  $('prime-btn').addEventListener('click', async function () {
    // Audio init synchronously inside the gesture (no await before it).
    ensureAudio(); if (audioCtx) audioCtx.resume().catch(function () {});
    // requestPermission MUST be the first await (iOS gesture window).
    const status = await requestMotionPermission();
    if (status === 'unsupported') { setStatus("Best on a phone — open this page on your phone 📱"); show(escape); return; }
    if (status === 'denied') { setStatus("Motion access is needed — refresh and tap Allow."); show(escape); return; }
    getLocation();
  });

  escape.addEventListener('click', function () { running = false; doReveal(false); });
  playAgain.addEventListener('click', function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    hide(reveal); show(cover);
  });

  // Already found before? Open straight to the reveal.
  let alreadyFound = false;
  try { alreadyFound = localStorage.getItem(STORE_KEY) === '1'; } catch (e) {}
  if (alreadyFound) { doReveal(false); show(playAgain); }
})();
```

- [ ] **Step 2: Paste the encoded venue strings**

Replace `PASTE_GEO_FROM_TASK_7` and `PASTE_ADDR_FROM_TASK_7` with the two base64 strings generated in Task 7.

- [ ] **Step 3: Smoke-test the decode + page load (desktop)**

Run: `cd "Guac Off 2026" && python3 -m http.server 8095`
Open: `http://guacoff.localhost:8095/find/` in a desktop browser.
Expected: cover screen shows; click Start → prime → "Got it" → because desktop has no compass, within ~3s it shows "Best on a phone" + the escape hatch. Click escape → reveal shows `Dolores Park, San Francisco, CA` and an "Open in Maps" link. (Confirms decode + reveal + escape paths.)
Then in DevTools console: `localStorage.getItem('guacPartyFound')` → `"1"`; reload → opens straight to reveal.

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/find/index.js"
git commit -m "find: orchestration (permissions, geo, heading, warmth/lock loop, reveal, escape)"
```

---

## Task 11: Link from the home page footer

**Files:**
- Modify: `Guac Off 2026/index.html` (footer links block, currently lines ~89-90)

- [ ] **Step 1: Add the link**

In `Guac Off 2026/index.html`, after the existing tilt link line:

```html
        <p style="text-align:center;margin-top:18px"><a href="tilt/" style="color:#7cb342;text-decoration:none;font-size:.9rem">🥑 → 🥣 tilt your phone to make guac</a></p>
```

add:

```html
        <p style="text-align:center;margin-top:18px"><a href="find/" style="color:#7cb342;text-decoration:none;font-size:.9rem">🧭 point your phone to the party</a></p>
```

- [ ] **Step 2: Verify the link**

Open: `http://guacoff.localhost:8095/` → scroll to footer → confirm the 🧭 link appears and navigates to `/find/`.

- [ ] **Step 3: Commit**

```bash
git add "Guac Off 2026/index.html"
git commit -m "find: link the compass hunt from the 2026 home page"
```

---

## Task 12: On-device verification

No code — a manual checklist run on a real phone over HTTPS or a LAN dev server. (Device sensors and the iOS permission dialog cannot be exercised on desktop.)

- [ ] **Step 1: Serve to the phone**

Run: `cd "Guac Off 2026" && python3 -m http.server 8095 --bind 0.0.0.0`
On the phone (same Wi-Fi), open `http://<your-mac-LAN-IP>:8095/find/`.
> Note: iOS requires a **secure context** for `DeviceOrientationEvent.requestPermission()`. If the native motion dialog never appears over plain `http://` LAN, deploy to the site's HTTPS host (or use an HTTPS tunnel) for this step.

- [ ] **Step 2: Permission + happy path (iPhone)**

Tap Start → "Got it": confirm the **Motion & Orientation** dialog appears, then the location prompt. Allow both. Temporarily set the placeholder `VENUE_GEO` to a spot you can physically face, hold the phone up and aim around the horizon. Confirm: glow brightens as you near the bearing, hint text escalates cool→warm→"hold it there", it locks after ~0.5s aligned, chime + burst fire, address + Maps link show.

- [ ] **Step 3: If aim feels inverted ~180°**

The mental model may map better to the top edge. In `helpers.js`, change `POINT_AXIS` from `[0, 0, -1]` to `[0, -1, 0]`, re-run `node "Guac Off 2026/find/helpers.test.js"` (update the Task 3 oracles if you keep this — top-edge azimuths differ), and re-test on device. Commit the chosen axis.

- [ ] **Step 4: Failure + escape paths**

Confirm: denying motion shows the refresh message + escape; the escape hatch also fades in after ~12s of fruitless hunting; tapping it reveals the address; reload re-opens straight to the reveal (localStorage). On Android Chrome, confirm `deviceorientationabsolute` drives the hunt.

- [ ] **Step 5: Restore placeholder + final commit (if axis changed)**

Restore any test-only `VENUE_GEO` edit back to the Dolores Park placeholder.

```bash
git add -A && git commit -m "find: on-device tuning (pointing axis / thresholds)"
```

---

## Self-Review

**Spec coverage:**
- True bearing (GPS + compass) → Tasks 1, 3, 10. ✓
- Warmer/colder feedback (glow + tone + haptic) → Tasks 2, 9, 10. ✓
- Standalone page linked from footer → Tasks 8, 11. ✓
- Reveal: address + celebration (chime + burst) → Tasks 9, 10. ✓
- Light obfuscation (enc/dec; coords at load, address at unlock) → Tasks 5, 7, 10. ✓
- Placeholder venue in one marked block → Tasks 7, 10. ✓
- Wand gesture via full-orientation azimuth (camera axis default, top-edge flip) → Tasks 3, 12. ✓
- Hidden escape hatch (12s / denial / desktop / near) → Tasks 9, 10. ✓
- Declination correction (iOS magnetic only) → Task 10. ✓
- Calibration handling (`webkitCompassAccuracy`) → Task 10. ✓
- Near-venue skip (haversine < 120m) → Tasks 1, 10. ✓
- Geolocation options + denial handling → Task 10. ✓
- Capability-based desktop detection (not a bare 1s timer) → Task 10 (3s watchdog after grant + `requestPermission` capability check). ✓
- Unit-circle smoothing → Task 4, used in Task 10. ✓
- Persist unlock in localStorage → Task 10. ✓
- Per-platform north reference (iOS webkitCompassHeading anchor vs Android absolute alpha) → Task 10. ✓
- Tests: helper unit tests (Node) + browser parity → Tasks 1-6; manual on-device → Task 12. ✓

**Placeholder scan:** Only intentional, clearly-marked placeholders (`PASTE_GEO_FROM_TASK_7`, `PASTE_ADDR_FROM_TASK_7`, the Dolores Park venue) remain — all resolved by Task 7/10 steps. No "TODO/handle edge cases" hand-waving.

**Type consistency:** `FindHelpers` API names (`bearing`, `haversineMeters`, `isNearVenue`, `angleDiff`, `warmth`, `rotationMatrix`, `pointingAzimuth`, `angleState`, `smoothAngle`, `enc`, `dec`, `shouldLock`, `constants`) are defined in Tasks 1-5 and consumed with the same names in Task 10. `constants` keys (`WARMTH_WINDOW_DEG`, `LOCK_DEG`, `LOCK_HOLD_MS`, `NEAR_VENUE_M`, `ESCAPE_DELAY_MS`, `SMOOTH_FACTOR`) match between definition and use. DOM ids match between `index.html` (Task 8) and `index.js` (Task 10).

**Out of scope (per spec):** live distance display, hard geo-gating, add-to-calendar, real crypto — none added.
