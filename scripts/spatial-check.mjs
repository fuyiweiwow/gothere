import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[];
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.spatial.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
try{
 for(const url of ['http://127.0.0.1:'+server.address().port+'/',pathToFileURL((await buildEditor()).path).href]){
  const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
  p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(url.startsWith('file:')&&/^https?:/.test(r.url()))requests.push(r.url());});
  await p.clock.install();await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.clock.pauseAt(new Date(Date.now()+1000));
  assert.equal((await draft(p)).id,'spatial-graybox');
  await p.locator('#display-mode').selectOption('logic');
  await p.locator('[data-space-node="far-turn"]').click();assert.equal(await p.locator('#space-node-depth').inputValue(),'300');
  await p.locator('#space-node-depth').fill('280');await p.locator('#space-node-depth').press('Enter');assert.equal((await draft(p)).spatial.nodes.find(n=>n.id==='far-turn').depth,280);
  await p.locator('#editor-undo').click();assert.equal((await draft(p)).spatial.nodes.find(n=>n.id==='far-turn').depth,300);
  const node=p.locator('[data-space-node="far-turn"]'),r=await node.boundingBox(),map=await p.locator('#editor-overlay').boundingBox();
  await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2+30/1200*map.width,r.y+r.height/2-20/640*map.height,{steps:6});await p.mouse.up();
  assert.notEqual((await draft(p)).spatial.nodes.find(n=>n.id==='far-turn').depth,300);await p.locator('#editor-undo').click();
  await p.locator('[data-ref="entity:traffic"]').click();await p.locator('#object-space-depth').fill('60');await p.locator('#object-space-depth').press('Enter');assert.equal((await draft(p)).entities.find(e=>e.id==='traffic').space.depth,60);await p.locator('#editor-undo').click();
  await p.locator('#object-label').fill('测试移动物');await p.locator('#object-label').press('Enter');assert.equal((await draft(p)).entities.find(e=>e.id==='traffic').label,'测试移动物');await p.locator('#editor-undo').click();
  await p.locator('#object-motion-speed').fill('60');await p.locator('#object-motion-speed').press('Enter');assert.equal((await draft(p)).entities.find(e=>e.id==='traffic').motion.speed,60);await p.locator('#editor-undo').click();
  const count=(await draft(p)).entities.length;await p.locator('[data-tool="object"]').click();const placement=await p.locator('#editor-overlay').boundingBox();
  await p.locator('#editor-overlay').click({position:{x:placement.width*.5,y:placement.height*.65}});await p.locator('#editor-overlay').click({position:{x:placement.width*.6,y:placement.height*.7}});
  assert.equal((await draft(p)).entities.length,count+2,'adding over an existing road remains continuous');await p.keyboard.press('Escape');await p.locator('#editor-undo').click();await p.locator('#editor-undo').click();
  const logic=structuredClone(await draft(p));await p.locator('#display-mode').selectOption('scene');
  await p.locator('[data-asset="travelerIdle"]').click();const artMap=await p.locator('#resource-overlay').boundingBox();await p.locator('#resource-overlay').click({position:{x:artMap.width*.4,y:artMap.height*.3}});
  await p.keyboard.press('Escape');await p.locator('#resource-layers .resource-layer').first().click();await p.locator('#art-bind').selectOption('actor');
  await p.locator('#art-x').fill('-12');await p.locator('#art-x').press('Enter');await p.locator('#art-y').fill('-44');await p.locator('#art-y').press('Enter');
  const artDraft=await draft(p);assert.deepEqual(artDraft.actor,logic.actor);assert.deepEqual(artDraft.platforms,logic.platforms);assert.deepEqual(artDraft.entities,logic.entities);
  await p.locator('#display-mode').selectOption('binding');await p.locator('#pick-art-binding').click();await p.locator('[data-binding-ref="actor:"]').click();
  assert.deepEqual((await draft(p)).scene.nodes[0].bind,{type:'actor'});await p.locator('#display-mode').selectOption('logic');
  for(const mode of ['logic','scene']){
   await p.locator('#display-mode').selectOption(mode);await p.locator('#preview-toggle').click();await p.locator('#runtime-inputs [data-source="traffic"]').click();
   await p.clock.runFor(42000);assert.match(await p.locator('#runtime-status').textContent(),/已到达终点/);
   await p.locator('#editor-return').click();
  }
  await p.locator('#open-data').click();const json=JSON.parse(await p.locator('#level-json').inputValue());assert.ok(json.spatial);await p.locator('#close-data').click();
  await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),json);
  await p.locator('#display-mode').selectOption('logic');await p.screenshot({path:'artifacts/spatial-'+(url.startsWith('file:')?'offline':'online')+'.png',fullPage:true});
  assert.deepEqual(requests,[]);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS spatial: route drag/fields, object depth, undo, both views complete, JSON/reload, offline no network.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
