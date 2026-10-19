import { walkFrame } from './walk-animation.js';

// Enhanced-only presentation. None of these effects alter simulation or hitboxes.
const COLORS = ['#e7b546', '#b56583', '#638eb6', '#91b754', '#8968a9', '#e28b51'];
const approach = (from, to, amount) => from < to ? Math.min(to, from + amount) : Math.max(to, from - amount);

export function carriedPose(player, animal, time, moving, reducedMotion = false) {
  const bob = moving && !reducedMotion ? Math.sin(time * 12) * 2.5 : 0;
  return {
    ...animal,
    x: player.x + player.w / 2 + (player.facing === 'left' ? 23 : -23) - animal.w / 2,
    y: player.y + 60 - animal.h + bob,
    facing: player.facing,
  };
}

export class VisualState {
  constructor(reducedMotion = false, random = Math.random) {
    this.reducedMotion = reducedMotion;
    this.random = random;
    this.reset();
  }
  reset() {
    this.time = 0;
    this.doors = Array(6).fill(0);
    this.occupied = Array(6).fill(true);
    this.returned = Array(6).fill(false);
    this.flashes = Array(6).fill(0);
    this.stars = [];
    this.confetti = [];
    this.celebrating = false;
    this.celebrationTime = 0;
    this.finishTime = null;
    this.awardTime = null;
  }
  beginAward() {
    if (this.awardTime === null) this.awardTime = 0;
  }
  get awardPose() {
    if (this.awardTime === null) return null;
    const docked = { scale: .32, x: 690, y: 245, alpha: 1, backdrop: 0 };
    if (this.reducedMotion) {
      return this.awardTime >= 8 ? docked : { scale: 1, x: 400, y: 285, alpha: 1, backdrop: 1 };
    }
    const t = Math.min(1, this.awardTime);
    const ease = 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
    const progress = Math.max(0, Math.min(1, (this.awardTime - 6.5) / 1.5));
    const dock = progress * progress * (3 - 2 * progress);
    return {
      scale: (.15 + .85 * ease) * (1 - dock) + docked.scale * dock,
      x: 400 + (docked.x - 400) * dock,
      y: 285 + (docked.y - 285) * dock,
      alpha: Math.min(1, this.awardTime / .3),
      backdrop: 1 - dock,
    };
  }
  get finishPhase() {
    if (this.finishTime === null) return null;
    if (this.finishTime < .8) return 'closing';
    if (this.finishTime < 2) return 'flip';
    if (this.finishTime < 2.5) return 'landing';
    return 'complete';
  }
  get flipPose() {
    if (this.finishPhase !== 'flip' || this.reducedMotion) return { rise: 0, angle: 0 };
    const progress = (this.finishTime - .8) / 1.2;
    return { rise: Math.sin(progress * Math.PI) * 100, angle: progress * Math.PI * 2 };
  }
  advance(game, seconds) {
    this.time += seconds;
    if (this.awardTime !== null) this.awardTime += seconds;
    for (let i = 0; i < 6; i++) {
      const occupied = game.animals.some(a => a.cage === i);
      const target = game.escaped && !occupied ? 1 : 0;
      this.doors[i] = this.reducedMotion ? target : approach(this.doors[i], target, seconds * 1.8);
      this.flashes[i] = Math.max(0, this.flashes[i] - seconds);
      if (occupied && !this.occupied[i] && game.escaped) {
        this.returned[i] = true;
        this.flashes[i] = 1.5;
        if (!this.reducedMotion) {
          for (let n = 0; n < 12; n++) {
            const angle = n / 12 * Math.PI * 2;
            this.stars.push({ x: i * 133 + 66, y: 488, vx: Math.cos(angle) * 65,
              vy: Math.sin(angle) * 65 - 35, life: 1.1, color: COLORS[n % COLORS.length] });
          }
        }
      }
      this.occupied[i] = occupied;
    }
    for (const p of this.stars) {
      p.x += p.vx * seconds; p.y += p.vy * seconds;
      p.vy += 60 * seconds; p.life -= seconds;
    }
    this.stars = this.stars.filter(p => p.life > 0);
    if (game.won) this.finishTime = (this.finishTime ?? 0) + seconds;
    if (this.finishPhase === 'complete' && !this.celebrating) {
      this.celebrating = true;
      if (!this.reducedMotion) {
        this.confetti = Array.from({ length: 100 }, (_, i) => ({
          x: this.random() * 800, y: -this.random() * 650,
          speed: 45 + this.random() * 60, angle: this.random() * Math.PI,
          spin: this.random() * 3 - 1.5, color: COLORS[i % COLORS.length],
        }));
      }
    }
    if (this.celebrating) {
      this.celebrationTime += seconds;
      for (const p of this.confetti) {
        p.y += p.speed * seconds;
        p.x += Math.sin(this.time * 1.5 + p.angle) * seconds * 20;
        p.angle += p.spin * seconds;
      }
      this.confetti = this.confetti.filter(p => p.y < 620);
    }
  }
}

