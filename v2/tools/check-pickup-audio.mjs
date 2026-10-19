// Optional deterministic browser check; requires a running site and Playwright.
// Uses the same environment overrides as check-finish.mjs.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const near = (actual, expected) => Math.abs(actual - expected) < .02;

async function setup() {
  const page = await browser.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.clock.install();
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000/v2/');
  await page.getByRole('button', { name: 'Click or press any key to play' }).waitFor();
  await page.evaluate(async () => {
    const { Game } = await import('./game-model.js');
    const step = Game.prototype.step;
    Game.prototype.step = function(keys) { window.testGame = this; return step.call(this, keys); };
    window.testSounds = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) { window.testSounds.push(this); return start.apply(this, args); };
  });
  await page.getByRole('button', { name: 'Click or press any key to play' }).click();
  await page.clock.runFor(50);
  await page.evaluate(() => window.testSounds.at(-1).context.suspend());
  await page.evaluate(() => {
    const g = window.testGame;
    g.time = 24000; g.escaped = true;
    g.animals.forEach(a => { a.cage = null; a.speed = 0; a.vx = a.vy = 0; a.x = 650; a.y = 20; });
    Object.assign(g.player, { x: 200, y: 200 });
    Object.assign(g.animals[0], { x: 200, y: 200 });
  });
  await page.clock.runFor(50);
  assert.equal(await page.evaluate(() => window.testGame.player.carrying?.name), 'beaver');
  assert.ok(near(await duration(page), 2.64), 'Gotcha starts first, without animal overlap');
  return page;
}
const duration = page => page.evaluate(() => window.testSounds.at(-1).buffer.duration);
const count = page => page.evaluate(() => window.testSounds.length);
async function finishSound(page) {
  await page.evaluate(() => {
    const source = window.testSounds.at(-1), ended = source.onended;
    source.onended = null; source.stop(); ended?.();
  });
}
async function enterCage(page, correct) {
  await page.evaluate(correct => { Object.assign(window.testGame.player, { x: correct ? 20 : 160, y: 336 }); }, correct);
  await page.keyboard.down('ArrowDown'); await page.clock.runFor(50); await page.keyboard.up('ArrowDown');
}

try {
  const normal = await setup();
  const before = await count(normal);
  await normal.clock.runFor(1000);
  assert.equal(await count(normal), before, 'No overlap before gotcha ends');
  await finishSound(normal);
  assert.ok(near(await duration(normal), 3), 'Animal recording follows gotcha');
  assert.equal(await count(normal), before + 1);
  await normal.close();
  for (const action of ['return', 'wrong', 'restart']) {
    const page = await setup();
    await page.evaluate(() => { window.stalePickupEnd = window.testSounds.at(-1).onended; });
    if (action === 'restart') await page.getByRole('button', { name: 'Restart', exact: true }).click();
    else await enterCage(page, action === 'return');
    assert.ok(near(await duration(page), action === 'restart' ? 13 : action === 'return' ? 3 : 3.6));
    const sounds = await count(page);
    await page.evaluate(() => window.stalePickupEnd());
    assert.equal(await count(page), sounds, `${action} cancels queued pickup animal, even for a late callback`);
    assert.deepEqual(page.errors, []);
    await page.close();
  }
  const protectedReturn = await setup();
  await enterCage(protectedReturn, true);
  const returned = await count(protectedReturn);
  await protectedReturn.evaluate(() => {
    Object.assign(window.testGame.player, { x: 300, y: 200 });
    Object.assign(window.testGame.animals[2], { x: 300, y: 200 });
  });
  await protectedReturn.clock.runFor(50);
  assert.equal(await protectedReturn.evaluate(() => window.testGame.player.carrying?.name), 'monkey');
  assert.equal(await count(protectedReturn), returned, 'New pickup must not interrupt return narration');
  await finishSound(protectedReturn);
  assert.ok(near(await duration(protectedReturn), .63), 'Praise follows return recording');
  await finishSound(protectedReturn);
  await protectedReturn.clock.runFor(100);
  assert.equal(await count(protectedReturn), returned + 1, 'Suppressed pickups are not replayed later');
  assert.deepEqual(protectedReturn.errors, []);
  await protectedReturn.close();
  console.log('PASS: gotcha → animal; return/wrong/restart cancellation; return audio protected; no stale pickup queue.');
} finally { await browser.close(); }
