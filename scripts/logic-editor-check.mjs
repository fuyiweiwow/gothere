import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { makeServer } from '../server.mjs';
import { buildEditor } from './build.mjs';

await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce',acceptDownloads:true});
const page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const draft=()=>page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('gothere.logic-editor.v1'));return saved.documents.find(d=>d.key===saved.activeKey).level;});
async function wirePoint(){return page.locator('.event-wire').first().evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()*.4),m=path.getScreenCTM();return {x:m.a*p.x+m.e,y:m.d*p.y+m.f};});}
try{
  await page.clock.install();await page.goto('http://127.0.0.1:'+server.address().port+'/editor.html');
  await page.locator('.library-item').first().waitFor();
  assert.equal(await page.locator('#level-tabs').count(),0);assert.equal(await page.locator('#editor-overlay').isVisible(),true);
  const map=await page.locator('.map-shell').boundingBox(),panel=await page.locator('#editor-panel').boundingBox();assert.ok(panel.x>=map.x+map.width);
  assert.ok(!requests.some(url=>/scene\.js|examples\.js|levels\.js|\.(png|jpe?g|webp)/i.test(url)));
  await page.locator('[data-category="traversal"]').click();assert.equal(await page.locator('.library-item').count(),4);
  await page.locator('#library-search').fill('lift');assert.equal(await page.locator('.library-item').count(),1);
  await page.locator('#library-search').fill('');await page.locator('[data-category="all"]').click();
  await page.locator('[data-ref="entity:item"]').click();assert.equal(await page.locator('.event-slot').count(),4);assert.equal(await page.locator('.behavior-slot').count(),2);
  assert.equal(await page.locator('#object-image').count(),0,'art UI is absent');
  await page.locator('#object-label').fill('逻辑物体');await page.locator('#object-label').press('Tab');assert.equal((await draft()).entities.find(e=>e.id==='item').label,'逻辑物体');
  await page.locator('#editor-undo').click();assert.equal((await draft()).entities.find(e=>e.id==='item').label,'可持有物');
  const p=await wirePoint();await page.mouse.click(p.x,p.y);
  await page.locator('#wire-selection').getByRole('button',{name:'＋ 转接点',exact:true}).click();
  assert.equal((await draft()).rules[0].actions[0].editor.waypoints.length,1);
  const before=await draft();await page.locator('#preview-step').click();
  assert.equal(await page.locator('#runtime-tick').textContent(),'tick 1 · 0.02 s');assert.equal(await page.locator('#simulation-panel').isVisible(),true);
  await page.locator('[data-source="signal"]').click();await page.locator('#preview-step').click();
  assert.ok((await page.locator('#runtime-timers').textContent()).includes('tick 32'));
  await page.locator('#preview-toggle').click();await page.clock.runFor(12000);
  assert.ok((await page.locator('#runtime-status').textContent()).includes('已到达终点'));
  assert.ok((await page.locator('#runtime-actor').textContent()).includes('持有 item'));
  await page.screenshot({path:new URL('../artifacts/logic-editor-runtime.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.locator('#editor-return').click();assert.deepEqual(await draft(),before);
  await page.reload();await page.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(),before);
  // Create a new map and wire an event slot to an existing behavior through visible controls.
  await page.locator('#editor-new').click();await page.locator('[data-tool="switch"]').click();
  const overlay=await page.locator('#editor-overlay').boundingBox();await page.mouse.click(overlay.x+overlay.width*.22,overlay.y+overlay.height*.45);
  await page.locator('#editor-tab-library').click();await page.locator('[data-tool="gate"]').click();await page.mouse.click(overlay.x+overlay.width*.65,overlay.y+overlay.height*.45);
  await page.getByRole('button',{name:'＋ 新行为',exact:true}).click();
  await page.locator('#editor-tab-library').click();await page.locator('[data-ref="entity:switch-1"]').click();
  await page.locator('.event-slot[data-event="click"]').getByRole('button',{name:'接线'}).click();
  await page.getByLabel('连线目标',{exact:true}).selectOption('gate-1');await page.locator('#wire-connect').click();
  assert.equal((await draft()).rules[0].actions[0].type,'invoke');
  // JSON import adds an independent draft and retains route metadata.
  await page.locator('#open-data').click();await page.locator('#level-json').fill(JSON.stringify(before));await page.locator('#apply-level').click();assert.deepEqual(await draft(),before);
  const downloadEvent=page.waitForEvent('download');await page.locator('#open-data').click();await page.locator('#export-level').click();
  const exported=await downloadEvent;assert.ok(exported.suggestedFilename().endsWith('.json'));await page.locator('#close-data').click();
  // Multi-level content runs through the same art-free renderer.
  await page.locator('#example-select').selectOption('floors');await page.locator('#load-example').click();await page.locator('#preview-step').click();
  await page.locator('[data-source="call"]').click();await page.locator('#preview-toggle').click();await page.clock.runFor(15000);
  assert.ok((await page.locator('#runtime-status').textContent()).includes('已到达终点'));
  await page.locator('#editor-return').click();await page.screenshot({path:new URL('../artifacts/logic-editor.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  const portable=await buildEditor();const offline=await context.newPage(),offlineRequests=[];offline.on('pageerror',e=>errors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))offlineRequests.push(r.url());});
  await offline.clock.install();await offline.goto(pathToFileURL(portable.path).href);await offline.locator('.library-item').first().waitFor();
  await offline.locator('#preview-step').click();assert.equal(await offline.locator('#runtime-tick').textContent(),'tick 1 · 0.02 s');
  await offline.locator('#preview-toggle').click();await offline.clock.runFor(12000);assert.ok((await offline.locator('#runtime-status').textContent()).includes('已到达终点'));
  const offlineDownload=offline.waitForEvent('download');await offline.locator('#download-editor').click();const file=await offlineDownload;
  const savedPath=new URL('../artifacts/downloaded-editor.html',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');await file.saveAs(savedPath);
  await offline.goto(pathToFileURL(savedPath).href);await offline.locator('.library-item').first().waitFor();assert.equal(await offline.locator('#editor-overlay').isVisible(),true);
  assert.deepEqual(offlineRequests,[]);assert.deepEqual(errors,[]);
  const previewServer=makeServer({portableOnly:true});await new Promise(r=>previewServer.listen(0,'127.0.0.1',r));
  try{await page.goto('http://127.0.0.1:'+previewServer.address().port+'/editor.html');await page.locator('.library-item').first().waitFor();await page.locator('#preview-step').click();assert.equal(await page.locator('#runtime-tick').textContent(),'tick 1 · 0.02 s');assert.deepEqual(errors,[]);}
  finally{await new Promise(r=>previewServer.close(r));}
  console.log('Standalone editor passed: direct entry, geometry, slots, authoring, wiring, routing, history, persistence, JSON, pause/step, holding, delays, multi-floor transport, offline and downloaded copy.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
