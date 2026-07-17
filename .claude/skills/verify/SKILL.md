---
name: verify
description: Verify Guac Off site changes by driving the real pages in headless Chrome (local server + CDP)
---

# Verify: Guac Off site

Static site, no build. Serve the active site, then drive the page in headless Chrome over CDP — the seam/tilt/viewport behaviors only show up under mid-session resizes, which screenshot-only flags can't do.

## Serve

```bash
cd "Guac Off 2026" && python3 -m http.server 8086 --bind 127.0.0.1
# pages at http://guacoff.localhost:8086/  (root = waterfall homepage; game at /game.html)
```

## Drive (headless Chrome + CDP)

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9222 --user-data-dir=<scratch>/chrome-profile \
  --no-first-run --disable-gpu about:blank
```

- Node ≥22 has a global `WebSocket`; connect to `webSocketDebuggerUrl` from `http://127.0.0.1:9222/json/list` and send `{id, method, params}` JSON.
- `Emulation.setDeviceMetricsOverride` resizes mid-session. Mobile 390×664⇄736 simulates the iOS URL bar; a height-only change at constant width is the seam-lock hazard case; 1200×900→1200×420 is the desktop height-crush case.
- `Emulation.setDeviceOrientationOverride` was REMOVED from CDP — dispatch real events instead: `Runtime.evaluate` with `window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {alpha, beta, gamma}))`.
- `Emulation.setTouchEmulationEnabled {enabled:true}` makes `(pointer: coarse)` match, so the tilt pill renders; `document.getElementById('tilt-enable').click()` enables tilt (Chrome has no motion-permission prompt).
- Evidence: `Page.captureScreenshot`, plus the computed `clip-path` of `.wf-doc` — the clip polygon covering the whole details box ⇔ waterline resting at the seam; a slanted first vertex ⇔ sloshed surface.
- `#tilt=beta,gamma[,surge]` debug hash forces tilt without sensors; `Emulation.setPageScaleFactor` exercises the pinch-zoom guard (body height must not change while scale > 1).

## Gotchas

- rAF runs in real time headless — wait ~6s for the 5s flood before asserting reveal state.
- The node suites (`node "Guac Off 2026/waterfall/"*.test.js`) are CI, not verification — drive the page.
- bfcache restores can't be driven headless; the `pagehide` `e.persisted` branches need a real-device check.
