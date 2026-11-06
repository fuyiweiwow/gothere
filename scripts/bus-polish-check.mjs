import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';
import {createSimulation} from '../src/core/engine.js';
import {readSourceLevel} from './check-source-helpers.mjs';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[],failure=createSimulation(createBusStopLevel()).start().step(1200).snapshot().tick;
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const tick=async p=>Number((await p.locator('#runtime-tick').innerText()).match(/tick (\d+)/)[1]);
async function until(p,target){for(let i=0;i<8;i++){const now=await tick(p);if(now>=target)return;await p.clock.runFor(Math.ceil((target-now)*1000/60));}assert.fail('preview did not reach tick '+target);}
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=bus-stop',offline+'?sample=bus-stop'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-06T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();
    const before=await draft(p);assert.ok(before.scene.feedback.some(f=>f.trigger.cause==='passenger-a'));
    await p.locator('#display-mode').selectOption('scene');await p.locator('#layer-group').selectOption('乘客');await p.locator('[data-art-id=stop-person-a]').click();
    const shove=p.locator('[data-feedback-id=queue-a-shove]');await shove.locator('summary').click();
    await shove.locator('[data-feedback-field=trigger-cause]').selectOption('passenger-b');
    await shove.locator('[data-feedback-field=trigger-reason]').selectOption('hurt');
    let cue=(await draft(p)).scene.feedback.find(f=>f.id==='queue-a-shove');assert.deepEqual(cue.trigger,{type:'lost',cause:'passenger-b',reason:'hurt'});
    await p.locator('#editor-undo').click();await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);
    await shove.locator('[data-feedback-field=clip-frame-0]').selectOption('queueAShove2');
    assert.equal((await draft(p)).scene.feedback.find(f=>f.id==='queue-a-shove').animation.frames[0],'queueAShove2');await p.locator('#editor-undo').click();
    assert.deepEqual(await readSourceLevel(p),before,'typed source export retains frame assets and object references');
    await p.locator('#sound-toggle').uncheck();await p.locator('#preview-toggle').click();await until(p,failure-4);
    await p.locator('#preview-step').click();while(await tick(p)<failure)await p.locator('#preview-step').click();
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');
    const images=[];images.push(await p.locator('#scene').evaluate(c=>c.toDataURL()));
    await p.locator('#scene').screenshot({path:'artifacts/bus-contact-'+index+'.png'});
    await p.clock.runFor(200);images.push(await p.locator('#scene').evaluate(c=>c.toDataURL()));
    await p.locator('#scene').screenshot({path:'artifacts/bus-shove-'+index+'.png'});
    await p.clock.runFor(500);images.push(await p.locator('#scene').evaluate(c=>c.toDataURL()));
    await p.locator('#scene').screenshot({path:'artifacts/bus-landing-'+index+'.png'});
    assert.equal(new Set(images).size,3,'contact, shove and landing are distinct pictures');
    assert.equal(await tick(p),failure,'presentation does not advance failed gameplay');
    await p.clock.runFor(1200);assert.equal(await p.locator('#scene').getAttribute('data-feedback-ended'),'true');
    const final=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.clock.runFor(1800);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),final,'final pose stays still');
    assert.equal(await p.locator('#scene').getAttribute('data-audio-played'),'0');
    await p.locator('#animation-toggle').uncheck();assert.notEqual(await p.locator('#scene').evaluate(c=>c.toDataURL()),final);await p.locator('#animation-toggle').check();
    await p.locator('#preview-reset').click();assert.equal(await p.locator('#scene').getAttribute('data-feedback-active'),'0');
    await p.locator('#editor-return').click();assert.deepEqual(await draft(p),before);
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);assert.deepEqual(requests,[]);
    await context.close();console.log('PASS bus polish '+(index?'offline':'online')+': editable cause/frame slots, undo, typed export, actual contact, terminal clip tail, mute/toggle/reset and saved draft.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
