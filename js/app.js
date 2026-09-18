// Duck Pond — page wiring. Task 9 fills this out; this much gets ducks swimming.
document.addEventListener('DOMContentLoaded', () => {
  const state = new window.DuckPondState({});
  window.Sprites.preload().then(() => {
    window.scene.init(document.getElementById('sceneCanvas'));
    window.pond.init({
      container: document.getElementById('ducks'),
      state,
      onCatch: task => console.log('caught:', task.text)
    });

    // Seed some tasks so there is something to look at.
    if (state.tasks.length === 0) {
      ['Wash the dishes', 'Email the landlord', '15 minute walk', 'Pay the water bill',
       'Book dentist', 'Fold laundry'].forEach(t => state.addTask(t));
    }
    while (state.canRefill) {
      const t = state.takeFromPile();
      if (!t) break;
      window.pond.spawn(t, false);
    }
    window.pond.start();
  });

  window.addEventListener('resize', () => window.pond.resize());
});
