// Duck Pond — the ducks. Each duck is a real <button> so keyboard access and
// hit targets come free; only its position is driven by the frame loop.
//
// The sprites face right only, and no up or down view can be derived from them.
// So movement is horizontally dominant: ducks drift left and right and flip to
// face their heading, with a gentle vertical wander that never dominates.

const SPEED_X = 0.45;          // css px per frame, max
const SPEED_Y = 0.14;
const WANDER_X = 0.020;
const WANDER_Y = 0.010;
const MIN_DRIFT = 0.05;        // stops a duck parking dead still
const SEPARATION = 62;         // css px

// Waddling off is two phases. The duck paddles to the bank, then walks.
// WADDLE_STEP is sheet pixels covered per animation frame, so the walk speed is
// derived from the sheet's own cadence (FPS x scale) rather than set by eye —
// that is what stops the feet skating. Raise it if the walk looks like a moonwalk,
// lower it if the duck outruns its own legs.
const WADDLE_STEP = 4;
const WAKE_BACK = 4;           // sheet px behind a swimming duck for its wake
// Paddling to the bank runs at a speed, not over a fixed duration: a duck
// caught on the far side has four times as far to go as one already by the
// left bank, and a shared duration made the far one shoot across the pond.
// The cap keeps that worst case from becoming a long wait.
const SHORE_SPEED = 170;       // css px per second
const SHORE_MAX_MS = 2600;
const WADDLE_MAX_MS = 8000;    // leak guard only; the walk ends at the page edge

