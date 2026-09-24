// Duck Pond — task state. No DOM references live in this file. That is what
// makes it testable, and it is a hard rule.

const STORAGE_KEY = 'duckpond';
const MAX_TASK_LEN = 100;
const CAPACITY_MIN = 4;
const CAPACITY_MAX = 20;

const WEIGHT_MIN = 1, WEIGHT_MAX = 10;
// Adding "200 dishes" makes 200 tasks, so this cap is what stands between a
// stray keypress and a browser hang plus a blown localStorage quota.
const COUNT_MAX = 500;

// Ambience defaults lower than the quacks: it is a bed that runs constantly,
// and plenty of people would rather it stayed quiet or off.
const DEFAULTS = { capacity: 12, onDismiss: 'done', volume: 0.7, ambience: 0.35 };
const SAVED_FIELDS = ['tasks', 'capacity', 'onDismiss', 'volume', 'ambience'];

// crypto.randomUUID needs a secure context. file:// qualifies in current
// browsers, but the fallback costs one line and removes a whole failure mode.
function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clean(text) {
  return String(text == null ? '' : text).trim().slice(0, MAX_TASK_LEN);
}

function clampNum(v, min, max, dflt) {
  const n = parseFloat(v);
  return Math.max(min, Math.min(max, isNaN(n) ? dflt : n));
}

// Rounded because a duck count has to be a whole number; the rest are fractions.
function clampCapacity(n) {
  return Math.round(clampNum(n, CAPACITY_MIN, CAPACITY_MAX, DEFAULTS.capacity));
}

function clampVolume(v) { return clampNum(v, 0, 1, DEFAULTS.volume); }
function clampAmbience(v) { return clampNum(v, 0, 1, DEFAULTS.ambience); }
function clampWeight(v) { return clampNum(v, WEIGHT_MIN, WEIGHT_MAX, 1); }
function clampCount(v) { return Math.round(clampNum(v, 1, COUNT_MAX, 1)); }

class DuckPondState {
  constructor(opts) {
    const o = opts || {};
    this.storage = o.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.rand = o.rand || Math.random;

    this.tasks = [];
    this.capacity = DEFAULTS.capacity;
    this.onDismiss = DEFAULTS.onDismiss;   // 'done' | 'pile'
    this.volume = DEFAULTS.volume;
    this.ambience = DEFAULTS.ambience;

    // The task whose card is currently open. Its state stays 'pond' so the
    // pond does not refill underneath an open card.
    this.heldId = null;

    this.onChange = null;
    this.load();
  }

  notify() {
    this.save();
    if (this.onChange) this.onChange(this);
  }

  // ---- queries ----

  tasksIn(state) { return this.tasks.filter(t => t.state === state); }
  pondCount() { return this.tasksIn('pond').length; }
  byId(id) { return this.tasks.find(t => t.id === id) || null; }
  get canRefill() { return this.heldId === null && this.pondCount() < this.capacity; }

  // Each waiting task's chance of being the next one drawn off the pile into
  // the pond, keyed by id. This is where weight acts. A task already in the
  // pond is absent rather than zero: it is not waiting to be drawn, it is
  // there. Done tasks are absent too.
  drawChances() {
    const pile = this.tasksIn('pile');
    const total = pile.reduce((sum, t) => sum + t.weight, 0);
    const out = {};
    pile.forEach(t => { out[t.id] = total > 0 ? t.weight / total : 0; });
    return out;
  }

  // Each task's chance of being the next one revealed, keyed by id. You reveal
  // a task by clicking a duck, so it is an even split across the pond: weight
  // decides which task gets drawn INTO the pond, not which duck you pick out of
  // it. A waiting task cannot be next — a pond slot has to free up first — so
  // it is a genuine 0. Done tasks are absent.
  revealChances() {
    const inPond = this.pondCount();
    const out = {};
    this.tasks.forEach(t => {
      if (t.state === 'done') return;
      out[t.id] = t.state === 'pond' && inPond ? 1 / inPond : 0;
    });
    return out;
  }

  // ---- mutations ----

