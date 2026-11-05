import {readSourceLevel,importLevel} from './check-source-helpers.mjs';
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
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const errors=[];
const shelterPixel=p=>p.locator('#scene').evaluate(c=>[...c.getContext('2d').getImageData(Math.round(351*c.width/1200),Math.round(494*c.height/640),1,1).data]);
async function tick(p){return Number((await p.locator('#runtime-tick').innerText()).match(/tick (\d+)/)[1]);}
async function until(p,target){for(let i=0;i<4;i++){const now=await tick(p);if(now>=target)return;await p.clock.runFor(Math.ceil((target-now)*1000/60)+20);}}
async function drag(p,source,dx,dy=0){
  const b=await p.locator('#scene-interactions [data-source='+source+']').boundingBox(),v=await p.locator('#viewport').boundingBox();
  const x=b.x+b.width/2,y=b.y+b.height/2;await p.mouse.move(x,y);await p.mouse.down();
  await p.mouse.move(x+dx*v.width/1200,y+dy*v.height/640,{steps:8});await p.mouse.up();await p.clock.runFor(300);
}
async function solution(p,index,mode){
  await p.locator('#display-mode').selectOption(mode);await p.locator('#preview-toggle').click();
  await until(p,60);await p.locator('#scene-interactions [data-source=bus]').click();
  await until(p,830);assert.equal(await p.locator('#scene-interactions [data-source=officer]').isEnabled(),true);
  await p.locator('#scene-interactions [data-source=officer]').click();
  if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/chapter-crossing-'+index+'.png'});
  await until(p,1380);assert.equal(await p.locator('#scene-interactions [data-source=caller]').isEnabled(),true);
  await p.locator('#scene-interactions [data-source=caller]').click();
  await until(p,1700);if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/chapter-tow-'+index+'.png'});
  await until(p,2040);if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/chapter-owner-'+index+'.png'});
  await p.locator('#zoom-in').click();await drag(p,'barrier',-108);await p.locator('#zoom-fit').click();
  assert.match(await p.locator('#runtime-log').innerText(),/路桩间的缺口/);
  await until(p,2440);if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/chapter-alley-'+index+'.png'});
  // Walk the whole far street; placement remains a real mouse gesture.
  await until(p,2740);await drag(p,'breakfast',295);
  assert.match(await p.locator('#runtime-log').innerText(),/空着的狗碗/);
  await until(p,3600);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
  if(mode==='scene')await p.locator('#scene').screenshot({path:'artifacts/chapter-finish-'+index+'.png'});
  await p.locator('#editor-return').click();
}
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=chapter',offline+'?sample=chapter'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-05T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const before=await draft(p);assert.equal(before.id,'commute-chapter');
    await p.locator('#display-mode').selectOption('scene');
    assert.deepEqual(await shelterPixel(p),[111,139,123,255],'the shelter roof must remain visible in front of the shop');
    await p.locator('#layer-search').fill('轻薄候车亭');await p.locator('#resource-layers .resource-layer').first().click();
    assert.equal(await p.locator('#art-plane').inputValue(),'front');assert.match(await p.locator('#art-layer').evaluate(e=>e.closest('label').textContent),/层内显示顺序/);
    await p.locator('#art-layer').fill('-80');await p.locator('#art-layer').press('Enter');
    assert.notDeepEqual(await shelterPixel(p),[111,139,123,255],'layer editing changes the actual canvas order');
    await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),before);assert.deepEqual(await shelterPixel(p),[111,139,123,255]);
    await p.locator('#layer-search').fill('');await p.locator('#scene').screenshot({path:'artifacts/chapter-initial-'+index+'.png'});
    for(const mode of ['scene','logic']){await solution(p,index,mode);assert.deepEqual(await draft(p),before);}
    assert.deepEqual(await readSourceLevel(p),before);
    await p.locator('#display-mode').selectOption('logic');await p.locator('[data-ref="entity:alley"]').click({force:true});
    assert.match(await p.locator('#editor-panel').innerText(),/窄巷/);await p.locator('#scene').screenshot({path:'artifacts/chapter-logic-'+index+'.png'});
    await p.locator('#display-mode').selectOption('scene');await p.locator('#preview-toggle').click();await until(p,380);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');await p.locator('#scene').screenshot({path:'artifacts/chapter-failure-'+index+'.png'});await p.locator('#editor-return').click();
    await p.locator('#preview-toggle').click();await until(p,60);await p.locator('#scene-interactions [data-source=bus]').click();await until(p,1400);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost');
    assert.match(await p.locator('#runtime-log').innerText(),/撞到了低头看手机/);
    await p.locator('#scene').screenshot({path:'artifacts/chapter-contact-'+index+'.png'});await p.locator('#editor-return').click();
    await p.evaluate(()=>{const key='gothere.studio.layered.v1',s=JSON.parse(localStorage.getItem(key));s.documents.find(d=>d.key===s.activeKey).level.name='My saved chapter';localStorage.setItem(key,JSON.stringify(s));});
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).name,'My saved chapter');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS chapter '+(index?'offline':'online')+': whole route in both views, zoomed real placement, causal windows, editable passages, JSON and preserved draft.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
