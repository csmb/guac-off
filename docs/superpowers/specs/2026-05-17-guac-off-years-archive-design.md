# Guac Off Through the Years — Archive Gallery

**Date:** 2026-05-17
**Status:** Approved (design)

## Goal

Add a "Guac Off Through the Years" archive to the current site so visitors can
click through every prior year (2012–2026) from the 2026 home page. Each year is
a self-contained static snapshot of that year's finalized (early-September) site,
surfaced through a chronological gallery with a representative image per year.

## Context & Findings

- The top-level `guac-off` git repo is a single March-2026 import. There is **no
  recoverable year-by-year git history** (no nested repos, submodules, tags, or
  branches). `~/code/guac-off` is the same repo.
- Folder names are unreliable: `missionguacparty2014` content says 2015,
  `missionguacparty2016` is actually a "Guac Off 2021" Geocities-style page,
  `guac` (Rails) is a second 2012 app, etc.
- The old sites were deployed live. The real archive is the **Wayback Machine**,
  against these domains:
  - `guacamole.expert` (2015–2026, canonical domain)
  - `missionguacparty.com` (2013–2017, early years)
  - `guacwalk.org` (2020 "GuacWalk" COVID year, persists through 2025)
  - `missionguacparty.herokuapp.com` (sparse)
- `guacoff.com` (2004–2016, generic business-template site) is an **unrelated
  older event** — explicitly excluded.

## Scope

### In scope

- Static snapshot of each year's **landing page only**, 2012–2026.
- A gallery index page with one image card per year.
- A subtle entry point on the 2026 home page.

### Out of scope

- `guacoff.com` (unrelated event).
- `guac-game` (2025 React/Vite — would need a build).
- `guac_game_v2` (Python Pygame — not web).
- Live functionality of old apps (forms/voting are inert).
- Inner pages beyond the landing page.

## Architecture

Chosen approach: **self-contained `years/` directory inside the 2026 site
folder** (approach A from brainstorming). Originals at repo root are never
modified — the archive only reads from them. Serving and deploy are unchanged
because everything resolves via relative links from the already-served 2026
folder.

```
Guac Off 2026/
  index.html            ← add subtle "↩ guac off through the years" link near footer
  years/
    index.html          ← responsive gallery, newest-first (2026 → 2012)
    2026/  …             ← one self-contained static snapshot per year
    2025/  …
    …
    2012/  …
    assets/              ← shared gallery CSS / thumbnail images
```

Each `years/<year>/` is a self-contained unit: an `index.html` plus its own
downloaded assets with paths rewritten to be local and relative. A unit can be
understood and verified in isolation (open it, it renders without network).

## Per-year sourcing

Target the capture nearest each year's early-September event (the finalized
site). Wayback pages are fetched raw via the `id_` modifier
(`https://web.archive.org/web/<timestamp>id_/<url>`) to avoid the Wayback
toolbar and URL rewriting; referenced assets (CSS/images/video) are downloaded
and links rewritten to local relative paths.

| Year | Source | Capture / location |
|---|---|---|
| 2012 | Local folder | `missionguacparty2012` Rails ERB → rendered static (no web archive exists) |
| 2013 | Wayback | `missionguacparty.com` 2013-09 |
| 2014 | Wayback | `missionguacparty.com` 2014-12 (no Sept capture) |
| 2015 | Wayback | `guacamole.expert` 2015-08-24 |
| 2016 | Wayback | closest early-2016 capture, labeled "approx." (no Sept capture) |
| 2017 | Wayback | `guacamole.expert` 2017-08/09 |
| 2018 | Wayback | `guacamole.expert` 2018-11 (post-event) |
| 2019 | Wayback | `guacamole.expert` 2019-08/09 |
| 2020 | Wayback | `guacwalk.org` 2020-10/11 (GuacWalk year) |
| 2021 | Local folder | `missionguacparty2016/public/guac.html` (the "Guac Off 2021" Geocities page); fix image path |
| 2022 | Wayback | `guacamole.expert` 2022-08-18 |
| 2023 | Wayback | `guacamole.expert` 2023-09 |
| 2024 | Wayback | `guacamole.expert` 2024-09-05 |
| 2025 | Wayback / local | `guacamole.expert` 2025-08 (cross-check local `guac2025`) |
| 2026 | Local (live) | Link to the current 2026 site; do not duplicate it |

Notes:
- 2012 and 2016 are best-effort by explicit decision; 2016 carries a small
  "approximate — closest available capture" note in the gallery.
- 2017's card is the real archived 2017 site. The `guac-voting-2017` vote-tally
  script rides along as a small "how 2017 was judged" behind-the-scenes link on
  that card (the script's logic + its computed category results, styled).
- 2026's card links to the live current site rather than snapshotting it.

## Per-year image

"Decide per year": programmatic screenshot of the rendered snapshot where the
page looks good; a hand-picked hero asset (logo / party photo from that year's
assets) where a screenshot would be weak (2012 Rails, sparse pages).

**Technical risk:** screenshot tooling is unresolved. Candidates: a headless
browser (Chrome headless / Playwright — Node is available via `guac-game`'s
toolchain), or the Wayback Machine's own thumbnail service. This decision is
deferred to the implementation plan; it is the primary risk for this work.
Thumbnails live in `years/assets/` and are referenced by the gallery.

## Gallery page

- Responsive card grid, mobile-first, verified at ≤375px and desktop.
- Chronological, newest-first (2026 at top → 2012 at bottom).
- Each card: thumbnail image + year + event name + one-line description +
  link into that year's snapshot.
- Styled to nod at the 2026 aesthetic but clearly reads as an archive index
  (not a competing hero experience).

## Integration

A subtle, non-intrusive link on the 2026 home page (near the footer / party
details area, e.g. after `#info-footer`) reading roughly "↩ guac off through
the years", linking to `years/`. Must not disrupt the game hero or info flow.

## Error handling & edge cases

- A Wayback fetch failing or returning non-200: retry the next-closest capture
  for that year; if none usable, fall back to a hand-picked image + a short
  "snapshot unavailable" note rather than a broken card.
- Inert forms/links in snapshots: a `title`/tooltip noting "archived — was live
  in <year>".
- Missing assets in a capture: best-effort; a missing decorative asset must not
  break the page.
- Mixed/absolute URLs in captured HTML rewritten to local relative paths so
  snapshots render fully offline.

## Verification

- Each `years/<year>/index.html` opens and renders offline (no network calls)
  with its styling intact.
- Gallery renders correctly at 375px and desktop widths; every card links to a
  working snapshot.
- The 2026 home page link works and does not disrupt the game/info sections.
- Originals at repo root are byte-for-byte unchanged (git status clean outside
  `Guac Off 2026/years/` and the one `index.html` link addition).
