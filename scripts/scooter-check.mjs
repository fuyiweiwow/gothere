import {readSourceLevel,importLevel} from './check-source-helpers.mjs';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {createCrosswalkLevel} from '../src/editor/crosswalk-level.js';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const errors=[];
async function drag(p,dx,dy,{cancel=false,release=true}={}){
  const target=p.locator('#scene-interactions [data-source=barrier]'),b=await target.boundingBox(),v=await p.locator('#viewport').boundingBox();
  const x=b.x+b.width/2,y=b.y+b.height/2;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx*v.width/1200,y+dy*v.height/640,{steps:10});
  if(cancel)await p.keyboard.press('Escape');if(release)await p.mouse.up();
}
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=scooter',offline+'?sample=scooter'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-05T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const before=await draft(p);assert.equal(before.id,'commute-scooter');
    await p.locator('#display-mode').selectOption('logic');await p.locator('[data-ref="entity:barrier"]').click({force:true});
    assert.equal(await p.locator('#object-draggable').isChecked(),true);assert.equal(await p.locator('#drop-target-gap').isChecked(),true);
    assert.equal(await p.locator('[data-event=droprejected]').count(),1);
    await p.locator('#drop-target-gap').uncheck();assert.deepEqual((await draft(p)).entities[0].draggable.targets,[]);await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);
    await p.locator('[data-ref="entity:gap"]').click({force:true});await p.locator('#object-drop-target').click();assert.equal(await p.locator('#object-drop-target').isChecked(),true);assert.deepEqual(await draft(p),before);
    await p.locator('#object-drop-radius').fill('50');await p.locator('#object-drop-radius').press('Enter');assert.equal((await draft(p)).entities[1].dropTarget.radius,50);await p.locator('#editor-undo').click();
    for(const mode of ['scene','logic']){
      await p.locator('#display-mode').selectOption(mode);await p.locator('#preview-toggle').click();
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/scooter-initial-'+index+'.png'});
      await drag(p,100,-120);await p.clock.runFor(300);assert.match(await p.locator('#runtime-log').innerText(),/未放到接收点/);
      let box=await p.locator('#scene-interactions [data-source=barrier]').boundingBox();const original=box.x;
      await drag(p,582,0,{cancel:true});await p.clock.runFor(300);box=await p.locator('#scene-interactions [data-source=barrier]').boundingBox();assert.ok(Math.abs(original-box.x)<1);
      await p.locator('#preview-toggle').click();assert.equal(await p.locator('#scene-interactions [data-source=barrier]').isDisabled(),true);await p.locator('#preview-toggle').click();
      await p.locator('#zoom-in').click();await p.locator('#zoom-in').click();await drag(p,582,0);await p.clock.runFor(300);
      assert.match(await p.locator('#runtime-log').innerText(),/两根路桩之间/);assert.equal(await p.locator('#scene-interactions [data-source=barrier]').isDisabled(),true);
      await p.locator('#zoom-fit').click();await p.clock.runFor(6800);
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/scooter-blocked-'+index+'.png'});
      await p.clock.runFor(14000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
      if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/scooter-finish-'+index+'.png'});
      await p.locator('#preview-reset').click();assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'ready');
      await p.locator('#editor-return').click();assert.deepEqual(await draft(p),before);
    }
    await p.locator('#display-mode').selectOption('scene');await p.locator('#preview-toggle').click();await p.clock.runFor(9000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');
    await p.locator('#scene').screenshot({path:'artifacts/scooter-failure-'+index+'.png'});await p.locator('#editor-return').click();
    await p.locator('#preview-toggle').click();await drag(p,250,0,{release:false});await p.locator('#preview-reset').evaluate(b=>b.click());await p.mouse.up();await p.locator('#preview-toggle').click();await p.clock.runFor(9000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');await p.locator('#editor-return').click();
    assert.deepEqual(await readSourceLevel(p),before);await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    const both=structuredClone(before);both.rules.push({on:{source:'barrier',type:'click'},actions:[{type:'set',target:'phase',state:'active'}]});
    await importLevel(p,both);await p.locator('#preview-toggle').click();
    await p.locator('#scene-interactions [data-source=barrier]').click();await p.clock.runFor(300);assert.match(await p.locator('#runtime-log').innerText(),/车辆已经靠近/);await p.locator('#editor-return').click();
    await p.evaluate(level=>{level.name='Saved crossing';const key='gothere.studio.layered.v1',s=JSON.parse(localStorage.getItem(key));s.documents=[{key:'commute:crosswalk:01',level}];s.activeKey='commute:crosswalk:01';localStorage.setItem(key,JSON.stringify(s));},createCrosswalkLevel());
    const root=new URL(url);root.search='';await p.goto(root.href);await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).id,'commute-chapter');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).documents.find(d=>d.key==='commute:crosswalk:01').level.name),'Saved crossing');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS scooter '+(index?'offline':'online')+': placement inspector, real drag in both views with zoom, rejection/cancel/pause/reset, solution/failure, JSON/history and preserved drafts.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
