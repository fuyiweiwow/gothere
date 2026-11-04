import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {COMMUTE_PLAN} from '../src/editor/commute-level.js';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[],draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.spatial.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
async function value(p,id,v){await p.locator(id).fill(String(v));await p.locator(id).press('Enter');}
try{
  const urls=['http://127.0.0.1:'+server.address().port+'/',pathToFileURL((await buildEditor()).path).href];
  for(const [index,url] of urls.entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1050}}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(url.startsWith('file:')&&/^https?:/.test(r.url()))requests.push(r.url());});
    const start=new Date('2026-11-04T00:00:00Z');await p.clock.install({time:start});await p.clock.pauseAt(new Date(+start+1000));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();assert.equal((await draft(p)).id,'commute-spatial');
    await p.locator('#display-mode').selectOption('logic');
    await p.locator('[data-ref="entity:bus"]').click({force:true});
    await value(p,'[data-behavior="brake"] [data-move-depth]',210);
    assert.equal((await draft(p)).entities.find(e=>e.id==='bus').behaviors[1].actions[0].depth,210);await p.locator('#editor-undo').click();
    await p.locator('[data-space-node="far-stop"]').click({force:true});await value(p,'#space-node-depth',230);
    assert.equal((await draft(p)).spatial.nodes.find(n=>n.id==='far-stop').depth,230);await p.locator('#editor-undo').click();
    await p.locator('[data-ref="entity:loading-ramp"]').click({force:true});assert.equal(await p.locator('#object-pose').isChecked(),true);
    assert.equal(await p.locator('[data-rotate-angle]').count(),1);
    const before=await draft(p),tree=before.scene.nodes.find(n=>n.anchor&&n.asset==='commuteTree'),road=before.scene.nodes.find(n=>n.ground);
    await p.locator('#display-mode').selectOption('scene');await p.locator('[data-art-id="'+tree.id+'"]').click();
    await value(p,'#art-space-depth',tree.anchor.depth+10);assert.equal((await draft(p)).scene.nodes.find(n=>n.id===tree.id).anchor.depth,tree.anchor.depth+10);await p.locator('#editor-undo').click();
    await p.locator('[data-art-id="'+road.id+'"]').click();const h=await p.locator('[data-art-resize="se"]').boundingBox();
    await p.keyboard.down('Alt');await p.mouse.move(h.x+h.width/2,h.y+h.height/2);await p.mouse.down();await p.mouse.move(h.x+h.width/2+14,h.y+h.height/2-10,{steps:4});await p.mouse.up();await p.keyboard.up('Alt');
    assert.notEqual((await draft(p)).scene.nodes.find(n=>n.id===road.id).ground.width,road.ground.width);await p.locator('#editor-undo').click();
    assert.deepEqual(await draft(p),before,'art edits undo without altering the logic');
    await p.locator('#display-mode').selectOption('binding');await p.locator('[data-art-id="'+before.scene.nodes.find(n=>n.bind?.id==='bus').id+'"]').click();
    assert.equal(await p.locator('#art-bind').inputValue(),'entity:bus');
    await p.locator('#display-mode').selectOption(index?'scene':'logic');
    await p.locator('#preview-toggle').click();let previous=0;
    for(const a of COMMUTE_PLAN){const ms=a.tick*1000/60;await p.clock.runFor(ms-previous);previous=ms;await p.locator('#scene-interactions [data-source="'+a.source+'"]').click();}
    await p.clock.runFor(52000-previous);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
    await p.screenshot({path:'artifacts/commute-'+(index?'offline':'online')+'.png',fullPage:true});
    await p.locator('#editor-return').click();assert.deepEqual(await draft(p),before);
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    await p.locator('#editor-example').selectOption('rooftop');await p.locator('#scene[data-assets=ready]').waitFor();
    await p.locator('#open-data').click();const legacy=JSON.parse(await p.locator('#level-json').inputValue());assert.equal(legacy.id,'editor-first-level');assert.equal(legacy.schemaVersion,1);await p.locator('#close-data').click();
    await p.locator('#editor-example').selectOption('commute');await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),before);
    assert.deepEqual(requests,[]);await context.close();console.log('PASS commute '+(index?'offline':'online')+': editable movement/rotation, depth nodes, world art, resize/undo, binding, full route, sample switching and saved drafts.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
