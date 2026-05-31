# Tilt-to-Guac game — design

A single-screen browser toy. The player tilts their phone to roll three
ingredients — avocado, onion, pepper — across a wooden board into a bowl in
the middle. When all three are in the bowl, they win. Lives at
`Guac Off 2026/tilt/`, linked from the home page.

## Goals

- **Feels incredible.** The reason it exists. Tilting, rolling, snapping into
  the bowl should be satisfying enough that the player wants to do it again.
- **Mobile-only, mobile-instant.** Open the URL on a phone, tap once for
  motion permission, play.
- **30-second toy.** No levels, no score, no progression. One screen, one
  win condition, one reset.

## Out of scope

- Levels, difficulty escalation, score, timer, persistence.
- Multiplayer / sharing / leaderboards.
- Desktop play mode (mouse-drag fallback). Desktop visitors get a
  "open on your phone 📱" message.
- Sound files. All audio is synthesized in-page.

## User flow

Three screen states, all in the same `index.html`:

1. **Cover** — wooden board with a centered "🥑 Tap to play" pill button.
   Subline: "Tilt your phone to roll the ingredients into the bowl." If on
   desktop, instead: "Best on a phone — open this URL on your phone 📱".
   Tapping the button calls `DeviceMotionEvent.requestPermission()` and
   `DeviceOrientationEvent.requestPermission()` (iOS gesture gate), inits
   `AudioContext`, then transitions to **Playing**.
2. **Playing** — board, bowl, three ingredients. Tilt drives gravity.
   Magnetic attractor at the bowl. When all three lock in, advance to **Won**.
3. **Won** — board dims slightly, soft green glow around the bowl, caption
   "Guac is served 🥑" fades in, soft chime plays. Tap anywhere = back to
   Cover (which is effectively a reset — ingredients respawn at random
   starting positions on the next play).

## Architecture & file layout

Vanilla static-site pattern, matching the existing `Guac Off 2026/game/`:

```
Guac Off 2026/tilt/
  index.html        # board container, overlays, ingredient/bowl divs
  index.css         # wooden board, bowl, cover screen, win state
  index.js          # ~250 lines: Matter.js setup, tilt handler, snap, screens
  vendor/
    matter.min.js              # Matter.js
    matter-attractors.min.js   # attractors plugin
```

Linked from `Guac Off 2026/index.html` — exact placement to be confirmed in
implementation, but the intent is a small unobtrusive link near the
"Guac-y Road" entry point.

**Why Matter.js (and not hand-rolled physics):** the magnetic snap and bouncy
collisions need to feel right out of the box. Bundle size (~80kb minified)
is acceptable for a feel-first toy.

**Rendering:** DOM-based, not canvas. Each ingredient is a `<div>` containing
the emoji glyph at `font-size: 3rem`. On each `requestAnimationFrame`, after
`Engine.update`, we read `body.position` and `body.angle` and write
`transform: translate(...) rotate(...)` to the matching div. Emoji glyphs
render crisply as fonts in DOM — better than `ctx.fillText` on canvas.

## Gameplay mechanics

### Tilt → gravity

`window.addEventListener('deviceorientation', ...)` gives `beta`
(front-back tilt, degrees) and `gamma` (left-right tilt, degrees). We map to
Matter's gravity vector:

```
engine.gravity.x = clamp(gamma / 30, -1, 1) * STRENGTH
engine.gravity.y = clamp(beta  / 30, -1, 1) * STRENGTH
```

`STRENGTH ≈ 1.2`. Normalizing by 30° means a ~30° tilt gives full gravity.
We low-pass filter the readings: `smoothed = smoothed * 0.85 + raw * 0.15`
so jittery hands don't make the ingredients vibrate.

### Edges and bodies

- Play area is bordered by four invisible static walls.
- Three ingredients as `Matter.Bodies.circle(x, y, ~28px)`. Properties:
  `restitution: 0.35`, `friction: 0.02`, `frictionAir: 0.02`,
  `density: 0.001`.
- Walls: `restitution: 0.55`.

Tuning target: a strongly-tilted ingredient crosses the board in ~1 second
and bounces off the far wall with about half its incoming energy. These are
starting numbers — tuned by feel during implementation.

### Magnetic bowl

The bowl is a static body at the center with no collision and an attractor
function:

```js
attractor(bowl, body) {
  const dx = bowl.position.x - body.position.x
  const dy = bowl.position.y - body.position.y
  const dist = Math.hypot(dx, dy)
  if (dist > BOWL_PULL_RADIUS) return null   // ≈ board width * 0.35
  const strength = (1 - dist / BOWL_PULL_RADIUS) * PULL_GAIN  // ≈ 0.00018
  return { x: dx * strength, y: dy * strength }
}
```

Inside the pull radius, force scales linearly with closeness — the closer the
ingredient gets, the harder the yank. Outside the radius, no effect.

### Snap-and-lock

Each tick, for each unlocked ingredient, check:

- `distance(body, bowlCenter) < SNAP_RADIUS` (≈ bowl-radius × 0.4), AND
- `speed(body) < SNAP_SPEED` (≈ 1.5 px/frame).

