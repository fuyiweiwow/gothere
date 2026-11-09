import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';
import {ASSETS} from '../src/content/library.js';
const level=createBusStopLevel(),actor=level.scene.nodes.find(n=>n.bind?.type==='actor');
const frames=level.scene.feedback.find(f=>f.target===actor.id&&f.animation).animation.frames;
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
try{
  const p=await browser.newPage();
  for(const id of frames){
    const asset=ASSETS.find(a=>a.id===id);
    const bounds=await p.evaluate(async src=>{
      const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=112;c.height=96;
      const x=c.getContext('2d');x.drawImage(image,0,0);const data=x.getImageData(0,0,112,96).data;
      let bottom=0,clipped=0;for(let y=0;y<96;y++)for(let i=0;i<112;i++)if(data[(y*112+i)*4+3]>200){bottom=Math.max(bottom,y);if(i===0||i===111||y===95)clipped++;}
      return {bottom,clipped};
    },asset.src);
    assert.ok(bounds.bottom<=91,id+' sinks below its ground anchor: '+JSON.stringify(bounds));
    assert.equal(bounds.clipped,0,id+' crops the falling body');
  }
  console.log('PASS landing: all eight solid poses stay above the road and inside their canvas.');
}finally{await browser.close();}
