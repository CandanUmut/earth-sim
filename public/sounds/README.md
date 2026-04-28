# Sound assets

The game ships with synthesized fallbacks for every SFX, so this folder can
be empty and the game still runs. **Drop a file here with one of these
exact names to override the synth or add music.** Files are looked up via
`fetch`; on 404 the game silently falls back to the synth (or to silence
for music / battle loop).

Recommended length: SFX under 2 seconds, music 60–120 seconds and seamlessly
loopable. All files MP3 (or any format the browser can decode via
`AudioContext.decodeAudioData` — OGG / WAV also work).

## Sound effects

| File                   | When it plays                                         |
| ---------------------- | ----------------------------------------------------- |
| `click.mp3`            | UI clicks / country selection (paper rustle)          |
| `hover.mp3`            | Soft hover tick on interactive elements               |
| `cannon.mp3`           | Battle resolution thump                               |
| `march.mp3`            | Troops dispatched                                     |
| `alliance.mp3`         | Alliance / trade / vassal forms                       |
| `conquest.mp3`         | A country falls (control hits 0)                      |
| `defeat.mp3`           | Defeat screen                                         |
| `victory.mp3`          | Victory screen                                        |
| `coin.mp3`             | Recruit / buy success                                 |
| `tech_unlock.mp3`      | Research complete                                     |
| `event_warning.mp3`    | World event toast                                     |
| `betrayal.mp3`         | Alliance broken / war declared on you (future use)    |
| `infantry_clash.mp3`   | Persistent battle: infantry round (future use)        |
| `cavalry_charge.mp3`   | Persistent battle: cavalry round (future use)         |
| `cannon_volley.mp3`    | Persistent battle: artillery round (future use)       |

## Music (file-only — no synth fallback)

These should be loopable. Put 60–120 second clean loops here; the engine
crossfades between them in ~1.2 seconds when the game state changes.

| File              | When it plays                                     |
| ----------------- | ------------------------------------------------- |
| `music_menu.mp3`  | Start screen / end screen                         |
| `music_peace.mp3` | Active campaign while you have no active wars     |
| `music_war.mp3`   | Active campaign while you are at war with anyone  |

## Looped SFX (file-only)

| File              | When it plays                                               |
| ----------------- | ----------------------------------------------------------- |
| `battle_loop.mp3` | Continuous low ambient bed while ANY battle is in progress. |

If `battle_loop.mp3` is missing the per-event SFX still fire, just without
the ambient bed.

## Sourcing tips (free / liberal-license collections)

- **freesound.org** — community SFX, mostly CC0 or CC-BY.
- **incompetech.com** (Kevin MacLeod) — instrumental music, CC-BY, great
  classical / folk-ish loops that fit the cartography vibe.
- **pixabay.com/music** — royalty-free with a permissive license.
- **opengameart.org** — game-friendly licenses, plenty of cinematic loops.

If you record your own, normalize to ~-3 dBFS peak and trim silence on the
edges to avoid loop clicks.