  // count makes that many independent tasks with the same text: 200 of a thing
  // is 200 tasks, each with its own duck, its own row and its own line in the
  // history. Weight is not set here — new tasks start at 1 and are tuned in
  // the drawer. Returns the last task made, which for a normal add is the one.
  addTask(text, count) {
    const clean_ = clean(text);
    if (!clean_) return null;
    const n = clampCount(count);
    let last = null;
    for (let i = 0; i < n; i++) {
      last = { id: uid(), text: clean_, state: 'pile', doneAt: null, weight: clampWeight() };
      this.tasks.push(last);
    }
    this.notify();                      // once, not once per copy
    return last;
  }

  setWeight(id, w) {
    const t = this.byId(id);
    if (!t) return;
    t.weight = clampWeight(w);
    this.notify();
  }

  editTask(id, text) {
    const t = this.byId(id);
    const clean_ = clean(text);
    if (!t || !clean_) return;
    t.text = clean_;
    this.notify();
  }

  // Drops the Done history. Only 'done' tasks go — anything in the pond or the
  // pile is still in play and stays.
  clearHistory() {
    this.tasks = this.tasks.filter(t => t.state !== 'done');
    this.notify();
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    if (this.heldId === id) this.heldId = null;
    this.notify();
  }

  // Moves one pile task into the pond. The caller spawns the duck.
  // Weighted draw on each task's weight. This is the only randomness in the
  // pile, so array order carries no meaning any more.
  takeFromPile() {
    const pile = this.tasksIn('pile');
    if (!pile.length) return null;
    let r = this.rand() * pile.reduce((sum, t) => sum + t.weight, 0);
    // The fallback covers float drift landing r past the last boundary.
    const t = pile.find(x => (r -= x.weight) < 0) || pile[pile.length - 1];
    t.state = 'pond';
    this.notify();
    return t;
  }

  resolve(id, done) {
    const t = this.byId(id);
    if (!t) return;
    if (done) {
      t.state = 'done';
      t.doneAt = Date.now();
    } else {
      t.state = 'pile';
      t.doneAt = null;
    }
    if (this.heldId === id) this.heldId = null;
    this.notify();
  }

  // ---- settings ----

  setCapacity(n) {
    this.capacity = clampCapacity(n);
    this.notify();
  }

  setOnDismiss(mode) {
    this.onDismiss = mode === 'pile' ? 'pile' : 'done';
    this.notify();
  }

  setVolume(v) {
    this.volume = clampVolume(v);
    this.notify();
  }

  setAmbience(v) {
    this.ambience = clampAmbience(v);
    this.notify();
  }

  // ---- persistence ----

  save() {
    if (!this.storage) return;
    const blob = {};
    for (const f of SAVED_FIELDS) blob[f] = this[f];
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(blob));
    } catch (e) {
      console.error('Duck Pond: could not save to localStorage', e);
    }
  }

  load() {
    if (!this.storage) return;
    let saved = null;
    try {
      saved = JSON.parse(this.storage.getItem(STORAGE_KEY));
    } catch (e) {
      console.error('Duck Pond: could not read localStorage, starting empty', e);
      return;
    }
    if (!saved || typeof saved !== 'object') return;

    if (typeof saved.capacity === 'number') this.setCapacityQuiet(saved.capacity);
    if (saved.onDismiss) this.onDismiss = saved.onDismiss === 'pile' ? 'pile' : 'done';
    if (typeof saved.volume === 'number') this.volume = clampVolume(saved.volume);
    if (typeof saved.ambience === 'number') this.ambience = clampAmbience(saved.ambience);

    // Stored tasks can be stale or hand-edited, so backfill anything missing
    // and drop anything that is not shaped like a task.
    if (Array.isArray(saved.tasks)) {
      this.tasks = saved.tasks
        .filter(t => t && typeof t === 'object')
        .map(t => ({
          id: t.id || uid(),
          text: clean(t.text) || 'Task',
          state: ['pile', 'pond', 'done'].indexOf(t.state) >= 0 ? t.state : 'pile',
          doneAt: typeof t.doneAt === 'number' ? t.doneAt : null,
          weight: clampWeight(t.weight)
        }));
    }
  }

  // load() must not write back to storage while reading it.
  setCapacityQuiet(n) {
    this.capacity = clampCapacity(n);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DuckPondState, MAX_TASK_LEN, CAPACITY_MIN, CAPACITY_MAX,
    WEIGHT_MIN, WEIGHT_MAX, COUNT_MAX
  };
}
if (typeof window !== 'undefined') {
  window.DuckPondState = DuckPondState;
}
