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

  count() { return this.ducks.filter(d => d.mode === 'swim').length; },
  byTaskId(id) { return this.ducks.find(d => d.taskId === id) || null; },

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
      d.tx = w.cx + w.rx * (0.15 + this.rand() * 0.5);
      d.ty = d.y + (this.rand() - 0.5) * 30;
      d.anim = 'waddle';
    } else {
      const ang = this.rand() * Math.PI * 2, rad = Math.sqrt(this.rand()) * 0.85;
      d.x = w.cx + Math.cos(ang) * w.rx * rad;
      d.y = w.cy + Math.sin(ang) * w.ry * rad;
    }

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'duck';
    el.setAttribute('aria-label', 'Duck hiding a task');   // never the task text
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

  // A floating duck is cropped at the waterline so its feet do not show.
  // A duck on land is not.
  applyCrop(d, sc) {
    const S = window.Sprites;
    const floating = d.mode === 'swim';
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
    window.scene.ripple(d.x, d.y + 12, { r: 3, alpha: 0.7, grow: 0.5, fade: 0.016, width: 2 });
    if (window.audio) window.audio.quack();
    if (this.onCatch) this.onCatch(task);
  },

  // Called by app.js once the task is resolved, and by a delete from the drawer.
  removeByTaskId(id, how) {
    const d = this.byTaskId(id);
    if (!d) return;
    this.beginExit(d, how);
  },

  beginExit(d, how) {
    d.mode = 'exit';
    d.exit = how || ['waddle', 'dive', 'fly'][Math.floor(this.rand() * 3)];
    d.t = 0;
    d.el.disabled = true;
    if (d.exit === 'waddle') { d.anim = 'hurry'; this.applyCrop(d, window.Sprites.scale()); }
  },

  release() { this.ducks.forEach(o => { if (o.mode === 'swim') o.el.disabled = false; }); },

  // ---- the frame loop ----

  start() {
    if (this.running) return;
    this.running = true;
    const step = t => { this.frame(t); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },

  resize() { window.scene.resize(); },

  frame(t) {
    const S = window.Sprites, sc = S.scale();
    const dt = this.last ? Math.min(64, t - this.last) : 16;
    this.last = t;

    window.scene.ambient(this.rand);

    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i];
      d.t += dt;

      if (d.mode === 'swim') this.stepSwim(d, i, dt);
      else if (d.mode === 'enter') this.stepEnter(d, sc);
      else if (d.mode === 'quack') this.stepQuack(d);
      else if (d.mode === 'exit') { if (this.stepExit(d, sc)) { d.el.remove(); this.ducks.splice(i, 1); continue; } }

      this.stepFrame(d, dt);
      this.render(d, sc, t);
    }

    window.scene.draw();
  },

  stepSwim(d, i, dt) {
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
    if (window.scene.contains(nx, d.y)) d.x = nx; else d.vx = -d.vx;
    if (window.scene.contains(d.x, ny)) d.y = ny; else d.vy = -d.vy;

    if (this.rand() < 0.07) {
      window.scene.ripple(d.x - Math.sign(d.vx) * 12, d.y + 12,
                          { r: 2, alpha: 0.26, grow: 0.2, fade: 0.0075 });
    }
  },

  stepEnter(d, sc) {
    const p = Math.min(1, d.t / (this.reduced ? 300 : 1500));
    d.x = d.sx + (d.tx - d.sx) * p;
    d.y = d.sy + (d.ty - d.sy) * p;
    d.vx = -1;                                   // facing left as it walks in
    if (p >= 1) {
      d.mode = 'swim';
      d.anim = 'swim';
      d.vx = -(0.15 + this.rand() * 0.2);
      this.applyCrop(d, sc);
      if (!this.state.heldId) d.el.disabled = false;
      window.scene.ripple(d.x, d.y + 12, { r: 3, alpha: 0.5, grow: 0.3, fade: 0.012, width: 1.5 });
    }
  },

  stepQuack(d) {
    const S = window.Sprites;
    const dur = (S.frameCount(d.skin, 'quack') / S.FPS) * 1000;
    if (d.t >= dur) this.beginExit(d, null);
  },

  // Returns true when the duck is finished and should be removed.
  stepExit(d, sc) {
    if (this.reduced) {
      d.el.style.opacity = String(Math.max(0, 1 - d.t / 300));
      return d.t >= 300;
    }
    if (d.exit === 'waddle') {
      d.x += (-(window.Sprites.CELL * sc) - d.x) * 0.028;
      d.vx = -1;
      if (d.x < 120) d.el.style.opacity = String(Math.max(0, (d.x + 40) / 160));
      return d.x < -(window.Sprites.CELL * sc);
    }
    if (d.exit === 'dive') {
      const q = Math.min(1, d.t / 680);
      d.spin = q * 155; d.shrink = 1 - q * 0.8;
      d.el.style.opacity = String(1 - q);
      if (d.t % 100 < 20) window.scene.ripple(d.x, d.y + 10, { r: 3 + q * 12, alpha: 0.34, grow: 0.3, fade: 0.012 });
      if (q >= 1) window.scene.ripple(d.x, d.y + 10, { r: 6, alpha: 0.62, grow: 0.45, fade: 0.013, width: 2 });
      return q >= 1;
    }
    const q = Math.min(1, d.t / 1000);          // fly
    d.x -= 1.9; d.y -= 2.6 + q * 2.4;
    d.vx = -1;                                  // flying left, so face left
    d.spin = -q * 20; d.shrink = 1 - q * 0.32;
    d.el.style.opacity = String(1 - q * 0.9);
    return q >= 1;
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
    if (d.spin) tf += ' rotate(' + d.spin.toFixed(1) + 'deg)';
    if (d.shrink) tf += ' scale(' + d.shrink.toFixed(3) + ')';
    if (d.vx < 0) tf += ' scaleX(-1)';          // sheets face right
    d.el.style.transform = tf;
    d.el.style.zIndex = String(Math.round(d.y));   // depth sort
  }
};

window.pond = pond;