function strokePath(ctx, points, color, width = 2) {
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
}

function createBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 600;
  const c = canvas.getContext('2d');
  let seed = 2004;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  c.fillStyle = '#a5bb78'; c.fillRect(0, 0, 800, 600);
  // Broad, low-contrast pencil patches keep the play area legible.
  for (let i = 0; i < 45; i++) {
    c.fillStyle = i % 2 ? '#b9c88b30' : '#738f5a10';
    c.beginPath(); c.ellipse(random() * 800, random() * 470, 40 + random() * 95, 15 + random() * 40, 0, 0, Math.PI * 2); c.fill();
  }
  c.lineCap = 'round';
  for (let i = 0; i < 4500; i++) {
    const x = random() * 800, y = random() * 600;
    strokePath(c, [[x, y], [x + random() * 7 - 3, y - random() * 4]], i % 2 ? '#f8ebbe19' : '#526c4210', 1);
  }
  // A sandy strip marks the cage entrances, without becoming an obstacle.
  c.fillStyle = '#d4c18d';
  c.beginPath(); c.moveTo(0, 453);
  c.bezierCurveTo(230, 443, 470, 464, 800, 451);
  c.lineTo(800, 600); c.lineTo(0, 600); c.closePath(); c.fill();
  for (let i = 0; i < 300; i++) {
    const x = random() * 800, y = 456 + random() * 144;
    strokePath(c, [[x, y], [x + 3, y + 1]], '#8f815326', 1);
  }
  for (let i = 0; i < 65; i++) {
    const x = 15 + random() * 770, y = 30 + random() * 410;
    strokePath(c, [[x - 4, y - 5], [x, y], [x + 2, y - 8]], '#728f5260', 1.5);
    if (i % 5 === 0) {
      c.fillStyle = i % 2 ? '#eedca0' : '#e6d3bd';
      for (let n = 0; n < 4; n++) { c.beginPath(); c.arc(x + Math.cos(n * Math.PI / 2) * 2, y - 8 + Math.sin(n * Math.PI / 2) * 2, 2, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#bca052'; c.fillRect(x - 1, y - 9, 2, 2);
    }
  }
  // Decorative acacia canopies stay at the upper edges; no hidden collision walls.
  for (const [x, mirrored] of [[28, false], [772, true]]) {
    c.save(); c.translate(x, 0); if (mirrored) c.scale(-1, 1);
    strokePath(c, [[-10, 110], [1, 65], [-5, 33]], '#856d47', 9);
    strokePath(c, [[0, 67], [27, 42], [42, 33]], '#856d47', 5);
    for (const [tx, ty, rx, ry] of [[-17, 27, 55, 20], [32, 28, 39, 17], [0, 9, 44, 17]]) {
      c.fillStyle = '#6e9256'; c.strokeStyle = '#587b48'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(tx, ty, rx, ry, -.08, 0, Math.PI * 2); c.fill(); c.stroke();
      for (let n = 0; n < 12; n++) {
        const px = tx + (random() - .5) * rx * 1.4, py = ty + (random() - .5) * ry;
        strokePath(c, [[px, py], [px + 7, py - 2]], '#a9bb7460', 2);
      }
    }
    c.restore();
  }
  return canvas;
}

export class ParkRenderer {
  constructor(ctx, images, reducedMotion = false) {
    this.ctx = ctx;
    this.images = images;
    this.visual = new VisualState(reducedMotion);
    this.background = createBackground();
  }
  reset() { this.visual.reset(); this.playerWalking = false; }
  advance(game, seconds) { this.visual.advance(game, seconds); }
  sprite(image, body, flip = false, animation = null) {
    const c = this.ctx;
    c.save(); c.translate(Math.round(body.x + (flip ? body.w : 0)), Math.round(body.y));
    if (flip) c.scale(-1, 1);
    if (animation) {
      const { sheet, sx, sy, sw, sh, dx, dy, dw, dh } = animation;
      c.drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh);
    } else c.drawImage(image, 0, 0, body.w, body.h);
    c.restore();
  }
  actor(name, body, flip, walking, phaseOffset = 0) {
    const sheet = this.images[`${name}_walk`];
    const frame = walking && !this.visual.reducedMotion && sheet
      ? walkFrame(name, this.visual.time + phaseOffset) : null;
    this.sprite(this.images[name], body, flip, frame ? { sheet, ...frame } : null);
  }
  animal(a, walking = false) {
    const reverse = a.name === 'monkey' || a.name === 'penguin';
    this.actor(a.name, a, reverse ? a.facing === 'left' : a.facing === 'right', walking, a.w / 100);
  }
  shadow(body) {
    const c = this.ctx; c.fillStyle = '#344d3424';
    c.beginPath(); c.ellipse(body.x + body.w / 2, body.y + body.h - 3, body.w * .4, 5, 0, 0, Math.PI * 2); c.fill();
  }
  star(x, y, size, color) {
    const c = this.ctx; c.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? size * .45 : size;
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = color; c.fill();
  }
  draw(game, paused, moving) {
    const c = this.ctx, v = this.visual;
    if (!paused) this.playerWalking = moving && !game.won;
    c.drawImage(this.background, 0, 0);
    for (const cage of game.cages) {
      c.fillStyle = '#8ca264'; c.fillRect(cage.x + 4, 483, 125, 112);
      c.fillStyle = '#b2bf8140'; c.fillRect(cage.x + 10, 489, 113, 101);
    }
    const actors = [...game.animals.filter(a => !a.carried), game.player];
    actors.sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const body of actors) {
      this.shadow(body);
      if (body === game.player) {
        // The passenger is ALWAYS drawn behind the player, independent of species.
        if (body.carrying) this.animal(carriedPose(body, body.carrying, v.time, moving, v.reducedMotion));
        const pose = v.flipPose;
        if (pose.rise || pose.angle) {
          c.save();
          c.translate(body.x + body.w / 2, body.y + body.h / 2 - pose.rise);
          c.rotate(pose.angle * (body.facing === 'left' ? -1 : 1));
          this.sprite(this.images.guide, { ...body, x: -body.w / 2, y: -body.h / 2 }, body.facing === 'left');
          c.restore();
        } else this.actor('guide', body, body.facing === 'left', this.playerWalking);
      } else {
        // A returned animal's animated feet must stay inside its enclosure.
        c.save();
        if (body.cage !== null) {
          const cage = game.cages[body.cage];
          c.beginPath(); c.rect(cage.x, cage.y, cage.w, cage.h); c.clip();
        }
        this.animal(body, !game.won && Math.hypot(body.vx, body.vy) > .08);
        c.restore();
      }
    }
    for (let i = 0; i < game.cages.length; i++) this.cage(game.cages[i], i);
    for (const p of v.stars) {
      c.globalAlpha = Math.min(1, p.life * 2); this.star(p.x, p.y, 5, p.color);
    }
    c.globalAlpha = 1;
    if (game.phase === 'escape') {
      c.fillStyle = '#fff5dce8'; c.fillRect(215, 451, 370, 27);
      c.font = 'bold 18px Georgia'; c.fillStyle = '#574e31'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('The gates are open! They’ve escaped!', 400, 465);
    }
    if (paused) { c.fillStyle = '#0007'; c.fillRect(0, 0, 800, 600); }
  }
  cage(cage, index) {
    const c = this.ctx, v = this.visual, open = v.doors[index];
    // Celebrate successful delivery, but never reveal the destination beforehand.
    if (v.flashes[index] > 0) {
      c.strokeStyle = '#fff0a1'; c.lineWidth = 4;
      c.strokeRect(cage.x + 4, 483, 125, 113);
    }
    // Two hinged leaves retract toward their posts, making open/closed unambiguous.
    for (const right of [false, true]) {
      c.save(); c.translate(cage.x + (right ? 127 : 6), 489);
      c.transform(right ? -(1 - open * .9) : 1 - open * .9, open * .16, 0, 1, 0, 0);
      c.fillStyle = '#8a70441a'; c.fillRect(0, 0, 60, 81);
      c.strokeStyle = '#755b3c'; c.lineWidth = 3;
      c.strokeRect(0, 0, 60, 81);
      for (const x of [20, 40]) strokePath(c, [[x, 1], [x + 1, 80]], '#7b6241', 2.5);
      strokePath(c, [[1, 40], [59, 41]], '#a18b5c', 2);
      c.fillStyle = '#f0d794'; c.fillRect(53, 37, 4, 8);
      c.restore();
    }
    for (const x of [cage.x + 2, cage.x + 126]) {
      c.fillStyle = '#806540'; c.fillRect(x, 480, 6, 119);
      strokePath(c, [[x + 2, 483], [x + 2, 595]], '#b29766', 1);
    }
    c.fillStyle = '#f1e1b3'; c.fillRect(cage.x + 8, 573, 117, 23);
    c.strokeStyle = '#9e8655'; c.lineWidth = 1; c.strokeRect(cage.x + 8, 573, 117, 23);
    c.font = '17px ParkLabels, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#4c5637'; c.fillText(cage.name, cage.x + 66, 585, 110);
    if (v.returned[index]) {
      // A simple, larger badge stays legible over both the animal and gate bars.
      this.star(cage.x + 66, 530, 22, '#ffe082');
      c.strokeStyle = '#805925'; c.lineWidth = 2.5; c.stroke();
    }
  }
  victory() {
    const c = this.ctx;
    c.drawImage(this.images.way_to_go, 0, 0);
    for (const p of this.visual.confetti) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.angle); c.globalAlpha = .8;
      c.fillStyle = p.color; c.fillRect(-4, -2, 8, 5); c.restore();
    }
    this.rangerAward();
  }
  rangerAward() {
    const pose = this.visual.awardPose;
    if (!pose) return;
    const c = this.ctx;
    c.save();
    c.fillStyle = `rgba(35, 43, 23, ${pose.alpha * pose.backdrop * .25})`;
    c.fillRect(0, 0, 800, 600);
    c.globalAlpha = pose.alpha;
    c.translate(pose.x, pose.y);
    c.scale(pose.scale, pose.scale);
    const gold = c.createLinearGradient(-150, -200, 150, 190);
    gold.addColorStop(0, '#fff0a4');
    gold.addColorStop(.45, '#f4cf66');
    gold.addColorStop(1, '#c99938');
    c.shadowColor = '#49391b66'; c.shadowBlur = 22; c.shadowOffsetY = 7;
    this.star(0, 0, 205, gold);
    c.strokeStyle = '#8a632d'; c.lineWidth = 5; c.stroke();
    c.shadowBlur = 0; c.shadowOffsetY = 0;
    this.star(0, 0, 190, '#ffe69a');
    c.strokeStyle = '#d4a94b'; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(0, 0, 94, 0, Math.PI * 2);
    c.fillStyle = '#fff1c4'; c.fill();
    c.strokeStyle = '#bd9141'; c.lineWidth = 2; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#60492b';
    c.font = '22px ParkLabels, "Arial Black", sans-serif';
    c.fillText('SPIRO’S', 0, -36, 166);
    c.font = '18px ParkLabels, "Arial Black", sans-serif';
    c.fillText('SAFARI PARK', 0, -4, 172);
    c.font = '26px ParkLabels, "Arial Black", sans-serif';
    c.fillText('RANGER', 0, 32, 172);
    this.star(-27, 63, 6, '#b28b3b');
    this.star(0, 67, 7, '#b28b3b');
    this.star(27, 63, 6, '#b28b3b');
    c.restore();
  }
}
