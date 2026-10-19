import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, moveAnimal } from '../game-model.js';

function animal() {
  return { x: 350, y: 220, w: 60, h: 80, heading: -Math.PI / 2,
    vx: 0, vy: 0, speed: 3, cage: null, facing: 'left' };
}
const distantPlayer = { x: 0, y: 0, w: 64, h: 144 };

test('nearby player gently biases heading away; distant player has no effect', () => {
  const near = animal(), far = animal();
  moveAnimal(near, { x: 230, y: 188, w: 64, h: 144 });
  moveAnimal(far, distantPlayer);
  assert.ok(near.vx > far.vx + .01);
  assert.ok(near.vy < 0, 'keeps some wandering direction rather than fleeing perfectly');
  assert.ok(Math.abs(far.vx) < .00001);
});
test('an approaching animal turns away before pickup range without speeding up', () => {
  const a = animal();
  a.heading = Math.PI; a.vx = -3;
  const player = { x: 228, y: 188, w: 64, h: 144 }; // 120px center distance
  for (let i = 0; i < 8; i++) moveAnimal(a, player);
  assert.ok(a.vx > 0, 'turns away in less than a third of a second');
  assert.ok(Math.hypot(a.vx, a.vy) <= a.speed);
});
test('animals notice the player beyond the previous 160px radius', () => {
  const near = animal(), far = animal();
  moveAnimal(near, { x: 158, y: 188, w: 64, h: 144 }); // 190px center distance
  moveAnimal(far, distantPlayer);
  assert.ok(near.vx > far.vx + .01);
});
test('steering accelerates gradually and supports diagonal movement', () => {
  const a = animal(); a.heading = Math.PI / 4;
  moveAnimal(a, distantPlayer);
  assert.ok(a.x > 350 && a.y > 220);
  assert.ok(Math.hypot(a.vx, a.vy) < 1);
  const previous = { vx: a.vx, vy: a.vy };
  a.heading += Math.PI;
  moveAnimal(a, distantPlayer);
  assert.ok(Math.hypot(a.vx - previous.vx, a.vy - previous.vy) < .7);
});
test('all animal speeds stay below player speed, including near-player steering', () => {
  const g = new Game(() => .999);
  for (const a of g.animals) {
    a.cage = null;
    for (let i = 0; i < 500; i++) {
      moveAnimal(a, { x: a.x - 50, y: a.y, w: 64, h: 144 });
      assert.ok(Math.hypot(a.vx, a.vy) <= 3.4);
      assert.ok(a.x >= 0 && a.x + a.w <= 800 && a.y >= 0 && a.y + a.h <= 480);
    }
  }
});
test('animals turn at edges; caged animals do not flee', () => {
  const a = animal(); a.x = 740; a.heading = 0; a.vx = 3;
  moveAnimal(a, distantPlayer);
  assert.equal(a.x, 740);
  assert.ok(a.vx < 0);
  const near = animal(), far = animal(); near.cage = far.cage = 0;
  const bounds = { x: 300, y: 200, w: 133, h: 120 };
  moveAnimal(near, { x: 230, y: 188, w: 64, h: 144 }, bounds);
  moveAnimal(far, distantPlayer, bounds);
  assert.equal(near.vx, far.vx);
  assert.equal(near.vy, far.vy);
  assert.ok(Math.hypot(near.vx, near.vy) < .3);
});
