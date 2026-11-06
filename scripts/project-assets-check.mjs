import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {ASSETS} from '../src/content/library.js';
import {unzipProject} from './project-code-tools.mjs';
import {buildEditor} from './build.mjs';

await mkdir('artifacts',{recursive:true});
const standalone=(await buildEditor()).path;
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const png=Buffer.from(ASSETS.find(a=>a.id==='chimney').src.split(',')[1],'base64');
const wav=Buffer.alloc(44+8820);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(8820,40);
const folder=resolve('artifacts/directory-import/assets');
await mkdir(folder+'/images',{recursive:true});await mkdir(folder+'/sounds',{recursive:true});
await writeFile(folder+'/images/sign.png',png);await writeFile(folder+'/sounds/chirp.wav',wav);
async function select(p,path){await p.locator('#script-search').fill(path);await p.locator('[data-script-path="'+path+'"]').click();await p.locator('#script-search').fill('');}
async function edit(p,text){await p.locator('.cm-content').click();await p.keyboard.press('Control+a');await p.keyboard.insertText(text);}
async function generate(p,error=false){await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);assert.equal(await p.locator('#script-status').getAttribute('data-error'),String(error),await p.locator('#script-status').innerText());}
async function point(p,token){
  const xy=await p.locator('.cm-line').filter({hasText:token}).first().evaluate((line,token)=>{
    let offset=line.textContent.indexOf(token)+2;const walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){if(offset>node.length){offset-=node.length;continue;}const range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);const r=range.getBoundingClientRect();return {x:r.x+1,y:r.y+r.height/2};}
  },token);await p.mouse.click(xy.x,xy.y);
}
const code=`import { Level } from '@gothere/core';
import { createAssets } from '@gothere/assets';
export default function build() {
  const level = new Level();
  const assets = createAssets(level);
  level.scene.configure({background:'#ffffff'});
  level.scene.image('test-view', assets.images.street.cityBus).label('test').at(100,100).size(70,70).order(0);
  return level;
}`;
try{
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/',pathToFileURL(standalone).href].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1050},acceptDownloads:true}),p=await context.newPage(),errors=[],network=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index===1&&/^https?:/.test(r.url()))network.push(r.url());});
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#open-script').click();await p.locator('#script-files-mode').click();
    await p.locator('.script-asset-tools summary').click();await p.locator('#script-asset-destination').fill('street');
    await p.locator('#script-asset-file').setInputFiles([{name:'city-bus.png',mimeType:'image/png',buffer:png},{name:'braking.wav',mimeType:'audio/wav',buffer:wav}]);
    await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='assets/sounds/street/braking.wav');
    assert.equal(await p.locator('#script-asset-preview audio').getAttribute('preload'),'none');
    await p.locator('#script-asset-folder').setInputFiles(folder);await p.waitForFunction(()=>document.getElementById('script-status').textContent.includes('目录资源已登记'));
    await select(p,'assets/images/sign.png');await select(p,'assets/sounds/chirp.wav');
    await select(p,'assets/images/street/city-bus.png');assert.equal(await p.locator('#script-asset-preview img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    await select(p,'level.ts');await edit(p,code);
    await point(p,'cityBus');await p.keyboard.press('F12');await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='assets/images/street/city-bus.png');
    assert.equal(await p.locator('#code-editor').isVisible(),false);await p.locator('#script-back').click();assert.equal(await p.locator('#script-current-path').innerText(),'level.ts');
    await generate(p);await p.locator('#script-preview-close').click();
    await select(p,'assets/images/street/city-bus.png');await p.locator('#script-rename').click();await p.locator('#script-path').fill('assets/images/vehicles/bus.png');await p.locator('#script-file-form button[type=submit]').click();
    await p.waitForFunction(()=>document.getElementById('script-current-path').textContent==='assets/images/vehicles/bus.png');await select(p,'level.ts');assert.match(await p.locator('#script-source').inputValue(),/assets.images.vehicles.bus/);
    await generate(p);await p.locator('#script-preview-close').click();
    await select(p,'.gothere/assets.ts');assert.equal(await p.locator('.cm-content').getAttribute('contenteditable'),'false');assert.equal(await p.locator('#script-delete').isDisabled(),true);
    const download=p.waitForEvent('download');await p.locator('#script-export').click();const bytes=await readFile(await (await download).path()),project=unzipProject(bytes);
    assert.equal(project.version,2);assert.ok(project.assets['assets/images/vehicles/bus.png']);assert.ok(project.assets['assets/sounds/street/braking.wav']);
    await p.locator('#script-file').setInputFiles({name:'roundtrip.zip',mimeType:'application/zip',buffer:bytes});await p.waitForFunction(()=>document.getElementById('script-status').textContent.includes('项目已载入'));await generate(p);
    await p.screenshot({path:`artifacts/project-assets-${index}.png`});
    await p.locator('#script-preview-close').click();await select(p,'assets/images/vehicles/bus.png');await p.locator('#script-delete').click();await generate(p,true);
    assert.match(await p.locator('#script-status').innerText(),/vehicles|2339/);
    await p.locator('#script-restore').click();await generate(p);
    await p.locator('#close-script').click();await p.reload();await p.locator('#open-script').click();await p.locator('#script-files-mode').click();await select(p,'assets/images/vehicles/bus.png');assert.equal(await p.locator('#script-asset-preview img').count(),1);
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);console.log(index===0?'Online asset workflow passed':'Offline asset workflow passed');await context.close();
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
