import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,replayRecording} from '../src/core/engine.js';
import {validateLevel} from '../src/core/schema.js';
import {createEditorStore,createBlankLevel} from '../src/editor/model.js';

const base=()=>({...createBlankLevel('spatial-actions'),schemaVersion:2,world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
  spatial:{projection:{originY:550,depthX:.18,depthY:-.65},start:'a',nodes:[{id:'a',x:100,depth:80,height:0,next:'b'},{id:'b',x:1000,depth:80,height:0}]},
  actor:{x:100,speed:60,space:{depth:80,height:0}},goal:{x:1000,space:{depth:80,height:0}},platforms:[{x:30,width:1100,space:{depth:0,depthSize:400,height:0}}]});
const object=(id,x,height=0)=>({id,kind:'object',label:id,x,width:160,height:10,state:'active',space:{depth:40,depthSize:80,height}});
const action=(target,x,depth,height,ticks)=>({type:'move',target,x,depth,height,ticks});
test('spatial move carries a supported walker across depth and elevation; moved is actual completion',()=>{
  const l=base();l.actor.space.height=60;l.spatial.nodes[0].height=60;l.entities=[{...object('carrier',80,60),surface:{enabled:true},behaviors:[{id:'go',label:'go',actions:[action('carrier',200,160,140,60)]}]}];
  l.rules=[{on:{type:'click',source:'carrier'},actions:[{type:'invoke',target:'carrier',behavior:'go'}]}];
  const s=createSimulation(l).start();s.click('carrier');s.step(30);const state=s.snapshot();
  assert.equal(state.actor.space.height,100);assert.equal(state.entities.carrier.space.depth,100);assert.ok(state.actor.space.depth>135&&state.actor.space.depth<145);assert.equal(state.actor.support,'carrier');
  assert.ok(state.actor.x>180);assert.equal(state.signals.some(e=>e.event==='moved'),false);
  s.step(30);assert.equal(s.snapshot().entities.carrier.space.height,140);assert.ok(s.snapshot().signals.some(e=>e.event==='moved'));
  assert.deepEqual(replayRecording(l,s.recording()).snapshot(),s.snapshot());
  const p=s.snapshot();s.pause().step(30);assert.equal(s.snapshot().actor.x,p.actor.x);s.reset();assert.equal(s.snapshot().entities.carrier.space.height,60);
});
test('spatial hold uses world contact, follows through depth, and excludes held damage',()=>{
  const l=base(),item={...object('item',115),width:12,height:12,contact:{effect:'lethal'}};
  l.entities=[item];l.rules=[{on:{type:'contact',source:'item'},actions:[{type:'hold',target:'item'}]}];
  const s=createSimulation(l).start().step(20),a=s.snapshot().actor,e=s.snapshot().entities.item;
  assert.equal(s.snapshot().status,'running');assert.equal(a.holding,'item');assert.equal(e.space.depth,a.space.depth);assert.equal(e.space.height,a.space.height);
  const far=base();far.entities=[{...item,space:{depth:220,height:0,depthSize:20}}];far.rules=[{on:{type:'click',source:'item'},actions:[{type:'hold',target:'item'}]}];
  const f=createSimulation(far).start();f.click('item');f.step();assert.equal(f.snapshot().actor.holding,null);
});
test('spatial rotation creates real sloped support rather than a picture-only ramp',()=>{
  const l=base();l.platforms=[{x:30,width:170,space:{depth:0,depthSize:160,height:0}},{x:350,width:780,space:{depth:0,depthSize:160,height:100}}];
  l.goal.space.height=100;l.spatial.nodes[1].height=100;
  l.entities=[{...object('ramp',200),width:Math.hypot(150,100),pose:{angle:0,pivot:0},surface:{enabled:true}}];
  l.rules=[{on:{type:'click',source:'ramp'},actions:[{type:'rotate',target:'ramp',angle:-Math.atan2(100,150)*180/Math.PI,ticks:30}]}];
  const s=createSimulation(l).start();s.click('ramp');s.step(210);assert.ok(s.snapshot().actor.space.height>0);assert.equal(s.snapshot().actor.mode,'walking');
  s.step(900);assert.equal(s.snapshot().status,'won');assert.ok(s.snapshot().signals.some(e=>e.event==='rotated'));
  assert.equal(createSimulation(l).start().step(1100).snapshot().status,'lost');
});
test('move validates the spatial endpoint, duration, capability combinations and survives edit history',()=>{
  const l=base();l.entities=[object('thing',300)];l.rules=[{on:{type:'click',source:'thing'},actions:[action('thing',400,120,100,90)]}];
  assert.equal(validateLevel(l).valid,true);const store=createEditorStore();store.open('s',l);store.change(d=>d.rules[0].actions[0].depth=180);store.undo();assert.deepEqual(store.document(),l);
  for(const change of [a=>a.depth=-1,a=>a.height=400,a=>a.x=1199,a=>a.ticks=0,a=>a.y=400]){const bad=structuredClone(l);change(bad.rules[0].actions[0]);assert.equal(validateLevel(bad).valid,false);}
  l.entities[0].motion={type:'patrol',minX:300,maxX:600,speed:40};assert.equal(validateLevel(l).valid,false);
});
