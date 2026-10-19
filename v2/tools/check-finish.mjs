// Optional browser regression check. Requires Playwright and a running server.
// PLAYWRIGHT_MODULE can point at a local Playwright install (file:// URL).
// BROWSER_EXECUTABLE can select an installed Chrome instead of bundled Chromium.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ reducedMotion });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000/v2/');
    await page.getByRole('button', { name: 'Click or press any key to play' }).waitFor();
    // Instrument the real model and audio nodes in the browser, not production code.
    await page.evaluate(async () => {
      const { Game } = await import('./game-model.js');
      const { VisualState } = await import('./presentation.js');
      const advance = VisualState.prototype.advance;
      VisualState.prototype.advance = function(...args) { window.testVisual = this; return advance.apply(this, args); };
      const step = Game.prototype.step;
      Game.prototype.step = function(keys) { window.testGame = this; return step.call(this, keys); };
      window.testSounds = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) {
        window.testSounds.push(this);
        return start.apply(this, args);
      };
    });
    await page.getByRole('button', { name: 'Click or press any key to play' }).click();
    await page.clock.runFor(100);
    await page.evaluate(() => {
      const g = window.testGame;
      g.time = 24000; g.escaped = true;
      g.animals.forEach((a, i) => { a.cage = i === 5 ? null : i; a.carried = i === 5; a.speed = 0; a.count = 1000; });
      g.player.carrying = g.animals[5];
      Object.assign(g.player, { x: 690, y: 336 });
    });
    await page.clock.runFor(1000);
    await page.keyboard.down('ArrowDown'); await page.clock.runFor(100); await page.keyboard.up('ArrowDown');
    assert.equal(await page.evaluate(() => window.testGame.won), true);
    const replay = page.getByRole('button', { name: 'Play again', exact: true });
    assert.equal(await replay.isVisible(), false, 'Wait for the final gate before showing the victory screen');
    const duration = await page.evaluate(() => window.testSounds.at(-1).buffer.duration);
    assert.ok(Math.abs(duration - 4.5) < .02, 'Replay the zebra recording on delivery');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.clock.runFor(5000);
    assert.equal(await replay.isVisible(), false, 'Pause freezes the finishing sequence');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    // Keep real audio time frozen; this test explicitly signals each completion.
    await page.evaluate(() => window.testSounds.at(-1).context.suspend());
    await page.clock.runFor(1000);
    assert.equal(await replay.isVisible(), false, 'Keep the park visible during the flip');
    // Deterministically signal audio completion to verify ordering without waiting
    // through the full recordings. Web Audio playback is not driven by page.clock.
    await page.evaluate(() => {
      const source = window.testSounds.at(-1), ended = source.onended;
      source.onended = null; source.stop(); ended();
    });
    assert.ok(Math.abs(await page.evaluate(() => window.testSounds.at(-1).buffer.duration) - .63) < .02,
      'Praise follows the species recording, never overlaps it');
    await page.clock.runFor(2000);
    assert.equal(await replay.isVisible(), true, 'Show victory after landing');
    assert.equal(await page.evaluate(() => window.testVisual.awardPose), null, 'Badge waits for ranger narration');
    await page.evaluate(() => {
      const source = window.testSounds.at(-1), ended = source.onended;
      source.onended = null; source.stop(); ended();
    });
    await page.clock.runFor(150);
    assert.ok(Math.abs(await page.evaluate(() => window.testSounds.at(-1).buffer.duration) - 11.55) < .02,
      'Victory narration follows the return recording and praise');
    assert.ok(await page.evaluate(() => window.testVisual.awardPose !== null), 'Ranger narration starts badge');
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(() => window.testVisual.awardPose.scale), 1);
    await page.clock.runFor(7500);
    assert.deepEqual(await page.evaluate(() => window.testVisual.awardPose),
      { scale: .32, x: 690, y: 245, alpha: 1, backdrop: 0 }, 'Badge docks beside the closing lettering');
    await replay.click(); await page.clock.runFor(100);
    assert.equal(await page.evaluate(() => window.testGame.won), false);
    assert.equal(await page.evaluate(() => window.testVisual.awardPose), null);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS (${reducedMotion}): last gate, pause, celebration delay, return audio ordering, victory, replay.`);
  }
} finally { await browser.close(); }
