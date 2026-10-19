export const SPECIES = ['beaver', 'elephant', 'monkey', 'penguin', 'snake', 'zebra'];
export const SIZES = [[66, 100], [100, 74], [84, 100], [72, 100], [46, 100], [100, 65]];
export const STEP = 1000 / 30;
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (a, r) => {
  a.x = Math.max(r.x, Math.min(a.x, r.x + r.w - a.w));
  a.y = Math.max(r.y, Math.min(a.y, r.y + r.h - a.h));
};
const field = { x: 0, y: 0, w: 800, h: 480 };
const playerBounds = { ...field, h: 490 };

export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.time = 0;
    this.escaped = false;
    this.won = false;
    this.player = { x: 368, y: 0, w: 64, h: 144, facing: 'left', carrying: null };
    this.cages = SPECIES.map((name, i) => ({ name, x: i * 133, y: 480, w: 133, h: 120 }));
    this.animals = SPECIES.map((name, i) => ({
      name, w: SIZES[i][0], h: SIZES[i][1],
      x: i * 133 + (133 - SIZES[i][0]) / 2, y: 480 + (120 - SIZES[i][1]) / 2,
      cage: i, carried: false, facing: 'left',
      count: this.integer(5, 25), direction: this.integer(0, 4), speed: this.integer(4, 9),
    }));
  }
  integer(min, max) { return min + Math.floor(this.random() * (max - min + 1)); }
  get score() { return this.escaped ? this.animals.filter(a => a.cage !== null).length : 0; }
  get phase() { return this.won ? 'won' : this.time <= 16000 ? 'intro' : this.time <= 23000 ? 'escape' : 'catch'; }

  // One fixed 30 Hz simulation step. Audio and rendering live outside the model.
  step(keys = new Set()) {
    if (this.won) return [];
    const events = [];
    this.time += STEP;
    if (!this.escaped && this.time > 16000) {
      this.escaped = true;
      this.animals.forEach(a => { a.cage = null; });
      events.push('escaped');
    }
    const p = this.player;
    if (keys.has('up')) p.y -= 5;
    else if (keys.has('down')) p.y += 5;
    else if (keys.has('left')) { p.x -= 5; p.facing = 'left'; }
    else if (keys.has('right')) { p.x += 5; p.facing = 'right'; }
    clamp(p, playerBounds);
    for (const a of this.animals) {
      if (a.carried) {
        a.x = p.x + p.w / 2 + 10 - a.w / 2;
        a.y = p.y + p.h / 2 - 10 - a.h;
      } else if (--a.count > 0) {
        if (a.direction === 1) a.y -= a.speed;
        if (a.direction === 2) a.y += a.speed;
        if (a.direction === 3) { a.x -= a.speed; a.facing = 'left'; }
        if (a.direction === 4) { a.x += a.speed; a.facing = 'right'; }
        clamp(a, a.cage === null ? field : this.cages[a.cage]);
      } else {
        a.count = this.integer(15, 35);
        a.direction = this.integer(1, 4);
      }
    }
    if (this.time > 23000) {
      if (!p.carrying) {
        const a = this.animals.find(a => a.cage === null && !a.carried && overlaps(p, a));
        if (a) {
          p.carrying = a;
          a.carried = true;
          events.push(a.name, 'gotcha');
        }
      }
      for (let i = 0; i < this.cages.length && p.carrying; i++) {
        const cage = this.cages[i];
        if (!overlaps(p, cage) || this.animals.some(a => a.cage === i)) continue;
        if (p.carrying.name === cage.name) {
          p.carrying.cage = i;
          p.carrying.carried = false;
          p.carrying = null;
          events.push('good_job');
        } else events.push('wrong_cage');
      }
    }
    if (this.score === 6) { this.won = true; events.push('win'); }
    return events;
  }
}
