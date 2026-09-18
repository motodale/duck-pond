// Duck Pond — page wiring. Task 9 fills this out; this much gets ducks swimming.
function render() { /* filled in by the drawer task */ }

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
      cardText.textContent = task.text;
      card.hidden = false;
      btnDone.focus();
    }

    // resolveAs is true for done, false for back in the pile.
    function hideCard(resolveAs) {
      const id = state.heldId;
      card.hidden = true;
      if (!id) return;
      state.resolve(id, resolveAs);
      window.pond.release();
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
    while (state.canRefill) {
      const t = state.takeFromPile();
      if (!t) break;
      window.pond.spawn(t, false);
    }
    updateEmptyHint();
    window.pond.start();
    window.addEventListener('resize', () => window.pond.resize());
  });
});
