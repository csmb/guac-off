# Guac Off 2026 — Game Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push the existing racing game toward a high-energy arcade feel, populate the world with SF-flavored emoji sprites along the road, and replace the bare finish-line text overlay with a "drive into the party" winners circle.

**Architecture:** All work in three existing files. New state (sprite library, screenShake, confetti, decelStartTime, winnersCircleActive) is added top-of-file. Render pipeline gains four new passes (backdrop landmarks, roadside sprites, fog overlay, speed lines) and the finish-line overlay is replaced by a two-phase glide + party scene. The pickup/obstacle/collision logic is not touched.

**Tech Stack:** Plain HTML5 Canvas 2D + ES2015+ JavaScript + CSS. Press Start 2P + VT323 fonts already loaded. Dev server: `python3 -m http.server 8026 --bind 0.0.0.0`.

**Spec:** `docs/superpowers/specs/2026-05-10-game-polish-design.md` — read it before starting.

---

## File Structure

All changes touch three existing files. No new files.

| File | Responsibility | Change type |
|---|---|---|
| `Guac Off 2026/index.js` | Game logic — new state, sprite library, four new render passes, deceleration glide, party scene | Modify (significant additions) |
| `Guac Off 2026/index.css` | Style the new DOM "Play Again" button shown in the winners circle | Append only |
| `Guac Off 2026/index.html` | Add a single hidden `<button id="party-play-again">` inside `#game-hero` | Modify (single line insertion) |

The `index.js` file is ~1100 lines pre-change. This plan adds ~400 lines. Stays within manageable single-file scope for a static site.

## Setup — Dev Server

```bash
cd "Guac Off 2026"
python3 -m http.server 8026 --bind 0.0.0.0
```

Open http://localhost:8026/. Hard-reload (Cmd-Shift-R on macOS) after each change.

Verification is browser-based — this project has no automated test suite.

---

## Task 1: Pixel HUD redesign

**Why:** Replace the bland white Arial HUD (`Score: 250 / Time: 12.3s / Speed: 40 MPH`) with chunky Press Start 2P readouts in the existing neon palette so the game reads as an arcade racer.

**Files:**
- Modify: `Guac Off 2026/index.js` — the HUD drawing block around line 805–811 inside `gameLoop`'s render output, and the top of file for the new `hud` size object

- [ ] **Step 1: Add an HUD size object that scales with canvas height**

Find `function resizeCanvas() { … }` near the top of `Guac Off 2026/index.js`. Replace the entire function with:

```js
const hud = { scoreSize: 28, speedSize: 36, labelSize: 11, pad: 24 };

function resizeCanvas() {
    const hero = document.getElementById('game-hero') || canvas.parentElement;
    canvas.width = hero.clientWidth;
    canvas.height = hero.clientHeight;

    // Scale HUD font sizes off canvas height (baseline 600px)
    const k = Math.max(0.6, Math.min(1.3, canvas.height / 600));
    hud.scoreSize = Math.round(28 * k);
    hud.speedSize = Math.round(36 * k);
    hud.labelSize = Math.round(11 * k);
    hud.pad = Math.round(24 * k);
}
```

- [ ] **Step 2: Replace the canvas HUD draw block**

Find this block (around line 805–811):

```js
// Draw Score and Time
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 30px Arial';
ctx.fillText(`Score: ${score}`, 20, 100);
const displayTime = raceFinished ? elapsedTime : (gameStarted && !countdownActive ? ((Date.now() - startTime) / 1000) : 0);
ctx.fillText(`Time: ${displayTime.toFixed(1)}s`, 20, 130);
ctx.fillText(`Speed: ${Math.floor(currentSpeed)} MPH`, 20, 160);
```

Replace with:

```js
// Pixel HUD — top-left SCORE+TIME, top-right SPEED
const displayTime = raceFinished ? elapsedTime : (gameStarted && !countdownActive ? ((Date.now() - startTime) / 1000) : 0);
ctx.textAlign = 'left';
ctx.textBaseline = 'top';

// SCORE (top-left)
ctx.font = `${hud.labelSize}px "Press Start 2P", monospace`;
ctx.fillStyle = '#00ffff';
ctx.fillText('SCORE', hud.pad, hud.pad);
ctx.font = `${hud.scoreSize}px "Press Start 2P", monospace`;
ctx.fillStyle = '#000000';
ctx.fillText(String(score).padStart(6, '0'), hud.pad + 2, hud.pad + hud.labelSize + 4 + 2); // shadow
ctx.fillStyle = '#ff007f';
ctx.fillText(String(score).padStart(6, '0'), hud.pad, hud.pad + hud.labelSize + 4);

// TIME (below SCORE)
const min = Math.floor(displayTime / 60);
const sec = (displayTime - min * 60).toFixed(1).padStart(4, '0');
const timeStr = `${String(min).padStart(2, '0')}:${sec}`;
const timeY = hud.pad + hud.labelSize + 4 + hud.scoreSize + 16;
ctx.font = `${hud.labelSize}px "Press Start 2P", monospace`;
ctx.fillStyle = '#00ffff';
ctx.fillText('TIME', hud.pad, timeY);
ctx.font = `${Math.round(hud.scoreSize * 0.7)}px "Press Start 2P", monospace`;
ctx.fillStyle = '#000000';
ctx.fillText(timeStr, hud.pad + 2, timeY + hud.labelSize + 4 + 2);
ctx.fillStyle = '#39ff14';
ctx.fillText(timeStr, hud.pad, timeY + hud.labelSize + 4);

// SPEED (top-right)
const speedStr = String(Math.floor(currentSpeed)).padStart(3, '0');
ctx.textAlign = 'right';
ctx.font = `${hud.labelSize}px "Press Start 2P", monospace`;
ctx.fillStyle = '#00ffff';
ctx.fillText('SPEED MPH', width - hud.pad, hud.pad);
ctx.font = `${hud.speedSize}px "Press Start 2P", monospace`;
ctx.fillStyle = '#000000';
ctx.fillText(speedStr, width - hud.pad + 2, hud.pad + hud.labelSize + 4 + 2);
ctx.fillStyle = '#39ff14';
ctx.fillText(speedStr, width - hud.pad, hud.pad + hud.labelSize + 4);

ctx.textAlign = 'left';
ctx.textBaseline = 'alphabetic';
```

