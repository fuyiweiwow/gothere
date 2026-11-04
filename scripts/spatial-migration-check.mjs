import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {createSpatialLevel} from '../src/editor/spatial-level.js';
import {createFirstLevel} from '../src/editor/first-level.js';

const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
try{
  for(const base of ['http://127.0.0.1:'+server.address().port+'/',pathToFileURL((await buildEditor()).path).href]){
    for(const spatial of [true,false]){
      const context=await browser.newContext(),page=await context.newPage(),errors=[];
      const level=spatial?createSpatialLevel():createFirstLevel();level.schemaVersion=1;level.name='My edited draft';
      const key=spatial?'gothere.studio.spatial.v1':'gothere.studio.v1';
      const workspace={version:1,activeKey:'my-draft',documents:[{key:'my-draft',level}]};
      await page.addInitScript(({key,workspace})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(workspace));},{key,workspace});
      page.on('pageerror',e=>errors.push(e.message));const url=new URL(base);if(!spatial)url.searchParams.set('legacy','1');
      await page.goto(url.href);await page.locator('#scene[data-assets=ready]').waitFor();
      const expected={...level,schemaVersion:spatial?2:1};
      const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
      assert.equal(saved.activeKey,'my-draft');assert.deepEqual(saved.documents[0].level,expected,'migrated draft must be persisted on opening');
      await page.locator('#open-data').click();assert.deepEqual(JSON.parse(await page.locator('#level-json').inputValue()),expected);
      assert.deepEqual(errors,[]);await context.close();
    }
  }
  console.log('PASS migration: spatial v1 persists as v2, horizontal v1 is unchanged; active draft and edited content survive online/offline startup.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
