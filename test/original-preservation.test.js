import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const original = new URL('../v1/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('./original-checksums.json', import.meta.url), 'utf8'));

test('the frozen original code, assets, and tests are unchanged', async () => {
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, directory), `${path}/`);
      else files.push(path);
    }
  }
  await walk(original);
  assert.deepEqual(files.sort(), Object.keys(manifest).sort(), 'Original file list changed');
  for (const [file, expected] of Object.entries(manifest)) {
    const actual = createHash('sha256').update(await readFile(new URL(file, original))).digest('hex');
    assert.equal(actual, expected, `Frozen original modified: ${file}. Make changes in v2/ instead.`);
  }
});
