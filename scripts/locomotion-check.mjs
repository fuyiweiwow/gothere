import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';
import {ASSETS} from '../src/content/library.js';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {commuterVisual} from '../src/editor/commuter-presentation.js';
import {createSimulation} from '../src/core/engine.js';
import {artTransform} from '../src/render/resources.js';
import {actorAnimationState} from '../src/core/locomotion.js';
import {readSourceLevel} from './check-source-helpers.mjs';

// Both directions, preceded by a horizontal walk. This fixture is test data,
// not another published chapter or a special route in the runtime.
const level=createLayeredLevel(),n=(id,x,plane,next,via)=>({id,x,plane,depth:plane==='front'?30:210,height:0,...(next?{next}:{}),...(via?{via}:{})});
level.actor={x:600,speed:70,space:{plane:'back',depth:210,height:0}};
level.goal={x:650,space:{plane:'back',depth:210,height:0}};level.spatial.start='start';
level.spatial.nodes=[n('start',600,'back','out'),n('out',450,'back','front-entry','alley'),n('front-entry',330,'front','in'),n('in',1050,'front','back-entry','return'),n('back-entry',1050,'back','finish'),n('finish',650,'back')];
level.platforms=['front','back'].map(plane=>({x:25,width:1150,space:{plane,depth:plane==='front'?30:210,height:0,depthSize:20}}));
level.entities=[level.entities[0],{...structuredClone(level.entities[0]),id:'return',x:1050,passage:{from:'in',to:'back-entry',distance:180,enabled:true}}];
Object.assign(level.entities[0].passage,{from:'out',to:'front-entry'});
level.scene={background:'#e5dcc7',assets:[],nodes:[commuterVisual('hero',70)]};

const probes=[],seen=new Set(),game=createSimulation(level).start();
for(let i=0;i<2000&&game.snapshot().status==='running';i++){
  game.step();const s=game.snapshot(),state=actorAnimationState(level,s);
  if(!seen.has(state)&&s.status==='running'){seen.add(state);probes.push({tick:s.tick,state});}
}
assert.equal(game.snapshot().status,'won');
assert.deepEqual([...seen],['walk-left','outward','walk-right','inward']);

await mkdir('artifacts',{recursive:true});const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const draft=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gothere.studio.layered.v1'));return s.documents.find(d=>d.key===s.activeKey).level;});
const tick=p=>p.locator('#runtime-tick').innerText().then(t=>Number(t.match(/tick (\d+)/)[1]));
async function until(p,target){for(let i=0;i<8;i++){const now=await tick(p);if(now>=target||['won','lost'].includes(await p.locator('#runtime-status').getAttribute('data-status')))return;await p.clock.runFor(Math.ceil((target-now)*1000/60)+20);}assert.fail('did not reach '+target);}
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=chapter',offline+'?sample=chapter'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1050},acceptDownloads:true}),p=await context.newPage(),errors=[],requests=[];
    try{
      p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
      // Observe what the shipped canvas actually paints in both online and
      // bundled editors, without injecting an alternative renderer.
      await p.addInitScript(({images})=>{
        const draw=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
          if(this.canvas.id==='scene'&&images[image.src])globalThis.__walkPaint={asset:images[image.src],flip:this.getTransform().a<0};
          return draw.call(this,image,...args);
        };
      },{images:Object.fromEntries(ASSETS.filter(a=>/^toonCommuter/.test(a.id)).map(a=>[a.src,a.id]))});
      const time=new Date('2026-11-09T00:00:00Z');await p.clock.install({time});await p.clock.pauseAt(new Date(+time+1000));
      await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();const chapter=await draft(p);
      await p.locator('#display-mode').selectOption('scene');await p.locator('[data-art-id=chapter-player]').click();
      assert.equal(await p.locator('#art-distance-cycle').isChecked(),true);assert.equal(await p.locator('#art-stride').inputValue(),'0.75');
      await p.locator('#art-stride').fill('0.9');await p.locator('#art-stride').press('Enter');
      assert.equal((await draft(p)).scene.nodes.find(n=>n.id==='chapter-player').animation.stride,.9);
      await p.locator('#editor-undo').click();assert.deepEqual(await draft(p),chapter);
      await p.locator('#art-state').selectOption('inward');assert.equal(await p.locator('#art-stride').inputValue(),'0.4');
      await p.locator('#art-distance-cycle').uncheck();assert.equal(await p.locator('#art-stride').count(),0);await p.locator('#editor-undo').click();
      assert.deepEqual(await readSourceLevel(p),chapter,'stride and directional clips survive TypeScript export');
      await p.locator('#open-script').click();await p.locator('#script-file').setInputFiles({name:'walk-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(level))});
      await p.waitForFunction(()=>document.getElementById('script-file').files.length===0);
      await p.locator('#script-generate').click();await p.waitForFunction(()=>!document.getElementById('script-generate').disabled);
      assert.equal(await p.locator('#script-status').getAttribute('data-error'),'false');await p.locator('#script-import').click();
      await p.locator('#preview-toggle').click();
      for(const probe of probes){
        await until(p,probe.tick+6);await p.locator('#preview-step').click();
        const now=await tick(p),snapshot=createSimulation(level).start().step(now).snapshot();
        assert.equal(actorAnimationState(level,snapshot),probe.state);
        const expected=artTransform(level.scene.nodes[0],level,snapshot),paint=await p.evaluate(()=>globalThis.__walkPaint);
        assert.deepEqual(paint,{asset:expected.asset,flip:expected.flipX},'shipped frame/direction at '+probe.state);
        const paused=await p.locator('#scene').evaluate(c=>c.toDataURL());
        await p.clock.runFor(500);assert.equal(await p.locator('#scene').evaluate(c=>c.toDataURL()),paused,'pause freezes '+probe.state);
        await p.locator('#scene').screenshot({path:`artifacts/walk-${probe.state}-${index}.png`});await p.locator('#preview-toggle').click();
      }
      await until(p,game.snapshot().tick+10);assert.equal(await p.locator('#runtime-status').getAttribute('data-status'),'won');
      await p.locator('#preview-reset').click();await p.locator('#editor-return').click();assert.deepEqual(await draft(p),level);
      const savedKey=await p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')).activeKey);
      await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();await p.locator('#draft-select').selectOption(savedKey);assert.deepEqual(await draft(p),level);
      assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
      console.log('PASS locomotion '+(index?'offline':'online')+': stride editing/undo, typed export, four painted directions, paused frame, full path, reset and save.');
    }finally{await context.close();}
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
