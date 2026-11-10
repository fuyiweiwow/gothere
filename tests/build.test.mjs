import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {ASSETS} from '../src/content/library.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createPaintedBusStopLevel} from '../src/editor/painted-bus-stop.js';
import {createOfficeArrival} from '../src/editor/office-arrival.js';
import {standaloneAssets} from '../scripts/standalone-assets.mjs';

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
  assert.ok(!play.includes(ASSETS.find(a=>a.id==='paintedBusBack').src),'the chapter must not ship unrelated painted-bus pixels');
  for(const asset of standaloneAssets(createCommuteChapter(),ASSETS))assert.ok(play.includes(asset.src),'missing chapter image '+asset.id);
  assert.ok(play.includes('function createSimulation'));assert.ok(play.includes('function startPlay'));
  assert.ok(!play.includes('id="level-hint"'));assert.ok(!play.includes('script-dialog'));assert.ok(!play.includes('CodeMirror'));
  assert.ok(!/<script[^>]+src=/i.test(play));assert.ok(!/<link[^>]+rel="stylesheet"/i.test(play));
  const painted=await readFile(new URL('../dist/gothere-painted-bus.html',import.meta.url),'utf8');
  for(const asset of standaloneAssets(createPaintedBusStopLevel(),ASSETS))assert.ok(painted.includes(asset.src),'missing painted image '+asset.id);
  assert.ok(painted.includes('<script id="standalone-play" type="application/json">{"sample":"painted-bus-stop"}</script>'));
  const office=await readFile(new URL('../dist/gothere-office.html',import.meta.url),'utf8');
  assert.equal(await readFile(new URL('../dist/office.html',import.meta.url),'utf8'),office);
  for(const asset of standaloneAssets(createOfficeArrival(),ASSETS))assert.ok(office.includes(asset.src),'missing office image '+asset.id);
  assert.ok(office.includes('<script id="standalone-play" type="application/json">{"sample":"office-arrival"}</script>'));
  assert.ok(!office.includes('CodeMirror'));assert.ok(!office.includes(ASSETS.find(a=>a.id==='paintedBusBack').src));
});