- [ ] **Step 3: Verify in browser**

Hard-reload http://localhost:8026/. Start a ride. Expected:

- Top-left: cyan "SCORE" label with magenta-on-black-shadow padded-6-digit number below.
- Below SCORE: cyan "TIME" label with neon-green-on-black-shadow `00:12.3` formatted time.
- Top-right: cyan "SPEED MPH" label with neon-green-on-black-shadow padded-3-digit speed.
- HUD scales smaller on mobile (resize browser to ~400px wide and confirm).

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: pixel HUD with Press Start 2P score/time/speed

Replaces the bland 30px Arial Score/Time/Speed text with three
neon arcade-style readouts: padded SCORE (magenta), formatted
TIME (neon green), padded SPEED (neon green). All scale with
canvas height via a new hud size object so the mobile canvas
gets proportionally smaller readouts."
```

---

## Task 2: Camera shake on collision

**Why:** Hitting a cone should feel like a physical jolt. A brief 6-frame translate of the entire canvas while drawing sells the impact without changing gameplay.

**Files:**
- Modify: `Guac Off 2026/index.js` — add `screenShake` state, update on collision, apply in render

- [ ] **Step 1: Add `screenShake` state**

Near the other game state declarations (around line 120–144, after `let speedBonus = 0;`), add:

```js
let screenShake = { frames: 0, magnitude: 0 };
```

- [ ] **Step 2: Trigger shake on cone hit**

Find the cone collision branch (around line 758–782). Inside the `if (Math.abs(playerX - o.x) < 0.1) { … }` block, just before `obstacles.splice(i, 1);`, add:

```js
                    screenShake = { frames: 6, magnitude: 8 };
```

- [ ] **Step 3: Apply shake in render**

Find the `function render() { … }` declaration. At the very top of the function body (before any other draw call), add:

```js
    let shakeX = 0, shakeY = 0;
    if (screenShake.frames > 0) {
        shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
        ctx.save();
        ctx.translate(shakeX, shakeY);
        screenShake.frames--;
        screenShake.magnitude *= 0.85; // decay
    }
```

Then find the matching end of the render function (just before the closing `}` of `function render()`) and add:

```js
    if (shakeX !== 0 || shakeY !== 0) {
        ctx.restore();
    }
```

Note: the shake wraps the render only, not the HUD drawing in `gameLoop` (which happens after `render()` returns). HUD stays stable — only the world shakes.

- [ ] **Step 4: Verify in browser**

Hard-reload, start a ride, and steer into a cone. Expected:

- Brief ~100ms shake of the road/scene while HUD stays put.
- After ~6 frames the world stops shaking.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: camera shake on cone collision

6-frame translate of the render context with decaying magnitude
whenever the player hits a cone. HUD stays stable since shake
wraps only render(), not the gameLoop HUD draw path."
```

---

## Task 3: Speed lines at high speed

**Why:** Visual reinforcement of speed — Out Run-style radial streaks emanating from the vanishing point when the player is moving fast.

**Files:**
- Modify: `Guac Off 2026/index.js` — add a draw pass at the end of `render()`

- [ ] **Step 1: Add `drawSpeedLines` helper near the other draw helpers**

Find `function drawRoadside` (which doesn't exist yet — for now find `function render()`). Just above `function render() {`, add:

```js
function drawSpeedLines() {
    const speed = currentSpeed + speedBonus;
    if (speed < 50) return;
    const alpha = Math.min(0.6, (speed - 50) / 40 * 0.6);
    const vx = width / 2, vy = height / 2;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 2;
    const n = 10;
    for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const r1 = 60 + Math.random() * 40;
        const r2 = Math.max(width, height) * 0.7;
        ctx.beginPath();
        ctx.moveTo(vx + Math.cos(angle) * r1, vy + Math.sin(angle) * r1);
        ctx.lineTo(vx + Math.cos(angle) * r2, vy + Math.sin(angle) * r2);
        ctx.stroke();
    }
    ctx.restore();
}
```

- [ ] **Step 2: Call it inside `render()` after vehicle drawing, before the shake `restore()`**

Find the bottom of `render()` — just before the `if (shakeX !== 0 || shakeY !== 0) { ctx.restore(); }` block (from Task 2), add:

```js
    drawSpeedLines();
```

- [ ] **Step 3: Verify in browser**

Hard-reload, start a ride. As you collect pickups and speedBonus climbs (or just at the start since max speeds for motorcycle/scooter are >50), white streaks should radiate from screen center. They shimmer (randomized each frame).

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: speed lines at high speed

When currentSpeed + speedBonus exceeds 50, draws ~10 white
tapered streaks radiating from the vanishing point with opacity
proportional to speed-over-50. Randomized per frame for shimmer."
```

---

## Task 4: Tighten the 3-2-1 countdown

**Why:** Existing countdown uses bold 100px Arial in switched colors. Bring it in line with the arcade-racer vibe — Press Start 2P, scale-in animation, GO! flash at zero.

**Files:**
- Modify: `Guac Off 2026/index.js` — the countdown render block around line 813–835

- [ ] **Step 1: Track countdown step start time for scale-in animation**

Near the other game state (around line 127–129), find:

```js
let countdown = 3;
let countdownActive = false;
let countdownStartTime = 0;
```

Add below:

```js
let countdownStepTime = 0;     // timestamp when current digit became active
let goFlashUntil = 0;          // timestamp until which GO! flash is visible
```

Then find the existing change-detection block in `gameLoop` (around lines 722–726):

```js
        if (countdown !== lastCountdown) {
            if (countdown > 0) playSound('beep_low');
            else if (countdown === 0) playSound('beep_high');
            lastCountdown = countdown;
        }
```

Inside that `if` block, immediately after `lastCountdown = countdown;`, add:

```js
            countdownStepTime = Date.now();
            if (countdown === 0) goFlashUntil = Date.now() + 400;
```

So the block reads:

```js
        if (countdown !== lastCountdown) {
            if (countdown > 0) playSound('beep_low');
            else if (countdown === 0) playSound('beep_high');
            lastCountdown = countdown;
            countdownStepTime = Date.now();
            if (countdown === 0) goFlashUntil = Date.now() + 400;
        }
```

- [ ] **Step 2: Replace the countdown render block**

Find the existing countdown render (around line 814–835):

```js
if (countdownActive) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("The Guac Off is starting soon!", width / 2, height / 2 - 150);
    ctx.font = '20px Arial';
    ctx.fillText("Collect ingredients and make your way to the party.", width / 2, height / 2 - 100);
    
    // Countdown
    if (countdown === 3) ctx.fillStyle = '#ff0000'; // Red
    else if (countdown === 2) ctx.fillStyle = '#ffff00'; // Yellow
    else if (countdown === 1) ctx.fillStyle = '#00ff00'; // Green
    else ctx.fillStyle = '#ff00ff';
    
    ctx.font = 'bold 100px Arial';
    ctx.fillText(countdown.toString(), width / 2, height / 2 + 50);
    
    ctx.textAlign = 'left'; // Reset
}
```

Replace with:

```js
if (countdownActive) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffff';
    ctx.font = `${Math.round(20 * (canvas.height / 600))}px "Press Start 2P", monospace`;
    ctx.fillText("THE GUAC OFF IS STARTING", width / 2, height / 2 - 150);
    ctx.font = `${Math.round(11 * (canvas.height / 600))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#ebd2b4';
    ctx.fillText("collect ingredients · reach the party", width / 2, height / 2 - 110);

    // Scale-in animation: start at 50%, ease to 100% over 200ms since this digit became active
    const elapsed = Date.now() - countdownStepTime;
    const scale = elapsed < 200 ? 0.5 + (elapsed / 200) * 0.5 : 1.0;
    const baseSize = Math.round(110 * (canvas.height / 600));
    const size = Math.round(baseSize * scale);

    let digitColor = '#ff00ff';
    if (countdown === 3) digitColor = '#ff007f';
    else if (countdown === 2) digitColor = '#ffff00';
    else if (countdown === 1) digitColor = '#39ff14';

    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText(countdown.toString(), width / 2 + 3, height / 2 + 50 + 3);
    ctx.fillStyle = digitColor;
    ctx.fillText(countdown.toString(), width / 2, height / 2 + 50);

    ctx.textAlign = 'left';
}

// GO! flash — fires when countdown hits 0 and lingers ~400ms
if (Date.now() < goFlashUntil) {
    const remain = (goFlashUntil - Date.now()) / 400;
    ctx.fillStyle = `rgba(255,255,255,${remain * 0.6})`;
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(140 * (canvas.height / 600))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText('GO!', width / 2 + 4, height / 2 + 50 + 4);
    ctx.fillStyle = '#00ffff';
    ctx.fillText('GO!', width / 2, height / 2 + 50);
    ctx.textAlign = 'left';
}
```

