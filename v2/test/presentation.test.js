import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../game-model.js';
import { VisualState, carriedPose, ParkRenderer } from '../presentation.js';

test('doors open on escape and close only for returned animals', () => {
  const g = new Game(), v = new VisualState();
  v.advance(g, 1);
  assert.deepEqual(v.doors, [0, 0, 0, 0, 0, 0]);
  g.escaped = true; g.animals.forEach(a => { a.cage = null; });
  v.advance(g, .25);
  assert.ok(v.doors.every(d => d > 0 && d < 1));
  v.advance(g, 1);
  assert.deepEqual(v.doors, [1, 1, 1, 1, 1, 1]);
  g.animals[2].cage = 2;
  v.advance(g, .25);
  assert.ok(v.doors[2] < 1);
  assert.equal(v.doors[0], 1);
  assert.equal(v.returned[2], true);
  assert.equal(v.stars.length, 12);
  v.advance(g, 1);
  assert.equal(v.doors[2], 0);
  assert.equal(v.stars.length, 0);
});

test('presentation never modifies gameplay data', () => {
  const g = new Game(), v = new VisualState();
  const before = JSON.stringify(g);
  for (let n = 0; n < 100; n++) v.advance(g, .03);
  assert.equal(JSON.stringify(g), before);
});

test('carrying stays on the back side of the player, with a bounded optional bob', () => {
  const g = new Game(), a = g.animals[0], p = g.player;
  const before = JSON.stringify(a);
  p.facing = 'left';
  const left = carriedPose(p, a, 0, true);
  p.facing = 'right';
  const right = carriedPose(p, a, 0, true);
  assert.ok(left.x > right.x);
  for (let n = 0; n < 100; n++) {
    assert.ok(Math.abs(carriedPose(p, a, n / 10, true).y - right.y) <= 2.5);
    assert.equal(carriedPose(p, a, n / 10, false).y, right.y);
    assert.equal(carriedPose(p, a, n / 10, true, true).y, right.y);
  }
  assert.equal(JSON.stringify(a), before);
});

test('every carried species is drawn immediately behind the player', () => {
  const g = new Game();
  const renderer = Object.create(ParkRenderer.prototype);
  renderer.ctx = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  renderer.visual = new VisualState();
  renderer.images = Object.fromEntries(['guide', ...g.animals.map(a => a.name)].map(name => [name, name]));
  renderer.shadow = () => {};
  renderer.cage = () => {};
  for (const passenger of g.animals) {
    g.animals.forEach(a => { a.carried = a === passenger; });
    g.player.carrying = passenger;
    const draws = [];
    renderer.sprite = image => draws.push(image);
    renderer.draw(g, false, false);
    assert.equal(draws[draws.indexOf('guide') - 1], passenger.name);
    assert.equal(draws.filter(name => name === passenger.name).length, 1);
  }
});

test('carrying reveals no cage highlight; gold feedback appears only after delivery', () => {
  const g = new Game();
  const renderer = Object.create(ParkRenderer.prototype);
  const goldBorders = [];
  const context = {
    strokeRect(...args) { if (this.strokeStyle === '#fff0a1') goldBorders.push(args); },
  };
  renderer.ctx = new Proxy(context, { get: (target, key) => target[key] ?? (() => {}) });
  renderer.visual = new VisualState();
  renderer.images = {};
  renderer.sprite = () => {};
  g.player.carrying = g.animals[0];
  g.animals[0].carried = true;
  renderer.draw(g, false, false);
  assert.equal(goldBorders.length, 0);
  renderer.visual.flashes[0] = 1;
  renderer.draw(g, false, false);
  assert.equal(goldBorders.length, 1);
});

test('confetti starts only on victory, ends, and replay clears every effect', () => {
  const g = new Game(), v = new VisualState(false, () => .5);
  v.advance(g, .1);
  assert.equal(v.confetti.length, 0);
  g.won = true;
  v.advance(g, .1);
  assert.equal(v.confetti.length, 0);
  v.advance(g, 2.5);
  assert.equal(v.confetti.length, 100);
  v.advance(g, 30);
  assert.equal(v.confetti.length, 0);
  v.advance(g, .1);
  assert.equal(v.confetti.length, 0);
  v.reset();
  assert.equal(v.celebrating, false);
  assert.equal(v.finishPhase, null);
  assert.equal(v.stars.length, 0);
  assert.deepEqual(v.returned, Array(6).fill(false));
  assert.deepEqual(v.doors, Array(6).fill(0));
});

