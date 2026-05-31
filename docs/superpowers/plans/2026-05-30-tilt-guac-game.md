# Tilt-to-Guac Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-screen browser toy where the player tilts their phone to roll three ingredients (avocado, onion, pepper) across a wooden board and into a magnetic bowl in the middle. When all three lock in, they win.

**Architecture:** Vanilla static page at `Guac Off 2026/tilt/`. DOM rendering (each ingredient is a `<div>` with an emoji glyph). Matter.js handles physics; the `matter-attractors` plugin provides the magnetic bowl pull. Custom lock/win logic is layered on top. Three screen states (cover → playing → won) inside one `index.html`, swapped via overlays.

**Tech Stack:** Vanilla HTML/CSS/JS. Matter.js 0.20.x + matter-attractors 0.1.x (downloaded to `vendor/`, no build step). WebAudio API for synthesized sounds. `DeviceOrientationEvent` for tilt input.

**Spec:** [`docs/superpowers/specs/2026-05-30-tilt-guac-game-design.md`](../specs/2026-05-30-tilt-guac-game-design.md)

---

## Dev workflow

- **Desktop development** for everything except real tilt: open `Guac Off 2026/tilt/index.html` directly (`file://` is fine for vanilla JS with `<script src>` tags). Use Chrome DevTools' **Sensors** panel (open DevTools → ⋮ → More tools → Sensors) to emulate `deviceorientation` values.
- **Real-phone testing** for tilt feel: serve over HTTPS so iOS will grant motion permission. Simplest path: run `python3 -m http.server 8000` from `~/code/guac-off/`, get the Mac's LAN IP, then run a quick mkcert-backed HTTPS proxy OR push to a preview branch on the deployed site. If you have neither set up, the very last task (on-phone tuning) is the only one that *strictly requires* a real device — all earlier tasks verify in DevTools.
- **No build step.** All files served as-is.

## File structure

```
Guac Off 2026/tilt/
  index.html         # cover overlay, board, ingredient/bowl divs, won overlay
  index.css          # board, bowl, ingredients, overlays, win-state styling
  helpers.js         # pure helper functions (tested)
  index.js           # Matter setup, tilt handler, screens, lock/win, audio
  index.test.html    # browser test page for helpers.js
  vendor/
    matter.min.js
    matter-attractors.min.js
```

Plus modification:
- `Guac Off 2026/index.html` — add a small link to the tilt game.

`helpers.js` is split out so it can be loaded in isolation by the test page. It exposes a single namespace `window.TiltHelpers` containing `tiltToGravity`, `shouldLock`, `allLocked`, `slotPositions`. `index.js` and `index.test.html` both load `helpers.js` first.

---

## Task 1: Scaffold directory + vendor files

**Files:**
- Create: `Guac Off 2026/tilt/index.html`
- Create: `Guac Off 2026/tilt/index.css`
- Create: `Guac Off 2026/tilt/index.js`
- Create: `Guac Off 2026/tilt/helpers.js`
- Create: `Guac Off 2026/tilt/vendor/matter.min.js` (downloaded)
- Create: `Guac Off 2026/tilt/vendor/matter-attractors.min.js` (downloaded)

- [ ] **Step 1: Create the directory and download vendor libraries**

Run:
```bash
cd "$HOME/code/guac-off/Guac Off 2026"
mkdir -p tilt/vendor
curl -sL https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js -o tilt/vendor/matter.min.js
curl -sL https://cdn.jsdelivr.net/npm/matter-attractors@0.1.6/build/matter-attractors.min.js -o tilt/vendor/matter-attractors.min.js
ls -la tilt/vendor/
```
Expected: both files present and non-empty (~90kb and ~3kb).

- [ ] **Step 2: Create empty `helpers.js`**

Path: `Guac Off 2026/tilt/helpers.js`
```js
// Pure helpers for the tilt-to-guac game.
// Exposed on window.TiltHelpers for both index.js and index.test.html.
window.TiltHelpers = {};
```

- [ ] **Step 3: Create empty `index.js`**

Path: `Guac Off 2026/tilt/index.js`
```js
// Tilt-to-Guac game — main script.
// Loaded after helpers.js, vendor/matter.min.js, vendor/matter-attractors.min.js.
'use strict';
console.log('tilt: hello');
```

- [ ] **Step 4: Create the HTML skeleton**

Path: `Guac Off 2026/tilt/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥑</text></svg>">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Tilt to Guac · SF GUAC OFF 2026</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <main id="board" class="board">
    <div id="bowl" class="bowl"></div>
    <div class="ingredient" data-id="avocado">🥑</div>
    <div class="ingredient" data-id="onion">🧅</div>
    <div class="ingredient" data-id="pepper">🌶️</div>

    <div id="cover" class="overlay cover" aria-hidden="false">
      <button id="play-btn" class="play-btn" type="button">🥑 Tap to play</button>
      <p id="cover-sub" class="cover-sub">Tilt your phone to roll the ingredients into the bowl</p>
    </div>

    <div id="won" class="overlay won" aria-hidden="true" hidden>
      <p class="won-headline">Guac is served 🥑</p>
      <p class="won-sub">tap to play again</p>
    </div>
  </main>

  <script src="helpers.js"></script>
  <script src="vendor/matter.min.js"></script>
  <script src="vendor/matter-attractors.min.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create an empty `index.css`**

Path: `Guac Off 2026/tilt/index.css`
```css
/* Tilt-to-Guac styles — populated in Task 2. */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: #1a1a1a; }
```

- [ ] **Step 6: Verify the page loads cleanly**

Run:
```bash
open "$HOME/code/guac-off/Guac Off 2026/tilt/index.html"
```
Expected in the browser:
- Page opens, dark grey background.
- DevTools console shows `tilt: hello` and no errors.
- Three emoji (🥑 🧅 🌶️) and "🥑 Tap to play" button visible somewhere on the page (unstyled — that's fine).

- [ ] **Step 7: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt"
git commit -m "Tilt-to-Guac: scaffold directory + Matter.js vendor files"
```

