# Guac Off 2026 — Game Polish (Arcade Vibe, SF Roadside, Drive-Into-The-Party)

**Date:** 2026-05-10
**Project:** `Guac Off 2026/` (static HTML/CSS/JS, no build step)
**Status:** Approved design, ready for implementation plan

## Goal

Polish the existing pseudo-3D racing game toward a high-energy arcade-racer feel (Out Run / Cruisin' USA), populate the world with SF-flavored roadside emoji sprites, and replace the bare finish-line text overlay with a "drive into the party" winners-circle moment.

This pass does NOT touch the existing pickup/obstacle/collision systems beyond rendering and HUD polish.

## Constraints

- Static site, no build step. Plain HTML + CSS + ES2015+ JS.
- No new image assets. SF sprites are emoji rendered to canvas via `ctx.fillText`.
- Mobile-responsive: must continue to work at the 768px mobile breakpoint introduced in the previous pass.
- Existing finish-line `raceFinished` flag stays the trigger for the new winners circle. The deceleration glide and party scene are additive.
- iOS Safari emoji rendering is the visual baseline. Other-OS variation is acceptable.

---

## Section 1 — Vibe Polish

Five touches that push toward an arcade-racer feel without changing gameplay rules:

### 1a. Pixel HUD redesign

Replace the existing white Arial `Score / Time / Speed` text (drawn at hardcoded canvas coords near 20,100/20,130/20,160) with Press Start 2P readouts.

- **SPEED** — top-right, big 3-digit readout, neon-green (`#39ff14`) with magenta drop-shadow (`#ff007f`), label `SPEED MPH` underneath in cyan (`#00ffff`).
- **SCORE** — top-left, 6-digit padded (`000250`), magenta with cyan shadow, label `SCORE`.
- **TIME** — below SCORE, formatted `01:23.4`, cyan with magenta shadow.

Uses the existing `var(--font-title)` Press Start 2P font already loaded by `index.html`. Canvas already resizes to its container (`#game-hero`'s `clientHeight`), so on mobile the canvas is smaller. HUD font sizes scale linearly with `canvas.height` — base sizes (28px score, 36px speed, 18px labels) at desktop ~600px canvas, reduced proportionally below that. Calculated once per `resizeCanvas()` call into a `hud` size object so the draw path reads `hud.scoreSize`, `hud.speedSize`, `hud.labelSize` rather than recomputing.

### 1b. Camera shake on collisions

On every cone hit (existing collision branch in `gameLoop`), set `screenShake = { frames: 6, magnitude: 8 }`. Each frame while `frames > 0`, the render translates the canvas context by `(random ± magnitude, random ± magnitude)` before drawing, then decrements and reduces magnitude proportionally. No change to actual game state — just a visual jolt.

### 1c. Speed lines

When `currentSpeed + speedBonus > 50`, draw 6–10 white tapered lines radiating from the road's vanishing point (around `width/2, height/2`) outward to the screen edges. Opacity scales with `(speed - 50) / 40`, clamped 0–0.6. Lines are randomized per frame so they shimmer. Drawn AFTER the road/sprite passes but BEFORE the HUD.

### 1d. Tighter countdown

The existing 3-2-1 sequence already uses different colors per number. Add:
- Press Start 2P font (was bold Arial).
- Scale-in animation: numbers start at 50% size, scale up to 100% over 200ms.
- A `GO!` flash at 0 in cyan with magenta shadow, full-screen brief flash white.

### 1e. Out of scope for this pass

- Dynamic music or audio.
- Engine-sound scaling.
- New vehicle types or animations.
- Pickup / obstacle / collision logic changes.
- Finish-line screen flash (explicitly declined by the user).

---

## Section 2 — SF Roadside Sprite System

### Architecture

A new sprite-rendering pipeline parallel to the existing obstacles/pickups system. All sprites are emoji glyphs rendered onto the canvas with `ctx.fillText`, scaled per-sprite by the same z-projection math used by obstacles.

Three categories:

1. **Backdrop landmarks** — large, rare, parallax. Render in the sky portion above the horizon.
2. **Roadside props** — common, flank the road. Render alongside the road like obstacles but off-road (|x| > 0.85).
3. **People & creatures** — occasional, some animated. Same lane as props.

Plus one separate atmospheric layer:

4. **Karl the Fog** — translucent particle overlay, drifts across the screen. Not a roadside sprite.

### Sprite library

Each sprite is an object with:

```js
{
  id: 'cable-car',
  emoji: '🚋',
  category: 'prop' | 'landmark' | 'person' | 'creature',
  baseSize: 80,                // px at z=0
  scenes: { mttam: 0, mission: 2, ggp: 0, market: 4 }, // weight per scene; 0 = never
}
```

Initial roster:

**Landmarks (large, rare, fixed z per scene):**
- 🌉 Golden Gate — visible from `mttam`, `ggp`
- 🏛️ Transamerica Pyramid — `market`, `mission`
- 📡 Sutro Tower — `mttam`, `ggp`
- 🏘️ Painted Ladies — `ggp`

**Roadside props (common):**
- 🚋 Cable car — `market` heavy
- 🚆 BART — `mission`, `market`
- 🚉 Caltrain — `ggp`, `mission`
- 🚊 F-line streetcar — `market`
- 🛴 Parked Lime scooter — all scenes
- 🚲 Parked bike — all scenes
- 🚒 Fire hydrant — all scenes
- 🌴 Palm tree — `mission`, `mttam`
- 🚏 Muni bus stop — `market`, `mission`
- 🌮 Taqueria sign — `mission` heavy
- 🗑️ Recology bin — `market`, `mission`
- 🅿️ Parking meter — `market`, `mission`

**People & creatures:**
- 🛹 Skater — `mission`, `mttam`
- 🐕 Dog walker — `ggp`, `mttam`
- 🎺 Mariachi — `mission`
- 🚴 Cyclist — `ggp`, `market`
- 🐦 Seagull — `mttam`, `ggp` (passes across screen, slight animation)
- 🦭 Sea lion — `mttam`, `ggp` only (rare)

**Atmospheric overlay:**
- 🌫️ Karl the Fog — always-on `mttam`, occasional on other scenes. Rendered as a separate translucent layer (see below), not a roadside sprite.

### Spawning

In `createRoad()`, after the existing obstacle/pickup spawn loop, add:

```js
for (let n = SPAWN_START; n < SPAWN_END; n++) {
  for (const side of ['left', 'right']) {
    if (Math.random() < ROADSIDE_RATE) {
      const sprite = pickSpriteForScene(currentRoad, 'prop');
      const x = side === 'left' ? -1.05 - Math.random() * 0.2 : 1.05 + Math.random() * 0.2;
      roadside.push({ z: n * segmentLength, x, side, sprite });
    }
    if (Math.random() < PERSON_RATE) { /* same for person/creature */ }
  }
}
```

- `ROADSIDE_RATE` ≈ 0.06 per segment per side (so ~12% per segment total across both sides).
- `PERSON_RATE` ≈ 0.02 per segment per side.
- `SPAWN_START` / `SPAWN_END` match the existing obstacle spawn window (`n > 12 && n < 225`).

**Landmarks** are spawned separately at fixed z positions per scene, picked from the scene's landmark roster:

```js
function spawnLandmarks(scene) {
  const positions = [12000, 28000, 42000]; // 3 fixed z points
  const landmarks = LANDMARKS.filter(l => l.scenes[scene] > 0);
  positions.forEach((z, i) => {
    if (landmarks[i % landmarks.length]) {
      roadside.push({ z, x: (i % 2 === 0 ? -0.3 : 0.3), side: 'horizon', sprite: landmarks[i % landmarks.length] });
    }
  });
}
```

The landmark `side: 'horizon'` is a sentinel that the render pass uses to draw the sprite in the sky region rather than along the road.

`pickSpriteForScene(scene, category)` returns a weighted-random sprite from the roster, filtered by category and scene weight > 0.

### Rendering

A new render pass after the rumble strips, before obstacles/pickups:

```js
function drawRoadside() {
  // sort back-to-front so closer sprites overlap farther ones
  const visible = roadside.filter(r => r.z > position && r.z < position + drawDistance * segmentLength);
  visible.sort((a, b) => b.z - a.z);

  for (const item of visible) {
    if (item.side === 'horizon') {
      drawHorizonSprite(item);
    } else {
      drawRoadsideSprite(item);
    }
  }
}
```

`drawRoadsideSprite` projects `{ x, z }` to screen using the same `project()` function obstacles use, then renders:

```js
const size = item.sprite.baseSize * scale; // scale from screenWidth/roadWidth
ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
ctx.textBaseline = 'bottom';
ctx.fillText(item.sprite.emoji, p.screenX - size/2, p.screenY);
```

`drawHorizonSprite` projects with a slower-scrolling z (parallax: maybe `position * 0.3` instead of full `position`), draws at a fixed height in the sky band, scales from tiny → large as the player approaches the fixed z position.

### Karl the Fog

Independent of the sprite system. Render after road but before HUD when `fogIntensity > 0`:

- Two or three drifting fog banks, each a horizontally-tiled emoji 🌫️ or a wide translucent white-gray gradient rectangle, scrolling left-to-right at scene-dependent speeds.
- `fogIntensity = 1.0` on `mttam`, `0.2` on `ggp`, `0` elsewhere.
- Suppressed during winners circle.

### Animations (light)

- **Seagull** — when spawned, `vx = ±1` so it drifts across the screen between frames; despawn when off-screen.
- **Sea lion** — bobs slightly (sin-wave on screenY by ±4px).
- All other sprites are stationary.

---

## Section 3 — Winners Circle / Drive Into The Party

Replaces the existing bare finish-line text overlay with a two-phase celebration.

### Phase 1 — Glide to a stop (~2 seconds)

When `raceFinished = true` becomes true (player crosses finish line):

- `decelStartTime = Date.now()`
- For the next 2000ms, `currentSpeed = currentSpeed_at_finish * (1 - elapsed / 2000)` (linear deceleration).
- `position` continues to advance during this window (so the world keeps scrolling, just slower).
- Steering still works — `targetPlayerX` continues to apply.
- Existing fanfare audio plays (already implemented).
- Screen-shake on collisions is disabled during the glide so it reads as a smooth landing.

When `Date.now() - decelStartTime >= 2000`, set `winnersCircleActive = true` and `currentSpeed = 0`.

### Phase 2 — Party scene (persistent until Play Again)

Once `winnersCircleActive` is true, the canvas renders:

**a) Continued road backdrop, frozen.** The last-rendered road frame stays on screen behind the party overlay. No further `position` updates.

**b) Confetti.** Particle system: ~80 small colored squares falling from y=−20 to y=height+20, with slight horizontal wind drift (sin-based). Colors from the info-section palette (`#1b4d3e`, `#ebd2b4`, `#ff5500`) plus white. Spawn rate replenishes as they fall off-screen. Continuous for the duration of the party scene.

