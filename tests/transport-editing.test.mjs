import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankLevel, createEditorStore, addObject, addHeightTransport, setHeightTransport, snapTransport, resizeObject, moveObject } from '../src/editor/model.js';
import { createSimulation, replayRecording } from '../src/core/engine.js';
import { eventTypes, validateLevel, floorY } from '../src/core/schema.js';
import { diagramBounds } from '../src/core/geometry.js';

const journey=()=>({...createBlankLevel('vertical'),actor:{x:80,speed:120},goal:{x:800,y:260},
  platforms:[{x:0,width:285},{x:325,width:875,y:260}],
  entities:[{id:'channel',kind:'object',x:280,y:440,width:60,label:'高度移动物',state:'active',transport:{type:'vertical',toY:260,speed:120}}],rules:[]});
const ref={type:'entity',id:'channel'};

test('generic vertical capability connects offset road edges, emits arrive and exactly replays',()=>{
  const level=journey();assert.equal(validateLevel(level).valid,true);assert.ok(eventTypes(level.entities[0]).includes('arrive'));
  level.entities.push({id:'signal',kind:'switch',x:700,y:260,state:'off',label:'出口灯'});
  level.rules.push({on:{type:'arrive',source:'channel'},actions:[{type:'set',target:'signal',state:'on'}]});
  const sim=createSimulation(level);sim.start().step(1600);assert.equal(sim.snapshot().status,'won');assert.equal(sim.snapshot().entities.signal.state,'on');
  assert.deepEqual(replayRecording(level,sim.recording()).snapshot(),sim.snapshot());
});
test('a generic channel accepts descent, a start inside its footprint, and exit directions',()=>{
  const level=journey();level.actor={x:330,y:260,speed:120,direction:-1};level.goal={x:80};
  level.entities[0].transport.lowerDirection=-1;
  const sim=createSimulation(level);sim.start().step(1600);assert.equal(sim.snapshot().status,'won');assert.equal(sim.snapshot().actor.y,440);
});
test('offset arrival contacts the actual landing immediately, without sweeping empty space',()=>{
  const level=journey();level.entities.push({id:'landing',kind:'object',x:325,y:260,width:8,state:'active',label:'出口危险物',contact:{effect:'lethal'}});
  const sim=createSimulation(level);sim.start();while(sim.snapshot().actor.mode==='walking')sim.step();
  sim.step(89);assert.equal(sim.snapshot().actor.y,262);assert.equal(sim.snapshot().status,'running');
  sim.step();assert.equal(sim.snapshot().actor.x,325);assert.equal(sim.snapshot().reason,'hurt');
});
test('inactive and held transport objects cannot acquire a traveller; their behaviors remain callable',()=>{
  const level=journey();level.platforms[0].width=1200;level.goal={x:800};level.entities[0].state='inactive';
  let sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().status,'won');assert.equal(sim.snapshot().actor.y,440);
  level.entities[0].state='active';level.rules=[{on:{type:'contact',source:'channel'},actions:[{type:'hold',target:'channel'}]}];
  sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().status,'won');assert.equal(sim.snapshot().actor.holding,'channel');
});
test('unfinished geometry remains editable, missing landings are explicit, malformed capabilities are rejected',()=>{
  const level=journey();level.entities[0].transport.toY=220;
  assert.match(validateLevel(level).errors.join('\n'),/上端 Y=220 未连接路面/);
  const store=createEditorStore();store.open('map',level);assert.deepEqual(createEditorStore(store.serialize()).document(),level);
  for(const transport of [null,{}, {type:'teleport',toY:260,speed:90},{type:'vertical',toY:NaN,speed:90},{type:'vertical',toY:260,speed:0}]){
    const bad=journey();bad.entities[0].transport=transport;assert.equal(validateLevel(bad).valid,false);assert.throws(()=>createEditorStore().open('bad',bad));
  }
  const bad=journey();bad.entities[0].height=500;assert.equal(validateLevel(bad).valid,false);
});
test('placement chooses overlapping floor heights; endpoint snapping never reaches distant roads',()=>{
  const level=journey();level.entities=[];const r=addHeightTransport(level,280,450),e=level.entities[0];
  assert.equal(e.kind,'object');assert.equal(e.y,440);assert.equal(e.transport.toY,260);assert.equal(e.appearance,undefined);
  e.transport.toY=278;e.y=459;snapTransport(level,e);assert.equal(e.transport.toY,260);assert.equal(e.y,440);
  e.transport.toY=220;snapTransport(level,e);assert.equal(e.transport.toY,220);
  moveObject(level,r,20,40);assert.equal(e.y,480);assert.equal(e.transport.toY,260);
});
test('ordinary object resizes around the opposite corner, clamps bounds, and persists with undo/redo',()=>{
  const level=createBlankLevel('resize'),r=addObject(level,'object',300,440);delete level.entities[0].appearance;
  const store=createEditorStore();store.open('map',level);
  store.change(d=>resizeObject(d,r,'ne',50,-40));let e=store.document().entities[0];
  assert.equal(e.x,300);assert.equal(e.width,98);assert.equal(e.height,76);assert.equal(floorY(e),440);
  store.undo();assert.equal(store.document().entities[0].height,undefined);store.redo();assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  store.change(d=>resizeObject(d,r,'sw',-30,20));e=store.document().entities[0];assert.equal(e.x,270);assert.equal(e.width,128);assert.equal(e.height,96);assert.equal(e.y,460);
  store.change(d=>resizeObject(d,r,'se',5000,5000));e=store.document().entities[0];assert.ok(e.x+e.width<=1200);assert.ok(e.height<=240);assert.ok(e.y<=560);
  assert.equal(validateLevel(store.document()).valid,true);
});
test('roads resize length and endpoint height independently',()=>{
  const level=journey();resizeObject(level,{type:'platform',index:0},'e',-20,100);
  assert.equal(level.platforms[0].width,265);assert.equal(level.platforms[0].y,undefined);assert.equal(level.platforms[0].yEnd,540);assert.ok(level.world.physics);
});

test('channel handles edit and snap endpoints independently',()=>{
  const level=journey();resizeObject(level,ref,'n',0,18);assert.equal(level.entities[0].transport.toY,260);
  resizeObject(level,ref,'s',0,50);assert.equal(level.entities[0].y,490);assert.equal(level.entities[0].transport.toY,260);
  resizeObject(level,ref,'n',0,999);assert.equal(level.entities[0].transport.toY,440);assert.ok(diagramBounds('object',level.entities[0]).height>=64);
});
test('resizing patrol bounds stays valid; enabling transport does not discard patrol or arrival wires',()=>{
  const level=createBlankLevel('patrol'),r=addObject(level,'object',300);const e=level.entities[0];
  e.motion={type:'patrol',minX:250,maxX:900,speed:50};resizeObject(level,r,'e',5000,0);assert.equal(e.width,300);assert.equal(validateLevel(level).valid,true);
  resizeObject(level,r,'w',-5000,0);assert.equal(validateLevel(level).valid,true);
  assert.throws(()=>setHeightTransport(level,e,true),/巡逻/);assert.ok(e.motion);
  delete e.motion;setHeightTransport(level,e,true);level.rules=[{on:{type:'arrive',source:e.id},actions:[{type:'turn',direction:1}]}];
  assert.throws(()=>setHeightTransport(level,e,false),/连线/);assert.ok(e.transport);
  level.rules=[];setHeightTransport(level,e,false);assert.equal(e.transport,undefined);
});
