# Terra Bellum — Build Plan for Claude Code

A real-time-with-pause world conquest game. Flat Mercator map, real country borders, AI rivals, diplomacy, drawable troop arrows. Ships to GitHub Pages.

---

## 0. Project Context (READ FIRST, EVERY SESSION)

### What we're building
A browser-based geopolitical simulation game where the player picks a country and tries to conquer 60% of world population through war, alliances, and economy. Other countries run on AI personalities and act independently of the player — the world keeps turning whether or not the player is doing anything. The player can pause, speed up, or play at normal speed.

### Vibe target
"Wartime cartography." Cream paper background, ink-line borders, faded continents, hand-drawn arrows, serifed display type. Closer to a strategy boardgame on a campaign desk than to HoI4 or Risk. Intentional and restrained. NOT photorealistic, NOT cartoony, NOT a Civ clone.

### Stack (pinned — do not deviate without asking)
- **Vite 5.x** + **React 18** + **TypeScript 5.x**
- **D3 v7** for map projection and rendering (geoMercator + geoPath)
- **Zustand** for game state (single store, no Redux, no Context juggling)
- **Tailwind CSS** for layout/utility, raw CSS variables for theme tokens
- **Framer Motion** for UI panel transitions only (NOT for the map — D3 handles map animation)
- **lucide-react** for icons
- Geo data: **Natural Earth 110m admin 0 countries** as GeoJSON (public domain)
- Deploy: **GitHub Pages** via the `gh-pages` branch using `gh-pages` npm package. Add Actions in Phase 5, not before.

### Non-goals (do not build these without explicit ask)
- Multiplayer / networking
- Backend, accounts, persistence beyond localStorage
- 3D globe, scrollable maps beyond pan/zoom
- Realistic geopolitics, modeled economies, named historical figures
- Mobile-first responsive (desktop-first; mobile is "works but not optimized")
- Sound (defer to Phase 5+)

### Conventions
- File naming: `PascalCase.tsx` for components, `camelCase.ts` for logic modules
- Game logic lives in `src/game/` and is pure TypeScript — no React imports
- Rendering lives in `src/components/` — no game logic, only display
- Zustand store in `src/store/gameStore.ts` is the only mutable state
- Every game-logic function has a unit test in Phase 4. Don't write tests in Phase 1–3, but write functions in a way that makes them testable (pure, dependencies injected).
- Commit per phase milestone. Use conventional commits (`feat:`, `fix:`, `chore:`).

### Performance constraints
- Map rendering: ~180 country polygons. Render once as SVG, then update only `fill` and `stroke` attributes per tick — DO NOT re-render the path data.
- Game tick: 1 real second = 1 in-game month. AI decisions are staggered (each country "thinks" on its own cadence, not all at once each tick) to avoid CPU spikes.
- Target: 60fps on a 5-year-old laptop. If a phase causes jank, stop and profile before continuing.

### Stop conditions for any phase
- Tests fail (Phase 4+)
- TypeScript errors
- Console errors or warnings in dev mode
- Visible jank during normal gameplay
- Acceptance criteria not met

---

## Phase 1 — Map & World State (the static foundation)

**Goal:** A beautiful, zoomable Mercator world map showing all countries, colored by ownership. No gameplay yet. End of phase: you can look at the map and feel proud of how it looks.

### Tasks
1. `npm create vite@latest terra-bellum -- --template react-ts`
2. Install: `d3 @types/d3 zustand tailwindcss framer-motion lucide-react gh-pages`
3. Set up Tailwind per their Vite docs. Configure `vite.config.ts` with `base: '/terra-bellum/'` (replace with the actual repo name when known — ask the user).
4. Create theme tokens in `src/styles/theme.css`:
   - `--paper`: `#f4ecd8` (background)
   - `--ink`: `#1a1814` (primary text/borders)
   - `--ink-faded`: `#8a8478`
   - `--accent-blood`: `#7a1f1f` (war/danger)
   - `--accent-gold`: `#b8860b` (player/wealth)
   - `--accent-sage`: `#5a6b4e` (peace/alliance)
   - `--paper-shadow`: `rgba(26, 24, 20, 0.08)`
