// Duck Pond — page wiring: bootstrap, add-task, drawer, reveal card, settings, history.

document.addEventListener('DOMContentLoaded', () => {
  window.Sprites.preload().then(() => {
    const state = new window.DuckPondState({});
    const ducksEl = document.getElementById('ducks');
    const card = document.getElementById('revealCard');
    const cardText = document.getElementById('revealText');
    const btnDone = document.getElementById('btnDone');
    const btnNotNow = document.getElementById('btnNotNow');
    const emptyHint = document.getElementById('emptyHint');
    const creditsDialog = document.getElementById('creditsDialog');

    let refillTimer = null;

    // Walk-ins are staggered so a group does not stampede in together.
    function refill() {
      if (refillTimer) return;
      if (!state.canRefill) { updateEmptyHint(); return; }
      const task = state.takeFromPile();
      if (!task) { updateEmptyHint(); return; }
      window.pond.spawn(task, true);
      updateEmptyHint();
      refillTimer = setTimeout(() => { refillTimer = null; refill(); }, 400);
    }

    function updateEmptyHint() {
      emptyHint.hidden = state.tasks.some(t => t.state !== 'done');
    }

    function showCard(task) {
      // Unhide before setting the text: the card holds the live region, and a
      // screen reader only announces a content change while the element is
      // already in the accessibility tree. Setting text first, then unhiding,
      // means several screen readers announce nothing.
      card.hidden = false;
      cardText.textContent = task.text;
      btnDone.focus();
    }

    // resolveAs is true for done, false for back in the pile.
    function hideCard(resolveAs) {
      const id = state.heldId;
      card.hidden = true;
      if (!id) return;
      state.resolve(id, resolveAs);
      window.pond.release();
      // Focus would otherwise be lost to <body> when the card's buttons vanish.
      // Put it back on a duck rather than the add-task field: it keeps a keyboard
      // user in the pond where they were, and stops a text input summoning the
      // virtual keyboard on mobile every single time a task is resolved.
      const nextDuck = ducksEl.querySelector('.duck:not([disabled])');
      if (nextDuck) nextDuck.focus(); else addInput.focus();
      refill();
      render();
    }

    // Deleting a task whose duck is swimming sends that duck off immediately,
    // then refills the gap it leaves.
    function deleteTask(id) {
      const task = state.byId(id);
      if (!task) return;
      const wasInPond = task.state === 'pond';
      if (state.heldId === id) { card.hidden = true; window.pond.release(); }
      state.deleteTask(id);
      if (wasInPond) window.pond.removeByTaskId(id);
      refill();
      render();
    }

    btnDone.addEventListener('click', () => hideCard(true));
    btnNotNow.addEventListener('click', () => hideCard(false));

    // Dismissing without choosing follows the On dismiss setting.
    // A modal <dialog> closes itself on Escape but the key still reaches
    // document, so without this guard closing the credits would also resolve
    // whatever task the reveal card is holding.
    document.addEventListener('keydown', e => {
      if (creditsDialog.open) return;
      if (e.key === 'Escape' && !card.hidden) hideCard(state.onDismiss === 'done');
    });

    window.scene.init(document.getElementById('sceneCanvas'));
    window.pond.init({ container: ducksEl, state, onCatch: showCard });

    // Guarded as a whole block. Audio is decorative; a failed audio.js load must
    // never abort the rest of the bootstrap. Unguarded, a TypeError here would
    // stop the duck spawning, the frame loop and the resize wiring that follow.
    if (window.audio) {
      window.audio.setVolume(state.volume);
      window.audio.setAmbience(state.ambience);
      ['pointerdown', 'keydown'].forEach(ev => {
        document.addEventListener(ev, () => window.audio.unlock(), { once: true });
      });
    }

    // On load, ducks are already floating — no walk-in animation.
    // Tasks persisted as 'pond' already hold their slot, so give each one its
    // duck back BEFORE topping up from the pile. Without this they occupy
    // capacity with nothing on screen, canRefill is false forever, and the pond
    // is dead for the life of the browser profile.
    state.tasksIn('pond').forEach(t => window.pond.spawn(t, false));

    while (state.canRefill) {
      const t = state.takeFromPile();
      if (!t) break;
      window.pond.spawn(t, false);
    }
    updateEmptyHint();
    window.pond.start();
    window.addEventListener('resize', () => window.pond.resize());

    const drawer = document.getElementById('drawer');
    const drawerToggle = document.getElementById('drawerToggle');
    const taskList = document.getElementById('taskList');
    const taskHead = document.getElementById('taskHead');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistory');
    const capacityInput = document.getElementById('capacityInput');
    const capacityVal = document.getElementById('capacityVal');
    const dismissSelect = document.getElementById('dismissSelect');
    const volumeInput = document.getElementById('volumeInput');
    const volumeVal = document.getElementById('volumeVal');
    const ambienceInput = document.getElementById('ambienceInput');
    const ambienceVal = document.getElementById('ambienceVal');
    const addForm = document.getElementById('addForm');
    const addInput = document.getElementById('addInput');
    const addCount = document.getElementById('addCount');

    const BADGE = { pond: 'in pond', pile: 'waiting', done: 'done' };

    // A dash means the step does not apply to this task: a waiting task has no
    // "caught next" until it is drawn in, and one already in the pond has no
    // "drawn in" left to do. A real 0% is different and does get shown.
    // Precision scales with the size: a 200-task pile puts every row well
    // under 1%, and rounding those all the same way would hide a weight edit.
    function setChance(el, p) {
      el.classList.toggle('na', p == null);
      if (p == null) { el.textContent = '—'; return; }
      const n = p * 100;
      el.textContent =
        n === 0 ? '0%' :
        n >= 10 ? Math.round(n) + '%' :
        n >= 1 ? n.toFixed(1) + '%' :
        n >= 0.01 ? n.toFixed(2) + '%' : '<0.01%';
    }

    function chanceCell(p) {
      const el = document.createElement('span');
      el.className = 'badge chance';
      setChance(el, p);
      return el;
    }

    // Task id -> its "Drawn in" cell. A weight edit must not call render(),
    // which rebuilds the list and would throw focus out of the box being typed
    // in, so that column is rewritten through these instead. "Caught next" is
    // not here: weight has no say in which duck you click.
    const drawnEls = new Map();
    function refreshDrawn() {
      const drawn = state.drawChances();
      drawnEls.forEach((el, id) => setChance(el, drawn[id]));
    }

    // Backs up the "Drawn in" column: a task alone in the pile reads 100%
    // whatever weight you give it, so without this an edit could look dead.
    // One element at a time — two
    // quick edits in different rows would otherwise leave the first stuck lit.
    let savedEl = null, savedTimer = null;
    function flashSaved(el) {
      if (savedEl) savedEl.classList.remove('saved');
      savedEl = el;
      el.classList.add('saved');
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => { el.classList.remove('saved'); savedEl = null; }, 600);
    }

    function render() {
      // Task list: everything still in play, pond tasks included. Opening this
      // drawer is what spoils the surprise, which is why it starts closed.
      taskList.replaceChildren(taskHead);       // the sticky column header stays
      drawnEls.clear();
      const drawn = state.drawChances();
      const caught = state.revealChances();
      state.tasks
        .filter(t => t.state !== 'done')
        .forEach(t => {
          const li = document.createElement('li');

          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = BADGE[t.state];

          const input = document.createElement('input');
          input.type = 'text';
          input.value = t.text;
          input.maxLength = 100;
          input.setAttribute('aria-label', 'Edit task: ' + t.text);
          // Commit on every keystroke, not on blur. render() rebuilds this whole
          // list with replaceChildren, so an edit that has not yet blurred would be
          // silently discarded the moment anything else triggered a render — for
          // instance Escape closing the reveal card while the drawer is open.
          // No render() call here: the field already shows the text, and
          // re-rendering mid-keystroke would steal focus from the user.
          input.addEventListener('input', () => state.editTask(t.id, input.value));

          // Committed on input like the text field above, and for the same
          // reason: render() rebuilds this list and would discard a pending edit.
          const weight = document.createElement('input');
          weight.type = 'number';
          weight.className = 'num';
          weight.min = 1; weight.max = 10; weight.step = 1;
          weight.value = t.weight;
          weight.setAttribute('aria-label', 'Weight for: ' + t.text);
          weight.addEventListener('input', () => {
            state.setWeight(t.id, weight.value);
            refreshDrawn();          // every waiting row's share moves, not just this one
            flashSaved(weight);
          });

          const del = document.createElement('button');
          del.type = 'button';
          del.textContent = '✕';
          del.setAttribute('aria-label', 'Delete task: ' + t.text);
          del.addEventListener('click', () => deleteTask(t.id));

          const drawnCell = chanceCell(drawn[t.id]);
          drawnEls.set(t.id, drawnCell);

          li.append(badge, input, weight, drawnCell, chanceCell(caught[t.id]), del);
          taskList.appendChild(li);
        });

      // History: most recently finished first.
      historyList.replaceChildren();
      state.tasksIn('done')
        .slice()
        .sort((a, b) => b.doneAt - a.doneAt)
        .slice(0, 50)
        .forEach(t => {
          const li = document.createElement('li');
          const when = new Date(t.doneAt)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          li.textContent = t.text + ' — ' + when;
          historyList.appendChild(li);
        });

      clearHistoryBtn.disabled = state.tasksIn('done').length === 0;

      capacityInput.value = state.capacity;
      capacityVal.textContent = state.capacity + ' ducks';
      dismissSelect.value = state.onDismiss;
      volumeInput.value = Math.round(state.volume * 100);
      volumeVal.textContent = Math.round(state.volume * 100) + '%';
      ambienceInput.value = Math.round(state.ambience * 100);
      ambienceVal.textContent = Math.round(state.ambience * 100) + '%';
      updateEmptyHint();
    }

    function closeDrawer() {
      // Percentages already track weight edits live. This is for the rest of
      // the row: a duck caught while the drawer was open has changed a badge
      // from "waiting" to "in pond", and may have filled the Done list.
      render();
      drawer.hidden = true;
      drawerToggle.setAttribute('aria-expanded', 'false');
      drawerToggle.focus();
    }

    drawerToggle.addEventListener('click', () => {
      if (!drawer.hidden) { closeDrawer(); return; }
      drawer.hidden = false;
      drawerToggle.setAttribute('aria-expanded', 'true');
      drawer.querySelector('input, button, select').focus();
    });

    document.getElementById('drawerClose').addEventListener('click', closeDrawer);

    document.addEventListener('keydown', e => {
      if (creditsDialog.open) return;                // see the card handler above
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
    });

    document.getElementById('creditsBtn')
      .addEventListener('click', () => creditsDialog.showModal());
    document.getElementById('creditsClose')
      .addEventListener('click', () => creditsDialog.close());

    addForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!state.addTask(addInput.value, addCount.value)) return;
      addCount.value = 1;                     // one is the common case; do not make them reset it
      addInput.value = '';
      refill();
      render();
    });

    // Confirmed because it cannot be undone: history is the only record that a
    // task ever existed, and there is no bin to fish it back out of.
    clearHistoryBtn.addEventListener('click', () => {
      if (!confirm('Clear the Done history? This cannot be undone.')) return;
      state.clearHistory();
      render();
    });

    capacityInput.addEventListener('input', () => { state.setCapacity(capacityInput.value); refill(); render(); });
    dismissSelect.addEventListener('change', () => { state.setOnDismiss(dismissSelect.value); render(); });
    volumeInput.addEventListener('input', () => {
      state.setVolume(volumeInput.value / 100);
      if (window.audio) window.audio.setVolume(state.volume);
      render();
    });

    ambienceInput.addEventListener('input', () => {
      state.setAmbience(ambienceInput.value / 100);
      if (window.audio) window.audio.setAmbience(state.ambience);
      render();
    });

    render();
  });
});
