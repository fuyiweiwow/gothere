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
const errors=[];
const workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.v1')));
const active=s=>s.documents.find(d=>d.key===s.activeKey).level;
async function advance(p,ms){await p.clock.runFor(ms);}
async function scenario(url,offline){
  const context=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),p=await context.newPage();
  try{
    p.on('pageerror',e=>errors.push(e.message));
    if(offline)await p.route(/^https?:/,route=>{errors.push('unexpected network: '+route.request().url());return route.abort();});
    await p.clock.install({time:new Date('2026-11-02T00:00:00Z')});await p.clock.pauseAt(new Date('2026-11-02T00:00:01Z'));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();
    const before=await workspace(p);
    assert.equal(await p.locator('#open-experiments').count(),1,'editor needs a discoverable experiment entry');
    await p.locator('#open-experiments').click();
    assert.equal(await p.locator('[data-experiment]').count(),5);
    await p.locator('[data-experiment="return-route"]').click();
    assert.equal(await p.locator('#experiment-title').textContent(),'回来的路');
    assert.equal(await p.locator('#experiment-help').getAttribute('open'),null,'solutions start collapsed');
    assert.equal(await p.locator('#experiment-demo').isVisible(),false);
    assert.deepEqual(await workspace(p),before,'browsing is read-only');
    await p.screenshot({path:'artifacts/experiments-catalog-'+(offline?'offline':'local')+'.png',fullPage:true});
    await p.keyboard.press('Escape');assert.equal(await p.locator('#experiments-dialog').isVisible(),false);
    await p.locator('#open-experiments').click();await p.locator('#experiment-play').click();
    const imported=await workspace(p);assert.equal(imported.documents.length,before.documents.length+1);
    for(const old of before.documents)assert.deepEqual(imported.documents.find(d=>d.key===old.key),old);
    assert.equal(active(imported).id,'experiment-return-route');
    assert.equal(await p.locator('#display-mode').inputValue(),'logic');
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'ready');
    assert.equal(await p.locator('#open-experiments').isDisabled(),true);
    // A real manual solve uses the normal scene and runtime input controls, no replay data.
    await p.locator('#preview-toggle').click();await advance(p,500);
    await p.locator('#scene-interactions [data-source="return-beam"]').click();
    await advance(p,7800);await p.locator('#runtime-inputs [data-source="return-beam"]').click();
    await advance(p,14000);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
    await p.locator('#preview-reset').click();await p.locator('#preview-toggle').click();await advance(p,17000);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'lost','no-input attempt must really fail');
    await p.locator('#editor-return').click();
    assert.deepEqual(active(await workspace(p)),active(imported),'simulation must not mutate the editable draft');
    // Both grayboxes have independently selectable, editable copies.
    for(const id of ['pose-support','lift-handoff']){
      await p.locator('#open-experiments').click();await p.locator('[data-experiment="'+id+'"]').click();
      assert.equal(await p.locator('#experiment-help').getAttribute('open'),null);
      await p.locator('#experiment-edit').click();
      assert.equal(active(await workspace(p)).id,'experiment-'+id);
      assert.equal(await p.locator('#editor-test').isEnabled(),true);
    }
    await p.locator('#open-experiments').click();await p.locator('[data-experiment="return-route"]').click();
    await p.locator('#experiment-help summary').click();await p.locator('#experiment-demo').click();
    assert.equal(await p.locator('#scene-tag-text').textContent(),'解法演示');
    assert.equal(await p.locator('#runtime-inputs button:not(:disabled)').count(),0);
    await p.locator('#preview-toggle').click();await p.locator('#preview-step').click();
    await p.locator('#preview-toggle').click();await advance(p,23000);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
    await p.screenshot({path:'artifacts/experiments-return-'+(offline?'offline':'local')+'.png',fullPage:true});
    await p.locator('#editor-return').click();
    assert.deepEqual((await workspace(p)).documents.find(d=>d.key===before.activeKey),before.documents.find(d=>d.key===before.activeKey));
    // A full workspace cannot be silently replaced by a sample.
    const full=await workspace(p);
    while(full.documents.length<32)full.documents.push({key:'capacity-'+full.documents.length,level:active(full)});
    await p.evaluate(s=>localStorage.setItem('gothere.studio.v1',JSON.stringify(s)),full);await p.reload();
    await p.locator('#scene[data-assets=ready]').waitFor();
    await p.locator('#open-experiments').click();await p.locator('#experiment-edit').click();
    assert.equal(await p.locator('#experiments-dialog').isVisible(),true);
    assert.match(await p.locator('#experiment-status').textContent(),/草稿/);
    assert.deepEqual(await workspace(p),full);
  }finally{await context.close();}
}
try{
  await scenario('http://127.0.0.1:'+server.address().port+'/',false);
  const built=await buildEditor();await scenario(pathToFileURL(built.path).href,true);
  assert.deepEqual(errors,[]);
  console.log('PASS experiments: local/offline catalog, hidden solutions, preserved drafts, manual win/failure, editable grayboxes, paused replay and capacity errors.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
