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

- **`Guac Off 2026/`** — Current year's event site. Static HTML/CSS/JS, no build step.
- **`guac_game_v2/`** — Python/Pygame point-and-click adventure game (metal theme). Run with `python main.py` after `pip install -r requirements.txt`.
- **`guac-game/`** — Browser-based React game. Dev: `cd guac-game && npm run dev`. Build: `npm run build`.

## Development

### Static sites (no build step)
Serve locally with: `python3 -m http.server 8080`

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
