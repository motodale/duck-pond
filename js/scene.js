// Duck Pond — the scene. One canvas, drawn at low resolution and upscaled with
// image-rendering: pixelated so the water shares the ducks' pixel grid.
//
// This is the tileset seam. Swapping to real pixel-art tiles means rewriting
// buildStatic() and leaving water(), ripple(), draw() and resize() untouched.
// One obligation comes with it: buildStatic() must still stamp every swimmable
// pixel into the mask, because that mask is the ducks' entire idea of where
// the water is. Draw water without stamping it and the ducks will not use it.

const WATER = { cx: 0.5, cy: 0.58, rx: 0.42, ry: 0.33 };   // fractions of the stage
const SHORE_PAD = 1.10;                                     // shore ellipse vs water

// A tiny seeded PRNG so decoration stays put between frames and only moves
// when the stage is resized.
function makeRand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const scene = {
  canvas: null, ctx: null,
  cssW: 0, cssH: 0, sc: 3,
  logW: 0, logH: 0,
  static_: null,              // offscreen canvas holding the non-moving scene
  mask: null,                 // 1 byte per logical pixel: is this water?
  rings: [],
  reduced: false,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  },

  setReducedMotion(on) { this.reduced = !!on; if (on) this.rings.length = 0; },

  resize() {
    const r = this.canvas.parentNode.getBoundingClientRect();
    this.cssW = Math.max(1, Math.round(r.width));
    this.cssH = Math.max(1, Math.round(r.height));
    this.sc = window.Sprites.scale();
    this.logW = Math.ceil(this.cssW / this.sc);
    this.logH = Math.ceil(this.cssH / this.sc);
    this.canvas.width = this.logW;
    this.canvas.height = this.logH;
    this.ctx.imageSmoothingEnabled = false;
    this.buildStatic();
  },

  // Water ellipse in CSS pixels — pond.js uses this to keep ducks afloat.
  water() {
    return {
      cx: this.cssW * WATER.cx,
      cy: this.cssH * WATER.cy,
      rx: this.cssW * WATER.rx,
      ry: this.cssH * WATER.ry
    };
  },

  // Where a leaving duck climbs out: the left bank, at the height it is
  // already swimming at. The factor lands it in the mud ring between the water
  // edge (1.04) and the outer shore (SHORE_PAD), so it stands on brown.
  shorePoint(y) {
    const w = this.water();
    const f = (SHORE_PAD + 1.04) / 2;
    const ry = w.ry * f;
    const dy = Math.max(-1, Math.min(1, (y - w.cy) / ry));
    return { x: w.cx - w.rx * f * Math.sqrt(1 - dy * dy), y: w.cy + ry * dy };
  },

  // Is this CSS-pixel point drawn as water? Read off the mask buildStatic
  // captured, not computed from the ellipse — so when this file grows a real
  // tileset, the ducks' bounds follow the new art with no maths to update.
  isWater(x, y) {
    if (!this.mask) return false;
    const lx = Math.round(x / this.sc), ly = Math.round(y / this.sc);
    if (lx < 0 || ly < 0 || lx >= this.logW || ly >= this.logH) return false;
    return this.mask[ly * this.logW + lx] === 1;
  },

  ripple(x, y, o) {
    if (this.reduced) return;
    const opt = o || {};
    if (this.rings.length > 140) return;       // cheap cap, wakes are decoration
    this.rings.push({
      x: x / this.sc, y: y / this.sc,
      r: opt.r || 1,
      a: opt.alpha == null ? 0.28 : opt.alpha,
      g: opt.grow || 0.28,
      f: opt.fade || 0.006,
      w: opt.width || 1
    });
  },

  // ---- static scene ----

  buildStatic() {
    const c = document.createElement('canvas');
    c.width = this.logW; c.height = this.logH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    const W = this.logW, H = this.logH;
    const cx = W * WATER.cx, cy = H * WATER.cy;
    const rx = W * WATER.rx, ry = H * WATER.ry;
    const rand = makeRand(Math.round(W * 7919 + H));

    // grass, then a band of darker grass at the back
    g.fillStyle = '#5d6b3a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#4c5a30'; g.fillRect(0, 0, W, Math.round(H * 0.22));

    // Anything drawn with isWater true is also stamped onto a scratch canvas,
    // which becomes the swimmable mask. Capturing it here, before the lilypads
    // and light bands go on, is what stops decoration punching holes in it.
    const maskC = document.createElement('canvas');
    maskC.width = W; maskC.height = H;
    const mg = maskC.getContext('2d');

    const ell = (ex, ey, erx, ery, fill, isWater) => {
      g.fillStyle = fill;
      g.beginPath(); g.ellipse(ex, ey, erx, ery, 0, 0, Math.PI * 2); g.fill();
      if (!isWater) return;
      mg.fillStyle = '#fff';
      mg.beginPath(); mg.ellipse(ex, ey, erx, ery, 0, 0, Math.PI * 2); mg.fill();
    };

    // mud shore, then water
    ell(cx, cy, rx * SHORE_PAD, ry * SHORE_PAD, '#6d5a3c');
    ell(cx, cy, rx * 1.04, ry * 1.04, '#7b6743');
    ell(cx, cy, rx, ry, '#3f6b5c', true);
    ell(cx, cy - ry * 0.18, rx * 0.78, ry * 0.58, '#4a7a66', true);   // lighter centre

    // Shapes only, never an image — drawing a sprite here would taint the
    // canvas and make getImageData throw on file://.
    const alpha = mg.getImageData(0, 0, W, H).data;
    this.mask = new Uint8Array(W * H);
    for (let i = 0; i < this.mask.length; i++) this.mask[i] = alpha[i * 4 + 3] > 0 ? 1 : 0;

    // light bands on the water
    g.fillStyle = 'rgba(226,240,228,.07)';
    for (let i = 0; i < 7; i++) {
      const bx = cx + (rand() - 0.5) * rx * 1.4;
      const by = cy + (rand() - 0.5) * ry * 1.4;
      if (((bx - cx) / rx) ** 2 + ((by - cy) / ry) ** 2 > 0.85) continue;
      g.fillRect(Math.round(bx - 12), Math.round(by), 24, 1);
    }

    // lilypads on the water, under the ducks
    for (let i = 0; i < 9; i++) {
      const ang = rand() * Math.PI * 2, rad = 0.25 + rand() * 0.6;
      const px = cx + Math.cos(ang) * rx * rad;
      const py = cy + Math.sin(ang) * ry * rad;
      const pr = 4 + Math.round(rand() * 4);
      g.fillStyle = '#41703a';
      g.beginPath(); g.ellipse(px, py, pr, Math.max(2, pr * 0.5), 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2d5228';
      g.fillRect(Math.round(px), Math.round(py) - 1, pr, 1);     // the notch
    }

    // rocks around the rim
    for (let i = 0; i < 11; i++) {
      const ang = rand() * Math.PI * 2;
      const kx = cx + Math.cos(ang) * rx * (1.03 + rand() * 0.12);
      const ky = cy + Math.sin(ang) * ry * (1.03 + rand() * 0.12);
      const kw = 4 + Math.round(rand() * 5), kh = 3 + Math.round(rand() * 3);
      g.fillStyle = ['#6f6a61', '#7d776d', '#645f57'][Math.floor(rand() * 3)];
      g.fillRect(Math.round(kx - kw / 2), Math.round(ky - kh), kw, kh);
      g.fillStyle = 'rgba(255,255,255,.13)';
      g.fillRect(Math.round(kx - kw / 2), Math.round(ky - kh), kw, 1);
    }

    // the bush line down the left, where caught ducks disappear
    for (let i = 0; i < 7; i++) {
      const bx = Math.round(rand() * W * 0.07);
      const by = Math.round(rand() * H);
      const br = 7 + Math.round(rand() * 8);
      g.fillStyle = ['#2f4a22', '#385726', '#2b431f'][Math.floor(rand() * 3)];
      g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
    }

    // reeds around the back and sides
    const reed = (rx_, ry_, h) => {
      g.fillStyle = '#6f7f3a';
      g.fillRect(rx_, ry_ - h, 1, h);
      g.fillStyle = '#7a5a2c';
      g.fillRect(rx_ - 1, ry_ - h - 5, 3, 5);       // the cattail head
    };
    for (let i = 0; i < 16; i++) {
      const ang = rand() * Math.PI * 2;
      const sx = Math.round(cx + Math.cos(ang) * rx * (1.10 + rand() * 0.2));
      const sy = Math.round(cy + Math.sin(ang) * ry * (1.10 + rand() * 0.2));
      if (sx < 2 || sx > W - 2) continue;
      reed(sx, sy, 8 + Math.round(rand() * 10));
    }

    this.static_ = c;
  },

  // ---- per-frame ----

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.logW, this.logH);
    if (this.static_) ctx.drawImage(this.static_, 0, 0);

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.g; r.a -= r.f;
      if (r.a <= 0) { this.rings.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(233,245,232,' + r.a.toFixed(3) + ')';
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, Math.max(0.5, r.r * 0.34), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // An occasional ring in open water so the pond is not dead between ducks.
  ambient(rand) {
    if (this.reduced || rand() > 0.014) return;
    const w = this.water();
    const ang = rand() * Math.PI * 2, rad = Math.sqrt(rand()) * 0.9;
    this.ripple(w.cx + Math.cos(ang) * w.rx * rad, w.cy + Math.sin(ang) * w.ry * rad,
                { r: 1, alpha: 0.14, grow: 0.16, fade: 0.0034 });
  }
};

window.scene = scene;
