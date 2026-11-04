import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,replayRecording} from '../src/core/engine.js';
import {validateLevel} from '../src/core/schema.js';
import {projectSpace,unprojectSpace,spaceBounds,spaceSupport,spatialDrawOrder} from '../src/core/spatial.js';
import {createEditorStore} from '../src/editor/model.js';
import {artTransform} from '../src/render/resources.js';

export function spatialFixture() {
  return {schemaVersion:2,id:'spatial-test',name:'空间测试',description:'横向与纵深分别行走。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{projection:{originY:540,depthX:0.18,depthY:-0.65},start:'a',nodes:[
      {id:'a',x:100,depth:40,height:0,next:'b'},
      {id:'b',x:220,depth:40,height:0,next:'c'},
      {id:'c',x:220,depth:220,height:0,next:'d'},
      {id:'d',x:400,depth:220,height:0}]},
    actor:{x:100,speed:120,space:{depth:40,height:0}},goal:{x:400,space:{depth:220,height:0}},
    platforms:[{x:0,width:1200,space:{depth:0,depthSize:400,height:0}}],entities:[],rules:[]};
}

test('projection distinguishes ground depth from height and is invertible on a chosen height plane',()=>{
  const l=spatialFixture(),p=projectSpace(l,{x:220,depth:220,height:80});
  assert.deepEqual(p,{x:259.6,y:317});
  const q=unprojectSpace(l,p,80);assert.ok(Math.abs(q.x-220)<1e-8);assert.ok(Math.abs(q.depth-220)<1e-8);
  assert.equal(projectSpace(l,{x:220,depth:40,height:0}).y,514);
  assert.equal(spaceBounds(l,'actor',l.actor).height,32);
});

test('automatic walking turns into depth without climbing and replays deterministically',()=>{
  const l=spatialFixture(),s=createSimulation(l).start().step(90),a=s.snapshot().actor;
  assert.equal(a.x,220);assert.equal(a.space.depth,100);assert.equal(a.space.height,0);assert.equal(a.mode,'walking');
  assert.equal(s.snapshot().status,'running');s.step(240);assert.equal(s.snapshot().status,'won');
  assert.deepEqual(replayRecording(l,s.recording()).snapshot(),s.snapshot());
  assert.deepEqual(l.actor.space,{depth:40,height:0},'simulation never edits the authored document');
});

test('projection changes cannot alter simulation or replay',()=>{
  const a=spatialFixture(),b=structuredClone(a);b.spatial.projection={originY:500,depthX:-0.2,depthY:-0.45};
  assert.deepEqual(createSimulation(a).start().step(130).snapshot(),createSimulation(b).start().step(130).snapshot());
});

test('only explicit node references join paths; visual crossings do not transfer the walker',()=>{
  const l=spatialFixture();l.spatial.nodes[1].next='d';
  l.spatial.nodes.push({id:'crossing',x:220,depth:40,height:0,next:'c'});
  const a=createSimulation(l).start().step(90).snapshot().actor;
  assert.ok(a.x>220);assert.ok(a.space.depth>40&&a.space.depth<100);
  l.spatial.nodes[0].next='missing';assert.equal(validateLevel(l).valid,false);
});

test('contact uses depth and vertical extents, and normal event behaviors remain reusable',()=>{
  const l=spatialFixture();l.entities=[{id:'danger',kind:'object',state:'active',label:'危险物',x:180,width:30,height:30,
    space:{depth:100,depthSize:30,height:0},contact:{effect:'lethal'},behaviors:[{id:'stop',label:'休息',actions:[{type:'set',target:'danger',state:'inactive'}]}]}];
  l.rules=[{on:{type:'click',source:'danger'},actions:[{type:'invoke',target:'danger',behavior:'stop'}]}];
  assert.equal(createSimulation(l).start().step(70).snapshot().status,'running','same screen vicinity at another depth is safe');
  l.entities[0].space.depth=25;assert.equal(createSimulation(l).start().step(70).snapshot().reason,'hurt');
  const s=createSimulation(l).start();s.click('danger');s.step(330);assert.equal(s.snapshot().status,'won');assert.deepEqual(replayRecording(l,s.recording()).snapshot(),s.snapshot());
  l.entities[0].space.height=70;assert.equal(createSimulation(l).start().step(70).snapshot().status,'running');
});

test('a depth-only approach triggers a region once instead of depending on horizontal displacement',()=>{
  const l=spatialFixture();l.entities=[{id:'region',kind:'zone',state:'enabled',label:'区域',x:210,width:20,
    space:{depth:115,depthSize:20,height:0}}];
  l.rules=[{on:{type:'enter',source:'region'},actions:[{type:'set',target:'region',state:'disabled'}]}];
  const s=createSimulation(l).start().step(120);assert.equal(s.snapshot().entities.region.state,'disabled');
  assert.equal(s.snapshot().signals.filter(e=>e.type==='event'&&e.event==='enter').length,1);
});

test('high bridges support the walker independently of the road and harmful objects below',()=>{
  const l=spatialFixture();l.actor.space.height=80;l.goal.space.height=80;
  for(const n of l.spatial.nodes)n.height=80;
  l.platforms.push({x:50,width:500,space:{depth:20,depthSize:240,height:80}});
  l.entities=[{id:'car',kind:'object',state:'active',label:'车',x:180,width:70,height:35,space:{depth:20,depthSize:240,height:0},contact:{effect:'lethal'}}];
  const s=createSimulation(l).start().step(330);assert.equal(s.snapshot().status,'won');assert.equal(s.snapshot().actor.space.height,80);
  assert.equal(spaceSupport(l,{},l.actor).height,80);
});