5. Typography: import **Crimson Pro** (display, serif) and **JetBrains Mono** (numbers, stats) from Google Fonts. Body uses Crimson Pro 400, headings 600, stats use JetBrains Mono 500.
6. Add a subtle paper texture: SVG noise filter applied as a `::before` overlay on `body`, opacity 0.03. Do NOT use a raster texture image.
7. Download `ne_110m_admin_0_countries.geojson` to `public/data/countries.geojson`. Source: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson`
8. Build `src/game/world.ts`:
   - `type Country = { id: string; name: string; centroid: [number, number]; neighbors: string[]; population: number; baseEconomy: number; terrain: 'plains' | 'mountain' | 'island' | 'desert' | 'forest'; }`
   - Function `loadWorld(): Promise<{ countries: Country[]; geo: FeatureCollection }>` that fetches the geojson, computes centroids with `d3.geoCentroid`, and computes neighbors using shared-boundary detection. Cache neighbor calculation — it's expensive.
   - Terrain is assigned by latitude band as a placeholder: above 60°N or below 60°S = mountain, between 23.5°N and 23.5°S inland = desert/forest split by longitude, etc. Ugly heuristic, fine for now.
9. Build `src/store/gameStore.ts` (Zustand):
   - State: `countries: Map<id, Country>`, `ownership: Map<countryId, ownerId>` (initially each country owns itself), `selectedCountryId: string | null`.
   - Actions: `setSelected`, `loadInitialWorld`.
10. Build `src/components/WorldMap.tsx`:
    - Full-viewport SVG with `viewBox` matching window size.
    - `d3.geoMercator().fitSize([w, h], geo)` projection.
    - Render each country as a `<path>` with stroke `var(--ink)` 0.5px, fill = a desaturated color derived from a hash of the country id (so the world looks varied but muted at start).
    - On hover: stroke 1.5px, cursor pointer, country name tooltip following cursor.
    - On click: dispatch `setSelected`.
    - Pan and zoom via `d3.zoom()`. Limit zoom to [1, 8].
11. Build `src/components/CountryInfoPanel.tsx`:
    - Right-side fixed panel, 320px wide, paper-colored with a 1px ink border and a soft drop shadow.
    - Shows selected country: name (Crimson Pro 28px), population (formatted with commas, JetBrains Mono), terrain, neighbor count.
    - Slides in/out using Framer Motion when selection changes.
12. App layout: map fills the viewport; info panel overlays on the right; a small header bar across the top with the title "Terra Bellum" in Crimson Pro 24px and a subtitle "A Cartographer's Wargame" in italic 14px.

### Acceptance criteria for Phase 1
- [ ] `npm run dev` shows the world map with all ~180 countries rendered
- [ ] Pan and zoom work smoothly
- [ ] Clicking a country highlights it and opens the info panel
- [ ] Hover shows country name without flicker
- [ ] No console errors or TS errors
- [ ] Map looks intentional — show the user a screenshot before moving to Phase 2

### Commit message
`feat: phase 1 — map rendering and world state`

---

## Phase 2 — Tick Loop, Player Choice, and Basic Economy

**Goal:** Player picks a country at game start, time flows in months, the player accumulates gold and troops, and can build more of either. Still no AI, no combat.

### Tasks
1. Add to game store:
   - `playerCountryId: string | null`
   - `gameDate: { year: number; month: number; }` (start: Jan 1900 — arbitrary but feels right for the aesthetic)
   - `paused: boolean`, `speed: 1 | 2 | 3`
   - `nations: Map<countryId, Nation>` where `Nation = { gold: number; troops: number; tech: number; stance: Map<otherCountryId, 'war' | 'neutral' | 'allied'>; }`
2. Build `src/game/economy.ts`:
   - `goldPerTick(country, nation): number` — based on `baseEconomy * tech * (1 + ownedTerritoriesCount * 0.1)`
   - `troopUpkeepPerTick(nation): number` — `troops * 0.05`
   - `maxTroops(country): number` — `population * 0.02`
3. Build `src/game/tick.ts`:
   - `runTick(state): newState` — pure function. Advances date by one month, applies economy to every nation, deducts upkeep, no combat yet.
4. In the store, set up a `setInterval` driven by `paused` and `speed`. The interval calls `runTick`. Make sure to clear it on unmount and on speed change.
5. Build `src/components/StartScreen.tsx`:
   - Modal overlay on first load.
   - "Choose your nation" — player clicks a country on the map behind the modal, the modal updates with that country's name and stats, and a "Begin Campaign" button confirms.
   - On confirm: set `playerCountryId`, give starting bonus (2x gold, 1.5x troops), unpause.
6. Build `src/components/TimeControls.tsx`:
   - Bottom-center floating control bar.
   - Pause/Play button, three speed buttons (1x, 2x, 3x), current date display ("March 1903" in Crimson Pro italic).
   - Spacebar = pause toggle (global keydown listener).
7. Build `src/components/PlayerHUD.tsx`:
   - Top-left fixed panel.
   - Player country name, flag color swatch, gold (with coin icon), troops (with users icon), tech level.
   - Two buttons: "Recruit Troops" (costs 10 gold per troop, capped at maxTroops) and "Invest in Tech" (costs 100 gold, +0.05 tech, diminishing returns).
8. Update `CountryInfoPanel.tsx` to also show: owner, gold (only if player or allied), troops (only if player or at war and within scout range — for now just always show), and stance toward the player.

### Acceptance criteria for Phase 2
- [ ] On load, player picks a country and starts the game
- [ ] Time advances one month per tick at 1x speed (1 second per month)
- [ ] Pause works. Speed changes work. Spacebar toggles pause.
- [ ] Gold and troops update visibly each tick
- [ ] Recruit and tech buttons work and respect limits
- [ ] Numbers never go negative or NaN

### Commit message
`feat: phase 2 — tick loop, player choice, economy`

---

## Phase 3 — Combat, Movement, and AI (the actual game)

**Goal:** Troops can move. Battles resolve. AI countries attack each other and the player. There's an actual game to play.

### Tasks

#### 3a. Movement
1. Build `src/game/movement.ts`:
   - `type TroopMovement = { id: string; from: countryId; to: countryId; troops: number; arrivalTick: number; ownerId: countryId; }`
   - Distance between countries determines travel time: 1 tick per "hop" through neighbor adjacency. Use BFS to find the path.
   - Movements are stored in `state.movements: TroopMovement[]`. Each tick, decrement remaining travel time. On arrival, trigger combat or peaceful occupation.
2. UI: when player has selected their own country, clicking another country (their territory or neighbor of their territory) opens a "Send Troops" modal with a slider for how many troops, max = current troops minus 10% home garrison. Confirm dispatches a movement.

#### 3b. Combat
1. Build `src/game/combat.ts`:
   - `resolveBattle(attacker: { troops, tech }, defender: { troops, tech, terrainBonus }): { winner, attackerLosses, defenderLosses }`
   - Formula: each side rolls `troops * tech * (1 + bonusModifiers) * (0.85 + Math.random() * 0.3)`. Higher roll wins. Loser loses 60-90% of troops, winner loses 20-50%, scaled by how close the rolls were.
   - Terrain bonus for defender: mountain +30%, island +20% (must be reached), desert +10%, plains 0, forest +15%.
2. On battle resolution: if attacker wins, ownership transfers, attacker's surviving troops occupy. If defender wins, attacker's force is destroyed/routed.
3. Battle log: store last 20 battles in `state.battleLog`. Display in a collapsible bottom-right panel.

#### 3c. Arrows on the map
1. Build `src/components/MovementArrows.tsx`:
   - Render each active movement as an SVG arrow from `fromCountry.centroid` projected to `toCountry.centroid` projected.
   - Arrow style: hand-drawn feel using a wobbly path (slightly perturbed bezier control points, deterministic seed per movement id so they don't jitter every render).
   - Player's arrows: gold. Other countries' arrows visible to player only if origin or destination is owned/allied/at-war-with-player. Color enemies in `--accent-blood`, allies in `--accent-sage`, others in `--ink-faded`.
   - Arrowhead: a small triangle. Animate dash offset to suggest motion.
2. Recently-resolved battles: a brief flash on the destination country (red ring expanding and fading over 1.5 seconds).

#### 3d. AI
1. Build `src/game/ai.ts`:
   - Each nation has a personality assigned at world load: `'aggressive' | 'defensive' | 'opportunist' | 'isolationist' | 'merchant'`. Distribution: 25/25/25/15/10.
   - Personality determines weights for actions. Each AI country "thinks" on a cadence: every N ticks where N is randomized per-country (3–8 ticks) so they don't all act in unison.
   - On a thinking tick, the AI evaluates:
     - Are any neighbors significantly weaker (troops < 60% of mine, no alliance)? If aggressive/opportunist → attack the weakest with a portion of troops based on personality.
     - Am I being threatened (a neighbor at war with me has more troops than me)? Defensive → recruit max, propose peace. Aggressive → recruit max, look for allies.
     - Do I have surplus gold? Merchant/isolationist → invest in tech. Others → recruit.
   - Function: `decideAction(nation, world, state): Action | null`. Pure function. Returns action descriptor that the tick loop applies.
2. Diplomacy actions:
   - `proposeAlliance(from, to)` — succeeds if `to` is not at war with `from` and personality permits. Player gets a UI prompt when AI proposes.
   - `declareWar(from, to)` — sets stance to war. AI logs intent so the player can read it.
   - `proposePeace(from, to)` — succeeds based on relative strength and personality.
3. Build `src/components/DiplomacyPanel.tsx`:
   - When a non-player country is selected, show diplomacy buttons: Propose Alliance, Declare War, Propose Peace, Send Gift (10g for +relations).
   - Show current stance prominently with the appropriate accent color.

#### 3e. Win/Lose
1. Build `src/game/victory.ts`:
   - Win: player controls 60% of world population
   - Lose: player's home country is captured
2. End screen: full-screen takeover with paper texture, Crimson Pro display: "VICTORY" or "DEFEAT" in massive type, stats summary (years played, countries conquered, biggest battle), "New Campaign" button.

### Acceptance criteria for Phase 3
- [ ] Player can send troops to any reachable country
- [ ] Combat resolves with believable outcomes (strong attackers usually win, terrain matters)
- [ ] AI countries attack each other visibly — wars break out without player involvement
- [ ] AI countries respond to threats and form alliances
- [ ] Player can win and lose
- [ ] Battle log reads like a real history
- [ ] No country ends up with negative troops or impossible states
- [ ] A full game from start to win/loss takes 15–40 minutes at 1x speed

### Commit message
`feat: phase 3 — combat, movement, ai, victory conditions`

---

## Phase 4 — Polish, Balance, and Tests

**Goal:** The game feels finished. Numbers feel right. Edge cases don't break it.

### Tasks
1. **Tests** for `src/game/` modules using **Vitest**:
   - `combat.test.ts`: stronger force usually wins, terrain bonus applies, no negative troops, deterministic with seeded RNG
   - `economy.test.ts`: gold accumulates correctly, upkeep deducts correctly, max troops respected
   - `ai.test.ts`: aggressive AI attacks weak neighbors, defensive AI doesn't suicide-attack stronger foes
   - `movement.test.ts`: BFS finds shortest path, unreachable countries return null, island handling
   - Aim for 70%+ coverage on `src/game/`. UI components don't need tests yet.
2. **Balance pass**: play 5 full games. Tune until:
   - No "snowball after first conquest" runaway (rebellions? attrition? alliances forming against the leader?)
   - No "stuck at start with no money" (boost early-game economy)
   - AI should occasionally beat the player if the player plays badly
   - **Add a "balance constants" file** at `src/game/balance.ts` with all magic numbers so tuning is one file
3. **Visual polish**:
   - Country fill colors: when at war with player, subtle red tint; when allied, subtle green tint; when neutral, original color. Transitions smoothly over 800ms when stance changes.
   - Selected country: thicker stroke + gold tint, regardless of ownership
   - Better arrow rendering: arrows curve along great-circle-ish paths, not straight lines
   - Add a vignette around map edges (radial gradient overlay)
   - Add subtle ambient animation: a slow drifting cloud shadow across the map (low opacity, very slow)
4. **Sound** (optional, only if time permits):
   - Use Web Audio API, no external library. Generate three sounds programmatically:
     - Soft paper rustle on country click
     - Distant cannon thump on battle resolution
     - Quill scratch on alliance formed
   - Mute toggle in UI.
5. **Persistence**:
   - Auto-save game state to localStorage every 10 ticks
   - On load, offer "Continue Campaign" if a save exists
   - Manual save/load buttons
6. **Tutorial**: a 4-step onboarding overlay on first play. Pure HTML/CSS, dismissable, never shows again (localStorage flag).

### Acceptance criteria for Phase 4
- [ ] All tests pass
- [ ] Five consecutive playthroughs feel different and end in different ways
- [ ] No visual glitches, no console warnings, no broken UI states
- [ ] First-time player understands the game in under 2 minutes
- [ ] Game runs at 60fps with all 180 countries active

### Commit message
`feat: phase 4 — polish, balance, tests, persistence`

---

## Phase 5 — Ship It

**Goal:** Live on GitHub Pages with a CI pipeline, sharable URL, README that makes the project look professional.

### Tasks
1. Create the GitHub repo (ask the user for the repo name).
2. Update `vite.config.ts` `base` to match the actual repo name.
3. Add `gh-pages` deploy script to `package.json`:
   ```
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
4. Add `.github/workflows/deploy.yml`: on push to `main`, build and deploy to `gh-pages` branch. Use `actions/checkout@v4`, `actions/setup-node@v4` (Node 20), and `peaceiris/actions-gh-pages@v3`.
5. Run tests in CI before deploy. Fail the deploy if tests fail.
6. Write `README.md`:
   - One-paragraph pitch
   - Animated screenshot/GIF
   - "How to play" section (3–5 bullets max)
   - Tech stack
   - Local dev instructions
   - License (MIT)
   - Credit Natural Earth for the geo data
