import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstLevel} from '../src/editor/first-level.js';
import {validateLevel} from '../src/core/schema.js';
import {createSimulation} from '../src/core/engine.js';
import {posePoint} from '../src/core/pose.js';
import {drawScene} from '../src/render/scene.js';

test('presentation metadata is editable, validated, and independent from the simulation',()=>{
  const l=createFirstLevel(),object=l.entities[0];object.presentation={symbol:'cloud',color:'#b6e3df',animation:'bob'};
  assert.equal(validateLevel(l).valid,true);
  for(const bad of [{symbol:'script',color:'#ff0000',animation:'none'},{symbol:'cloud',color:'url(evil)',animation:'bob'},{symbol:'cloud',color:'#ff0000',animation:'random'}]){
    object.presentation=bad;assert.equal(validateLevel(l).valid,false);
  }
});

test('a scene symbol follows its object pivot and rotation instead of overriding geometry',()=>{
  let matrix=[1,0,0,1,0,0];const stack=[],painted=[];
  const ctx=new Proxy({
    save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
    translate(x,y){matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y;},
    rotate(r){const [a,b,c,d,x,y]=matrix,C=Math.cos(r),S=Math.sin(r);matrix=[a*C+c*S,b*C+d*S,c*C-a*S,d*C-b*S,x,y];},
    createLinearGradient(){return {addColorStop(){}};},
    ellipse(x,y){if(ctx.fillStyle==='#abcdef')painted.push({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});}
  },{get:(target,key)=>key in target?target[key]:()=>{}});
  const level=createFirstLevel(),e=level.entities[0];e.presentation={symbol:'cloud',color:'#abcdef',animation:'none'};e.pose={angle:30,pivot:1};
  level.entities=[e];drawScene(ctx,level,undefined,{animate:false});
  const center=painted.reduce((sum,p)=>({x:sum.x+p.x/painted.length,y:sum.y+p.y/painted.length}),{x:0,y:0});
  const baseline=posePoint(e,.5),r=e.pose.angle*Math.PI/180;
  assert.ok(Math.abs(center.x-(baseline.x-2*Math.sin(r)))<1e-6,'cloud shape rotates about the saved pivot');
  assert.ok(Math.abs(center.y-(baseline.y+2*Math.cos(r)))<1e-6);
});

test('animation frames and hit geometry use simulation ticks without changing physics',async()=>{
  const {presentationFrame,presentationBounds}=await import('../src/render/presentation.js');
  const l=createFirstLevel(),e={...l.entities.find(e=>e.id==='umbrella'),presentation:{symbol:'umbrella',color:'#f2b655',animation:'bob'},state:'active'};
  const original=structuredClone(e),a=presentationFrame(e,0,true),b=presentationFrame(e,20,true);
  assert.notEqual(a.offsetY,b.offsetY);assert.equal(presentationFrame(e,20,false).offsetY,0);assert.deepEqual(e,original);
  const bounds=presentationBounds(e);assert.ok(bounds.width>e.width);assert.ok(bounds.y<e.y-e.height);
  assert.ok(bounds.y<=e.y-e.height-32,'the open canopy stays inside the clickable scene bounds');
  const s=createSimulation(l);s.start().step(20);const state=s.snapshot();for(let i=0;i<300;i++)presentationFrame(e,i,true);assert.deepEqual(s.snapshot(),state);
});
