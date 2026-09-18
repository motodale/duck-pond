// Duck Pond — task state. No DOM references live in this file. That is what
// makes it testable, and it is a hard rule.

const STORAGE_KEY = 'duckpond';
const MAX_TASK_LEN = 100;
const CAPACITY_MIN = 4;
const CAPACITY_MAX = 20;

const DEFAULTS = { capacity: 12, onDismiss: 'done', volume: 0.7 };
const SAVED_FIELDS = ['tasks', 'capacity', 'onDismiss', 'volume'];

// crypto.randomUUID needs a secure context. file:// qualifies in current
// browsers, but the fallback costs one line and removes a whole failure mode.
function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clean(text) {
  return String(text == null ? '' : text).trim().slice(0, MAX_TASK_LEN);
}

// Fisher-Yates. `rand` is injected so tests can make shuffles reproducible.
function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

class DuckPondState {
  constructor(opts) {
    const o = opts || {};
    this.storage = o.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.rand = o.rand || Math.random;

    this.tasks = [];
    this.capacity = DEFAULTS.capacity;
    this.onDismiss = DEFAULTS.onDismiss;   // 'done' | 'pile'
    this.volume = DEFAULTS.volume;

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

  addTask(text) {
    const clean_ = clean(text);
    if (!clean_) return null;
    const task = { id: uid(), text: clean_, state: 'pile', doneAt: null };
    this.tasks.push(task);
    this.shufflePile();
    this.notify();
    return task;
  }

  editTask(id, text) {
    const t = this.byId(id);
    const clean_ = clean(text);
    if (!t || !clean_) return;
    t.text = clean_;
    this.notify();
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    if (this.heldId === id) this.heldId = null;
    this.notify();
  }

  // Moves the first pile task into the pond. The caller spawns the duck.
  takeFromPile() {
    const t = this.tasks.find(x => x.state === 'pile');
    if (!t) return null;
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
      this.shufflePile();
    }
    if (this.heldId === id) this.heldId = null;
    this.notify();
  }

  // Shuffles only the pile entries, leaving pond and done tasks at their
  // existing indices. Pile order IS array order.
  shufflePile() {
    const idx = [];
    for (let i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].state === 'pile') idx.push(i);
    }
    const picked = idx.map(i => this.tasks[i]);
    shuffleInPlace(picked, this.rand);
    idx.forEach((i, k) => { this.tasks[i] = picked[k]; });
  }

  // ---- settings ----

  setCapacity(n) {
    const v = parseInt(n, 10);
    this.capacity = Math.max(CAPACITY_MIN, Math.min(CAPACITY_MAX, isNaN(v) ? DEFAULTS.capacity : v));
    this.notify();
  }

  setOnDismiss(mode) {
    this.onDismiss = mode === 'pile' ? 'pile' : 'done';
    this.notify();
  }

  setVolume(v) {
    const n = parseFloat(v);
    this.volume = Math.max(0, Math.min(1, isNaN(n) ? DEFAULTS.volume : n));
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
    if (typeof saved.volume === 'number') this.volume = Math.max(0, Math.min(1, saved.volume));

    // Stored tasks can be stale or hand-edited, so backfill anything missing
    // and drop anything that is not shaped like a task.
    if (Array.isArray(saved.tasks)) {
      this.tasks = saved.tasks
        .filter(t => t && typeof t === 'object')
        .map(t => ({
          id: t.id || uid(),
          text: clean(t.text) || 'Task',
          state: ['pile', 'pond', 'done'].indexOf(t.state) >= 0 ? t.state : 'pile',
          doneAt: typeof t.doneAt === 'number' ? t.doneAt : null
        }));
    }
  }

  // load() must not write back to storage while reading it.
  setCapacityQuiet(n) {
    const v = parseInt(n, 10);
    this.capacity = Math.max(CAPACITY_MIN, Math.min(CAPACITY_MAX, isNaN(v) ? DEFAULTS.capacity : v));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DuckPondState, shuffleInPlace, MAX_TASK_LEN, CAPACITY_MIN, CAPACITY_MAX };
}
if (typeof window !== 'undefined') {
  window.DuckPondState = DuckPondState;
}
