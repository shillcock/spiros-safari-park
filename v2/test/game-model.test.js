import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STEP } from '../game-model.js';

function ready() {
  const game = new Game(() => 0.5);
  game.time = 23001;
  game.escaped = true;
  game.animals.forEach((a, i) => {
    a.cage = null; a.x = i * 110; a.y = 200;
    a.speed = 0; a.count = 1000;
  });
  return game;
}

test('starts with six animals in matching cages, and a centered player', () => {
  const g = new Game();
  assert.equal(g.animals.length, 6);
  g.animals.forEach((a, i) => assert.equal(g.cages[a.cage].name, a.name));
  assert.equal(g.player.x, 368);
  assert.equal(g.score, 0);
});
test('escape occurs after 16 seconds, catching only after 23 seconds', () => {
  const g = new Game(() => 0.5);
  g.time = 16000 - STEP;
  assert.ok(!g.step().includes('escaped'));
  assert.ok(g.step().includes('escaped'));
  assert.ok(g.animals.every(a => a.cage === null));
  g.time = 23000 - STEP;
  const a = g.animals[0];
  Object.assign(a, { x: g.player.x, y: g.player.y, speed: 0, count: 100 });
  g.step();
  assert.equal(g.player.carrying, null);
  assert.deepEqual(g.step(), ['beaver', 'gotcha']);
  assert.equal(g.player.carrying, a);
});
test('movement has original priority, speed, and bounds', () => {
  const g = new Game();
  g.player.y = 100;
  g.step(new Set(['up', 'right']));
  assert.equal(g.player.y, 95);
  assert.equal(g.player.x, 368);
  for (let i = 0; i < 150; i++) g.step(new Set(['down']));
  assert.equal(g.player.y, 346);
});
test('pickup is automatic, one at a time, with original carrying offset', () => {
  const g = ready();
  for (const a of g.animals) { a.x = g.player.x; a.y = g.player.y; }
  g.step();
  assert.equal(g.animals.filter(a => a.carried).length, 1);
  g.step();
  assert.equal(g.player.carrying.x + g.player.carrying.w / 2, g.player.x + 42);
  assert.equal(g.player.carrying.y + g.player.carrying.h, g.player.y + 62);
});
test('wrong cage retains animal; matching cage delivers it', () => {
  const g = ready();
  const a = g.animals[0];
  a.carried = true; g.player.carrying = a;
  Object.assign(g.player, { x: 160, y: 336 });
  assert.deepEqual(g.step(new Set(['down'])), ['wrong_cage']);
  assert.equal(g.player.carrying, a);
  g.step(new Set(['up']));
  g.player.x = 20;
  assert.deepEqual(g.step(new Set(['down'])), ['returned:beaver']);
  assert.equal(g.player.carrying, null);
  assert.equal(a.cage, 0);
  assert.equal(g.score, 1);
  g.step();
  assert.ok(a.y >= 480 && a.y + a.h <= 600);
});
test('sideways skimming across every cage cannot deliver or retry', () => {
  for (const direction of ['left', 'right']) {
    const g = ready(), a = g.animals[direction === 'right' ? 5 : 0];
    a.carried = true; g.player.carrying = a;
    Object.assign(g.player, { x: direction === 'right' ? 0 : 736, y: 346 });
    for (let n = 0; n < 150; n++) assert.deepEqual(g.step(new Set([direction])), []);
    assert.equal(g.player.carrying, a);
    assert.equal(a.cage, null);
    // Pressing down while still against the cages also cannot deliver.
    assert.deepEqual(g.step(new Set(['down'])), []);
    assert.deepEqual(g.step(), []);
    g.step(new Set(['up']));
    g.step(new Set(['up']));
    assert.deepEqual(g.step(new Set(['down'])), [`returned:${a.name}`]);
    assert.equal(g.player.carrying, null);
  }
});
test('each downward attempt selects only the cage under the player center', () => {
  const g = ready(), a = g.animals[0];
  a.carried = true; g.player.carrying = a;
  // Overlaps both cages, but the center lies in the elephant cage.
  Object.assign(g.player, { x: 110, y: 336 });
  assert.deepEqual(g.step(new Set(['down'])), ['wrong_cage']);
  assert.equal(a.cage, null);
  assert.deepEqual(g.step(new Set(['down'])), []);
  assert.deepEqual(g.step(new Set(['down', 'left'])), []);
  assert.deepEqual(g.step(), []);
  g.step(new Set(['up']));
  g.step(new Set(['up']));
  assert.deepEqual(g.step(new Set(['down'])), ['wrong_cage']);
});
test('wrong entry into an occupied cage still provides feedback', () => {
  const g = ready(), a = g.animals[0];
  a.carried = true; g.player.carrying = a;
  g.animals[1].cage = 1;
  Object.assign(g.player, { x: 160, y: 336 });
  assert.deepEqual(g.step(new Set(['down'])), ['wrong_cage']);
});
test('final delivery places animal inside the cage before simulation freezes', () => {
  const g = ready();
  g.animals.forEach((a, i) => { a.cage = i; });
  const a = g.animals[5]; a.cage = null; a.carried = true;
  g.player.carrying = a;
  Object.assign(g.player, { x: 690, y: 336 });
  assert.deepEqual(g.step(new Set(['down'])), ['returned:zebra', 'win']);
  assert.ok(a.y >= 480 && a.y + a.h <= 600);
  assert.ok(a.x >= 665 && a.x + a.w <= 798);
  assert.equal(a.carried, false);
  assert.deepEqual(g.step(), []);
});
test('returning all six wins exactly once and stops simulation', () => {
  const g = ready();
  g.animals.forEach((a, i) => { a.cage = i; });
  assert.deepEqual(g.step(), ['win']);
  assert.equal(g.phase, 'won');
  assert.equal(g.score, 6);
  const time = g.time;
  assert.deepEqual(g.step(), []);
  assert.equal(g.time, time);
});
test('caged animals remain confined and never escape again', () => {
  const g = ready();
  g.animals[0].cage = 0;
  for (let i = 0; i < 1000; i++) g.step();
  const a = g.animals[0];
  assert.equal(a.cage, 0);
  assert.ok(a.x >= 0 && a.x + a.w <= 133 && a.y >= 480 && a.y + a.h <= 600);
});
