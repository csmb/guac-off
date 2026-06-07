# 🥑 Distance + "Avocado Stops on the Way" — Design

**Date:** 2026-06-06
**Status:** Approved (design); plan written, implementation deferred by user
**Project:** Guac Off 2026 — `Guac Off 2026/find/` (the "point your phone at the party" page)
**Builds on:** [2026-06-06-point-to-party-design.md](2026-06-06-point-to-party-design.md)

## Concept

Two additions to the compass-hunt reveal card:

1. **Distance** — "You're **2.3 mi** from the party" (miles from the user's GPS to the venue).
2. **Avocado stops** — a short list of grocery stores **between you and the party** that sell
   avocados, so guests can grab ingredients on the way: `Store name · 0.8 mi · [map ↗]`,
   ordered from you → venue.

Both render on the **reveal card** (after the address is unlocked), so listing nearby stores
never leaks the secret location early.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Store data source | **OpenStreetMap Overpass API** (`overpass-api.de`) — free, no key, CORS, client-side. No backend (static site). |
| What "sells avocados" | **`shop=supermarket` + `shop=greengrocer`** (the reliable "definitely has avocados" set). |
| "Between you and the party" | **Corridor along the straight line** — stores within ~1 mi of the you→venue segment, ordered by progress along it. No routing API. |
| Distance units | **Miles** (`meters / 1609.344`). |
| Where shown | **Reveal card**, after unlock. |
| Corridor buffer | ~**1 mile** (tunable). |
| List cap | **8** stores (tunable). |
| Far-away cutoff | **~75 mi** straight-line — beyond that, skip the store query (a cross-region corridor is a giant, useless Overpass query). |

## Architecture

Extends the existing self-contained `find/` mini-app (script tags, no build step). New/changed files:

```
Guac Off 2026/find/
  helpers.js     (+pure geometry) metersToMiles, bboxAround, pointToSegment (dist + progress t),
                 corridorFilter — all pure + unit-tested via the existing Node runner.
  stores.js      (NEW, window.FindStores) buildOverpassQuery + parseOverpass (PURE, tested) and
                 async findAvocadoStops(from, to) which fetches Overpass + filters via FindHelpers.
                 Only the fetch is impure.
  index.html     (+reveal card) distance line + avocado-stops list container; loads stores.js
                 between helpers.js and index.js.
  index.css      (+styles) distance line, stops list, loading/empty/error states.
  index.js       (+doReveal) show distance immediately (if GPS known); kick off the async store
                 lookup (non-blocking) and render the list with graceful fallbacks.
```

**Why a separate `stores.js`:** the Overpass concern (query string, HTTP, JSON shape) is distinct
from both the pure math (`helpers.js`) and the UI orchestration (`index.js`). Isolating it keeps
each file single-purpose and lets the query-build + parse be unit-tested without a network.

## The geometry (pure, in `helpers.js`)

- `metersToMiles(m)` → `m / 1609.344`.
- `bboxAround(from, to, padMeters)` → `{south, west, north, east}`: min/max lat/lng of the two
  points, expanded by `padMeters` (lat: `/110540`; lng: `/(111320·cos(refLat))`, refLat = midpoint).
- `pointToSegment(p, a, b)` → `{ distM, t }`: project `a,b,p` to local east/north meters
  (equirectangular about `a` — accurate at city scale), compute `t = dot(AP,AB)/|AB|²`
  (progress along the line; may fall outside [0,1]) and `distM` = perpendicular distance to the
  segment. Degenerate `a==b` → `{distM: |P−A|, t: 0}`.
- `corridorFilter(stores, from, to, bufferMeters)` → keeps stores with `distM ≤ bufferMeters`
  **and** `0 ≤ t ≤ 1` (genuinely between the endpoints), each annotated with `{distM, t}`,
  **sorted by `t`** (you → venue). Pure; takes a plain store array, so fully unit-testable.

## `stores.js`

- `buildOverpassQuery(bbox)` → Overpass QL string (pure):
  ```
  [out:json][timeout:15];
  ( node["shop"="supermarket"](S,W,N,E); way["shop"="supermarket"](S,W,N,E);
    node["shop"="greengrocer"](S,W,N,E); way["shop"="greengrocer"](S,W,N,E); );
  out center tags;
  ```
- `parseOverpass(json)` → `[{name, lat, lng}]` (pure): coords from `el.lat/lon` or `el.center`;
  `name` from `el.tags.name`; **skip unnamed or coordinate-less** elements; dedupe by name+rounded
  coords.
- `findAvocadoStops(from, to, opts)` async: `bboxAround` → `buildOverpassQuery` → `fetch`
  (POST `data=`, `AbortController` 12 s timeout) → `parseOverpass` → `corridorFilter` →
  annotate each with `miFromUser = metersToMiles(haversineMeters(from, store))` → cap to 8.
  Returns the list; throws on network/timeout (caller handles).
- Exposes `window.FindStores = { findAvocadoStops, buildOverpassQuery, parseOverpass }`.

## Data flow & states (in `index.js` `doReveal`)

1. Reveal shows instantly: address (existing) + **distance** "You're X.X mi from the party"
   (only if `currentPos` is known).
2. Non-blocking: render the stops section:
   - **No GPS** (`currentPos` null — escape-hatch reveal, or already-found-on-reload): hide both
     distance and stops (no origin to measure from).
   - **Far away** (`haversineMeters(currentPos, venue) > ~75 mi`): "You're a road trip away —
     avocado stops show once you're closer 🥑". Skip the query.
   - Otherwise: show **"Finding avocado stops… 🥑"**, await `findAvocadoStops`, then:
     - **list** → rows `name · X.X mi · [map ↗]` (Maps link = `…/maps/search/?api=1&query=` of
       name + `lat,lng`), or
     - **empty** → "No avocado stops mapped on the way — BYO 🥑", or
     - **error/timeout** → "Couldn't load avocado stops — tap to retry" (retry re-runs the query).

## Error / edge handling

| Condition | Behavior |
|---|---|
| `currentPos` null at reveal | Hide distance + stops sections entirely |
| Straight-line > ~75 mi | Skip query; show "road trip away" note |
| Overpass timeout/HTTP error | "Couldn't load — tap to retry" |
| Zero stores after filter | "No avocado stops mapped on the way — BYO 🥑" |
| Stores without a name/coords | Skipped in `parseOverpass` |

## Privacy

`findAvocadoStops` sends a bounding box covering you→venue to `overpass-api.de` (third party).
This runs **only after** the address is unlocked, so it doesn't leak the secret early. Noted in a
code comment.

## Testing

- **Unit (Node, existing runner):** `metersToMiles`; `bboxAround` (known points + padding);
  `pointToSegment` (a point beside a known segment → expected `distM`/`t`; point past an endpoint →
  `t>1`); `corridorFilter` (in-corridor kept, out-of-corridor/past-ends dropped, ordering by `t`,
  cap); `buildOverpassQuery` (contains both shop filters + bbox); `parseOverpass` (nodes + `center`
  ways, drops unnamed, dedupes).
- **Integration (headless Chrome, stubbed `fetch`):** drive a reveal with sample Overpass JSON →
  assert distance line + sorted store list render; assert empty / error+retry / far / no-GPS
  fallbacks.

## Out of scope (YAGNI)

- Live distance during the hunt (reveal-only for now; trivial to add later).
- Driving-route corridor (needs a routing API).
- Convenience/corner stores or ratings/photos (supermarket+greengrocer via OSM only).
- Caching Overpass results.
