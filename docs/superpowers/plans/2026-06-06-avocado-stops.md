# Distance + Avocado Stops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `find/` reveal card, show how many miles you are from the party and a short list of supermarkets/greengrocers in the corridor between you and the venue.

**Architecture:** Add pure, unit-tested geometry to `find/helpers.js`; a new `find/stores.js` (`window.FindStores`) that queries the free OpenStreetMap Overpass API and filters results through the corridor geometry; and reveal-card UI wired in `find/index.js`. No backend, no API key.

**Tech Stack:** Vanilla JS (script tags, no build), Overpass API (`overpass-api.de`), `fetch` + `AbortController`, `localStorage` (existing). Tests: Node runner (`node "Guac Off 2026/find/*.test.js"`) + headless-Chrome integration with a stubbed `fetch`.

**Spec:** `docs/superpowers/specs/2026-06-06-avocado-stops-design.md`

---

## File Structure

```
Guac Off 2026/find/
  helpers.js       (+pure geom) metersToMiles, bboxAround, pointToSegment, corridorFilter
  helpers.test.js  (+tests for the above)
  stores.js        (NEW) window.FindStores: buildOverpassQuery + parseOverpass (pure) +
                   findAvocadoStops(from,to) (async fetch + filter). UMD-lite (Node + browser).
  stores.test.js   (NEW) Node tests for buildOverpassQuery + parseOverpass
  index.html       (+reveal card) distance line + stops list; load stores.js before index.js
  index.css        (+styles) distance line, stops list, message states
  index.js         (+doReveal) render distance + async stops with loading/empty/error/far/no-GPS
```

**Conventions to match:** `helpers.js` is a UMD-lite IIFE exposing `window.FindHelpers` + `module.exports`; `stores.js` mirrors it as `window.FindStores`. Constants live in a `constants` block. Reveal visibility is toggled via the existing `show()/hide()` helpers (set `.hidden` + `aria-hidden`).

---

## Task 1: Geometry helpers (`metersToMiles`, `bboxAround`, `pointToSegment`, `corridorFilter`)

**Files:**
- Modify: `Guac Off 2026/find/helpers.js`
- Modify: `Guac Off 2026/find/helpers.test.js`

- [ ] **Step 1: Add failing tests**

In `Guac Off 2026/find/helpers.test.js`, add before the final `console.log(`${passed}...`)`:

