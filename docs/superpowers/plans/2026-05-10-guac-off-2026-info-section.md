# Guac Off 2026 — Info Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pixel-poster info section below the existing racing game so visitors leave knowing when/where/what to bring/what they can win — while keeping the game intact as the hero.

**Architecture:** Decouple the game from page scroll (today it reads/writes `window.scrollY`), pin the canvas to the first viewport via `position: sticky`, and let a normal document scroll reveal a new HTML section below it. The info section is plain HTML + CSS appended to the existing files. No build step, no new dependencies.

**Tech Stack:** Plain HTML5 + CSS + ES2015+ JavaScript. Canvas 2D for the game (already in place). Two Google Fonts already loaded (`Press Start 2P`, `VT323`). Dev server: `python3 -m http.server 8026`.

**Spec:** `docs/superpowers/specs/2026-05-10-guac-off-2026-info-design.md` — read it before starting.

---

## File Structure

All changes touch three existing files. No new files.

| File | Responsibility | Change type |
|---|---|---|
| `Guac Off 2026/index.html` | Document structure — wrap game in a hero region; append info section + footer below | Modify |
| `Guac Off 2026/index.css` | Append `#game-hero` sticky rules, `#info` pixel-poster styles, mobile media query, hint-tab styles | Append-only |
| `Guac Off 2026/index.js` | Remove three scroll-coupling code paths, remove dead billboard block, add finish-line CTA handler | Modify (mostly deletions) |

## Setup — Dev Server

Before any task, ensure the local server is running. The user has previously bound port 8026 for this project per their dev-isolation rule:

```bash
# from repo root:
cd "Guac Off 2026"
python3 -m http.server 8026 --bind 0.0.0.0
```

Open the game in a browser at **http://localhost:8026/**. Keep it open across tasks and reload after each change. (Hard-reload, Cmd-Shift-R on macOS, to bypass cache.)

If port 8026 is in use already (`lsof -ti:8026` returns a PID), check whether it's the user's existing server and leave it; do not kill without confirmation.

---

## Task 1: Decouple game advance from page scroll

**Why:** Today the game reads `window.scrollY` to set its forward position, writes back via `window.scrollTo`, and forces `document.body` to be artificially tall. That blocks adding real content below. The game is already self-propelled via `position += currentSpeed`, so removing the coupling has no gameplay impact.

**Files:**
- Modify: `Guac Off 2026/index.js` (delete three regions)

- [ ] **Step 1: Verify current pre-state in browser**

  Open http://localhost:8026/. In DevTools console, run:

  ```js
  console.log('body height:', getComputedStyle(document.body).height);
  console.log('scroll-driven position handler:', typeof handleScroll);
  ```

  Expected: body height is much taller than viewport (50,000px range); `handleScroll` is `"function"`. Also confirm: pick a vehicle/scene, start the ride — the browser's scrollbar moves on its own as the game advances. This is the behavior we're removing.

- [ ] **Step 2: Remove the body-height hack inside `init()`**

  Locate inside `function init() { … }`:

  ```js
  // Set scroll height based on road length
  document.body.style.height = (segments.length * segmentLength / 10) + 'px';
  ```

  Delete those two lines (the comment and the assignment).

- [ ] **Step 3: Remove the `handleScroll` function and its listener**

  Locate the `handleScroll` function:

  ```js
  function handleScroll() {
      if (Date.now() - lastAutoScrollTime < 100) return; // Ignore events triggered by auto-scroll
      position = window.scrollY * 10;
      if (position > (segments.length - drawDistance) * segmentLength) {
          position = (segments.length - drawDistance) * segmentLength;
      }
  }
  ```

  Delete the entire function. Then search the file for `handleScroll` to find any `window.addEventListener('scroll', handleScroll)` (or similar) and delete that line too.

  Also locate the `lastAutoScrollTime` variable declaration near the top (`let lastAutoScrollTime = 0;`) and delete it — nothing else should reference it after the next step.

- [ ] **Step 4: Remove the `window.scrollTo` write-back inside `gameLoop`**

  Locate the block at the end of the in-game update path:

  ```js
  // Sync scrollbar
  lastAutoScrollTime = Date.now();
  window.scrollTo(0, position / 10);
  ```

  Delete those three lines (the comment and both statements).

