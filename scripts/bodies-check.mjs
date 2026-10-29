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
async function freeze(p){await p.clock.install({time:new Date('2026-10-29T00:00:00Z')});await p.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));}
async function load(p){await p.locator('#example-select').selectOption('bodies');await p.locator('#load-example').click();}
async function play(p){
  await p.locator('#preview-toggle').click();await p.locator('[data-source="release"]').click();await p.clock.runFor(350);
  assert.match(await p.locator('#runtime-entities').textContent(),/falling/);
  await p.clock.runFor(15000);assert.match(await p.locator('#runtime-status').textContent(),/已到达终点/);
  const log=await p.locator('#runtime-log').textContent();for(const pattern of [/失去支撑/,/撞击/,/落到/])assert.match(log,pattern);
  await p.locator('#editor-return').click();
}
try{
  page.on('pageerror',e=>errors.push(e.message));await freeze(page);
  await page.goto(process.argv[2]??'http://127.0.0.1:'+server.address().port+'/editor.html?example=bodies');
  await page.locator('#editor-overlay').waitFor();assert.equal((await draft(page)).id,'editor-bodies');await load(page);const initial=await draft(page);
  await page.locator('[data-ref="entity:weight"]').click();assert.equal(await page.locator('#object-body').isChecked(),true);
  assert.equal(await page.locator('#object-collider').isChecked(),true);
  assert.equal(await page.locator('.event-slot[data-event="supportlost"]').count(),1);assert.equal(await page.locator('.event-slot[data-event="landed"]').count(),1);
  await page.locator('[data-ref="entity:shelf"]').click();const action=page.locator('[data-behavior="remove"] .action-row');
  assert.equal(await action.locator('[data-action-type]').inputValue(),'enable');assert.equal(await action.locator('[data-enable-capability]').inputValue(),'collider');
  await action.locator('[data-enable-value]').selectOption('true');assert.equal((await draft(page)).entities.find(e=>e.id==='shelf').behaviors[0].actions[0].enabled,true);
  await page.locator('#editor-undo').click();
  await page.locator('#editor-tab-logic').click();const rule=page.locator('[data-rule="2"]');
  assert.equal(await rule.locator('[data-impact-other]').inputValue(),'weight');await rule.locator('[data-impact-other]').selectOption('');
  assert.equal((await draft(page)).rules[2].on.other,undefined);await page.locator('#editor-undo').click();
  await page.reload();await page.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(page),initial);await play(page);
  await page.locator('#preview-toggle').click();await page.clock.runFor(15000);assert.match(await page.locator('#runtime-status').textContent(),/hurt/);
  await page.locator('#editor-return').click();assert.deepEqual(await draft(page),initial);
  // New bodies are created through ordinary object controls and retain editable dimensions.
  await page.locator('#editor-tab-library').click();await page.locator('[data-tool="object"]').click();const map=await page.locator('#editor-overlay').boundingBox();
  await page.mouse.click(map.x+700/1200*map.width,map.y+300/640*map.height);await page.locator('[data-ref="entity:object-1"]').click();
  await page.locator('#object-body').check();let e=(await draft(page)).entities.find(e=>e.id==='object-1');assert.equal(e.collider.enabled,true);assert.equal(e.body.type,'dynamic');
  await page.locator('#object-height').fill('48');await page.locator('#object-height').press('Enter');
  const h=await page.locator('[data-resize="ne"]').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();
  await page.mouse.move(h.x+h.width/2+20/1200*map.width,h.y+h.height/2-20/640*map.height,{steps:6});await page.mouse.up();
  e=(await draft(page)).entities.find(e=>e.id==='object-1');assert.equal(e.width,68);assert.equal(e.height,68);
  await page.locator('.event-slot[data-event="landed"]').getByRole('button',{name:'接线',exact:true}).click();
  await page.getByLabel('连线目标',{exact:true}).selectOption('creature');await page.locator('#wire-connect').click();
  const created=(await draft(page)).rules.at(-1);assert.deepEqual(created.on,{source:'object-1',type:'landed'});assert.equal(created.actions[0].target,'creature');
  await page.locator('#editor-tab-object').click();await page.locator('#object-body').uncheck();
  assert.equal((await draft(page)).entities.find(e=>e.id==='object-1').body.type,'dynamic','referenced capability cannot silently disappear');
  await page.locator('#editor-tab-logic').click();await page.locator('.rule-card').last().getByRole('button',{name:'删除规则',exact:true}).click();
  await page.locator('#editor-tab-object').click();
  await page.locator('#object-collider-enabled').uncheck();assert.equal((await draft(page)).entities.find(e=>e.id==='object-1').collider.enabled,false);
  await page.locator('#editor-undo').click();await page.locator('#object-body').uncheck();await page.locator('#object-collider').uncheck();
  e=(await draft(page)).entities.find(e=>e.id==='object-1');assert.equal(e.body,undefined);assert.equal(e.collider,undefined);
  await load(page);await page.locator('[data-ref="entity:weight"]').click();
  await page.screenshot({path:new URL('../artifacts/bodies-editor.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  const portable=await buildEditor(),offline=await context.newPage(),requests=[];
  offline.on('pageerror',e=>errors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await freeze(offline);await offline.goto(pathToFileURL(portable.path).href);await load(offline);await play(offline);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  console.log('PASS bodies: capability authoring, dimensions/resize, action controls, filtered impact slots, loss/fall/landing route, history/reload and offline play.');
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
