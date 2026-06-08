# AGENTS.md

Navigation guide for AI agents working in this repository.

## Repository Overview

An archive of websites and tools from the annual **Guac Off** guacamole competition in San Francisco, running since 2012. Each subdirectory is an independent project — there is no monorepo build system.

## Project Map

| Folder | Year | Tech | Key Files |
|--------|------|------|-----------|
| `missionguacparty2012/` | 2012 | Ruby on Rails | `app/`, `config/`, `db/` |
| `Guac2013/` | 2013 | Sinatra | `party_on.rb`, `Gemfile` |
| `guac/` | 2013 | Ruby on Rails | `app/`, `config/`, `db/` |
| `missionguacparty2014/` | 2014 | Sinatra | `config.ru`, `email.rb`, `Gemfile` |
| `missionguacparty2016/` | 2016 | Rack | `config.ru`, `public/` |
| `guac-voting-2017/` | 2017 | Ruby script | `guac_voting.rb` |
| `guacwalk/` | 2020 | Static HTML | `index.html`, `stylesheet.css` |
| `guac_off_2023/` | 2023 | Static HTML/CSS/JS | `index.html`, `script.js`, `style.css` |
| `guac-game/` | 2025 | React + TypeScript + Vite | `src/`, `package.json` |
| `guac2025/` | 2025 | Static HTML | `index.html` |
| `Guac Off 2026/` | 2026 | Static HTML/CSS/JS | `index.html` (→ waterfall homepage), `waterfall/`, `game.html` |
| `guac_game_v2/` | 2026 | Python + Pygame | `main.py`, `requirements.txt` |

## Active / Most Recent Projects

- **`Guac Off 2026/`** — Current year's event site (static HTML/CSS/JS, no build step). **The landing page (`index.html`) is now the waterfall experience** — it loads `waterfall/` via `waterfall/`-prefixed paths, so `/` and `/waterfall/` render the same thing. The old "Guac-y Road" canvas game is preserved (unlinked) at **`game.html`** (`game/` ES modules + the root `index.js`/`index.css`, which are otherwise orphaned). The homepage intentionally has **no nav links** to the other pages. Each interaction page is its own folder (`index.html`/`index.css`/`index.js` + per-page logic modules + `*.test.js` + `assets/`):
  - `waterfall/` — **the headliner / homepage.** Live Canvas fountain streams on top; party details below auto-flood into view, then a **"tap me to tilt"** button wakes a tilt-slosh canvas pool (gentle, soft-saturated `tanh`; streams lean aggressively via the engine's `wind`; water crashes up over the fountain on a fast slosh and settles to the seam; a tappable bobbing "scroll down" button reveals more). Pure math is unit-tested across `helpers.js`/`flood.js`/`pool.js` (`node "Guac Off 2026/waterfall/<m>.test.js"`); the controller + DOM glue are in `index.js`. Spout layout is `spouts.js`. Debug/demo URL hash: `#tilt=beta,gamma[,surge]`.
  - `tilt/` — tilt the phone to roll ingredients into a bowl (Matter.js)
  - `find/` — point the phone at the party (compass + geolocation)
  - `fountain/` — tilt to pour water from the fountain, with an accumulating pool
  - `years/` — the multi-year archive gallery

  Convention for these: pure logic lives in `helpers.js` as a **dual-mode (browser + Node) module**, unit-tested via `node "Guac Off 2026/<page>/helpers.test.js"`; the DOM/engine + `requestAnimationFrame` loop live in `index.js`. Device-orientation pages (`waterfall`/`tilt`/`find`/`fountain`) reuse an iOS motion-permission flow — call `DeviceOrientationEvent.requestPermission()` **from a `click`/tap handler (NOT `pointerdown`/`touchstart` — iOS silently ignores those and the prompt never appears), and make it the first `await`** (don't await anything before it). Spec/plan docs for recent pages live in `docs/superpowers/{specs,plans}/`.
- **`guac_game_v2/`** — Python/Pygame point-and-click adventure game (metal theme). Run with `python main.py` after `pip install -r requirements.txt`.
- **`guac-game/`** — Browser-based React game. Dev: `cd guac-game && npm run dev`. Build: `npm run build`.

## Development

### Static sites (no build step)
Serve from the site dir, bound to all interfaces (so `*.localhost` + phone/LAN access work):
`cd "Guac Off 2026" && python3 -m http.server 8089 --bind 0.0.0.0`
Open **`http://guac.localhost:8089/`** — use the per-project `*.localhost` origin, **not bare `localhost`**, so service workers/cookies/localStorage don't collide with sibling projects. Per page, e.g. `guac.localhost:8089/waterfall/`.

**iOS sensors:** pages using device orientation/motion or geolocation need a **secure context (HTTPS)** on a real iPhone — use a tunnel (e.g. `cloudflared tunnel --url http://localhost:8089`) or the deployed site; a plain `http://<lan-ip>` won't fire the permission prompt.

### React app (`guac-game/`)
```
cd guac-game
npm install
npm run dev      # dev server
npm run build    # production build
```

### Python game (`guac_game_v2/`)
```
cd guac_game_v2
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Ruby/Rails/Sinatra projects (2012–2016)
```
bundle install
ruby config.ru   # or rails server
```

## Notes

- Each project is fully self-contained. Changes to one do not affect others.
- The `guac-game/node_modules/` directory is large — avoid broad searches that include it. Use targeted paths instead.
- Mobile responsiveness is required for any web UI work.
- This repo lives in **iCloud** — watch for `"<name> 2.ext"` conflicted-copy duplicates; sweep (`find . -name "* 2.*"`) before committing.
- Keep the repo lean: don't commit large duplicate/reference assets (e.g. design-handoff bundles) — git-ignore them and keep them local.