```js
// --- distance + corridor geometry (avocado stops) ---
eq('metersToMiles(1609.344) -> 1', H.metersToMiles(1609.344), 1, 1e-6);
eq('metersToMiles(0) -> 0', H.metersToMiles(0), 0, 1e-9);

// bboxAround: pad=0 is just the min/max of the two points
const bb0 = H.bboxAround({lat:0,lng:0}, {lat:0,lng:1}, 0);
eq('bboxAround pad0 south', bb0.south, 0, 1e-9);
eq('bboxAround pad0 north', bb0.north, 0, 1e-9);
eq('bboxAround pad0 west',  bb0.west,  0, 1e-9);
eq('bboxAround pad0 east',  bb0.east,  1, 1e-9);
// ~111195 m of padding ≈ 1° of latitude
const bbP = H.bboxAround({lat:0,lng:0}, {lat:0,lng:1}, 111195);
eq('bboxAround pad ~1deg south', bbP.south, -1, 0.01);
eq('bboxAround pad ~1deg north', bbP.north,  1, 0.01);

// pointToSegment: segment due east along the equator, length ~111195 m
const A = {lat:0,lng:0}, B = {lat:0,lng:1};
const onLine = H.pointToSegment({lat:0,lng:0.5}, A, B);
eq('pointToSegment on-line distM ~0', onLine.distM, 0, 1);
eq('pointToSegment on-line t ~0.5', onLine.t, 0.5, 1e-6);
const offLine = H.pointToSegment({lat:0.001,lng:0.5}, A, B); // ~111 m north of midpoint
eq('pointToSegment offset distM ~111m', offLine.distM, 111, 5);
eq('pointToSegment offset t ~0.5', offLine.t, 0.5, 1e-4);
const past = H.pointToSegment({lat:0,lng:1.5}, A, B);
eq('pointToSegment past-end t>1', past.t > 1, true);

// corridorFilter: keep within buffer AND between endpoints, sorted you->venue
const stores = [
  {name:'on',   lat:0,     lng:0.5},   // on the line, t=0.5
  {name:'near', lat:0.005, lng:0.25},  // ~556 m off, t=0.25
  {name:'far',  lat:0.05,  lng:0.5},   // ~5560 m off -> dropped
  {name:'past', lat:0,     lng:1.5},   // t>1 -> dropped
];
const kept = H.corridorFilter(stores, A, B, 1000);
eq('corridorFilter keeps 2', kept.length, 2);
eq('corridorFilter sorted near-then-on', kept.map(s=>s.name).join(','), 'near,on');
eq('corridorFilter annotates distM', kept[0].distM > 0, true);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: FAIL/throw — `H.metersToMiles is not a function`.

- [ ] **Step 3: Implement the helpers**

In `Guac Off 2026/find/helpers.js`, add these functions before the `return {` (they may reference the existing `R_EARTH_M`, `toRad`, `toDeg`, `clamp`):

```js
  function metersToMiles(m) { return m / 1609.344; }

  // Bounding box covering both points, expanded by padMeters. {south,west,north,east}.
  function bboxAround(from, to, padMeters) {
    const refLat = (from.lat + to.lat) / 2;
    const dLat = toDeg(padMeters / R_EARTH_M);
    const dLng = toDeg(padMeters / (R_EARTH_M * Math.cos(toRad(refLat)) || R_EARTH_M));
    return {
      south: Math.min(from.lat, to.lat) - dLat,
      north: Math.max(from.lat, to.lat) + dLat,
      west:  Math.min(from.lng, to.lng) - dLng,
      east:  Math.max(from.lng, to.lng) + dLng,
    };
  }

  // Local equirectangular projection: meters east/north of `origin`. Accurate at city scale.
  function _projectMeters(p, origin) {
    return {
      x: toRad(p.lng - origin.lng) * Math.cos(toRad(origin.lat)) * R_EARTH_M,
      y: toRad(p.lat - origin.lat) * R_EARTH_M,
    };
  }

  // Perpendicular distance (m) from p to segment a-b, plus progress t along a->b (0..1 = between).
  function pointToSegment(p, a, b) {
    const Bp = _projectMeters(b, a); // a is the local origin (0,0)
    const Pp = _projectMeters(p, a);
    const len2 = Bp.x * Bp.x + Bp.y * Bp.y;
    if (len2 === 0) return { distM: Math.hypot(Pp.x, Pp.y), t: 0 };
    const t = (Pp.x * Bp.x + Pp.y * Bp.y) / len2;
    const ct = clamp(t, 0, 1);
    return { distM: Math.hypot(Pp.x - ct * Bp.x, Pp.y - ct * Bp.y), t: t };
  }

  // Keep stores within bufferMeters of the from->to line AND between the endpoints; sort from->to.
  function corridorFilter(stores, from, to, bufferMeters) {
    return stores
      .map(function (s) {
        const seg = pointToSegment({ lat: s.lat, lng: s.lng }, from, to);
        return Object.assign({}, s, { distM: seg.distM, t: seg.t });
      })
      .filter(function (s) { return s.distM <= bufferMeters && s.t >= 0 && s.t <= 1; })
      .sort(function (x, y) { return x.t - y.t; });
  }
```

Then add the names to the returned object — change:

```js
    bearing, haversineMeters, isNearVenue, clamp, toRad, toDeg,
```

to:

```js
    bearing, haversineMeters, isNearVenue, clamp, toRad, toDeg,
    metersToMiles, bboxAround, pointToSegment, corridorFilter,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node "Guac Off 2026/find/helpers.test.js"`
Expected: PASS — `59 passed, 0 failed` (46 existing + 13 new).

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/helpers.js" "Guac Off 2026/find/helpers.test.js"
git commit -m "find: corridor + distance geometry helpers (metersToMiles, bboxAround, pointToSegment, corridorFilter)"
```

---

## Task 2: `stores.js` — Overpass query, parse, and `findAvocadoStops`

**Files:**
- Create: `Guac Off 2026/find/stores.js`
- Create: `Guac Off 2026/find/stores.test.js`

- [ ] **Step 1: Write the failing test**

Create `Guac Off 2026/find/stores.test.js`:

```js
'use strict';
// Node tests for find/stores.js pure functions — run: node "Guac Off 2026/find/stores.test.js"
const S = require('./stores.js');

let passed = 0, failed = 0;
function eq(name, actual, expected, tol = 0) {
  const ok = (typeof actual === 'object')
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : (tol ? Math.abs(actual - expected) <= tol : actual === expected);
  if (ok) { passed++; }
  else { failed++; console.log(`✗ ${name}\n    expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`); }
}

// buildOverpassQuery: includes both shop filters and the bbox numbers
const q = S.buildOverpassQuery({ south: 1, west: 2, north: 3, east: 4 });
eq('query has supermarket', q.includes('"shop"="supermarket"'), true);
eq('query has greengrocer', q.includes('"shop"="greengrocer"'), true);
eq('query has bbox', q.includes('(1,2,3,4)'), true);
eq('query asks for json', q.includes('[out:json]'), true);
eq('query asks center for ways', q.includes('out center'), true);

// parseOverpass: node coords, way center coords, drop unnamed, dedupe
const json = { elements: [
  { type:'node', lat:37.75, lon:-122.42, tags:{ name:'Bi-Rite', shop:'greengrocer' } },
  { type:'way', center:{ lat:37.76, lon:-122.43 }, tags:{ name:'Safeway', shop:'supermarket' } },
  { type:'node', lat:37.77, lon:-122.44, tags:{ shop:'supermarket' } },           // no name -> drop
  { type:'node', lat:37.75, lon:-122.42, tags:{ name:'Bi-Rite', shop:'greengrocer' } }, // dupe -> drop
  { type:'node', tags:{ name:'NoCoords', shop:'supermarket' } },                  // no coords -> drop
] };
const parsed = S.parseOverpass(json);
eq('parseOverpass keeps 2', parsed.length, 2);
eq('parseOverpass first is Bi-Rite', parsed[0].name, 'Bi-Rite');
eq('parseOverpass uses way center', parsed[1].lat, 37.76, 1e-9);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node "Guac Off 2026/find/stores.test.js"`
Expected: FAIL — `Cannot find module './stores.js'`.

- [ ] **Step 3: Implement `stores.js`**

Create `Guac Off 2026/find/stores.js`:

```js
// Finds supermarkets/greengrocers in the corridor between you and the party, via the free
// OpenStreetMap Overpass API. Loads in Node (module.exports) and the browser (window.FindStores).
// PRIVACY: findAvocadoStops sends a bbox covering you->venue to overpass-api.de. It runs only
// AFTER the address is revealed, so it does not leak the secret location early.
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FindStores = api;
})(function () {
  'use strict';

  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  const SHOPS = ['supermarket', 'greengrocer'];
  const BUFFER_METERS = 1609.344;  // ~1 mile corridor half-width
  const PAD_METERS = 1609.344;     // bbox padding around the line
  const MAX_RESULTS = 8;
  const FETCH_TIMEOUT_MS = 12000;

  function buildOverpassQuery(bbox) {
    const b = bbox.south + ',' + bbox.west + ',' + bbox.north + ',' + bbox.east;
    const parts = SHOPS.map(function (s) {
      return 'node["shop"="' + s + '"](' + b + ');way["shop"="' + s + '"](' + b + ');';
    }).join('');
    return '[out:json][timeout:25];(' + parts + ');out center tags;';
  }

  function parseOverpass(json) {
    const els = (json && json.elements) || [];
    const out = [], seen = {};
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const lat = (typeof el.lat === 'number') ? el.lat : (el.center && el.center.lat);
      const lng = (typeof el.lon === 'number') ? el.lon : (el.center && el.center.lon);
      const name = el.tags && el.tags.name;
      if (!name || typeof lat !== 'number' || typeof lng !== 'number') continue;
      const key = name + '@' + lat.toFixed(4) + ',' + lng.toFixed(4);
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ name: name, lat: lat, lng: lng });
    }
    return out;
  }

  // Async: returns [{name, miFromUser, mapsUrl}] sorted you->venue, capped. Throws on fetch error.
  async function findAvocadoStops(from, to) {
    const H = window.FindHelpers;
    const query = buildOverpassQuery(H.bboxAround(from, to, PAD_METERS));
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    let json;
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
      json = await res.json();
    } finally {
      clearTimeout(timer);
    }
    return H.corridorFilter(parseOverpass(json), from, to, BUFFER_METERS)
      .slice(0, MAX_RESULTS)
      .map(function (s) {
        return {
          name: s.name,
          miFromUser: H.metersToMiles(H.haversineMeters(from, { lat: s.lat, lng: s.lng })),
          mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' +
                   encodeURIComponent(s.name + ' ' + s.lat + ',' + s.lng),
        };
      });
  }

  return {
    findAvocadoStops, buildOverpassQuery, parseOverpass,
    constants: { BUFFER_METERS, PAD_METERS, MAX_RESULTS, FETCH_TIMEOUT_MS },
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node "Guac Off 2026/find/stores.test.js"`
Expected: PASS — `10 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/stores.js" "Guac Off 2026/find/stores.test.js"
git commit -m "find: stores.js — Overpass query/parse + findAvocadoStops corridor search"
```

---

## Task 3: Reveal-card markup + styles

**Files:**
- Modify: `Guac Off 2026/find/index.html`
- Modify: `Guac Off 2026/find/index.css`

- [ ] **Step 1: Add the reveal-card elements**

In `Guac Off 2026/find/index.html`, replace the reveal block:

```html
      <p class="reveal-address" id="reveal-address"></p>
      <p class="reveal-when">Sept 12 · 1pm 'til the last chip</p>
      <a id="maps-link" class="btn maps" href="#" target="_blank" rel="noopener">Open in Maps ↗</a>
      <button id="play-again" class="link-btn" type="button" hidden>play the hunt again</button>
```

with:

```html
      <p class="reveal-address" id="reveal-address"></p>
      <p class="reveal-distance" id="reveal-distance" hidden></p>
      <p class="reveal-when">Sept 12 · 1pm 'til the last chip</p>
      <a id="maps-link" class="btn maps" href="#" target="_blank" rel="noopener">Open in Maps ↗</a>
      <div class="reveal-stops" id="reveal-stops" hidden>
        <p class="stops-title">🥑 grab avocados on the way</p>
        <ul class="stops-list" id="stops-list"></ul>
        <p class="stops-msg" id="stops-msg" hidden></p>
      </div>
      <button id="play-again" class="link-btn" type="button" hidden>play the hunt again</button>
```

- [ ] **Step 2: Load `stores.js` before `index.js`**

In `Guac Off 2026/find/index.html`, replace:

```html
  <script src="helpers.js"></script>
  <script src="index.js"></script>
```

with:

```html
  <script src="helpers.js"></script>
  <script src="stores.js"></script>
  <script src="index.js"></script>
```

- [ ] **Step 3: Add styles**

In `Guac Off 2026/find/index.css`, append:

```css
/* Reveal: distance + avocado stops */
.reveal-distance { margin: 0; font-size: 1rem; opacity: 0.9; }
.reveal-distance[hidden] { display: none; }
.reveal-stops {
  width: 100%; max-width: 20rem; margin: 0.2rem auto 0;
}
.reveal-stops[hidden] { display: none; }
.stops-title { margin: 0 0 0.3rem; font-size: 0.95rem; font-weight: 700; color: #39ff14; }
.stops-list { list-style: none; margin: 0; padding: 0; text-align: left; }
.stops-row { margin: 0.18rem 0; font-size: 0.9rem; line-height: 1.3; }
.stops-row a {
  color: #f5e6c8; text-decoration: none;
  border-bottom: 1px dotted rgba(245, 230, 200, 0.5);
}
.stops-msg { margin: 0.3rem 0 0; font-size: 0.85rem; opacity: 0.85; }
.stops-msg[hidden] { display: none; }
```

- [ ] **Step 4: Verify markup loads**

Run: `cd "Guac Off 2026" && python3 -m http.server 8097`
Open: `http://guacoff.localhost:8097/find/` and in DevTools console run
`['reveal-distance','reveal-stops','stops-list','stops-msg'].map(id=>!!document.getElementById(id))`
Expected: `[true, true, true, true]`. (No console errors; `window.FindStores` is defined.)

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/find/index.html" "Guac Off 2026/find/index.css"
git commit -m "find: reveal-card markup + styles for distance and avocado stops"
```

---

## Task 4: Wire distance + stops into `doReveal`

**Files:**
- Modify: `Guac Off 2026/find/index.js`

- [ ] **Step 1: Import the new helper + reference `FindStores`**

In `Guac Off 2026/find/index.js`, change the destructure:

```js
  const { bearing, haversineMeters, isNearVenue, warmth,
          pointingVector, bearingVector, angleBetween, aimFromCompass, smoothVector,
          shouldLock, dec } = H;
```

to add `metersToMiles`:

```js
  const { bearing, haversineMeters, isNearVenue, warmth, metersToMiles,
          pointingVector, bearingVector, angleBetween, aimFromCompass, smoothVector,
          shouldLock, dec } = H;
  const FindStores = window.FindStores;
```

- [ ] **Step 2: Add DOM references**

In `Guac Off 2026/find/index.js`, change:

```js
  const reveal = $('reveal'), revealAddress = $('reveal-address'), mapsLink = $('maps-link'), playAgain = $('play-again');
```

to:

```js
  const reveal = $('reveal'), revealAddress = $('reveal-address'), mapsLink = $('maps-link'), playAgain = $('play-again');
  const revealDistance = $('reveal-distance'), revealStops = $('reveal-stops');
  const stopsList = $('stops-list'), stopsMsg = $('stops-msg');
```

- [ ] **Step 3: Render distance + stops from `doReveal`**

In `Guac Off 2026/find/index.js`, find the end of `doReveal`:

```js
    show(reveal);
    reveal.focus();
    if (persist) { try { localStorage.setItem(STORE_KEY, '1'); } catch (e) {} playChime(); }
    if (persist) show(playAgain);
  }
