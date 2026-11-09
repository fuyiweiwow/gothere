import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {unzipProject} from './project-code-tools.mjs';
import {executeProject} from '../tests/helpers/project.mjs';

await mkdir('artifacts',{recursive:true});
const standalone=(await buildEditor()).path,server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
async function select(p,path){await p.locator('#script-files-mode').click();await p.locator('#script-search').fill(path);await p.locator('[data-script-path="'+path+'"]').click();await p.locator('#script-search').fill('');}
async function edit(p,text){await p.locator('.cm-content').click();await p.keyboard.press('Control+a');await p.keyboard.insertText(text);}
async function generate(p,error=false){await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.equal(await p.locator('#script-status').getAttribute('data-error'),String(error),await p.locator('#script-status').innerText());}
async function exportProject(p){const downloading=p.waitForEvent('download');await p.locator('#script-export').click();return unzipProject(new Uint8Array(await readFile(await (await downloading).path())));}
async function createFile(p,path,kind){await p.locator('#script-new').click();await p.locator('#script-path').fill(path);await p.locator('#script-template').selectOption(kind);await p.locator('#script-file-form button[type=submit]').click();await p.waitForFunction(path=>document.getElementById('script-current-path').textContent===path,path);}
async function point(p,token){const at=await p.locator('.cm-line').filter({hasText:token}).first().evaluate((line,token)=>{let offset=line.textContent.indexOf(token)+2;const walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);for(let node=walker.nextNode();node;node=walker.nextNode()){if(offset>node.length){offset-=node.length;continue;}const range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);const r=range.getBoundingClientRect();return{x:r.x+1,y:r.y+r.height/2};}},token);await p.mouse.click(at.x,at.y);}
try{
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/',pathToFileURL(standalone).href].entries()){
    const context=await browser.newContext({viewport:{width:1650,height:1050},acceptDownloads:true}),p=await context.newPage(),errors=[],network=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index===1&&/^https?:/.test(r.url()))network.push(r.url());});
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#open-script').click();await p.locator('#script-files-mode').click();
    const initial=await exportProject(p),base=await executeProject(initial);
    assert.ok(initial.files['objects/index.ts'].length<250);assert.ok(!initial.files['objects/index.ts'].includes('new '));
    await createFile(p,'objects/toy.ts','instance');const objectSource=await p.locator('#script-source').inputValue();assert.match(objectSource,/instance\(ItemToy/);
    await generate(p);await p.locator('#script-preview-close').click();const added=await exportProject(p);assert.ok((await executeProject(added)).entities.some(e=>e.id==='item-toy'));
    assert.equal(initial.files['objects/index.ts'],added.files['objects/index.ts']);
    await select(p,'events.ts');const events=await p.locator('#script-source').inputValue();await edit(p,events+'\nexport function inspectNew(objects: Objects) { return objects.itemToy; }\n');
    await point(p,'itemToy');await p.keyboard.press('F12');await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='objects/toy.ts');
    await p.locator('#script-rename').click();await p.locator('#script-path').fill('shared/toy.ts');await p.locator('#script-file-form button[type=submit]').click();await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='shared/toy.ts');await generate(p);await p.locator('#script-preview-close').click();
    await select(p,'.gothere/objects.ts');assert.equal(await p.locator('.cm-content').getAttribute('contenteditable'),'false');assert.equal(await p.locator('#script-delete').isDisabled(),true);assert.match(await p.locator('#script-source').inputValue(),/shared\/toy.ts/);
    await createFile(p,'scene/decor.ts','group');let group=await p.locator('#script-source').inputValue();group=group.replace('return {};',"return { customDecor: scene.image('custom-decor', assets.images.builtin.toonBlockStreets).label('Extra').at(100,100).size(30,30).order(0) };");await edit(p,group);await generate(p);await p.locator('#script-preview-close').click();
    const complete=await exportProject(p),level=await executeProject(complete);assert.equal(level.entities.length,base.entities.length+1);assert.equal(level.scene.nodes.length,base.scene.nodes.length+1);assert.equal(level.scene.nodes.at(-1).id,'custom-decor');assert.ok(!Object.keys(complete.files).some(path=>path.startsWith('.gothere/')));
    await select(p,'shared/toy.ts');await edit(p,objectSource.replace('export const itemToy','export const itemBus'));await generate(p,true);assert.match(await p.locator('#script-status').innerText(),/重复.*itemBus/);
    await edit(p,complete.files['shared/toy.ts']);await generate(p);await p.locator('#script-preview-close').click();
    await p.screenshot({path:`artifacts/assembly-${index}.png`});await p.locator('#close-script').click();await p.reload();await p.locator('#open-script').click();await generate(p);await p.locator('#script-preview-close').click();const restored=await exportProject(p);assert.deepEqual(await executeProject(restored),level);
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);await context.close();console.log(index===0?'Online assembly workflow passed':'Offline assembly workflow passed');
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