---

## Task 2: Static visual — wooden board, bowl, ingredients, cover overlay

Make the page *look* finished (no physics yet). Ingredients positioned at fixed starting spots, bowl centered, cover overlay styled.

**Files:**
- Modify: `Guac Off 2026/tilt/index.css`

- [ ] **Step 1: Replace `index.css` with the full visual styles**

Path: `Guac Off 2026/tilt/index.css`
```css
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%;
  background: #0d0221;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
  touch-action: none;
}

/* ------ Board ------ */
.board {
  position: relative;
  width: min(96vw, 96vh, 540px);
  aspect-ratio: 3 / 4;
  margin: 2vh auto;
  border-radius: 18px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255,240,200,0.22), transparent 55%),
    repeating-linear-gradient(94deg,
      #a87547 0px, #a87547 38px,
      #9c6b3f 38px, #9c6b3f 76px),
    #a87547;
  box-shadow:
    inset 0 0 60px rgba(0,0,0,0.25),
    0 10px 30px rgba(0,0,0,0.4);
  transition: filter 600ms ease;
  user-select: none;
}
.board.dimmed { filter: brightness(0.85) saturate(0.9); }

/* ------ Bowl ------ */
.bowl {
  position: absolute;
  left: 50%; top: 55%;
  transform: translate(-50%, -50%);
  width: 42%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #5c3a1e, #2a1808 80%);
  box-shadow:
    inset 0 -8px 18px rgba(0,0,0,0.55),
    0 10px 20px rgba(0,0,0,0.4),
    0 0 0 0 rgba(57,255,20,0);
  transition: box-shadow 700ms ease;
  pointer-events: none;
}
.board.won .bowl {
  box-shadow:
    inset 0 -8px 18px rgba(0,0,0,0.55),
    0 10px 20px rgba(0,0,0,0.4),
    0 0 40px 6px rgba(57,255,20,0.65);
}

/* ------ Ingredients ------ */
.ingredient {
  position: absolute;
  top: 0; left: 0;
  font-size: 3rem;
  line-height: 1;
  filter: drop-shadow(0 4px 4px rgba(0,0,0,0.35));
  user-select: none;
  pointer-events: none;
  will-change: transform;
  transform: translate(50px, 50px);
}
.ingredient.locked {
  transition: transform 200ms cubic-bezier(.2, .8, .3, 1.2);
}

/* ------ Overlays ------ */
.overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 1.25rem;
  padding: 2rem;
  text-align: center;
  z-index: 10;
}
.overlay[hidden] { display: none; }

/* Cover */
.cover { background: rgba(13, 2, 33, 0.0); }
.play-btn {
  font: inherit;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #f5e6c8;
  background: rgba(20, 10, 4, 0.85);
  border: 1.5px solid #39ff14;
  border-radius: 999px;
  padding: 1rem 1.75rem;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(57, 255, 20, 0.35);
}
.play-btn:active { transform: translateY(1px); }
.cover-sub {
  margin: 0;
  font-size: 1rem;
  color: #f5e6c8;
  text-shadow: 0 1px 2px rgba(0,0,0,0.7);
  max-width: 18rem;
  line-height: 1.4;
}

/* Won */
.won { pointer-events: auto; cursor: pointer; }
.won-headline {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: #f5e6c8;
  text-shadow: 0 1px 4px rgba(0,0,0,0.7);
  opacity: 0;
  animation: fadeIn 600ms ease 300ms forwards;
}
.won-sub {
  margin: 0;
  font-size: 0.95rem;
  color: #f5e6c8;
  opacity: 0;
  animation: fadeIn 600ms ease 800ms forwards;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 0.85; } }
```

- [ ] **Step 2: Position the three ingredients at visible starting spots via inline styles in `index.html`**

This is a temporary stand-in so we can see the layout before physics drives them.

In `Guac Off 2026/tilt/index.html`, replace the three `<div class="ingredient">` lines with:
```html
<div class="ingredient" data-id="avocado" style="transform: translate(20%, 18%);">🥑</div>
<div class="ingredient" data-id="onion" style="transform: translate(70%, 22%);">🧅</div>
<div class="ingredient" data-id="pepper" style="transform: translate(45%, 78%);">🌶️</div>
```

Note: these `%` values are placeholders for visual check only — physics in later tasks will replace them with pixel coordinates.

- [ ] **Step 3: Reload and visually verify**

Reload the browser. Expected:
- Vaporwave-dark page background.
- Wooden cutting board centered, wood grain visible.
- Dark concave bowl in the center of the board.
- Three emoji visible at their positioned spots, each with a slight drop shadow.
- "🥑 Tap to play" pill button centered over the board with a neon-green border.

