import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
async function pageAt(url){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-29T00:00:00Z')});await p.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();return p;}
async function value(p,id,v){await p.locator(id).fill(String(v));await p.locator(id).press('Enter');}
async function play(p,mode,{early=false}={}){
  await p.locator('#display-mode').selectOption(mode);await p.locator('#animation-toggle').check();await p.locator('#preview-toggle').click();
  if(early){for(const id of ['cloud','antenna','umbrella','prop','pot'])await p.locator('#scene-interactions [data-source="'+id+'"]').click();await p.clock.runFor(52000);assert.match(await p.locator('#runtime-status').textContent(),/模拟结束/);}
  else{
    let previous=0;
    for(const [ms,id] of [[5000,'pipe'],[9000,'cloud'],[12500,'antenna'],[17500,'umbrella'],[20833,'prop'],[27500,'pot'],[41500,'window']]){
      await p.clock.runFor(ms-previous);previous=ms;await p.locator('#scene-interactions [data-source="'+id+'"]').click();
      if(id==='cloud'){
        const moving=await p.locator('#scene').evaluate(c=>c.toDataURL());
        await p.clock.runFor(100);previous+=100;assert.match(await p.locator('#runtime-inputs').textContent(),/恢复|剩余/);
        if(mode==='scene')assert.notEqual(await p.locator('#scene').evaluate(c=>c.toDataURL()),moving,'the running scene animates');
        await p.locator('#preview-toggle').click();const before=await p.locator('#runtime-tick').textContent(),image=await p.locator('#scene').evaluate(c=>c.toDataURL());
        await p.clock.runFor(250);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),image);assert.equal(await p.locator('#runtime-tick').textContent(),before);
        await p.locator('#display-mode').selectOption(mode==='scene'?'logic':'scene');assert.equal(await p.locator('#runtime-tick').textContent(),before);
        await p.locator('#animation-toggle').uncheck();assert.equal(await p.locator('#runtime-tick').textContent(),before);
        await p.locator('#animation-toggle').check();assert.equal(await p.locator('#runtime-tick').textContent(),before);
        await p.locator('#display-mode').selectOption(mode);await p.locator('#preview-toggle').click();
      }
      if(id==='umbrella'&&mode==='scene')await p.screenshot({path:'artifacts/studio-play.png',fullPage:true});
    }
    await p.clock.runFor(22000);assert.match(await p.locator('#runtime-status').textContent(),/已到达终点/);
  }
  const result=await p.locator('#runtime-actor').textContent();await p.locator('#editor-return').click();return result;
}
try{
  const p=await pageAt(process.argv[2]??'http://127.0.0.1:'+server.address().port+'/');
  await p.locator('#display-mode').selectOption('logic');
  assert.equal(await p.locator('#animation-toggle').isChecked(),false,'respect reduced-motion preferences until explicitly enabled');
  assert.equal((await draft(p)).id,'editor-first-level');assert.equal(await p.locator('#example-select').count(),0);
  const initial=await draft(p);await p.locator('[data-ref="entity:cloud"]').click();
  await value(p,'#object-label','可编辑云桥');assert.equal((await draft(p)).entities[0].label,'可编辑云桥');await p.locator('#editor-undo').click();
  assert.equal(await p.locator('#art-width').isVisible(),false,'resource controls are separate from the logic inspector');
  const delay=p.locator('[data-behavior="appear"] [data-action-delay]');assert.equal(await delay.inputValue(),'5');await delay.fill('7');await delay.press('Enter');assert.equal((await draft(p)).entities[0].behaviors[0].actions.find(a=>a.type==='after').ticks,420);await p.locator('#editor-undo').click();
  await p.locator('#display-mode').selectOption('logic');await p.locator('[data-ref="entity:prop"]').click();
  const before=(await draft(p)).entities.find(e=>e.id==='prop'),handle=await p.locator('[data-resize="e"]').boundingBox(),map=await p.locator('#editor-overlay').boundingBox();
  await p.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await p.mouse.down();await p.mouse.move(handle.x+handle.width/2+20/1200*map.width,handle.y+handle.height/2,{steps:6});await p.mouse.up();
  assert.equal((await draft(p)).entities.find(e=>e.id==='prop').width,before.width+20);await p.locator('#editor-undo').click();
  await p.locator('#open-data').click();assert.deepEqual(JSON.parse(await p.locator('#level-json').inputValue()),initial);await p.locator('#close-data').click();
  await p.reload();await p.locator('#editor-overlay').waitFor();assert.deepEqual(await draft(p),initial);
  const logic=await play(p,'logic'),scene=await play(p,'scene');assert.equal(logic,scene,'both views run identical physics');await play(p,'scene',{early:true});
  await p.locator('#display-mode').selectOption('logic');await p.screenshot({path:'artifacts/studio-logic.png',fullPage:true});
  await p.locator('#display-mode').selectOption('scene');await p.screenshot({path:'artifacts/studio-scene.png',fullPage:true});
  const built=await buildEditor(),offline=await pageAt(pathToFileURL(built.path).href),requests=[];
  offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await play(offline,'scene');assert.deepEqual(requests,[]);
  assert.deepEqual(errors,[]);console.log('PASS studio: one level, timing edits, scene/logic parity, animated pause and switch, moving click targets, resize, history/JSON and offline completion.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
