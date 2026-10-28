import { openPanel, choosePlacement } from './editor-controls.mjs';
﻿import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { makeServer } from '../server.mjs';
import { buildPortable } from './build.mjs';
import { pathToFileURL } from 'node:url';
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1500,height:1100},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
const change=async(id,value)=>{if(id.startsWith('edit-'))await openPanel(page,'map');await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Tab');};
const draft=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.editor.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
async function place(kind,x){
  await choosePlacement(page,kind);const b=await page.locator('#editor-overlay').boundingBox();
  await page.locator('#editor-overlay').click({position:{x:b.width*x/1200,y:b.height*580/640}});await change('object-x',x);
}
async function behavior(id,name,type){
  await page.getByRole('button',{name:'＋ 新行为',exact:true}).click();
  let card=page.locator('.behavior-card').last();await card.getByLabel('行为 ID',{exact:true}).fill(id);await card.getByLabel('行为 ID',{exact:true}).press('Tab');
  card=page.locator('[data-behavior="'+id+'"]');await card.getByLabel('行为名称',{exact:true}).fill(name);await card.getByLabel('行为名称',{exact:true}).press('Tab');
  await card.locator('[data-action-type]').selectOption(type);return card;
}
async function wire(source,event,target,action,done){
  await page.locator('[data-tool="wire"]').click();await page.getByLabel('连线起点',{exact:true}).selectOption(source);
  await page.getByLabel('连线事件',{exact:true}).selectOption(event);
  if(done)await page.getByLabel('连线完成行为',{exact:true}).selectOption(done);
  await page.getByLabel('连线目标',{exact:true}).selectOption(target);
  await page.getByLabel('连线调用行为',{exact:true}).selectOption(action);await page.locator('#wire-connect').click();
}
try{
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#open-editor').click();await page.locator('#editor-new').click();
  await change('edit-name','连线也要到达那里');await change('edit-speed',120);
  await place('object',150);await page.locator('#object-contact').selectOption('lethal');
  await behavior('pickup','拿起','hold');let card=await behavior('rest','休息','set');
  await card.locator('[data-action-target]').selectOption('object-1');await card.locator('[data-action-state]').selectOption('inactive');
  await behavior('drop','放下','drop');
  await place('gate',500);card=await behavior('open','开门','set');await card.locator('[data-action-state]').selectOption('open');
  await place('switch',340);card=await behavior('mark','作个记号','set');await card.locator('[data-action-target]').selectOption('switch-1');await card.locator('[data-action-state]').selectOption('on');
  await place('zone',800);
  // Use actual scene clicks for the first wire, including a self connection.
  await page.locator('[data-tool="wire"]').click();await page.locator('[data-ref="entity:object-1"]').click();
  await page.locator('[data-ref="entity:object-1"]').click();await page.getByLabel('连线调用行为',{exact:true}).selectOption('pickup');await page.locator('#wire-connect').click();
  await wire('gate-1','contact','gate-1','open');
  const rule=page.locator('.rule-card').last();await rule.getByRole('button',{name:'＋ 持有条件',exact:true}).click();
  await wire('switch-1','click','gate-1','open');await wire('switch-1','click','object-1','rest');
  await wire('object-1','done','switch-1','mark','pickup');await wire('zone-1','enter','object-1','drop');
  assert.equal(await page.locator('.event-wire').count(),6);assert.equal((await draft()).rules.length,6);
  await page.locator('#editor-undo').click();assert.equal(await page.locator('.event-wire').count(),5);
  await page.locator('#editor-redo').click();assert.equal(await page.locator('.event-wire').count(),6);
  // Rename a wired behavior, then remove another; all references remain editable.
  await page.locator('[data-tool="select"]').click();await page.locator('[data-ref="entity:object-1"]').click();
  card=page.locator('[data-behavior="pickup"]');await card.getByLabel('行为 ID',{exact:true}).fill('carry');await card.getByLabel('行为 ID',{exact:true}).press('Tab');
  let data=await draft();assert.equal(data.rules[0].actions[0].behavior,'carry');assert.equal(data.rules[4].on.behavior,'carry');
  await page.locator('[data-behavior="rest"]').getByRole('button',{name:'删除行为',exact:true}).click();
  assert.equal(await page.locator('.event-wire').count(),5);await page.locator('#editor-undo').click();
  assert.equal(await page.locator('.event-wire').count(),6);
  // Nested behavior delays reuse the general action editor and persist exactly.
  card=page.locator('[data-behavior="drop"]');await card.getByRole('button',{name:'＋ 延迟动作',exact:true}).click();
  const group=card.locator('.delayed-actions');await group.locator('[data-action-type]').selectOption('turn');
  await group.locator('[data-action-delay]').fill('0.2');await group.locator('[data-action-delay]').press('Tab');
  data=await draft();assert.equal(data.entities[0].behaviors[2].actions[1].ticks,12);
  await page.reload();await page.locator('#open-editor').click();assert.deepEqual(await draft(),data);
  assert.equal(await page.locator('.event-wire').count(),6);assert.equal(await page.locator('#editor-test').isDisabled(),false);
  await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../artifacts/wires.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.locator('#editor-test').click();await page.locator('#speed').click();await page.locator('#speed').click();await page.locator('#play').click();await page.clock.runFor(6000);
  assert.equal(await page.locator('#status-text').textContent(),'终于到了');assert.doesNotMatch(await page.locator('#stage-note').textContent(),/手持/);
  await page.locator('#replay').click();await page.clock.runFor(6000);assert.equal(await page.locator('#status-text').textContent(),'终于到了');
  await page.locator('#editor-return').click();await page.locator('[data-ref="entity:object-1"]').click();await page.locator('#object-delete').click();
  assert.equal(await page.locator('#editor-test').isDisabled(),false);assert.equal((await draft()).rules.some(r=>r.on.source==='object-1'),false);
  await page.locator('#editor-undo').click();assert.deepEqual(await draft(),data);
  const built=await buildPortable(),offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));
  await offline.clock.install();await offline.clock.pauseAt(new Date(Date.now()+1000));await offline.goto(pathToFileURL(built.path).href);
  await offline.locator('#open-data').click();await offline.locator('#level-json').fill(JSON.stringify(data));await offline.locator('#apply-level').click();
  await offline.locator('#speed').click();await offline.locator('#speed').click();await offline.locator('#play').click();await offline.clock.runFor(6000);
  assert.equal(await offline.locator('#status-text').textContent(),'终于到了');assert.deepEqual(errors,[]);
  console.log('PASS wires: scene connection, named behavior editing, many-to-many, completion chains, hold/drop, contact effect, delays, rename/delete/undo, persistence, replay, offline');
}finally{await browser.close();await new Promise(r=>server.close(r));}
