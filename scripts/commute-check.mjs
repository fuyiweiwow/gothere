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
const errors=[],workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.v1'))),active=s=>s.documents.find(d=>d.key===s.activeKey).level;
async function scenario(url,offline){
  const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),p=await context.newPage();
  try{
    p.on('pageerror',e=>errors.push(e.message));
    if(offline)await p.route(/^https?:/,r=>{errors.push('unexpected network '+r.request().url());return r.abort();});
    await p.clock.install({time:new Date('2026-11-03T00:00:00Z')});await p.clock.pauseAt(new Date('2026-11-03T00:00:01Z'));
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#animation-toggle').check();
    await p.locator('#zoom-in').click();await p.locator('#zoom-in').click();const before=await workspace(p);
    await p.locator('#open-experiments').click();assert.equal(await p.locator('[data-experiment]').count(),5);
    assert.equal(await p.locator('[data-experiment=commute]').getAttribute('aria-pressed'),'true');
    await p.locator('#experiment-map[data-assets=ready]').waitFor();await p.screenshot({path:'artifacts/commute-catalog-'+(offline?'offline':'local')+'.png'});
    assert.deepEqual(await workspace(p),before);await p.locator('#experiment-play').click();await p.locator('#scene[data-assets=ready]').waitFor();
    const imported=active(await workspace(p));assert.equal(imported.id,'experiment-commute');
    assert.equal(await p.locator('#viewport').getAttribute('data-zoom'),'1','scene play must fit even after zoomed editing');
    assert.equal(await p.locator('body').getAttribute('data-play-view'),'clean');assert.equal(await p.locator('#simulation-panel').isVisible(),false);
    assert.equal(await p.locator('#stage-note').isVisible(),false);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'ready');
    await p.locator('#viewport').screenshot({path:'artifacts/commute-ready-'+(offline?'offline':'local')+'.png'});
    await p.locator('#preview-toggle').click();await p.clock.runFor(650);
    await p.locator('#scene-interactions [data-source=loading-ramp]').click();await p.clock.runFor(7650);
    assert.equal(await p.locator('#scene-interactions [data-source=traffic-light]').getAttribute('title'),null,'scene hotspots do not reveal narrative tooltips');
    await p.locator('#scene-interactions [data-source=traffic-light]').click();await p.clock.runFor(2400);
    await p.locator('#preview-toggle').click();const paused=await p.locator('#runtime-tick').textContent();
    await p.locator('#preview-view').click();assert.equal(await p.locator('#simulation-panel').isVisible(),true);
    await p.locator('#display-mode').selectOption('logic');await p.clock.runFor(200);assert.equal(await p.locator('#runtime-tick').textContent(),paused);
    await p.locator('#preview-view').click();assert.equal(await p.locator('#display-mode').inputValue(),'scene');
    await p.locator('#viewport').screenshot({path:'artifacts/commute-bus-'+(offline?'offline':'local')+'.png'});
    await p.locator('#preview-toggle').click();await p.clock.runFor(5900);
    await p.locator('#scene-interactions [data-source=trench-cover]').click();await p.clock.runFor(3300);
    await p.locator('#scene-interactions [data-source=service-lift]').click();await p.clock.runFor(22400);
    assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
    await p.locator('#viewport').screenshot({path:'artifacts/commute-arrived-'+(offline?'offline':'local')+'.png'});
    await p.locator('#preview-edit').click();assert.deepEqual(active(await workspace(p)),imported);
    assert.equal(await p.locator('body').getAttribute('data-play-view'),'editor');
    await p.locator('#display-mode').selectOption('logic');
    await p.locator('[data-ref="entity:bus"]').first().click({force:true});
    await p.locator('[data-move-x]').first().waitFor();
    const old=await p.locator('[data-move-x]').first().inputValue();await p.locator('[data-move-x]').first().fill(String(Number(old)-10));await p.locator('[data-move-x]').first().press('Tab');
    assert.equal(active(await workspace(p)).entities.find(e=>e.id==='bus').behaviors[0].actions[0].x,Number(old)-10);
    await p.locator('#editor-undo').click();assert.deepEqual(active(await workspace(p)),imported);
    await p.locator('#open-data').click();assert.deepEqual(JSON.parse(await p.locator('#level-json').inputValue()),imported);await p.locator('#close-data').click();
    for(const old of before.documents)assert.deepEqual((await workspace(p)).documents.find(d=>d.key===old.key),old);
  }finally{await context.close();}
}
try{
  await scenario('http://127.0.0.1:'+server.address().port+'/',false);const built=await buildEditor();await scenario(pathToFileURL(built.path).href,true);
  assert.deepEqual(errors,[]);console.log('PASS commute: wordless scene clicks, real route, clean/debug switch while paused, editable move action, undo/JSON, preserved drafts and disconnected offline play.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