```js
const confetti = []; // { x, y, vx, vy, color, rotation, rotationSpeed }
```

**c) Banner.** Press Start 2P text near the top:
```
🎉 WELCOME TO THE GUAC OFF 🎉
```
Cream `#ebd2b4` text with magenta shadow `#ff007f` for arcade flavor. Centered, bobs up/down by 4px on a slow sin wave.

**d) Party crowd.** A row of 8 party emojis along the bottom band of the canvas, just above the parked vehicle:
```
🥳 💃 🕺 🍻 🥑 🎺 🌮 🥑
```
Each one independently bobs (sin wave with random phase) so the crowd looks alive.

**e) Results card.** A centered panel styled like the existing menu overlay (dark `rgba(13, 2, 33, 0.9)` background, 4px magenta border, neon shadow). Contents:
- `FINAL SCORE: 250` (cyan, Press Start 2P)
- `FINAL TIME: 01:23.4` (neon-green, Press Start 2P)
- `[ PLAY AGAIN ]` button (magenta bg, cream text, same hover treatment as existing menu buttons)

The Play Again button is a real DOM button this time (not canvas hit-test), positioned via absolute coords inside `#game-hero`. Click handler resets game state exactly like the existing canvas-drawn Play Again does today.

**f) Karl the Fog suppressed.** `fogIntensity` overridden to 0 during `winnersCircleActive` so the party reads clearly.

