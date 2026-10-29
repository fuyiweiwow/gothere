import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { makeServer } from '../server.mjs';
import { buildEditor } from './build.mjs';

await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
const server=makeServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const draft=target=>target.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('gothere.logic-editor.v1'));return saved.documents.find(d=>d.key===saved.activeKey).level;});
async function freezeClock(target){await target.clock.install({time:new Date('2026-10-29T00:00:00Z')});await target.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));}
async function drag(target,handle,dx,dy){
  const h=await target.locator('[data-resize="'+handle+'"]').boundingBox(),b=await target.locator('#editor-overlay').boundingBox();
  await target.mouse.move(h.x+h.width/2,h.y+h.height/2);await target.mouse.down();
  await target.mouse.move(h.x+h.width/2+dx/1200*b.width,h.y+h.height/2+dy/640*b.height,{steps:10});await target.mouse.up();
}
async function loadSlope(target){
  await target.locator('#editor-overlay').waitFor();assert.equal(await target.locator('#example-select option[value="slopes"]').count(),1);
  await target.locator('#example-select').selectOption('slopes');await target.locator('#load-example').click();
}
try{
  await freezeClock(page);await page.goto(process.argv[2]??'http://127.0.0.1:'+server.address().port+'/editor.html?example=slopes');
  await page.locator('#editor-overlay').waitFor();assert.equal((await draft(page)).id,'editor-slopes');await loadSlope(page);
  const initial=await draft(page);assert.equal(initial.world.physics.gravity,900);
  await page.locator('[data-ref="platform:1"]').click();assert.equal(await page.locator('#object-slope').isChecked(),true);
  assert.equal(await page.locator('#object-y-end').inputValue(),'340');
  await page.locator('#object-y-end').fill('360');await page.locator('#object-y-end').press('Enter');
  assert.equal((await draft(page)).platforms[1].yEnd,360);
  await drag(page,'e',30,40);let road=(await draft(page)).platforms[1];
  assert.equal(road.width,270);assert.equal(road.y,200);assert.equal(road.yEnd,400);
  await drag(page,'w',-20,-20);road=(await draft(page)).platforms[1];assert.equal(road.x,180);assert.equal(road.y,180);assert.equal(road.yEnd,400);
  await page.locator('#editor-undo').click();await page.locator('#editor-undo').click();await page.locator('#editor-undo').click();
  assert.deepEqual(await draft(page),initial);
  await page.locator('#editor-tab-map').click();assert.equal(await page.locator('#edit-physics').isChecked(),true);
  await page.locator('#edit-gravity').fill('1200');await page.locator('#edit-gravity').press('Enter');
  assert.equal((await draft(page)).world.physics.gravity,1200);
  await page.locator('#edit-physics').uncheck();assert.match(await page.locator('#editor-errors').textContent(),/重力模式/);
  await page.locator('#editor-undo').click();await page.locator('#editor-undo').click();assert.deepEqual(await draft(page),initial);
  await page.reload();await page.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(page),initial);
  await page.locator('#preview-toggle').click();await page.clock.runFor(5000);
  assert.match(await page.locator('#runtime-actor').textContent(),/falling/);assert.match(await page.locator('#runtime-status').textContent(),/运行中/);
  await page.locator('#preview-toggle').click();
  await page.screenshot({path:new URL('../artifacts/slopes-falling.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.locator('#preview-toggle').click();
  await page.clock.runFor(10000);assert.match(await page.locator('#runtime-status').textContent(),/已到达终点/);
  assert.match(await page.locator('#runtime-log').textContent(),/落到/);
  await page.locator('#editor-return').click();assert.deepEqual(await draft(page),initial);
  await page.locator('[data-ref="platform:1"]').click();
  await page.screenshot({path:new URL('../artifacts/slopes-editor.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  const portable=await buildEditor(),offline=await context.newPage(),requests=[];
  offline.on('pageerror',error=>errors.push(error.message));offline.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  await freezeClock(offline);await offline.goto(pathToFileURL(portable.path).href);await loadSlope(offline);
  await offline.locator('[data-ref="platform:1"]').click();await drag(offline,'e',20,20);
  assert.equal((await draft(offline)).platforms[1].yEnd,360);
  await offline.locator('#editor-undo').click();await offline.locator('#preview-toggle').click();await offline.clock.runFor(15000);
  assert.match(await offline.locator('#runtime-status').textContent(),/已到达终点/);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  console.log('PASS slopes: endpoint dragging, inspector, gravity settings, validation, undo/reload, visible falling, landing, completion and offline HTML.');
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
