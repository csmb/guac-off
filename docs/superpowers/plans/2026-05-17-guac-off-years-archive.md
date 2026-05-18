# Guac Off Through the Years — Archive Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `years/` archive inside the 2026 site — a chronological image gallery linking to static snapshots of every Guac Off year 2012–2026.

**Architecture:** A reusable Node snapshot tool fetches raw Wayback captures (`id_` modifier) and rewrites their assets to local relative paths, producing one self-contained `years/<year>/` folder per year. Local folders supply 2012/2021/2026. A static gallery page indexes them with Chrome-headless thumbnails. Originals at repo root are never modified.

**Tech Stack:** Node 26 (built-in `fetch`), `curl`, Google Chrome headless, vanilla HTML/CSS. No npm dependencies.

**Spec:** `docs/superpowers/specs/2026-05-17-guac-off-years-archive-design.md`

**Working dir for all paths below:** repo root = `/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off`. The site folder has a space: `Guac Off 2026/`. Always quote paths.

---

## File Structure

- Create `Guac Off 2026/years/_tools/snapshot.mjs` — reusable Wayback → self-contained folder tool
- Create `Guac Off 2026/years/_tools/shoot.sh` — Chrome-headless screenshot wrapper
- Create `Guac Off 2026/years/<year>/index.html` + `assets/` — one self-contained snapshot per year (2012–2026)
- Create `Guac Off 2026/years/assets/gallery.css` — gallery styles
- Create `Guac Off 2026/years/assets/thumbs/<year>.png` — gallery thumbnails
- Create `Guac Off 2026/years/index.html` — the gallery page
- Modify `Guac Off 2026/index.html` — add one subtle link near the footer
- Originals at repo root: **read-only, never modified**

Snapshot capture table (from spec — exact CDX timestamps verified during brainstorming):

| Year | Method | Timestamp | Original URL |
|---|---|---|---|
| 2012 | local | — | `missionguacparty2012` Rails ERB |
| 2013 | wayback | `20130911000000` | `http://www.missionguacparty.com/` |
| 2014 | wayback | `20141201000000` | `http://missionguacparty.com/` |
| 2015 | wayback | `20150824000000` | `http://www.guacamole.expert/` |
| 2016 | wayback | `20160116000000` | `http://www.guacamole.expert/` (approx — labeled) |
| 2017 | wayback | `20170912000000` | `http://www.guacamole.expert/` |
| 2018 | wayback | `20181101000000` | `https://www.guacamole.expert/` |
| 2019 | wayback | `20190901000000` | `https://www.guacamole.expert/` |
| 2020 | wayback | `20201001000000` | `https://guacwalk.org/` |
| 2021 | local | — | `missionguacparty2016/public/guac.html` |
| 2022 | wayback | `20220818000000` | `https://www.guacamole.expert/` |
| 2023 | wayback | `20230901000000` | `https://guacamole.expert/` |
| 2024 | wayback | `20240905000000` | `https://guacamole.expert/` |
| 2025 | wayback | `20250801000000` | `https://guacamole.expert/` |
| 2026 | local-live | — | links to current 2026 site (`../index.html`) |

`snapshot.mjs` resolves each timestamp to the *nearest actual capture* via the Wayback availability API, so the table values are targets, not exact-match requirements.

---

### Task 1: Snapshot tool

**Files:**
- Create: `Guac Off 2026/years/_tools/snapshot.mjs`
- Create: `Guac Off 2026/years/_tools/shoot.sh`

- [ ] **Step 1: Create the snapshot tool**

Create `Guac Off 2026/years/_tools/snapshot.mjs`:

