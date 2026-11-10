import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {readSourceLevel} from './check-source-helpers.mjs';

await mkdir('artifacts',{recursive:true});await buildEditor();
const server=makeServer(),publicServer=makeServer({portableOnly:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise(r=>publicServer.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[];
const tick=page=>page.locator('#play-canvas').evaluate(c=>Number(c.dataset.tick));
async function until(page,target){
  for(let i=0;i<8;i++){
    const now=await tick(page),status=await page.locator('#play-canvas').getAttribute('data-status');
    if(now>=target||['won','lost'].includes(status))return;
    await page.clock.runFor(Math.ceil((target-now)*1000/60)+20);
  }
  assert.fail('office did not reach '+target);
}
async function drag(page,dx,dy=0){
  const b=await page.locator('#play-targets [data-source=parcel]').boundingBox(),v=await page.locator('#play-stage').boundingBox();
  const x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+dx*v.width/1200,y+dy*v.height/640,{steps:12});await page.mouse.up();await page.clock.runFor(80);
}
try{
  if(!process.env.OFFICE_CHECK_URL){
    const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/?sample=office-arrival');
    await page.locator('#scene[data-assets=ready]').waitFor();
    assert.equal(await page.locator('#editor-example').inputValue(),'office-arrival');
    assert.match(await page.locator('#formal-play').getAttribute('href'),/sample=office-arrival/);
    const before=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
    assert.equal(before.id,'office-arrival');assert.deepEqual(await readSourceLevel(page),before,'TS project roundtrip preserves all ordinary actions, resources and bindings');
    await page.locator('#scene').screenshot({path:'artifacts/office-editor.png'});
    await page.locator('#display-mode').selectOption('logic');await page.locator('#scene').screenshot({path:'artifacts/office-logic.png'});
    await page.reload();await page.locator('#scene[data-assets=ready]').waitFor();assert.equal(await page.locator('#editor-example').inputValue(),'office-arrival');
    await context.close();
  }
  const entries=process.env.OFFICE_CHECK_URL?[['published',process.env.OFFICE_CHECK_URL]]:[
    ['source',base+'/?play&sample=office-arrival'],
    ['offline',pathToFileURL(process.cwd()+'/dist/gothere-office.html').href+'?sample=chapter'],
    ['public','http://127.0.0.1:'+publicServer.address().port+'/office.html'],
  ];
  for(const [name,url]of entries){
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage(),requests=[];
    page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(name==='published'?120000:10000);
    page.on('pageerror',e=>errors.push(name+': '+e.message));page.on('request',r=>{if(name==='offline'&&/^https?:/.test(r.url()))requests.push(r.url());});
    const time=new Date('2026-11-10T00:00:00Z');await page.clock.install({time});await page.clock.pauseAt(new Date(+time+1000));
    await page.goto(url);await page.locator('#play-canvas[data-assets=ready]').waitFor();
    assert.match(await page.locator('#play-level-name').innerText(),/人到就行/);
    assert.equal(await page.locator('#level-hint,#editor-panel,.cm-editor').count(),0);
    assert.equal(await page.locator('#play-targets [data-source=bus]').count(),0,'the independent file cannot switch to the chapter through URL parameters');
    await page.locator('#play-canvas').screenshot({path:'artifacts/office-'+name+'-ready.png'});
    if(name==='offline'){
      const pending=page.waitForEvent('download');await page.locator('#play-download').click();const download=await pending;
      assert.equal(download.suggestedFilename(),'gothere-office.html');await download.saveAs('artifacts/office-downloaded.html');
      const copy=await context.newPage();await copy.goto(pathToFileURL(process.cwd()+'/artifacts/office-downloaded.html').href);
      await copy.locator('#play-canvas[data-assets=ready]').waitFor();assert.match(await copy.locator('#play-level-name').innerText(),/人到就行/);
      await copy.close();await page.bringToFront();
    }
    await page.locator('#play-sound').click();await page.locator('#play-start').click();await until(page,600);
    assert.equal(await page.locator('#play-canvas').getAttribute('data-status'),'lost');await page.clock.runFor(1200);
    await page.locator('#play-canvas').screenshot({path:'artifacts/office-'+name+'-door-failure.png'});
    await page.locator('#play-start').click();await until(page,60);
    await drag(page,173);await until(page,650);
    await page.locator('#play-canvas').screenshot({path:'artifacts/office-'+name+'-door-open.png'});
    await drag(page,233,-210);await page.locator('#play-targets [data-source=dispenser]').click();await until(page,1800);
    assert.equal(await page.locator('#play-canvas').getAttribute('data-status'),'running');
    await page.locator('#play-canvas').screenshot({path:'artifacts/office-'+name+'-cardboard.png'});
    await until(page,2180);await page.locator('#play-canvas').screenshot({path:'artifacts/office-'+name+'-plant.png'});
    await until(page,2700);assert.equal(await page.locator('#play-canvas').getAttribute('data-status'),'won');await page.clock.runFor(1000);
    await page.screenshot({path:'artifacts/office-'+name+'-won.png'});assert.equal(await page.locator('#play-message').innerText(),'到了。');
    assert.deepEqual(requests,[]);await context.close();console.log('PASS office '+name+': two uses of the same box, tap closure, physical door failure, actual mouse completion, offline isolation.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>publicServer.close(r));}
