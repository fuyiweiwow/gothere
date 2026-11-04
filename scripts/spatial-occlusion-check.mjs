import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const result=await page.evaluate(async()=>{
    const {createSimulation}=await import('/src/core/engine.js'),{createSpatialLevel}=await import('/src/editor/spatial-level.js');
    const {drawSpatial}=await import('/src/render/spatial.js'),{projectSpace}=await import('/src/core/spatial.js');
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=640;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const sheet=document.createElement('canvas');sheet.width=1000;sheet.height=720;const out=sheet.getContext('2d');
    const pixels=[],ticks=[520,560,600,640,680,720,760,800,840,880,920,960],level=createSpatialLevel(),simulation=createSimulation(level).start();simulation.click('traffic');let previous=0;
    for(const [index,tick] of ticks.entries()){
      simulation.step(tick-previous);previous=tick;const state=simulation.snapshot(),a=state.actor,p=projectSpace(level,{x:a.x,...a.space});
      for(const logic of [false,true]){
        drawSpatial(ctx,level,state,{logic,animate:false});
        const sample=[...ctx.getImageData(Math.round(p.x),Math.round(p.y-18),1,1).data];pixels.push({tick,logic,sample});
      }
      const x=index%4*250,y=Math.floor(index/4)*240;out.fillStyle='#10141a';out.fillRect(x,y,250,240);out.drawImage(canvas,p.x-110,p.y-130,220,200,x,y+25,250,210);
      out.fillStyle='white';out.font='12px sans-serif';out.fillText(`tick ${tick} x ${a.x.toFixed(0)} d ${a.space.depth.toFixed(0)} h ${a.space.height.toFixed(0)}`,x+4,y+17);
    }
    return {pixels,contactSheet:sheet.toDataURL().split(',')[1]};
  });
  await writeFile('artifacts/spatial-occlusion-frames.png',Buffer.from(result.contactSheet,'base64'));
  const hidden=result.pixels.filter(p=>p.sample.slice(0,3).some((v,i)=>v!==[234,198,126][i]));
  assert.deepEqual(hidden,[],'the upper body must remain visible on the slope and along the bridge, in both views');
  assert.deepEqual(errors,[]);console.log('PASS occlusion: 12 slope/bridge positions × 2 views preserve the visible walker.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
