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
const errors=[],workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.v1')));
const active=s=>s.documents.find(d=>d.key===s.activeKey).level;
async function scenario(url,offline){
  const context=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),p=await context.newPage();
  try{
    p.on('pageerror',e=>errors.push(e.message));
    if(offline)await p.route(/^https?:/,route=>{errors.push('unexpected network '+route.request().url());return route.abort();});
    await p.clock.install({time:new Date('2026-11-02T00:00:00Z')});await p.clock.pauseAt(new Date('2026-11-02T00:00:01Z'));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const before=await workspace(p);
    await p.locator('#open-experiments').click();await p.locator('[data-experiment=peach-delivery]').click();
    assert.equal(await p.locator('[data-experiment="peach-delivery"]').count(),1,'themed vignette must be selectable');
    assert.equal(await p.locator('#experiment-title').textContent(),'仙长，请收桃');
    await p.locator('#experiment-map[data-assets=ready][data-view=scene]').waitFor();
    assert.equal(await p.locator('#experiment-help').getAttribute('open'),null);
    assert.deepEqual(await workspace(p),before,'catalog cannot replace the current document');
    // Rapid selection must not let an earlier asynchronous asset load repaint the next entry.
    await p.locator('[data-experiment="return-route"]').click();await p.locator('[data-experiment="peach-delivery"]').click();
    await p.locator('#experiment-map[data-assets=ready][data-view=scene]').waitFor();
    await p.screenshot({path:'artifacts/peach-catalog-'+(offline?'offline':'local')+'.png',fullPage:true});
    await p.locator('#experiment-play').click();await p.locator('#scene[data-assets=ready]').waitFor();
    const imported=await workspace(p);assert.equal(imported.documents.length,before.documents.length+1);
    assert.equal(active(imported).id,'experiment-peach-delivery');assert.equal(await p.locator('#display-mode').inputValue(),'scene');
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'ready');
    await p.locator('#animation-toggle').check();
    // Solve with actual UI inputs; no replay data is used here.
    await p.locator('#preview-toggle').click();await p.clock.runFor(500);
    await p.locator('#scene-interactions [data-source="borrowed-fan"]').click();await p.clock.runFor(7000);
    await p.locator('#scene-interactions [data-source="peach-satchel"]').click();await p.clock.runFor(700);
    await p.locator('#preview-toggle').click();
    const tick=await p.locator('#runtime-tick').textContent();
    await p.locator('#display-mode').selectOption('logic');await p.clock.runFor(200);
    assert.equal(await p.locator('#runtime-tick').textContent(),tick,'switching views cannot advance a paused spell');
    await p.locator('#display-mode').selectOption('scene');await p.locator('#preview-toggle').click();
    await p.clock.runFor(13000);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
    assert.match(await p.locator('#runtime-actor').textContent(),/持有 无/);
    assert.match(await p.locator('#runtime-entities').textContent(),/打盹的仙长active/);
    await p.screenshot({path:'artifacts/peach-delivered-'+(offline?'offline':'local')+'.png',fullPage:true});
    await p.locator('#editor-return').click();assert.deepEqual(active(await workspace(p)),active(imported));
    await p.locator('#display-mode').selectOption('binding');
    assert.equal(await p.locator('#binding-overlay').isVisible(),true,'logic and artwork remain editable together');
    await p.locator('#open-data').click();const exported=JSON.parse(await p.locator('#level-json').inputValue());
    assert.deepEqual(exported,active(imported),'JSON contains the scene, behavior and feedback configuration');
    await p.locator('#close-data').click();
    await p.locator('#open-experiments').click();await p.locator('#experiment-help summary').click();await p.locator('#experiment-demo').click();
    assert.equal(await p.locator('#scene-tag-text').textContent(),'解法演示');
    assert.equal(await p.locator('#runtime-inputs button:not(:disabled)').count(),0);
    await p.clock.runFor(23000);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
    await p.locator('#editor-return').click();
    for(const old of before.documents)assert.deepEqual((await workspace(p)).documents.find(d=>d.key===old.key),old);
  }finally{await context.close();}
}
try{
  await scenario('http://127.0.0.1:'+server.address().port+'/',false);
  const built=await buildEditor();await scenario(pathToFileURL(built.path).href,true);
  assert.deepEqual(errors,[]);
  console.log('PASS peach vignette: themed catalog, scene inputs, paused view parity, real delivery, editable binding/JSON, proof replay, preserved drafts and offline without network.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
