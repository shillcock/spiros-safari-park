import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Game, SPECIES, SIZES } from '../game-model.js';
import { WALK_LAYOUTS, WALK_FRAMES, walkFrame } from '../walk-animation.js';
import { ParkRenderer, VisualState } from '../presentation.js';

function renderer(reducedMotion = false) {
  const result = Object.create(ParkRenderer.prototype);
  const draws = [], transforms = [];
  const context = {
    drawImage(...args) { draws.push(args); },
    translate(...args) { transforms.push(['translate', ...args]); },
    scale(...args) { transforms.push(['scale', ...args]); },
  };
  result.ctx = new Proxy(context, { get: (target, key) => target[key] ?? (() => {}) });
  result.visual = new VisualState(reducedMotion);
  result.images = Object.fromEntries(Object.keys(WALK_LAYOUTS).flatMap(name => [[name, name], [`${name}_walk`, `${name}_walk`]]));
  return { result, draws, transforms };
}

test('approved sheets contain exactly twelve padded frames at the expected sizes', async () => {
  for (const [name, layout] of Object.entries(WALK_LAYOUTS)) {
    const png = await readFile(new URL(`../assets/animations/${name}-walk.png`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), layout.width * WALK_FRAMES, name);
    assert.equal(png.readUInt32BE(20), layout.height, name);
  }
  SPECIES.forEach((name, i) => {
    assert.equal(WALK_LAYOUTS[name].width - 24, SIZES[i][0]);
    assert.equal(WALK_LAYOUTS[name].height - 24, SIZES[i][1]);
  });
});

test('walk frames loop at twelve fps with stable padding and no model changes', () => {
  assert.equal(walkFrame('guide', 0).sx, 0);
  assert.equal(walkFrame('guide', .5).sx, 6 * 96);
  assert.equal(walkFrame('guide', 1).sx, 0);
  assert.equal(walkFrame('guide', -1).sx, 0);
  assert.equal(walkFrame('guide', Infinity), null);
  assert.equal(walkFrame('unknown', 0), null);
  assert.equal(walkFrame('guide', .5).dx, -16);
  assert.equal(walkFrame('guide', .5).dy, -8);
  assert.equal(walkFrame('zebra', .5).dx, -12);
});

test('walking draws an aligned sprite-sheet frame; idle and reduced motion use original artwork', () => {
  const { result, draws, transforms } = renderer();
  const body = Object.freeze({ x: 100, y: 80, w: 64, h: 144 });
  result.visual.time = .5;
  result.actor('guide', body, true, true);
  assert.deepEqual(transforms, [['translate', 164, 80], ['scale', -1, 1]]);
  assert.deepEqual(draws[0], ['guide_walk', 576, 0, 96, 168, -16, -8, 96, 168]);
  result.actor('guide', body, false, false);
  assert.deepEqual(draws[1], ['guide', 0, 0, 64, 144]);
  result.visual.reducedMotion = true;
  result.actor('guide', body, false, true);
  assert.deepEqual(draws[2], ['guide', 0, 0, 64, 144]);
});

test('missing animation assets fall back to the original sprite', () => {
  const { result, draws } = renderer();
  delete result.images.guide_walk;
  result.actor('guide', { x: 0, y: 0, w: 64, h: 144 }, false, true);
  assert.deepEqual(draws[0], ['guide', 0, 0, 64, 144]);
});

test('animals animate while wandering, but carried animals do not walk in mid-air', () => {
  const { result, draws } = renderer();
  const g = new Game();
  g.animals.forEach(a => { a.vx = 1; });
  const carried = g.animals[0];
  carried.carried = true; carried.cage = null; g.player.carrying = carried;
  const snapshot = JSON.stringify(g);
  result.draw(g, false, true);
  assert.ok(draws.some(args => args[0] === 'guide_walk'));
  assert.ok(draws.some(args => args[0] === 'elephant_walk'));
  assert.ok(draws.some(args => args[0] === 'beaver'));
  assert.ok(!draws.some(args => args[0] === 'beaver_walk'));
  assert.equal(JSON.stringify(g), snapshot);
});

test('pause retains the player frame and finishing uses original art for the flip', () => {
  const { result, draws } = renderer();
  const g = new Game();
  result.visual.time = .5;
  result.draw(g, false, true);
  const before = draws.find(args => args[0] === 'guide_walk');
  draws.length = 0;
  result.draw(g, true, false);
  assert.deepEqual(draws.find(args => args[0] === 'guide_walk'), before);
  draws.length = 0;
  g.won = true; result.visual.finishTime = 1.4;
  result.draw(g, false, false);
  assert.ok(draws.some(args => args[0] === 'guide'));
  assert.ok(!draws.some(args => args[0] === 'guide_walk'));
  result.reset();
  assert.equal(result.playerWalking, false);
  assert.equal(result.visual.time, 0);
});
