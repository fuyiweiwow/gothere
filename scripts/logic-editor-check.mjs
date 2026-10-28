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
  assert.equal(await page.locator('#panel-library').isVisible(),true,'placement keeps the library open');
  assert.equal(await page.locator('[data-tool="switch"]').getAttribute('aria-pressed'),'true','placement tool remains active');
  assert.equal(await page.locator('.scene-item').count(),1);
  await page.mouse.click(overlay.x+overlay.width*.3,overlay.y+overlay.height*.45);
  assert.equal(await page.locator('.scene-item').count(),2,'the same tool places multiple objects consecutively');
  await page.locator('#editor-undo').click();assert.equal((await draft()).entities.length,1);
  assert.equal(await page.locator('[data-tool="switch"]').getAttribute('aria-pressed'),'true');
  await page.locator('#editor-redo').click();assert.equal((await draft()).entities.length,2);
  await page.keyboard.press('Escape');const countBefore=(await draft()).entities.length;
  await page.mouse.click(overlay.x+overlay.width*.4,overlay.y+overlay.height*.4);assert.equal((await draft()).entities.length,countBefore,'Escape cancels placement');
  await page.locator('[data-tool="switch"]').click();
  await page.locator('[data-ref="entity:switch-1"]').click();
  assert.equal(await page.locator('#panel-object').isVisible(),true,'an existing object can be inspected manually');
  assert.equal(await page.locator('#object-label').inputValue(),'开关1');
  await page.locator('#editor-tab-library').click();await page.locator('[data-tool="gate"]').click();
  const freshOverlay=await page.locator('#editor-overlay').boundingBox();
  await page.mouse.click(freshOverlay.x+freshOverlay.width*.65,freshOverlay.y+freshOverlay.height*.45);
  assert.equal(await page.locator('#panel-library').isVisible(),true);
  await page.locator('[data-ref="entity:gate-1"]').click();assert.equal(await page.locator('#panel-object').isVisible(),true);
  await page.getByRole('button',{name:'＋ 新行为',exact:true}).click();
  await page.locator('#editor-tab-library').click();await page.locator('[data-ref="entity:switch-1"]').click();
  await page.locator('.event-slot[data-event="click"]').getByRole('button',{name:'接线'}).click();
  await page.getByLabel('连线目标',{exact:true}).selectOption('gate-1');await page.locator('#wire-connect').click();
  assert.equal((await draft()).rules[0].actions[0].type,'invoke');
  // Pointer height is the default; roads can be dragged between floors, undone and restored.
  await page.locator('#editor-new').click();assert.equal(await page.locator('#placement-mode').inputValue(),'cursor');
  async function placeRoad(x,y){await page.locator('#editor-tab-library').click();await page.locator('[data-tool="platform"]').click();const b=await page.locator('#editor-overlay').boundingBox();await page.mouse.click(b.x+x/1200*b.width,b.y+y/640*b.height);}
  await placeRoad(500,300);assert.equal((await draft()).platforms[1].y,300);
  assert.equal(await page.locator('#panel-library').isVisible(),true);assert.equal(await page.locator('[data-tool="platform"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-tool="select"]').click();
  const road=await page.locator('[data-ref="platform:1"]').boundingBox(),mapBounds=await page.locator('#editor-overlay').boundingBox();
  await page.mouse.move(road.x+road.width/2,road.y+road.height/2);await page.mouse.down();
  await page.mouse.move(road.x+road.width/2+20/1200*mapBounds.width,road.y+road.height/2-60/640*mapBounds.height,{steps:5});await page.mouse.up();
  assert.equal((await draft()).platforms[1].y,240);assert.equal((await draft()).platforms[1].x,520);
  await page.locator('#editor-undo').click();assert.equal((await draft()).platforms[1].y,300);
  await page.locator('#editor-redo').click();assert.equal((await draft()).platforms[1].y,240);
  await page.locator('[data-ref="platform:1"]').focus();await page.keyboard.press('Shift+ArrowDown');assert.equal((await draft()).platforms[1].y,250);
  await page.locator('#object-y').fill('300');await page.locator('#object-y').press('Tab');assert.equal((await draft()).platforms[1].y,300);
  await page.locator('#placement-mode').selectOption('fixed');await page.locator('#placement-y').fill('360');await page.locator('#placement-y').press('Tab');
  await placeRoad(760,200);assert.equal((await draft()).platforms[2].y,360);
  await page.locator('#placement-mode').selectOption('cursor');await placeRoad(850,200);assert.equal((await draft()).platforms[3].y,200);
  const roadDraft=await draft();await page.reload();await page.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(),roadDraft);
  // Direct manipulation: roads, object corners and independently snapped channel endpoints.
  async function resize(handle,dx,dy){const h=await page.locator('[data-resize="'+handle+'"]').boundingBox(),b=await page.locator('#editor-overlay').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+dx/1200*b.width,h.y+h.height/2+dy/640*b.height,{steps:5});await page.mouse.up();}
  await page.locator('[data-ref="platform:1"]').click();assert.equal(await page.locator('[data-resize]').count(),2);
  await resize('e',50,0);assert.equal((await draft()).platforms[1].width,250);
  await page.locator('#editor-undo').click();assert.equal((await draft()).platforms[1].width,200);
  await page.locator('#editor-new').click();await placeRoad(320,260);
  await page.locator('[data-tool="ladder"]').click();let b=await page.locator('#editor-overlay').boundingBox();await page.mouse.click(b.x+280/1200*b.width,b.y+450/640*b.height);
  assert.equal(await page.locator('#panel-library').isVisible(),true);
  let channel=(await draft()).entities[0];assert.equal(channel.kind,'object');assert.equal(channel.y,440);assert.equal(channel.transport.toY,260);
  await page.locator('[data-ref="entity:'+channel.id+'"]').click();assert.equal(await page.locator('[data-resize]').count(),8);assert.equal(await page.locator('.event-slot[data-event="arrive"]').count(),1);
  assert.equal(await page.locator('#object-transport').isChecked(),true);assert.match(await page.locator('.transport-status').textContent(),/已连接/);
  await resize('e',40,0);assert.equal((await draft()).entities[0].width,100);
  await resize('n',0,30);assert.equal((await draft()).entities[0].transport.toY,290);assert.equal(await page.locator('#editor-test').isDisabled(),true);
  await resize('n',0,-20);assert.equal((await draft()).entities[0].transport.toY,260);assert.equal(await page.locator('#editor-test').isDisabled(),false);
  await page.locator('#editor-tab-library').click();await page.locator('[data-tool="object"]').click();b=await page.locator('#editor-overlay').boundingBox();await page.mouse.click(b.x+500/1200*b.width,b.y+440/640*b.height);
  await page.locator('[data-ref="entity:object-2"]').click();await resize('ne',50,-40);
  let resized=(await draft()).entities[1];assert.equal(resized.width,98);assert.equal(resized.height,76);assert.equal(await page.locator('#object-height').inputValue(),'76');
  await page.locator('#editor-undo').click();assert.equal((await draft()).entities[1].height,undefined);await page.locator('#editor-redo').click();
  await page.locator('#object-transport').check();assert.equal((await draft()).entities[1].transport.type,'vertical');assert.equal(await page.locator('.event-slot[data-event="arrive"]').count(),1);
  const resizedDraft=await draft();await page.reload();await page.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(),resizedDraft);
  // JSON import adds an independent draft and retains route metadata.
  await page.locator('#open-data').click();await page.locator('#level-json').fill(JSON.stringify(before));await page.locator('#apply-level').click();assert.deepEqual(await draft(),before);
  const downloadEvent=page.waitForEvent('download');await page.locator('#open-data').click();await page.locator('#export-level').click();
  const exported=await downloadEvent;assert.ok(exported.suggestedFilename().endsWith('.json'));await page.locator('#close-data').click();
  // Multi-level content runs through the same art-free renderer.
  await page.locator('#example-select').selectOption('floors');await page.locator('#load-example').click();await page.locator('#preview-step').click();
  await page.locator('[data-source="call"]').click();await page.locator('#preview-toggle').click();await page.clock.runFor(15000);
  assert.ok((await page.locator('#runtime-status').textContent()).includes('已到达终点'));
  await page.locator('#editor-return').click();await page.screenshot({path:new URL('../artifacts/logic-editor.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  // The enemy uses a generic object and editable contact -> behavior -> hurt wiring.
  await page.locator('#example-select').selectOption('creature');await page.locator('#load-example').click();
  const enemyDraft=await draft();assert.equal(enemyDraft.platforms[1].y,300);assert.equal(enemyDraft.entities.find(e=>e.id==='creature').kind,'object');
  await page.locator('[data-ref="entity:creature"]').click();assert.equal(await page.locator('.behavior-slot').count(),3);
  assert.equal(await page.locator('#object-contact').inputValue(),'');assert.equal(await page.locator('[data-behavior="attack"] [data-action-type]').inputValue(),'hurt');
  assert.equal(await page.locator('.event-slot[data-event="contact"] small').textContent(),'1 条');
  await page.screenshot({path:new URL('../artifacts/logic-editor-creature.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.locator('#editor-test').click();await page.clock.runFor(16000);assert.ok((await page.locator('#runtime-status').textContent()).includes('hurt'));
  assert.ok((await page.locator('#runtime-log').textContent()).includes('巡逻生物执行了攻击行为'));
  await page.locator('#preview-reset').click();await page.locator('[data-source="stop"]').click();await page.locator('#preview-toggle').click();await page.clock.runFor(16000);
  assert.ok((await page.locator('#runtime-status').textContent()).includes('已到达终点'));
  await page.locator('#editor-return').click();assert.deepEqual(await draft(),enemyDraft);
  const portable=await buildEditor();const offline=await context.newPage(),offlineRequests=[];offline.on('pageerror',e=>errors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))offlineRequests.push(r.url());});
  await offline.clock.install();await offline.goto(pathToFileURL(portable.path).href);await offline.locator('.library-item').first().waitFor();
  await offline.locator('#preview-step').click();assert.equal(await offline.locator('#runtime-tick').textContent(),'tick 1 · 0.02 s');
  await offline.locator('#preview-toggle').click();await offline.clock.runFor(12000);assert.ok((await offline.locator('#runtime-status').textContent()).includes('已到达终点'));
  await offline.locator('#editor-return').click();await offline.locator('[data-ref="entity:item"]').click();assert.equal(await offline.locator('[data-resize]').count(),8);
  const offlineDownload=offline.waitForEvent('download');await offline.locator('#download-editor').click();const file=await offlineDownload;
  const savedPath=new URL('../artifacts/downloaded-editor.html',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');await file.saveAs(savedPath);
  await offline.goto(pathToFileURL(savedPath).href);await offline.locator('.library-item').first().waitFor();assert.equal(await offline.locator('#editor-overlay').isVisible(),true);
  assert.deepEqual(offlineRequests,[]);assert.deepEqual(errors,[]);
  const previewServer=makeServer({portableOnly:true});await new Promise(r=>previewServer.listen(0,'127.0.0.1',r));
  try{await page.goto('http://127.0.0.1:'+previewServer.address().port+'/editor.html');await page.locator('.library-item').first().waitFor();await page.locator('#preview-step').click();assert.equal(await page.locator('#runtime-tick').textContent(),'tick 1 · 0.02 s');assert.deepEqual(errors,[]);}
  finally{await new Promise(r=>previewServer.close(r));}
  console.log('Standalone editor passed: continuous placement, corner/road resize, channel endpoint snap and capability editing, history, persistence, wiring, preview and offline/downloaded copy.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
