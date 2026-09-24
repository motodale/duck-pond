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
| Add a task (bottom bar) | Adds the task. The box beside it is **how many** — put 200 in it and you get 200 separate tasks. A duck brings each one into the pond in its own time |
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

## How many, and weight

### How many

The box beside the "Add a task" field is a quantity. If you have 200 dishes
to wash, type the task once, put 200 in the box, and you get 200 tasks.

They are 200 genuinely separate tasks, not one task with a counter. Each has
its own row in the drawer, gets caught by its own duck, and gets its own line
in the Done history. You can delete or re-weight any one of them without
touching the rest. The box resets to 1 after each add, since one is the usual
case.

The cap is 500 per add. That is not a taste judgement: each one is a real
task in `localStorage`, and an accidental extra zero would otherwise hang the
browser.

### Weight

Which task a duck brings in next is a random draw, but not an even one. Every
task carries a weight, editable in the drawer's task list:

| Number | Range | Default | What it is |
|---|---|---|---|
| Weight | 1-10, whole numbers | 1 | How much you want this task to come up |

A task's chance of being drawn is its weight measured against the total
weight of every other task in the pile. A task at 10 is ten times as likely
to come up as a task at 1, but the task at 1 is never impossible - it only
has to wait longer.

Weight is deliberately only in the drawer. It is the considered setting, so
it lives with the rest of the task settings rather than on the bar you type
into every day.

Note what this means for a batch: 200 dishes at weight 1 each are individually
no more likely than your one weight-1 email, but as a group they are most of
the pile, so dishes will come up often. That is honest - they are most of your
outstanding work.

### Seeing the odds

Getting a task out of the pond happens in two steps, and the drawer's list
has a labelled column for each:

| Column | What it is |
|---|---|
| **Drawn in** | The chance this is the next task pulled off the waiting pile into the pond. This is the step weight controls. |
| **Caught next** | The chance this is the next task a duck actually hands you. You pick a duck, and one duck is as good as another, so it is an even split across the ducks on the water. |

A task is either waiting or in the pond, never both, so every row has a figure
in exactly one column and a dash in the other. The dash means that step does
not apply: a waiting task has no "caught next" until it has been drawn in, and
a task already in the pond has no "drawn in" left to do.

A dash is not the same as `0%`. A waiting task reads a real `0%` under
"Caught next" — it genuinely cannot be the next one revealed. Twelve ducks on
the water means each of them reads 8%.

Precision follows the size of the number: `33%`, `4.8%`, `0.48%`. That matters
with a large batch, because 200 tasks put every row well under 1% and rounding
them all the same way would hide the effect of a weight edit.

Editing a weight changes the "Drawn in" column for every waiting task at once,
since they all share out the same total. The box you edited also lights up for
a moment to confirm it saved.

Tasks saved before weight existed load at 1, so nothing you already had
changes behaviour.

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
| `ducky_4_spritesheet.png` | Recolour of `ducky_3` by motodale | CC0 |
| `gentleman_ducky_sheet.png` | https://caz-bee.itch.io/gentleman-ducky | No licence tag on the page |

The sprite art is by CazBee; `ducky_4` is a recolour of `ducky_3`. The gentleman duck's itch.io page
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