7. Add a `LICENSE` file (MIT).
8. Add OpenGraph meta tags to `index.html` so links unfurl nicely on Twitter/Discord.
9. Take a high-quality screenshot, optimize it, add to README and OG image.
10. Test the deployed site: full playthrough on the live URL.
11. Send the user the link.

### Acceptance criteria for Phase 5
- [ ] Site loads at `https://<user>.github.io/<repo>/`
- [ ] CI runs on every push to main, builds, tests, deploys
- [ ] README is good enough to share publicly without embarrassment
- [ ] Link unfurls correctly when pasted in Discord or Twitter

### Commit message
`chore: phase 5 — ship to github pages`

---

## How to use this document with Claude Code

1. Save this file as `BUILD_PLAN.md` in your repo root.
2. Start each Claude Code session with: *"Read BUILD_PLAN.md. We are working on Phase N. Do not skip ahead. When the phase's acceptance criteria are met, stop and ask me to verify before committing."*
3. After each phase, manually verify the acceptance criteria yourself before letting Claude Code commit. Don't trust "I think it works."
4. If a phase takes more than ~2 hours of Claude Code time, stop and re-scope. Either the phase was too big or something is wrong with the approach.
5. If Claude Code wants to change the stack, refuse. Pinned stack is pinned for a reason.
