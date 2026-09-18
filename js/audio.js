// Duck Pond — audio. Three CC0 quack samples plus a synthesized splash.
// Browsers refuse to start an AudioContext before a user gesture, so everything
// waits for unlock().

const QUACKS = ['assets/audio/quack-1.ogg', 'assets/audio/quack-2.ogg', 'assets/audio/quack-3.ogg'];

const audio = {
  ctx: null, gain: null, buffers: [], volume: 0.7, ready: false,

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.volume;
  },

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(this.ctx.destination);

    QUACKS.forEach((src, i) => {
      fetch(src)
        .then(r => r.arrayBuffer())
        .then(b => this.ctx.decodeAudioData(b))
        .then(buf => { this.buffers[i] = buf; this.ready = true; })
        .catch(e => console.error('Duck Pond: could not load ' + src, e));
    });
  },

  quack() {
    if (!this.ctx || !this.ready) return;
    const pool = this.buffers.filter(Boolean);
    if (!pool.length) return;
    const src = this.ctx.createBufferSource();
    src.buffer = pool[Math.floor(Math.random() * pool.length)];
    src.playbackRate.value = 0.93 + Math.random() * 0.14;   // stops repeats sounding identical
    src.connect(this.gain);
    src.start();
  },

  // Filtered noise with a fast decay — keeps the splash in tune with its ripple
  // and costs no file.
  splash() {
    if (!this.ctx) return;
    const dur = 0.28;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, this.ctx.currentTime);
    lp.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + dur);
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    src.connect(lp); lp.connect(g); g.connect(this.gain);
    src.start();
  }
};

window.audio = audio;
