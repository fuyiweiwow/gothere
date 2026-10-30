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
const context=await browser.newContext({viewport:{width:1600,height:1150}}),errors=[];
const workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.v1')));
async function scenario(url,offline){
  const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  if(offline)await p.route(/^https?:/,route=>{errors.push('unexpected network: '+route.request().url());return route.abort();});
  await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();
  const before=await workspace(p);await p.locator('#open-generation').click();await p.locator('#generation-seed').fill('');
  await p.locator('#generate-candidates').click();assert.equal(await p.locator('[data-candidate]').count(),0);
  assert.ok((await p.locator('#generation-status').textContent()).includes('种子'));
  await p.locator('#generation-seed').fill('browser-test');await p.locator('#generate-candidates').click();
  await p.locator('#cancel-generation').click();await p.waitForFunction(()=>document.getElementById('generation-dialog').dataset.busy==='false');
  assert.deepEqual(await workspace(p),before,'cancellation must preserve existing drafts');
  await p.locator('#generate-candidates').click();await p.waitForFunction(()=>document.querySelectorAll('[data-candidate]').length===3,null,{timeout:60000});
  assert.deepEqual(await workspace(p),before,'candidate browsing is read-only');
  const signatures=await p.locator('[data-candidate]').evaluateAll(cards=>cards.map(c=>c.dataset.signature));assert.equal(new Set(signatures).size,3);
  const first=p.locator('[data-candidate]').first();assert.ok((await first.textContent()).includes('漏掉'));
  const seed=await first.getAttribute('data-seed');await first.locator('[data-import-candidate]').click();
  const imported=await workspace(p);assert.equal(imported.documents.length,before.documents.length+1);
  for(const old of before.documents)assert.deepEqual(imported.documents.find(d=>d.key===old.key),old);
  const active=imported.documents.find(d=>d.key===imported.activeKey);assert.ok(active.level.id.startsWith('generated-'));
  assert.equal(await p.locator('#display-mode').inputValue(),'logic');assert.equal(await p.locator('#editor-test').isEnabled(),true);
  await p.locator('#open-generation').click();await p.locator('#generation-seed').fill('browser-test');await p.locator('#generate-candidates').click();
  await p.waitForFunction(()=>document.getElementById('generation-dialog').dataset.busy==='false',null,{timeout:60000});
  assert.equal(await p.locator('[data-candidate]').first().getAttribute('data-seed'),seed,'same seed recreates the candidates');
  await p.locator('[data-demo-candidate]').first().click();assert.equal(await p.locator('#scene-tag-text').textContent(),'解法演示');
  assert.equal(await p.locator('#runtime-inputs button:not(:disabled)').count(),0,'manual input disabled during proof playback');
  await p.locator('#preview-toggle').click();assert.match(await p.locator('#runtime-status').textContent(),/暂停/);
  await p.locator('#preview-step').click();await p.locator('#preview-toggle').click();
  await p.waitForFunction(()=>document.getElementById('runtime-status').dataset.status==='won',null,{timeout:40000});
  await p.locator('#editor-return').click();const after=await workspace(p);
  assert.deepEqual(after.documents.find(d=>d.key===before.activeKey),before.documents.find(d=>d.key===before.activeKey));
  await p.screenshot({path:'artifacts/generation-'+(offline?'offline':'local')+'.png',fullPage:true});await p.close();
}
try{
  await scenario('http://127.0.0.1:'+server.address().port+'/',false);
  const built=await buildEditor();await scenario(pathToFileURL(built.path).href,true);
  assert.deepEqual(errors,[]);console.log('PASS generation: validation, cancellation, deterministic distinct candidates, preserved drafts, editable import, paused/chunked replay and offline without network.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
