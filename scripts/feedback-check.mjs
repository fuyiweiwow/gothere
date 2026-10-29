import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
await mkdir('artifacts',{recursive:true});const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1150}}),errors=[];
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
async function pageAt(url){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(7000);await p.clock.install({time:new Date('2026-10-29T00:00:00Z')});await p.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();return p;}
async function chooseArt(p,label){await p.locator('#layer-search').fill(label);await p.locator('#resource-layers .resource-layer').first().click();}
try{
 const p=await pageAt('http://127.0.0.1:'+server.address().port+'/');await p.locator('#display-mode').selectOption('scene');await chooseArt(p,'可落下花盆资源');
 await p.locator('#feedback-panel').waitFor({state:'visible',timeout:3000});const initial=await draft(p);assert.ok(initial.scene.feedback.length>=12);
 await p.locator('#feedback-add').click();let slot=p.locator('.feedback-slot').last();await slot.locator('[data-feedback-field="motion"]').selectOption('shake');await slot.locator('[data-feedback-field="particles"]').selectOption('smoke');
 await slot.locator('[data-feedback-field="sound"]').selectOption('puff');const configured=await draft(p);assert.equal(configured.scene.feedback.at(-1).motion,'shake');assert.deepEqual(configured.entities,initial.entities);
 await slot.locator('[data-feedback-preview]').click();await p.clock.runFor(180);assert.ok(Number(await p.locator('#scene').getAttribute('data-feedback-particles'))>0);await p.clock.runFor(2500);assert.equal(await p.locator('#scene').getAttribute('data-feedback-active'),'0');
 await p.locator('#feedback-stop').click();await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),configured);
 await p.locator('#preview-toggle').click();await p.clock.runFor(1000);assert.ok(Number(await p.locator('#scene').getAttribute('data-feedback-particles'))>0,'ambient smoke runs from authored start slots');
 await p.locator('#scene-interactions [data-source="chimney"]').click();await p.clock.runFor(250);assert.ok(Number(await p.locator('#scene').getAttribute('data-audio-played'))>0,'a behavior plays its sound once');
 await p.locator('#preview-toggle').click();const image=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.clock.runFor(500);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),image,'pause freezes motion and smoke');
 await p.locator('#preview-toggle').click();await p.clock.runFor(20000);assert.match(await p.locator('#runtime-status').textContent(),/模拟结束/);const tick=await p.locator('#runtime-tick').textContent(),death=await p.locator('#scene').evaluate(c=>c.toDataURL());
 await p.clock.runFor(1500);assert.equal(await p.locator('#runtime-tick').textContent(),tick);assert.notEqual(await p.locator('#scene').evaluate(c=>c.toDataURL()),death,'death can finish after simulation ends');
 await p.clock.runFor(5000);assert.equal(await p.locator('#scene').getAttribute('data-feedback-ended'),'true');await p.screenshot({path:'artifacts/feedback-death.png',fullPage:true});
 await p.locator('#preview-reset').click();assert.equal(await p.locator('#scene').getAttribute('data-feedback-active'),'0');await p.locator('#editor-return').click();assert.deepEqual(await draft(p),configured);
 await p.locator('#sound-toggle').uncheck();await p.locator('#preview-toggle').click();await p.clock.runFor(100);await p.locator('#scene-interactions [data-source="chimney"]').click();await p.clock.runFor(300);assert.equal(await p.locator('#scene').getAttribute('data-audio-played'),'0');await p.locator('#editor-return').click();
 const built=await buildEditor(),offline=await pageAt(pathToFileURL(built.path).href),requests=[];offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await offline.locator('#display-mode').selectOption('scene');await offline.locator('#animation-toggle').check();await offline.locator('#preview-toggle').click();await offline.clock.runFor(1700);assert.ok(Number(await offline.locator('#scene').getAttribute('data-feedback-particles'))>0);assert.deepEqual(requests,[]);
 await offline.screenshot({path:'artifacts/feedback-scene.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS feedback: editable presets and sound slots, preview/JSON/reload, authored smoke, sound deduplication/mute, pause/reset, finite death tail and offline playback.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
