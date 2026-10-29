import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';

await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.logic-editor.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
async function freeze(p){await p.clock.install({time:new Date('2026-10-29T00:00:00Z')});await p.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));}
async function load(p){await p.locator('#example-select').selectOption('first-level');await p.locator('#load-example').click();}
async function fill(p,id,value){await p.locator(id).fill(String(value));await p.locator(id).press('Enter');}
async function play(p,omit){await p.locator('#preview-toggle').click();for(const id of ['cloud','antenna','umbrella','prop','pot'])if(id!==omit)await p.locator('[data-source="'+id+'"]').click();
  await p.clock.runFor(52000);assert.match(await p.locator('#runtime-status').textContent(),omit?/模拟结束/:/已到达终点/);
  if(!omit)assert.match(await p.locator('#runtime-entities').textContent(),/unsupported/);
  await p.locator('#editor-return').click();}
try{
  page.on('pageerror',e=>errors.push(e.message));await freeze(page);
  await page.goto(process.argv[2]??'http://127.0.0.1:'+server.address().port+'/editor.html?example=first-level');
  await page.locator('#editor-overlay').waitFor();assert.equal((await draft(page)).id,'editor-first-level');await load(page);
  const initial=await draft(page);await page.locator('[data-ref="entity:sill"]').click();
  assert.equal(await page.locator('#object-support-probe').isChecked(),true);assert.equal(await page.locator('#object-support-at').inputValue(),'1');
  assert.equal(await page.locator('.event-slot[data-event="actorlanded"]').count(),1);
  assert.equal(await page.locator('.event-slot[data-event="supportlost"]').count(),1);
  await fill(page,'#object-support-at',0.75);assert.equal((await draft(page)).entities.find(e=>e.id==='sill').supportProbe.at,0.75);await page.locator('#editor-undo').click();
  await page.locator('#object-support-probe').uncheck();assert.ok((await draft(page)).entities.find(e=>e.id==='sill').supportProbe,'referenced probe must be retained');
  await page.locator('[data-ref="entity:umbrella"]').click();assert.equal(await page.locator('#object-carried-physics').isChecked(),true);
  await fill(page,'#object-fall-limit',100);assert.equal((await draft(page)).entities.find(e=>e.id==='umbrella').carriedPhysics.maxFallSpeed,100);await page.locator('#editor-undo').click();
  await page.locator('[data-ref="actor"]').click();assert.equal(await page.locator('#object-safe-landing').isChecked(),true);
  await fill(page,'#object-landing-speed',350);assert.equal((await draft(page)).actor.maxLandingSpeed,350);await page.locator('#editor-undo').click();
  await page.reload();await page.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(page),initial);
  await page.locator('#open-data').click();assert.deepEqual(JSON.parse(await page.locator('#level-json').inputValue()),initial);await page.locator('#apply-level').click();
  await play(page);for(const id of ['cloud','antenna','umbrella','prop','pot'])await play(page,id);
  assert.deepEqual(await draft(page),initial);
  await page.locator('[data-ref="entity:sill"]').click();await page.screenshot({path:new URL('../artifacts/first-level-editor.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  const portable=await buildEditor(),offline=await context.newPage(),requests=[];
  offline.on('pageerror',e=>errors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await freeze(offline);await offline.goto(pathToFileURL(portable.path).href);await load(offline);await play(offline);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  console.log('PASS first level: editable probes, held fall limits, safe landing, JSON/history, five essential interventions and online/offline completion.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
