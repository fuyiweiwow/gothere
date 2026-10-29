import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, replayRecording, validateLevel } from '../src/core/engine.js';
import { collectSurfaces, surfaceHeight } from '../src/core/surfaces.js';
import { createBlankLevel, createEditorStore, resizeObject, moveObject, copyObject, pasteObject, deleteObject } from '../src/editor/model.js';
import { createEditorExample } from '../src/editor/starter.js';
import { diagramBounds } from '../src/core/geometry.js';
import { posePoint, posePolygon } from '../src/core/pose.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const fixture=()=>({...createBlankLevel('rotation-test'),
  world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
  actor:{x:80,y:260,speed:60},goal:{x:1100,y:520},
  platforms:[{x:0,width:200,y:260},{x:0,width:1200,y:520}],
  entities:[{id:'panel',kind:'object',label:'翻板',x:200,y:260,width:200,state:'active',
    pose:{angle:0,pivot:0},surface:{enabled:true},behaviors:[{id:'lower',label:'放下',actions:[{type:'rotate',target:'panel',angle:30,ticks:60}]}]},
    {id:'lamp',kind:'switch',label:'完成灯',x:900,y:520,state:'off'}],
  rules:[{on:{type:'click',source:'panel'},actions:[{type:'invoke',target:'panel',behavior:'lower'}]},
    {on:{type:'rotated',source:'panel'},actions:[{type:'set',target:'lamp',state:'on'}]}]});

test('rotation produces a real support segment about any pivot, independently of activation',()=>{
  for(const pivot of [0,0.5,1]){
    const level=fixture(),panel=level.entities[0];panel.pose={angle:-30,pivot};panel.state='inactive';
    const s=collectSurfaces(level,Object.fromEntries(level.entities.map(e=>[e.id,e]))).find(s=>s.id==='panel');
    assert.ok(s);near(s.x,200+200*pivot-200*pivot*Math.cos(Math.PI/6));
    near(surfaceHeight(s,s.x),260+100*pivot);near(surfaceHeight(s,s.x+s.width),260-100*(1-pivot));
    panel.surface.enabled=false;assert.equal(collectSurfaces(level,{panel}).some(s=>s.id==='panel'),false);
  }
});

test('rotate runs for exactly its duration and emits rotated separately from command done',()=>{
  const level=fixture();level.rules.push({on:{type:'done',source:'panel',behavior:'lower'},actions:[{type:'set',target:'panel',state:'inactive'}]});
  const sim=createSimulation(level);sim.start();sim.click('panel');sim.step();
  near(sim.snapshot().entities.panel.pose.angle,0.5);assert.equal(sim.snapshot().entities.panel.state,'inactive');
  assert.equal(sim.snapshot().entities.lamp.state,'off');sim.step(58);near(sim.snapshot().entities.panel.pose.angle,29.5);
  sim.pause();const paused=sim.snapshot();sim.step(20);assert.deepEqual(sim.snapshot(),paused);
  sim.start().step();near(sim.snapshot().entities.panel.pose.angle,30);assert.equal(sim.snapshot().entities.lamp.state,'on');
  assert.deepEqual(replayRecording(level,sim.recording()).snapshot(),sim.snapshot());
  sim.reset();near(sim.snapshot().entities.panel.pose.angle,0);assert.equal(sim.snapshot().entities.lamp.state,'off');
});

test('a newer rotation replaces the previous one without a stale completion event',()=>{
  const level=fixture();level.rules[0].actions=[{type:'rotate',target:'panel',angle:30,ticks:60}];
  level.rules.push({on:{type:'click',source:'lamp'},actions:[{type:'rotate',target:'panel',angle:-20,ticks:120}]});
  const sim=createSimulation(level);sim.start();sim.click('panel');sim.step(20);near(sim.snapshot().entities.panel.pose.angle,10);
  sim.click('lamp');sim.step(40);near(sim.snapshot().entities.panel.pose.angle,0);assert.equal(sim.snapshot().entities.lamp.state,'off');
  sim.step(80);near(sim.snapshot().entities.panel.pose.angle,-20);assert.equal(sim.snapshot().entities.lamp.state,'on');
});

test('a walker is carried by its support while still walking, then falls after the endpoint',()=>{
  const level=fixture();level.actor.x=190;const sim=createSimulation(level);sim.start().step(20);
  assert.equal(sim.snapshot().actor.support,'panel');sim.click('panel');sim.step(10);
  const state=sim.snapshot(),s=collectSurfaces(level,state.entities).find(s=>s.id==='panel');
  assert.equal(state.actor.mode,'walking');near(state.actor.y,surfaceHeight(s,state.actor.x));assert.ok(state.actor.y>260);
  sim.step(2000);assert.equal(sim.snapshot().status,'won');
  assert.ok(sim.snapshot().events.some(e=>e.kind==='land'));
});

