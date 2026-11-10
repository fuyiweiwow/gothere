import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {readSourceLevel} from './check-source-helpers.mjs';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';

await mkdir('artifacts',{recursive:true});
await buildEditor();
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[];
const tick=p=>p.locator('#play-canvas').evaluate(c=>Number(c.dataset.tick));
async function until(p,target){
  for(let i=0;i<8;i++){
    const current=await tick(p),state=await p.locator('#play-canvas').getAttribute('data-status');
    if(current>=target||['won','lost'].includes(state))return;
    await p.clock.runFor(Math.ceil((target-current)*1000/60)+20);
  }
  assert.fail('play did not reach '+target);
}
try{
  const editorContext=await browser.newContext({viewport:{width:1600,height:1100}}),editor=await editorContext.newPage();
  editor.on('pageerror',e=>errors.push(e.message));
  // A user who tried the earlier art study should get the corrected sample,
  // with their earlier edits still available in the old draft slot.
  await editor.goto(base);
  await editor.evaluate(level=>{
    const key='commute:painted-bus:01';
    level.name='Previous painted study edits';
    localStorage.setItem('gothere.studio.layered.v1',JSON.stringify({version:1,activeKey:key,documents:[{key,level}]}));
  },createBusStopLevel());
  await editor.goto(base+'/?sample=painted-bus-stop');await editor.locator('#scene[data-assets=ready]').waitFor();
  assert.equal(await editor.locator('#editor-example').inputValue(),'painted-bus-stop');
  assert.match(await editor.locator('#formal-play').getAttribute('href'),/sample=painted-bus-stop/);
  const read=()=>editor.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
  const before=await read();assert.equal(before.id,'commute-painted-bus-stop');
  assert.equal(await editor.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).documents.find(d=>d.key==='commute:painted-bus:01').level.name),'Previous painted study edits');
  await editor.locator('#scene').screenshot({path:'artifacts/painted-bus-editor.png'});
  await editor.locator('#layer-group').selectOption('站台');await editor.locator('[data-art-id=stop-shelter]').click();
  assert.deepEqual(await read(),before,'selection does not modify the level');
  assert.deepEqual(await readSourceLevel(editor),before,'typed project keeps the new raster references and clips');
  await editor.reload();await editor.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await read(),before);
  await editorContext.close();

  for(const [name,url]of [
    ['online',base+'/?play&sample=painted-bus-stop'],
    ['offline',pathToFileURL(fileURLToPath(new URL('../dist/gothere-painted-bus.html',import.meta.url))).href+'?sample=chapter'],
  ]){
    const context=await browser.newContext({viewport:{width:1440,height:900}}),p=await context.newPage(),requests=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(name==='offline'&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-09T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#play-canvas[data-assets=ready]').waitFor();
    // Verify the painted rear tire in the actual canvas, below the curb at y=520.
    // This catches road-placement failures even when animation/logic still pass.
    const tire=await p.locator('#play-canvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(Math.round(734*c.width/1200),Math.round(558*c.height/640),1,1).data));
    assert.ok(tire[0]<70&&tire[1]<85&&tire[2]<85,'the bus rear tire must be drawn on the road');
    assert.equal(await p.locator('#level-hint').count(),0);
    assert.equal(await p.locator('#play-targets [data-source=officer]').count(),0,'standalone file opens this slice without a URL parameter');
    await p.locator('#play-sound').click();await p.locator('#play-start').click();
    await until(p,448);assert.equal(await p.locator('#play-canvas').getAttribute('data-status'),'lost');
    await p.clock.runFor(1200);await p.locator('#play-canvas').screenshot({path:'artifacts/painted-bus-'+name+'-failure.png'});
    const lostTick=await tick(p),still=await p.locator('#play-canvas').evaluate(c=>c.toDataURL());
    await p.clock.runFor(1000);assert.equal(await tick(p),lostTick);assert.equal(await p.locator('#play-canvas').evaluate(c=>c.toDataURL()),still);
    await p.locator('#play-start').click();await until(p,60);await p.locator('#play-targets [data-source=bus]').click();
    await until(p,100);await p.locator('#play-canvas').screenshot({path:'artifacts/painted-bus-'+name+'-boarding.png'});
    await until(p,136);await p.locator('#play-canvas').screenshot({path:'artifacts/painted-bus-'+name+'-entrance.png'});
    await until(p,600);await p.locator('#play-canvas').screenshot({path:'artifacts/painted-bus-'+name+'-departure.png'});
    await until(p,1045);assert.equal(await p.locator('#play-canvas').getAttribute('data-status'),'won');
    assert.deepEqual(requests,[]);
    await context.close();console.log('PASS painted bus '+name+': foreground road, hidden far-side doors, boarding/failure/exit, no hints and offline assets.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
