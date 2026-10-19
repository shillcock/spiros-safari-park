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

// Smooth, low-pressure steering at the same fixed 30 Hz simulation rate.
// Free animals top out at 3.4 px/tick versus Spiro's 5, even when fleeing.
export function moveAnimal(animal, player, bounds = field) {
  let dx = Math.cos(animal.heading), dy = Math.sin(animal.heading);
  let proximity = 0;
  if (animal.cage === null) {
    const awayX = animal.x + animal.w / 2 - (player.x + player.w / 2);
    const awayY = animal.y + animal.h / 2 - (player.y + player.h / 2);
    const distance = Math.hypot(awayX, awayY);
    // Notice Spiro earlier, with a clear turn away before pickup range.
    // Keep some wandering influence even at close range, and never boost speed.
    proximity = Math.max(0, Math.min(1, (220 - distance) / 120));
    const weight = proximity * .85;
    if (distance > 0 && weight > 0) {
      dx = dx * (1 - weight) + awayX / distance * weight;
      dy = dy * (1 - weight) + awayY / distance * weight;
    }
  }
  const length = Math.hypot(dx, dy) || 1;
  const speed = animal.speed * (animal.cage === null ? 1 : .3);
  const steering = .1 + proximity * .06;
  animal.vx += (dx / length * speed - animal.vx) * steering;
  animal.vy += (dy / length * speed - animal.vy) * steering;
  animal.x += animal.vx;
  animal.y += animal.vy;
  // Turn away from edges instead of pushing into them until a random timer fires.
  const hitX = animal.x < bounds.x || animal.x + animal.w > bounds.x + bounds.w;
  const hitY = animal.y < bounds.y || animal.y + animal.h > bounds.y + bounds.h;
  clamp(animal, bounds);
  if (hitX) { animal.vx *= -.5; animal.heading = Math.PI - animal.heading; }
  if (hitY) { animal.vy *= -.5; animal.heading = -animal.heading; }
  if (Math.abs(animal.vx) > .2) animal.facing = animal.vx < 0 ? 'left' : 'right';
}

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
      count: this.integer(45, 95), heading: this.random() * Math.PI * 2,
      speed: 2.2 + this.random() * 1.2, vx: 0, vy: 0,
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
    const previousFeet = p.y + p.h;
    if (keys.has('up')) p.y -= 5;
    else if (keys.has('down')) p.y += 5;
    else if (keys.has('left')) { p.x -= 5; p.facing = 'left'; }
    else if (keys.has('right')) { p.x += 5; p.facing = 'right'; }
    clamp(p, playerBounds);
    for (const a of this.animals) {
      if (a.carried) {
        a.x = p.x + p.w / 2 + 10 - a.w / 2;
        a.y = p.y + p.h / 2 - 10 - a.h;
      } else {
        if (--a.count <= 0) {
          a.count = this.integer(45, 95);
          a.heading += (this.random() - .5) * Math.PI * 1.4;
        }
        moveAnimal(a, p, a.cage === null ? field : this.cages[a.cage]);
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
      // A delivery attempt is a fresh downward crossing from field to cages.
      // Sideways skimming, standing still, and holding down at the boundary
      // cannot try more cages. Step back into the field before trying again.
      const entering = previousFeet <= field.h && p.y + p.h > field.h;
      if (p.carrying && entering) {
        const center = p.x + p.w / 2;
        const i = this.cages.findIndex(cage => center >= cage.x && center < cage.x + cage.w);
        if (i !== -1) {
          const cage = this.cages[i];
          if (p.carrying.name !== cage.name) events.push('wrong_cage');
          else if (!this.animals.some(a => a.cage === i)) {
            const animal = p.carrying;
            animal.cage = i;
            animal.carried = false;
            // Place it inside immediately, including on the final frozen frame.
            clamp(animal, cage);
            p.carrying = null;
            events.push(`returned:${animal.name}`);
          }
        }
      }
    }
    if (this.score === 6) { this.won = true; events.push('win'); }
    return events;
  }
}
