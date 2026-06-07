# Waterfall — Photoreal Water Effect — Design Spec

- **Date:** 2026-06-07
- **Branch:** `waterfall` (off `main`)
- **Status:** Implemented & merged to `main`. Helpers node-tested; engine ported faithfully; visual fidelity confirmed by the user — incl. an even-splash tuning pass (`MAX_SPLASH` 6000, splash crown floor 0.9, default `splash` 1.4, `speed` 0.6).
- **Source handoff:** `docs/design_handoff_waterfall/` (README + `waterfall.js` reference impl + screenshots + `fountain.png`). `waterfall.js` is the authoritative simulation reference; port it faithfully.

## Summary

A new standalone page, `/waterfall/`, recreating the design handoff's ambient, photoreal water effect over the cleaned Vaillancourt Fountain photo. Water pours from 8 hand-placed spouts, accelerates under gravity, frays into droplets/mist, and splashes into the pool with foam and ripples — rendered with Canvas 2D (additive `screen` blend) over the photo. Interactive: click a spout to toggle it; the cursor pushes the spray like wind. Ported to this repo's vanilla, no-build pattern (sibling to `fountain/`, `tilt/`, `find/`).

It coexists with the existing `fountain/` tilt-to-pour phone toy — different piece, same subject.

## Decisions (from brainstorming)

- **Keep `fountain.png`** (the cleaned 2034×1136 plate) → the 8-spout table ports **verbatim**.
- **Drop the React/Babel Tweaks panel.** Ship the ambient effect + click-toggle + cursor gust at the "Steady" defaults. Keep the **debug-hash overrides** so preset/zoom states (e.g. "Raging") are reachable by URL without a panel.
- **New `/waterfall/` page, linked from the home footer** like the other interactions.

## Architecture

### File layout (`Guac Off 2026/waterfall/`)

```
index.html        stage + letterboxed 2034×1136 frame + <img> plate + <canvas id="water"> + hint pill
index.css         black radial stage, frame/plate/canvas layering, hint-pill design tokens
engine.js         createWaterfall({ canvas, config, spouts }) -> { destroy }   (the simulation)
index.js          the view: build config, mount the engine, hint-pill fade, lifecycle
spouts.js         the hand-tuned 8-spout table (the re-author-for-new-image target)
helpers.js        pure math (timeOfFlight, impactX, tintStr, emitStep) + physics constants K
helpers.test.js   node tests for the pure math
assets/fountain.png   the cleaned plate (copied from the handoff)
```

Script load order in `index.html`: `helpers.js` → `spouts.js` → `engine.js` → `index.js`.

### Engine ↔ view split (the vanilla mapping of "component/view")

- **`engine.js`** is the ported simulation as a **factory**: `createWaterfall({ canvas, config, spouts })` sets up the canvas + 2D context, the four plain particle arrays (`stream`, `mist`, `splash`, `ripples`), the pointer/click listeners, and the `requestAnimationFrame` loop; it returns **`{ destroy() }`** which cancels the rAF loop and removes its listeners. This is the mount/unmount lifecycle in vanilla terms.
- **`index.js`** is the wrapper that *owns the canvas element and lifecycle*: parses the debug hash into a config (over the defaults), grabs the `<canvas>`, calls `createWaterfall(...)` on `DOMContentLoaded`, runs the hint-pill fade, and may call `destroy()` on `pagehide`/`beforeunload`. Includes the standard service-worker-unregister snippet.

### State management (per the README's rule)

