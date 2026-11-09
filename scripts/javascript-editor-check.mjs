import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {unzipProject,zipProject} from './project-code-tools.mjs';
import {levelToJavaScript} from '../src/editor/javascript-source.js';
import {createProjectExample} from '../src/editor/javascript-project.js';
import {zipSync,strToU8} from 'fflate';

await mkdir('artifacts',{recursive:true});
const server=makeServer(),preview=makeServer({portableOnly:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise(r=>preview.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1'))),current=s=>s.documents.find(d=>d.key===s.activeKey).level;
async function select(p,path){await p.locator('[data-script-path="'+path+'"]').click();}
async function edit(p,text){await p.locator('.cm-content').click();await p.keyboard.press('Control+a');await p.keyboard.insertText(text);}
async function cursorAt(p,text,token){
  assert.ok(text.includes(token),token);await p.locator('.cm-content').click();await p.keyboard.press('Control+Home');
  const point=await p.locator('.cm-line').filter({hasText:token}).first().evaluate((line,token)=>{
    let offset=line.textContent.indexOf(token)+2;const walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      if(offset>node.length){offset-=node.length;continue;}
      const range=document.createRange();range.setStart(node,offset);range.setEnd(node,Math.min(offset+1,node.length));const rect=range.getBoundingClientRect();return {x:rect.x+1,y:rect.y+rect.height/2};
    }
    throw new Error('token not rendered');
  },token);await p.mouse.click(point.x,point.y);return point;
}
async function generate(p,{error=false,match}={}){
  await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);
  const message=await p.locator('#script-status').innerText();assert.equal(await p.locator('#script-status').getAttribute('data-error'),String(error),message);
  if(match)assert.match(message,match);
}
async function upload(p,name,buffer){
  await p.locator('#script-file').setInputFiles({name,mimeType:name.endsWith('.zip')?'application/zip':'text/javascript',buffer:Buffer.from(buffer)});
  // Import reads the file asynchronously and clears this input after replacing the project.
  await p.waitForFunction(()=>document.getElementById('script-file').files.length===0);
}
try{
  const urls=['http://127.0.0.1:'+server.address().port+'/',pathToFileURL((await buildEditor()).path).href,'http://127.0.0.1:'+preview.address().port+'/'];
  for(const [index,url] of urls.entries()){
    const context=await browser.newContext({viewport:{width:1650,height:1150},acceptDownloads:true}),p=await context.newPage(),errors=[],requests=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index===1&&/^https?:/.test(r.url()))requests.push(r.url());});
    try{
      await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const original=await workspace(p);
      await p.locator('#open-script').click();assert.equal(await p.locator('#open-data').count(),0);assert.equal(await p.locator('.cm-editor').count(),1);
      assert.ok((await p.locator('#script-source').inputValue()).length<650);assert.ok(await p.locator('#script-tree [data-script-path]').count()>8);
      assert.ok(await p.locator('.cm-content span[class]').count()>0,'syntax highlighting is rendered');
      const tree=await p.locator('.script-explorer').boundingBox(),code=await p.locator('#code-editor').boundingBox();assert.ok(tree.x+tree.width<=code.x+2,'tree is left of editor');
      await p.screenshot({path:`artifacts/js-project-${index}.png`});
      await p.setViewportSize({width:1280,height:800});const footer=await p.locator('#script-generate').boundingBox();assert.ok(footer.y+footer.height<=800,'generation controls remain visible on a small desktop');await p.setViewportSize({width:1650,height:1150});
      await select(p,'objects/bus.ts');assert.match(await p.locator('#script-source').inputValue(),/extends Entity/);
      await select(p,'map.ts');assert.match(await p.locator('#script-source').inputValue(),/level\.point/);assert.doesNotMatch(await p.locator('#script-source').inputValue(),/"projection"|"depth"/);
      await select(p,'routes.ts');assert.match(await p.locator('#script-source').inputValue(),/level\.route/);
      await select(p,'scene.ts');assert.ok((await p.locator('#script-source').inputValue()).length<1000);
      await select(p,'events.ts');const eventsSource=await p.locator('#script-source').inputValue();
      await cursorAt(p,eventsSource,'doOpen');await p.keyboard.press('F12');
      await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='objects/bus.ts').catch(async error=>{console.log('navigation failure',index,await p.evaluate(()=>({path:document.getElementById('script-current-path').textContent,status:document.getElementById('script-status').textContent,selection:window.getSelection()?.anchorNode?.textContent,offset:window.getSelection()?.anchorOffset})));throw error;});
      assert.match(await p.locator('#script-source').inputValue(),/behaviorSlot/);await p.keyboard.press('Alt+ArrowLeft');
      await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='events.ts');
      const behaviorPoint=await cursorAt(p,eventsSource,'doOpen');
      await p.keyboard.down('Control');await p.mouse.click(behaviorPoint.x,behaviorPoint.y);await p.keyboard.up('Control');
      await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='objects/bus.ts');
      await p.keyboard.press('Alt+ArrowLeft');await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='events.ts');
      await cursorAt(p,eventsSource,'Click');await p.locator('#script-definition').click();
      await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='@gothere/core');
      assert.equal(await p.locator('.cm-content').getAttribute('contenteditable'),'false');await p.locator('#script-back').click();
      await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='events.ts');
      await select(p,'scene/styles.ts');const stylesSource=await p.locator('#script-source').inputValue();
      await cursorAt(p,stylesSource,'toonBlockStreets');await p.keyboard.press('F12');
      await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='assets/images/builtin/toonBlockStreets.png');
      await p.locator('#script-back').click();await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='scene/styles.ts');
      await p.locator('#script-search').fill('objects/bus.ts');assert.equal(await p.locator('#script-tree [data-script-path]').count(),1);await p.locator('#script-search').fill('');
      await p.locator('#script-core').click();assert.equal(await p.locator('.cm-content').getAttribute('contenteditable'),'false');assert.equal(await p.locator('#script-delete').isDisabled(),true);
      await select(p,'level.ts');await generate(p);await p.locator('#script-apply').click();assert.deepEqual(current(await workspace(p)),current(original));
      await p.locator('#open-script').click();const pending=p.waitForEvent('download');await p.locator('#script-export').click();const exported=new Uint8Array(await readFile(await (await pending).path()));
      const project=unzipProject(exported);assert.match(project.files['level.ts'],/import/);assert.match(project.files['objects/bus.ts'],/extends Entity/);
      await upload(p,'legacy.json',JSON.stringify(current(original)));assert.match(await p.locator('#script-source').inputValue(),/createMap/);
      await upload(p,'gothere-project.zip',exported);await generate(p);await p.locator('#script-import').click();
      assert.deepEqual(current(await workspace(p)),current(original));assert.equal((await workspace(p)).documents.length,original.documents.length+1);

      await p.locator('#open-script').click();await p.locator('#script-example').click();
      const typedEntry=await p.locator('#script-source').inputValue();await generate(p);
      await edit(p,typedEntry.replace('speed: 70',"speed: 'fast'"));
      await p.locator('#script-problem-list button').filter({hasText:'TS2322'}).waitFor();
      assert.ok(await p.locator('.cm-lintRange-error').count()>0,'semantic error has a source underline');
      await generate(p,{error:true,match:/level.ts:.*TS2322/});assert.equal(await p.locator('#script-apply').isDisabled(),true);
      await p.locator('#script-problem-list button').first().click();assert.equal(await p.locator('#script-current-path').innerText(),'level.ts');
      await edit(p,typedEntry);await select(p,'objects/departing-object.ts');
      const typedObject=await p.locator('#script-source').inputValue();
      await edit(p,typedObject.replace('  constructor(',"  customClearance(): number { return 12; }\n  constructor("));
      await p.locator('#script-rename').click();await p.locator('#script-path').fill('shared/typed-obstacle.ts');await p.locator('#script-file-form button[type=submit]').click();
      await select(p,'level.ts');const renamedTyped=await p.locator('#script-source').inputValue();assert.match(renamedTyped,/shared\/typed-obstacle.ts/);await generate(p);
      await edit(p,renamedTyped+"\nconst inferred = new DepartingObject(new Level('Test'), 'x', new Level('Other').layer('road', {screenY:500}).at(100));\ninferred.");
      await p.keyboard.press('Control+Space');await p.waitForSelector('.cm-tooltip-autocomplete');assert.match(await p.locator('.cm-tooltip-autocomplete').innerText(),/customClearance/);await p.keyboard.press('Escape');
      const legacyExample=createProjectExample();await upload(p,'legacy-project.zip',zipProject(legacyExample.files,legacyExample.entry));
      const exampleEntry=await p.locator('#script-source').inputValue();
      await select(p,'objects/departing-object.js');const objectSource=await p.locator('#script-source').inputValue();
      await edit(p,objectSource+'\n// file-local undo history\n');await select(p,'level.js');assert.equal(await p.locator('#script-source').inputValue(),exampleEntry);
      await select(p,'objects/departing-object.js');assert.match(await p.locator('#script-source').inputValue(),/file-local/);await p.locator('.cm-content').click();await p.keyboard.press('Control+z');
      assert.equal(await p.locator('#script-source').inputValue(),objectSource,'undo survives file switches');
      await p.locator('#script-new').click();await p.locator('#script-path').fill('shared/constants.js');await p.locator('#script-file-form button[type=submit]').click();
      await edit(p,'export const destination = 1350;');
      await select(p,'objects/departing-object.js');await edit(p,"import { destination } from '../shared/constants.js';\n"+objectSource.replace('x: 1350','x: destination'));
      await select(p,'shared/constants.js');await p.locator('#script-rename').click();await p.locator('#script-path').fill('config/distance.js');await p.locator('#script-file-form button[type=submit]').click();
      await select(p,'objects/departing-object.js');assert.match(await p.locator('#script-source').inputValue(),/config\/distance.js/);
      await generate(p);await p.keyboard.press('Control+s');
      await p.locator('#close-script').click();await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#open-script').click();
      await select(p,'config/distance.js');assert.equal(await p.locator('#script-source').inputValue(),'export const destination = 1350;');
      await p.locator('#script-new').click();await p.locator('#script-path').fill('unused.js');await p.locator('#script-file-form button[type=submit]').click();
      await p.locator('#script-delete').click();assert.equal(await p.locator('[data-script-path="unused.js"]').count(),0);await p.locator('#script-restore').click();assert.equal(await p.locator('[data-script-path="unused.js"]').count(),1);
      await p.locator('#script-delete').click();

      await select(p,'level.js');await edit(p,"import { Level } from '");await p.keyboard.press('Control+Space');await p.waitForSelector('.cm-tooltip-autocomplete');assert.match(await p.locator('.cm-tooltip-autocomplete').innerText(),/@gothere\/core/);
      await p.keyboard.press('Escape');await edit(p,"import { Level } from '@gothere/core';\nconst level = new Level();\nlevel.");await p.keyboard.press('Control+Space');await p.waitForSelector('.cm-tooltip-autocomplete');assert.match(await p.locator('.cm-tooltip-autocomplete').innerText(),/object/);
      await p.keyboard.press('Escape');await select(p,'objects/departing-object.js');await edit(p,"import { Entity } from '@gothere/core';\nexport class Example extends Entity {\n  method() { this.\n  }\n}");
      await p.keyboard.press('Control+Home');await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowDown');await p.keyboard.press('End');await p.keyboard.press('Control+Space');await p.waitForSelector('.cm-tooltip-autocomplete');assert.match(await p.locator('.cm-tooltip-autocomplete').innerText(),/behavior/);
      await p.keyboard.press('Escape');await edit(p,objectSource);await select(p,'level.js');await edit(p,exampleEntry);
      await edit(p,"import './missing.js';\nexport default function() {};");await generate(p,{error:true,match:/missing.js/});
      await edit(p,'export default function() { const = ; }');await generate(p,{error:true,match:/level.js:1:/});
      await edit(p,"export default function() { throw new Error('test runtime failure'); }");await generate(p,{error:true,match:/test runtime failure/});assert.match(await p.locator('#script-status').innerText(),/level.js/);
      await edit(p,"import { Level } from '@gothere/core'; export default function() { const level = new Level(); level.data.invalid = () => {}; return level; }");await generate(p,{error:true,match:/纯 JSON/});
      await edit(p,'export default function() { while(true) {} }');await generate(p,{error:true,match:/超过/});
      await edit(p,'while(true) {}\nexport default function() {}');await p.locator('#script-generate').click();await p.locator('#script-stop').click();assert.match(await p.locator('#script-status').innerText(),/已停止/);
      assert.deepEqual(current(await workspace(p)),current(original),'bad scripts never change the canvas');
      await edit(p,exampleEntry);await generate(p);await edit(p,exampleEntry+'\n// changed');assert.equal(await p.locator('#script-apply').isDisabled(),true);
      await edit(p,exampleEntry);await generate(p);await p.locator('#script-import').click();const playable=current(await workspace(p));assert.equal(playable.entities.length,1);assert.equal(playable.rules.length,1);
      await p.locator('#preview-toggle').click();await p.locator('#scene-interactions [data-source="cart"]').click();await p.locator('#editor-return').click();

      // Previously saved custom scripts migrate without being flattened into generated classes.
      await p.locator('#open-script').click();await p.locator('#script-base').click();await p.locator('#close-script').click();
      await p.evaluate(base=>{const key='gothere.authoring.'+JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).activeKey;localStorage.setItem(key,JSON.stringify({base,source:'level.actor.speed += 3; return level;'}));},playable);
      await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#open-script').click();assert.match(await p.locator('#script-source').inputValue(),/speed \+= 3/);await generate(p);
      await upload(p,'old-level.js',levelToJavaScript(current(original)));await generate(p);await p.locator('#script-apply').click();assert.deepEqual(current(await workspace(p)),current(original));
      await p.locator('#open-script').click();await upload(p,'invalid.zip',zipSync({'../escape.js':strToU8('export default function() {}')}));assert.equal(await p.locator('#script-status').getAttribute('data-error'),'true');await generate(p);
      await p.locator('#close-script').click();assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  console.log('PASS JS project online/offline/public: tree, classes/imports, per-file undo, rename, ZIP, restore, persistence, legacy migration, completion, errors, timeout, cancellation, play and unchanged drafts.');
}finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>preview.close(r));}