```

and insert a `renderExtras();` call plus the two new functions right after `doReveal`:

```js
    show(reveal);
    reveal.focus();
    renderExtras();
    if (persist) { try { localStorage.setItem(STORE_KEY, '1'); } catch (e) {} playChime(); }
    if (persist) show(playAgain);
  }

  // Distance + "avocado stops on the way" — both need our location, so skip them when we
  // revealed without GPS (escape hatch before locating, or already-found on reload).
  function renderExtras() {
    if (!currentPos) { hide(revealDistance); hide(revealStops); return; }
    const meters = haversineMeters(currentPos, venue);
    revealDistance.textContent = "You're " + metersToMiles(meters).toFixed(1) + ' mi from the party';
    show(revealDistance);
    renderStops(meters);
  }

  function renderStops(meters) {
    show(revealStops);
    stopsList.innerHTML = '';
    if (metersToMiles(meters) > 75) {
      stopsMsg.textContent = "You're a road trip away — avocado stops show once you're closer 🥑";
      show(stopsMsg);
      return;
    }
    stopsMsg.textContent = 'Finding avocado stops… 🥑';
    show(stopsMsg);
    FindStores.findAvocadoStops(currentPos, venue).then(function (stops) {
      stopsList.innerHTML = '';
      if (!stops.length) {
        stopsMsg.textContent = 'No avocado stops mapped on the way — BYO 🥑';
        show(stopsMsg);
        return;
      }
      hide(stopsMsg);
      stops.forEach(function (s) {
        const li = document.createElement('li');
        li.className = 'stops-row';
        const a = document.createElement('a');
        a.href = s.mapsUrl; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = s.name + ' · ' + s.miFromUser.toFixed(1) + ' mi ↗';
        li.appendChild(a);
        stopsList.appendChild(li);
      });
    }).catch(function () {
      stopsList.innerHTML = '';
      stopsMsg.textContent = 'Couldn’t load avocado stops — ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'link-btn';
      retry.textContent = 'retry';
      retry.addEventListener('click', function () { renderStops(meters); });
      stopsMsg.appendChild(retry);
      show(stopsMsg);
    });
  }