- **Particle arrays stay plain and internal** to the engine — never reactive/observed.
- The **only shared, mutable state** is the **config object** (passed into `createWaterfall`, read every frame) and each **`spout.on` flag** (toggled by clicks, read every frame). We **drop the `window.WATER` / `window.WATER_SPOUTS` globals** in favor of the passed-in config + spouts array (the README's prescribed framework-port replacement). `onSpoutToggle` is unneeded without a panel.

### Layering & coordinate system (verbatim from handoff)

- Back-to-front: black radial-gradient stage → `fountain.png` (`<img>`) → transparent water `<canvas>` (same box, `position:absolute; inset:0`).
- All physics/spout data are in **image space (2034×1136)**. Each frame the context is scaled by `S = backingStoreWidth / 2034` via `ctx.scale(S, S)`. Backing store width capped at 1900px, DPR capped at 2. Port `resize()` as-is.

## Fidelity — port requirements

`engine.js` must preserve, **verbatim from `waterfall.js`**:

- **Constants ("the real tokens"):** `GRAV = 0.34`; caps `MAX_STREAM 9000`, `MAX_MIST 2600`, `MAX_SPLASH 2600`; tail factors `1.7` (stream) / `1.5` (splash); coeffs — fall emission `0.9`, jet emission `1.05`, wind `0.018`, mouse-gust radii `22000` / `30000` px², foam squash `0.4`, ripple squash `0.32`.
- **Time scaling:** `dtMs = now - last` clamped to ≤ 60ms; `dt = (dtMs / 16.6667) * config.speed`; `dt` multiplies every integration step and every emission rate.
- **The three look-critical details:**
  1. **Smooth fractional emission** — per-spout accumulator (`acc += rate; n = floor(acc); acc -= n`), never random rounding. Extracted as the tested `emitStep(acc, rate) → { n, acc }` helper.
  2. **Velocity-based motion-blur tails** — draw each droplet from `(x − vx·TAIL, y − vy·TAIL)` to `(x, y)` (`TAIL` 1.7 stream / 1.5 splash), **not** from `px,py`.
  3. **Clock-driven foam speckles** — seeded off `time` (e.g. `seed = i*12.9898 + s.x*0.7`), never re-randomized each frame.
- **Render order** (inside `ctx.scale(S,S)`, `globalCompositeOperation = 'screen'`): mist blobs → ripple ellipses → stream ribbons (per active spout) → stream streaks → splash streaks → foam glow (squashed radial + clock speckles).
- **Ribbon path** matches droplet physics: sample `t ∈ [0, tFall]` with `x(t) = spoutX + lean·t + 0.5·wind·0.018·t² + sineWobble`, `y(t) = spoutY + v0·t + 0.5·GRAV·t²`, `tFall = (−v0 + sqrt(v0² + 2·GRAV·drop)) / GRAV`. Impact x uses the same `tFall` (do **not** linear-lerp).
- **`behind` spout handling** (the "Hidden spill"): no splash/foam/ripple; ribbon gradient and per-droplet alpha ramp to 0 between 50–72% of the drop, so it reads as disappearing behind the foreground block. `splashY` is the occlusion line.

## Spouts (image-coupled data, `spouts.js`)

Ported verbatim from the handoff (authored against `fountain.png`); 8 `fall` spouts (`BL, L, A, B, H, DH, D, R`), each `{ id, kind, x, y, w, v0, lean, splashY, on, behind? }`. Includes the field-meaning comment. This is the single file to re-author if the background image ever changes. The engine's `jet` kind is supported but unused (no jet spouts) — out of scope to exercise.

## Config & interactions

- **Config** (defaults, all live-readable): `flow 1.0`, `spray 1.0`, `splash 1.0`, `wind 0.0`, `speed 1.0`, `ripples true`, `mist true`, `tint [232,244,255]`.
- **Click** → toggle nearest spout (hit-test: center = midpoint of `y..splashY`, x-weighted by 0.6, within ~170px image-space).
- **Pointer-move** → localized gust (stream within ~22000 px², mist within ~30000 px²); strength scales with cursor velocity; stops on `pointerleave`.
- **Hint pill** — "click a stream to toggle it · move the cursor to push the spray"; fades after 7s or first click.
- **Debug hash** (kept): `#zoom=cx,cy,scale&flow=..&spray=..&splash=..&wind=..&speed=..` overrides config (and optional frame zoom) on load. The only runtime path to presets like "Raging" now that the panel is dropped.

## Pure helpers (`helpers.js`) + tests

Pure, dual-mode (browser + node) export; unit-tested in `helpers.test.js` (node runner, matching `find/`/`fountain/`):
- `timeOfFlight(v0, grav, drop)` → `(−v0 + sqrt(v0² + 2·grav·drop)) / grav`.
- `impactX(spout, grav, wind, windCoeff)` → `spout.x + spout.lean·tFall + 0.5·wind·windCoeff·tFall²`.
- `tintStr(tint, a, lighten)` → `rgba(...)` with per-channel clamp to 255.
- `emitStep(acc, rate)` → `{ n: floor(acc+rate), acc: frac }` (the smooth-emission accumulator).
- `K` — exported physics constants (IMG dims, GRAV, caps, coeffs) as the single source of truth.

The stateful simulation (pools, spawn/update/render, listeners, loop) lives in `engine.js` and is verified by serving the page + visual review against the screenshots.

## Assets & handoff housekeeping

- Copy `fountain.png` (2034×1136) into `waterfall/assets/fountain.png` (the shipped plate).
- Rename the handoff folder `docs/design_handoff_waterfall 2/` → `docs/design_handoff_waterfall/` (the `" 2"` is an iCloud conflicted-copy artifact per the known hazard) and keep it as committed design reference.

## Mobile

Desktop-first ambient piece. It renders on mobile (the letterboxed 16:9 frame scales; tap toggles spouts) but the cursor gust is pointer-only and the frame is small in portrait. We make it render cleanly on mobile; we do **not** redesign it for touch. (Noted because the repo's other pages are phone-first.)

## Home link

Add a footer link in `Guac Off 2026/index.html` beside the others, e.g.:
`💦 watch the fountain flow` → `waterfall/`.

## Testing

`node "Guac Off 2026/waterfall/helpers.test.js"` for the pure math. Engine/visual verified by serving `/waterfall/` and matching screenshots `01` (Steady default) and `02` (behind-spill fade); `03` (Raging) reachable via debug hash.

## Out of scope (YAGNI)

- The React/Babel Tweaks panel and its presets/swatches UI.
- The upward `jet` spout kind (supported in the engine, no data uses it).
- A WebGL/instanced port (Canvas 2D meets 60fps at default densities on desktop).
- Touch-specific redesign / mobile gust.
