# 🧭 Point Your Phone at the Party — Design

**Date:** 2026-06-06
**Status:** Approved (design); pending spec review
**Project:** Guac Off 2026 (`Guac Off 2026/`)

## Concept

Make `WHERE: IYKYK` literal. A standalone phone page where the guest physically
**aims their phone at the real venue like a wand**. A guac-green glow + rising
tone "warm up" as the phone's pointing direction nears the true compass bearing
to the venue (computed from the guest's GPS position). When aligned and held
steady, it **locks** with a chime + avocado burst and reveals the address.

The home-page `IYKYK` joke stays untouched; this is a discoverable **easter-egg
/ flex path**, linked from the footer, not the canonical way to learn the
address.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Mechanic | **True bearing** — GPS position → great-circle bearing to venue lat/lng, compared to live phone heading |
| Feedback | **Warmer/colder hunt** — glow brightness + rising audio tone + (where supported) haptic ticks; snap-lock on alignment |
| Entry point | **Standalone page** `find/`, linked from the home-page footer (IYKYK stays as-is) |
| Reveal | Address + **celebration** (reuse tilt's `playChime()`, avocado/confetti burst) + "Open in Maps" + date/time |
| Secrecy | **Light obfuscation** — base64+XOR; spoiler-proofing, not crypto |
| Venue data | **Placeholder** (Dolores Park) in one marked config block; real coords swapped in later |
| Gesture | **Aim upright (wand)** — point the phone's **top edge** at the building |
| Escape hatch | **Hidden, then fades in** — "can't find it? just show me" appears after ~12s hunting, or immediately on permission-denied / desktop / far-away |

## Architecture

New `find/` directory, mirroring the proven `tilt/` structure:

```
Guac Off 2026/find/
  index.html        cover/start → pre-prime explainer → hunt stage → reveal card
  index.css         glow, warmth gradient, reveal animation, escape-hatch styling
  index.js          orchestration: permissions, sensor loop, lock logic, reveal
  helpers.js        PURE, testable functions (the math + decode)
  index.test.html   in-browser unit tests for helpers.js (like tilt/index.test.html)
```

Plus a one-line edit to `Guac Off 2026/index.html` footer:
`🧭 point your phone to the party` (alongside the existing tilt + years links).

### Why a separate `helpers.js`

The compass/bearing math is the risky part of this feature. Isolating it as
**pure functions** (no DOM, no sensors) makes it unit-testable in
`index.test.html` and keeps `index.js` focused on orchestration — same split
that worked for `tilt/`.

## The hard part: deriving "where the phone points" (upright/wand gesture)

`webkitCompassHeading` (iOS) and `alpha` (Android) describe rotation about the
**vertical** axis assuming the phone is held **flat** like a compass. The chosen
gesture holds the phone **upright** and points the **top edge (device −Y axis)**
at the building. Therefore we **cannot** use `webkitCompassHeading` directly as
the pointing heading — we must derive the horizontal azimuth of the top-edge
vector from the full device orientation.

### Pointing-azimuth algorithm (in `helpers.js`)

1. Take `alpha`, `beta`, `gamma` (deg) from the orientation event.
2. Build the device→world rotation matrix `R(alpha, beta, gamma)` (Z-X'-Y''
   intrinsic, per the W3C DeviceOrientation spec).
3. Apply the **screen-orientation correction** (`screen.orientation.angle`) so
   landscape / rotated holds don't read 90° off.
4. Transform the device **top-edge unit vector (0, −1, 0)** into world
   coordinates.
5. **Project onto the horizontal plane** and take `atan2` → world azimuth
   (0° = north, clockwise).
6. Apply the **north reference + declination correction** (below).

This azimuth is what we compare against the bearing-to-venue.

> The pointing axis is a single named constant in `helpers.js` (`POINT_AXIS =
> [0,-1,0]`). If on-device testing shows the camera axis (out the back, `[0,0,-1]`)
> feels more natural for "aiming," it's a one-line flip. We default to top-edge
> to match the stated mental model.

### North reference & declination (correctness, not optional)

- **iOS:** `webkitCompassHeading` is **magnetic** north. Our bearing math is
  **true** north. We use `webkitCompassHeading` to anchor the absolute heading
  (iOS `alpha` has an arbitrary zero), then add a **declination constant** so
  magnetic readings reach the true-north lock window.
- **Android:** prefer the `deviceorientationabsolute` event (require
  `event.absolute === true`); its `alpha` is typically **true** north already.
- Declination is a single config constant (`MAGNETIC_DECLINATION_DEG`, ≈ +13°
  for San Francisco — it dwarfs the ±lock window, so it must be applied). Stored
  next to the venue data and easy to retune.

### Gimbal instability mitigation

The top-edge azimuth gets unstable as the phone approaches dead-vertical
(`beta → 90°`). Mitigations:
- Guide the guest to hold at a **comfortable tilt** (~65–75°), like aiming a
  remote, not bolt upright.
- **Heavy low-pass smoothing on the unit circle** (smooth `sin`/`cos`, never raw
  degrees — raw averaging flips south across the 0°/360° seam).
- The **escape hatch** is the ultimate safety net when the math misbehaves.

## Alignment, warmth, and lock (in `helpers.js`)

- `bearing(from, to)` → great-circle initial bearing (true north), `[0,360)`.
- `angleDiff(a, b)` → smallest absolute angular difference, wrapped to `[0,180]`.
- `warmth(diff)` → `clamp(1 − diff/45, 0, 1)`. **Maps to a 45° window** (not 90°)
  so the last few degrees — where precision matters — give a strong, perceptible
  gradient. Drives glow brightness + tone pitch/volume + haptic tick rate.
- **Lock:** when `diff < 12°` held continuously for ~0.5 s (debounced so a fast
  sweep doesn't false-trigger).

## Sensors, permissions & flow

Reuses the hard-won pattern from `tilt/index.js` (audio-on-gesture, iOS
`requestPermission` ordering).

1. **Cover screen** → "Start the hunt 🧭".
2. **Pre-prime explainer** (one short screen *before* the scary prompts): "We'll
   use your compass + location to point you at the party. Nothing is stored."
   This makes the permission gesture intentional and cuts drop-off.
3. On the explainer's confirm tap (single user gesture):
   - init + `resume()` WebAudio **synchronously** (no `await` before it — iOS
     gesture window).
   - `await DeviceOrientationEvent.requestPermission()` **first** (iOS).
   - then `navigator.geolocation.getCurrentPosition(ok, err, {
     enableHighAccuracy: true, timeout: 8000, maximumAge: 0 })` with a "getting
     your location…" state.
4. **Heading source selection:**
   - iOS: `deviceorientation` + `webkitCompassHeading` anchor (+ `webkitCompassAccuracy`).
   - Android: `deviceorientationabsolute` requiring `absolute === true`.
5. Run the sensor → azimuth → warmth → lock loop on `requestAnimationFrame`.

### Calibration

Read `webkitCompassAccuracy` (iOS; `-1` or `> ~25°` = unusable). When poor, show
**"wave your phone in a figure-8 to calibrate"** and **do not lock** until
accuracy recovers.

### Near-venue degeneracy

Within **~120 m**, GPS error makes the bearing spin uselessly. Detect via
haversine distance; below the threshold, **skip the aiming game** and reveal the
address directly: "You're basically here — it's right around you. 🥑"

## The reveal

- Reuse `playChime()` + an avocado/confetti burst.
- Card: **"YOU FOUND THE PARTY"** + a short earned-it payoff line + the address +
  `[ Open in Maps ↗ ]` + `Sept 12 · 1pm`. ("Add to calendar" is a nice-to-have,
  not in initial scope.)
- **Persist the unlock in `localStorage`** so a found address survives refresh —
  no re-granting permissions / re-playing on the sidewalk. On revisit, the page
  opens straight to the revealed card (with a small "play again" affordance).

## Escape hatch / accessibility path

A **"can't find it? just show me"** control that:
- **fades in after ~12 s** of unsuccessful hunting, AND
- appears **immediately** on: permission denied, desktop/no-sensor, geolocation
  failure/timeout, or far-from-SF.
- is **keyboard-focusable and screen-reader labelled** so blind / low-vision /
  motion-limited guests are never gated out.

Tapping it reveals the same address card (and persists the unlock). The hunt
stays the star; no one is ever truly stuck or excluded.

## Light obfuscation

One clearly-marked config block:

```js
// ===== EDIT THIS ONE BLOCK (real venue) =====
const VENUE_GEO  = enc('{"lat":37.7596,"lng":-122.4269}'); // Dolores Park placeholder
const VENUE_ADDR = enc('Dolores Park, San Francisco, CA');  // placeholder
const MAGNETIC_DECLINATION_DEG = 13; // SF; retune per venue
// ============================================
```

- `enc`/`dec` = base64 + XOR with a tiny in-file key.
- **Honest limit:** `VENUE_GEO` must be decoded **at load** for the live bearing
  math — a determined person can read it from memory. `VENUE_ADDR` stays encoded
  and is decoded **only at unlock**, so casual view-source shows gibberish and
  the human-readable street address never sits in plaintext pre-unlock. This is
  spoiler-proofing, not security.

## Error / edge handling

| Condition | Behavior |
|---|---|
| Desktop / no `DeviceOrientationEvent` | "Best on a phone — open this on your phone 📱" + escape hatch |
| iOS motion permission denied | "Motion access needed — refresh and tap Allow" + escape hatch |
| Geolocation denied / timeout | "I need your location to point you at the party 🧭" + escape hatch |
| No absolute compass (Android `absolute !== true`) | Message that the device can't sense direction + escape hatch |
| Poor compass accuracy | Figure-8 calibration hint; don't lock |
| Within ~120 m of venue | Skip game; reveal directly |
| Far from SF | Distance-aware copy + escape hatch surfaces immediately |
| In-app webview (IG/FB/TikTok) | If sensors/secure-context unavailable, "open in Safari/Chrome" + escape hatch |

## Testing

**Unit (`find/index.test.html`)** — pure helpers:
- `bearing()` against known cardinal cases (due N/E/S/W between crafted points).
- `angleDiff()` wraparound (e.g. 350° vs 10° = 20°; 12° vs 0° = 12°).
- `warmth()` endpoints (0° → 1, 45° → 0, beyond → 0).
- Pointing-azimuth for a few crafted `(alpha,beta,gamma,screenAngle)` orientations
  with known expected azimuths (the riskiest math — test it hard).
- `enc`/`dec` round-trip.
- Unit-circle smoothing across the 0/360 seam (doesn't flip south).

**Manual on-device:**
- Stand at a known spot, aim at a known direction; confirm glow warms, locks,
  reveals, chimes; verify "Open in Maps" deep link.
- Confirm escape hatch fades in after ~12 s and on denial.
- Confirm unlock persists across refresh.

**Desktop:** confirm graceful fallback + immediate escape hatch.

## Out of scope (YAGNI)

- Live "distance to venue" display (chosen reveal is address+celebration, not
  distance).
- Hard geo-gating (we surface escape hatch instead of blocking far users).
- "Add to calendar" (nice-to-have, later).
- Real cryptographic secrecy (static site — impossible client-side).
