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
const errors=[],draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const fill=async(p,selector,value)=>{await p.locator(selector).fill(String(value));await p.locator(selector).press('Enter');};
async function point(p,x,y){const b=await p.locator('#resource-overlay').boundingBox();await p.mouse.click(b.x+x*b.width/1200,b.y+y*b.height/640);}
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=templates',offline+'?sample=templates'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-04T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#display-mode').selectOption('scene');
    assert.equal(await p.locator('#resource-template-tab').getAttribute('aria-selected'),'true');const initial=await draft(p);
    assert.equal(initial.entities.length,0);assert.equal(initial.scene.compositions.length,1);
    await p.locator('[data-template=apartment-building]').click();await point(p,300,423);await point(p,600,423);
    assert.equal((await draft(p)).scene.compositions.length,3);assert.equal(await p.locator('#resource-overlay').getAttribute('data-placing'),'true');
    await p.keyboard.press('Escape');await p.locator('#editor-undo').click();await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),initial);
    await p.locator('[data-template=bus-encounter]').click();await point(p,680,160);await p.keyboard.press('Escape');
    const placed=await draft(p),c=placed.scene.compositions.find(c=>c.entities.length),bus=placed.entities.find(e=>e.behaviors?.some(b=>b.id==='open'));
    assert.equal(placed.entities.length,7);assert.equal(c.origin.y,490,'activity placement snaps to the plane rather than cursor height');
    await p.locator('[data-select-composition="'+c.id+'"]').click();await fill(p,'#composition-x',640);
    assert.ok(Math.abs((await draft(p)).entities.find(e=>e.id===bus.id).x-640)<.01);await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),placed);
    const b=await p.locator('#resource-overlay').boundingBox(),handle=await p.locator('[data-composition-handle]').boundingBox();
    await p.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await p.keyboard.down('Alt');await p.mouse.down();
    await p.mouse.move(handle.x+handle.width/2+24*b.width/1200,handle.y+handle.height/2+20*b.height/640,{steps:4});await p.mouse.up();await p.keyboard.up('Alt');
    assert.ok(Math.abs((await draft(p)).entities.find(e=>e.id===bus.id).x-(bus.x+24))<.2);assert.equal((await draft(p)).scene.compositions.find(g=>g.id===c.id).origin.y,490);
    await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),placed);
    await p.locator('#composition-copy').click();assert.equal((await draft(p)).entities.length,14);await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),placed);
    await p.locator('[data-select-composition="'+c.id+'"]').click();await p.screenshot({path:'artifacts/templates-editor-'+index+'.png',fullPage:true});
    const door=placed.scene.nodes.find(n=>n.asset==='stopBusDoor');await p.locator('[data-template-part="'+door.id+'"]').click();
    assert.equal(await p.locator('#art-bind').inputValue(),'entity:'+bus.id);await fill(p,'#art-y',-90);assert.deepEqual((await draft(p)).entities,placed.entities);await p.locator('#editor-undo').click();
    if(await p.locator('.feedback-slot').first().getAttribute('open')===null)await p.locator('.feedback-slot > summary').first().click();assert.equal(await p.locator('[data-feedback-field=sound]').first().inputValue(),'clack');
    await p.locator('[data-feedback-preview]').first().click();await p.clock.runFor(120);assert.ok(Number(await p.locator('#scene').getAttribute('data-feedback-active'))>0);await p.clock.runFor(500);
    const passenger=placed.scene.nodes.find(n=>n.asset==='stopPassengerAIdle');await p.locator('[data-art-id="'+passenger.id+'"]').click();await p.locator('#art-state').selectOption('moving');
    assert.equal(await p.locator('#art-fps').inputValue(),'8');await fill(p,'#art-fps',10);await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),placed);
    await p.locator('#open-data').click();assert.deepEqual(JSON.parse(await p.locator('#level-json').inputValue()),placed);await p.locator('#close-data').click();
    await p.locator('#preview-toggle').click();await p.clock.runFor(3000);await p.locator('#scene-interactions [data-source="'+bus.id+'"]').click();await p.clock.runFor(1200);
    await p.locator('#scene').screenshot({path:'artifacts/templates-boarding-'+index+'.png'});await p.locator('#preview-toggle').click();const still=await p.locator('#scene').evaluate(c=>c.toDataURL());
    await p.clock.runFor(250);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),still);await p.locator('#preview-toggle').click();await p.clock.runFor(15000);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');await p.locator('#editor-return').click();assert.deepEqual(await draft(p),placed);
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),placed);
    await p.locator('#template-practice').click();assert.equal((await draft(p)).entities.length,0);
    assert.equal(await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key==='templates:practice:01').level.entities.length;}),7);
    assert.deepEqual(requests,[]);await context.close();console.log('PASS templates '+(index?'offline':'online')+': continuous placement, grounded logic, group dragging/copy, parts, animation/sound, history, persistence and complete play.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
