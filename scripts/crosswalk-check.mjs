import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {createTowStreetLevel} from '../src/editor/tow-street-level.js';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const errors=[];
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=crosswalk',offline+'?sample=crosswalk'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-05T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const before=await draft(p);assert.equal(before.id,'commute-crosswalk');
    await p.locator('#display-mode').selectOption('logic');await p.locator('[data-ref="entity:jaywalker"]').click({force:true});
    const leave=p.locator('[data-behavior=aside]');assert.equal(await leave.locator('[data-move-plane]').inputValue(),'far');
    await leave.locator('[data-move-plane]').selectOption('');assert.equal((await draft(p)).entities.find(e=>e.id==='jaywalker').behaviors.find(b=>b.id==='aside').actions[0].progress,1);
    await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);
    await leave.locator('[data-move-plane]').selectOption('near');assert.equal(await leave.locator('[data-move-x]').inputValue(),'520');
    await p.locator('#editor-undo').click();await leave.locator('[data-move-x]').fill('620');await leave.locator('[data-move-x]').press('Enter');
    assert.equal((await draft(p)).entities.find(e=>e.id==='jaywalker').behaviors.find(b=>b.id==='aside').actions[0].x,620);await p.locator('#editor-undo').click();
    await p.locator('#display-mode').selectOption('scene');await p.locator('#scene').screenshot({path:'artifacts/crosswalk-initial-'+index+'.png'});
    await p.locator('[data-art-id=cross-officer]').click();await p.locator('#art-width').fill('52');await p.locator('#art-width').press('Enter');assert.deepEqual((await draft(p)).entities,before.entities);
    await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);
    for(const mode of ['scene','logic']){
      await p.locator('#display-mode').selectOption(mode);await p.locator('#preview-toggle').click();await p.clock.runFor(4000);
      if(mode==='scene'){
        const map=await p.locator('#viewport').boundingBox();await p.mouse.click(map.x+765/1200*map.width,map.y+366/640*map.height);
      }else await p.locator('#scene-interactions [data-source=officer]').click();
      await p.clock.runFor(1300);assert.equal(await p.locator('#scene-interactions [data-source=officer]').isDisabled(),true);
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/crosswalk-warning-'+index+'.png'});
      await p.clock.runFor(4400);if(mode==='scene'){
        await p.locator('#scene').screenshot({path:'artifacts/crosswalk-clear-'+index+'.png'});
        await p.locator('#preview-toggle').click();const still=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.clock.runFor(250);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),still);await p.locator('#preview-toggle').click();
      }
      await p.clock.runFor(3300);if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/crosswalk-phones-'+index+'.png'});
      await p.clock.runFor(11000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/crosswalk-finish-'+index+'.png'});
      await p.locator('#editor-return').click();assert.deepEqual(await draft(p),before);
    }
    await p.locator('#preview-toggle').click();await p.clock.runFor(12000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');await p.locator('#editor-return').click();
    await p.locator('#open-data').click();assert.deepEqual(JSON.parse(await p.locator('#level-json').inputValue()),before);await p.locator('#close-data').click();
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    await p.evaluate(level=>{level.name='Saved towing edit';const key='gothere.studio.layered.v1',s=JSON.parse(localStorage.getItem(key));s.documents=[{key:'commute:tow-street:01',level}];s.activeKey='commute:tow-street:01';localStorage.setItem(key,JSON.stringify(s));},createTowStreetLevel());
    const root=new URL(url);root.search='';await p.goto(root.href);await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).id,'commute-scooter');
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).documents.find(d=>d.key==='commute:tow-street:01').level.name),'Saved towing edit');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS crosswalk '+(index?'offline':'online')+': authored exit controls, real scene clicks, both views, failure, pause, JSON/history and preserved tow drafts.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
