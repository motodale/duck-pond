# Duck Pond — Design

**Date:** 2026-09-17
**Status:** Approved, ready for implementation planning

## Summary

Duck Pond is a single-page web app that hides your task list inside ducks. You
type tasks into a pile. Ducks swim on a pond, each holding one task, and you
cannot see which duck holds what. Click a duck and it tells you its task, then
leaves the pond. Another duck waddles in from the right with the next task off
the pile.

It is a sibling to [The Task Wheel](https://github.com/motodale/adhd-task-manager):
same idea of letting chance pick your next task, same technical rules, separate
repository.

## Goals

1. Make picking a task feel like a small game instead of a list you are avoiding.
2. Keep the whole thing openable from a single `index.html` with no build step.
3. Stay usable with a keyboard and a screen reader, and with animation turned off.

## Non-goals

- No accounts, no server, no sync between devices.
- No due dates, priorities, tags, recurring tasks, or sub-tasks.
- No multi-pond or project support.

## Global constraints

These apply to every part of the build.

- **No build step.** Opening `index.html` from disk must work.
- **No dependencies.** No npm packages at runtime. The only tooling is Node's
  built-in test runner for the state tests.
- **Vanilla JS**, modules attached to `window`, matching the Task Wheel's pattern.
- **Licence: GPL-3.0.** The repository is public, so every asset in it is
  redistributed and must carry a licence that permits redistribution.
- **Deploys by pushing** to GitHub Pages. No deploy step beyond `git push`.
- **All persistence is `localStorage`** under a single key, `duckpond`.

## The loop

1. You type a task. It joins the pile, and the pile reshuffles.
2. If the pond holds fewer ducks than its capacity and the pile is not empty, a
   duck waddles in from the right carrying the next task off the pile, and
   settles into the water.
3. You click, tap, or Tab-and-Enter a duck. It quacks, splashes, and its task
   appears on a card.
4. The duck leaves by one of three exits, chosen at random: it waddles off left
   into the bushes, dives under, or flies away.
5. You resolve the task as **Done** or **Not now**. Done removes it and logs it
   to the history. Not now returns it to the pile, where it is reshuffled and may
   surface again inside a later duck.

   Both buttons are always on the card. The **On reveal** setting only decides
   what happens when you dismiss the card *without* choosing — by pressing Escape,
   or clicking away. That dismissal is treated as Done or as Not now according to
   the setting. The setting never hides or disables either button.
6. The pond refills, and a new duck walks in from the right.

Only one task can be revealed at a time. While a task is on the card, the other
ducks are not clickable. This is deliberate: it is the whole point of the app.

## Data model

One array of tasks. Ducks are never persisted.

```js
task = {
  id:     string,        // crypto.randomUUID()
  text:   string,        // trimmed, max 100 chars
  state:  'pile' | 'pond' | 'done',
  doneAt: number | null  // epoch ms, set when state becomes 'done'
}
```

- **Pile order is array order.** Shuffling the pile means shuffling the `pile`
  entries of this array in place, leaving `pond` and `done` entries where they are.
- **A duck holds a `taskId`** and nothing else. Duck position, heading and
  animation frame live only in memory.
- **On load**, one duck is created for every task whose state is `pond`, at a
  fresh random position in the water. Duck positions are not restored across a
  reload. This is deliberate — nobody can perceive the difference, and it avoids
  persisting a simulation.
- **On load, ducks do not walk in.** They are already floating. The walk-in
  animation is only for refills during a session.

### Lifecycle rules

| Event | Effect |
|---|---|
| Add task | New task appended with state `pile`, then pile reshuffled |
| Refill | While `pondCount < capacity` and pile is non-empty: take the first `pile` task, set state `pond`, spawn a walk-in duck. Staggered by 400ms so a group does not stampede. |
| Catch duck | Task is revealed. Task state is unchanged until resolved. Duck begins its exit. |
| Resolve: done | State becomes `done`, `doneAt` set, appears in history |
| Resolve: not now | State returns to `pile`, pile reshuffled |
| Delete from drawer | Task removed from the array. If it was in the pond, its duck leaves immediately by the dive exit. |
| Capacity lowered | No ducks are removed. Refill simply stops until the pond drains to the new number. |
| Capacity raised | Refill runs immediately if the pile can supply. |

## Art and animation

### Duck sprites

Three sprite sheets by [CazBee](https://caz-bee.itch.io/), all
**Creative Commons Zero v1.0 Universal**, verified on their itch.io pages on
2026-09-17:

| File | Source | Licence |
|---|---|---|
| `ducky_2_spritesheet.png` | https://caz-bee.itch.io/ducky-2 | CC0 |
| `ducky_3_spritesheet.png` | https://caz-bee.itch.io/ducky-3 | CC0 |
| `ducky-idle.png`, `ducky-walk.png` | https://caz-bee.itch.io/ducky | CC0 |

`ducky_2` and `ducky_3` are pixel-identical frames with different palettes, so
they cost nothing extra to support.

#### The gentleman duck

`gentleman_ducky_sheet.png` from https://caz-bee.itch.io/gentleman-ducky is
**included, as a rare easter egg**.

Its licence status differs from the others and is recorded here deliberately.
That page carries no licence tag — only the informal line "Go ahead and use this
asset in any of your projects!" It permits use but is silent on redistribution,
which is what a public repository does. CazBee tagged their other three packs
CC0, so this is most likely an oversight, and one message would settle it. The
repository owner has accepted this risk knowingly and owns resolving it. The
README records the same facts so anyone reading the repository sees them.

**Behaviour.** He is a normal duck in every respect — same animations, same
catching, same exits, holds a task like any other. He simply appears rarely:
each newly spawned duck has a **2% chance** of being the gentleman instead of one
of the three common skins. Nothing else marks him out and nothing announces him.
Finding one is the whole joke.

**One difference to handle:** his row 2 (quack) holds **2 frames** where the
other sheets hold 4. Frame counts are therefore per-sheet metadata, not a shared
constant. See *Sheet geometry*.

### Sheet geometry

Measured from the alpha channel of the supplied files:

- **Cell size:** 32 × 32 px
- **Grid:** 6 columns × 4 rows (sheet is 192 × 128)
- **Row 0** — 2 frames — idle. Cropped at the waterline, this is the **swim** cycle.
- **Row 1** — 6 frames — **waddle**. Used walking in from the right.
- **Row 2** — **quack**. Played once when the duck is caught. 4 frames on the
  common sheets, **2 on the gentleman sheet**.
- **Row 3** — 6 frames — a faster, busier walk. Used as the **hurried waddle**
  for a duck leaving into the bushes. It is too active to read as swimming.

Row frame counts vary by sheet, so each sheet declares its own in `js/sprites.js`
rather than sharing one table. A sheet whose row is shorter must never step past
its last frame into the empty cells beside it.

`ducky-walk.png` (4 frames) and `ducky-idle.png` (2 frames) are 48 × 48 cells in
a single row — larger versions of the duckling. They are **not used** in the
first release; the 32px sheets carry every animation we need. They stay in the
repository as alternatives.

### Animation constants

- **Frame rate: 7 fps.** Chosen by eye. This is what produces the stepped,
  game-like feel — it is the frame rate doing the work, not the art.
- **Waterline cut: 5 px** of the 32px cell, measured from the bottom. A floating
  duck is drawn inside a wrapper 27px tall with `overflow: hidden`, which hides
  its feet. The crop is removed whenever a duck is on land so its feet show.
- **Pixel scale: 3** on screens wider than 900px, **2** below. Everything —
  sprites and the scene canvas — uses the same scale so the pixel grids line up.

Both the frame rate and the waterline cut are named constants, not literals
scattered through the code. They are tuning knobs and will be adjusted by eye
once the real scene is behind them.

### Facing

The sprites face right only. A horizontal `scaleX(-1)` gives left-facing ducks
for free. There is no up or down view and none can be derived, so ducks always
present side-on. Movement is therefore **horizontally dominant**: ducks drift
left and right and flip to face their travel direction, with a gentle vertical
wander that never becomes the main direction of travel. This is simpler than a
steering model and suits the art.

### The scene

One canvas, drawn at low resolution and upscaled with `image-rendering: pixelated`
so the water shares the ducks' pixel grid. It draws both the pond and the ripples;
they are not separate layers.

Contents: a small murky green pond on a mud shore, lilypads floating on the water,
cattails and reeds around the back and sides, rocks scattered on the rim, and a
bush line down the left where caught ducks disappear. A few reeds draw *in front*
of the ducks for depth.

This scene is procedural for the first release, and it will look plain next to
CazBee's ducks. That is accepted. `js/scene.js` is written as a replaceable unit
with a defined interface so a CC0 pixel tileset can be dropped in later without
touching any other file.

Ripples are drawn on the same canvas: expanding ellipses for wakes behind
swimming ducks, an occasional ambient ring in open water, and a larger burst when
a duck is caught or dives.

### Depth

Ducks are sorted by their y position each frame via `z-index`, so ducks further
back draw behind ducks in front.

## Layout

The pond fills most of the viewport. A slim bar sits at the top with the app name
and a drawer toggle. Everything else lives in a drawer that slides out and is
**closed by default**:

- The full task list — pile tasks *and* the tasks currently hidden inside ducks —
  each editable and deletable.
- Settings.
- Done history.

The drawer being closed by default is what protects the surprise. Opening it
spoils which tasks are in play, and that is a choice the user makes deliberately.

A single-line add-task field is always visible below the pond. It does not live
in the drawer, because adding a task is the one thing you do constantly.

The revealed task appears on a card that slides up over the water, carrying the
task text and the Done / Not now buttons.

This layout is identical at every width. Nothing rearranges on a phone.

## Settings

All live in the drawer, all persisted.

| Setting | Range | Default |
|---|---|---|
| Pond capacity | 4–20 | 12 |
| On dismiss | Treat as done / Put back in the pile | Treat as done |
| Volume | 0–100% | 70% |

**On dismiss** applies only when the reveal card is closed without pressing
either button. The Done and Not now buttons are always present and always work.

**Assumption flagged:** "Done and gone" is the default because a task manager
that never removes anything is the more surprising behaviour. Easy to flip.

Capacity is a knob because 12 ducks at pixel scale 3 may crowd a smaller pond
than expected. The default will be checked by eye during the build.

## Audio

Three quack samples, all **CC0**, verified on their Freesound pages on 2026-09-17:

| File | Source | Author | Length |
|---|---|---|---|
| Single quack | https://freesound.org/people/Mikes-MultiMedia/sounds/418509/ | Mikes-MultiMedia | 0.82s |
| Short quack | https://freesound.org/people/Mari0411/sounds/791152/ | Mari0411 | 0.28s |
| Ducks quacking | https://freesound.org/people/OwennewO/sounds/719115/ | OwennewO | 1.25s |

CC0 requires no attribution, but all six asset sources are credited in the README
regardless.

One quack is chosen at random when a duck is caught, played through a single
`AudioContext` with a gain node driven by the volume setting. Files are converted
to `.ogg` and kept under 50KB each. Audio is unlocked on the first user gesture,
as browsers require.

The splash is synthesized — filtered noise with a fast decay — so it stays in
tune with the ripple it accompanies and costs no file.

## Accessibility

Not negotiable, and not trimmed for effort.

- **Every duck is a real focusable element** in stable DOM order. Tab reaches
  them, Enter and Space catch them, and the focus ring is visible against the
  water. Hit target is the full sprite cell — 96px at pixel scale 3, 64px at
  scale 2 — comfortably above the 44px minimum.
- **Ducks do not reorder in the DOM**, so tab order does not shuffle under the
  user's fingers while ducks swim.
- **The reveal card is an `aria-live="polite"` region**, so the task is announced,
  not merely shown.
- **Each duck is labelled** "Duck hiding a task" — never the task text, which
  would leak it to a screen reader.
- **`prefers-reduced-motion`**: ducks stop drifting and hold a gentle idle in
  place, ambient ripples and wakes stop, walk-ins and exits become a short fade.
  Ducks remain catchable throughout. The app is fully usable with animation off.
- **The drawer's task list is the text-only path** through the whole app for
  anyone who does not want to chase ducks.

## Files

| File | Responsibility |
|---|---|
| `index.html` | Page structure, loads the six scripts |
| `styles.css` | All styling. Themes as CSS variable sets. |
| `js/state.js` | Tasks, lifecycle, settings, `localStorage`. No DOM, no rendering. |
| `js/scene.js` | The low-resolution canvas: pond art and ripples. Replaceable by a tileset. |
| `js/sprites.js` | Sheet metadata, the 7fps frame stepper, waterline crop |
| `js/pond.js` | Duck entities, movement, enter/swim/exit states, the frame loop, DOM sync |
| `js/audio.js` | Quack playback, synthesized splash, volume |
| `js/app.js` | Page wiring: drawer, add-task, reveal card, history, settings |
| `assets/ducks/*.png` | CazBee sprite sheets |
| `assets/audio/*.ogg` | Freesound quacks |
| `README.md` | What it does, how to run it, full asset credits and licences |
| `LICENSE` | GPL-3.0 |
| `.gitignore` | Ignores `.superpowers/` — design-session mockups never ship |

Duck skins are data, not code: adding a fourth common skin should mean adding one
entry to the sheet table in `js/sprites.js` and nothing else.

`js/state.js` holds no DOM references of any kind. This is what makes it testable
and it is a hard rule, not a preference.

## Testing

`js/state.js` contains all the real logic and touches no DOM, so it gets a test
file run by Node's built-in runner — `node --test`, no dependencies, consistent
with the zero-dependency rule. About six lines at the top shim `localStorage` and
`window`.

Cases covered:

1. Adding a task puts it in the pile and reshuffles the pile.
2. Task text is trimmed and capped at 100 characters.
3. Refill never exceeds capacity.
4. Refill is a no-op when the pile is empty.
5. Resolving as done sets state `done` and stamps `doneAt`.
6. Resolving as not-now returns the task to the pile.
7. Lowering capacity removes no tasks.
8. Raising capacity pulls from the pile immediately.
9. A save/load round-trip through `localStorage` preserves every task and setting.
10. Shuffling preserves the exact set of tasks — none lost, none duplicated.

`js/pond.js`, `js/scene.js` and `js/sprites.js` get no automated tests. They are
visual, they were validated by eye in the browser during design, and testing them
would mean asserting on pixel output — expensive and brittle for no real
confidence.

## Edge cases

| Situation | Behaviour |
|---|---|
| Pile empty, pond partly full | Pond runs with fewer ducks. No filler ducks, no empty-duck placeholders. |
| No tasks at all | Empty water, and a line inviting the first task. |
| Task text over 100 chars | Truncated on input, with the limit shown in the field. |
| Empty or whitespace-only task | Rejected silently; the field keeps focus. |
| Task deleted from the drawer while its duck is swimming | That duck dives immediately and the pond refills. |
| `localStorage` unavailable or corrupt | Caught, logged to console, app starts with an empty pile. Never a blank page. |
| Window resized | Scene canvas and pond bounds recompute; ducks outside the new water are nudged back in. |
| Tab backgrounded | The frame loop is driven by `requestAnimationFrame`, so it pauses on its own. |

## Open items

- **The gentleman duck's licence.** He ships as an easter egg now. Getting CazBee
  to tag the page is outstanding and owned by the repository owner. Nothing in the
  build depends on it.
- **A pixel pond tileset.** Being hunted in parallel. `js/scene.js` is built to be
  replaced. Until then the scene is procedural.

## Deployment

GitHub Pages from the repository root on the default branch, matching the Task
Wheel. No workflow file needed beyond enabling Pages.
