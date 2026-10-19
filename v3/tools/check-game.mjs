// Serve the repo first. Browser tests instrument the served module only; no test hooks ship.
// PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs BROWSER_EXECUTABLE=/path/to/chrome node v3/tools/check-game.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  args: ['--enable-unsafe-swiftshader'] });
const base = process.env.BASE_URL || 'http://localhost:8000';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/game.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.gameCheck = {
        prepare(name) {
          runTime = 4; clickTarget = null; keys.clear();
          player.group.position.set(0, 0, 3); facing.set(0, 0, -1);
          animals.filter(a => a.state === 'free').forEach((a,i) => {
            a.group.position.set(11, 0, i); a.speed = 0; a.vx = a.vz = 0;
          });
          const target = animals.find(a => a.name === name);
          target.group.position.set(0, 0, catchMode === 'touch' ? 2.5 : .5);
        },
        entrance(wrong = false) {
          const cage = cages.find(c => wrong ? c.name !== carrying.name : c.name === carrying.name);
          player.group.position.set(cage.x, 0, -4.7);
          clickTarget = new THREE.Vector3(cage.x, 0, -5.08);
        },
        step(n) { for (let i=0;i<n;i++) update(.05); },
        state() { return { carrying: carrying?.name ?? null, lasso: lasso?.phase ?? null,
          states: animals.map(a => a.state), won, catchMode, animalStyle,
          camera: camera.type, zoom: followZoom, toys: animals[0].toy.root.visible,
          paper: animals[0].card.visible }; }
      };` });
  });
  for (const style of ['toys', 'paper']) for (const mode of ['lasso', 'touch']) {
    await page.goto(`${base}/v3/?animals=${style}&catch=${mode}&variant=A&camera=manual`);
    await page.waitForSelector('#loading', { state: 'hidden' });
    assert.equal(await page.locator('button[aria-pressed]').count(), 2);
    assert.equal(await page.locator('#state, #zoom, #carry, #previous, #next, #camera-mode').count(), 0);
    assert.equal(new URL(page.url()).searchParams.has('variant'), false);
    await page.click('#release');
    for (const name of ['beaver', 'elephant', 'monkey', 'penguin', 'snake', 'zebra']) {
      await page.evaluate(n => gameCheck.prepare(n), name);
      if (mode === 'lasso') {
        const before = await page.evaluate(() => scrollY);
        await page.keyboard.press('Space');
        assert.equal(await page.evaluate(() => scrollY), before);
      }
      await page.evaluate(() => gameCheck.step(30));
      let state = await page.evaluate(() => gameCheck.state());
      assert.equal(state.carrying, name, `${style}/${mode}: pickup ${name}`);
      assert.equal(state.camera, 'PerspectiveCamera');
      assert.equal(state.toys, style === 'toys'); assert.equal(state.paper, style === 'paper');
      if (name === 'beaver') {
        await page.evaluate(() => { gameCheck.entrance(true); gameCheck.step(5); });
        assert.equal((await page.evaluate(() => gameCheck.state())).carrying, name, 'wrong cage keeps animal');
      }
      await page.evaluate(() => { gameCheck.entrance(); gameCheck.step(5); });
      assert.equal((await page.evaluate(() => gameCheck.state())).carrying, null, 'correct cage delivers');
    }
    await page.evaluate(() => gameCheck.step(30));
    assert.equal((await page.evaluate(() => gameCheck.state())).won, true);
    assert.equal(await page.locator('#victory').isVisible(), true);
    await page.click('#again');
    assert.equal((await page.evaluate(() => gameCheck.state())).won, false);
    await page.click('#reset');
    assert.deepEqual((await page.evaluate(() => gameCheck.state())).states, Array(6).fill('locked'));
    console.log(`PASS: ${style}/${mode} — six pickups/returns, wrong cage, victory, replay, reset`);
  }
  // Switch catch method while an animal is still reeling in; don't strand it.
  await page.click('#catch-mode'); // final combination was touch
  await page.click('#release');
  await page.evaluate(() => gameCheck.prepare('beaver'));
  await page.keyboard.press('Space');
  await page.evaluate(() => gameCheck.step(5));
  await page.click('#catch-mode');
  let state = await page.evaluate(() => gameCheck.state());
  assert.equal(state.lasso, null); assert.equal(state.states.includes('reeled'), false);
  await page.click('#animals');
  await page.reload(); await page.waitForSelector('#loading', { state: 'hidden' });
  state = await page.evaluate(() => gameCheck.state());
  assert.equal(state.catchMode, 'touch'); assert.equal(state.animalStyle, 'toys');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: mid-cast mode switch, URL reload, mobile layout, no browser errors');
} finally { await browser.close(); }
