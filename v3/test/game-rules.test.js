import test from 'node:test';
import assert from 'node:assert/strict';
import { readOptions, optionsQuery, findLassoCatch, cameraFraming, shuffled } from '../game-rules.js';
const animal = (x, z, state = 'free') => ({ state, group: { position: { x, z } } });

test('cage shuffle is a permutation and preserves cage object identities', () => {
  const cages = ['beaver', 'elephant', 'monkey', 'penguin', 'snake', 'zebra'].map(name => ({ name }));
  const result = shuffled(cages, () => 0);
  assert.notDeepEqual(result, cages);
  assert.equal(new Set(result).size, 6);
  assert.ok(result.every(cage => cages.includes(cage)));
  assert.equal(cages[0].name, 'beaver');
  assert.deepEqual(shuffled(cages, () => .999), cages);
});

test('only the two supported options are parsed and serialized', () => {
  assert.deepEqual(readOptions('?variant=A&camera=manual&zoom=3'), { animalStyle: 'toys', catchMode: 'lasso' });
  for (const style of ['paper', 'toys']) for (const mode of ['touch', 'lasso']) {
    assert.deepEqual(readOptions(optionsQuery(style, mode)), { animalStyle: style, catchMode: mode });
  }
  assert.deepEqual(readOptions('?animals=unknown&catch=unknown'), readOptions(''));
});
test('lasso catches across a whole frame and picks the first hit', () => {
  const near = animal(.1, 1), far = animal(0, 3);
  assert.equal(findLassoCatch([far, near], { x: 0, z: 0 }, { x: 0, z: 4 }), near);
});
test('lasso misses outside its loop and ignores non-free animals', () => {
  assert.equal(findLassoCatch([animal(1, 2), animal(0, 2, 'home'), animal(0, 2, 'reeled'), animal(0, 2, 'locked')],
    { x: 0, z: 0 }, { x: 0, z: 4 }), null);
});
test('stationary loop and reversed casts remain well defined', () => {
  const target = animal(.2, 0);
  assert.equal(findLassoCatch([target], { x: 0, z: 0 }, { x: 0, z: 0 }), target);
  assert.equal(findLassoCatch([animal(0, -2)], { x: 0, z: 0 }, { x: 0, z: -4 })?.state, 'free');
});
test('camera widens for carrying, respects bounds, and rests for victory or reduced motion', () => {
  const state = { released: true, won: false, runTime: 4, carrying: false, player: { x: 12, z: 8 }, reducedMotion: false };
  assert.deepEqual(cameraFraming(state), { x: 5, z: 3, zoom: 1.35 });
  assert.equal(cameraFraming({ ...state, carrying: true }).zoom, 1.08);
  for (const change of [{ won: true }, { reducedMotion: true }, { released: false }, { runTime: 1 }]) {
    assert.deepEqual(cameraFraming({ ...state, ...change }), { x: 0, z: -.5, zoom: 1 });
  }
});
