import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createSimulation} from '../src/core/engine.js';

await mkdir('artifacts',{recursive:true});await buildEditor();
const server=makeServer(),publicServer=makeServer({portableOnly:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise(r=>publicServer.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[],failure=createSimulation(createCommuteChapter()).start().step(1200).snapshot().tick;
const tick=p=>p.locator('#play-canvas').evaluate(c=>Number(c.dataset.tick));
async function until(p,target){for(let i=0;i<6;i++){const now=await tick(p),status=await p.locator('#play-canvas').getAttribute('data-status');if(now>=target||['won','lost'].includes(status))return;await p.clock.runFor(Math.ceil((target-now)*1000/60)+20);}assert.fail('play did not reach '+target);}
async function drag(p,id,dx,dy=0){
  const b=await p.locator('#play-targets [data-source='+id+']').boundingBox(),v=await p.locator('#play-stage').boundingBox();
  const x=b.x+b.width/2,y=b.y+b.height/2;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx*v.width/1200,y+dy*v.height/640,{steps:8});await p.mouse.up();await p.clock.runFor(300);
}
try{
  const entries=[
    ['source','http://127.0.0.1:'+server.address().port+'/?play'],
    ['offline',pathToFileURL(process.cwd()+'/dist/gothere-play.html').href],
    ['editor-offline',pathToFileURL(process.cwd()+'/dist/gothere-editor.html').href+'?play'],
    ['public','http://127.0.0.1:'+publicServer.address().port+'/play.html'],
  ];
  for(const [name,url] of entries){
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),p=await context.newPage(),requests=[];
    p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(name+': '+e.message));p.on('request',r=>{if(name.includes('offline')&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-09T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
    if(name==='source')await context.addInitScript(()=>{localStorage.setItem('gothere.studio.layered.v1','deliberately invalid draft');localStorage.setItem('gothere.studio.display','logic');});
    await p.goto(url);await p.locator('#play-canvas[data-assets=ready]').waitFor();
    assert.equal(await p.locator('#level-hint,#editor-panel,#runtime-tick,#script-dialog,.cm-editor').count(),0);
    assert.equal(await p.locator('#play-targets [title]').count(),0);assert.equal(await tick(p),0);
    await p.screenshot({path:'artifacts/play-'+name+'-start.png'});
    if(name==='offline'){
      const downloadEvent=p.waitForEvent('download');await p.locator('#play-download').click();const download=await downloadEvent;
      assert.equal(download.suggestedFilename(),'gothere-play.html');await download.saveAs('artifacts/play-downloaded.html');
      const copy=await context.newPage();await copy.goto(pathToFileURL(process.cwd()+'/artifacts/play-downloaded.html').href);await copy.locator('#play-canvas[data-assets=ready]').waitFor();await copy.close();await p.bringToFront();
    }
    await p.locator('#play-start').click();await until(p,60);await p.locator('#play-pause').click();const stopped=await tick(p);await p.clock.runFor(1000);assert.equal(await tick(p),stopped);
    await p.locator('#play-start').click();await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await p.locator('#play-canvas').getAttribute('data-status'),'paused');
    await p.clock.runFor(500);assert.equal(await tick(p),stopped);await p.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await p.locator('#play-sound').click();assert.equal(await p.locator('#play-sound').getAttribute('aria-pressed'),'false');
    await p.locator('#play-start').click();await until(p,failure);
    assert.equal(await p.locator('#play-canvas').getAttribute('data-status'),'lost');assert.equal(await p.locator('#play-cover').isHidden(),true,'failure must leave time for the falling body');
    const contact=await p.locator('#play-canvas').evaluate(c=>c.toDataURL());await p.clock.runFor(720);
    assert.notEqual(await p.locator('#play-canvas').evaluate(c=>c.toDataURL()),contact);await p.locator('#play-canvas').screenshot({path:'artifacts/play-'+name+'-landing.png'});
    await p.clock.runFor(1000);assert.equal(await p.locator('#play-cover').isVisible(),true);assert.equal(await p.locator('#play-message').innerText(),'再试一次。');
    assert.equal(await tick(p),failure);await p.locator('#play-start').click();assert.ok(await tick(p)<5);
    await until(p,60);await p.locator('#play-targets [data-source=bus]').click();
    await until(p,830);await p.locator('#play-targets [data-source=officer]').click();
    await until(p,1380);await p.locator('#play-targets [data-source=caller]').click();
    await until(p,1700);await p.locator('#play-canvas').screenshot({path:'artifacts/play-'+name+'-tow.png'});
    await until(p,2040);await drag(p,'barrier',-30,70);await drag(p,'barrier',-108);
    await until(p,2740);await drag(p,'breakfast',295);
    await until(p,3600);assert.equal(await p.locator('#play-canvas').getAttribute('data-status'),'won');await p.clock.runFor(1200);
    assert.equal(await p.locator('#play-message').innerText(),'到了。');await p.screenshot({path:'artifacts/play-'+name+'-won.png'});
    await p.locator('#play-restart').click();assert.ok(await tick(p)<5);await p.keyboard.press('Escape');assert.equal(await p.locator('#play-canvas').getAttribute('data-status'),'paused');
    if(name==='source')assert.equal(await p.evaluate(()=>localStorage.getItem('gothere.studio.layered.v1')),'deliberately invalid draft');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS formal play '+name+': no hint/editor, pause/blur/mute/retry, complete landing, invalid drop recovery, real mouse solution and draft isolation.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>publicServer.close(r));}