- [ ] **Step 5: Verify post-state in browser**

  Hard-reload http://localhost:8026/. Start the ride. Expected:
  - Scrollbar no longer moves on its own as the game advances.
  - The page is now only one viewport tall — scrollbar may not appear at all (body shrinks to natural size).
  - The ride still moves forward, steers, collects/dodges items, and reaches the finish line.
  - No console errors mentioning `lastAutoScrollTime` or `handleScroll`.

- [ ] **Step 6: Commit**

  ```bash
  git add "Guac Off 2026/index.js"
  git commit -m "Guac Off 2026: decouple game advance from page scroll

  Game is already self-propelled via position += currentSpeed; the
  scroll coupling (body height hack, handleScroll listener, scrollTo
  inside gameLoop) was only there to drive forward motion. Removing it
  frees the page scroll for real content below the canvas."
  ```

---

## Task 2: Convert game container from fixed to sticky

**Why:** `.game-container` is currently `position: fixed` covering the viewport, which removes it from document flow entirely — anything appended after it gets stacked underneath, invisible. `position: sticky` keeps the canvas pinned to the viewport for its first `100vh` and then releases naturally as the user scrolls down to the info section.

**Files:**
- Modify: `Guac Off 2026/index.html` (rename outer wrapper)
- Modify: `Guac Off 2026/index.css` (change `.game-container` positioning)

- [ ] **Step 1: Rename the wrapper in `index.html` to give it a semantic ID**

  Find the opening tag:

  ```html
  <div class="game-container">
  ```

  Change it to:

  ```html
  <section id="game-hero" class="game-container">
  ```

  Then find the matching closing tag — it's the `</div>` immediately before `<script src="index.js"></script>` (after the `<div class="ui-layer">…</div>` block). Change that closing `</div>` to `</section>`.

  Rationale: existing CSS still targets `.game-container`, but downstream tasks can hook to `#game-hero` if they need to. Matching open/close tags keep the HTML valid.

- [ ] **Step 2: Change the CSS positioning**

  In `Guac Off 2026/index.css`, locate the `.game-container` block:

  ```css
  .game-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #000;
    overflow: hidden;
  }
  ```

  Replace it with:

  ```css
  .game-container {
    position: sticky;
    top: 0;
    width: 100vw;
    height: 100vh;
    background-color: #000;
    overflow: hidden;
  }
  ```

  (Removed `left: 0` — irrelevant under sticky positioning since the element flows normally horizontally.)