### State machine

Two new flags on top of existing `raceFinished`:

| Flag | Set true when | Effects |
|---|---|---|
| `raceFinished` | player crosses finish (existing) | starts deceleration glide |
| `winnersCircleActive` | 2000ms after raceFinished | freezes position, renders party |

Both reset to false when Play Again restarts the game (existing reset paths just need to also reset `winnersCircleActive` and clear `confetti`).

The existing canvas-drawn Play Again button code can be removed (replaced by the DOM button in the results card).

---

## Files Touched

- `Guac Off 2026/index.js` —
  - Replace HUD draw block (currently `ctx.font='bold 30px Arial'; ctx.fillText('Score: …')` etc.) with Press Start 2P pixel HUD.
  - Add `screenShake` state and apply translation in `render()`.
  - Add speed-lines draw pass.
  - Tighten countdown styling.
  - Add `roadside[]` array, `SPRITE_LIBRARY`, `LANDMARK_LIBRARY`, `pickSpriteForScene()`, `spawnLandmarks()`.
  - Extend `createRoad()` with roadside + landmark spawning.
  - Add `drawRoadside()` render pass.
  - Add Karl the Fog overlay pass.
  - Add `winnersCircleActive`, `decelStartTime`, `confetti[]` state.
  - Replace finish-line overlay block with deceleration logic + party scene render.
  - Remove existing canvas-drawn Play Again hit-test (replaced by DOM button).

- `Guac Off 2026/index.css` — add styles for the new DOM Play Again button inside `#game-hero` (positioned, neon-style, hidden by default, shown via `winnersCircleActive`-driven class toggle).

- `Guac Off 2026/index.html` — add `<button id="party-play-again" type="button" hidden>PLAY AGAIN</button>` inside `#game-hero`.

No new files. No new image assets. No new dependencies.

## Explicit Non-Goals

- Pickup/obstacle/collision logic changes.
- New audio (no engine sound, no dynamic music, no new SFX beyond existing fanfare).
- New vehicle sprites or animations beyond the existing lean.
- Multi-lap or game-mode variants.
- Persistence (high scores, leaderboard).
- Pause-the-game-while-info-section-is-visible logic.

## Success Criteria

- The HUD reads as an arcade racer (chunky pixel font, neon colors, drop shadows) rather than generic Arial.
- Hitting a cone produces a perceptible camera-shake punch.
- At max speed, speed lines clearly indicate motion.
- Each of the four scenes (`mttam` / `mission` / `ggp` / `market`) feels visibly distinct because the roadside sprite mix changes.
- The player crosses the finish line, glides to a smooth stop, and arrives at a recognizable party scene with confetti, a banner, and a results card with PLAY AGAIN.
- No regression to: steering (gyro/mouse), pickup/obstacle behavior, menu/start flow, mobile layout, info section below the game.
- Verified by manual play on desktop + iOS Safari mobile.
