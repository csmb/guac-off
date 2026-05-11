# Guac Off 2026 — Info-Sharing Redesign

**Date:** 2026-05-10
**Project:** `Guac Off 2026/` (static HTML/CSS/JS, no build step)
**Status:** Approved design, ready for implementation plan

## Goal

Keep the existing "ride through SF dodging obstacles" game (the "bones"), but add a real party-invite section underneath it so visitors leave knowing the essential details (when, where, what to bring, what they can win). The site is an invite poster — no signup form, no flow design, just clear info.

## Constraints

- The game stays. The pixel/poster aesthetic stays.
- Static site, no build step. Stack remains plain HTML + CSS + JS.
- Mobile-responsive: works at ~390px width as well as desktop.
- All scrolling and motion behavior must work with the existing gyroscope-steering and autocruise logic on iOS Safari.

## Page Structure

Two stacked regions:

1. **Game hero** — first viewport (100vh). Existing canvas, menu overlay (vehicle / scene / music picker), gyroscope steering, autocruise. A small persistent "↓ party details" tab in the bottom-right of the game frame hints there is content below.
2. **Info section** — natural document flow, scrolls in below the game. Pixel-poster aesthetic ("style A" from brainstorm mockups). Single column, max-width 640px, centered. Park-green background (`#1b4d3e`) for visual continuity with the existing `INFO_PLAYFUL` billboard style. Cream text (`#ebd2b4`), orange accents (`#ff5500`).

A minimal footer closes the page: `no double dipping · since 2012`.

When the in-game race finishes, the existing finish screen gains a "see the party details ↓" button that smooth-scrolls into the info section.

## Scroll-Mechanic Refactor

The game today couples its forward motion to page scroll:

- `position = window.scrollY * 10` reads scroll into game z-position.
- `window.scrollTo(0, position / 10)` writes game position back to page scroll inside the game loop.
- `document.body.style.height = (segments.length * segmentLength / 10) + 'px'` makes body artificially tall so the scrollbar spans the whole course.

This must be decoupled so a real info section can sit below the game.

**Changes:**

- Wrap the canvas (and game HUD) in a `<section id="game-hero">` set to `position: sticky; top: 0; height: 100vh`. Sticks for the first viewport, releases naturally as the user scrolls down.
- Delete the `document.body.style.height = ...` assignment.
- Delete the `window.scrollTo(...)` call inside `gameLoop` and the `handleScroll` listener / `lastAutoScrollTime` debounce.
- Game is already self-propelled by `position += currentSpeed` in `gameLoop`, so it continues to advance on its own. No new input needed.

**Consequence:** the browser's native scrollbar no longer doubles as a race-progress indicator. Acceptable — the game is self-propelled and a real document scroll is now needed for the info section. Course-progress on the canvas itself is **out of scope** for this design.

## Info Section Content

Four blocks, in order, with the exact copy below.

### 1. Intro (centered, one line)

> The 14th annual SF Guac Off. A competition and a party.

### 2. Essentials grid (5 label-strip rows)

| Label   | Value                                                        |
|---------|--------------------------------------------------------------|
| `WHEN`  | Sept 13 · 1pm til the last chip                              |
| `WHERE` | TBD · revealed soon                                          |
| `BRING` | Compete: 8 avos of guac · Attend: beer, a friend             |
| `WIN`   | Guacamole Glory Trophy + 8 awards                            |
| `RULE`  | No double dipping                                            |

Label cells are 60–70px wide, orange background, cream bold uppercase. Value cells are cream text, left-aligned.

### 3. Schedule (heading: `THE AFTERNOON`)

```
1:00 – 4:00    Compete
4:00 – 4:30    Vote
4:30 – …       Winners, then chips
```

### 4. Award categories (heading: `EIGHT TROPHIES`)

Rendered as wrapped chip pills (rounded-rect, orange border, cream text), comma-free, dot-separated visually:

`Best Guac` · `Best Presentation` · `Best Name` · `Most Avocados` · `Most Creative` · `Spiciest` · `Best Young Chef` · `Heaviest Bowl`

## Styling Specifics

- **Background:** `#1b4d3e` (park green; matches existing INFO_PLAYFUL billboard background).
- **Text:** cream `#ebd2b4` for body, orange `#ff5500` for accent labels and chip borders.
- **Type:** monospace family (`'Courier New', ui-monospace, monospace`) for labels and headings; same monospace or system stack for body. No web font dependencies (consistent with current zero-dependency setup).
- **Spacing:** 40px of vertical margin between blocks. Each block reads as its own card-like region without literal card chrome.
- **Container:** `max-width: 640px; margin: 0 auto; padding: 48px 20px`.

## Mobile

The overall info section is a single column at every width. Within it:

- The essentials grid is an internal 2-column `60px 1fr` layout (label cell + value cell). Both cells stay on one row at 390px — labels do not break to multiple lines.
- Chip list wraps naturally.
- Headings shrink ~10% at narrow widths via `clamp()` or a single media query.

Tested at 390px (mobile) and 1440px+ (desktop) widths.

Gyroscope-steering iOS permission flow is unchanged.

## Finish-Line Integration

The existing finish-line overlay (rendered when `raceFinished` is true) gains one element: a button labelled `see the party details ↓`. Clicking it calls `document.getElementById('info').scrollIntoView({ behavior: 'smooth' })`. Existing "play again" behavior unchanged.

## Files Touched

- `Guac Off 2026/index.html` — wrap canvas in `<section id="game-hero">`; append `<section id="info">…</section>` and `<footer>` below.
- `Guac Off 2026/index.css` — append rules for `#game-hero` (sticky), `#info` (pixel-poster styling), label-strip grid, chip pills, mobile media query.
- `Guac Off 2026/index.js` —
  - remove `document.body.style.height = ...`
  - remove `window.scrollTo(...)` in `gameLoop` + `handleScroll` + `lastAutoScrollTime` plumbing
  - add smooth-scroll handler for the finish-line "see the party details ↓" button
  - delete the disabled-billboards `if (false) { … }` block as dead code (and the now-unused `billboards` array and `billboardStyles` styling block, if nothing else references them).

No new files. No new dependencies. No new build step.

## Explicit Non-Goals

- No RSVP / email collection / signup form.
- No competitor-signup CTA.
- No social-share buttons or share-link UI.
- No sponsor logos.
- No past-year gallery or champions list.
- No on-canvas course-progress indicator.
- No restyle of the existing menu overlay (vehicle / scene / music picker) — out of scope for this pass, even though the user noted the current look isn't loved.
- No change to the gradient / smoothing work done earlier this session.

## Success Criteria

- A first-time visitor lands on the page, sees the game, and within one scroll knows: when the event is, where (or "TBD"), what to bring, what they can win, the rules, the schedule, and the award categories.
- The game still plays and feels the same as before the refactor (steering, autocruise, finish line, score) — confirmed by manual play on desktop and on an iOS device using gyro.
- Layout reads cleanly at 390px and at 1440px+ widths.