When both hold: set `body.isStatic = true` (Matter removes it from
simulation), animate the div's position to a fixed slot in the bowl
(3 slots in a tight triangle), and play a soft "thunk". Mark `locked = true`.

Locked ingredients never move again. Once all three are locked, advance to
the won screen.

### Win detection

After each engine step: if `ingredients.every(i => i.locked)`, transition to
**Won**.

## Visual design

### Wooden board

```css
.board {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255,240,200,0.22), transparent 55%),
    repeating-linear-gradient(94deg,
      #a87547 0px, #a87547 38px,
      #9c6b3f 38px, #9c6b3f 76px),
    #a87547;
  box-shadow: inset 0 0 60px rgba(0,0,0,0.25);
  border-radius: 14px;
}
```

Three layers: a radial highlight (top-left light), repeating grain bands,
and a base color. Inset shadow rounds the edges visually.

### Bowl

A single absolutely-positioned div, rendered as concave dark wood:

```css
.bowl {
  width: 42%; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #5c3a1e, #2a1808 80%);
  box-shadow:
    inset 0 -8px 18px rgba(0,0,0,0.55),
    0 10px 20px rgba(0,0,0,0.4);
}
```

The inset gradient makes it look concave; the outer shadow makes it sit on
the board rather than float.

### Ingredients

Each `<div>`: `font-size: 3rem; line-height: 1; user-select: none;` with
`filter: drop-shadow(0 4px 4px rgba(0,0,0,0.35))`. The drop shadow gives
weight — they look like they're sitting on the board. The set is fixed:
🥑 avocado, 🧅 onion, 🌶️ pepper.

### Snap animation

When an ingredient locks, add a class with
`transition: transform 200ms cubic-bezier(.2, .8, .3, 1.2)`. The slight
overshoot makes the bowl feel like it grabbed the ingredient. The target
transform places it in one of three pre-defined bowl slots.

### Win state

Board CSS-transitions to `filter: brightness(0.85) saturate(0.9)`, a soft
green glow fades in around the bowl via `box-shadow` interpolation, and a
two-line caption fades in below: "Guac is served 🥑" (larger) and "tap to
play again" (smaller, lower opacity). Tap anywhere on the board = reset.

### Cover screen styling

Same wooden board background, with a dark pill button centered:
"🥑 Tap to play". The button has a neon-green border (1.5px solid #39ff14)
that ties faintly to the main site's vaporwave palette without overpowering
the new aesthetic. Subline text is in a warm cream color
(`color: #f5e6c8`) over the wood.

## Sound

All synthesized in `AudioContext`, ~30 lines total:

- **Thunk** (on each ingredient lock): short low-frequency hit (~80Hz sine,
  100ms exponential decay) + a tiny noise burst (~30ms, lowpassed).
- **Chime** (on win): three ascending notes (e.g. C5 → E5 → G5), 80ms each,
  short attack, ~400ms tails.

Audio is muted until the first user gesture (browser autoplay policy). The
"Tap to play" button is that gesture. If `AudioContext` init fails, the
game plays silently — no error, no fallback.

## Permission handling & desktop fallback

**iOS motion permission gate.** Since iOS 13, `DeviceMotionEvent.requestPermission()`
and `DeviceOrientationEvent.requestPermission()` must be called from a
user-gesture handler. The "Tap to play" button is that handler.

- If both permissions resolve to `"granted"` → start the game.
- If either resolves to `"denied"` → stay on cover with the message
  "Motion access is needed — refresh and tap Allow to play." No silent retry.

**Non-iOS browsers** (Android Chrome, etc.) don't have a permission API for
motion — events fire freely. We detect this by checking whether
`DeviceMotionEvent.requestPermission` is a function; if not, skip the
permission call and start the game directly on tap.

**Desktop detection.** Listen for `deviceorientation` events. If no event
arrives within 1 second of attempting to start, treat as desktop: show the
"open on your phone 📱" message on the cover. Belt-and-suspenders: also
check `'ontouchstart' in window` as a hint.

## Testing approach

The interesting logic is small enough to extract as pure functions:

- `tiltToGravity(beta, gamma) → {x, y}`
- `shouldLock(distance, speed) → boolean`
- `allLocked(ingredients) → boolean`
- `slotPositions(bowlCenter, bowlRadius, n) → [{x, y}, ...]`

A minimal `index.test.html` page loads these from `index.js` and runs ~10
assertions in a browser, printing pass/fail to the DOM. No test framework.
Physics feel itself is play-tested on a real phone — there's no automated
substitute.

## Open questions deferred to implementation

- **Exact home-page link placement.** Where on `Guac Off 2026/index.html`
  the tilt-game link appears. Try one spot, see if it reads.
- **Physics tuning constants.** All `STRENGTH`, `PULL_GAIN`, `SNAP_RADIUS`,
  `SNAP_SPEED`, restitution values are starting estimates — final values
  determined by playing on a real phone.
- **Whether the wooden-board cover-screen "Tap to play" pill needs a
  small idle animation** (subtle pulse?) to invite the tap. Decide during
  implementation; default no animation.
