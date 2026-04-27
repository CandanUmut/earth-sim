# Terra Bellum

A real-time-with-pause world conquest game in the browser. You pick a country
in 1900 and try to bring 60 % of the world's population under your colors —
through war, alliances, gifts, and tech. Other countries don't wait for you;
each one runs on its own personality and acts whether you intervene or not.

Visual target: **wartime cartography**. Cream paper, ink-line borders, hand-
drawn troop arrows, serifed display type. Closer to a strategy boardgame
than to a Civ clone.

**Live demo:** <https://candanumut.github.io/earth-sim/>

## How to play

- **Pick a country** at the start screen, then **Begin Campaign**.
- **Time** advances one in-game month per second at 1×. Use the bottom bar to
  pause (or hit Space) and to switch between 1× / 2× / 3×.
- **Inspect** any country by clicking it. The right-side card shows owner,
  troops, terrain, and stance toward you.
- **Mobilize** from the inspector: *Send Troops* dispatches along the
  shortest land route. The arrow stays visible while the column marches and
  leaves a fading trail when it lands.
- **Conquer gradually**: each won battle drains the target's control bar.
  When it hits zero, the territory flips to your color.
- **Diplomacy**: Declare War, Propose Peace, Propose Alliance, or Send Gifts.
  The AI accepts or rejects based on personality and relative strength.

## Stack

- Vite 5 + React 18 + TypeScript 5
- D3 v7 for projection (`geoMercator`) and rendering
- Zustand for game state
- Tailwind CSS + raw CSS variables for theme
- Framer Motion for panel transitions
- Vitest for game-logic tests
- Geo data: [Natural Earth 110m admin 0 countries](https://www.naturalearthdata.com/)
  (public domain) via the [naturalearth-vector](https://github.com/nvkelso/natural-earth-vector)
  GeoJSON mirror.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173/earth-sim/
npm test             # run game-logic tests
npm run build        # production build into dist/
```

## Deploying

The repo deploys to GitHub Pages via `.github/workflows/deploy.yml` on every
push to `main`. Tests run before the build; a failing test blocks the deploy.

To enable the first deploy:
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. The workflow builds and publishes to GitHub Pages.

The site is served at `/earth-sim/` (configured via `vite.config.ts` `base`).

## Credits

- World geometry: [Natural Earth](https://www.naturalearthdata.com/) — public domain.
- Fonts: Crimson Pro and JetBrains Mono — both [SIL Open Font License](https://scripts.sil.org/OFL).
- Built collaboratively with Claude Code.

## License

Apache 2.0 — see [LICENSE](./LICENSE).
