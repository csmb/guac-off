# Fountain Water-Fill (Accumulating Pool) — Design Spec

- **Date:** 2026-06-07
- **Branch:** `fountain-water-fill` (off `main`)
- **Status:** Approved design → writing implementation plan next
- **Builds on:** the shipped `/fountain/` v1 (`Guac Off 2026/fountain/`)

## Summary

Make the falling water **accumulate**: instead of droplets vanishing at a fixed
line, each droplet that reaches the water surface is absorbed and raises a rising
pool. The pool's surface stays **perpendicular to gravity**, so tilting the phone
makes the whole pool slide to the low side and slosh, while the streams pour into
it. The pool rises until the screen is full (water creeps up over the fountain).
**Tap anywhere drains it** and play continues.

This replaces v1's faint static shimmer band at the bottom.

## User experience

1. Tap to start (unchanged). Water pours from the spouts (unchanged).
2. A translucent pool grows from the low side of the screen as droplets land in it.
3. Held normally, the pool fills bottom-up, level. Tilt the phone and the surface
   stays level to gravity — the pool slides to the low corner and sloshes (with a
   little lag), and the streams pour downhill into it.
4. The pool rises until the screen is full (submerging the fountain).
5. **Tap anywhere** → the pool drains (level eases to empty over ~0.8s) and keeps
   going.

## The model

- **`poolVol`** — count of absorbed droplets. **`fillFrac = clamp(poolVol /
  POOL_CAPACITY, 0, 1)`** — how full along the gravity axis (0 empty … 1 full).
  `POOL_CAPACITY` is tuned so a full screen takes ~20s of pouring.
- **Absorption:** each frame, a droplet that is *submerged* (below the surface
  line) is removed and `poolVol++`. Droplets that leave the screen elsewhere are
  lost (run off), as today.
- **Slosh:** the surface normal is the gravity direction, **smoothed with a little
  extra lag** (slower than the droplet gravity smoothing) so the surface eases/
  sloshes toward the new tilt rather than snapping.
- **Drain:** a tap sets `poolVol` easing toward 0 over `DRAIN_TIME` (~0.8s); when
  it reaches 0, normal accumulation resumes. (Taps are only active after start;
  the start button lives on the cover, which is already hidden by then.)

## Geometry (pure + testable)

All as pure helpers in `helpers.js`, unit-tested like the existing ones. The
surface is a line perpendicular to the down-vector at a projection `level`; the
pool is the screen rectangle on the "deeper" side of it.

- **`gravityDir(g) -> {x, y}`** — unit down-vector from a gravity vector. If
  `|g| < EPS` (phone flat), returns `{x:0, y:1}` (screen-down fallback).
- **`surfaceLevel(dir, w, h, fillFrac) -> number`** — the projection value of the
  surface. Project the four screen corners onto `dir` to get `[minProj, maxProj]`;
  return `maxProj - fillFrac * (maxProj - minProj)`. (`fillFrac=0` → surface at the
  deepest extent = empty; `fillFrac=1` → whole screen submerged = full.)
- **`isSubmerged(p, dir, level) -> boolean`** — `p.x*dir.x + p.y*dir.y >= level`.
- **`clipRectBelow(w, h, dir, level) -> [{x,y}, ...]`** — the polygon of the screen
  rect where projection `>= level` (Sutherland–Hodgman clip of the rect against the
  single half-plane). Returns the pool's fill polygon (0–6 vertices; empty when
  `fillFrac=0`). The render loop just paints this polygon; its top edge is the
  visible surface line.

Held normally (`dir≈{0,1}`): `surfaceLevel` collapses to a horizontal line at
`y = (1-fillFrac)*h`, and `clipRectBelow` is the bottom rectangle — i.e. a level
pool filling bottom-up. The tilted cases fall out of the same math.

## Rendering order (in the existing `tick`)

1. `clearRect`
2. **Streaks** (as today) — drawn first so they dim *into* the pool.
3. **Pool body** — fill `clipRectBelow(...)` with a translucent depth gradient
   (lighter at the surface, more opaque deep), `POOL_ALPHA`. Drawn over the
   fountain `<img>`, so the fountain submerges as the level rises.
4. **Surface line** — a brighter stroke along the polygon's top edge for a
   waterline shimmer.

One polygon fill + one stroke per frame on top of the existing batched streaks —
still 60fps. The cached static-band gradient (`poolGrad`) from v1 is removed.

## New constants (dials, in `helpers.js`)

`POOL_CAPACITY` (droplets to fill), `POOL_ALPHA` (body opacity), `DRAIN_TIME`
(seconds), `SURFACE_SMOOTH` (slosh lag factor), `GRAVITY_EPS` (flat-phone
threshold).

## Touched files

- `Guac Off 2026/fountain/helpers.js` — add `gravityDir`, `surfaceLevel`,
  `isSubmerged`, `clipRectBelow` + the new constants.
- `Guac Off 2026/fountain/helpers.test.js` — tests for the four helpers.
- `Guac Off 2026/fountain/index.js` — absorption into `poolVol`/`fillFrac`, smoothed
  surface normal, pool rendering, tap-to-drain handler. Remove the v1 static
  shimmer band (`poolGrad`) and the `POOL_FRAC` static line; `isDead` keeps
  handling life/off-screen (pass a non-triggering `poolY` so its pool clause stays
  inert — `isDead` itself is unchanged).

No HTML/CSS changes.

## Testing

`node "Guac Off 2026/fountain/helpers.test.js"`. New cases:
- `gravityDir`: straight-down vector → `{0,1}`; zero vector → `{0,1}` (fallback);
  `{3,4}` → `{0.6,0.8}`.
- `surfaceLevel`: `dir={0,1}`, `w=100,h=200` → `fillFrac=0`→200, `1`→0, `0.5`→100.
- `isSubmerged`: point below/above a horizontal surface; a tilted surface case.
- `clipRectBelow`: `dir={0,1}`, `level=100`, `100×200` → bottom-half rectangle
  `(0,100)-(100,100)-(100,200)-(0,200)`; `fillFrac=1` (level=min) → whole rect;
  `fillFrac=0` (level=max) → empty.

## Edge cases

- **Phone flat** (`|g|≈0`): `gravityDir` fallback → fills bottom-up.
- **Full** (`fillFrac=1`): caps; further droplets absorbed without raising level.
- **Mid-fill drain:** tap works at any level.
- **Tilt sign:** inherits v1's unverified-in-prod tilt mapping; the pool slosh uses
  the same gravity vector, so if the streams are mirrored the slosh is too — fixed
  by the same one-line `gamma` negation.

## Out of scope (YAGNI)

No real fluid/wave simulation, no foam or splash particles on impact, no drain
animation beyond the level easing down, no separate "full" celebration.