test('last gate closes before the flip, then Spiro lands before the end screen', () => {
  const g = new Game(), v = new VisualState();
  g.escaped = true; g.animals[5].cage = null;
  v.advance(g, 1);
  assert.equal(v.doors[5], 1);
  g.animals[5].cage = 5; g.won = true;
  v.advance(g, .1);
  assert.equal(v.finishPhase, 'closing');
  assert.ok(v.doors[5] > 0);
  v.advance(g, .5);
  assert.equal(v.doors[5], 0);
  assert.equal(v.finishPhase, 'closing');
  v.advance(g, .8);
  assert.equal(v.finishPhase, 'flip');
  assert.ok(v.flipPose.rise > 99);
  assert.ok(Math.abs(v.flipPose.angle - Math.PI) < .001);
  v.advance(g, .7);
  assert.equal(v.finishPhase, 'landing');
  assert.deepEqual(v.flipPose, { rise: 0, angle: 0 });
  assert.equal(v.confetti.length, 0);
  v.advance(g, .5);
  assert.equal(v.finishPhase, 'complete');
});

test('ranger award waits for narration, grows, holds, docks permanently, and resets', () => {
  const g = new Game(), v = new VisualState();
  g.won = true;
  v.advance(g, 3);
  assert.equal(v.awardPose, null, 'finishing alone must not start the badge');
  v.beginAward();
  assert.ok(v.awardPose.scale < .2);
  v.advance(g, 1);
  assert.equal(v.awardPose.scale, 1);
  assert.equal(v.awardPose.alpha, 1);
  v.beginAward();
  assert.equal(v.awardTime, 1, 'repeated calls must not restart the animation');
  v.advance(g, 4);
  assert.equal(v.awardPose.alpha, 1);
  v.advance(g, 2);
  assert.equal(v.awardPose.alpha, 1);
  assert.ok(v.awardPose.scale > .32 && v.awardPose.scale < 1);
  assert.ok(v.awardPose.x > 400 && v.awardPose.x < 690);
  assert.ok(v.awardPose.backdrop > 0 && v.awardPose.backdrop < 1);
  v.advance(g, 1);
  const docked = { scale: .32, x: 690, y: 245, alpha: 1, backdrop: 0 };
  assert.deepEqual(v.awardPose, docked);
  v.advance(g, 100);
  assert.deepEqual(v.awardPose, docked);
  v.reset();
  assert.equal(v.awardTime, null);
  assert.equal(v.awardPose, null);
});

test('reduced-motion ranger award switches from full-size to docked without animation', () => {
  const g = new Game(), v = new VisualState(true);
  v.beginAward();
  const full = { scale: 1, x: 400, y: 285, alpha: 1, backdrop: 1 };
  assert.deepEqual(v.awardPose, full);
  v.advance(g, 7);
  assert.deepEqual(v.awardPose, full);
  v.advance(g, 1);
  assert.deepEqual(v.awardPose, { scale: .32, x: 690, y: 245, alpha: 1, backdrop: 0 });
});

test('reduced motion keeps feedback but skips animations and particles', () => {
  const g = new Game(), v = new VisualState(true);
  g.escaped = true; g.animals.forEach(a => { a.cage = null; });
  v.advance(g, .01);
  assert.ok(v.doors.every(d => d === 1));
  g.animals[0].cage = 0;
  v.advance(g, .01);
  assert.equal(v.doors[0], 0);
  assert.equal(v.returned[0], true);
  assert.ok(v.flashes[0] > 0);
  assert.equal(v.stars.length, 0);
  g.won = true; v.advance(g, 1.4);
  assert.deepEqual(v.flipPose, { rise: 0, angle: 0 });
  assert.equal(v.finishPhase, 'flip');
  v.advance(g, 1.2);
  assert.equal(v.finishPhase, 'complete');
  assert.equal(v.confetti.length, 0);
});
