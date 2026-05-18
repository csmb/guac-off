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
  // The wayback/available API is rate-limited (429) in some environments;
  // resolve the closest capture via the CDX server instead.
  const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&closest=${timestamp}&limit=8&filter=statuscode:200&fl=timestamp&output=json`;
  for (let attempt = 0; attempt < 5; attempt++) {
    let r;
    try { r = await fetch(api, { headers: UA }); }
    catch (e) { await new Promise(s => setTimeout(s, 2000 * (attempt + 1))); continue; }
    if (r.status === 200) {
      const rows = await r.json();
      const data = Array.isArray(rows) ? rows.slice(1) : []; // row 0 is the header
      if (data.length && data[0][0]) return data[0][0];
      throw new Error(`no capture for ${url} near ${timestamp}`);
    }
    if (r.status === 429 || r.status === 503) { await new Promise(s => setTimeout(s, 2500 * (attempt + 1))); continue; }
    throw new Error(`CDX HTTP ${r.status} for ${url}`);
  }
  throw new Error(`CDX unavailable for ${url} after retries`);
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
