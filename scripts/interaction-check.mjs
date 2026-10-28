import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';

const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const saved=(page,key='gothere.logic-editor.v1')=>page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));return s.documents.find(d=>d.key===s.activeKey).level;},key);
const item=async()=> (await saved(page)).entities.find(e=>e.id==='item');
async function drag(target,dx,dy,{cancel=false}={}){
  const h=await target.boundingBox(),b=await page.locator('#editor-overlay').boundingBox();
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.waitForTimeout(80);
  await page.mouse.move(h.x+h.width/2+dx/1200*b.width,h.y+h.height/2+dy/640*b.height,{steps:15});
  await page.waitForTimeout(80);if(cancel)await page.keyboard.press('Escape');await page.mouse.up();
}
try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/editor.html');await page.locator('[data-ref="entity:item"]').click();
  const original=await saved(page);
  // Reproduced v0.8.0 bug: an uncommitted field overwrote the entire drag on mouse-up.
  await page.locator('#object-width').fill('70');await drag(page.locator('[data-resize="e"]'),80,0);
  assert.equal((await item()).width,150,'pending width commits before resizing and cannot overwrite the result');
  await page.keyboard.press('Control+z');assert.equal((await item()).width,70,'one drag is one undo');
  await page.keyboard.press('Control+z');assert.deepEqual(await saved(page),original);
  await drag(page.locator('[data-ref="entity:item"]'),70,-30);assert.equal((await item()).x,410);assert.equal((await item()).y,410);
  await page.keyboard.press('Control+z');assert.deepEqual(await saved(page),original);
  await drag(page.locator('[data-resize="se"]'),80,40,{cancel:true});assert.deepEqual(await saved(page),original,'Esc rolls back the preview without a history entry');
  await drag(page.locator('[data-resize="e"]'),900,0);assert.equal((await item()).width,600,'captured mouse release outside the map commits the drag');
  await page.keyboard.press('Control+z');assert.deepEqual(await saved(page),original);
  await page.keyboard.press('ArrowRight');assert.equal((await item()).x,341);
  await page.keyboard.press('Shift+ArrowDown');assert.equal((await item()).y,450);
  await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');assert.deepEqual(await saved(page),original);
  await page.keyboard.press('F2');assert.equal(await page.locator('#object-label').evaluate(e=>document.activeElement===e),true);
  await page.keyboard.type('改名测试');await page.keyboard.press('Escape');assert.equal((await item()).label,'可持有物');
  await page.keyboard.press('F2');await page.keyboard.type('新名字');await page.keyboard.press('Enter');assert.equal((await item()).label,'新名字');
  await page.keyboard.press('Control+z');assert.equal((await item()).label,'可持有物');await page.keyboard.press('Control+y');assert.equal((await item()).label,'新名字');
  await page.keyboard.press('Control+Shift+z'); // No redo entry: must not undo.
  assert.equal((await item()).label,'新名字');
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');assert.equal((await saved(page)).entities.length,5);
  let copied=(await saved(page)).entities.at(-1);assert.equal(copied.behaviors[0].actions[0].target,copied.id);
  await page.keyboard.press('Control+d');assert.equal((await saved(page)).entities.length,6);
  await page.keyboard.press('Delete');assert.equal((await saved(page)).entities.length,5);
  await page.keyboard.press('Control+z');assert.equal((await saved(page)).entities.length,6);
  await page.locator('#editor-tab-library').click();await page.locator('#scene-items .scene-item').filter({hasText:'新名字'}).first().click();await page.keyboard.press('Control+x');assert.ok(!(await saved(page)).entities.some(e=>e.id==='item'));
  await page.keyboard.press('Control+v');assert.ok((await saved(page)).entities.some(e=>e.label.includes('新名字')&&e.behaviors?.length));
  await page.keyboard.press('Control+f');assert.equal(await page.locator('#library-search').evaluate(e=>document.activeElement===e),true);
  const beforeTyping=await saved(page);await page.keyboard.type('hello');await page.keyboard.press('Control+a');await page.keyboard.press('Control+x');assert.deepEqual(await saved(page),beforeTyping,'text cut does not cut the scene object');
  await page.locator('#library-search').fill('');await page.locator('#library-search').press('Tab');await page.keyboard.press('w');assert.equal(await page.locator('#editor-overlay').getAttribute('data-mode'),'wire');
  await page.keyboard.press('v');assert.equal(await page.locator('#editor-overlay').getAttribute('data-mode'),'select');
  await page.keyboard.press('F1');assert.equal(await page.locator('#shortcuts-dialog').isVisible(),true);assert.match(await page.locator('#shortcuts-dialog').textContent(),/Ctrl\+Y/);await page.keyboard.press('Escape');
  await page.locator('[data-ref="entity:signal"]').click();await page.locator('#object-label').fill('保存当前输入');await page.keyboard.press('Control+s');assert.equal((await saved(page)).entities.find(e=>e.id==='signal').label,'保存当前输入');
  await page.keyboard.press('Control+o');assert.equal(await page.locator('#data-dialog').isVisible(),true);await page.keyboard.press('Escape');
  // New map is playable, and run/step/pause/stop leave its authoring document intact.
  await page.locator('#editor-overlay').focus();await page.keyboard.press('Control+n');const blank=await saved(page);assert.equal(blank.entities.length,0);
  await page.keyboard.press('F5');assert.equal(await page.locator('#simulation-panel').isVisible(),true);
  await page.keyboard.press('Space');assert.equal(await page.locator('#runtime-status').getAttribute('data-status'),'paused');
  const tick=Number((await page.locator('#runtime-tick').textContent()).match(/tick (\d+)/)[1]);await page.keyboard.press('F10');assert.ok((await page.locator('#runtime-tick').textContent()).includes('tick '+(tick+1)+' ·'));
  await page.keyboard.press('Shift+F5');assert.equal(await page.locator('#editor-overlay').isVisible(),true);assert.deepEqual(await saved(page),blank);
  await page.keyboard.press('F10');assert.equal(await page.locator('#runtime-tick').textContent(),'tick 1 · 0.02 s');await page.keyboard.press('Escape');
  // Downloadable file executes the same mouse interactions and hotkeys, without a server.
  const built=await buildEditor();await page.goto(pathToFileURL(built.path).href);await page.locator('[data-ref="entity:item"]').click();
  await page.locator('#object-width').fill('60');await drag(page.locator('[data-resize="ne"]'),40,-30);assert.equal((await item()).width,100);assert.equal((await item()).height,66);
  await page.keyboard.press('Control+z');assert.equal((await item()).width,60);
  // The retained game workshop has the same resize controls.
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('[data-example="example-carry"]').click();await page.locator('#open-editor').click();
  const first=(await saved(page,'gothere.editor.v1')).entities.find(e=>e.kind==='object');await page.locator('[data-ref="entity:'+first.id+'"]').click();
  assert.equal(await page.locator('[data-resize]').count(),8);await drag(page.locator('[data-resize="e"]'),40,0);
  assert.equal((await saved(page,'gothere.editor.v1')).entities.find(e=>e.id===first.id).width,first.width+40);
  assert.deepEqual(errors,[]);console.log('PASS interactions: pending inputs, mouse capture/outside release, drag cancel, Windows shortcuts, native text editing, preview keys, offline HTML and game workshop resize.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
