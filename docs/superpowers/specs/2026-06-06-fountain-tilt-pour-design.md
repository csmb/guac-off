# Fountain Tilt-to-Pour — Design Spec

- **Date:** 2026-06-06
- **Branch:** `vaillancourt_fountain` (off `main`)
- **Status:** Approved design → writing implementation plan next
- **Project:** Guac Off 2026 (`Guac Off 2026/`)

## Summary

A new standalone page, `/fountain/`, showing the Vaillancourt Fountain on a black
background. Water continuously pours from the fountain's spouts, and the phone's
tilt sets the direction of gravity: tilt left and the water sheets left, hold the
phone upright and it falls straight down, tilt back and it arcs. It's a calm
sandbox toy — no goal, no score, just satisfying to play with.

It is a sibling to the existing `tilt/` and `find/` pages and reuses their proven
device-orientation machinery.

## User experience

1. Open `/fountain/` on a phone. Black screen, grayish fountain, a "Tap to start"
   cover (mirrors `tilt/`).
2. Tap → native iOS motion-permission prompt (when applicable) → water begins.
3. Water streams from ~5 spouts. Tilting the phone redirects the flow in real time.
   Droplets fall off-screen or splash into a faint pool at the bottom.
4. Desktop fallback: if no orientation events arrive within 1s, show "Best on a
   phone" (mirrors `tilt/`).

## Non-goals (v1)

YAGNI — each is easy to add later and explicitly out of scope now:

- No goal / targets / score (pure sandbox).
- No water-collides-with-the-concrete cascading (water ignores fountain geometry;
  it only obeys gravity and screen/pool bounds).
- No homepage link required — treat as a standalone/easter-egg URL like `find/`.
- Water sound is a low-priority stretch, not in v1.

## Architecture

### File layout (mirrors `tilt/` and `find/`)

```
Guac Off 2026/fountain/
  index.html        page markup + cover screen
  index.css         black bg, full-screen canvas layer, cover styling
  index.js          DOM, permission flow, particle loop (impure)
  helpers.js        pure, testable functions + tunable constants (dual-mode export)
  helpers.test.js   node test runner for helpers.js
  assets/           fountain image (placeholder now, real cutout later)
```

`helpers.js` follows the `find/` dual-mode pattern: it attaches to
`window.FountainHelpers` in the browser **and** `module.exports` for Node, so
`helpers.test.js` can `require('./helpers.js')`.

### Layering (DOM, painted back-to-front)

1. `body` — solid black (`background: #000`).
2. `<img class="fountain">` — the grayish fountain cutout, centered and contained.
3. `<canvas>` — transparent, full-viewport, water drawn on top each frame.
4. `.overlay.cover` — the tap-to-start screen (reused pattern).

Water in front of the fountain image is the simplest correct read (the spouts are
the front-facing tube mouths). Drawing water on a separate canvas means the
fountain image is painted once by the browser, not redrawn per frame.

### Reuse from `tilt/`

Copied/adapted (kept self-contained per the project's one-`helpers.js`-per-page
convention rather than cross-importing):

- **iOS 13+ permission flow** — `requestMotionPermission()` and the strict
  gesture-frame discipline (no `await` before `DeviceOrientationEvent.request
  Permission()`; fire `audioCtx.resume()` without awaiting). This is the single
  most failure-prone part of any tilt feature; we reuse it verbatim.
- **Cover screen + desktop fallback** — tap-to-start, 1s no-event fallback message.
- **`tiltToGravity(beta, gamma)`** math and smoothing of `beta`/`gamma`.

## The water model

### Spout config (art-specific data)

A `SPOUTS` array. Each spout:

```js
{ x, y,        // position as FRACTIONS [0..1] of the fountain image's box
  dir,         // base emission angle in radians (canvas convention: +y is down,
               //   so straight-down ≈ +PI/2; down-left ≈ ~2.36)
  spread,      // angular jitter (radians) added per droplet
  speed,       // initial speed (px/s)
  rate }       // emission rate (droplets/s)
```

Stored as fractions so it scales to any screen and survives an art swap. v1 ships
~5 **placeholder** spouts measured from the provided photo, clearly marked
`PLACEHOLDER — replace when final art lands`.

### Particle lifecycle

A particle is `{ x, y, vx, vy, px, py, life }` (`px/py` = previous position, for
streak rendering).

- **Spawn** at a spout: screen position from `spoutToScreen(spout, imgBox)`;
  velocity from `spawnVelocity(dir, spread, speed, rnd)` =
  `{ vx: cos(a)*speed, vy: sin(a)*speed }` where `a = dir + (rnd-0.5)*spread`.
- **Integrate** (semi-implicit Euler, per-frame `dt` in seconds):
  `vx += gx*dt; vy += gy*dt; vx*=(1-DRAG*dt); vy*=(1-DRAG*dt);`
  `px=x; py=y; x += vx*dt; y += vy*dt; life -= dt`.
