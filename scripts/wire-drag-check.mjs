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
async function open(url){const p=await context.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();return p;}
async function scenario(p){
  await p.locator('#display-mode').selectOption('logic');const l=await draft(p);l.scene=undefined;l.rules=[];l.platforms=[{x:0,y:440,width:1200}];l.actor={x:70,y:440,speed:45};l.goal={x:1100,y:440};
  l.entities=[{id:'a',label:'按钮',kind:'object',x:220,y:440,width:40,state:'active',behaviors:[{id:'press',label:'按下',actions:[{type:'set',target:'a',state:'inactive'}]}]},
    {id:'b',label:'目标',kind:'object',x:650,y:440,width:40,state:'active',behaviors:[{id:'open',label:'打开',actions:[{type:'set',target:'b',state:'inactive'}]},{id:'close',label:'关闭',actions:[{type:'set',target:'b',state:'active'}]}]}];
  await p.locator('#open-data').click();await p.locator('#level-json').fill(JSON.stringify(l));await p.locator('#apply-level').click();
  await p.locator('[data-ref="entity:a"]').click();
  const from=p.locator('.event-slot[data-event=click] [data-wire-handle]');
  assert.equal(await from.count(),1,'event-slot connector is directly draggable');
  async function start(handle,target){const a=await handle.boundingBox(),b=await target.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});}
  await start(from,p.locator('[data-ref="entity:b"]'));assert.equal(await p.locator('.wire-drag-preview').count(),1);
  assert.equal(await p.locator('[data-ref="entity:b"]').getAttribute('data-wire-candidate'),'true');assert.equal((await draft(p)).rules.length,0,'preview is read-only');
  await p.mouse.up();if(!(await p.locator('[data-wire-choose-behavior]').count())){console.log('wire diagnostics',errors,await p.locator('.wire-connect-menu').allTextContents());await p.screenshot({path:'artifacts/wire-drag-failure.png',fullPage:true});}assert.equal(await p.locator('[data-wire-choose-behavior]').count(),2,'multiple behaviors are an explicit choice');
  await p.locator('[data-wire-choose-behavior=open]').click();let edited=await draft(p);assert.equal(edited.rules.length,1);assert.equal(edited.rules[0].on.type,'click');assert.equal(edited.rules[0].actions[0].behavior,'open');assert.deepEqual(edited.entities,l.entities,'wiring never moves an entity');
  await p.locator('#editor-undo').click();assert.equal((await draft(p)).rules.length,0);await p.locator('#editor-redo').click();assert.equal((await draft(p)).rules.length,1);
  await p.locator('#editor-overlay').focus();await p.keyboard.press('w');
  const output=p.locator('[data-wire-entity=a][data-wire-direction=output]');assert.equal(await output.count(),1,'wire tool exposes object ports');
  await start(output,p.locator('[data-ref="entity:b"]'));await p.keyboard.press('Escape');await p.mouse.up();assert.equal(await p.locator('.wire-drag-preview').count(),0);assert.equal(await p.locator('.wire-connect-menu').count(),0);assert.equal((await draft(p)).rules.length,1);
  await p.keyboard.press('w');await start(output,p.locator('[data-ref="entity:b"]'));await p.mouse.up();
  await p.locator('#wire-menu-event').selectOption('click');await p.locator('[data-wire-choose-behavior=close]').click();assert.equal((await draft(p)).rules.length,2,'one output can drive more than one behavior');
  await start(output,p.locator('[data-ref="entity:b"]'));await p.mouse.up();await p.locator('#wire-menu-event').selectOption('click');await p.locator('[data-wire-choose-behavior=open]').click();assert.equal((await draft(p)).rules.length,2,'duplicate gestures do not duplicate rules');
  await p.screenshot({path:'artifacts/wire-drag.png',fullPage:true});
}
try{await scenario(await open('http://127.0.0.1:'+server.address().port+'/'));const built=await buildEditor();await scenario(await open(pathToFileURL(built.path).href));assert.deepEqual(errors,[]);console.log('PASS wire dragging: inspector/canvas ports, preview/highlight, explicit behaviors, history, fan-out, duplicate guard, Escape and offline.');}
finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
