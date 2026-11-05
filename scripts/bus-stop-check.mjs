import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {createStreetLevel} from '../src/editor/street-level.js';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const value=async(p,id,v)=>{await p.locator(id).fill(String(v));await p.locator(id).press('Enter');};
const errors=[];
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=bus-stop',offline+'?sample=bus-stop'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-04T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#display-mode').selectOption('scene');const before=await draft(p);
    assert.equal(before.id,'commute-bus-stop');await p.locator('#scene').screenshot({path:'artifacts/bus-stop-scene-'+index+'.png'});
    await p.locator('#display-mode').selectOption('logic');await p.locator('[data-ref="entity:bus"]').click({force:true});
    await value(p,'[data-behavior=leave] [data-move-x]',1300);assert.equal((await draft(p)).entities.find(e=>e.id==='bus').behaviors.find(b=>b.id==='leave').actions[1].actions[0].x,1300);
    await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);await p.locator('#display-mode').selectOption('scene');
    await p.locator('#layer-group').selectOption('建筑');assert.equal(await p.locator('#resource-layers [data-art-id]').count(),4);
    await p.locator('#group-lock').click();assert.equal(await p.locator('[data-art=stop-left]').count(),0);await p.locator('#group-lock').click();assert.equal(await p.locator('[data-art=stop-left]').count(),1);
    const picture=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.locator('#group-visibility').click();assert.notEqual(await p.locator('#scene').evaluate(c=>c.toDataURL()),picture);
    await p.locator('#group-visibility').click();assert.deepEqual(await draft(p),before);
    await p.locator('[data-art-id=stop-left]').click();await value(p,'#art-x',-16);assert.equal((await draft(p)).scene.nodes.find(n=>n.id==='stop-left').x,-16);
    assert.deepEqual((await draft(p)).entities,before.entities);await p.locator('#editor-undo').click();
    await value(p,'#art-group','街区建筑');assert.equal((await draft(p)).scene.nodes.find(n=>n.id==='stop-left').group,'街区建筑');await p.locator('#editor-undo').click();
    await p.locator('#layer-group').selectOption('乘客');await p.locator('[data-art-id=stop-person-c]').click();await p.locator('#art-state').selectOption('moving');
    assert.equal(await p.locator('#art-fps').inputValue(),'8');await value(p,'#art-fps',10);await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);
    await p.locator('#open-data').click();assert.deepEqual(JSON.parse(await p.locator('#level-json').inputValue()),before);await p.locator('#close-data').click();
    for(const mode of ['scene','logic']){
      await p.locator('#display-mode').selectOption(mode);await p.locator('#preview-toggle').click();await p.clock.runFor(3000);
      if(mode==='scene'){
        const map=await p.locator('#viewport').boundingBox(),target=await p.locator('#scene-interactions [data-source=bus]').boundingBox();
        assert.ok(target.width>map.width/4,'the visible whole bus is clickable');
        await p.mouse.click(map.x+775/1200*map.width,map.y+444/640*map.height);
      }else await p.locator('#scene-interactions [data-source=bus]').click();
      await p.clock.runFor(1200);
      assert.equal(await p.locator('#scene-interactions [data-source=bus]').isDisabled(),true);
      if(mode==='scene'){
        await p.locator('#scene').screenshot({path:'artifacts/bus-stop-boarding-'+index+'.png'});
        await p.locator('#preview-toggle').click();const still=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.clock.runFor(250);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),still);await p.locator('#preview-toggle').click();
      }
      await p.clock.runFor(4800);
      assert.match(await p.locator('#runtime-entities').textContent(),/队尾的公文包乘客inactive/);
      await p.clock.runFor(600);
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/bus-stop-departure-'+index+'.png'});
      await p.clock.runFor(9400);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
      assert.match(await p.locator('#runtime-entities').textContent(),/公交车active/);
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/bus-stop-cleared-'+index+'.png'});
      await p.locator('#editor-return').click();assert.deepEqual(await draft(p),before);
    }
    await p.locator('#preview-toggle').click();await p.clock.runFor(9000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');await p.locator('#editor-return').click();
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    // Switching to this trial must retain an authored previous street draft.
    await p.evaluate(level=>{const key='gothere.studio.layered.v1',s=JSON.parse(localStorage.getItem(key));level.name='Saved street edits';s.documents=[{key:'commute:layered:02',level}];s.activeKey='commute:layered:02';localStorage.setItem(key,JSON.stringify(s));},createStreetLevel());
    const defaultURL=new URL(url);defaultURL.search='';await p.goto(defaultURL.href);await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).id,'commute-crosswalk');
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).documents.find(d=>d.key==='commute:layered:02').level.name),'Saved street edits');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS bus stop '+(index?'offline':'online')+': art groups, editing, moving clips, body hitbox, complete scene/logic play, failure, persistence and old drafts.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
