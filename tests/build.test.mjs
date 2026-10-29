import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('builds only the single-level editor with scene and logic views', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  for(const name of ['index.html','editor.html','gothere-editor.html']){
    const html=await readFile(new URL('../dist/'+name,import.meta.url),'utf8');
    assert.ok(html.includes('id="standalone-editor"'));assert.ok(html.includes('id="display-mode"'));
    assert.ok(!html.includes('id="example-select"'));assert.ok(!html.includes('first-bridge'));
    assert.ok(html.includes('function createFirstLevel'));assert.ok(html.includes('function drawScene'));
    assert.ok(!/<script[^>]+src=/i.test(html));assert.ok(!/<link[^>]+rel="stylesheet"/i.test(html));
  }
  const files=await readdir(new URL('../dist/',import.meta.url));assert.ok(!files.includes('gothere-play.html'));
});