```js
// Usage: node snapshot.mjs <targetTimestamp> <originalUrl> <outDir>
// Fetches the nearest raw Wayback capture and writes a self-contained folder:
//   <outDir>/index.html  + <outDir>/assets/<files>
// Asset refs (img/link/script/source + CSS url()/@import, one level) are
// downloaded and rewritten to local relative paths so the page renders offline.
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";

const [, , ts, originalUrl, outDir] = process.argv;
if (!ts || !originalUrl || !outDir) {
  console.error("usage: node snapshot.mjs <timestamp> <originalUrl> <outDir>");
  process.exit(2);
}

const UA = { "User-Agent": "guac-off-archiver/1.0" };

async function nearest(timestamp, url) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${timestamp}`;
  const r = await fetch(api, { headers: UA });
  const j = await r.json();
  const snap = j?.archived_snapshots?.closest;
  if (!snap?.timestamp) throw new Error(`no capture for ${url} near ${timestamp}`);
  return snap.timestamp;
}

const rawUrl = (stamp, u) => `https://web.archive.org/web/${stamp}id_/${u}`;

async function fetchBuf(stamp, u) {
  const r = await fetch(rawUrl(stamp, u), { headers: UA, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
  return Buffer.from(await r.arrayBuffer());
}

function resolveUrl(ref, base) {
  if (ref.startsWith("data:")) return null;
  if (ref.startsWith("//")) return "https:" + ref;
  try { return new URL(ref, base).href; } catch { return null; }
}

function localName(absUrl) {
  const h = createHash("sha1").update(absUrl).digest("hex").slice(0, 12);
  let ext = extname(new URL(absUrl).pathname).split("?")[0] || "";
  if (!ext || ext.length > 6) ext = "";
  return `a_${h}${ext}`;
}

async function run() {
  const stamp = await nearest(ts, originalUrl);
  console.log(`capture ${stamp} for ${originalUrl}`);
  const assetsDir = join(outDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  let html = (await fetchBuf(stamp, originalUrl)).toString("utf8");
  // strip any Wayback toolbar injection if present
  html = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/g, "");

  const refRe = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  const refs = new Set();
  for (const m of html.matchAll(refRe)) {
    const u = m[1].trim();
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(u)) continue;
    if (/\.html?$|\/$|\/[^.\/?#]*$/.test(u) && !/\.(css|js|png|jpe?g|gif|svg|webp|webm|mp4|ico|woff2?)/i.test(u)) continue;
    refs.add(u);
  }

  const map = new Map(); // original ref string -> local path
  for (const ref of refs) {
    const abs = resolveUrl(ref, originalUrl);
    if (!abs) continue;
    try {
      const buf = await fetchBuf(stamp, abs);
      let name = localName(abs);
      if (/\.css(\?|$)/i.test(abs)) {
        // one-level CSS url()/@import rewrite
        let css = buf.toString("utf8");
        const cssRefs = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(x => x[1]);
        for (const cu of cssRefs) {
          if (cu.startsWith("data:")) continue;
          const cabs = resolveUrl(cu, abs);
          if (!cabs) continue;
          try {
            const cbuf = await fetchBuf(stamp, cabs);
            const cname = localName(cabs);
            await writeFile(join(assetsDir, cname), cbuf);
            css = css.split(cu).join(cname);
          } catch (e) { console.warn(`  skip css asset ${cu}: ${e.message}`); }
        }
        await writeFile(join(assetsDir, name), css, "utf8");
      } else {
        await writeFile(join(assetsDir, name), buf);
      }
      map.set(ref, `assets/${name}`);
    } catch (e) {
      console.warn(`  skip ${ref}: ${e.message}`);
    }
  }

  for (const [ref, local] of map) html = html.split(`"${ref}"`).join(`"${local}"`).split(`'${ref}'`).join(`'${local}'`);
  // neutralize remaining forms/links so nothing 404s or posts
  html = html.replace(/<form\b/gi, '<form onsubmit="return false" data-archived="true" ');
  await writeFile(join(outDir, "index.html"), html, "utf8");
  console.log(`wrote ${outDir}/index.html (+${map.size} assets)`);
}
run().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
```

- [ ] **Step 2: Create the screenshot wrapper**

Create `Guac Off 2026/years/_tools/shoot.sh`:

```bash
#!/usr/bin/env bash
# Usage: shoot.sh <abs-path-to-index.html> <abs-path-out.png>
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars --no-sandbox \
  --window-size=1280,900 --default-background-color=FFFFFFFF \
  --screenshot="$2" "file://$1"
test -s "$2"
echo "shot: $2 ($(wc -c <"$2") bytes)"
```

- [ ] **Step 3: Make the wrapper executable**

Run: `chmod +x "Guac Off 2026/years/_tools/shoot.sh"`

- [ ] **Step 4: Smoke-test the tool on one year (2024, the cleanest capture)**

Run:
```bash
cd "Guac Off 2026/years" && node _tools/snapshot.mjs 20240905000000 "https://guacamole.expert/" 2024
```
Expected: prints `capture 2024...` then `wrote 2024/index.html (+N assets)` with N ≥ 1, exit 0.

- [ ] **Step 5: Verify the smoke-test snapshot renders offline**

Run:
```bash
cd "Guac Off 2026/years" && bash _tools/shoot.sh "$PWD/2024/index.html" "$PWD/assets/thumbs/2024.png" && mkdir -p assets/thumbs
```
(Re-run after `mkdir -p assets/thumbs` if first run fails on missing dir.)
Expected: `shot: .../2024.png (>10000 bytes)`. Open `2024/index.html` — guac content visible, no network errors in console.

- [ ] **Step 6: Commit**

```bash
git add "Guac Off 2026/years/_tools" "Guac Off 2026/years/2024" "Guac Off 2026/years/assets/thumbs/2024.png"
git commit -m "Guac years archive: snapshot tooling + 2024 proof"
```

---

### Task 2: Snapshot Wayback years 2013–2019

**Files:**
- Create: `Guac Off 2026/years/{2013,2014,2015,2016,2017,2018,2019}/` (each: `index.html` + `assets/`)

For each step: run the snapshot command, then verify `index.html` exists and is non-empty and contains the word "guac" (case-insensitive). Run all from `cd "Guac Off 2026/years"`.

- [ ] **Step 1: 2013**

```bash
node _tools/snapshot.mjs 20130911000000 "http://www.missionguacparty.com/" 2013
grep -qi guac 2013/index.html && echo OK 2013
```
Expected: `wrote 2013/index.html ...` then `OK 2013`. If `no capture` error, retry with timestamp `20130901000000`.

- [ ] **Step 2: 2014**

```bash
node _tools/snapshot.mjs 20141201000000 "http://missionguacparty.com/" 2014
grep -qi guac 2014/index.html && echo OK 2014
```

- [ ] **Step 3: 2015**

```bash
node _tools/snapshot.mjs 20150824000000 "http://www.guacamole.expert/" 2015
grep -qi guac 2015/index.html && echo OK 2015
```

- [ ] **Step 4: 2016 (approx capture)**

```bash
node _tools/snapshot.mjs 20160116000000 "http://www.guacamole.expert/" 2016
grep -qi guac 2016/index.html && echo OK 2016
```

- [ ] **Step 5: 2017**

```bash
node _tools/snapshot.mjs 20170912000000 "http://www.guacamole.expert/" 2017
grep -qi guac 2017/index.html && echo OK 2017
```

- [ ] **Step 6: 2018**

```bash
node _tools/snapshot.mjs 20181101000000 "https://www.guacamole.expert/" 2018
grep -qi guac 2018/index.html && echo OK 2018
```

- [ ] **Step 7: 2019**

```bash
node _tools/snapshot.mjs 20190901000000 "https://www.guacamole.expert/" 2019
grep -qi guac 2019/index.html && echo OK 2019
```

- [ ] **Step 8: Commit**

```bash
git add "Guac Off 2026/years/2013" "Guac Off 2026/years/2014" "Guac Off 2026/years/2015" "Guac Off 2026/years/2016" "Guac Off 2026/years/2017" "Guac Off 2026/years/2018" "Guac Off 2026/years/2019"
git commit -m "Guac years archive: snapshot 2013-2019"
```

---

### Task 3: Snapshot Wayback years 2020, 2022, 2023, 2025

**Files:**
- Create: `Guac Off 2026/years/{2020,2022,2023,2025}/`

Run all from `cd "Guac Off 2026/years"`. (2024 already done in Task 1; 2021 is local in Task 4.)

- [ ] **Step 1: 2020 (GuacWalk year — different domain)**

```bash
node _tools/snapshot.mjs 20201001000000 "https://guacwalk.org/" 2020
grep -qi guac 2020/index.html && echo OK 2020
```

- [ ] **Step 2: 2022**

```bash
node _tools/snapshot.mjs 20220818000000 "https://www.guacamole.expert/" 2022
grep -qi guac 2022/index.html && echo OK 2022
```

- [ ] **Step 3: 2023**

```bash
node _tools/snapshot.mjs 20230901000000 "https://guacamole.expert/" 2023
grep -qi guac 2023/index.html && echo OK 2023
```

- [ ] **Step 4: 2025**

```bash
node _tools/snapshot.mjs 20250801000000 "https://guacamole.expert/" 2025
grep -qi guac 2025/index.html && echo OK 2025
```

- [ ] **Step 5: Commit**

```bash
git add "Guac Off 2026/years/2020" "Guac Off 2026/years/2022" "Guac Off 2026/years/2023" "Guac Off 2026/years/2025"
git commit -m "Guac years archive: snapshot 2020,2022,2023,2025"
```

---

### Task 4: Local-source years (2012, 2021, 2026)

**Files:**
- Create: `Guac Off 2026/years/2012/index.html`
- Create: `Guac Off 2026/years/2021/index.html` (+ image)
- Create: `Guac Off 2026/years/2026/index.html`

- [ ] **Step 1: 2012 — render the Rails landing to static**

Read `missionguacparty2012/app/views/static_pages/home.html.erb` and `missionguacparty2012/app/views/layouts/application.html.erb`. Create `Guac Off 2026/years/2012/index.html` as a single static HTML page: the layout's `<head>`/`<body>` shell with the home view content inlined, ERB tags (`<%= %>`, `<% %>`) removed, dynamic helpers replaced with literal text. Copy any referenced images from `missionguacparty2012/public/` into `Guac Off 2026/years/2012/assets/` and point at them with relative paths. No forms wired (add `onsubmit="return false"` to any `<form>`).

Run: `grep -qi guac "Guac Off 2026/years/2012/index.html" && echo OK 2012`

- [ ] **Step 2: 2021 — the Geocities gem**

```bash
mkdir -p "Guac Off 2026/years/2021/assets"
cp "missionguacparty2016/public/images/guac.png" "Guac Off 2026/years/2021/assets/guac.png"
sed 's#/images/guac.png#assets/guac.png#g' "missionguacparty2016/public/guac.html" > "Guac Off 2026/years/2021/index.html"
grep -qi guac "Guac Off 2026/years/2021/index.html" && echo OK 2021
```

- [ ] **Step 3: 2026 — redirect to the live current site**

Create `Guac Off 2026/years/2026/index.html`:

```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=../../index.html">
<title>Guac Off 2026</title></head>
<body><p>Redirecting to the current Guac Off 2026 site… <a href="../../index.html">click here</a>.</p></body></html>
```

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/years/2012" "Guac Off 2026/years/2021" "Guac Off 2026/years/2026"
git commit -m "Guac years archive: local-source years 2012, 2021, 2026"
```

---

### Task 5: Thumbnails for every year

**Files:**
- Create: `Guac Off 2026/years/assets/thumbs/<year>.png` for 2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2025,2026 (2024 already shot in Task 1)

- [ ] **Step 1: Shoot all remaining years**

```bash
cd "Guac Off 2026/years"
mkdir -p assets/thumbs
for y in 2012 2013 2014 2015 2016 2017 2018 2019 2020 2021 2022 2023 2025 2026; do
  bash _tools/shoot.sh "$PWD/$y/index.html" "$PWD/assets/thumbs/$y.png" || echo "SHOOT FAILED $y"
done
ls -la assets/thumbs
```
Expected: 15 PNGs (incl. 2024), each > 3000 bytes.

- [ ] **Step 2: Hand-pick fallbacks for weak thumbnails**

Open each thumbnail. For any that is blank/near-white/under ~3 KB (expected candidates: 2012, 2016, possibly 2014), replace it with a representative image from that year's `assets/` folder:

```bash
cd "Guac Off 2026/years"
# example pattern — pick the largest image asset for the weak year:
ls -S 2012/assets 2>/dev/null | head
cp "2012/assets/<chosen-image>" assets/thumbs/2012.png   # repeat per weak year
```
Each `assets/thumbs/<year>.png` must end up a non-blank image that visually represents the year.

- [ ] **Step 3: Commit**

```bash
git add "Guac Off 2026/years/assets/thumbs"
git commit -m "Guac years archive: per-year gallery thumbnails"
```

---

### Task 6: Gallery page

**Files:**
- Create: `Guac Off 2026/years/assets/gallery.css`
- Create: `Guac Off 2026/years/index.html`

- [ ] **Step 1: Gallery styles**

Create `Guac Off 2026/years/assets/gallery.css`:

```css
:root { --bg:#0d0d0d; --card:#1a1a1a; --accent:#7cb342; --text:#f4f4f0; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; padding:24px 16px 64px; }
header { text-align:center; margin:8px 0 28px; }
header h1 { font-size:clamp(1.6rem,6vw,2.6rem); letter-spacing:.04em; }
header p { opacity:.7; margin-top:6px; font-size:.95rem; }
.back { display:inline-block; margin-bottom:18px; color:var(--accent); text-decoration:none; font-size:.9rem; }
.grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); max-width:1100px; margin:0 auto; }
.card { background:var(--card); border-radius:12px; overflow:hidden; text-decoration:none; color:inherit; border:1px solid #2a2a2a; transition:transform .15s,border-color .15s; }
.card:hover { transform:translateY(-3px); border-color:var(--accent); }
.card img { width:100%; aspect-ratio:16/10; object-fit:cover; background:#222; display:block; }
.card .meta { padding:12px 14px 16px; }
.card .yr { font-size:1.35rem; font-weight:700; color:var(--accent); }
.card .name { font-size:.95rem; margin:2px 0 6px; }
.card .desc { font-size:.8rem; opacity:.65; line-height:1.4; }
.card .note { font-size:.7rem; opacity:.5; margin-top:6px; font-style:italic; }
@media (max-width:420px){ .grid{ grid-template-columns:1fr; } }
```

- [ ] **Step 2: Gallery page**

Create `Guac Off 2026/years/index.html`. One `<a class="card">` per year, **newest first**, using this exact card template (fill `desc` from the README table; mark 2016 with a `<p class="note">` "≈ closest archived capture"; mark 2012 note "earliest event — recreated from source"):

```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guac Off Through the Years</title>
<link rel="stylesheet" href="assets/gallery.css"></head>
<body>
<a class="back" href="../index.html">↩ back to Guac Off 2026</a>
<header><h1>Guac Off Through the Years</h1><p>15 years of guacamole · 2012–2026</p></header>
<main class="grid">
  <a class="card" href="2026/index.html"><img src="assets/thumbs/2026.png" alt="Guac Off 2026"><div class="meta"><div class="yr">2026</div><div class="name">SF Guac Off — Guac-y Road</div><div class="desc">The current site: a playable arcade game.</div></div></a>
  <a class="card" href="2025/index.html"><img src="assets/thumbs/2025.png" alt="Guac Off 2025"><div class="meta"><div class="yr">2025</div><div class="name">SF Guac Off 2025</div><div class="desc">Event landing page.</div></div></a>
  <a class="card" href="2024/index.html"><img src="assets/thumbs/2024.png" alt="Guac Off 2024"><div class="meta"><div class="yr">2024</div><div class="name">SF Guac Off 2024</div><div class="desc">Archived from guacamole.expert.</div></div></a>
  <a class="card" href="2023/index.html"><img src="assets/thumbs/2023.png" alt="Guac Off 2023"><div class="meta"><div class="yr">2023</div><div class="name">SF Guac Off 2023</div><div class="desc">Archived from guacamole.expert.</div></div></a>
  <a class="card" href="2022/index.html"><img src="assets/thumbs/2022.png" alt="Guac Off 2022"><div class="meta"><div class="yr">2022</div><div class="name">SF Guac Off 2022</div><div class="desc">Archived from guacamole.expert.</div></div></a>
  <a class="card" href="2021/index.html"><img src="assets/thumbs/2021.png" alt="Guac Off 2021"><div class="meta"><div class="yr">2021</div><div class="name">Guac Off 2021</div><div class="desc">The Geocities-style throwback page.</div></div></a>
  <a class="card" href="2020/index.html"><img src="assets/thumbs/2020.png" alt="GuacWalk 2020"><div class="meta"><div class="yr">2020</div><div class="name">GuacWalk</div><div class="desc">The COVID year — an outdoor guac adventure.</div></div></a>
  <a class="card" href="2019/index.html"><img src="assets/thumbs/2019.png" alt="Guac Off 2019"><div class="meta"><div class="yr">2019</div><div class="name">SF Guac Off 2019</div><div class="desc">Archived from guacamole.expert.</div></div></a>
  <a class="card" href="2018/index.html"><img src="assets/thumbs/2018.png" alt="Guac Off 2018"><div class="meta"><div class="yr">2018</div><div class="name">SF Guac Off 2018</div><div class="desc">Archived from guacamole.expert.</div></div></a>
  <a class="card" href="2017/index.html"><img src="assets/thumbs/2017.png" alt="Guac Off 2017"><div class="meta"><div class="yr">2017</div><div class="name">SF Guac Off 2017</div><div class="desc">Archived from guacamole.expert. The year votes were tallied by hand.</div></div></a>
  <a class="card" href="2016/index.html"><img src="assets/thumbs/2016.png" alt="Guac Off 2016"><div class="meta"><div class="yr">2016</div><div class="name">Mission Guac Party 2016</div><div class="desc">Archived from guacamole.expert.</div><p class="note">≈ closest archived capture</p></div></a>
  <a class="card" href="2015/index.html"><img src="assets/thumbs/2015.png" alt="Guac Off 2015"><div class="meta"><div class="yr">2015</div><div class="name">Mission Guac Party 2015</div><div class="desc">Archived from guacamole.expert.</div></div></a>
  <a class="card" href="2014/index.html"><img src="assets/thumbs/2014.png" alt="Guac Off 2014"><div class="meta"><div class="yr">2014</div><div class="name">Mission Guac Party 2014</div><div class="desc">Archived from missionguacparty.com.</div></div></a>
  <a class="card" href="2013/index.html"><img src="assets/thumbs/2013.png" alt="Guac Off 2013"><div class="meta"><div class="yr">2013</div><div class="name">Mission Guac Party 2013</div><div class="desc">Archived from missionguacparty.com.</div></div></a>
  <a class="card" href="2012/index.html"><img src="assets/thumbs/2012.png" alt="Guac Off 2012"><div class="meta"><div class="yr">2012</div><div class="name">Mission Guac Party 2012</div><div class="desc">The first one.</div><p class="note">recreated from source — no web archive exists</p></div></a>
</main>
</body></html>
```

- [ ] **Step 3: Verify gallery renders + all links resolve**

```bash
cd "Guac Off 2026/years"
for y in 2012 2013 2014 2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025 2026; do test -f "$y/index.html" && test -f "assets/thumbs/$y.png" || echo "MISSING $y"; done
echo "all present"
```
Then open `http://guacoff.localhost:8086/years/` (server already running). Expected: 15 cards, images load, grid is single-column at 375px width.

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/years/index.html" "Guac Off 2026/years/assets/gallery.css"
git commit -m "Guac years archive: gallery page"
```

---

### Task 7: 2017 vote-tally artifact link

**Files:**
- Create: `Guac Off 2026/years/2017/voting.html`
- Modify: `Guac Off 2026/years/index.html` (the 2017 card desc already mentions hand-tallying — add a small link)

- [ ] **Step 1: Build the artifact page**

Read `guac-voting-2017/guac_voting.rb`. Run it to capture real output: `ruby guac-voting-2017/guac_voting.rb` (Ruby is system-available on macOS; if it errors, transcribe the computed results by hand from the script's logic). Create `Guac Off 2026/years/2017/voting.html` — a small styled page (reuse `../assets/gallery.css`) with a heading "How 2017 Was Judged", a `<pre>` of the script source, and a `<pre>` of its category results, plus a `↩ back` link to `index.html` (the 2017 snapshot).

- [ ] **Step 2: Link it from the 2017 card**

In `Guac Off 2026/years/index.html`, inside the 2017 card's `<div class="meta">`, add before `</div>`:

```html
<p class="note"><a href="2017/voting.html" style="color:var(--accent)">how 2017 was judged →</a></p>
```

- [ ] **Step 3: Verify**

Open `http://guacoff.localhost:8086/years/2017/voting.html` — source + results visible, back link works.

- [ ] **Step 4: Commit**

```bash
git add "Guac Off 2026/years/2017/voting.html" "Guac Off 2026/years/index.html"
git commit -m "Guac years archive: 2017 vote-tally artifact"
```

---

### Task 8: Home-page integration link

**Files:**
- Modify: `Guac Off 2026/index.html`

- [ ] **Step 1: Add the subtle link near the footer**

In `Guac Off 2026/index.html`, locate `<footer id="info-footer">No double dipping · Since 2012</footer>`. Immediately after the footer element, inside the `#info` section, add:

```html
      <p style="text-align:center;margin-top:18px"><a href="years/index.html" style="color:#7cb342;text-decoration:none;font-size:.9rem">↩ guac off through the years</a></p>
```

- [ ] **Step 2: Verify it does not disrupt the game/info flow**

Open `http://guacoff.localhost:8086/` — scroll to the info section; the game hero and info layout are unchanged; the new link appears under the footer and navigates to the gallery.

- [ ] **Step 3: Commit**

```bash
git add "Guac Off 2026/index.html"
git commit -m "Guac Off 2026: link to years archive from home page"
```

---

### Task 9: Final QA

**Files:** none (verification only)

- [ ] **Step 1: Originals untouched**

```bash
cd "/Users/christopherbunting/Library/Mobile Documents/com~apple~CloudDocs/code/guac-off"
git status --porcelain | grep -vE '^\?\?|Guac Off 2026/(years/|index.html)|docs/superpowers' || echo "CLEAN: no original folders modified"
```
Expected: `CLEAN: no original folders modified`.

- [ ] **Step 2: Every snapshot renders offline**

For each year folder, open `http://guacoff.localhost:8086/years/<year>/` and confirm: content visible, no console fetch errors to `web.archive.org` or external domains (assets are local). Note any year that still hits the network and re-run its snapshot (Task 2/3) — the rewrite missed an asset class.

- [ ] **Step 3: Mobile + desktop**

In browser devtools, load `http://guacoff.localhost:8086/years/` at 375px and at 1280px. Expected: single-column grid on mobile, multi-column on desktop, no overflow, thumbnails legible.

- [ ] **Step 4: Update README**

Add a line to repo `README.md` under Projects noting the `Guac Off 2026/years/` archive gallery covers 2012–2026. Commit:

```bash
git add README.md && git commit -m "README: note the years archive gallery"
```

---

## Self-Review Notes

- **Spec coverage:** structure (Task 6), per-year sourcing incl. exact timestamps (Tasks 1–4), per-year image with hand-pick fallback (Task 5), gallery look + mobile (Tasks 6, 9), integration link (Task 8), 2017 artifact (Task 7), originals-untouched verification (Task 9). All spec sections mapped.
- **Screenshot risk** resolved: Chrome headless (verified present), no installs.
- **No placeholders:** the only "read and adapt" steps (2012 ERB render, 2017 artifact) involve content transcription that cannot be pre-written without the source files; the procedure and output contract for each is fully specified.
- **Type/name consistency:** `snapshot.mjs` arg order `(timestamp, url, outDir)` used identically in every invocation; `shoot.sh` arg order `(htmlPath, outPng)` consistent; thumbnail path `assets/thumbs/<year>.png` consistent across Tasks 1, 5, 6.
