import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('builds a self-contained playable HTML without a local server', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const html = await readFile(new URL('../dist/gothere-play.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<title>一定要到达那里</title>'));
  assert.ok(html.includes('id="portable-data"'));
  assert.ok(html.includes('function createSimulation'));
  assert.ok(!/<script[^>]+src=/i.test(html), 'scripts must be embedded');
  assert.ok(!/<link[^>]+rel="stylesheet"/i.test(html), 'styles must be embedded');
  assert.ok(!html.includes('src="/src/'));
  assert.ok(!html.includes('## 风险与范围控制'), 'private project notes are not published in the game package');
  const editor=await readFile(new URL('../dist/gothere-editor.html',import.meta.url),'utf8');
  assert.ok(editor.includes('<title>逻辑编辑器 · 一定要到达那里</title>'));assert.ok(editor.includes('id="standalone-editor"'));
  assert.ok(editor.includes('function drawDiagram'));
  assert.ok(!/<script[^>]+src=/i.test(editor));assert.ok(!/<link[^>]+rel="stylesheet"/i.test(editor));
  assert.ok(!editor.includes('function createRenderer'),'game artwork renderer must not be bundled');
  assert.ok(!editor.includes('data:image/'),'no embedded art assets');
  assert.ok(!editor.includes('const examples='),'game content collection must not be bundled');
});
