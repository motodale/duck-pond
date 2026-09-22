const { test } = require('node:test');
const assert = require('node:assert');
const { DuckPondState } = require('../js/state.js');

function memStorage() {
  let store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _dump: () => store
  };
}

// Deterministic "random" so shuffles are reproducible in tests.
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

function fresh() {
  return new DuckPondState({ storage: memStorage(), rand: seeded(1) });
}

test('addTask puts the task in the pile', () => {
  const s = fresh();
  s.addTask('wash the dishes');
  assert.strictEqual(s.tasks.length, 1);
  assert.strictEqual(s.tasks[0].state, 'pile');
  assert.strictEqual(s.tasks[0].text, 'wash the dishes');
});

test('task text is trimmed and capped at 100 characters', () => {
  const s = fresh();
  s.addTask('   padded   ');
  assert.strictEqual(s.tasks[0].text, 'padded');
  s.addTask('x'.repeat(250));
  assert.strictEqual(s.tasks[1].text.length, 100);
});

test('empty or whitespace-only tasks are rejected', () => {
  const s = fresh();
  assert.strictEqual(s.addTask('   '), null);
  assert.strictEqual(s.addTask(''), null);
  assert.strictEqual(s.tasks.length, 0);
});

test('takeFromPile moves one task to the pond and returns it', () => {
  const s = fresh();
  s.addTask('a');
  const t = s.takeFromPile();
  assert.strictEqual(t.state, 'pond');
  assert.strictEqual(s.pondCount(), 1);
  assert.strictEqual(s.tasksIn('pile').length, 0);
});

test('takeFromPile returns null when the pile is empty', () => {
  const s = fresh();
  assert.strictEqual(s.takeFromPile(), null);
});

test('resolving as done stamps doneAt and moves the task out of the pond', () => {
  const s = fresh();
  s.addTask('a');
  const t = s.takeFromPile();
  s.resolve(t.id, true);
  assert.strictEqual(t.state, 'done');
  assert.ok(t.doneAt > 0);
  assert.strictEqual(s.pondCount(), 0);
});

test('resolving as not-now returns the task to the pile', () => {
  const s = fresh();
  s.addTask('a');
  const t = s.takeFromPile();
  s.resolve(t.id, false);
  assert.strictEqual(t.state, 'pile');
  assert.strictEqual(t.doneAt, null);
  assert.strictEqual(s.tasksIn('pile').length, 1);
});

test('lowering capacity removes no tasks', () => {
  const s = fresh();
  for (let i = 0; i < 6; i++) s.addTask('t' + i);
  for (let i = 0; i < 6; i++) s.takeFromPile();
  s.setCapacity(4);
  assert.strictEqual(s.tasks.length, 6);
  assert.strictEqual(s.pondCount(), 6);
});

test('capacity is clamped to the 4..20 range', () => {
  const s = fresh();
  s.setCapacity(1);  assert.strictEqual(s.capacity, 4);
  s.setCapacity(99); assert.strictEqual(s.capacity, 20);
});

test('a new task defaults to weight 1 and multiplier 1', () => {
  const s = fresh();
  const t = s.addTask('plain');
  assert.strictEqual(t.weight, 1);
  assert.strictEqual(t.multiplier, 1);
});

test('weight and multiplier are clamped to their ranges', () => {
  const s = fresh();
  const t = s.addTask('x', 999, 0);
  assert.strictEqual(t.weight, 10);
  assert.strictEqual(t.multiplier, 0.5);
  s.setWeight(t.id, -4);
  s.setMultiplier(t.id, 'nonsense');
  assert.strictEqual(t.weight, 1);
  assert.strictEqual(t.multiplier, 1);
});

test('takeFromPile draws in proportion to weight x multiplier', () => {
  // heavy carries 10 x 5 = 50 of the 51 total, so a uniform stream of draws
  // must land on it overwhelmingly more often than the 1 x 1 task.
  let counts = { heavy: 0, light: 0 };
  for (let i = 0; i < 400; i++) {
    const s = new DuckPondState({ storage: memStorage(), rand: seeded(i + 1) });
    s.addTask('light');
    s.addTask('heavy', 10, 5);
    counts[s.takeFromPile().text]++;
  }
  assert.ok(counts.heavy > counts.light * 10,
    'heavy ' + counts.heavy + ' vs light ' + counts.light);
  assert.ok(counts.light > 0, 'a weight-1 task must still be reachable');
});

test('takeFromPile never returns a pond or done task', () => {
  const s = fresh();
  for (let i = 0; i < 8; i++) s.addTask('t' + i);
  const drawn = [];
  for (let i = 0; i < 8; i++) drawn.push(s.takeFromPile().id);
  assert.strictEqual(new Set(drawn).size, 8);
  assert.strictEqual(s.takeFromPile(), null);
});

