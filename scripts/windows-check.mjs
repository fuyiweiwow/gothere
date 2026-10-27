import { openPanel } from './editor-controls.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const visiblePerformance=process.argv.includes('--visible-performance');
const build=JSON.parse(await readFile(join(root,'dist/windows/latest.json'),'utf8'));
const runRoot=join(root,'artifacts/windows-'+randomUUID());await mkdir(runRoot,{recursive:true});
const quote=value=>"'"+value.replaceAll("'","''")+"'";
await new Promise((done,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',
    'Expand-Archive -LiteralPath '+quote(build.zip)+' -DestinationPath '+quote(join(runRoot,'unpacked'))],
    {windowsHide:true,stdio:'inherit'});
  child.once('error',reject);child.once('exit',code=>code===0?done():reject(new Error('Extract failed: '+code)));
});
const env={...process.env,PATH:process.env.SystemRoot+'\\System32'};delete env.ELECTRON_RUN_AS_NODE;
const executablePath=join(runRoot,'unpacked/Gothere/Gothere.exe');
assert.ok((await readFile(join(runRoot,'unpacked/Gothere/resources/app/main.cjs'),'utf8')).includes('gothere-test-hidden'),
  'Rebuild the Windows package before testing; older packages may open a visible window.');
const launch=()=>_electron.launch({executablePath,
  args:['--user-data-dir='+join(runRoot,'profile'),...(!visiblePerformance?['--gothere-test-hidden']:[])],env,timeout:30000});
