// Duck Pond — task state. No DOM references live in this file. That is what
// makes it testable, and it is a hard rule.

const STORAGE_KEY = 'duckpond';
const MAX_TASK_LEN = 100;
const CAPACITY_MIN = 4;
const CAPACITY_MAX = 20;

const WEIGHT_MIN = 1, WEIGHT_MAX = 10;
const MULT_MIN = 0.5, MULT_MAX = 5;

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

function clampCapacity(n) {
  const v = parseInt(n, 10);
  return Math.max(CAPACITY_MIN, Math.min(CAPACITY_MAX, isNaN(v) ? DEFAULTS.capacity : v));
}

function clampNum(v, min, max, dflt) {
  const n = parseFloat(v);
  return Math.max(min, Math.min(max, isNaN(n) ? dflt : n));
}

function clampVolume(v) { return clampNum(v, 0, 1, DEFAULTS.volume); }
function clampAmbience(v) { return clampNum(v, 0, 1, DEFAULTS.ambience); }
function clampWeight(v) { return clampNum(v, WEIGHT_MIN, WEIGHT_MAX, 1); }
function clampMult(v) { return clampNum(v, MULT_MIN, MULT_MAX, 1); }

// A pile task's odds of being drawn next.
function odds(t) { return t.weight * t.multiplier; }

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

  // ---- mutations ----

  addTask(text, weight, multiplier) {
    const clean_ = clean(text);
    if (!clean_) return null;
    const task = {
      id: uid(), text: clean_, state: 'pile', doneAt: null,
      weight: clampWeight(weight), multiplier: clampMult(multiplier)
    };
    this.tasks.push(task);
    this.notify();
    return task;
  }

  setWeight(id, w) {
    const t = this.byId(id);
    if (!t) return;
    t.weight = clampWeight(w);
    this.notify();
  }

  setMultiplier(id, m) {
    const t = this.byId(id);
    if (!t) return;
    t.multiplier = clampMult(m);
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
  // Weighted draw: a task's odds are weight x multiplier. This is the only
  // randomness in the pile, so array order carries no meaning any more.
  takeFromPile() {
    const pile = this.tasksIn('pile');
    if (!pile.length) return null;
    let r = this.rand() * pile.reduce((sum, t) => sum + odds(t), 0);
    // The fallback covers float drift landing r past the last boundary.
    const t = pile.find(x => (r -= odds(x)) < 0) || pile[pile.length - 1];
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
          weight: clampWeight(t.weight),
          multiplier: clampMult(t.multiplier)
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
    WEIGHT_MIN, WEIGHT_MAX, MULT_MIN, MULT_MAX
  };
}
if (typeof window !== 'undefined') {
  window.DuckPondState = DuckPondState;
}
