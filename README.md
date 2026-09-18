# Duck Pond

Duck Pond hides your task list inside ducks swimming on a pond. Each duck
carries one task. Click a duck to reveal its task, mark it done, or send it
back to swim a while longer.

## Running it

No build step. Open `index.html` directly in a browser, or serve the folder
with any static file server, for example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

| Control | What it does |
|---|---|
| Click a duck | Reveals the task it's hiding |
| ✓ Done | Marks the revealed task done and moves it to Done history |
| ↩ Not now | Sends the duck back to swim; the task stays in the pond |
| Add a task (bottom bar) | Adds a new task; a duck brings it into the pond |
| Tasks & settings (top bar) | Opens the drawer: full task list, settings, Done history |

## Persistence

Tasks, settings, and history persist to the browser's `localStorage` under
the key `duckpond`. Nothing is sent anywhere; everything stays local to your
browser.

## Running the tests

```bash
node --test
```

Run this from the repo root. Do not run `node --test test/` — that form is
broken on Node 24.

## File structure

| File | Responsibility |
|---|---|
| `index.html` | Page structure. Loads the six scripts in dependency order. |
| `styles.css` | All styling. Layout, drawer, card, duck wrappers. |
| `js/state.js` | Tasks, lifecycle, settings, `localStorage`. No DOM. The tested unit. |
| `js/sprites.js` | Sheet table, frame stepper, skin picking. No DOM beyond writing styles onto an element it is handed. |
| `js/scene.js` | The low-resolution canvas: pond art and ripples. Replaceable by a tileset. |
| `js/pond.js` | Duck entities, movement, enter/swim/exit states, the frame loop, DOM sync. |
| `js/audio.js` | Quack playback, synthesized splash, volume. |
| `js/app.js` | Page wiring: add-task, drawer, reveal card, settings, history. |
| `test/state.test.js` | Node test-runner suite for `state.js`. |
| `assets/ducks/*.png` | CazBee sprite sheets. Already committed. |
| `assets/audio/*.ogg` | Freesound quacks. Task 8 acquires these. |
| `README.md` | What it does, how to run it, full asset credits and licences. |
| `LICENSE` | GPL-3.0. |

## Asset credits

### Sprites (`assets/ducks/`)

| File | Source | Licence |
|---|---|---|
| `ducky_2_spritesheet.png` | https://caz-bee.itch.io/ducky-2 | CC0 |
| `ducky_3_spritesheet.png` | https://caz-bee.itch.io/ducky-3 | CC0 |
| `gentleman_ducky_sheet.png` | https://caz-bee.itch.io/gentleman-ducky | No licence tag on the page |

All three sprite sheets are by CazBee. The gentleman duck's itch.io page
carries no licence tag; it only says "Go ahead and use this asset in any of
your projects!", which permits use but is silent on redistribution. The
repository owner has accepted this knowingly and owns resolving it.

### Audio (`assets/audio/`)

| File | Source | Author |
|---|---|---|
| `quack-1.ogg` | https://freesound.org/people/Mikes-MultiMedia/sounds/418509/ | Mikes-MultiMedia |
| `quack-2.ogg` | https://freesound.org/people/Mari0411/sounds/791152/ | Mari0411 |
| `quack-3.ogg` | https://freesound.org/people/OwennewO/sounds/719115/ | OwennewO |

All three are CC0. CC0 requires no attribution, but all sources are credited
here anyway.

## Licence

GPL-3.0. See `LICENSE`.
