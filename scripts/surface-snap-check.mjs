import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
await mkdir('artifacts',{recursive:true});const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1150}}),errors=[];
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
async function open(url){const p=await context.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();return p;}
async function scenario(p){await p.locator('#display-mode').selectOption('logic');await p.locator('#snap-enabled').uncheck();
  const l=await draft(p);l.platforms=[{x:50,y:303,width:800}];l.entities=[];l.rules=[];l.scene=undefined;l.actor={x:100,y:303,speed:45};l.goal={x:700,y:303};
  await p.locator('#open-data').click();await p.locator('#level-json').fill(JSON.stringify(l));await p.locator('#apply-level').click();
  async function place(x,y,alt=false){await p.locator('[data-tool="object"]').first().click();const b=await p.locator('#editor-overlay').boundingBox();if(alt)await p.keyboard.down('Alt');await p.mouse.click(b.x+x/1200*b.width,b.y+y/640*b.height);if(alt)await p.keyboard.up('Alt');return (await draft(p)).entities.at(-1);}
  let e=await place(230,309);assert.equal(e.y,303,'continuous placement snaps onto a non-grid surface');
  await p.locator('#surface-snap').uncheck();e=await place(360,309);assert.equal(e.y,310,'toggle preserves the unsnapped placement');
  await p.locator('#surface-snap').check();e=await place(490,309,true);assert.equal(e.y,310,'Alt bypasses support snapping');
  await p.keyboard.press('v');const ref=e.id,b=await p.locator('[data-ref="entity:'+ref+'"]').boundingBox(),map=await p.locator('#editor-overlay').boundingBox();
  await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2+20/1200*map.width,b.y+b.height/2-2/640*map.height,{steps:5});
  assert.ok(await p.locator('[data-snap-kind="surface"]').count()>0,'actual supporting line is highlighted');await p.mouse.up();assert.equal((await draft(p)).entities.find(e=>e.id===ref).y,303);
  await p.locator('#editor-undo').click();assert.equal((await draft(p)).entities.find(e=>e.id===ref).y,310);await p.locator('#editor-redo').click();assert.equal((await draft(p)).entities.find(e=>e.id===ref).y,303);
  await p.screenshot({path:'artifacts/surface-snapping.png',fullPage:true});}
try{const p=await open('http://127.0.0.1:'+server.address().port+'/');await scenario(p);const built=await buildEditor();await scenario(await open(pathToFileURL(built.path).href));assert.deepEqual(errors,[]);console.log('PASS support snapping: continuous placement, actual road baseline, drag guide, toggle/Alt, history and offline authoring.');}
finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
