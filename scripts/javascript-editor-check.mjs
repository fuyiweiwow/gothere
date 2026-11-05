import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';

const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1'))),current=s=>s.documents.find(d=>d.key===s.activeKey).level;
try{
  const urls=['http://127.0.0.1:'+server.address().port+'/',pathToFileURL((await buildEditor()).path).href];
  for(const [index,url] of urls.entries()){
    const context=await browser.newContext({viewport:{width:1650,height:1150},acceptDownloads:true}),p=await context.newPage(),errors=[],requests=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    try{
      await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const original=await workspace(p);
      await p.locator('#open-script').click();assert.equal(await p.locator('#open-data').count(),0);assert.equal(await p.locator('.cm-editor').count(),1);
      assert.ok((await p.locator('#script-source').inputValue()).includes('api.addObject('));
      assert.ok(await p.locator('.cm-content span[class]').count()>0,'syntax highlighting is rendered');
      await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.equal(await p.locator('#script-status').getAttribute('data-error'),'false');
      await p.locator('#script-apply').click();assert.deepEqual(current(await workspace(p)),current(original));
      await p.locator('#open-script').click();const downloadPromise=p.waitForEvent('download');await p.locator('#script-export').click();const download=await downloadPromise;
      const exported=await readFile(await download.path(),'utf8');assert.match(exported,/function createLevel/);
      await p.locator('#script-file').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(current(original)))});
      assert.match(await p.locator('#script-source').inputValue(),/api.addObject\(/);
      await p.locator('#script-file').setInputFiles({name:'level.js',mimeType:'text/javascript',buffer:Buffer.from(exported)});
      await p.locator('#script-restore').click();assert.match(await p.locator('#script-source').inputValue(),/api.addObject\(/);
      await p.locator('#script-restore').click();assert.equal(await p.locator('#script-source').inputValue(),exported);
      await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.equal(await p.locator('#script-status').getAttribute('data-error'),'false');
      await p.locator('#script-import').click();assert.deepEqual(current(await workspace(p)),current(original));assert.equal((await workspace(p)).documents.length,original.documents.length+1);
      await p.locator('#open-script').click();const content=p.locator('.cm-content');await content.click();await p.keyboard.press('Control+End');await p.keyboard.press('Enter');await p.keyboard.type('api.');
      await p.waitForSelector('.cm-tooltip-autocomplete');assert.match(await p.locator('.cm-tooltip-autocomplete').innerText(),/addObject/);
      await p.screenshot({path:`artifacts/js-editor-${index}.png`});
      await p.keyboard.press('Escape');await p.keyboard.press('Control+a');await p.keyboard.insertText("const cart = api.entity('bus');\ncart.");await p.waitForSelector('.cm-tooltip-autocomplete');assert.match(await p.locator('.cm-tooltip-autocomplete').innerText(),/behavior/);
      await p.keyboard.press('Escape');await p.keyboard.press('Control+a');await p.keyboard.insertText('while(true) {}');
      await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.equal(await p.locator('#script-status').getAttribute('data-error'),'true');
      assert.deepEqual(current(await workspace(p)),current(original));await p.locator('#close-script').click();
      assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  console.log('PASS JavaScript editor online/offline: complete roundtrip, legacy import, completion, highlighting, timeout and unchanged drafts.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