- [ ] **Step 3: Verify post-state in browser**

  Hard-reload http://localhost:8026/. Expected:
  - Game looks the same as before — canvas fills viewport, menu overlay still appears.
  - Music toggle and restart buttons still positioned correctly (they're absolutely positioned inside `.game-container`, which remains a positioning context).
  - Page is still only one viewport tall (no info section yet), so no scrolling possible. That's correct.

- [ ] **Step 4: Commit**

  ```bash
  git add "Guac Off 2026/index.html" "Guac Off 2026/index.css"
  git commit -m "Guac Off 2026: convert game hero from fixed to sticky positioning

  position: sticky keeps the canvas pinned to the viewport for its
  first 100vh while leaving it in document flow, so we can append
  real content below."
  ```

---

## Task 3: Delete dead billboard rendering code

**Why:** A previous commit wrapped in-game billboard rendering in `if (false) { … }` to disable it. With the new info section taking over the "share details" role, the billboard code is permanently dead. Removing it keeps the file focused.

**Files:**
- Modify: `Guac Off 2026/index.js` (delete three blocks)

- [ ] **Step 1: Verify current pre-state**

  In `Guac Off 2026/index.js`, confirm these three regions exist:
  - The `billboards` array (around line 48): `const billboards = [ { z: 2000, … }, … ];`
  - The `billboardStyles` constant (search for `billboardStyles`)
  - The disabled render block inside `render()`: `// Draw Billboards on Canvas! (Hidden as requested)\n    if (false) { … }`

- [ ] **Step 2: Delete the `if (false) { … }` block**

  Inside the `render()` function, find:

  ```js
  // Draw Billboards on Canvas! (Hidden as requested)
  if (false) {
  billboards.forEach(b => {
      // ... lots of code ...
  });
  }
  ```

  Delete the comment, the `if (false) {`, the entire `billboards.forEach(b => { … });` block, and the matching closing `}` of the `if`.

- [ ] **Step 3: Verify nothing else references `billboards` or `billboardStyles`**

  Run:

  ```bash
  grep -n -E "billboards|billboardStyles" "Guac Off 2026/index.js"
  ```

  Expected: only the two definitions remain (the `const billboards = [ … ]` array and `const billboardStyles = { … }` or similar) — no other references.

- [ ] **Step 4: Delete the now-unused `billboards` array and `billboardStyles` constant**

  Delete both top-level definitions in full. Re-run the grep — expected: zero matches.

  Also delete the unused `<div id="billboards-container">` element from `Guac Off 2026/index.html` since it served only the deleted code:

  ```html
  <div id="billboards-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
  ```

- [ ] **Step 5: Syntax-check and browser-verify**

  Run:

  ```bash
  node --check "Guac Off 2026/index.js"
  ```

  Expected: no output (syntax OK). Hard-reload http://localhost:8026/ and start a ride — expected: no console errors, ride works exactly as before.

- [ ] **Step 6: Commit**

  ```bash
  git add "Guac Off 2026/index.js" "Guac Off 2026/index.html"
  git commit -m "Guac Off 2026: remove dead billboard code

  Billboard rendering was wrapped in if(false) and unused. With the
  info section taking over the share-details role, this whole block
  (array, styles, render loop, container div) can go."
  ```

---

## Task 4: Scaffold the info section HTML

**Why:** Add the new content region below the game with the four canonical blocks (intro, essentials, schedule, awards) and a minimal footer. Plain HTML, semantic structure, no styling yet — that comes in Task 5.

**Files:**
- Modify: `Guac Off 2026/index.html` (insert section between `</section>` and `<script>`)

- [ ] **Step 1: Insert the info section + footer after the game hero**

  In `Guac Off 2026/index.html`, find the closing `</section>` of `#game-hero` (set in Task 2). Immediately after that closing tag and before `<script src="index.js"></script>`, insert:

  ```html
      <section id="info">
        <p class="info-intro">The 14th annual SF Guac Off. A competition and a party.</p>

        <dl class="info-essentials">
          <dt>WHEN</dt>  <dd>Sept 13 · 1pm til the last chip</dd>
          <dt>WHERE</dt> <dd>TBD · revealed soon</dd>
          <dt>BRING</dt> <dd>Compete: 8 avos of guac · Attend: beer, a friend</dd>
          <dt>WIN</dt>   <dd>Guacamole Glory Trophy + 8 awards</dd>
          <dt>RULE</dt>  <dd>No double dipping</dd>
        </dl>

        <section class="info-schedule">
          <h2>THE AFTERNOON</h2>
          <ol>
            <li><span class="time">1:00 – 4:00</span><span class="what">Compete</span></li>
            <li><span class="time">4:00 – 4:30</span><span class="what">Vote</span></li>
            <li><span class="time">4:30 – …</span><span class="what">Winners, then chips</span></li>
          </ol>
        </section>

        <section class="info-awards">
          <h2>EIGHT TROPHIES</h2>
          <ul class="chips">
            <li>Best Guac</li>
            <li>Best Presentation</li>
            <li>Best Name</li>
            <li>Most Avocados</li>
            <li>Most Creative</li>
            <li>Spiciest</li>
            <li>Best Young Chef</li>
            <li>Heaviest Bowl</li>
          </ul>
        </section>
      </section>

      <footer id="info-footer">no double dipping · since 2012</footer>
  ```

- [ ] **Step 2: Verify post-state in browser**

  Hard-reload http://localhost:8026/. Expected:
  - Game still fills first viewport (sticky from Task 2).
  - Scrolling down reveals the unstyled info section — default browser styling, but all five label/value rows, the schedule, the eight categories, and the footer line are visible in order.
  - No console errors.

- [ ] **Step 3: Commit**

  ```bash
  git add "Guac Off 2026/index.html"
  git commit -m "Guac Off 2026: scaffold info section HTML

  Intro, essentials dl/dt/dd, schedule, eight-trophies chips, footer.
  Styling next."
  ```

---

## Task 5: Apply pixel-poster styling to the info section

**Why:** This is the visual payoff — turn the unstyled scaffold into the pixel-poster design approved in the spec. Park green background, cream text, orange accents, monospace headers, label-strip grid for the essentials, chip pills for the categories.

**Files:**
- Modify: `Guac Off 2026/index.css` (append at end of file)

- [ ] **Step 1: Append the info section styles to `index.css`**

  Add this block at the end of `Guac Off 2026/index.css`:

  ```css
  /* ============ Info section (below game hero) ============ */

  #info {
    background: #1b4d3e;
    color: #ebd2b4;
    font-family: var(--font-body); /* VT323 */
    padding: 56px 20px;
  }

  #info > * {
    max-width: 640px;
    margin-left: auto;
    margin-right: auto;
  }

  #info > * + * {
    margin-top: 40px;
  }

  .info-intro {
    text-align: center;
    font-size: 28px;
    line-height: 1.3;
  }

  /* Essentials label-strip grid */
  .info-essentials {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 6px 14px;
    font-size: 22px;
    line-height: 1.4;
  }

  .info-essentials dt {
    background: #ff5500;
    color: #ebd2b4;
    font-weight: bold;
    letter-spacing: 1px;
    text-align: center;
    padding: 2px 0;
    font-family: var(--font-title); /* Press Start 2P */
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .info-essentials dd {
    margin: 0;
    align-self: center;
  }

  /* Schedule */
  .info-schedule h2,
  .info-awards h2 {
    font-family: var(--font-title);
    font-size: 14px;
    color: #ff5500;
    letter-spacing: 2px;
    margin-bottom: 16px;
    text-align: center;
  }

  .info-schedule ol {
    list-style: none;
    padding: 0;
    font-size: 22px;
    line-height: 1.5;
  }

  .info-schedule li {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 12px;
  }

  .info-schedule .time {
    color: #ff5500;
  }

  /* Award chips */
  .chips {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .chips li {
    border: 2px solid #ff5500;
    border-radius: 999px;
    padding: 4px 14px;
    font-size: 20px;
    color: #ebd2b4;
    background: transparent;
  }

  /* Footer */
  #info-footer {
    background: #1b4d3e;
    color: #ebd2b4;
    text-align: center;
    font-family: var(--font-title);
    font-size: 10px;
    letter-spacing: 2px;
    padding: 20px;
    border-top: 1px dashed rgba(235, 210, 180, 0.3);
  }
  ```

- [ ] **Step 2: Verify post-state in browser**

  Hard-reload http://localhost:8026/. Scroll past the game. Expected:
  - Park-green background fills the section.
  - Intro line centered, cream-colored, large.
  - Five rows of orange-on-cream pixel-style labels with cream values to the right.
  - "THE AFTERNOON" header in tiny orange Press Start 2P, three schedule rows below with orange times and cream descriptions.
  - "EIGHT TROPHIES" header, eight orange-bordered pill chips wrapping centered.
  - Footer line in tiny orange-cream-mono at bottom with dashed top border.

  If anything looks off (e.g., labels collapsing oddly): screenshot DevTools, share with user before iterating.

- [ ] **Step 3: Commit**

  ```bash
  git add "Guac Off 2026/index.css"
  git commit -m "Guac Off 2026: pixel-poster styling for info section

  Park green bg, cream + orange palette, Press Start 2P labels and
  headings, VT323 body, label-strip dl grid, schedule list, chip
  pills for the eight award categories."
  ```

---

## Task 6: Mobile pass at 390px width

**Why:** Per the global mobile-responsiveness rule, the section must work at ~390px width (iPhone 12/13/14 portrait). The desktop styles should mostly hold (single column already), but check label-strip column width and font sizes don't break.

**Files:**
- Modify: `Guac Off 2026/index.css` (append media query)

- [ ] **Step 1: Pre-state — narrow the browser to 390px**

  In Chrome DevTools → toggle device toolbar → set width to 390px. Reload http://localhost:8026/. Scroll to the info section. Look for:
  - Label cells wrapping or pushing values onto a second visual row
  - Schedule `140px` time column eating too much of the value column
  - Chips overflowing or breaking awkwardly
  - Intro text wrapping ugly

  Note exactly what looks bad before changing anything.

- [ ] **Step 2: Append the mobile media query to `index.css`**

  At the end of `Guac Off 2026/index.css`:

  ```css
  @media (max-width: 480px) {
    #info {
      padding: 40px 16px;
    }

    .info-intro {
      font-size: 24px;
    }

    .info-essentials {
      grid-template-columns: 64px 1fr;
      font-size: 20px;
      gap: 6px 10px;
    }

    .info-essentials dt {
      font-size: 9px;
    }

    .info-schedule ol {
      font-size: 20px;
    }

    .info-schedule li {
      grid-template-columns: 110px 1fr;
      gap: 8px;
    }

    .chips li {
      font-size: 18px;
      padding: 3px 12px;
    }
  }
  ```

- [ ] **Step 3: Verify post-state at 390px**

  Reload at 390px. Expected:
  - Each label row stays on a single visual line.
  - Schedule rows align cleanly.
  - Chips wrap into 3–4 rows neatly, all visible.
  - Intro and headings fit without horizontal scroll.

  Also test at 360px (smaller Android) and 768px (tablet) to spot-check.

- [ ] **Step 4: Commit**

  ```bash
  git add "Guac Off 2026/index.css"
  git commit -m "Guac Off 2026: tighten info section at mobile widths

  Below 480px: shrink label column, reduce body font sizes, trim
  schedule time column so all rows hold a single line at 390px."
  ```

---

## Task 7: Add a persistent "↓ party details" hint on the game frame

**Why:** Without a visual cue, a first-time visitor might never realize there's a scrollable section below the game (the game looks like the whole page). A small, persistent tab in the bottom-right corner of the game frame solves that. Clicking it smooth-scrolls to `#info`.

**Files:**
- Modify: `Guac Off 2026/index.html` (add a button inside `#game-hero`)
- Modify: `Guac Off 2026/index.css` (style the hint button)
- Modify: `Guac Off 2026/index.js` (wire click → smooth scroll)

- [ ] **Step 1: Add the button to `index.html` inside `#game-hero`**

  Inside `<section id="game-hero" class="game-container">`, just before its closing `</section>` tag, add:

  ```html
  <button id="scroll-hint" type="button" aria-label="See party details below">↓ party details</button>
  ```

- [ ] **Step 2: Style the button in `index.css`**

  Append:

  ```css
  #scroll-hint {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 10;
    background: #1b4d3e;
    color: #ebd2b4;
    border: 2px solid #ff5500;
    font-family: var(--font-title);
    font-size: 9px;
    letter-spacing: 2px;
    padding: 6px 10px;
    cursor: pointer;
    text-transform: uppercase;
  }

  #scroll-hint:hover {
    background: #ff5500;
    color: #1b4d3e;
  }
  ```

- [ ] **Step 3: Wire the click handler in `index.js`**

  Near the bottom of `Guac Off 2026/index.js` (after the other `addEventListener` setup, before the touchstart block is fine), add:

  ```js
  document.getElementById('scroll-hint').addEventListener('click', (e) => {
      e.stopPropagation(); // don't trigger the global pause-on-click
      document.getElementById('info').scrollIntoView({ behavior: 'smooth' });
  });
  ```

- [ ] **Step 4: Verify post-state in browser**

  Hard-reload http://localhost:8026/. Expected:
  - Bottom-right of game shows a small orange-bordered "↓ PARTY DETAILS" button.
  - Hovering inverts the colors.
  - Clicking it smooth-scrolls the page down so the info section is in view.
  - The game does NOT pause when the button is clicked (the `stopPropagation` guards against the global click-to-pause listener).
  - On mobile (390px), the button is still visible and tappable without overlapping the music/restart buttons. If it overlaps, adjust the `right`/`bottom` offsets.

- [ ] **Step 5: Commit**

  ```bash
  git add "Guac Off 2026/index.html" "Guac Off 2026/index.css" "Guac Off 2026/index.js"
  git commit -m "Guac Off 2026: scroll-hint tab on game frame

  Tiny orange-bordered button in bottom-right of game hero that
  smooth-scrolls to the info section. stopPropagation keeps it from
  triggering the global click-to-pause."
  ```

---

## Task 8: Add a "see the party details ↓" CTA when the race finishes

**Why:** Players who finish the race naturally hit the existing finish screen ("You made it to the Guac Off!" + Final Score + Play Again). Add a second action that scrolls them into the invite. Most engaged-path users should land on the info section.

**Files:**
- Modify: `Guac Off 2026/index.html` (add a hidden DOM overlay button)
- Modify: `Guac Off 2026/index.css` (style + show/hide)
- Modify: `Guac Off 2026/index.js` (toggle visibility on race finish, wire click)

**Approach note:** The existing "Play Again" button is drawn on the canvas itself with hit-test on click coordinates (around `index.js:1212–1233`). Rather than fight that pattern for the new CTA, add a parallel DOM overlay button that becomes visible when `raceFinished` is true. This is simpler than canvas-coord hit testing and is more reliable on mobile.

- [ ] **Step 1: Add the hidden DOM button to `index.html` inside `#game-hero`**

  Inside `<section id="game-hero" …>`, near where the other overlays sit (e.g., right after the `#menu-overlay` block), add:

  ```html
  <button id="see-details-btn" type="button" hidden>see the party details ↓</button>
  ```

- [ ] **Step 2: Style and position the button in `index.css`**

  Append:

  ```css
  #see-details-btn {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, calc(-50% + 170px)); /* below Play Again, which sits around +100..+150 of canvas center */
    z-index: 10;
    background: #1b4d3e;
    color: #ebd2b4;
    border: 2px solid #ff5500;
    font-family: var(--font-title);
    font-size: 12px;
    letter-spacing: 2px;
    padding: 10px 18px;
    cursor: pointer;
    text-transform: uppercase;
  }

  #see-details-btn:hover {
    background: #ff5500;
    color: #1b4d3e;
  }

  #see-details-btn[hidden] {
    display: none;
  }
  ```

- [ ] **Step 3: Show the button when the race finishes**

  In `Guac Off 2026/index.js`, find the line where `raceFinished` gets set to `true` (look for `raceFinished = true;` — there's exactly one assignment-to-true site, around the line that fires when the player crosses the finish). Immediately after that assignment, add:

  ```js
  document.getElementById('see-details-btn').hidden = false;
  ```

  Then find every place `raceFinished = false;` appears (there are restart/init paths). Immediately after each, add:

  ```js
  document.getElementById('see-details-btn').hidden = true;
  ```

  This keeps the button's visibility in sync with the race state.

- [ ] **Step 4: Wire the click handler**

  At the bottom of `Guac Off 2026/index.js`, alongside the scroll-hint handler from Task 7, add:

  ```js
  document.getElementById('see-details-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('info').scrollIntoView({ behavior: 'smooth' });
  });
  ```

- [ ] **Step 5: Verify post-state in browser**

  Hard-reload http://localhost:8026/. To test the finish screen without playing the whole course, open DevTools console and run:

  ```js
  raceFinished = true;
  document.getElementById('see-details-btn').hidden = false;
  ```

  Expected: the "see the party details ↓" button appears centered, below the "Play Again" button on the canvas. Clicking it smooth-scrolls to `#info`. Then in the console, run:

  ```js
  raceFinished = false;
  document.getElementById('see-details-btn').hidden = true;
  ```

  Expected: button disappears.

  Then play through the menu (or use the dev console to set `position = (segments.length - 5) * segmentLength` to fast-forward) until the race naturally finishes — confirm the button shows up automatically. Click "Play Again" — confirm the button disappears.

- [ ] **Step 6: Commit**

  ```bash
  git add "Guac Off 2026/index.html" "Guac Off 2026/index.css" "Guac Off 2026/index.js"
  git commit -m "Guac Off 2026: finish-line CTA to scroll into info section

  DOM overlay button shows/hides with raceFinished state and smooth-
  scrolls to #info on click. Sits below the existing canvas-drawn
  Play Again button."
  ```

---

## Final Verification

After all tasks land:

- [ ] **Full play-through on desktop (1440px+):**
  - Land on page → menu overlay appears → pick vehicle/scene → start ride.
  - Ride feels the same as before (steering, speed, obstacles, pickups, finish).
  - Click "↓ party details" hint on game frame → smooth scrolls to info section.
  - All four blocks render correctly with the pixel-poster styling.
  - Reload, complete the race → "see the party details ↓" appears → click → smooth scrolls to info.
  - "Play Again" still works.

- [ ] **Full play-through on mobile (390px, real device or DevTools device mode):**
  - Menu works.
  - Gyroscope steering still prompts for permission and works (iOS).
  - Scroll hint button doesn't overlap music/restart buttons.
  - Info section reads cleanly: no horizontal scroll, no clipped text.
  - Tap finish CTA → scrolls to info.

- [ ] **Console clean:** No JS errors during gameplay or scroll.

- [ ] **`grep` confirms cleanup:**
  ```bash
  grep -n -E "scrollY|scrollTo|handleScroll|lastAutoScrollTime|billboards|billboardStyles" "Guac Off 2026/index.js" "Guac Off 2026/index.html"
  ```
  Expected: zero matches.

If everything passes, the work is done. If anything fails, stop and report rather than papering over.