test('pose without support never creates an invisible floor; held support is removed',()=>{
  const level=fixture();delete level.entities[0].surface;const sim=createSimulation(level);sim.start().step(125);
  assert.equal(sim.snapshot().actor.mode,'falling');
  const held=fixture();held.actor.x=190;held.rules[0].actions=[{type:'hold',target:'panel'}];
  const carried=createSimulation(held);carried.start();carried.click('panel');carried.step(30);
  assert.equal(carried.snapshot().actor.holding,'panel');assert.equal(carried.snapshot().actor.mode,'falling');
});

test('pose and rotation validate capability, bounds, finite values and duration before running',()=>{
  assert.equal(validateLevel(fixture()).valid,true);
  for(const mutate of [l=>l.entities[0].pose.angle=90,l=>l.entities[0].pose.pivot=-1,l=>l.entities[0].pose.angle=NaN,
    l=>l.entities[0].surface.enabled='yes',l=>delete l.world.physics,l=>delete l.entities[0].pose,
    l=>l.entities[0].behaviors[0].actions[0].ticks=0,l=>l.entities[0].behaviors[0].actions[0].angle=Infinity,
    l=>l.entities[0].behaviors[0].actions[0].target='lamp',l=>l.entities[0].y=550]){
    const level=fixture();mutate(level);assert.equal(validateLevel(level).valid,false);assert.throws(()=>createSimulation(level));
  }
});

test('rotated endpoint resizing preserves the opposite endpoint, pivot and complete undo/clipboard data',()=>{
  const level=fixture(),ref={type:'entity',id:'panel'},store=createEditorStore();store.open('pose',level);
  store.change(d=>resizeObject(d,ref,'e',-26.79491924311228,100));let panel=store.document().entities[0];
  near(panel.pose.angle,30);near(panel.width,200);near(panel.x,200);near(panel.y,260);
  store.change(d=>moveObject(d,ref,20,30));panel=store.document().entities[0];near(panel.x,220);near(panel.y,290);
  store.undo();near(store.document().entities[0].y,260);store.redo();
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  const doc=store.document(),pasted=pasteObject(doc,copyObject(doc,ref)),copy=doc.entities.find(e=>e.id===pasted.id);
  near(copy.pose.angle,30);assert.equal(copy.behaviors[0].actions[0].target,copy.id);
  deleteObject(doc,ref);assert.equal(doc.rules.length,0);
});

test('rotation example is authored with ordinary capabilities and needs its event chain to win',()=>{
  const level=createEditorExample('rotation');assert.equal(level.id,'editor-rotation');
  const pass=createSimulation(level);pass.start();pass.click('release');pass.step(3000);assert.equal(pass.snapshot().status,'won');
  const fail=createSimulation(level);fail.start().step(3000);assert.equal(fail.snapshot().status,'lost');
});

test('a sloped object contact uses its transformed baseline and can invoke a hurt behavior',()=>{
  const level=fixture(),panel=level.entities[0];panel.pose.angle=30;
  level.actor={x:300,y:260+100*Math.tan(Math.PI/6),speed:60};
  panel.behaviors.push({id:'attack',label:'攻击',actions:[{type:'hurt',message:'坡面接触'}]});
  level.rules.push({on:{type:'contact',source:'panel'},actions:[{type:'invoke',target:'panel',behavior:'attack'}]});
  const sim=createSimulation(level);sim.start().step();assert.equal(sim.snapshot().reason,'hurt');
  assert.equal(sim.snapshot().events.at(-1).message,'坡面接触');
});

test('drafts retain references while gravity is temporarily disabled and report a run validation error',()=>{
  const store=createEditorStore();store.open('rotation',fixture());store.change(d=>delete d.world.physics);
  assert.equal(validateLevel(store.document()).valid,false);store.undo();assert.equal(validateLevel(store.document()).valid,true);
});

test('pivot geometry bounds contain the actual polygon and west resizing preserves the far endpoint',()=>{
  const level=fixture(),panel=level.entities[0];panel.pose={angle:-20,pivot:0.5};delete panel.surface;
  const b=diagramBounds('object',panel);
  for(const p of posePolygon(panel))assert.ok(p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height);
  const end=posePoint(panel,1);resizeObject(level,{type:'entity',id:'panel'},'w',20,10);
  near(posePoint(panel,1).x,end.x);near(posePoint(panel,1).y,end.y);near(panel.pose.pivot,0.5);
});

test('translation and rotation compose on a patrolling surface and a rotated event may start another turn',()=>{
  const level=fixture(),panel=level.entities[0];level.actor.x=220;level.actor.speed=15;
  panel.motion={type:'patrol',minX:200,maxX:300,speed:30};
  level.rules[1].actions=[{type:'rotate',target:'panel',angle:-10,ticks:60},{type:'set',target:'lamp',state:'on'}];
  const sim=createSimulation(level);sim.start();sim.click('panel');sim.step(60);
  assert.ok(sim.snapshot().entities.panel.rotation);sim.step(60);near(sim.snapshot().entities.panel.pose.angle,-10);
  const state=sim.snapshot(),s=collectSurfaces(level,state.entities).find(s=>s.id==='panel');
  near(state.actor.y,surfaceHeight(s,state.actor.x));assert.equal(state.actor.mode,'walking');
});
