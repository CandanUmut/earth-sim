# Sprites & art assets

Drop image files into this folder with any of the names below and the game
will automatically use them in place of its built-in vector graphics. Every
asset is **optional** — the game ships with vector fallbacks for everything,
so you can mix and match.

The game is desktop-resolution; assets render at small sizes (8 – 24 px on
the map, ~64 px in panels), so simple, high-contrast silhouettes work best.

## Map markers (small, on the world map)

These render at ~10 px on the map and should read at small size. PNG with
transparency, square 64×64 looks best.

| File                    | Used for                                                      |
| ----------------------- | ------------------------------------------------------------- |
| `marker_infantry.png`   | Infantry rank icon at battle vignettes (replaces stick dots)  |
| `marker_cavalry.png`    | Cavalry rank icon                                             |
| `marker_artillery.png`  | Artillery / cannon rank icon                                  |
| `marker_garrison.png`   | Flag pole shown over a tile with stationed garrison troops    |
| `marker_fire.png`       | Flame for contested tiles (replaces vector flame)             |
| `marker_smoke.png`      | Smoke puff at battle centers                                  |
| `marker_ship.png`       | Ship sprite for naval movement legs (movements crossing seas) |
| `marker_tank.png`       | Tank sprite for "modern era" forces (post-tech-tree milestone)|

## UI panel art

Larger PNGs that surface in the HUD and modals.

| File                  | Used for                                              |
| --------------------- | ----------------------------------------------------- |
| `flag_default.png`    | Generic flag rendered in the country panel header     |
| `barracks_icon.png`   | Replaces the lucide hammer in the HUD                 |
| `treasury_icon.png`   | Replaces the lucide coins icon                        |
| `tech_icon.png`       | Replaces the lucide sparkles icon                     |

## Backdrops (optional)

Large images, `1920×1080` or similar.

| File                  | Used for                                              |
| --------------------- | ----------------------------------------------------- |
| `bg_paper.jpg`        | Replaces the procedural paper texture on the map      |
| `bg_endscreen.jpg`    | Painted backdrop on the win/lose end screen           |

## Sourcing tips

- **opengameart.org** — many free CC0 / CC-BY soldier silhouettes and
  cartography tiles.
- **kenney.nl** — high-quality CC0 game assets, including tiny soldier
  sprites that fit the small-marker brief.
- **flaticon.com** — many infantry / tank / ship icons in free tiers
  (attribution required).
- **game-icons.net** — over 4000 CC-BY medieval/military icons. Outstanding
  fit for this project's wargame aesthetic.
- Hand-drawn ink scans work great for the cartography vibe — scan a sketch,
  threshold it, and save with transparent background.

## Implementation note

When you drop a file in, the game tries to fetch it on first use. If the
fetch fails (404), the vector fallback runs silently — so it's safe to add
files one at a time and reload. No code change required for any of the
filenames listed above. New filenames not on this list won't be picked up
without a code change.
