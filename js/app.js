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

    // Deleting a task whose duck is swimming sends that duck under immediately,
    // then refills the gap it leaves.
    function deleteTask(id) {
      const task = state.byId(id);
      if (!task) return;
      const wasInPond = task.state === 'pond';
      if (state.heldId === id) { card.hidden = true; window.pond.release(); }
      state.deleteTask(id);
      if (wasInPond) window.pond.removeByTaskId(id, 'dive');
      refill();
      render();
    }

    btnDone.addEventListener('click', () => hideCard(true));
    btnNotNow.addEventListener('click', () => hideCard(false));

    // Dismissing without choosing follows the On dismiss setting.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !card.hidden) hideCard(state.onDismiss === 'done');
    });

    window.scene.init(document.getElementById('sceneCanvas'));
    window.pond.init({ container: ducksEl, state, onCatch: showCard });

    // Guarded as a whole block. Audio is decorative; a failed audio.js load must
    // never abort the rest of the bootstrap. Unguarded, a TypeError here would
    // stop the duck spawning, the frame loop and the resize wiring that follow.
    if (window.audio) {
      window.audio.setVolume(state.volume);
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
    const historyList = document.getElementById('historyList');
    const capacityInput = document.getElementById('capacityInput');
    const capacityVal = document.getElementById('capacityVal');
    const dismissSelect = document.getElementById('dismissSelect');
    const volumeInput = document.getElementById('volumeInput');
    const volumeVal = document.getElementById('volumeVal');
    const addForm = document.getElementById('addForm');
    const addInput = document.getElementById('addInput');

    const BADGE = { pond: 'in pond', pile: 'waiting', done: 'done' };

    function render() {
      // Task list: everything still in play, pond tasks included. Opening this
      // drawer is what spoils the surprise, which is why it starts closed.
      taskList.replaceChildren();
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

          const del = document.createElement('button');
          del.type = 'button';
          del.textContent = '✕';
          del.setAttribute('aria-label', 'Delete task: ' + t.text);
          del.addEventListener('click', () => deleteTask(t.id));

          li.append(badge, input, del);
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

      capacityInput.value = state.capacity;
      capacityVal.textContent = state.capacity + ' ducks';
      dismissSelect.value = state.onDismiss;
      volumeInput.value = Math.round(state.volume * 100);
      volumeVal.textContent = Math.round(state.volume * 100) + '%';
      updateEmptyHint();
    }

    drawerToggle.addEventListener('click', () => {
      const open = drawer.hidden;
      drawer.hidden = !open;
      drawerToggle.setAttribute('aria-expanded', String(open));
      if (open) drawer.querySelector('input, button, select').focus();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !drawer.hidden) {
        drawer.hidden = true;
        drawerToggle.setAttribute('aria-expanded', 'false');
        drawerToggle.focus();
      }
    });

    addForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!state.addTask(addInput.value)) return;
      addInput.value = '';
      refill();
      render();
    });

    capacityInput.addEventListener('input', () => { state.setCapacity(capacityInput.value); refill(); render(); });
    dismissSelect.addEventListener('change', () => { state.setOnDismiss(dismissSelect.value); render(); });
    volumeInput.addEventListener('input', () => {
      state.setVolume(volumeInput.value / 100);
      if (window.audio) window.audio.setVolume(state.volume);
      render();
    });

    render();
  });
});
