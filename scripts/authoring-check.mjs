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
      assert.deepEqual(requests,[],'offline authoring makes no network requests');
    }finally{await context.close();}
  }
  assert.deepEqual(errors,[]);console.log('PASS authoring: visible offscreen dragging/resizing, art-aware placement, departure shortcuts, canvas target picking/cancellation, preview isolation, bounded JS generation, errors/cancellation, repeatable bases, undo/persistence and online/offline.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
