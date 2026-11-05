import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {offscreenX} from '../src/editor/offscreen.js';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[],workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1'))),current=s=>s.documents.find(d=>d.key===s.activeKey).level;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1,`${a} / ${b}`);
async function choose(p,text){await p.getByRole('tab',{name:'仓库',exact:true}).click();await p.locator('#scene-items button').filter({hasText:text}).click();}
async function generate(p,text){await p.locator('#script-source').fill(text);await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);}
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/',offline].entries()){
    const context=await browser.newContext({viewport:{width:1650,height:1150}}),p=await context.newPage(),requests=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    try{
      await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#sound-toggle').uncheck();
      const original=await workspace(p),initial=current(original);await p.locator('#display-mode').selectOption('logic');
      await choose(p,'想从窄巷借道的电瓶车');assert.equal(await p.locator('#offscreen-enabled').isChecked(),true);
      assert.equal(await p.locator('#workspace-scene').isVisible(),true);
      await p.locator('#snap-enabled').uncheck();await p.locator('#surface-snap').uncheck();
      let box=await p.locator('[data-ref="entity:scooter"]').boundingBox(),map=await p.locator('#viewport').boundingBox();
      await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2-60*map.width/1200,box.y+box.height/2,{steps:7});await p.mouse.up();
      near(current(await workspace(p)).entities.find(e=>e.id==='scooter').x,-170);
      const handle=await p.locator('[data-resize=e]').boundingBox();await p.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await p.mouse.down();await p.mouse.move(handle.x+handle.width/2+12*map.width/1200,handle.y+handle.height/2,{steps:5});await p.mouse.up();
      near(current(await workspace(p)).entities.find(e=>e.id==='scooter').width,42);
      await p.locator('#editor-undo').click();await p.locator('#editor-undo').click();assert.deepEqual(await workspace(p),original);
      await choose(p,'等着队伍上车的公交');await p.locator('[data-offscreen-place=left]').click();
      let doc=current(await workspace(p));near(doc.entities.find(e=>e.id==='bus').x,offscreenX(initial,initial.entities.find(e=>e.id==='bus'),'left'));
      await p.locator('[data-offscreen-place=right]').click();doc=current(await workspace(p));assert.ok(doc.entities.find(e=>e.id==='bus').x>1200);
      await p.locator('#editor-undo').click();await p.locator('#editor-undo').click();assert.deepEqual(await workspace(p),original);
      const leave=p.locator('[data-behavior=leave]');await leave.locator('[data-offscreen-move=left]').click();
      doc=current(await workspace(p));near(doc.entities.find(e=>e.id==='bus').behaviors.find(b=>b.id==='leave').actions.at(-1).x,offscreenX(initial,initial.entities.find(e=>e.id==='bus'),'left'));
      await p.locator('#editor-undo').click();await leave.locator('[data-move-pick]').click();assert.equal(await p.locator('.destination-picker').count(),1);
      await p.keyboard.press('Escape');assert.equal(await p.locator('.destination-picker').count(),0);assert.deepEqual(await workspace(p),original);
      await leave.locator('[data-move-pick]').click();map=await p.locator('#viewport').boundingBox();
      await p.mouse.click(map.x+1300/1200*map.width,map.y+400/640*map.height);
      near(current(await workspace(p)).entities.find(e=>e.id==='bus').behaviors.find(b=>b.id==='leave').actions.at(-1).x,1300);
      await p.locator('#editor-undo').click();assert.deepEqual(await workspace(p),original);
      await p.locator('#display-mode').selectOption('scene');await p.locator('#map-scroll').evaluate(e=>e.scrollLeft=0);
      await p.locator('#map-scroll').screenshot({path:`artifacts/offscreen-workspace-${index}.png`});
      await p.locator('#preview-toggle').click();assert.equal(await p.locator('#workspace-scene').isVisible(),false);assert.equal(await p.locator('#offscreen-enabled').isDisabled(),true);await p.locator('#editor-return').click();assert.equal(await p.locator('#workspace-scene').isVisible(),true);
      await p.locator('#open-script').click();
      for(const code of ['return {','while (true) {}','level.actor.speed = -1; return level;','level.bad = () => 1; return level;']){
        await generate(p,code);assert.equal(await p.locator('#script-status').getAttribute('data-error'),'true');assert.equal(await p.locator('#script-apply').isDisabled(),true);assert.deepEqual(await workspace(p),original);
      }
      await p.locator('#script-source').fill('while (true) {}');await p.locator('#script-generate').click();await p.locator('#script-stop').click();assert.match(await p.locator('#script-status').innerText(),/已停止/);
      await generate(p,'level.actor.speed += 1; return level;');let result=JSON.parse(await p.locator('#script-result').inputValue());assert.equal(result.actor.speed,initial.actor.speed+1);assert.deepEqual(await workspace(p),original);
      await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.deepEqual(JSON.parse(await p.locator('#script-result').inputValue()),result,'regeneration always starts from the base');
      await p.locator('#script-dialog').screenshot({path:`artifacts/js-authoring-${index}.png`});await p.locator('#script-apply').click();assert.deepEqual(current(await workspace(p)),result);assert.equal((await workspace(p)).documents.length,original.documents.length);
      await p.locator('#display-mode').selectOption('logic');await p.locator('#editor-undo').click();assert.deepEqual(await workspace(p),original);await p.locator('#editor-redo').click();assert.deepEqual(current(await workspace(p)),result);
      await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#open-script').click();assert.equal(await p.locator('#script-source').inputValue(),'level.actor.speed += 1; return level;');
      await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.deepEqual(JSON.parse(await p.locator('#script-result').inputValue()),result,'saved base prevents accumulation after reload');
      await p.locator('#script-base').click();await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.equal(JSON.parse(await p.locator('#script-result').inputValue()).actor.speed,result.actor.speed+1);
      await p.locator('#script-example').click();await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.equal(await p.locator('#script-status').getAttribute('data-error'),'false');
      await p.locator('#script-import').click();assert.equal((await workspace(p)).documents.length,original.documents.length+1);assert.equal(current(await workspace(p)).id,'script-level');
      await p.locator('#open-script').click();assert.match(await p.locator('#script-source').inputValue(),/api.object\('cart'/);await p.locator('#close-script').click();
      assert.deepEqual(requests,[],'offline authoring makes no network requests');
    }finally{await context.close();}
  }
  assert.deepEqual(errors,[]);console.log('PASS authoring: visible offscreen dragging/resizing, art-aware placement, departure shortcuts, canvas target picking/cancellation, preview isolation, bounded JS generation, errors/cancellation, repeatable bases, undo/persistence and online/offline.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
