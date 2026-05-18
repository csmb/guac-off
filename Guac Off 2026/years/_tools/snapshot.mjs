// Usage: node snapshot.mjs <targetTimestamp> <originalUrl> <outDir>
// Fetches the nearest raw Wayback capture and writes a self-contained, OFFLINE
// folder: <outDir>/index.html + <outDir>/assets/<files>. All asset refs
// (src/href/poster/srcset, inline+block CSS url() and @import, recursively
// through CSS) are localized; refs that cannot be fetched are pointed at a
// dead local file so the page never makes a live network call.
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";

const [, , ts, originalUrl, outDir] = process.argv;
if (!ts || !originalUrl || !outDir) {
  console.error("usage: node snapshot.mjs <timestamp> <originalUrl> <outDir>");
  process.exit(2);
}

const UA = { "User-Agent": "guac-off-archiver/1.0" };

async function cdxQuery(url, extra) {
  const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&filter=statuscode:200&fl=timestamp&output=json&collapse=timestamp:8&limit=4000${extra}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    let r;
    try { r = await fetch(api, { headers: UA }); }
    catch { await new Promise(s => setTimeout(s, 2000 * (attempt + 1))); continue; }
    if (r.status === 200) {
      const rows = await r.json();
      return (Array.isArray(rows) ? rows.slice(1) : []).map(x => x[0]).filter(Boolean);
    }
    if (r.status === 429 || r.status === 503 || r.status === 504) {
      await new Promise(s => setTimeout(s, 2500 * (attempt + 1))); continue;
    }
    throw new Error(`CDX HTTP ${r.status} for ${url}`);
  }
  throw new Error(`CDX unavailable for ${url}`);
}

function pickClosest(stamps, target) {
  const t = BigInt(target.padEnd(14, "0"));
  let best = null, bestD = null;
  for (const s of stamps) {
    const v = BigInt(s.padEnd(14, "0"));
    const d = v > t ? v - t : t - v;
    if (bestD === null || d < bestD) { bestD = d; best = s; }
  }
  return best;
}

async function nearest(timestamp, url) {
  const y = parseInt(timestamp.slice(0, 4), 10);
  let stamps = await cdxQuery(url, `&from=${y - 1}0101000000&to=${y + 1}1231235959`);
  if (!stamps.length) stamps = await cdxQuery(url, "");
  const best = pickClosest(stamps, timestamp);
  if (!best) throw new Error(`no capture for ${url} near ${timestamp}`);
  return best;
}

const rawUrl = (stamp, u) => `https://web.archive.org/web/${stamp}id_/${u}`;

let STAMP;
const assetsDir = join(outDir, "assets");
const downloaded = new Map(); // absUrl -> local filename | "_missing"
const failures = [];

