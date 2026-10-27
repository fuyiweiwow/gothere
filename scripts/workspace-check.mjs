import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { makeServer } from '../server.mjs';
import { buildPortable } from './build.mjs';
import { pathToFileURL } from 'node:url';
import { openPanel, choosePlacement } from './editor-controls.mjs';
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const draft=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.editor.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const routes=async()=>{const d=await draft();return d.rules[0].actions[0].editor?.waypoints??[];};
async function clickWire(page,key){
  const hit=await page.locator('.event-wire[data-wire="'+key+'"]').evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()*.32),m=path.getScreenCTM();return{x:m.a*p.x+m.e,y:m.d*p.y+m.f};});
  await page.mouse.click(hit.x,hit.y);
}
try {
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('[data-example="example-carry"]').click();await page.locator('#open-editor').click();
  const canvas=await page.locator('.game-shell').boundingBox(),panel=await page.locator('#editor-panel').boundingBox();
  assert.ok(panel.x>=canvas.x+canvas.width,'inspector sits to the right of the map');
  assert.equal(await page.locator('#panel-library').isVisible(),true);
  await page.locator('[data-category="traversal"]').click();
  assert.equal(await page.locator('.library-item').count(),4);
  await page.locator('#library-search').fill('lift');assert.equal(await page.locator('.library-item').count(),1);
  await page.locator('#library-search').fill('没有这种东西');assert.equal(await page.locator('.library-item').count(),0);
  await page.locator('#library-search').fill('');await page.locator('[data-category="all"]').click();
  await page.locator('#scene-items .scene-item').first().click();
  assert.equal(await page.locator('#panel-object').isVisible(),true);
  assert.match(await page.locator('.object-definition').textContent(),/tool/);
  assert.equal(await page.locator('.event-slot').count(),4);assert.equal(await page.locator('.behavior-slot').count(),2);
  const selectedX=(await draft()).entities[0].x;await page.locator('#editor-tab-object').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#panel-logic').isVisible(),true);assert.equal((await draft()).entities[0].x,selectedX);
  await openPanel(page,'object');
  await page.locator('.event-slot[data-event="click"] .slot-connect').click();
  assert.equal(await page.locator('#panel-logic').isVisible(),true);
  assert.equal(await page.getByLabel('连线起点',{exact:true}).inputValue(),'tool');
  assert.equal(await page.getByLabel('连线事件',{exact:true}).inputValue(),'click');
  await page.getByLabel('连线目标',{exact:true}).selectOption('tool');
  await page.getByLabel('连线调用行为',{exact:true}).selectOption('drop');await page.locator('#wire-connect').click();
  assert.equal((await draft()).rules.length,3);
  assert.equal(await page.locator('#wire-connect').isDisabled(),true,'the quick connector prevents accidental duplicate wires');
  await page.getByLabel('连线调用行为',{exact:true}).selectOption('pickup');assert.equal(await page.locator('#wire-connect').isEnabled(),true);
  await page.getByLabel('连线调用行为',{exact:true}).selectOption('drop');assert.equal(await page.locator('#wire-connect').isDisabled(),true);
  await page.locator('[data-tool="select"]').click();
  const laneBefore=await page.locator('.event-wire[data-wire="0:0"]').getAttribute('d');
  await clickWire(page,'0:0');
  assert.equal(await page.locator('.event-wire[data-wire="0:0"]').getAttribute('d'),laneBefore);
  await page.locator('#wire-selection').getByRole('button',{name:'＋ 转接点',exact:true}).click();
  assert.equal((await routes()).length,1);assert.equal(await page.locator('.wire-waypoint').count(),1);
  const handle=await page.locator('.wire-waypoint').boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
  await page.mouse.move(handle.x+handle.width/2+80,handle.y+handle.height/2+70,{steps:6});await page.mouse.up();
  const moved=await routes();assert.notDeepEqual(moved,[{x:600,y:100}]);assert.equal(moved[0].x%10,0);assert.equal(moved[0].y%10,0);
  await page.locator('#editor-undo').click();assert.deepEqual(await routes(),[{x:600,y:100}]);
  await page.locator('#editor-redo').click();assert.deepEqual(await routes(),moved);
  // Add a second waypoint by double-clicking an actual orthogonal segment.
  const hit=await page.locator('.event-wire[data-wire="0:0"]').evaluate(path=>{
    const point=path.getPointAtLength(path.getTotalLength()*.35),matrix=path.getScreenCTM();return {x:matrix.a*point.x+matrix.e,y:matrix.d*point.y+matrix.f};});
  await page.mouse.dblclick(hit.x,hit.y);assert.equal((await routes()).length,2);
  await page.locator('.wire-waypoint').first().dblclick();assert.equal((await routes()).length,1);
  const beforeKey=await routes();await page.locator('.wire-waypoint').focus();await page.keyboard.press('ArrowRight');
  assert.equal((await routes())[0].x,beforeKey[0].x+10);await page.keyboard.press('Delete');assert.equal((await routes()).length,0);
  await page.locator('#editor-undo').click();assert.equal((await routes()).length,1);
  await page.locator('#wire-selection').getByRole('button',{name:'自动布线',exact:true}).click();assert.equal((await routes()).length,0);
  await page.locator('#editor-undo').click();assert.equal((await routes()).length,1);
  const persisted=await routes();await page.locator('#editor-save').click();await page.reload();await page.locator('#open-editor').click();
  assert.deepEqual(await routes(),persisted);
  await page.locator('[data-ref="entity:tool"]').click();
  await page.locator('#wire-view').selectOption('related');assert.equal(await page.locator('.event-wire').count(),2);
  await page.locator('#wire-view').selectOption('none');assert.equal(await page.locator('.event-wire').count(),0);
  await page.locator('#wire-view').selectOption('all');
  await clickWire(page,'0:0');
  const before=await page.locator('.event-wire[data-wire="0:0"]').getAttribute('d');await clickWire(page,'0:0');
  assert.equal(await page.locator('.event-wire[data-wire="0:0"]').getAttribute('d'),before,'selecting wires never moves their lanes');
  await page.locator('#wire-selection').getByRole('button',{name:'查看规则',exact:true}).click();
  assert.equal(await page.locator('#panel-logic').isVisible(),true);assert.equal(await page.locator('.rule-card.wire-focus').count(),1);
  // Route changes survive JSON import/export and are editable offline.
  const authored=await draft();await page.locator('#open-data').click();assert.deepEqual(JSON.parse(await page.locator('#level-json').inputValue()),authored);await page.locator('#close-data').click();
  const built=await buildPortable(),offline=await browser.newPage({viewport:{width:1440,height:1000}});
  offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(built.path).href);await offline.locator('#open-editor').click();
  await offline.locator('#open-data').click();await offline.locator('#level-json').fill(JSON.stringify(authored));await offline.locator('#apply-level').click();
  await clickWire(offline,'0:0');assert.equal(await offline.locator('.wire-waypoint').count(),persisted.length);
  // Finish with the clean warehouse visible and an actual rendered map.
  await page.locator('[data-tool="select"]').click();await openPanel(page,'library');
  await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../artifacts/workspace.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.locator('[data-ref="entity:tool"]').click();
  await page.screenshot({path:new URL('../artifacts/workspace-item.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  // Narrow desktop widths keep the map usable; small screens fall back to stacking.
  await page.setViewportSize({width:1100,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await choosePlacement(page,'switch');const box=await page.locator('#editor-overlay').boundingBox();await page.locator('#editor-overlay').click({position:{x:box.width*.5,y:box.height*.8}});
  assert.equal(await page.locator('#object-label').isVisible(),true);
  assert.deepEqual(errors,[]);console.log('PASS workspace: split layout, library filters, item slots, slot wiring, orthogonal waypoints, drag/history/delete, persistence, JSON/offline, responsive fallback');
} finally {await browser.close();await new Promise(r=>server.close(r));}