- [ ] **Step 3: Verify in browser**

Hard-reload, start a ride. Expected:

- The "GUAC OFF IS STARTING" header uses chunky pixel font.
- 3, 2, 1 each scale-in from small to full size, in distinct neon colors.
- At 0, a brief white screen flash with big cyan "GO!" appears for ~400ms then fades.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: pixel countdown with scale-in and GO flash

Replaces bold Arial countdown with Press Start 2P digits in
neon palette. Each digit scales from 50% to 100% over 200ms
when it becomes active (tracked by countdownStepTime). At 0,
fires a 400ms white screen flash with big GO! text."
```

---

## Task 5: Sprite library + spawning data structures

**Why:** Centralize the SF emoji sprite roster and the per-scene weights so the spawning logic and render pass can ask "what should I put here?" without inline lookup tables. Pure data + a pure picker function — no rendering yet.

**Files:**
- Modify: `Guac Off 2026/index.js` — add new constants and helper near other top-of-file declarations

- [ ] **Step 1: Add sprite library constants**

Near line ~159 (after the existing `const drawDistance = 200;`), append:

```js
// ===== SF emoji sprite roster =====
// Each entry: { id, emoji, category, baseSize, scenes: { mttam, mission, ggp, market } }
// `scenes` values are weights; 0 = never spawn on that scene.
const SPRITE_LIBRARY = [
    // Roadside props
    { id: 'cable-car',     emoji: '🚋', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 1, ggp: 0, market: 5 } },
    { id: 'bart',          emoji: '🚆', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 3, ggp: 0, market: 3 } },
    { id: 'caltrain',      emoji: '🚉', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 2, ggp: 3, market: 1 } },
    { id: 'f-line',        emoji: '🚊', category: 'prop',   baseSize: 110, scenes: { mttam: 0, mission: 1, ggp: 1, market: 4 } },
    { id: 'lime-scooter',  emoji: '🛴', category: 'prop',   baseSize:  70, scenes: { mttam: 1, mission: 3, ggp: 2, market: 3 } },
    { id: 'parked-bike',   emoji: '🚲', category: 'prop',   baseSize:  70, scenes: { mttam: 1, mission: 3, ggp: 4, market: 2 } },
    { id: 'hydrant',       emoji: '🚒', category: 'prop',   baseSize:  60, scenes: { mttam: 2, mission: 4, ggp: 3, market: 3 } },
    { id: 'palm',          emoji: '🌴', category: 'prop',   baseSize:  90, scenes: { mttam: 2, mission: 4, ggp: 1, market: 1 } },
    { id: 'muni-stop',     emoji: '🚏', category: 'prop',   baseSize:  70, scenes: { mttam: 0, mission: 2, ggp: 2, market: 4 } },
    { id: 'taqueria',      emoji: '🌮', category: 'prop',   baseSize:  80, scenes: { mttam: 0, mission: 5, ggp: 1, market: 2 } },
    { id: 'recology',      emoji: '🗑️', category: 'prop',   baseSize:  60, scenes: { mttam: 1, mission: 3, ggp: 2, market: 3 } },
    { id: 'meter',         emoji: '🅿️', category: 'prop',   baseSize:  60, scenes: { mttam: 0, mission: 3, ggp: 2, market: 4 } },
    // People & creatures
    { id: 'skater',        emoji: '🛹', category: 'person', baseSize:  70, scenes: { mttam: 3, mission: 3, ggp: 1, market: 1 } },
    { id: 'dog-walker',    emoji: '🐕', category: 'person', baseSize:  70, scenes: { mttam: 2, mission: 1, ggp: 4, market: 1 } },
    { id: 'mariachi',      emoji: '🎺', category: 'person', baseSize:  70, scenes: { mttam: 0, mission: 4, ggp: 1, market: 1 } },
    { id: 'cyclist',       emoji: '🚴', category: 'person', baseSize:  70, scenes: { mttam: 1, mission: 1, ggp: 4, market: 3 } },
    { id: 'seagull',       emoji: '🐦', category: 'creature', baseSize: 60, scenes: { mttam: 4, mission: 0, ggp: 3, market: 0 } },
    { id: 'sea-lion',      emoji: '🦭', category: 'creature', baseSize: 80, scenes: { mttam: 3, mission: 0, ggp: 2, market: 0 } },
];