```

- [ ] **Step 4: Reset the new sections on "play again"**

In `Guac Off 2026/find/index.js`, change the play-again handler:

```js
  playAgain.addEventListener('click', function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    aim = null; targetVec = null; gotOrientation = false; gotAbsolute = false; lockStart = 0;
    hide(reveal); show(cover);
  });
```

to also hide the extras:

```js
  playAgain.addEventListener('click', function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    aim = null; targetVec = null; gotOrientation = false; gotAbsolute = false; lockStart = 0;
    hide(revealDistance); hide(revealStops); hide(stopsMsg); stopsList.innerHTML = '';
    hide(reveal); show(cover);
  });
```

- [ ] **Step 5: Syntax check + commit**

Run: `node --check "Guac Off 2026/find/index.js"`
Expected: exit 0, no output.

```bash
git add "Guac Off 2026/find/index.js"
git commit -m "find: show distance + avocado stops on the reveal (loading/empty/error/far/no-GPS)"
```

---

## Task 5: Integration verification (headless Chrome, stubbed `fetch`)

No product code — a verification harness proving the reveal renders distance + a sorted store list, and degrades gracefully. (Sensors/network can't be exercised by the Node unit tests.)

- [ ] **Step 1: Serve the site**

Run: `cd "Guac Off 2026" && python3 -m http.server 8097 --bind 127.0.0.1`
Confirm: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8097/find/index.html` → `200`.

