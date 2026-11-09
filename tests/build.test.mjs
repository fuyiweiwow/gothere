import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('builds the editor and a self-contained hint-free play entry on the same engine', async () => {
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
  const files=await readdir(new URL('../dist/',import.meta.url));assert.ok(files.includes('gothere-play.html'));
  const play=await readFile(new URL('../dist/gothere-play.html',import.meta.url),'utf8');
  assert.ok(play.includes('function createSimulation'));assert.ok(play.includes('function startPlay'));
  assert.ok(!play.includes('id="level-hint"'));assert.ok(!play.includes('script-dialog'));assert.ok(!play.includes('CodeMirror'));
  assert.ok(!/<script[^>]+src=/i.test(play));assert.ok(!/<link[^>]+rel="stylesheet"/i.test(play));
});
