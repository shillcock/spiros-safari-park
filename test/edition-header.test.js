import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all editions have the same navigation and styling, with only the current tab differing', async () => {
  let expectedHeader, expectedStyles;
  for (const version of ['v1', 'v2', 'v3']) {
    const html = await readFile(new URL(`../${version}/index.html`, import.meta.url), 'utf8');
    const css = await readFile(new URL(`../${version}/style.css`, import.meta.url), 'utf8');
    const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
    assert.ok(header);
    assert.equal((header.match(/aria-current="page"/g) || []).length, 1);
    assert.ok(header.includes(`href="../${version}/" aria-current="page"`));
    assert.ok(html.indexOf(header) < html.indexOf('<main>'));
    const normalized = header.replace(' aria-current="page"', '');
    const styles = css.match(/\/\* Identical edition header[\s\S]*?(?=footer \{)/)?.[0];
    assert.ok(styles);
    expectedHeader ??= normalized; expectedStyles ??= styles;
    assert.equal(normalized, expectedHeader);
    assert.equal(styles, expectedStyles);
  }
});