- [ ] **Step 2: Launch headless Chrome with remote debugging**

Run (macOS path; adjust if different):
```bash
pkill -f "remote-debugging-port=9222" 2>/dev/null; sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --remote-debugging-port=9222 "about:blank" >/tmp/chrome_stops.log 2>&1 &
sleep 3
```

- [ ] **Step 3: Drive the page with a stubbed fetch + geolocation**

Create `/tmp/stopstest.mjs`:

```js
const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
let id=0; const pend=new Map();
const cmd=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
await new Promise(r=>ws.addEventListener('open',r));
ws.addEventListener('message',e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}});
const ev=async x=>{const o=await cmd('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});return o.result&&o.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const origin='http://127.0.0.1:8097';
await cmd('Page.enable'); await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cmd('Page.navigate',{url:origin+'/find/index.html'}); await sleep(1800);
// venue placeholder = Dolores Park 37.7596,-122.4269. Put the user ~2mi due south.
await ev("Object.defineProperty(navigator.geolocation,'getCurrentPosition',{value:f=>setTimeout(()=>f({coords:{latitude:37.7306,longitude:-122.4269}}),0),configurable:true});true");
// Stub Overpass: two supermarkets between user and venue (+ one far off-corridor that must be dropped).
const SAMPLE = {elements:[
  {type:'node',lat:37.7520,lon:-122.4269,tags:{name:'On-The-Way Market',shop:'supermarket'}},
  {type:'node',lat:37.7440,lon:-122.4269,tags:{name:'Closer Produce',shop:'greengrocer'}},
  {type:'node',lat:37.7500,lon:-122.4900,tags:{name:'Way Off Course',shop:'supermarket'}},
]};
await ev(`window.fetch=async()=>({ok:true,json:async()=>(${JSON.stringify(SAMPLE)})});true`);
// Enter hunt so currentPos is set, then reveal via the escape hatch (no orientation needed).
await ev("document.getElementById('start-btn').click();true"); await sleep(150);
await ev("document.getElementById('prime-btn').click();true"); await sleep(700);
await ev("document.getElementById('escape').click();true"); await sleep(600);
console.log('distance:', JSON.stringify(await ev("document.getElementById('reveal-distance').textContent")));
console.log('stops:', JSON.stringify(await ev("Array.from(document.querySelectorAll('#stops-list .stops-row a')).map(a=>a.textContent)")));
console.log('stops-msg hidden?', await ev("document.getElementById('stops-msg').hidden"));
// Empty case
await ev(`window.fetch=async()=>({ok:true,json:async()=>({elements:[]})});true`);
await ev("document.getElementById('play-again').click();true"); await sleep(150);
await ev("document.getElementById('start-btn').click();true"); await sleep(150);
await ev("document.getElementById('prime-btn').click();true"); await sleep(700);
await ev("document.getElementById('escape').click();true"); await sleep(500);
console.log('empty msg:', JSON.stringify(await ev("document.getElementById('stops-msg').textContent")));
// Error case
await ev(`window.fetch=async()=>{throw new Error('boom')};true`);
await ev("document.getElementById('play-again').click();true"); await sleep(150);
await ev("document.getElementById('start-btn').click();true"); await sleep(150);
await ev("document.getElementById('prime-btn').click();true"); await sleep(700);
await ev("document.getElementById('escape').click();true"); await sleep(500);
console.log('error msg:', JSON.stringify(await ev("document.getElementById('stops-msg').textContent")));
console.log('retry button present?', await ev("!!document.querySelector('#stops-msg button')"));
ws.close(); process.exit(0);
```