- **Death** (`isDead`): `life <= 0`, OR outside viewport + margin, OR below the
  pool line (→ brief splash, then removed).

### Gravity from tilt

`gravityPx(beta, gamma)` = `tiltToGravity(beta, gamma)` scaled by `GRAVITY_SCALE`
into px/s². Using `tilt/`'s mapping (`TILT_FULL_DEG = 30`, `STRENGTH = 1.2`):

- Held upright (the natural viewing pose, `beta ≈ 90`) → gravity points **down**
  → water falls. Correct default with no conscious tilting.
- `gamma` (roll) shifts gravity left/right; `beta` shifts it up/down.
- Full directional freedom: tilt hard and water sheets sideways or even upward.
- **Calibration note:** the exact sign of "tilt left → water left" depends on
  device-orientation conventions; verify on-device and flip the `x` sign if needed.
  This is a tuning step, not a code-structure decision.

`beta`/`gamma` are low-pass smoothed (`s = s*0.85 + raw*0.15`) as in `tilt/`.

### Pool & bottom

A faint pool band near the bottom (`POOL_FRAC` of viewport height) with a soft
shimmer. Droplets crossing it produce a tiny splash and are removed. Because
gravity can point any direction, the general death rule is "left the viewport (any
side)"; the pool is the special case at the literal bottom.

### Performance

- `MAX_PARTICLES` cap (~800); particles are **pooled** (fixed array + free list)
  to avoid GC churn.
- Per-spout emission uses a time accumulator (`acc += rate*dt`) so flow is
  framerate-independent; emission is throttled when at the cap.
- Canvas sized for `devicePixelRatio` clamped to 2.
- Streak rendering (one `moveTo/lineTo` from `px,py` to `x,y`) — cheap and reads
  as flowing water; overlapping translucent streaks brighten naturally.

### Visual

Black background, grayish fountain (the image), water as white with a slight blue
tint, semi-transparent, drawn as streaks with a subtle glow. High contrast on
black makes the water pop.

## Pure helpers (`helpers.js`)

Pure and unit-tested:

- `tiltToGravity(beta, gamma) -> {x, y}` (reused mapping)
- `gravityPx(beta, gamma) -> {x, y}` (scaled to px/s²)
- `spawnVelocity(dir, spread, speed, rnd) -> {vx, vy}`
- `integrate(p, gx, gy, dt, drag) -> p` (advances one tick; returns updated fields)
- `isDead(p, bounds) -> boolean`
- `spoutToScreen(spout, imgBox) -> {x, y}`
- `SPOUTS` (placeholder data) and a `constants` block — the tunable dials:
  `GRAVITY_SCALE, EMIT_RATE, INIT_SPEED, SPREAD, PARTICLE_LIFE, DRAG, STREAK_LEN,
  MAX_PARTICLES, POOL_FRAC, TILT_FULL_DEG, STRENGTH`, water colors.

`index.js` owns everything impure: layout/`imgBox` computation, the permission and
cover flow, the orientation listener, the `requestAnimationFrame` loop, the
particle pool, resize handling, and canvas drawing.

## Placeholder & art swap-in

- Copy the provided photo into `assets/` as the placeholder and place ~5 spouts at
  its visible pour points, so physics is tuned against the real composition.
- When the final high-quality cutout + "where water falls" reference arrive, the
  swap is two changes: the `<img>` `src`, and the `SPOUTS` fractions. Tuned
  constants carry over (same view).
- Ideal final art: dry sculpture (water off) on transparency, so the black page
  shows through and no baked-in water fights the drawn water.

## Testing

`helpers.test.js`, run with `node "Guac Off 2026/fountain/helpers.test.js"`
(matches `find/helpers.test.js`'s self-contained `eq()` harness). Cases:

- `tiltToGravity`: upright (`beta=90`) → full-down, `x=0`; `gamma=30` → full-x;
  flat `(0,0)` → `{0,0}`; clamps beyond ±30°.
- `spawnVelocity`: `rnd=0.5` → angle == `dir`; resulting speed == `speed` (tol);
  `rnd=0` / `rnd=1` → angle == `dir ∓ spread/2`.
- `integrate`: one tick under gravity raises velocity and advances position as
  expected; `DRAG` reduces speed.
- `isDead`: in-bounds + life left → false; off each edge → true; `life<=0` → true;
  below pool → true.
- `spoutToScreen`: fraction maps into `imgBox` correctly (corners + center).

## Future (not now)

- Water cascading down the concrete (needs collision shapes traced from final art).
- A goal mode (fill a vessel / hit targets).
- Subtle water sound (WebAudio, following `tilt/`'s synth pattern).
- Homepage link / discoverability.
- Water-off, front-on transparent source art.
