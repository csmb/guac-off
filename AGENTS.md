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
| `Guac Off 2026/` | 2026 | Static HTML/CSS/JS | `index.html`, `index.css`, `index.js` |
| `guac_game_v2/` | 2026 | Python + Pygame | `main.py`, `requirements.txt` |

## Active / Most Recent Projects

- **`Guac Off 2026/`** — Current year's event site (static HTML/CSS/JS, no build step). The landing page is the "Guac-y Road" canvas game (`game/`, ES modules). Linked from the home-page footer are several **vanilla Canvas interaction pages**, each its own folder (`index.html`/`index.css`/`index.js` + usually `helpers.js`/`helpers.test.js` + `assets/`):
  - `tilt/` — tilt the phone to roll ingredients into a bowl (Matter.js)
  - `find/` — point the phone at the party (compass + geolocation)
  - `fountain/` — tilt to pour water from the fountain, with an accumulating pool
  - `waterfall/` — ambient photoreal water over the fountain photo (desktop-first; lighter "mobile-lite" path on touch devices)
  - `years/` — the multi-year archive gallery

  Convention for these: pure logic lives in `helpers.js` as a **dual-mode (browser + Node) module**, unit-tested via `node "Guac Off 2026/<page>/helpers.test.js"`; the DOM/engine + `requestAnimationFrame` loop live in `index.js`. Device-orientation pages (`tilt`/`find`/`fountain`) reuse an iOS motion-permission flow — the click handler's **first `await` must be `DeviceOrientationEvent.requestPermission()`** (don't await anything before it, or the native prompt silently fails). Spec/plan docs for recent pages live in `docs/superpowers/{specs,plans}/`.
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