Run: `node /tmp/stopstest.mjs`

Expected:
- `distance:` ≈ `"You're 2.0 mi from the party"`
- `stops:` = `["Closer Produce · 1.0 mi ↗","On-The-Way Market · 1.6 mi ↗"]` (sorted you→venue; "Way Off Course" dropped)
- `stops-msg hidden?` `true`
- `empty msg:` `"No avocado stops mapped on the way — BYO 🥑"`
- `error msg:` starts with `"Couldn’t load avocado stops — "`, `retry button present?` `true`

- [ ] **Step 4: Clean up**

Run: `pkill -f "remote-debugging-port=9222"; pkill -f "http.server 8097"`

- [ ] **Step 5: On-device sanity (manual, optional)**

On a phone over HTTPS (real Overpass): set `VENUE_GEO` to a spot a couple miles away, complete the hunt, confirm the reveal shows a sensible mileage and a few real nearby supermarkets with working Maps links.

---

## Self-Review

**Spec coverage:**
- Distance in miles on reveal → Task 1 (`metersToMiles`), Task 3 (markup), Task 4 (`renderExtras`). ✓
- Overpass data source, no key → Task 2 (`stores.js`). ✓
- supermarket + greengrocer → Task 2 (`SHOPS`). ✓
- Corridor along the line, ordered you→venue → Task 1 (`pointToSegment`/`corridorFilter`), Task 2 (`BUFFER_METERS`). ✓
- Reveal card, after unlock → Task 3/4 (rendered in `doReveal`). ✓
- ~1 mi buffer, cap 8 → Task 2 constants. ✓
- States: loading / empty / error+retry / far (>75 mi) / no-GPS → Task 4 (`renderStops`/`renderExtras`). ✓
- Privacy note → Task 2 file header comment. ✓
- Tests: unit (helpers + stores) + integration (stubbed fetch) → Tasks 1, 2, 5. ✓

**Placeholder scan:** No TODO/TBD; all code blocks complete; sample data and expected outputs are concrete.

**Type consistency:** `findAvocadoStops` returns `{name, miFromUser, mapsUrl}` (Task 2) — consumed with those exact names in Task 4. `corridorFilter` returns store objects annotated with `{distM, t}` (Task 1) — `findAvocadoStops` only reads `name/lat/lng` from them, consistent. `metersToMiles`/`bboxAround`/`pointToSegment`/`corridorFilter`/`haversineMeters` are defined in Task 1 / pre-existing and referenced via `window.FindHelpers` in Task 2 and the destructure in Task 4. DOM ids (`reveal-distance`, `reveal-stops`, `stops-list`, `stops-msg`) match between Task 3 (HTML) and Task 4 (JS).

**Out of scope kept out:** no live-hunt distance, no routing API, no convenience stores, no caching.