If anything looks broken (no board, no bowl, etc.), inspect with DevTools and fix CSS before continuing.

- [ ] **Step 4: Test mobile layout**

In DevTools, toggle device toolbar (Cmd+Shift+M), pick iPhone 14 Pro. Expected: board fills almost the full width, looks correct, button still readable.

- [ ] **Step 5: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/index.css" "Guac Off 2026/tilt/index.html"
git commit -m "Tilt-to-Guac: wooden board, bowl, ingredients, and cover overlay"
```

---

## Task 3: Pure helper functions (TDD)

Four pure functions that the rest of the code depends on. TDD them in a browser-based test page (no framework).

**Files:**
- Modify: `Guac Off 2026/tilt/helpers.js`
- Create: `Guac Off 2026/tilt/index.test.html`

- [ ] **Step 1: Write the test page with all four failing tests**

Path: `Guac Off 2026/tilt/index.test.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tilt helpers — tests</title>
  <style>
    body { font-family: ui-monospace, monospace; padding: 1rem; background: #111; color: #eee; }
    .pass { color: #39ff14; }
    .fail { color: #ff007f; }
    h1 { font-size: 1rem; }
    pre { margin: 0.2rem 0; }
  </style>
</head>
<body>
  <h1>Tilt helpers — tests</h1>
  <div id="out"></div>
  <script src="helpers.js"></script>
  <script>
    const out = document.getElementById('out');
    let passed = 0, failed = 0;

    function assertEq(name, actual, expected, tolerance = 0) {
      const ok = (typeof actual === 'object')
        ? JSON.stringify(actual) === JSON.stringify(expected)
        : (tolerance ? Math.abs(actual - expected) <= tolerance : actual === expected);
      const line = document.createElement('pre');
      line.textContent = (ok ? '✓ ' : '✗ ') + name +
        (ok ? '' : `   expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
      line.className = ok ? 'pass' : 'fail';
      out.appendChild(line);
      ok ? passed++ : failed++;
    }

    const { tiltToGravity, shouldLock, allLocked, slotPositions } = window.TiltHelpers;

    // tiltToGravity
    assertEq('tiltToGravity(0, 0) → zero',
      tiltToGravity(0, 0), { x: 0, y: 0 });
    assertEq('tiltToGravity(30, 0) → full y',
      tiltToGravity(30, 0), { x: 0, y: 1.2 });
    assertEq('tiltToGravity(0, 30) → full x',
      tiltToGravity(0, 30), { x: 1.2, y: 0 });
    assertEq('tiltToGravity(15, 0) → half y',
      tiltToGravity(15, 0), { x: 0, y: 0.6 });
    assertEq('tiltToGravity(90, 0) → clamped to full y',
      tiltToGravity(90, 0), { x: 0, y: 1.2 });
    assertEq('tiltToGravity(-90, -90) → clamped, both negative',
      tiltToGravity(-90, -90), { x: -1.2, y: -1.2 });

    // shouldLock
    assertEq('shouldLock close + slow → true',
      shouldLock(10, 1.0), true);
    assertEq('shouldLock close + fast → false',
      shouldLock(10, 5.0), false);
    assertEq('shouldLock far + slow → false',
      shouldLock(100, 1.0), false);
    assertEq('shouldLock far + fast → false',
      shouldLock(100, 5.0), false);

    // allLocked
    assertEq('allLocked all true → true',
      allLocked([{ locked: true }, { locked: true }, { locked: true }]), true);
    assertEq('allLocked one false → false',
      allLocked([{ locked: true }, { locked: false }, { locked: true }]), false);
    assertEq('allLocked empty → true',
      allLocked([]), true);

    // slotPositions
    const slots = slotPositions({ x: 100, y: 100 }, 50, 3);
    assertEq('slotPositions returns 3 entries', slots.length, 3);
    // Centroid of the three slots should equal the bowl center
    const cx = slots.reduce((s, p) => s + p.x, 0) / 3;
    const cy = slots.reduce((s, p) => s + p.y, 0) / 3;
    assertEq('slotPositions centroid x ≈ bowl center x', cx, 100, 0.001);
    assertEq('slotPositions centroid y ≈ bowl center y', cy, 100, 0.001);
    // Each slot should sit inside the bowl
    slots.forEach((p, i) => {
      const d = Math.hypot(p.x - 100, p.y - 100);
      assertEq(`slot ${i} inside bowl`, d < 50, true);
    });

    const summary = document.createElement('h1');
    summary.textContent = `${passed} passed, ${failed} failed`;
    summary.className = failed ? 'fail' : 'pass';
    out.prepend(summary);
  </script>
</body>
</html>
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
open "$HOME/code/guac-off/Guac Off 2026/tilt/index.test.html"
```
Expected: all assertions fail (red rows) because `TiltHelpers.tiltToGravity` etc. are undefined.

- [ ] **Step 3: Implement the helpers**

Path: `Guac Off 2026/tilt/helpers.js`
```js
// Pure helpers for the tilt-to-guac game.
// Exposed on window.TiltHelpers for both index.js and index.test.html.
(function () {
  'use strict';

  const STRENGTH = 1.2;        // gravity magnitude at full tilt
  const TILT_FULL_DEG = 30;    // degrees of tilt that map to full gravity
  const SNAP_RADIUS = 40;      // px from bowl center within which an ingredient can lock
  const SNAP_SPEED = 1.5;      // max px/frame speed allowed for locking

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function tiltToGravity(beta, gamma) {
    const y = clamp(beta / TILT_FULL_DEG, -1, 1) * STRENGTH;
    const x = clamp(gamma / TILT_FULL_DEG, -1, 1) * STRENGTH;
    return { x, y };
  }

  function shouldLock(distance, speed) {
    return distance < SNAP_RADIUS && speed < SNAP_SPEED;
  }

  function allLocked(ingredients) {
    return ingredients.every(function (i) { return i.locked === true; });
  }

  // n slots in a regular polygon centered on the bowl, at 60% of the bowl radius.
  function slotPositions(center, bowlRadius, n) {
    const r = bowlRadius * 0.6;
    const out = [];
    // Start angle = -π/2 puts the first slot at the top.
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI / n);
      out.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    return out;
  }

  window.TiltHelpers = {
    tiltToGravity,
    shouldLock,
    allLocked,
    slotPositions,
    // also expose constants so index.js can use the same source of truth
    constants: { STRENGTH, TILT_FULL_DEG, SNAP_RADIUS, SNAP_SPEED }
  };
})();
```

- [ ] **Step 4: Re-run tests — verify they pass**

Reload `index.test.html` in the browser. Expected: green summary "17 passed, 0 failed" at the top.

If any fail, debug and fix `helpers.js`. Do not advance until all pass.

- [ ] **Step 5: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/helpers.js" "Guac Off 2026/tilt/index.test.html"
git commit -m "Tilt-to-Guac: pure helpers with browser-run tests"
```

---

## Task 4: Matter.js engine + render loop with hardcoded gravity

Get the three ingredients falling under simulated gravity, bouncing off the walls, with their DOM divs tracking their physics positions. No tilt input yet — gravity is hardcoded straight down.

**Files:**
- Modify: `Guac Off 2026/tilt/index.html` (remove the placeholder inline transforms)
- Modify: `Guac Off 2026/tilt/index.js`

- [ ] **Step 1: Remove the placeholder inline transforms from `index.html`**

In `Guac Off 2026/tilt/index.html`, change the three ingredient lines back to:
```html
<div class="ingredient" data-id="avocado">🥑</div>
<div class="ingredient" data-id="onion">🧅</div>
<div class="ingredient" data-id="pepper">🌶️</div>
```

- [ ] **Step 2: Replace `index.js` with the engine + render loop**

Path: `Guac Off 2026/tilt/index.js`
```js
'use strict';

(function () {
  const { Engine, World, Bodies, Body, Composite } = Matter;
  const H = window.TiltHelpers;

  // --- DOM ---
  const board = document.getElementById('board');
  const ingredientEls = Array.from(document.querySelectorAll('.ingredient'));

  // --- Board dimensions (read once at start; if we add resize later, redo) ---
  const rect = board.getBoundingClientRect();
  const W = rect.width;
  const Hh = rect.height;
  const WALL_T = 40;        // wall thickness (kept outside the viewport)
  const ING_R = 28;         // ingredient body radius

  // --- Engine ---
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 1.0;   // hardcoded straight down for now

  // Walls — placed just outside the board edges
  const walls = [
    Bodies.rectangle(W / 2,  -WALL_T / 2,        W + WALL_T * 2, WALL_T, { isStatic: true, restitution: 0.55 }),
    Bodies.rectangle(W / 2,  Hh + WALL_T / 2,    W + WALL_T * 2, WALL_T, { isStatic: true, restitution: 0.55 }),
    Bodies.rectangle(-WALL_T / 2,       Hh / 2,  WALL_T, Hh + WALL_T * 2, { isStatic: true, restitution: 0.55 }),
    Bodies.rectangle(W + WALL_T / 2,    Hh / 2,  WALL_T, Hh + WALL_T * 2, { isStatic: true, restitution: 0.55 }),
  ];
  Composite.add(engine.world, walls);

  // Ingredients — Matter bodies paired with DOM elements
  const ingredients = ingredientEls.map(function (el, i) {
    // Spread starting positions across the top half of the board
    const startX = W * (0.2 + 0.3 * i);
    const startY = Hh * 0.15;
    const body = Bodies.circle(startX, startY, ING_R, {
      restitution: 0.35,
      friction: 0.02,
      frictionAir: 0.02,
      density: 0.001,
    });
    Composite.add(engine.world, body);
    return { el, body, locked: false };
  });

  // --- Render loop ---
  function tick() {
    Engine.update(engine, 1000 / 60);
    for (const ing of ingredients) {
      const { x, y } = ing.body.position;
      const a = ing.body.angle;
      // The DOM element is positioned top-left at (0,0); translate to body center minus its visual half-size.
      // Visual half-size ≈ ING_R, since the emoji glyph at 3rem ≈ 48px ≈ ING_R*2 wide.
      ing.el.style.transform =
        `translate(${x - ING_R}px, ${y - ING_R}px) rotate(${a}rad)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
```

- [ ] **Step 3: Verify in the browser**

Reload `index.html`. Expected:
- Three ingredients start near the top.
- They fall straight down and pile up at the bottom of the board.
- They bounce slightly off the floor and each other before settling.
- The cover overlay still shows on top of all this (we wire that up in a later task — for now it just means you can see the action behind/around the button).
- Console: no errors.

If the ingredients fall off the screen or don't appear, log `engine.world.bodies` in the console and verify positions.

- [ ] **Step 4: Verify wall bounces by tilting the world**

In the DevTools console:
```js
Matter.Engine.update // should be a function
```
Then trigger a sideways "tilt" by typing in the console:
```js
// Roll right
matter; // (this won't work — engine isn't exposed)
```
That's expected — we don't expose the engine globally. To verify sideways bouncing, temporarily change `engine.gravity.y = 1.0;` to `engine.gravity.x = 1.0; engine.gravity.y = 0;`, reload, and watch the ingredients roll right and bounce off the right wall. Then revert.

- [ ] **Step 5: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/index.html" "Guac Off 2026/tilt/index.js"
git commit -m "Tilt-to-Guac: Matter.js engine, three falling ingredients, bouncy walls"
```

---

## Task 5: Tilt → gravity wiring

Replace the hardcoded gravity with input from `DeviceOrientationEvent`, smoothed and clamped via `tiltToGravity`. Verify in DevTools' Sensors panel.

**Files:**
- Modify: `Guac Off 2026/tilt/index.js`

- [ ] **Step 1: Add tilt smoothing state and event handler**

In `Guac Off 2026/tilt/index.js`, just before the `// --- Render loop ---` comment, add:

```js
  // --- Tilt input ---
  let smoothBeta = 0;
  let smoothGamma = 0;
  let tiltActive = false;

  function onOrientation(event) {
    tiltActive = true;
    const beta = event.beta || 0;     // front-back, deg
    const gamma = event.gamma || 0;   // left-right, deg
    smoothBeta = smoothBeta * 0.85 + beta * 0.15;
    smoothGamma = smoothGamma * 0.85 + gamma * 0.15;
  }
  window.addEventListener('deviceorientation', onOrientation);
```

- [ ] **Step 2: Drive engine gravity from the smoothed values inside `tick`**

In `tick()`, **before** `Engine.update(...)`, add:

```js
    const g = H.tiltToGravity(smoothBeta, smoothGamma);
    engine.gravity.x = g.x;
    engine.gravity.y = g.y;
```

Also remove the constant assignment that's still up at engine setup:
```js
  engine.gravity.x = 0;
  engine.gravity.y = 1.0;   // hardcoded straight down for now
```
Replace with:
```js
  engine.gravity.x = 0;
  engine.gravity.y = 0;
```

- [ ] **Step 3: Verify with the DevTools Sensors panel**

In Chrome DevTools, open Sensors (⋮ → More tools → Sensors). Set Orientation to "Portrait". Use the alpha/beta/gamma sliders. Expected:
- Slide gamma right → ingredients roll right.
- Slide beta forward (positive) → ingredients roll down (toward the bottom of the screen).
- Letting both back to 0 → ingredients slow to a stop on whatever wall they were resting against.

If the directions feel reversed, do NOT change the math — that's a phone-orientation issue we'll address by testing on a real device in the final task. For now, "any tilt moves them" is the success criterion.

- [ ] **Step 4: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/index.js"
git commit -m "Tilt-to-Guac: drive gravity from deviceorientation with low-pass smoothing"
```

---

## Task 6: Magnetic bowl attractor

Add the bowl as a static body with the attractors plugin pulling ingredients in once they're within range.

**Files:**
- Modify: `Guac Off 2026/tilt/index.js`

- [ ] **Step 1: Register the attractors plugin (before any engine setup)**

In `Guac Off 2026/tilt/index.js`, immediately inside the IIFE, right after the `const { Engine, ... } = Matter;` line, add:

```js
  // Register attractors plugin (must happen before Engine.create).
  Matter.use(MatterAttractors);
```

- [ ] **Step 2: Add bowl geometry constants and a bowl body**

After the `ingredients` array is created and **before** the `// --- Render loop ---` comment, add:

```js
  // --- Bowl ---
  const BOWL_CX = W * 0.5;
  const BOWL_CY = Hh * 0.55;
  const BOWL_R = W * 0.21;         // matches .bowl width: 42% / 2
  const BOWL_PULL_RADIUS = W * 0.35;
  const PULL_GAIN = 0.00018;

  const bowl = Bodies.circle(BOWL_CX, BOWL_CY, BOWL_R, {
    isStatic: true,
    isSensor: true,                 // no collision response
    render: { visible: false },
    plugin: {
      attractors: [
        function (bowlBody, otherBody) {
          const dx = bowlBody.position.x - otherBody.position.x;
          const dy = bowlBody.position.y - otherBody.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist > BOWL_PULL_RADIUS) return null;
          const strength = (1 - dist / BOWL_PULL_RADIUS) * PULL_GAIN;
          return { x: dx * strength, y: dy * strength };
        }
      ]
    }
  });
  Composite.add(engine.world, bowl);
```

- [ ] **Step 3: Verify the pull**

Reload `index.html`. Use DevTools' Sensors panel to tilt slightly so one ingredient drifts toward the center. Expected:
- Outside the pull radius (~35% of board width from center), the ingredient moves only under gravity.
- Once it crosses into the pull radius, it noticeably accelerates toward the bowl center.
- Multiple ingredients can be inside the pull at once; they bump into each other and the bowl.
- Without tilt, ingredients at rest near the bowl drift in slowly even with zero gravity.

If the pull is way too weak or too strong, adjust `PULL_GAIN` (try ±2×) and reload. The starting value should be in the ballpark.

- [ ] **Step 4: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/index.js"
git commit -m "Tilt-to-Guac: magnetic bowl attractor with radius-based pull"
```

---

## Task 7: Snap-and-lock + thunk sound

When an ingredient is within `SNAP_RADIUS` and slow enough, freeze it and animate to a slot inside the bowl. Synthesize a soft "thunk" on each lock.

**Files:**
- Modify: `Guac Off 2026/tilt/index.js`

- [ ] **Step 1: Add audio context and a synth `playThunk` helper**

In `Guac Off 2026/tilt/index.js`, near the top of the IIFE (after the `Matter.use(...)` line), add:

```js
  // --- Audio ---
  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { /* audio not available — silent fallback */ }
    return audioCtx;
  }

  function playThunk() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Low-frequency body
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0, now);
    oscGain.gain.linearRampToValueAtTime(0.5, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.2);
    // Noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(lp).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
  }
```

- [ ] **Step 2: Compute the bowl slot positions once**

Immediately after `Composite.add(engine.world, bowl);` (added in Task 6 step 2 — which already comes after `ingredients` is defined), add:

```js
  const slots = H.slotPositions({ x: BOWL_CX, y: BOWL_CY }, BOWL_R, ingredients.length);
```

- [ ] **Step 3: Add the lock check inside `tick`, after `Engine.update`**

In `tick()`, after `Engine.update(engine, 1000 / 60);` and before the position-write loop, add:

```js
    // Lock-and-snap pass
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      if (ing.locked) continue;
      const dx = BOWL_CX - ing.body.position.x;
      const dy = BOWL_CY - ing.body.position.y;
      const dist = Math.hypot(dx, dy);
      const speed = Math.hypot(ing.body.velocity.x, ing.body.velocity.y);
      if (H.shouldLock(dist, speed)) {
        ing.locked = true;
        Body.setStatic(ing.body, true);
        Body.setVelocity(ing.body, { x: 0, y: 0 });
        Body.setPosition(ing.body, slots[i]);
        ing.el.classList.add('locked');
        playThunk();
      }
    }
```

- [ ] **Step 4: Verify the snap-and-lock**

Reload `index.html`. Use the Sensors panel to roll an ingredient into the bowl. Expected:
- Within `SNAP_RADIUS` of the bowl center and below `SNAP_SPEED`, the ingredient snaps to a slot.
- The CSS transition smoothly carries it to its slot position with a slight overshoot.
- A soft thunk sound plays on each snap (audio may be silent until you click the page once — that's the browser's autoplay policy).
- The locked ingredient is immovable from that point on; other ingredients can still move freely.
- A second and third ingredient can also lock into their own slots.

If snaps feel "too easy" (ingredients lock from far away or while still moving fast), nudge `SNAP_RADIUS` down to 30 or `SNAP_SPEED` down to 1.0 in `helpers.js`. If they refuse to lock, nudge up.

- [ ] **Step 5: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/index.js"
git commit -m "Tilt-to-Guac: snap-and-lock when ingredients reach the bowl + thunk SFX"
```

---

## Task 8: Win detection + win state + chime + reset

When all three are locked, fade into the won state and play a chime. Tapping anywhere on the won overlay resets the game.

**Files:**
- Modify: `Guac Off 2026/tilt/index.js`

- [ ] **Step 1: Add a `playChime` audio helper**

Inside the audio section (right after `playThunk`), add:

```js
  function playChime() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach(function (freq, i) {  // C5, E5, G5
      const t0 = now + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.55);
    });
  }
```

- [ ] **Step 2: Add a win-state guard, transition, and reset function**

Near the DOM section (after `const ingredientEls = ...`), add:

```js
  const wonEl = document.getElementById('won');
  let gameWon = false;

  function enterWon() {
    if (gameWon) return;
    gameWon = true;
    board.classList.add('dimmed');
    board.classList.add('won');
    wonEl.hidden = false;
    wonEl.setAttribute('aria-hidden', 'false');
    playChime();
  }

  function resetGame() {
    gameWon = false;
    board.classList.remove('dimmed');
    board.classList.remove('won');
    wonEl.hidden = true;
    wonEl.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      Body.setStatic(ing.body, false);
      Body.setVelocity(ing.body, { x: 0, y: 0 });
      Body.setAngularVelocity(ing.body, 0);
      const startX = W * (0.15 + Math.random() * 0.7);
      const startY = Hh * (0.1 + Math.random() * 0.15);
      Body.setPosition(ing.body, { x: startX, y: startY });
      ing.locked = false;
      ing.el.classList.remove('locked');
    }
  }

  wonEl.addEventListener('click', resetGame);
```

`wonEl`, `gameWon`, and the win/reset functions need access to `ingredients`, `W`, `Hh`, and `board`, so they must be defined *after* the engine setup but *before* the render loop. Drop this block right before the `// --- Render loop ---` comment.

- [ ] **Step 3: Trigger `enterWon` from the render loop**

In `tick()`, after the lock-and-snap pass and before the position-write loop, add:

```js
    if (!gameWon && H.allLocked(ingredients)) {
      enterWon();
    }
```

- [ ] **Step 4: Verify the win and reset**

Reload `index.html`. Use the Sensors panel to drive all three ingredients into the bowl. Expected:
- When the third one locks, the board dims slightly, a green glow appears around the bowl, and the "Guac is served 🥑 / tap to play again" caption fades in.
- A 3-note chime plays.
- Tapping the won overlay returns to a playable state with ingredients re-scattered near the top.
- You can play and win again, repeatedly.

- [ ] **Step 5: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/index.js"
git commit -m "Tilt-to-Guac: win state, chime, and tap-to-reset"
```

---

## Task 9: iOS permission gate + desktop fallback

Make the "Tap to play" button do the right things: request iOS motion permission, gate the engine behind a real motion event arriving, and show a "phone-only" message if no motion arrives.

**Files:**
- Modify: `Guac Off 2026/tilt/index.js`

- [ ] **Step 1: Stop auto-listening to orientation on load; gate it behind the play button**

In `index.js`, **remove** the line:
```js
  window.addEventListener('deviceorientation', onOrientation);
```
(near the tilt input section)

…and **remove** the auto-start of the render loop:
```js
  requestAnimationFrame(tick);
```

The render loop will start only after the player taps "Tap to play".

- [ ] **Step 2: Add the cover-screen + permission logic**

Near the end of the IIFE (after `wonEl.addEventListener('click', resetGame);`), add:

```js
  // --- Cover screen + permission flow ---
  const coverEl = document.getElementById('cover');
  const coverSub = document.getElementById('cover-sub');
  const playBtn = document.getElementById('play-btn');

  async function requestMotionPermission() {
    // iOS 13+: must call from a user gesture
    const need = typeof DeviceMotionEvent !== 'undefined'
      && typeof DeviceMotionEvent.requestPermission === 'function';
    if (!need) return 'granted'; // non-iOS browsers fire events freely
    try {
      const m = await DeviceMotionEvent.requestPermission();
      const o = (typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function')
        ? await DeviceOrientationEvent.requestPermission()
        : 'granted';
      return (m === 'granted' && o === 'granted') ? 'granted' : 'denied';
    } catch (e) { return 'denied'; }
  }

  function startGame() {
    coverEl.hidden = true;
    coverEl.setAttribute('aria-hidden', 'true');
    window.addEventListener('deviceorientation', onOrientation);
    requestAnimationFrame(tick);

    // Desktop fallback: if no orientation event arrives in 1s, abort with a message.
    setTimeout(function () {
      if (!tiltActive) {
        coverEl.hidden = false;
        coverEl.setAttribute('aria-hidden', 'false');
        coverSub.textContent = 'Best on a phone — open this URL on your phone 📱';
        playBtn.hidden = true;
      }
    }, 1000);
  }

  playBtn.addEventListener('click', async function () {
    // Init audio (browser policy requires a gesture)
    ensureAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch (e) {}
    }
    const status = await requestMotionPermission();
    if (status === 'granted') {
      startGame();
    } else {
      coverSub.textContent = 'Motion access is needed — refresh and tap Allow to play.';
      playBtn.hidden = true;
    }
  });
```

- [ ] **Step 3: Verify on desktop**

Reload `index.html`. With DevTools' Sensors panel **off** (orientation set to "No override"):
- Cover overlay is visible, button reads "🥑 Tap to play".
- Tapping the button → game starts → no motion arrives within 1s → cover comes back with the "Best on a phone — open this URL on your phone 📱" message. The button is hidden.
- Reload, turn on the Sensors panel ("Custom orientation" with any alpha/beta/gamma values), tap the button. Game starts, ingredients respond to slider changes. The fallback message does NOT appear.

- [ ] **Step 4: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt/index.js"
git commit -m "Tilt-to-Guac: iOS motion permission gate + desktop fallback"
```

---

## Task 10: Home-page link

Add an unobtrusive link from `Guac Off 2026/index.html` to the new tilt game.

**Files:**
- Modify: `Guac Off 2026/index.html`

- [ ] **Step 1: Choose a placement and add the link**

In `Guac Off 2026/index.html`, find the line near the bottom of the `<section id="info">`:
```html
      <p style="text-align:center;margin-top:18px"><a href="years/index.html" style="color:#7cb342;text-decoration:none;font-size:.9rem">↩ guac off through the years</a></p>
```

Add a sibling paragraph right above it:
```html
      <p style="text-align:center;margin-top:18px"><a href="tilt/" style="color:#7cb342;text-decoration:none;font-size:.9rem">🥑 → 🥣 tilt your phone to make guac</a></p>
```

- [ ] **Step 2: Verify the link**

Reload `Guac Off 2026/index.html`. Scroll to the bottom of the info section. Expected: a green text link "🥑 → 🥣 tilt your phone to make guac" appears, and clicking it loads the tilt game.

- [ ] **Step 3: Commit**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/index.html"
git commit -m "Tilt-to-Guac: link from the 2026 home page"
```

---

## Task 11: On-phone tuning + polish

This task requires a real iPhone. It's a play-and-tune pass: every constant in the game (tilt sensitivity, pull strength, snap radius, snap speed, restitution) was chosen by ear. On a real device they may need adjustment.

**Files:**
- Modify (likely): `Guac Off 2026/tilt/helpers.js` (`STRENGTH`, `TILT_FULL_DEG`, `SNAP_RADIUS`, `SNAP_SPEED`)
- Modify (likely): `Guac Off 2026/tilt/index.js` (`PULL_GAIN`, restitution/friction on ingredients & walls)

- [ ] **Step 1: Get the page onto a real phone over HTTPS**

iOS will not grant `DeviceMotionEvent.requestPermission()` on plain HTTP — must be HTTPS or `localhost`. Pick one:

- **A. Push to the live site.** Commit-and-push to whatever branch deploys the live `Guac Off 2026/` site, then open `https://<your-live-host>/tilt/` on your phone. Slow iteration but no extra setup.
- **B. Local HTTPS via mkcert.** From `~/code/guac-off/`:
  ```bash
  brew install mkcert
  mkcert -install
  mkcert localhost 192.168.x.x   # use your Mac's LAN IP
  ```
  Then run a tiny HTTPS server:
  ```bash
  npx http-server -S -C localhost+1.pem -K localhost+1-key.pem -p 8443 .
  ```
  On your phone, open `https://192.168.x.x:8443/Guac%20Off%202026/tilt/` and accept the cert warning.

- [ ] **Step 2: Play through one game end-to-end on the phone**

Tap "Tap to play". Grant motion access. Tilt the phone. Roll all three ingredients into the bowl. Win.

Note the things that feel wrong. Common adjustments:

| Symptom | Adjust |
|---|---|
| Ingredients feel too slippery / fly across the board | `frictionAir: 0.02 → 0.04` on the ingredient body options |
| Ingredients feel too sluggish / barely move | `STRENGTH: 1.2 → 1.5` in `helpers.js` |
| Need almost no tilt to get full gravity | `TILT_FULL_DEG: 30 → 40` in `helpers.js` |
| Need to tilt the phone way too far | `TILT_FULL_DEG: 30 → 20` in `helpers.js` |
| Magnetic pull is too weak / ingredients escape the bowl | `PULL_GAIN: 0.00018 → 0.0003` in `index.js` |
| Magnetic pull yanks them from the other side of the board | `BOWL_PULL_RADIUS: W * 0.35 → W * 0.25` |
| Snap triggers too early (locks while still flying) | `SNAP_SPEED: 1.5 → 0.8` |
| Snap refuses to trigger | `SNAP_RADIUS: 40 → 60`, or `SNAP_SPEED: 1.5 → 2.5` |
| Walls feel dead/dull | `restitution: 0.55 → 0.7` on the wall bodies |
| Tilt-to-roll direction feels backwards along one axis | flip the sign in `tiltToGravity` for that axis |

Make small changes, reload, re-test. Aim for a build where a 30° tilt is enough to move things confidently, a near-bowl ingredient feels "drawn in" rather than yanked, and the snap feels like a satisfying *click* rather than a teleport.

- [ ] **Step 3: Polish pass on visuals (optional, only if needed)**

After tuning physics, glance at:
- Drop shadow depth on the ingredients (tweak `0 4px 4px rgba(0,0,0,0.35)` if they look pasted-on or floaty).
- Bowl edge contrast (inset shadow strength).
- The "Tap to play" pill — is it visible against the wooden board? If not, increase its dark background opacity or its drop shadow.
- The win-state green glow intensity (`rgba(57,255,20,0.65)` on `.board.won .bowl` box-shadow).

Only edit what's actually wrong. No speculative changes.

- [ ] **Step 4: Final test run**

Play through the full loop: cover → grant permission → win → reset → win → reset. Confirm:
- Audio plays (thunks + chime).
- Win caption is readable.
- Reset returns the game cleanly.
- No console errors.

- [ ] **Step 5: Commit the tuning**

```bash
cd "$HOME/code/guac-off"
git add "Guac Off 2026/tilt"
git commit -m "Tilt-to-Guac: physics + visual tuning after real-device playtest"
```

---

## Spec coverage check

| Spec section | Implemented in |
|---|---|
| Cover screen with "Tap to play" pill | Tasks 2 (visual), 9 (logic) |
| Playing state — board, bowl, 3 ingredients | Tasks 2, 4 |
| Won state — dim, glow, caption, chime, tap-to-reset | Task 8 |
| Three screens in one `index.html` (overlay model) | Tasks 1, 8, 9 |
| Wooden board background + bowl + emoji ingredients | Task 2 |
| Matter.js + attractors plugin | Tasks 4, 6 |
| DOM rendering (per-frame `transform` write) | Task 4 |
| Tilt → gravity with low-pass filter | Task 5 |
| Magnetic attractor function & pull radius | Task 6 |
| Snap-and-lock detection + bowl-slot animation | Task 7 |
| Win detection (`allLocked`) | Task 8 |
| Sound: thunk + chime | Tasks 7, 8 |
| iOS permission gate | Task 9 |
| Desktop fallback (no motion → "open on phone" msg) | Task 9 |
| Pure helpers extracted + tested | Task 3 |
| Home-page link | Task 10 |
| On-phone tuning | Task 11 |
