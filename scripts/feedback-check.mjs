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
function shortWav(){const count=1600,b=Buffer.alloc(44+count*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(count*2,40);for(let i=0;i<count;i++)b.writeInt16LE(Math.round(Math.sin(i*.3)*2000),44+i*2);return b;}
try{
 const p=await pageAt('http://127.0.0.1:'+server.address().port+'/');await p.locator('#display-mode').selectOption('scene');
 await chooseArt(p,'烟雾通路资源');const hiddenImage=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.locator('[data-feedback-preview]').click();await p.clock.runFor(150);
 assert.notEqual(await p.locator('#scene').evaluate(c=>c.toDataURL()),hiddenImage,'hidden resources can be auditioned without changing their initial state');await p.locator('#feedback-stop').click();
 const imported=await draft(p);imported.entities.push({id:'feedback-zone',kind:'zone',label:'测试感应区',x:30,y:560,width:8,height:8,state:'enabled'});
 await p.locator('#open-data').click();await p.locator('#level-json').fill(JSON.stringify(imported));await p.locator('#apply-level').click();await chooseArt(p,'可落下花盆资源');
 await p.locator('#feedback-panel').waitFor({state:'visible',timeout:3000});const initial=await draft(p);assert.ok(initial.scene.feedback.length>=12);
 await p.locator('#feedback-add').click();let slot=p.locator('.feedback-slot').last();await slot.locator('[data-feedback-field="motion"]').selectOption('shake');await slot.locator('[data-feedback-field="particles"]').selectOption('smoke');
 await slot.locator('[data-feedback-field="sound"]').selectOption('puff');const configured=await draft(p);assert.equal(configured.scene.feedback.at(-1).motion,'shake');assert.deepEqual(configured.entities,initial.entities);
 await slot.locator('[data-feedback-preview]').click();await p.clock.runFor(180);assert.ok(Number(await p.locator('#scene').getAttribute('data-feedback-particles'))>0);
 await p.locator('#animation-toggle').uncheck();assert.equal(await p.locator('#scene').getAttribute('data-feedback-particles'),'0','the animation toggle also controls editor auditions');await p.locator('#animation-toggle').check();
 await p.clock.runFor(2500);assert.equal(await p.locator('#scene').getAttribute('data-feedback-active'),'0');
 await slot.locator('[data-feedback-field="duration"]').fill('2.3');await slot.locator('[data-feedback-field="duration"]').dispatchEvent('change');assert.equal((await draft(p)).scene.feedback.at(-1).duration,138);
 await slot.locator('[data-feedback-field="trigger-type"]').selectOption('event');await slot.locator('[data-feedback-field="trigger-source"]').selectOption('feedback-zone');
 await slot.locator('[data-feedback-field="trigger-type"]').selectOption('behavior');assert.ok((await draft(p)).scene.feedback.at(-1).trigger.behavior,'switching from a sensor chooses an eligible behavior source');
 await slot.locator('[data-feedback-field="trigger-type"]').selectOption('start');
 await p.locator('#sound-file').setInputFiles({name:'短提示.wav',mimeType:'audio/wav',buffer:shortWav()});
 await slot.locator('[data-feedback-field="sound"] option[value="sound-1"]').waitFor({state:'attached'});await slot.locator('[data-feedback-field="sound"]').selectOption('sound-1');
 const heard=Number(await p.locator('#scene').getAttribute('data-audio-played'));await slot.locator('[data-feedback-preview]').click();
 for(let i=0;i<10&&Number(await p.locator('#scene').getAttribute('data-audio-played'))===heard;i++){await p.clock.runFor(50);await new Promise(r=>setTimeout(r,20));}
 assert.ok(Number(await p.locator('#scene').getAttribute('data-audio-played'))>heard,'an imported sound decodes and plays during preview');
 await p.locator('#feedback-stop').click();const target=(await draft(p)).scene.nodes.find(n=>n.label==='喷烟烟囱资源').id;
 await slot.locator('[data-feedback-field="copy-target"]').selectOption(target);const copied=await draft(p);assert.equal(copied.scene.feedback.at(-1).target,target);assert.equal(copied.scene.feedback.at(-1).sound,'sound-1');
 configured.scene.feedback=copied.scene.feedback;configured.scene.sounds=copied.scene.sounds;
 await p.locator('#feedback-stop').click();await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),configured);
 await p.locator('#preview-toggle').click();await p.clock.runFor(1000);assert.ok(Number(await p.locator('#scene').getAttribute('data-feedback-particles'))>0,'ambient smoke runs from authored start slots');
 await p.locator('#scene-interactions [data-source="chimney"]').click();await p.clock.runFor(250);assert.ok(Number(await p.locator('#scene').getAttribute('data-audio-played'))>0,'a behavior plays its sound once');
 await p.locator('#preview-toggle').click();const image=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.clock.runFor(500);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),image,'pause freezes motion and smoke');
 await p.locator('#preview-toggle').click();for(let i=0;i<120&&!/模拟结束/.test(await p.locator('#runtime-status').textContent());i++)await p.clock.runFor(200);assert.match(await p.locator('#runtime-status').textContent(),/模拟结束/);const tick=await p.locator('#runtime-tick').textContent(),death=await p.locator('#scene').evaluate(c=>c.toDataURL());
 await p.clock.runFor(1500);assert.equal(await p.locator('#runtime-tick').textContent(),tick);assert.notEqual(await p.locator('#scene').evaluate(c=>c.toDataURL()),death,'death can finish after simulation ends');
 await p.clock.runFor(5000);assert.equal(await p.locator('#scene').getAttribute('data-feedback-ended'),'true');await p.screenshot({path:'artifacts/feedback-death.png',fullPage:true});
 await p.locator('#preview-reset').click();assert.equal(await p.locator('#scene').getAttribute('data-feedback-active'),'0');await p.locator('#editor-return').click();assert.deepEqual(await draft(p),configured);
 await p.locator('#sound-toggle').uncheck();await p.locator('#preview-toggle').click();await p.clock.runFor(100);await p.locator('#scene-interactions [data-source="chimney"]').click();await p.clock.runFor(300);assert.equal(await p.locator('#scene').getAttribute('data-audio-played'),'0');await p.locator('#editor-return').click();
 const built=await buildEditor(),offline=await pageAt(pathToFileURL(built.path).href),requests=[];offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await offline.locator('#display-mode').selectOption('scene');await offline.locator('#animation-toggle').check();await offline.locator('#preview-toggle').click();await offline.clock.runFor(1700);assert.ok(Number(await offline.locator('#scene').getAttribute('data-feedback-particles'))>0);assert.deepEqual(requests,[]);
 await offline.screenshot({path:'artifacts/feedback-scene.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS feedback: editable presets and sound slots, preview/JSON/reload, authored smoke, sound deduplication/mute, pause/reset, finite death tail and offline playback.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
