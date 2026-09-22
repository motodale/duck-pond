# Duck Pond

Duck Pond hides your task list inside ducks swimming on a pond. Each duck
carries one task. Click a duck to reveal its task, then mark it done or put
it back in the pile to surface again later.

## Live
Live: https://motodale.github.io/duck-pond/

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
| Click a duck | Reveals the task it's hiding. The duck begins leaving the pond as soon as it's caught — it paddles to the left bank and waddles off into the bushes — regardless of which button you press next |
| ✓ Done | Marks the revealed task done and moves it to Done history |
| ↩ Not now | Returns the task to the pile; it may surface again in a later duck |
| Escape (with the card open) | Dismisses the card without choosing a button; follows the **On dismiss** setting in the drawer (done, or back to the pile) |
| Add a task (bottom bar) | Adds a new task at the weight in the box beside it; a duck brings it into the pond |
| Tasks & settings (top bar) | Opens the drawer: full task list, settings, Done history |
| ✕ (in the drawer) | Closes the drawer. The drawer covers the top bar, so the button that opened it is not reachable while it is open |
| Clear history (in the drawer) | Deletes every task in the Done list. Asks first, because it cannot be undone. Tasks still in the pond or the pile are not touched. The button is disabled when the history is already empty |

## Keyboard use

The whole app works without a mouse.

| Key | What it does |
|---|---|
| Tab / Shift+Tab | Moves focus between ducks (each is a real button in the page's tab order) |
| Enter or Space (duck focused) | Catches the focused duck, same as clicking it |
| Escape | Dismisses the reveal card if it's open (see the Controls table) **and** closes the drawer if it's open, returning focus to the "Tasks & settings" button. The two handlers are independent and both fire on the same press, so with card and drawer both open, one Escape does both |

The drawer's task list is a complete alternative to catching ducks: every
task's text is visible and editable there directly, with no need to catch a
duck or chase one down.

The task list and the Done history each scroll inside their own box, so the
drawer never grows past the height of the screen.

## Weight and multiplier

Which task a duck brings in next is a random draw, but not an even one. Each
task carries two numbers, both editable in the drawer's task list:

| Number | Range | Default | What it is |
|---|---|---|---|
| Weight | 1–10, whole numbers | 1 | How much you want this task to come up |
| Multiplier | 0.5–5, in steps of 0.5 | 1 | A second factor on top of weight — use it to push a whole task up or down without losing the weight you gave it |

A task's chance of being drawn is its **weight × multiplier**, measured
against the same product for every other task in the pile. A task at 10 × 5
is 50 times as likely to come up as a task at 1 × 1, but the 1 × 1 task is
never impossible — it only has to wait longer.

Set a weight when you add a task using the box beside the "Add a task" field.
Change either number later in the drawer. Tasks saved before these numbers
existed load at 1 and 1, so nothing you already had changes behaviour.

## Sound

A pond ambience loops quietly in the background, and a duck quacks when you
catch it. They have separate sliders in the drawer — **Quack volume** and
**Pond ambience** — so you can turn the background off and keep the quacks,
or the other way round. Ambience starts at 35%, quacks at 70%.

Browsers will not start audio before you interact with the page, so the pond
is silent until your first click or key press.

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
| `js/scene.js` | The low-resolution canvas: pond art, ripples, and the water mask the ducks are bounded by. Replaceable by a tileset. |
| `js/pond.js` | Duck entities, movement, enter/swim/exit states, the frame loop, DOM sync. |
| `js/audio.js` | Quack playback, the looping pond ambience, and volume. |
| `js/app.js` | Page wiring: add-task, drawer, reveal card, settings, history. |
| `test/state.test.js` | Node test-runner suite for `state.js`. |
| `assets/ducks/*.png` | CazBee sprite sheets. Already committed. |
| `assets/audio/*.ogg` | Freesound quacks and pond ambience. Already committed. |
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

| File | Source | Author | Licence |
|---|---|---|---|
| `quack-1.ogg` | https://freesound.org/people/Mikes-MultiMedia/sounds/418509/ | Mikes-MultiMedia | CC0 |
| `quack-2.ogg` | https://freesound.org/people/Mari0411/sounds/791152/ | Mari0411 | CC0 |
| `quack-3.ogg` | https://freesound.org/people/OwennewO/sounds/719115/ | OwennewO | CC0 |
| `pond-ambience.ogg` | https://freesound.org/s/859363/ | Ambient-X | CC BY 4.0 |

The three quacks are CC0, which requires no attribution; they are credited
here anyway.

**The ambience is CC BY 4.0, which does require attribution.** Keep this
credit with the file if you redistribute the app:

> "Goldade Acres Pond Sunset 6-16-26 20 minutes" by Ambient-X —
> https://freesound.org/s/859363/ — License: Attribution 4.0

It is also modified: only the first 6 minutes are used, and the head is
crossfaded onto the tail so the loop has no audible seam.

### How the files were made

The quacks, from the Freesound originals:

```bash
ffmpeg -i <original> -ac 1 -ar 22050 -c:a libvorbis -q:a 2 assets/audio/quack-N.ogg
```

The ambience, cut to a seamless 360-second loop. The filter keeps 3s-360s,
then crossfades the 3 seconds after the cut into the 3 seconds before the
start, so the end of the loop arrives exactly where the beginning leaves off:

```bash
ffmpeg -i 859363__ambient-x__*.wav -filter_complex \
  "[0:a]atrim=3:360,asetpts=N/SR/TB[m];\
   [0:a]atrim=360:363,asetpts=N/SR/TB[t];\
   [0:a]atrim=0:3,asetpts=N/SR/TB[x];\
   [t][x]acrossfade=d=3[c];[m][c]concat=n=2:v=0:a=1[out]" \
  -map "[out]" -ac 2 -ar 32000 -c:a libvorbis -q:a 1 assets/audio/pond-ambience.ogg
```

## Licence

GPL-3.0. See `LICENSE`.