const pond = {
  container: null, state: null, onCatch: null,
  ducks: [], rand: Math.random, reduced: false,
  last: 0, running: false,

  init(opts) {
    this.container = opts.container;
    this.state = opts.state;
    this.onCatch = opts.onCatch;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scene.setReducedMotion(this.reduced);
  },

  // Skips a duck mid-exit: it can share taskId with a freshly-spawned
  // replacement for up to ~2.4s (quack, then exit), and callers here want the
  // live duck, not the one on its way out.
  byTaskId(id) { return this.ducks.find(d => d.taskId === id && d.mode !== 'exit') || null; },

  // ---- creating ----

  spawn(task, walkIn) {
    const S = window.Sprites, sc = S.scale(), w = window.scene.water();
    const d = {
      taskId: task.id,
      skin: S.pickSkin(this.rand),
      vx: (this.rand() < 0.5 ? -1 : 1) * (0.15 + this.rand() * 0.25),
      vy: (this.rand() - 0.5) * 0.1,
      phase: this.rand() * Math.PI * 2,
      anim: 'swim', frame: 0, frameAcc: 0,
      mode: walkIn ? 'enter' : 'swim',
      t: 0
    };

    if (walkIn) {
      // in from the right, along the shore, then into the water
      d.x = this.container.clientWidth + S.CELL * sc;
      d.y = w.cy + (this.rand() - 0.5) * w.ry * 0.8;
      d.sx = d.x; d.sy = d.y;
      const t = this.settle(w.cx + w.rx * (0.15 + this.rand() * 0.5),
                            d.y + (this.rand() - 0.5) * 30);
      d.tx = t.x; d.ty = t.y;
      d.anim = 'waddle';
    } else {
      const ang = this.rand() * Math.PI * 2, rad = Math.sqrt(this.rand()) * 0.85;
      const p = this.settle(w.cx + Math.cos(ang) * w.rx * rad,
                            w.cy + Math.sin(ang) * w.ry * rad);
      d.x = p.x; d.y = p.y;
    }

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'duck';
    el.setAttribute('aria-label', 'Duck hiding a task');   // never the task text
    // A walking-in duck cannot be caught until it reaches the water — catch()
    // rejects it anyway, but leaving it enabled put a dead focus stop/hover
    // target in the tab order for the ~1.5s of its walk-in.
    el.disabled = !!walkIn;
    const spr = document.createElement('div');
    spr.className = 'duck-spr';
    el.appendChild(spr);
    el.addEventListener('click', () => this.catch(d));
    this.container.appendChild(el);

    d.el = el; d.spr = spr;
    this.ducks.push(d);
    this.applyCrop(d, sc);
    return d;
  },

  // Would a duck centred here have its whole body over water? The pond is
  // convex, so testing the four corners of the body box covers every pixel
  // between them — 4 mask lookups instead of 400.
  onWater(x, y) {
    const S = window.Sprites, sc = S.scale(), b = S.BODY;
    const l = x - b.left * sc, r = x + b.right * sc;
    const u = y - b.up * sc, d = y + b.down * sc;
    return window.scene.isWater(l, u) && window.scene.isWater(r, u) &&
           window.scene.isWater(l, d) && window.scene.isWater(r, d);
  },

  // Pulls a point toward the middle of the pond until a duck placed there
  // fits. The ellipse gives a good first guess; this makes it exact, and it is
  // what stops a duck spawning or being nudged onto the bank, where stepSwim's
  // bounce (which only reverses velocity) would leave it stuck for good.
  settle(x, y) {
    const w = window.scene.water();
    for (let i = 0; i < 30 && !this.onWater(x, y); i++) {
      x += (w.cx - x) * 0.12;
      y += (w.cy - y) * 0.12;
    }
    return { x, y };
  },

  // Where a duck meets the water, in CSS px below its centre. render() puts the
  // element's top at d.y - CELL/2*sc and the crop makes it CELL-WATERLINE_CUT
  // tall, so the waterline is this far down. Every ripple is emitted here:
  // hardcoding a CSS-pixel offset instead put the wake ~21px above the duck at
  // desktop scale, and a different amount off again on a phone.
  waterline(sc) {
    const S = window.Sprites;
    return (S.CELL / 2 - S.WATERLINE_CUT) * sc;
  },

  // A floating duck is cropped at the waterline so its feet do not show.
  // A duck on land is not.
  applyCrop(d, sc) {
    const S = window.Sprites;
    // A duck is on land only while walking in down the bank, or waddling off
    // into the bushes. Quacking happens over water, and so does the start of an
    // exit — a leaving duck paddles before it wades, and d.feetOut marks the
    // moment it reaches the shallows and its legs come into view.
    const onLand = d.mode === 'enter' || (d.mode === 'exit' && d.feetOut);
    const floating = !onLand;
    const h = (floating ? S.CELL - S.WATERLINE_CUT : S.CELL) * sc;
    d.el.style.width = (S.CELL * sc) + 'px';
    d.el.style.height = h + 'px';
  },

  // ---- catching ----

  catch(d) {
    if (d.mode !== 'swim' || this.state.heldId) return;
    const task = this.state.byId(d.taskId);
    if (!task) return;

    this.state.heldId = task.id;
    this.ducks.forEach(o => { o.el.disabled = true; });

    d.mode = 'quack';
    d.anim = 'quack'; d.frame = 0; d.frameAcc = 0; d.t = 0;
    window.scene.ripple(d.x, d.y + this.waterline(window.Sprites.scale()),
                        { r: 3, alpha: 0.7, grow: 0.5, fade: 0.016, width: 2 });
    if (window.audio) window.audio.quack();
    if (this.onCatch) this.onCatch(task);
  },

  // Called by app.js once the task is resolved, and by a delete from the drawer.
  removeByTaskId(id) {
    const d = this.byTaskId(id);
    if (!d) return;
    this.beginExit(d);
  },

  // There is one way out: paddle to the left bank, then waddle off into the
  // bushes. Still afloat here, so it keeps the swim pose and the waterline
  // crop until it is standing on the mud — stepExit switches both over.
  beginExit(d) {
    d.mode = 'exit';
    d.t = 0;
    d.el.disabled = true;
    const p = window.scene.shorePoint(d.y);
    d.sx = d.x; d.sy = d.y;
    d.tx = p.x; d.ty = p.y;
    d.onShore = false;
    d.feetOut = false;
    d.shoreMs = Math.min(SHORE_MAX_MS,
      Math.max(400, Math.hypot(d.tx - d.x, d.ty - d.y) / SHORE_SPEED * 1000));
    d.anim = 'swim';                            // paddling, not yet walking
    d.frame = 0; d.frameAcc = 0;
  },

  release() { this.ducks.forEach(o => { if (o.mode === 'swim') o.el.disabled = false; }); },

  // ---- the frame loop ----

  start() {
    if (this.running) return;
    this.running = true;
    const step = t => { this.frame(t); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },

  resize() {
    window.scene.resize();
    // A smaller window can leave ducks off the new water.
    this.ducks.forEach(d => {
      if (d.mode === 'swim') {
        if (this.onWater(d.x, d.y)) return;
        const p = this.settle(d.x, d.y);
        d.x = p.x; d.y = p.y;
      } else if (d.mode === 'enter') {
        // An entering duck's tx/ty were aimed at the pre-resize ellipse. Left
        // alone on a shrink, it walks to a point now outside the water, flips
        // to 'swim' there, and stepSwim's bounce only reverses velocity (it
        // never steers back in) — so it can freeze on the grass for the rest
        // of the session. Re-aim the target the same way a swimming duck gets
        // nudged back in.
        if (this.onWater(d.tx, d.ty)) return;
        const t = this.settle(d.tx, d.ty);
        d.tx = t.x; d.ty = t.y;
      }
    });
    this.ducks.forEach(d => this.applyCrop(d, window.Sprites.scale()));
  },

  frame(t) {
    const S = window.Sprites, sc = S.scale();
    const dt = this.last ? Math.min(64, t - this.last) : 16;
    this.last = t;

    window.scene.ambient(this.rand);

    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i];
      d.t += dt;

      if (d.mode === 'swim') this.stepSwim(d, i, dt, sc);
      else if (d.mode === 'enter') this.stepEnter(d, sc);
      else if (d.mode === 'quack') this.stepQuack(d);
      else if (d.mode === 'exit') { if (this.stepExit(d, sc, dt)) { d.el.remove(); this.ducks.splice(i, 1); continue; } }

      this.stepFrame(d, dt);
      this.render(d, sc, t);
    }

    window.scene.draw();
  },

  stepSwim(d, i, dt, sc) {
    if (this.reduced) return;                 // ducks hold still, sprite still idles

    d.vx += (this.rand() - 0.5) * WANDER_X;
    d.vy += (this.rand() - 0.5) * WANDER_Y;

    for (let j = 0; j < this.ducks.length; j++) {
      if (j === i) continue;
      const o = this.ducks[j];
      if (o.mode !== 'swim') continue;
      const dx = d.x - o.x, dy = d.y - o.y;
      const dist = Math.hypot(dx, dy);
      if (dist < SEPARATION && dist > 0.01) {
        d.vx += (dx / dist) * 0.012;
        d.vy += (dy / dist) * 0.006;
      }
    }

    d.vx = Math.max(-SPEED_X, Math.min(SPEED_X, d.vx));
    d.vy = Math.max(-SPEED_Y, Math.min(SPEED_Y, d.vy));
    if (Math.abs(d.vx) < MIN_DRIFT) d.vx = d.vx < 0 ? -MIN_DRIFT : MIN_DRIFT;

    const nx = d.x + d.vx, ny = d.y + d.vy;
    if (this.onWater(nx, d.y)) d.x = nx; else d.vx = -d.vx;
    if (this.onWater(d.x, ny)) d.y = ny; else d.vy = -d.vy;

    if (this.rand() < 0.07) {
      window.scene.ripple(d.x - Math.sign(d.vx) * WAKE_BACK * sc,
                          d.y + this.waterline(sc),
                          { r: 2, alpha: 0.26, grow: 0.2, fade: 0.0075 });
    }
  },

  stepEnter(d, sc) {
    const p = Math.min(1, d.t / (this.reduced ? 300 : 1500));
    if (this.reduced) {
      // No slide across the pond: the duck appears where it is going and
      // fades in, matching how exits behave under reduced motion.
      d.x = d.tx; d.y = d.ty;
      d.el.style.opacity = String(p);
    } else {
      d.x = d.sx + (d.tx - d.sx) * p;
      d.y = d.sy + (d.ty - d.sy) * p;
    }
    d.vx = -1;                                   // facing left as it walks in
    if (p >= 1) {
      d.el.style.opacity = '1';
      d.mode = 'swim';
      d.anim = 'swim';
      d.vx = -(0.15 + this.rand() * 0.2);
      this.applyCrop(d, sc);
      if (!this.state.heldId) d.el.disabled = false;
      window.scene.ripple(d.x, d.y + this.waterline(sc),
                          { r: 3, alpha: 0.5, grow: 0.3, fade: 0.012, width: 1.5 });
    }
  },

  stepQuack(d) {
    const S = window.Sprites;
    const dur = (S.frameCount(d.skin, 'quack') / S.FPS) * 1000;
    if (d.t >= dur) this.beginExit(d);
  },

  // Returns true when the duck is finished and should be removed.
  stepExit(d, sc, dt) {
    if (this.reduced) {
      d.el.style.opacity = String(Math.max(0, 1 - d.t / 300));
      return d.t >= 300;
    }
    d.vx = -1;                                  // leaving left, in both phases
    if (!d.onShore) {
      // Phase 1: paddle to the bank. A straight lerp, the same shape stepEnter
      // uses, so it lands exactly on the mud instead of creeping up on it
      // asymptotically. d.shoreMs came from the distance, so the speed is the
      // same wherever the duck was caught.
      const p = Math.min(1, d.t / d.shoreMs);
      d.x = d.sx + (d.tx - d.sx) * p;
      d.y = d.sy + (d.ty - d.sy) * p;
      // The legs start, and the feet come into view, the moment the body
      // leaves open water — which the mask tells us exactly. It is wading the
      // last stretch by then, so the feet belong on show. Waiting for the shore
      // point instead left the walk cycle to begin in the last frames of a
      // paddle that can run 2.6s.
      if (!d.feetOut && (p >= 1 || !this.onWater(d.x, d.y))) {
        d.feetOut = true;
        d.anim = 'hurry';
        d.frame = 0; d.frameAcc = 0;
        this.applyCrop(d, sc);
      }
      if (p < 1) return false;
      d.onShore = true;
      d.t = 0;
      return false;
    }
    // Phase 2: walk. One animation frame carries the duck WADDLE_STEP sheet
    // pixels, so the ground speed and the leg animation agree.
    d.x -= WADDLE_STEP * window.Sprites.FPS * sc * (dt / 1000);
    // No fade: it stays fully visible the whole way out, and #stage's overflow
    // clips it at the page edge. Ending on the position is safe here because
    // the speed is constant, so the edge always arrives. It was the old easing,
    // which approached its target asymptotically and never reached it, that
    // made a position test leak ducks. The time cap is a guard, not the path.
    return d.x < -(window.Sprites.CELL * sc) || d.t >= WADDLE_MAX_MS;
  },

  stepFrame(d, dt) {
    const S = window.Sprites;
    d.frameAcc += dt;
    const per = 1000 / S.FPS;
    while (d.frameAcc >= per) {
      d.frameAcc -= per;
      d.frame = (d.frame + 1) % S.frameCount(d.skin, d.anim);
    }
  },

  render(d, sc, t) {
    const S = window.Sprites;
    S.style(d.spr, d.skin, d.anim, d.frame, sc);

    const bob = (d.mode === 'swim' && !this.reduced)
      ? Math.sin(t / 430 + d.phase) * 2.5 : 0;
    const half = (S.CELL * sc) / 2;
    let tf = 'translate(' + Math.round(d.x - half) + 'px,' + Math.round(d.y - half + bob) + 'px)';
    if (d.vx < 0) tf += ' scaleX(-1)';          // sheets face right
    d.el.style.transform = tf;
    d.el.style.zIndex = String(Math.round(d.y));   // depth sort
  }
};

window.pond = pond;
