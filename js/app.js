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

    btnDone.addEventListener('click', () => hideCard(true));
    btnNotNow.addEventListener('click', () => hideCard(false));

    // Dismissing without choosing follows the On dismiss setting.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !card.hidden) hideCard(state.onDismiss === 'done');
    });

    window.scene.init(document.getElementById('sceneCanvas'));
    window.pond.init({ container: ducksEl, state, onCatch: showCard });

    window.audio.setVolume(state.volume);
    ['pointerdown', 'keydown'].forEach(ev => {
      document.addEventListener(ev, () => window.audio.unlock(), { once: true });
    });

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
