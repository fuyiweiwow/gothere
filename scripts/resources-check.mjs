import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
await mkdir('artifacts',{recursive:true});const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1150}}),errors=[];
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
async function open(url){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();return p;}
async function field(p,id,v){await p.locator(id).fill(String(v));await p.locator(id).press('Enter');}
async function select(p,label){await p.locator('#layer-search').fill(label);await p.locator('#resource-layers .resource-layer').first().click();}
try{
 const p=await open(process.argv[2]??'http://127.0.0.1:'+server.address().port+'/'),initial=await draft(p),logic=structuredClone(initial.entities);
 assert.ok(initial.scene.nodes.length>=100);assert.equal(await p.locator('#resource-panel').isVisible(),true);assert.equal(await p.locator('#editor-panel').isVisible(),false);
 await p.locator('#scene').screenshot({path:'artifacts/first-level-art.png'});
 await select(p,'可落下花盆资源');const artId=initial.scene.nodes.find(n=>n.label==='可落下花盆资源').id;
 await field(p,'#art-width',80);assert.equal((await draft(p)).scene.nodes.find(n=>n.id===artId).width,80);assert.deepEqual((await draft(p)).entities,logic);
 await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),initial);
 const h=await p.locator('[data-art-resize=se]').boundingBox(),map=await p.locator('#resource-overlay').boundingBox();
 await p.mouse.move(h.x+h.width/2,h.y+h.height/2);await p.mouse.down();await p.mouse.move(h.x+h.width/2+20/1200*map.width,h.y+h.height/2+30/640*map.height,{steps:7});await p.mouse.up();
 let art=(await draft(p)).scene.nodes.find(n=>n.id===artId);assert.equal(art.width,60);assert.equal(art.height,85);assert.deepEqual((await draft(p)).entities,logic);
 await p.keyboard.press('Control+z');assert.deepEqual(await draft(p),initial);
 await field(p,'#art-x',-20);await p.locator('#art-asset').selectOption('windowCheckered');assert.deepEqual((await draft(p)).entities,logic);
 await p.locator('#editor-undo').click();await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),initial);
 await select(p,'缓降物资源');await p.locator('#art-state').selectOption('active');await field(p,'#art-width',90);
 let umbrella=(await draft(p)).scene.nodes.find(n=>n.label==='缓降物资源');assert.equal(umbrella.width,24);assert.equal(umbrella.variants.active.width,90);await p.locator('#editor-undo').click();
 const variantHandle=await p.locator('[data-art-resize=se]').boundingBox();
 await p.mouse.move(variantHandle.x+variantHandle.width/2,variantHandle.y+variantHandle.height/2);await p.mouse.down();await p.mouse.move(variantHandle.x+variantHandle.width/2+20/1200*map.width,variantHandle.y+variantHandle.height/2+20/640*map.height,{steps:5});await p.mouse.up();
 umbrella=(await draft(p)).scene.nodes.find(n=>n.label==='缓降物资源');assert.equal(umbrella.width,24);assert.equal(umbrella.variants.active.width,87);assert.equal(umbrella.variants.active.height,93);assert.equal(await p.locator('#art-state').inputValue(),'active');
 await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),initial);
 await p.locator('#art-animation').check();await p.locator('#art-frame-1').selectOption('umbrellaClosed');await field(p,'#art-fps',12);
 umbrella=(await draft(p)).scene.nodes.find(n=>n.label==='缓降物资源');assert.equal(umbrella.animation,undefined);assert.equal(umbrella.variants.active.animation.fps,12);
 for(let i=0;i<3;i++)await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),initial);
 await select(p,'可落下花盆资源');await field(p,'#art-rotation',30);
 const rotated=await p.locator('[data-art-resize=se]').boundingBox(),pot=initial.entities.find(e=>e.id==='pot'),a=initial.scene.nodes.find(n=>n.id===artId),c=Math.cos(Math.PI/6),s=Math.sin(Math.PI/6);
 assert.ok(Math.abs(rotated.x+rotated.width/2-(map.x+(pot.x+a.x+a.width*c-a.height*s)/1200*map.width))<1,'resize handle follows the rotated image corner');
 await p.mouse.move(rotated.x+rotated.width/2,rotated.y+rotated.height/2);await p.mouse.down();await p.mouse.move(rotated.x+rotated.width/2+20,rotated.y+rotated.height/2+10,{steps:5});await p.keyboard.press('Escape');await p.mouse.up();
 assert.equal((await draft(p)).scene.nodes.find(n=>n.id===artId).width,40,'cancelled drag does not commit');await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),initial);
 await p.locator('#display-mode').selectOption('logic');assert.equal(await p.locator('#editor-panel').isVisible(),true);assert.equal(await p.locator('#resource-panel').isVisible(),false);
 await p.locator('[data-ref="entity:pot"]').click();assert.equal(await p.locator('#object-width').inputValue(),'30');assert.deepEqual((await draft(p)).entities,logic);
 await p.locator('#display-mode').selectOption('scene');await p.locator('#resource-library-tab').click();await p.locator('#asset-search').fill('满月');await p.locator('[data-asset=moon_full]').click();
 const box=await p.locator('#resource-overlay').boundingBox();for(const [x,y]of [[500,80],[580,80]])await p.mouse.click(box.x+x/1200*box.width,box.y+y/640*box.height);
 assert.equal((await draft(p)).scene.nodes.length,initial.scene.nodes.length+2);await p.keyboard.press('Escape');await p.locator('#editor-undo').click();await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),initial);
 await p.locator('#asset-upload').setInputFiles({name:'自定义窗.png',mimeType:'image/png',buffer:await readFile(new URL('../assets/kenney/window.png',import.meta.url))});
 await p.locator('[data-asset^=custom-]').waitFor();await p.locator('[data-asset^=custom-]').click();await p.mouse.click(box.x+600/1200*box.width,box.y+80/640*box.height);
 assert.equal((await draft(p)).scene.assets.length,1);assert.equal((await draft(p)).scene.nodes.length,initial.scene.nodes.length+1);await p.keyboard.press('Escape');
 await p.locator('#open-data').click();assert.deepEqual(JSON.parse(await p.locator('#level-json').inputValue()),await draft(p));await p.locator('#close-data').click();
 const imported=await draft(p);await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(await draft(p),imported);
 assert.equal(await p.locator('#editor-undo').isDisabled(),true,'history starts fresh after reload');
 assert.deepEqual(await draft(p),imported);
 await p.screenshot({path:'artifacts/resources-editor.png',fullPage:true});
 // A valid large imported image must survive the same JSON path used for sharing maps.
 const noise=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=240;const ctx=c.getContext('2d'),data=ctx.createImageData(240,240);let seed=12345;for(let i=0;i<data.data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data.data[i]=seed>>>24;}ctx.putImageData(data,0,0);return c.toDataURL('image/png');});
 await p.locator('#resource-library-tab').click();await p.locator('#asset-upload').setInputFiles({name:'可交换图片.png',mimeType:'image/png',buffer:Buffer.from(noise.split(',')[1],'base64')});
 await p.locator('[data-asset^=custom-]').nth(1).waitFor();const withImage=await draft(p);assert.ok(JSON.stringify(withImage).length>262144);
 await p.locator('#open-data').click();await p.locator('#apply-level').click();await p.locator('#data-dialog').waitFor({state:'hidden'});assert.deepEqual(await draft(p),withImage);
 const built=await buildEditor(),offline=await open(pathToFileURL(built.path).href);await select(offline,'可落下花盆资源');await field(offline,'#art-width',65);assert.equal((await draft(offline)).entities.find(e=>e.id==='pot').width,30);
 await offline.locator('#display-mode').selectOption('logic');assert.equal(await offline.locator('#editor-panel').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS resources: visual-only resize/offset/swap, state variants, mode isolation, continuous painting, image import, undo, JSON/reload and offline authoring.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
