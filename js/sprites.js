// Duck Pond — sprite sheets. Every sheet is 192x128: a 6x4 grid of 32x32 cells.
// Row 0 swim (the idle pose, cropped at the waterline), row 1 waddle,
// row 2 quack, row 3 hurried waddle.

const CELL = 32;
const SHEET_COLS = 6;
const SHEET_ROWS = 4;
const FPS = 7;                 // the stepped, game-like feel comes from here
const WATERLINE_CUT = 5;       // sheet px hidden at the bottom of a floating duck

const ROW = { swim: 0, waddle: 1, quack: 2, hurry: 3 };

// Frame counts differ per sheet — the gentleman's quack is 2 frames where the
// others are 4. Stepping past a row's last frame lands in empty cells.
const SHEETS = {
  ducky2: {
    src: 'assets/ducks/ducky_2_spritesheet.png',
    frames: { swim: 2, waddle: 6, quack: 4, hurry: 6 },
    rare: false
  },
  ducky3: {
    src: 'assets/ducks/ducky_3_spritesheet.png',
    frames: { swim: 2, waddle: 6, quack: 4, hurry: 6 },
    rare: false
  },
  gentleman: {
    src: 'assets/ducks/gentleman_ducky_sheet.png',
    frames: { swim: 2, waddle: 6, quack: 2, hurry: 6 },
    rare: true
  }
};

const COMMON = Object.keys(SHEETS).filter(k => !SHEETS[k].rare);
const RARE_CHANCE = 0.02;

function scale() {
  return (typeof window !== 'undefined' && window.innerWidth <= 900) ? 2 : 3;
}

function pickSkin(rand) {
  const r = rand || Math.random;
  if (r() < RARE_CHANCE) return 'gentleman';
  return COMMON[Math.floor(r() * COMMON.length)];
}

function frameCount(skin, anim) {
  const sheet = SHEETS[skin] || SHEETS[COMMON[0]];
  return sheet.frames[anim] || 1;
}

// Writes the sprite background onto an element. The element is sized by the
// caller, because a floating duck is cropped and a walking one is not.
function style(el, skin, anim, frame, sc) {
  const sheet = SHEETS[skin] || SHEETS[COMMON[0]];
  const n = frameCount(skin, anim);
  const f = ((frame % n) + n) % n;            // never step past the last frame
  el.style.backgroundImage = 'url(' + sheet.src + ')';
  el.style.backgroundSize = (SHEET_COLS * CELL * sc) + 'px ' + (SHEET_ROWS * CELL * sc) + 'px';
  el.style.backgroundPosition = (-f * CELL * sc) + 'px ' + (-ROW[anim] * CELL * sc) + 'px';
  el.style.width = (CELL * sc) + 'px';
  el.style.height = (CELL * sc) + 'px';
}

function preload() {
  return Promise.all(Object.keys(SHEETS).map(k => new Promise(resolve => {
    const img = new Image();
    img.onload = img.onerror = () => resolve(k);
    img.src = SHEETS[k].src;
  })));
}

window.Sprites = {
  CELL, SHEET_COLS, SHEET_ROWS, FPS, WATERLINE_CUT, ROW, SHEETS,
  scale, pickSkin, frameCount, style, preload
};
