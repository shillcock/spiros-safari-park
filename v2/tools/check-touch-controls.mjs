// Optional mobile browser regression. Serve the repo first.
// PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs BROWSER_EXECUTABLE=/path/to/chrome node v2/tools/check-touch-controls.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(process.env.GAME_URL || 'http://localhost:8000/v2/');
  await page.getByRole('button', { name: 'Click or press any key to play' }).click();
  const down = page.getByRole('button', { name: 'Move down', exact: true });
  await down.scrollIntoViewIfNeeded();
  const box = await down.boundingBox();
  assert.ok(box.width >= 60 && box.height >= 56);
  const styles = await down.evaluate(el => ({ selection: getComputedStyle(el).userSelect, touch: getComputedStyle(el).touchAction }));
  assert.equal(styles.selection, 'none'); assert.equal(styles.touch, 'none');
  // Real touch input exercises pointer capture, long hold and release outside the pad.
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const before = await page.evaluate(() => scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(1200);
  assert.equal(await down.evaluate(el => el.classList.contains('is-held')), true);
  assert.equal(await page.evaluate(() => getSelection().toString()), '');
  assert.equal(await page.evaluate(() => scrollY), before);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 5, y: Math.max(5, y - 130) }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  assert.equal(await down.evaluate(el => el.classList.contains('is-held')), false);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(100);
  assert.equal(await down.evaluate(el => el.classList.contains('is-held')), false);
  for (const selector of ['.touch button', '#restart', 'canvas']) {
    const allowed = await page.locator(selector).first().evaluate(el => el.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })));
    assert.equal(allowed, false, `${selector}: callout should be suppressed`);
  }
  const textAllowed = await page.locator('.instructions').evaluate(el => el.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })));
  assert.equal(textAllowed, true, 'ordinary text retains native behavior');
  console.log('PASS: long hold, held feedback, no selection/scroll, outside release, cancellation, scoped callout suppression');
} finally { await browser.close(); }
