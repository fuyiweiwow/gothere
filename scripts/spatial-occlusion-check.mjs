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
    const {loadResources}=await import('/src/render/resources.js');
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=640;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const sheet=document.createElement('canvas');sheet.width=1000;sheet.height=720;const out=sheet.getContext('2d');
    const pixels=[],ticks=[520,560,600,640,680,720,760,800,840,880,920,960],level=createSpatialLevel(),simulation=createSimulation(level).start();simulation.click('traffic');let previous=0;
    for(const [index,tick] of ticks.entries()){
      simulation.step(tick-previous);previous=tick;const state=simulation.snapshot(),a=state.actor,p=projectSpace(level,{x:a.x,...a.space});
      for(const logic of [false,true]){
        drawSpatial(ctx,level,state,{logic,animate:false});
        for(const offset of [18,10]){
          const sample=[...ctx.getImageData(Math.round(p.x),Math.round(p.y-offset),1,1).data];pixels.push({tick,logic,offset,sample});
        }
      }
      drawSpatial(ctx,level,state,{animate:false});
      const x=index%4*250,y=Math.floor(index/4)*240;out.fillStyle='#10141a';out.fillRect(x,y,250,240);out.drawImage(canvas,p.x-110,p.y-130,220,200,x,y+25,250,210);
      out.fillStyle='white';out.font='12px sans-serif';out.fillText(`tick ${tick} x ${a.x.toFixed(0)} d ${a.space.depth.toFixed(0)} h ${a.space.height.toFixed(0)}`,x+4,y+17);
    }
    const cases=[];
    for(const projection of [{originY:550,depthX:.18,depthY:-.65},{originY:540,depthX:-.25,depthY:-.45}]){
      const l=createSpatialLevel();l.spatial.projection=projection;l.entities=[];
      l.platforms[3].x=740;l.platforms[3].width=160;
      for(const height of [0,80]){
        const actor={x:820,space:{depth:220,height}},p=projectSpace(l,{x:actor.x,...actor.space});
        drawSpatial(ctx,l,{tick:0,actor,entities:{}},{animate:false});
        cases.push({name:'bridge '+height+' '+projection.depthX,sample:[...ctx.getImageData(Math.round(p.x),Math.round(p.y-18),1,1).data],expected:height===80?[234,198,126,255]:[108,142,172,255]});
      }
      l.platforms=[l.platforms[0]];
      const marker={id:'box',kind:'object',state:'active',x:410,width:70,height:85,space:{depth:100,depthSize:40,height:0}};
      for(const depth of [70,160]){
        const actor={x:430,space:{depth,height:0}},p=projectSpace(l,{x:actor.x,...actor.space});
        drawSpatial(ctx,l,{tick:0,actor,entities:{box:marker}},{animate:false});
        cases.push({name:'box '+depth+' '+projection.depthX,sample:[...ctx.getImageData(Math.round(p.x),Math.round(p.y-18),1,1).data],expected:depth===70?[234,198,126,255]:[144,169,170,255]});
      }
    }
    // Render into a scaled canvas too: putImageData on the main context would
    // ignore the editor's transform and break zoom / high-DPI displays.
    const scaled=document.createElement('canvas');scaled.width=600;scaled.height=320;const small=scaled.getContext('2d');small.scale(.5,.5);
    const actor={x:820,space:{depth:180,height:80}},p=projectSpace(level,{x:actor.x,...actor.space});
    drawSpatial(small,level,{tick:0,actor,entities:{}},{animate:false});
    cases.push({name:'scaled canvas',sample:[...small.getImageData(Math.round(p.x/2),Math.round((p.y-18)/2),1,1).data],expected:[234,198,126,255]});
    const tile=document.createElement('canvas');tile.width=16;tile.height=40;const brush=tile.getContext('2d');brush.fillStyle='#00ffff';brush.fillRect(0,0,16,40);
    const art=createSpatialLevel();art.entities=[];art.scene={background:'#161e2b',assets:[{id:'occlusion-test',label:'test',width:16,height:40,src:tile.toDataURL()}],
      nodes:[{id:'actor-art',label:'test',asset:'occlusion-test',bind:{type:'actor'},x:-8,y:-40,width:16,height:40,rotation:0,layer:0}]};
    await loadResources(art);
    for(const height of [0,80]){
      const actor={x:820,space:{depth:220,height}},p=projectSpace(art,{x:actor.x,...actor.space});
      drawSpatial(ctx,art,{tick:0,actor,entities:{}},{animate:false});
      cases.push({name:'bound art '+height,sample:[...ctx.getImageData(Math.round(p.x),Math.round(p.y-18),1,1).data],expected:height===80?[0,255,255,255]:[108,142,172,255]});
    }
    const times=[];
    for(let i=0;i<40;i++){const start=performance.now();drawSpatial(ctx,level,simulation.snapshot(),{animate:false});times.push(performance.now()-start);}
    times.sort((a,b)=>a-b);
    return {pixels,cases,medianMs:times[20],contactSheet:sheet.toDataURL().split(',')[1]};
  });
  await writeFile('artifacts/spatial-occlusion-frames.png',Buffer.from(result.contactSheet,'base64'));
  const hidden=result.pixels.filter(p=>p.sample.slice(0,3).some((v,i)=>v!==[234,198,126][i]));
  assert.deepEqual(hidden,[],'the upper body must remain visible on the slope and along the bridge, in both views');
  for(const c of result.cases)assert.deepEqual(c.sample,c.expected,c.name);
  assert.deepEqual(errors,[]);console.log('PASS occlusion: 48 slope/bridge torso/waist samples; above/below bridge, front/behind box with 2 projections; bound art; scaled canvas. Median render '+result.medianMs.toFixed(1)+' ms.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
