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
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.logic-editor.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const near=(a,b)=>assert.ok(Math.abs(a-b)<0.01,`${a} != ${b}`);
async function load(p){await p.locator('#example-select').selectOption('rotation');await p.locator('#load-example').click();}
async function play(p){
  await p.locator('#preview-toggle').click();await p.locator('[data-source="release"]').click();
  await p.clock.runFor(500);assert.match(await p.locator('#runtime-entities').textContent(),/旋转中/);
  await p.clock.runFor(16000);assert.match(await p.locator('#runtime-status').textContent(),/已到达终点/);
  assert.match(await p.locator('#runtime-log').textContent(),/旋转结束/);
  await p.locator('#editor-return').click();
}
try{
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  await page.goto(process.argv[2]??'http://127.0.0.1:'+server.address().port+'/editor.html?example=rotation');
  await page.locator('#editor-overlay').waitFor();assert.equal((await draft(page)).id,'editor-rotation');await load(page);
  const initial=await draft(page);
  await page.locator('[data-ref="entity:panel"]').click();
  assert.equal(await page.locator('#object-pose').isChecked(),true);assert.equal(await page.locator('#object-surface').isChecked(),true);
  assert.equal(await page.locator('[data-event="rotated"]').count(),1);
  const row=page.locator('[data-behavior="lower"] .action-row').first();assert.equal(await row.locator('[data-action-type]').inputValue(),'rotate');
  await row.locator('[data-rotate-angle]').fill('25');await row.locator('[data-rotate-angle]').press('Enter');
  assert.equal((await draft(page)).entities.find(e=>e.id==='panel').behaviors[0].actions[0].angle,25);
  await page.locator('#editor-undo').click();
  await page.locator('#object-pivot').fill('0.5');await page.locator('#object-pivot').press('Enter');
  assert.equal((await draft(page)).entities.find(e=>e.id==='panel').pose.pivot,0.5);await page.locator('#editor-undo').click();
  const h=await page.locator('[data-resize="e"]').boundingBox(),b=await page.locator('#editor-overlay').boundingBox();
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();
  await page.mouse.move(h.x+h.width/2-40.1923788647/1200*b.width,h.y+h.height/2+150/640*b.height,{steps:10});await page.mouse.up();
  let panel=(await draft(page)).entities.find(e=>e.id==='panel');near(panel.pose.angle,30);near(panel.width,300);
  await page.locator('#editor-undo').click();assert.deepEqual(await draft(page),initial);
  await page.locator('#object-surface').uncheck();assert.equal((await draft(page)).entities.find(e=>e.id==='panel').surface,undefined);
  await page.locator('#editor-undo').click();
  await page.reload();await page.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(page),initial);
  await play(page);assert.deepEqual(await draft(page),initial);
  await page.locator('[data-ref="entity:panel"]').click();
  await page.screenshot({path:new URL('../artifacts/rotation-editor.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  const portable=await buildEditor(),offline=await context.newPage(),requests=[];
  offline.on('pageerror',e=>errors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await offline.clock.install();await offline.goto(pathToFileURL(portable.path).href);await load(offline);await play(offline);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  console.log('PASS rotation: inspector, action editing, completion slot, endpoint drag, undo/reload, real slope route and offline playback.');
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
