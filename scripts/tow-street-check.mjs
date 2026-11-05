import {readSourceLevel,importLevel} from './check-source-helpers.mjs';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const errors=[];
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=tow-street',offline+'?sample=tow-street'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-05T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#display-mode').selectOption('scene');const before=await draft(p);
    assert.equal(before.id,'commute-tow-street');await p.locator('#scene').screenshot({path:'artifacts/tow-initial-'+index+'.png'});
    await p.locator('[data-art-id=tow-car]').click();await p.locator('#art-width').fill('270');await p.locator('#art-width').press('Enter');assert.deepEqual((await draft(p)).entities,before.entities);
    await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);
    for(const mode of ['scene','logic']){
      await p.locator('#display-mode').selectOption(mode);await p.locator('#preview-toggle').click();await p.clock.runFor(3000);
      if(mode==='scene'){
        const map=await p.locator('#viewport').boundingBox();
        await p.mouse.click(map.x+487/1200*map.width,map.y+455/640*map.height);
      }else await p.locator('#scene-interactions [data-source=caller]').click();
      await p.clock.runFor(1700);
      assert.equal(await p.locator('#scene-interactions [data-source=caller]').isDisabled(),true);
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/tow-arriving-'+index+'.png'});
      await p.clock.runFor(3600);if(mode==='scene'){
        await p.locator('#scene').screenshot({path:'artifacts/tow-hooked-'+index+'.png'});
        await p.locator('#preview-toggle').click();const still=await p.locator('#scene').evaluate(c=>c.toDataURL());await p.clock.runFor(200);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),still);await p.locator('#preview-toggle').click();
      }
      await p.clock.runFor(2400);if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/tow-owner-door-'+index+'.png'});
      await p.clock.runFor(1300);if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/tow-chase-'+index+'.png'});
      await p.clock.runFor(13000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/tow-cleared-'+index+'.png'});
      await p.locator('#editor-return').click();assert.deepEqual(await draft(p),before);
    }
    await p.locator('#preview-toggle').click();await p.clock.runFor(18000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');await p.locator('#editor-return').click();
    assert.deepEqual(await readSourceLevel(p),before);
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    await p.evaluate(level=>{level.name='Saved bus edit';const key='gothere.studio.layered.v1',s=JSON.parse(localStorage.getItem(key));s.documents=[{key:'commute:bus-stop:03',level}];s.activeKey='commute:bus-stop:03';localStorage.setItem(key,JSON.stringify(s));},createBusStopLevel());
    const root=new URL(url);root.search='';await p.goto(root.href);await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).id,'commute-chapter');
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).documents.find(d=>d.key==='commute:bus-stop:03').level.name),'Saved bus edit');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS tow street '+(index?'offline':'online')+': full scene/logic play, pause, failure, editable art, history/JSON, persistence and preserved bus drafts.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