const click=(page,selector,options={})=>page.locator(selector).click({force:!visiblePerformance,...options});
async function preparePage(application) {
  const page=await application.firstWindow();
  page.setDefaultTimeout(15000);
  if(!visiblePerformance) {
    // Hidden native windows can stop delivering animation frames. Install before
    // reloading so every game callback uses the controlled browser clock.
    await page.clock.install({time:new Date('2026-10-27T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-27T00:00:01Z'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.clock.runFor(100);
  }
  return page;
}
async function waitForWin(page) {
  if(!visiblePerformance)await page.clock.runFor(15000);
  else await page.waitForFunction(()=>document.getElementById('status-text').textContent==='终于到了',{},{timeout:20000});
  assert.equal(await page.locator('#status-text').textContent(),'终于到了');
}
let desktop;
const errors=[];
try {
  const started=performance.now();desktop=await launch();
  const page=await preparePage(desktop);page.on('pageerror',error=>errors.push(error.message));
  await page.locator('#play').waitFor();const launchMs=Math.round(performance.now()-started);
  await page.context().setOffline(true);
  assert.equal(await page.title(),'一定要到达那里');
  assert.equal(await page.locator('.level-tab').count(),10);
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(()=>typeof window.process),'undefined');
  const runtime=await desktop.evaluate(({app,BrowserWindow})=>{
    const window=BrowserWindow.getAllWindows()[0],preferences=window.webContents.getLastWebPreferences();
    return {appPath:app.getAppPath(),userData:app.getPath('userData'),version:app.getVersion(),
      nodeIntegration:preferences.nodeIntegration,contextIsolation:preferences.contextIsolation,sandbox:preferences.sandbox,
      visible:window.isVisible()};
  });
  assert.equal(runtime.nodeIntegration,false);assert.equal(runtime.contextIsolation,true);assert.equal(runtime.sandbox,true);
  assert.ok(runtime.userData.includes(runRoot),'test never touches the player profile');
  assert.ok(runtime.appPath.startsWith(runRoot),'launches the extracted archive');
  assert.equal(runtime.visible,visiblePerformance,'smoke tests stay hidden unless visible performance is requested');
  await click(page,'#play');await click(page,'[data-action="lever"]');
  // Measure visible gameplay after startup, with real animation frames rather than a fake clock.
  const frameSample=()=>page.evaluate(()=>new Promise(resolve=>{
    let start,frames=0;
    const count=now=>{
      if(start===undefined)start=now;else frames++;
      if(now-start>=2000)resolve({fps:Math.round(frames/(now-start)*1000),visibility:document.visibilityState});
      else requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
  }));
  const frameSamples=[];
  if(visiblePerformance){
    await frameSample(); // Warm up rendering and GPU resources before collecting samples.
    for(let i=0;i<3;i++)frameSamples.push(await frameSample());
  }
  assert.ok(frameSamples.every(sample=>sample.visibility==='visible'),'benchmark window remains visible');
  const fps=frameSamples.length?[...frameSamples.map(sample=>sample.fps)].sort((a,b)=>a-b)[1]:null;
  const memory=await desktop.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,pid:p.pid,...p.memory})));
  // Electron reports KiB. Working sets include shared pages and can count them more than once.
  const workingSetMiB=Math.round(memory.reduce((sum,p)=>sum+p.workingSetSize,0)/1024);
  const privateMiB=Math.round(memory.reduce((sum,p)=>sum+p.privateBytes,0)/1024);
  const gpuFeatures=await desktop.evaluate(({app})=>app.getGPUFeatureStatus());
  await click(page,'#speed');await click(page,'#speed');
  if(visiblePerformance)await page.waitForFunction(()=>document.getElementById('status-text').textContent==='终于到了');
  await waitForWin(page);
  await page.context().setOffline(false);
  assert.equal(await page.evaluate(()=>window.open('https://example.com'))===null,true,'new windows are denied');
  assert.equal(await page.evaluate(()=>fetch('https://example.com').then(()=>false,()=>true)),true,'network access is denied');
  await page.context().setOffline(true);
  await click(page,'#open-editor');
  await openPanel(page,'map',{force:!visiblePerformance});await page.locator('#edit-name').fill('离线桌面草稿');await page.locator('#edit-name').press('Tab');
  await click(page,'#editor-save');
  await page.screenshot({path:join(root,'artifacts/windows-editor.png'),fullPage:true});
  await desktop.close();desktop=await launch();
  const reopened=await preparePage(desktop);reopened.on('pageerror',error=>errors.push(error.message));
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),visiblePerformance);
  await reopened.context().setOffline(true);await click(reopened,'#open-editor');
  assert.equal(await reopened.locator('#edit-name').inputValue(),'离线桌面草稿');
  await click(reopened,'#editor-test');await click(reopened,'#play');
  await click(reopened,'[data-action="lever"]');
  if(visiblePerformance)await reopened.waitForFunction(()=>document.getElementById('status-text').textContent==='终于到了',{},{timeout:20000});
  await waitForWin(reopened);
  // New content also runs in the packaged sandbox, with no visible native window.
  await click(reopened,'#editor-exit');
  await click(reopened,'[data-example="example-floors"]');await click(reopened,'#play');
  await click(reopened,'[data-action="call"]');await waitForWin(reopened);
  await click(reopened,'#replay');if(!visiblePerformance)await reopened.clock.runFor(15000);
  if(visiblePerformance)await reopened.waitForFunction(()=>document.getElementById('status-text').textContent==='终于到了');
  assert.equal(await reopened.locator('#status-text').textContent(),'终于到了');
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),visiblePerformance);
  // A cancelled native navigation can leave Playwright waiting for a document
  // commit. Run this last, with no further locator actions on the page.
  await reopened.context().setOffline(false);
  const lockedURL=reopened.url();
  await desktop.evaluate(({BrowserWindow})=>{
    globalThis.__navigationCheck=new Promise(resolve=>{
      const timeout=setTimeout(()=>resolve(false),5000);
      BrowserWindow.getAllWindows()[0].webContents.once('will-navigate',event=>{
        clearTimeout(timeout);resolve(event.defaultPrevented);
      });
    });
  });
  await reopened.evaluate(()=>{const link=document.createElement('a');link.href='https://example.com';link.textContent='Navigation test';link.id='navigation-test';document.body.append(link);});
  await click(reopened,'#navigation-test',{noWaitAfter:true});
  assert.equal(await desktop.evaluate(()=>globalThis.__navigationCheck),true,'external navigation is cancelled');
  assert.equal(reopened.url(),lockedURL,'external navigation is denied');
  assert.deepEqual(errors,[]);
  const report={...build,mode:visiblePerformance?'visible-performance':'hidden-smoke-test',launchMs,fps,frameSamples,workingSetMiB,privateMiB,memory,gpuFeatures,runtime,checks:[
    'extracted ZIP launches with system-only PATH','offline gameplay wins','sandbox and context isolation',
    'new windows, external navigation and network access blocked',
    'draft saved and restored across application restart','restored draft playable offline',
    'three-floor carry, ladder, lift call and replay in packaged sandbox'],
    measurement:visiblePerformance?'Three 2-second visible gameplay samples after 2-second warmup; median rAF rate. Summed working sets include shared pages; private bytes reported separately. Single-machine observation, not a performance guarantee.':'Hidden functional smoke test with a controlled browser clock and forced clicks; pointer interaction is covered by separate headless browser tests. Visible framerate not measured; working sets include shared pages, private bytes reported separately.',
    limitations:['same Windows machine; not a clean machine','unsigned development build','external playtest pending']};
  await writeFile(join(root,'artifacts/windows-report.json'),JSON.stringify(report,null,2));
  console.log('PASS Windows standalone: '+JSON.stringify({launchMs,fps,workingSetMiB,privateMiB,zipMiB:Math.round(build.zipBytes/1048576)}));
} finally {if(desktop)await desktop.close();}