test('a save and load round-trip preserves tasks and settings', () => {
  const storage = memStorage();
  const a = new DuckPondState({ storage, rand: seeded(1) });
  a.addTask('keep me');
  a.takeFromPile();
  a.setCapacity(7);
  a.setVolume(0.25);
  a.setOnDismiss('pile');

  const b = new DuckPondState({ storage, rand: seeded(1) });
  assert.strictEqual(b.tasks.length, 1);
  assert.strictEqual(b.tasks[0].text, 'keep me');
  assert.strictEqual(b.tasks[0].state, 'pond');
  assert.strictEqual(b.capacity, 7);
  assert.strictEqual(b.volume, 0.25);
  assert.strictEqual(b.onDismiss, 'pile');
});

test('corrupt storage does not throw and yields an empty pile', () => {
  const storage = memStorage();
  storage.setItem('duckpond', '{not json at all');
  const oldError = console.error;
  try {
    console.error = () => {};
    const s = new DuckPondState({ storage, rand: seeded(1) });
    assert.deepStrictEqual(s.tasks, []);
  } finally {
    console.error = oldError;
  }
});

test('clearHistory drops done tasks and keeps everything still in play', () => {
  const s = fresh();
  s.addTask('finished');
  s.addTask('waiting');
  const t = s.takeFromPile();
  s.resolve(t.id, true);
  assert.strictEqual(s.tasksIn('done').length, 1);

  s.clearHistory();
  assert.strictEqual(s.tasksIn('done').length, 0);
  assert.strictEqual(s.tasks.length, 1);
  assert.strictEqual(s.tasks[0].id, s.tasks.find(x => x.id !== t.id).id);
});

test('a cleared history stays cleared after a reload', () => {
  const storage = memStorage();
  const a = new DuckPondState({ storage, rand: seeded(1) });
  a.addTask('finished');
  a.resolve(a.takeFromPile().id, true);
  a.clearHistory();
  const b = new DuckPondState({ storage, rand: seeded(1) });
  assert.strictEqual(b.tasks.length, 0);
});

test('deleteTask removes the task entirely', () => {
  const s = fresh();
  const t = s.addTask('a');
  s.deleteTask(t.id);
  assert.strictEqual(s.tasks.length, 0);
});

test('editTask changes text and applies the same trim and cap', () => {
  const s = fresh();
  const t = s.addTask('a');
  s.editTask(t.id, '  b'.padEnd(200, 'b'));
  assert.strictEqual(s.tasks[0].text.length, 100);
  assert.ok(!s.tasks[0].text.startsWith(' '));
});

test('a brand-new state starts with the documented defaults', () => {
  const s = fresh();
  assert.strictEqual(s.capacity, 12);
  assert.strictEqual(s.onDismiss, 'done');
  assert.strictEqual(s.volume, 0.7);
  assert.strictEqual(s.ambience, 0.35);
});

test('ambience volume is independent of quack volume, clamped, and saved', () => {
  const storage = memStorage();
  const a = new DuckPondState({ storage, rand: seeded(1) });
  a.setAmbience(0);
  a.setVolume(0.9);
  assert.strictEqual(a.ambience, 0);
  assert.strictEqual(a.volume, 0.9);

  a.setAmbience(4);
  assert.strictEqual(a.ambience, 1);

  const b = new DuckPondState({ storage, rand: seeded(1) });
  assert.strictEqual(b.ambience, 1);
  assert.strictEqual(b.volume, 0.9);
});

test('a save from before ambience existed loads at the default', () => {
  const storage = memStorage();
  storage.setItem('duckpond', JSON.stringify({ tasks: [], volume: 0.9 }));
  const s = new DuckPondState({ storage, rand: seeded(1) });
  assert.strictEqual(s.ambience, 0.35);
});

test('weight and multiplier survive a save and load round-trip', () => {
  const storage = memStorage();
  const a = new DuckPondState({ storage, rand: seeded(1) });
  a.addTask('weighted', 7, 2.5);
  const b = new DuckPondState({ storage, rand: seeded(1) });
  assert.strictEqual(b.tasks[0].weight, 7);
  assert.strictEqual(b.tasks[0].multiplier, 2.5);
});

test('tasks saved before weight existed load with the defaults', () => {
  const storage = memStorage();
  storage.setItem('duckpond', JSON.stringify({
    tasks: [{ id: 'a', text: 'old', state: 'pile', doneAt: null }]
  }));
  const s = new DuckPondState({ storage, rand: seeded(1) });
  assert.strictEqual(s.tasks[0].weight, 1);
  assert.strictEqual(s.tasks[0].multiplier, 1);
});