const LANDMARK_LIBRARY = [
    { id: 'golden-gate',    emoji: '🌉', baseSize: 220, scenes: { mttam: 5, mission: 0, ggp: 4, market: 0 } },
    { id: 'transamerica',   emoji: '🏛️', baseSize: 200, scenes: { mttam: 0, mission: 3, ggp: 0, market: 5 } },
    { id: 'sutro',          emoji: '📡', baseSize: 200, scenes: { mttam: 5, mission: 1, ggp: 4, market: 1 } },
    { id: 'painted-ladies', emoji: '🏘️', baseSize: 200, scenes: { mttam: 0, mission: 0, ggp: 5, market: 0 } },
];

// Spawned items: { z, x, side: 'left'|'right'|'horizon', sprite }
const roadside = [];

function pickSpriteForScene(scene, category) {
    const pool = SPRITE_LIBRARY.filter(s => s.category === category && (s.scenes[scene] || 0) > 0);
    if (pool.length === 0) return null;
    const totalWeight = pool.reduce((sum, s) => sum + s.scenes[scene], 0);
    let r = Math.random() * totalWeight;
    for (const s of pool) {
        r -= s.scenes[scene];
        if (r <= 0) return s;
    }
    return pool[pool.length - 1];
}

function pickLandmarkForScene(scene) {
    const pool = LANDMARK_LIBRARY.filter(l => (l.scenes[scene] || 0) > 0);
    if (pool.length === 0) return null;
    const totalWeight = pool.reduce((sum, l) => sum + l.scenes[scene], 0);
    let r = Math.random() * totalWeight;
    for (const l of pool) {
        r -= l.scenes[scene];
        if (r <= 0) return l;
    }
    return pool[pool.length - 1];
}
```

- [ ] **Step 2: Clear `roadside` in `createRoad()` and add spawn loop**

Find `function createRoad()`. Near the top, where existing `obstacles.length = 0; pickups.length = 0;` lives, add:

```js
    roadside.length = 0;
```

Then find the existing per-segment spawn loop (the `if (n > 12 && n < 225) { … }` block inside the `for (let n = 0; n < 250; n++)` loop). Just BEFORE the closing `}` of that `if (n > 12 && n < 225)` block, add:

```js
            // Spawn roadside props (left and right)
            const ROADSIDE_RATE = 0.06;
            const PERSON_RATE = 0.02;
            for (const side of ['left', 'right']) {
                if (Math.random() < ROADSIDE_RATE) {
                    const sprite = pickSpriteForScene(currentRoad, 'prop');
                    if (sprite) {
                        const x = side === 'left' ? -1.05 - Math.random() * 0.2 : 1.05 + Math.random() * 0.2;
                        roadside.push({ z, x, side, sprite });
                    }
                }
                if (Math.random() < PERSON_RATE) {
                    const sprite = pickSpriteForScene(currentRoad, Math.random() < 0.5 ? 'person' : 'creature');
                    if (sprite) {
                        const x = side === 'left' ? -1.0 - Math.random() * 0.2 : 1.0 + Math.random() * 0.2;
                        roadside.push({ z, x, side, sprite });
                    }
                }
            }
```

- [ ] **Step 3: Spawn landmarks at fixed positions**

At the very end of `createRoad()` (just before the closing `}`), add:

```js
    // Fixed-position landmarks (parallax horizon)
    const LANDMARK_POSITIONS = [12000, 28000, 42000];
    LANDMARK_POSITIONS.forEach((z, i) => {
        const sprite = pickLandmarkForScene(currentRoad);
        if (sprite) {
            roadside.push({ z, x: (i % 2 === 0 ? -0.3 : 0.3), side: 'horizon', sprite });
        }
    });
```

- [ ] **Step 4: Verify**

Run:
```bash
node --check "Guac Off 2026/index.js"
```
Expected: empty (syntax OK).

In the browser console after a hard-reload:
```js
console.log('roadside count:', roadside.length);
console.log('first 3:', roadside.slice(0, 3));
console.log('horizons:', roadside.filter(r => r.side === 'horizon').length);
```

Expected: ~20–60 roadside entries (depends on scene), first few show valid `{ z, x, side, sprite }` shapes, exactly 3 horizon entries. NOTHING SHOULD RENDER YET — the render pass comes in Task 6.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: SF sprite library + spawn data

Adds SPRITE_LIBRARY (12 roadside props + 6 people/creatures),
LANDMARK_LIBRARY (4 landmarks), weighted picker functions, and
spawn-loop logic in createRoad(). No rendering yet — data only.
Verified by console: ~20-60 roadside entries plus 3 horizon
landmarks per generated track."
```

---

## Task 6: Render roadside sprites

**Why:** Take the data from Task 5 and actually draw the props/people/creatures alongside the road as the player passes them. Emoji `fillText` at projected screen coordinates.

**Files:**
- Modify: `Guac Off 2026/index.js` — add render pass between road and obstacles in `render()`

- [ ] **Step 1: Add `drawRoadside` function**

Just above `function render()`, add:

```js
function drawRoadside() {
    // Pick visible sprites and draw back-to-front so closer overlap farther.
    const visible = [];
    for (const item of roadside) {
        if (item.z > position && item.z < position + drawDistance * segmentLength) {
            visible.push(item);
        }
    }
    visible.sort((a, b) => b.z - a.z);

    for (const item of visible) {
        if (item.side === 'horizon') continue; // landmarks rendered separately in Task 7
        drawWorldEmoji(item);
    }
}

function drawWorldEmoji(item) {
    // Project the item's world position to screen using the same math obstacles use
    const segIndex = Math.floor(item.z / segmentLength);
    const startIndex = Math.floor(position / segmentLength);
    const seg = segments[segIndex];
    if (!seg) return;

    const p = { x: item.x * roadWidth, y: seg.p1.y, z: item.z };
    project(p, width, height);
    if (p.screenY > height || p.screenY < 0) return;

    const scale = p.screenWidth / roadWidth;
    const size = Math.max(6, item.sprite.baseSize * scale);
    if (size < 6) return;

    // Light animations: sea-lion bobs vertically, seagull drifts horizontally
    let dx = 0, dy = 0;
    if (item.sprite.id === 'sea-lion') dy = Math.sin(Date.now() / 400 + item.z * 0.001) * 4 * scale;
    if (item.sprite.id === 'seagull')  dx = Math.sin(Date.now() / 200 + item.z * 0.001) * 30 * scale;

    ctx.textBaseline = 'bottom';
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(item.sprite.emoji, p.screenX - size / 2 + dx, p.screenY + dy);
    ctx.textBaseline = 'alphabetic';
}
```

- [ ] **Step 2: Call `drawRoadside()` in the render pipeline**

Find the section in `render()` that draws obstacles (`obstacles.forEach(o => { … })` — around line 538). Just BEFORE that `obstacles.forEach` line, add:

```js
    drawRoadside();
```

- [ ] **Step 3: Verify in browser**

Hard-reload http://localhost:8026/. Start a ride. Expected:

- Emoji sprites appear on both sides of the road as you advance.
- They grow as you approach, shrink as they recede behind the camera.
- Scene-specific weighting visible: Mission has more taquerias 🌮 and palms 🌴, Market has more cable cars 🚋 and Muni stops 🚏, Mt Tam has more sea lions 🦭 and seagulls 🐦, GGP has more cyclists 🚴 and dog walkers 🐕.
- Sprites stay off the road (never block the player's lane).
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: render SF emoji sprites along the road

drawRoadside() renders SPRITE_LIBRARY entries spawned in
createRoad(). Sprites projected via the same project() helper
obstacles use, sorted back-to-front for correct overlap,
drawn with ctx.fillText at scaled size based on screenWidth.
Horizon landmarks skipped here — handled in next task."
```

---

## Task 7: Render backdrop landmarks (parallax)

**Why:** The fixed-position landmarks (Golden Gate, Transamerica, etc.) sit in the sky, not roadside. They scroll slower than the road for a parallax depth feel and grow from horizon-distance to near as the player approaches.

**Files:**
- Modify: `Guac Off 2026/index.js` — add a render pass for horizon items

- [ ] **Step 1: Add `drawLandmarks` function**

Just below `drawWorldEmoji` (from Task 6), add:

```js
function drawLandmarks() {
    for (const item of roadside) {
        if (item.side !== 'horizon') continue;
        const dz = item.z - position;
        if (dz < -2000) continue;          // already passed
        if (dz > drawDistance * segmentLength * 1.5) continue; // too far still

        // Parallax: appear small far away, larger as the player approaches
        const t = Math.max(0, Math.min(1, 1 - dz / (drawDistance * segmentLength)));
        const size = Math.max(40, item.sprite.baseSize * (0.3 + t * 0.9));

        // Anchor on the horizon line, offset by item.x for left/right placement
        const horizonY = height * 0.42;
        const sx = width * 0.5 + item.x * width * 0.35;

        ctx.textBaseline = 'bottom';
        ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.globalAlpha = 0.85;
        ctx.fillText(item.sprite.emoji, sx - size / 2, horizonY);
        ctx.globalAlpha = 1.0;
        ctx.textBaseline = 'alphabetic';
    }
}
```

- [ ] **Step 2: Call `drawLandmarks()` after the background image but before the grass/road**

Find the bg image draw call in `render()` (`ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, width, height);` around line 412, and the `else { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(...) }` branch). Just AFTER the closing `}` of that `if/else` (the one that handles bg image vs fallback), add:

```js
    drawLandmarks();
```

- [ ] **Step 3: Verify in browser**

Hard-reload http://localhost:8026/. Start a ride on each of the four scenes. Expected:

- Mt Tam: 🌉 Golden Gate and/or 📡 Sutro Tower appear on horizon, grow as you approach.
- GGP: 🏘️ Painted Ladies, 🌉 Golden Gate, 📡 Sutro Tower.
- Mission: 🏛️ Transamerica, 📡 Sutro Tower.
- Market St: 🏛️ Transamerica, 🚋 cable cars at street level, 📡 Sutro in distance.
- Landmarks are partly translucent (alpha 0.85) and sit on the horizon line, slightly behind the road perspective.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: backdrop landmark parallax in the sky

drawLandmarks() renders horizon-anchored emoji that scale up as
the player approaches the fixed z position. Slightly translucent
(alpha 0.85) and drawn before the grass/road passes so the road
horizon overlaps them naturally."
```

---

## Task 8: Karl the Fog atmospheric overlay

**Why:** The Mt Tam scene without fog isn't really SF. Add a translucent drifting fog layer with scene-dependent intensity.

**Files:**
- Modify: `Guac Off 2026/index.js` — add fog state, intensity per scene, drift update + draw pass

- [ ] **Step 1: Add fog state and per-scene intensity**

Near the other game state (around line 144), append:

```js
const FOG_INTENSITY = { mttam: 1.0, mission: 0.0, ggp: 0.25, market: 0.0 };
const fogBanks = [
    { x: 0,    y: 0.55, w: 600, speed: 0.4, alpha: 0.55 },
    { x: -300, y: 0.62, w: 700, speed: 0.7, alpha: 0.45 },
    { x: 400,  y: 0.50, w: 500, speed: 0.3, alpha: 0.35 },
];
```

- [ ] **Step 2: Add `drawFog` function**

Just below `drawLandmarks` (from Task 7), add:

```js
function drawFog() {
    if (winnersCircleActive) return; // suppressed during winners circle
    const intensity = FOG_INTENSITY[currentRoad] || 0;
    if (intensity <= 0) return;

    for (const bank of fogBanks) {
        bank.x += bank.speed; // drift
        if (bank.x > width + bank.w) bank.x = -bank.w;

        const y = height * bank.y;
        const grad = ctx.createLinearGradient(bank.x, y, bank.x + bank.w, y);
        grad.addColorStop(0,   `rgba(220,225,230,0)`);
        grad.addColorStop(0.5, `rgba(220,225,230,${bank.alpha * intensity})`);
        grad.addColorStop(1,   `rgba(220,225,230,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(bank.x, y - 40, bank.w, 80);
    }
}
```

Note: this references `winnersCircleActive` which doesn't exist yet — declare it now near the other game state:

```js
let winnersCircleActive = false;
```

(It will be set true in Task 9.)

- [ ] **Step 3: Call `drawFog()` after the world is rendered, before the HUD**

In `render()`, find where the player vehicle is drawn (look for `drawImage(vImg, …)` around line 679). After all the world rendering finishes (vehicle, flying objects, floating texts), before the speed-lines call from Task 3, add:

```js
    drawFog();
```

- [ ] **Step 4: Verify in browser**

Hard-reload. Start a ride on Mt Tam — expected: three drifting fog banks visible in the lower-middle of the screen, gently moving left to right. On Mission or Market — no fog. On GGP — light fog (25% intensity).

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: Karl the Fog overlay

Three drifting horizontal gradient bands at scene-dependent
intensity (mttam 1.0, ggp 0.25, others 0). Suppressed during
winnersCircleActive (Task 9) so the party scene reads clearly."
```

---

## Task 9: Deceleration glide on finish (Phase 1 of winners circle)

**Why:** When the player crosses the finish line, the vehicle currently snaps to a stop and a text overlay appears. The arcade-feel calls for a 2-second deceleration glide before transitioning to the party scene.

**Files:**
- Modify: `Guac Off 2026/index.js` — adjust the `raceFinished = true` trigger and the post-finish game-loop logic

- [ ] **Step 1: Add deceleration state**

Near the other game state (around line 144, alongside `winnersCircleActive` from Task 8), add:

```js
let decelStartTime = 0;        // when the glide started
let decelStartSpeed = 0;       // currentSpeed at finish
```