async function fetchRes(u) {
  const r = await fetch(rawUrl(STAMP, u), { headers: UA, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, contentType: r.headers.get("content-type") || "" };
}

function resolveUrl(ref, base) {
  if (!ref || /^(data:|#|mailto:|tel:|javascript:)/i.test(ref)) return null;
  if (ref.startsWith("//")) ref = "https:" + ref;
  try { return new URL(ref, base).href; } catch { return null; }
}

function localName(absUrl, isCss) {
  const h = createHash("sha1").update(absUrl).digest("hex").slice(0, 12);
  let ext = extname(new URL(absUrl).pathname).split("?")[0] || "";
  if (!ext || ext.length > 6) ext = "";
  if (isCss && !/\.css$/i.test(ext)) ext = ".css";
  return `a_${h}${ext}`;
}

// Download absUrl into assets/. If it is CSS (by extension OR content-type),
// recursively localize its url()/@import refs (siblings -> bare filename).
async function fetchAsset(absUrl, depth) {
  if (downloaded.has(absUrl)) return downloaded.get(absUrl);
  downloaded.set(absUrl, "_missing"); // reserve to break ref cycles
  let res;
  try { res = await fetchRes(absUrl); }
  catch (e) {
    console.warn(`  skip ${absUrl}: ${e.message}`);
    failures.push(absUrl);
    return "_missing";
  }
  const isCss = /\.css(\?|$)/i.test(absUrl) || /text\/css/i.test(res.contentType);
  const name = localName(absUrl, isCss);
  if (isCss && depth < 4) {
    const css = await rewriteCss(res.buf.toString("utf8"), absUrl, depth + 1, "");
    await writeFile(join(assetsDir, name), css, "utf8");
  } else {
    await writeFile(join(assetsDir, name), res.buf);
  }
  downloaded.set(absUrl, name);
  return name;
}

// Rewrite url(...) and @import refs in a CSS string. prefix is "" when the CSS
// lives in assets/ (sibling refs), "assets/" when inlined in the HTML.
async function rewriteCss(css, baseUrl, depth, prefix) {
  const refs = new Set();
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.add(m[1].trim());
  for (const m of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?/gi)) refs.add(m[1].trim());
  for (const ref of refs) {
    const abs = resolveUrl(ref, baseUrl);
    if (!abs) continue;
    const local = await fetchAsset(abs, depth);
    css = css.split(ref).join(prefix + local);
  }
  return css;
}

async function run() {
  STAMP = await nearest(ts, originalUrl);
  console.log(`capture ${STAMP} for ${originalUrl}`);
  await mkdir(assetsDir, { recursive: true });

  let html = (await fetchRes(originalUrl)).buf.toString("utf8");
  html = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/g, "");

  // 1. <style>...</style> blocks
  const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const m of styleBlocks) {
    const rewritten = await rewriteCss(m[1], originalUrl, 1, "assets/");
    html = html.replace(m[1], rewritten);
  }

  // 2. inline style="...url()..." attributes
  const inlineStyles = [...html.matchAll(/style\s*=\s*"([^"]*url\([^"]*)"/gi)];
  for (const m of inlineStyles) {
    const rewritten = await rewriteCss(m[1], originalUrl, 1, "assets/");
    html = html.replace(m[1], rewritten);
  }

  // 3. srcset attributes
  for (const m of [...html.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)]) {
    const parts = m[1].split(",").map(p => p.trim());
    const rebuilt = [];
    for (const part of parts) {
      const [u, ...desc] = part.split(/\s+/);
      const abs = resolveUrl(u, originalUrl);
      if (!abs) { rebuilt.push(part); continue; }
      const local = await fetchAsset(abs, 0);
      rebuilt.push([`assets/${local}`, ...desc].join(" "));
    }
    html = html.replace(m[1], rebuilt.join(", "));
  }

  // 4. src / href / poster attributes
  const attrRe = /(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi;
  const map = new Map();
  for (const m of html.matchAll(attrRe)) {
    const u = m[1].trim();
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(u)) continue;
    if (/\.html?(\?|#|$)/i.test(u)) continue;
    if (/\/$/.test(u)) continue;
    if (!/\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|webm|mp4|ogg|ico|cur|woff2?|ttf|otf|eot)(\?|#|$)/i.test(u)
        && !/\/css\?|fonts\.googleapis|fonts\.gstatic/i.test(u)) continue;
    if (map.has(u)) continue;
    const abs = resolveUrl(u, originalUrl);
    if (!abs) continue;
    const local = await fetchAsset(abs, 0);
    map.set(u, `assets/${local}`);
  }
  // longest refs first to avoid substring collisions
  for (const [ref, local] of [...map].sort((a, b) => b[0].length - a[0].length)) {
    html = html.split(`"${ref}"`).join(`"${local}"`).split(`'${ref}'`).join(`'${local}'`);
  }

  // 5. neutralize forms
  html = html.replace(/<form\b/gi, '<form onsubmit="return false" data-archived="true" ');

  // dead local target so unresolved refs never hit the network
  await writeFile(join(assetsDir, "_missing"), "");
  await writeFile(join(outDir, "index.html"), html, "utf8");
  if (failures.length) {
    await writeFile(join(outDir, "_MISSING.txt"), failures.join("\n") + "\n", "utf8");
    console.warn(`WARN: ${failures.length} assets unresolved (see ${outDir}/_MISSING.txt)`);
  }
  console.log(`wrote ${outDir}/index.html (+${downloaded.size} assets, ${failures.length} missing)`);
}
run().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
