# Sound assets

By default the game synthesizes every cue with the Web Audio API, so this
folder can be empty. **Drop a file here with one of these exact names to
override the synthesized cue with your own asset:**

| File            | When it plays                                  |
| --------------- | ---------------------------------------------- |
| `click.mp3`     | Country selection / paper rustle               |
| `cannon.mp3`    | Battle resolution                              |
| `march.mp3`     | Troop dispatch                                 |
| `alliance.mp3`  | Alliance forms                                 |
| `conquest.mp3`  | A country falls (control hits 0)               |
| `defeat.mp3`    | Defeat screen                                  |

Files are looked up via `fetch`; on 404 the synthesized fallback runs.
Keep them short (under ~2 seconds) and reasonably normalized.
