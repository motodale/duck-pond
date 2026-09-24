// Duck Pond — audio. Three CC0 quack samples and a looping pond ambience,
// played as <audio> elements. Not decoded AudioContext buffers: fetch() is
// blocked on file:// and the README tells people to open index.html directly,
// so buffers left the app silent unless it was served. Browsers refuse to play
// before a user gesture, so everything waits for unlock().

const QUACKS = ['assets/audio/quack-1.ogg', 'assets/audio/quack-2.ogg', 'assets/audio/quack-3.ogg'];
const AMBIENCE = 'assets/audio/pond-ambience.ogg';

const audio = {
  quacks: [], ambience: null, volume: 0.7, ambienceVolume: 0.35,

  // Both setters take an already-clamped 0..1 from state.js.
  setVolume(v) { this.volume = v; },

  // Its own control, not a ratio of the quack volume: the ambience runs
  // constantly and some people want it off while the quacks stay on.
  setAmbience(v) {
    this.ambienceVolume = v;
    if (this.ambience) this.ambience.volume = this.ambienceVolume;
  },

  unlock() {
    if (this.quacks.length) return;
    this.quacks = QUACKS.map(src => new Audio(src));

    // The file is cut to a whole 360s with its head crossfaded onto its tail,
    // so looping it has no seam to hear.
    this.ambience = new Audio(AMBIENCE);
    this.ambience.loop = true;
    this.ambience.volume = this.ambienceVolume;
    this.ambience.play().catch(e => console.error('Duck Pond: could not play ambience', e));
  },

  quack() {
    if (!this.quacks.length) return;
    // Cloned so two ducks quacking at once do not cut each other off.
    const el = this.quacks[Math.floor(Math.random() * this.quacks.length)].cloneNode();
    el.volume = this.volume;
    el.playbackRate = 0.93 + Math.random() * 0.14;   // stops repeats sounding identical
    el.play().catch(e => console.error('Duck Pond: could not play quack', e));
  }
};

window.audio = audio;