- [ ] **Step 2: Trigger deceleration on finish (don't freeze position)**

Find the existing finish trigger (around line 744):

```js
if (position >= segments.length * segmentLength) {
    raceFinished = true;
    document.getElementById('see-details-btn').hidden = false;
    elapsedTime = (Date.now() - startTime) / 1000;
    playSound('fanfare');
}
```

Replace with:

```js
if (position >= segments.length * segmentLength && !raceFinished) {
    raceFinished = true;
    decelStartTime = Date.now();
    decelStartSpeed = currentSpeed;
    document.getElementById('see-details-btn').hidden = false;
    elapsedTime = (Date.now() - startTime) / 1000;
    playSound('fanfare');
}
```

- [ ] **Step 3: Run deceleration glide when raceFinished but not yet in winners circle**

Find the broader update gate around line 734:

```js
if (!paused && !countdownActive && !raceFinished) {
    // Auto drive
    let maxSpeed = ...
    ...
}
```

Just AFTER the closing `}` of that block (still inside `gameLoop`), add:

```js
    // Deceleration glide: race finished but winners circle not yet started
    if (raceFinished && !winnersCircleActive) {
        const elapsed = Date.now() - decelStartTime;
        const t = Math.min(1, elapsed / 2000);
        currentSpeed = decelStartSpeed * (1 - t);
        position += currentSpeed;
        if (t >= 1) {
            winnersCircleActive = true;
            currentSpeed = 0;
        }
    }
```

- [ ] **Step 4: Reset glide and winners-circle state on Play Again**

Search for `raceFinished = false;` — there are two non-declaration sites (in the restart-btn handler and the canvas Play Again handler). At each of those sites, also add:

```js
        decelStartTime = 0;
        winnersCircleActive = false;
```

(Place these immediately after the existing `raceFinished = false;` line at each site.)

- [ ] **Step 5: Verify in browser**

Hard-reload, start a ride, and either play through the whole course OR open DevTools console and run:

```js
position = (segments.length - 5) * segmentLength;  // jump near finish
```

Then let the game advance. Expected: the player crosses the line, the camera continues forward at a smoothly decelerating speed for ~2 seconds, then stops. Console: `winnersCircleActive` becomes true.

- [ ] **Step 6: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: deceleration glide on finish (winners-circle Phase 1)

Crossing the finish line no longer snaps position to a halt. The
vehicle decelerates linearly over 2 seconds (decelStartTime +
decelStartSpeed), then flips winnersCircleActive on, which Phase 2
(the party scene) renders against."
```

---

## Task 10: Party scene render (confetti + banner + crowd)

**Why:** Once `winnersCircleActive` is true, render the celebratory overlay: confetti rain, welcome banner, party-people row.

**Files:**
- Modify: `Guac Off 2026/index.js` — add confetti state + `drawParty` function + integrate into render loop

- [ ] **Step 1: Add confetti state and seed helper**

Near the other game state (around line 144), append:

```js
const CONFETTI_COLORS = ['#1b4d3e', '#ebd2b4', '#ff5500', '#ffffff', '#ff007f', '#39ff14', '#00ffff'];
const confetti = []; // { x, y, vx, vy, color, size, rot, vr }

function seedConfetti() {
    confetti.length = 0;
    for (let i = 0; i < 80; i++) {
        confetti.push({
            x: Math.random() * (canvas.width || 800),
            y: -20 - Math.random() * 400,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1 + Math.random() * 3,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            size: 4 + Math.random() * 6,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.2,
        });
    }
}
```

- [ ] **Step 2: Seed confetti when winners circle starts**

In Task 9 Step 3 you added the deceleration glide block. Inside its `if (t >= 1) { … }` (where `winnersCircleActive = true;` is set), add:

```js
            seedConfetti();
```

So the block reads:

```js
        if (t >= 1) {
            winnersCircleActive = true;
            currentSpeed = 0;
            seedConfetti();
        }
```

- [ ] **Step 3: Add `drawParty` function**

Just below `drawFog` (from Task 8), add:

```js
function drawParty() {
    if (!winnersCircleActive) return;

    // Dim the road behind the party
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, width, height);

    // Confetti
    for (const c of confetti) {
        c.x += c.vx + Math.sin(Date.now() / 600 + c.y * 0.01) * 0.3;
        c.y += c.vy;
        c.rot += c.vr;
        if (c.y > height + 20) {
            c.y = -20;
            c.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
        ctx.restore();
    }

    // Banner — "🎉 WELCOME TO THE GUAC OFF 🎉" with subtle bob
    const bob = Math.sin(Date.now() / 400) * 4;
    ctx.textAlign = 'center';
    const bannerSize = Math.round(28 * (canvas.height / 600));
    ctx.font = `${bannerSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText('🎉 WELCOME TO THE GUAC OFF 🎉', width / 2 + 3, height * 0.18 + bob + 3);
    ctx.fillStyle = '#ebd2b4';
    ctx.fillText('🎉 WELCOME TO THE GUAC OFF 🎉', width / 2, height * 0.18 + bob);

    // Party crowd row near the bottom — each emoji bobs independently
    const crowd = ['🥳', '💃', '🕺', '🍻', '🥑', '🎺', '🌮', '🥑'];
    const crowdSize = Math.round(60 * (canvas.height / 600));
    ctx.font = `${crowdSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textBaseline = 'bottom';
    const gap = width / (crowd.length + 1);
    for (let i = 0; i < crowd.length; i++) {
        const cb = Math.sin(Date.now() / 300 + i) * 6;
        ctx.fillText(crowd[i], (i + 1) * gap, height * 0.85 + cb);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
}
```

- [ ] **Step 4: Call `drawParty()` in render**

In `render()`, just AFTER `drawFog()` (from Task 8), add:

```js
    drawParty();
```

- [ ] **Step 5: Remove the old finish-line text overlay**

Find the existing finish overlay block (around line 838–859):

```js
// Big Finish
if (raceFinished) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("You made it to the Guac Off!", width / 2, height / 2 - 100);

    ctx.font = '30px Arial';
    ctx.fillText(`Final Score: ${score}`, width / 2, height / 2);
    ctx.fillText(`Final Time: ${displayTime.toFixed(1)}s`, width / 2, height / 2 + 50);

    // Draw Play Again button
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(width / 2 - 100, height / 2 + 100, 200, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText("PLAY AGAIN", width / 2, height / 2 + 130);

    ctx.textAlign = 'left'; // Reset
}
```

DELETE the entire block. The party scene replaces it; the results card + DOM Play Again button arrive in Task 11.

- [ ] **Step 6: Verify in browser**

Hard-reload, jump to near the finish via DevTools (`position = (segments.length - 5) * segmentLength;`), let the player cross. Expected:

- 2-second deceleration glide (from Task 9).
- Then: dimmed road behind, colorful confetti raining from top, "🎉 WELCOME TO THE GUAC OFF 🎉" banner near top with subtle bob, row of party emojis along the bottom each bobbing independently.
- The old white "You made it to the Guac Off!" text is gone.
- No results card or play-again button yet (Task 11).
- Console clean.

- [ ] **Step 7: Commit**

```bash
git add "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: party scene render (Phase 2 of winners circle)

Once winnersCircleActive flips on, drawParty() takes over:
80-particle confetti rain with rotation and wind drift, bobbing
banner with magenta-shadowed cream text, row of party emojis
along the bottom each on an independent sin-bob. Old white
Arial finish overlay deleted."
```

---

## Task 11: Results card + DOM Play Again button

**Why:** Replace the deleted canvas-drawn Play Again button with a real DOM button, and add a results card showing final score and time in arcade style.

**Files:**
- Modify: `Guac Off 2026/index.html` — add the button element
- Modify: `Guac Off 2026/index.css` — style the results card + button
- Modify: `Guac Off 2026/index.js` — show/hide the button with `winnersCircleActive`, wire restart click

- [ ] **Step 1: Add the DOM button inside `#game-hero`**

In `Guac Off 2026/index.html`, find the existing `<button id="scroll-hint">` line (currently inside `<section id="game-hero">`). Just below it, add:

```html
        <button id="party-play-again" type="button" hidden>PLAY AGAIN</button>
```

- [ ] **Step 2: Style the results card + button in CSS**

In `Guac Off 2026/index.css`, append at the end of the file:

```css
/* Winners-circle DOM Play Again — neon arcade card */
#party-play-again {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, calc(-50% + 40px));
  z-index: 50;
  background: var(--text-color);
  color: #ffffff;
  border: none;
  padding: 14px 28px;
  font-family: var(--font-title);
  font-size: 16px;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 4px 4px 0px var(--accent-color);
  text-transform: uppercase;
}

#party-play-again:hover {
  background: var(--secondary-color);
  color: #000;
  box-shadow: 2px 2px 0px #fff;
  transform: translate(calc(-50% + 2px), calc(-50% + 42px));
}

#party-play-again[hidden] {
  display: none;
}

@media (max-width: 768px) {
  #party-play-again {
    font-size: 12px;
    padding: 10px 20px;
    transform: translate(-50%, calc(-50% + 30px));
  }
  #party-play-again:hover {
    transform: translate(calc(-50% + 2px), calc(-50% + 32px));
  }
}
```

- [ ] **Step 3: Render the results card text on canvas**

In `Guac Off 2026/index.js`, find `function drawParty() { … }` (from Task 10). At the end of the function (just before the closing `}`), add:

```js
    // Results card text (the PLAY AGAIN button is a DOM element shown separately)
    const cardCx = width / 2;
    const cardCy = height / 2;
    const cardW = Math.min(420, width * 0.8);
    const cardH = Math.round(120 * (canvas.height / 600));
    ctx.fillStyle = 'rgba(13, 2, 33, 0.92)';
    ctx.fillRect(cardCx - cardW / 2, cardCy - cardH / 2, cardW, cardH);
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 4;
    ctx.strokeRect(cardCx - cardW / 2, cardCy - cardH / 2, cardW, cardH);

    ctx.textAlign = 'center';
    ctx.font = `${Math.round(14 * (canvas.height / 600))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#00ffff';
    ctx.fillText('FINAL SCORE', cardCx, cardCy - cardH / 2 + 22);
    ctx.fillStyle = '#ff007f';
    ctx.font = `${Math.round(22 * (canvas.height / 600))}px "Press Start 2P", monospace`;
    ctx.fillText(String(score).padStart(6, '0'), cardCx, cardCy - 4);
    const fmin = Math.floor(elapsedTime / 60);
    const fsec = (elapsedTime - fmin * 60).toFixed(1).padStart(4, '0');
    ctx.font = `${Math.round(11 * (canvas.height / 600))}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#39ff14';
    ctx.fillText(`TIME ${String(fmin).padStart(2, '0')}:${fsec}`, cardCx, cardCy + cardH / 2 - 14);
    ctx.textAlign = 'left';
```

- [ ] **Step 4: Show/hide the DOM Play Again button with winners-circle state**

Find where `winnersCircleActive = true;` is set (inside the deceleration block from Task 9 Step 3, also where `seedConfetti()` lives). Immediately after `seedConfetti();`, add:

```js
            document.getElementById('party-play-again').hidden = false;
```

Then find every site where `winnersCircleActive = false;` is set (the two reset sites from Task 9 Step 4). At each of those, add:

```js
        document.getElementById('party-play-again').hidden = true;
```

- [ ] **Step 5: Remove the dead canvas Play Again hit-test in the document click handler**

Find the document click handler (around line 955–984). It contains a `if (raceFinished) { … }` block that did canvas-coord hit-testing for the OLD canvas-drawn Play Again button. The block looks like:

```js
    if (raceFinished) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Button area: width / 2 - 100, height / 2 + 100, 200, 50
        if (x > width / 2 - 100 && x < width / 2 + 100 &&
            y > height / 2 + 100 && y < height / 2 + 150) {
            // Restart game!
            score = 0;
            raceFinished = false;
            document.getElementById('see-details-btn').hidden = true;
            gameStarted = true;
            countdownActive = true;
            countdownStartTime = Date.now();
            lastCountdown = 4;
            init();
            playMusic();
            return;
        }
    }
```

Delete the entire `if (raceFinished) { … }` block from the document click handler. (The DOM #party-play-again button now owns this behavior with its own handler in the next step.)

- [ ] **Step 6: Wire the Play Again click handler**

At the bottom of `Guac Off 2026/index.js` (after the existing `#see-details-btn` click handler from earlier work), add:

```js
document.getElementById('party-play-again').addEventListener('click', (e) => {
    e.stopPropagation();
    // Mirror the restart logic from the existing restart-btn handler
    score = 0;
    raceFinished = false;
    winnersCircleActive = false;
    decelStartTime = 0;
    document.getElementById('party-play-again').hidden = true;
    document.getElementById('see-details-btn').hidden = true;
    gameStarted = true;
    countdownActive = true;
    countdownStartTime = Date.now();
    lastCountdown = 4;
    init();
    playMusic();
});
```

- [ ] **Step 7: Verify in browser**

Hard-reload, fast-forward to finish:

```js
position = (segments.length - 5) * segmentLength;
```

Let the player cross. Expected:
- Deceleration glide.
- Party scene takes over (confetti, banner, crowd from Task 10).
- A dark neon-bordered card appears center-screen with FINAL SCORE (cyan label + magenta padded digits), TIME (neon green).
- A magenta DOM "PLAY AGAIN" button appears below the card (hover inverts to neon green).
- Click PLAY AGAIN → menu returns or a fresh countdown begins, score resets, the button hides.
- Click PLAY AGAIN works through the DOM button only — clicking the canvas no longer triggers a restart (verifying the dead hit-test removal from Step 5).

- [ ] **Step 8: Commit**

```bash
git add "Guac Off 2026/index.html" "Guac Off 2026/index.css" "Guac Off 2026/index.js"
git commit -m "Guac Off 2026: results card + DOM Play Again in winners circle

Adds neon results card on canvas showing FINAL SCORE and TIME
in arcade style. New DOM button #party-play-again (styled in
CSS) appears below the card and triggers a full restart on
click. Toggled by winnersCircleActive. Also removes the dead
canvas-coord hit-test in the document click handler that
targeted the now-deleted canvas Play Again button."
```

---

## Final Verification

After all 11 tasks land:

- [ ] **End-to-end play on desktop:**
  - Menu loads, pick vehicle/scene, click START RIDE.
  - 3-2-1 countdown is Press Start 2P with scale-in, GO! flashes white.
  - Pixel HUD shows SCORE (top-left), TIME (below), SPEED MPH (top-right) — all neon.
  - SF emoji sprites flank the road on both sides. Scene-specific weighting visible (Mission ≠ Mt Tam ≠ GGP ≠ Market).
  - Landmarks (Golden Gate / Transamerica / Sutro / Painted Ladies) appear on the horizon for the right scenes.
  - Karl the Fog is heavy on Mt Tam, light on GGP, absent elsewhere.
  - Hitting a cone produces a perceptible 6-frame shake.
  - At high speeds, white radial speed lines shimmer from the vanishing point.
  - Crossing finish: 2-sec deceleration glide → confetti, banner, party crowd, results card, DOM PLAY AGAIN.
  - PLAY AGAIN works.

- [ ] **End-to-end play on mobile (390px or DevTools device mode):**
  - HUD fonts are smaller proportionally.
  - Sprites still appear (canvas resize handled).
  - Party scene fits in the smaller game viewport.
  - PLAY AGAIN button shrinks via the media query.

- [ ] **Console clean:** No JS errors at any point.

- [ ] **No regressions:**
  - Info section below the game still renders correctly.
  - Scroll-hint button on game frame still works (mobile).
  - Existing music toggle, restart button, gyroscope steering still work.

- [ ] **Quick grep sanity:**
  ```bash
  grep -nE "winnersCircleActive|decelStartTime|drawParty|drawRoadside|drawLandmarks|drawFog|drawSpeedLines|SPRITE_LIBRARY|LANDMARK_LIBRARY" "Guac Off 2026/index.js" | wc -l
  ```
  Expect at least 25 matches across declarations + call sites.