test('leaving an elevated surface falls onto a real lower surface, without waiting or teleporting',()=>{
  const l=spatialFixture();l.actor.space.height=80;l.spatial.nodes[0].height=80;
  l.platforms.push({x:50,width:100,space:{depth:20,depthSize:50,height:80}});
  const s=createSimulation(l).start().step(30),a=s.snapshot().actor;
  assert.equal(a.mode,'falling');assert.ok(a.x>150);assert.ok(a.space.height<80&&a.space.height>0);
  s.step(45);assert.equal(s.snapshot().actor.space.height,0);assert.equal(s.snapshot().actor.mode,'walking');
});

test('slopes in world height carry a route up without conflating depth with height',()=>{
  const l=spatialFixture();l.spatial.nodes=[{id:'a',x:100,depth:40,height:0,next:'b'},{id:'b',x:300,depth:40,height:80}];
  l.goal={x:300,space:{depth:40,height:80}};
  l.platforms=[{x:0,width:100,space:{depth:0,depthSize:100,height:0}},
    {x:100,width:200,space:{depth:0,depthSize:100,height:0,heightEnd:80}}];
  const s=createSimulation(l).start().step(50);assert.equal(s.snapshot().actor.space.height,40);s.step(50);assert.equal(s.snapshot().status,'won');
});

test('invalid spatial data, unsupported capabilities and disconnected starts fail before simulation',()=>{
  for(const mutate of [l=>l.actor.space.depth=NaN,l=>l.spatial.nodes[0].next='a',l=>l.spatial.projection.depthY=0,
    l=>l.spatial.nodes.push({...l.spatial.nodes[0]}),l=>l.actor.space.height=70,
    l=>l.entities.push({id:'body',kind:'object',state:'active',label:'物体',x:500,collider:{enabled:true},body:{type:'dynamic'},space:{depth:40,height:0}})]){
    const l=spatialFixture();mutate(l);assert.equal(validateLevel(l).valid,false);
  }
});

test('spatial documents survive draft history and JSON and bound art uses the projected foot position',()=>{
  const l=spatialFixture(),store=createEditorStore();store.open('s',l);store.change(d=>d.spatial.nodes[1].depth=80);
  assert.equal(store.document().spatial.nodes[1].depth,80);store.undo();assert.equal(store.document().spatial.nodes[1].depth,40);store.redo();
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  const n={x:-10,y:-40,width:20,height:40,asset:'test',bind:{type:'actor'}};
  assert.equal(artTransform(n,l).y,projectSpace(l,{x:100,depth:40,height:0}).y-40);
});

test('depth order puts far objects behind near objects and bridge tops above traffic below',()=>{
  const l=spatialFixture(),far={id:'far',x:200,space:{depth:200,height:0}},near={id:'near',x:200,space:{depth:10,height:0}},bridge={id:'bridge',x:200,space:{depth:10,height:80}};
  assert.deepEqual(spatialDrawOrder(l,[near,bridge,far]).map(e=>e.id),['far','near','bridge']);
});

test('a wide ground surface is painted before every object it supports, with bridge tops over traffic',()=>{
  const l=spatialFixture(),ground={id:'ground',x:20,width:1100,space:{depth:0,depthSize:400,height:0}},
    far={id:'far',x:300,width:30,height:40,space:{depth:260,depthSize:30,height:0}},
    near={id:'near',x:300,width:30,height:40,space:{depth:80,depthSize:30,height:0}},
    bridge={id:'bridge',x:300,width:40,space:{depth:40,depthSize:300,height:80}};
  assert.deepEqual(spatialDrawOrder(l,[near,bridge,ground,far]).map(o=>o.id),['ground','far','near','bridge']);
});

test('spatial pressure plates use normal enter rules and change their state',()=>{
  const l=spatialFixture();l.entities=[{id:'plate',kind:'plate',state:'idle',label:'压力板',x:150,width:40,space:{depth:30,depthSize:30,height:0}},
    {id:'target',kind:'object',state:'active',label:'目标',x:500,width:40,space:{depth:30,depthSize:30,height:0}}];
  l.rules=[{on:{type:'enter',source:'plate'},actions:[{type:'set',target:'target',state:'inactive'}]}];
  const s=createSimulation(l).start().step(50).snapshot();assert.equal(s.entities.plate.state,'pressed');assert.equal(s.entities.target.state,'inactive');
});

test('spatial drafts support a generic enable-able support surface and can be unfinished at the start',()=>{
  const l=spatialFixture();l.entities=[{id:'support',kind:'object',state:'active',label:'承托面',x:500,width:100,surface:{enabled:true},space:{depth:30,depthSize:50,height:80}}];
  const store=createEditorStore();store.open('s',l);store.change(d=>d.actor.space.height=70);
  assert.equal(validateLevel(store.document()).valid,false);store.undo();assert.equal(validateLevel(store.document()).valid,true);
});

test('malformed spatial records produce validation errors instead of crashing import',()=>{
  for(const mutate of [l=>l.spatial.nodes=[null],l=>l.spatial.nodes=[{}],l=>l.platforms={},l=>l.entities={},l=>l.rules={},l=>l.spatial.projection=null]){
    const l=spatialFixture();mutate(l);assert.doesNotThrow(()=>assert.equal(validateLevel(l).valid,false));
  }
});

test('a route node at another height cannot redirect a walker underneath it',()=>{
  const l=spatialFixture();l.spatial.nodes[1].height=80;
  const a=createSimulation(l).start().step(90).snapshot().actor;
  assert.equal(a.space.height,0);assert.equal(a.space.depth,40);assert.ok(a.x>220,'continue walking when the elevated waypoint cannot be reached');
});
