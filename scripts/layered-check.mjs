import {readSourceLevel,importLevel} from './check-source-helpers.mjs';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {STREET_PLAN} from '../src/editor/street-level.js';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const value=async(p,id,v)=>{await p.locator(id).fill(String(v));await p.locator(id).press('Enter');};
const errors=[];
try{
  for(const [index,url] of ['http://127.0.0.1:'+server.address().port+'/?sample=commute',pathToFileURL((await buildEditor()).path).href+'?sample=commute'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1050}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(url.startsWith('file:')&&/^https?:/.test(r.url()))requests.push(r.url());});
    const start=new Date('2026-11-04T00:00:00Z');await p.clock.install({time:start});await p.clock.pauseAt(new Date(+start+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const before=await draft(p);assert.equal(before.schemaVersion,3);
    await p.locator('#display-mode').selectOption('logic');await p.locator('#editor-tab-map').click();
    await value(p,'#space-plane-lane',390);assert.equal((await draft(p)).spatial.planes.find(t=>t.id==='lane').depth,230);await p.locator('#editor-undo').click();
    await p.locator('[data-space-node="front-alley"]').click({force:true});assert.equal(await p.locator('#space-node-plane').inputValue(),'front');
    const initialX=(await draft(p)).spatial.nodes.find(n=>n.id==='front-alley').x;
    const node=p.locator('[data-space-node="front-alley"]'),b=await node.boundingBox();
    await p.keyboard.down('Alt');await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2+16,b.y+b.height/2,{steps:4});await p.mouse.up();await p.keyboard.up('Alt');
    assert.notEqual((await draft(p)).spatial.nodes.find(n=>n.id==='front-alley').x,initialX);await p.locator('#editor-undo').click();
    await p.locator('[data-ref="entity:side-door"]').click({force:true});assert.equal(await p.locator('#object-passage').isChecked(),true);
    await p.locator('#object-passage').uncheck();assert.equal((await draft(p)).entities.find(e=>e.id==='side-door').passage.enabled,false);await p.locator('#editor-undo').click();
    await p.locator('[data-ref="entity:scooter"]').click({force:true});
    for(const id of ['#object-pose','#object-motion','#object-surface','#object-collider'])assert.equal(await p.locator(id).isDisabled(),true);
    await value(p,'#object-passage-progress',.7);
    assert.equal((await draft(p)).entities.find(e=>e.id==='scooter').space.progress,.7);await p.locator('#editor-undo').click();
    await p.locator('#object-location').selectOption('plane');assert.equal((await draft(p)).entities.find(e=>e.id==='scooter').space.plane,'front');await p.locator('#editor-undo').click();
    await p.locator('[data-ref="entity:breakfast"]').click({force:true});assert.equal(await p.locator('#object-space-plane').inputValue(),'front');
    const object=p.locator('[data-ref="entity:breakfast"]'),o=await object.boundingBox();
    await p.keyboard.down('Alt');await p.mouse.move(o.x+o.width/2,o.y+o.height/2);await p.mouse.down();await p.mouse.move(o.x+o.width/2+10,o.y+o.height/2-12,{steps:4});await p.mouse.up();await p.keyboard.up('Alt');
    assert.ok((await draft(p)).entities.find(e=>e.id==='breakfast').space.height>0);assert.equal((await draft(p)).entities.find(e=>e.id==='breakfast').space.depth,45);await p.locator('#editor-undo').click();
    await p.locator('#display-mode').selectOption('scene');await p.locator('#resource-library-tab').click();
    await p.getByRole('button',{name:'街区',exact:true}).click();assert.equal(await p.locator('#asset-grid [data-asset="streetWalkIn1"]').count(),1);
    const floor=before.scene.nodes.find(n=>n.fitPassage);await p.locator('[data-art-id="'+floor.id+'"]').click();assert.equal(await p.locator('#art-passage-perspective').isChecked(),true);
    await value(p,'#art-passage-scale',.45);assert.equal((await draft(p)).scene.nodes.find(n=>n.id===floor.id).passageView.endScale,.45);await p.locator('#editor-undo').click();
    const actor=before.scene.nodes.find(n=>n.bind?.type==='actor');
    await p.locator('[data-art-id="'+actor.id+'"]').click();await p.locator('#art-state').selectOption('inward');assert.equal(await p.locator('#art-asset').inputValue(),'streetWalkIn1');
    await value(p,'#art-fps',10);assert.equal((await draft(p)).scene.nodes.find(n=>n.id===actor.id).variants.inward.animation.fps,10);await p.locator('#editor-undo').click();
    assert.deepEqual(await draft(p),before);
    await p.locator('#preview-toggle').click();let previous=0;
    for(const a of STREET_PLAN){const ms=(a.tick-1)*1000/60;await p.clock.runFor(ms-previous);previous=ms;await p.locator('#scene-interactions [data-source="'+a.source+'"]').click();
      if(a.source==='ped-signal'||a.source==='scooter-bell'){await p.clock.runFor(2000);previous+=2000;await p.screenshot({path:'artifacts/three-streets-'+a.source+'-'+index+'.png',fullPage:true});}}
    await p.clock.runFor(47000-previous);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
    await p.locator('#editor-return').click();assert.deepEqual(await draft(p),before);await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    await p.locator('#display-mode').selectOption('scene');await p.screenshot({path:'artifacts/layered-street-'+(index?'offline':'online')+'.png',fullPage:true});
    await p.locator('#editor-example').selectOption('layered');await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).id,'layered-graybox');
    await p.locator('#display-mode').selectOption('logic');await p.locator('[data-space-node="front-turn"]').click({force:true});
    await p.locator('#space-node-next').selectOption('ramp-foot');assert.ok((await draft(p)).entities.some(e=>e.passage?.from==='front-turn'&&e.passage.to==='ramp-foot'),'cross-plane route creates an authorable connector');await p.locator('#editor-undo').click();
    await p.locator('#space-node-next').selectOption('finish');assert.ok((await draft(p)).entities.some(e=>e.passage?.from==='front-turn'&&e.passage.to==='finish')===false,'different elevations cannot create an inward passage');
    await p.locator('#editor-example').selectOption('rooftop');await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await readSourceLevel(p)).schemaVersion,1);
    await p.locator('#editor-example').selectOption('commute');await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    await p.evaluate(()=>{const key='gothere.studio.layered.v1',s=JSON.parse(localStorage.getItem(key)),old=s.documents.find(d=>d.key===s.activeKey);
      old.key='commute:layered:01';old.level.name='My previous street draft';s.documents=[old];s.activeKey=old.key;localStorage.setItem(key,JSON.stringify(s));});
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).name,before.name);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).documents.find(d=>d.key==='commute:layered:01').level.name),'My previous street draft');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS layered '+(index?'offline':'online')+': plane edits, node/object dragging, connector toggle, direction animation slots, full item-chain solution, undo, persistence and v1 compatibility.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
