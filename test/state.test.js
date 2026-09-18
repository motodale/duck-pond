const { test } = require('node:test');
const assert = require('node:assert');
const { DuckPondState, shuffleInPlace } = require('../js/state.js');

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

test('shuffling preserves the exact set of tasks', () => {
  const s = fresh();
  for (let i = 0; i < 20; i++) s.addTask('t' + i);
  const before = s.tasks.map(t => t.id).sort();
  s.shufflePile();
  const after = s.tasks.map(t => t.id).sort();
  assert.deepStrictEqual(after, before);
});

test('shuffling the pile leaves pond and done tasks in place', () => {
  const s = fresh();
  for (let i = 0; i < 8; i++) s.addTask('t' + i);
  const pondTask = s.takeFromPile();
  const pondIndex = s.tasks.indexOf(pondTask);
  s.shufflePile();
  assert.strictEqual(s.tasks.indexOf(pondTask), pondIndex);
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

test('shuffleInPlace keeps every element', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  shuffleInPlace(arr, seeded(9));
  assert.deepStrictEqual(arr.slice().sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8]);
});
