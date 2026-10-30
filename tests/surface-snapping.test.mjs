import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankLevel,addObject,createEditorStore,resizeObject,addHeightTransport} from '../src/editor/model.js';
import {createSimulation} from '../src/core/engine.js';
import {footprintHeight} from '../src/core/bodies.js';
import {posePoint} from '../src/core/pose.js';

const fixture=()=>{const l=createBlankLevel('surface-snap');l.world.physics={gravity:900,maxFallSpeed:480};l.platforms=[{x:100,y:303,width:400}];
  l.actor={x:150,y:303,speed:40};l.goal={x:450,y:303};
  const ref=addObject(l,'object',200,310);const e=l.entities[0];delete e.appearance;e.collider={enabled:true};e.body={type:'dynamic'};return {l,ref,e};};
const snap=async(...args)=>(await import('../src/editor/surface-snapping.js')).snapToSurface(...args);

test('placing a body snaps its real bottom onto support, persists and starts physically supported',async()=>{
  const {l,ref}=fixture(),store=createEditorStore();store.open('snap',l);
  const {snapToSurface}=await import('../src/editor/surface-snapping.js');
  store.change(d=>snapToSurface(d,ref,{threshold:12}));const edited=store.document();assert.equal(edited.entities[0].y,303);
  assert.equal(createSimulation(edited).snapshot().entities[ref.id].bodyState.mode,'supported');
  assert.equal(createEditorStore(store.serialize()).document().entities[0].y,303);store.undo();assert.equal(store.document().entities[0].y,310);
});

test('snap uses horizontal overlap, real slope height and collider tops rather than drawing bounds',async()=>{
  const {l,ref,e}=fixture();l.platforms[0].yEnd=353;e.y=319;
  const guides=await snap(l,ref);assert.equal(e.y,footprintHeight(l.platforms[0],e));assert.ok(guides.some(g=>g.kind==='surface'));
  l.platforms=[];l.entities.push({id:'base',kind:'object',label:'承托',x:190,y:380,width:80,height:40,state:'active',collider:{enabled:true}});e.y=348;
  await snap(l,ref);assert.equal(e.y,340,'top of collider');
  l.entities[1].collider.enabled=false;e.y=348;assert.deepEqual(await snap(l,ref),[]);assert.equal(e.y,348);
});

test('snapping can be disabled and respects distance, point anchors and support probes',async()=>{
  const {l,ref,e}=fixture();assert.deepEqual(await snap(l,ref,{disabled:true}),[]);assert.equal(e.y,310);
  await snap(l,ref,{threshold:2});assert.equal(e.y,310);e.x=600;await snap(l,ref);assert.equal(e.y,310,'no remote horizontal support');
  l.platforms[0].yEnd=353;l.actor={x:230,y:325,speed:40};await snap(l,{type:'actor'});assert.equal(l.actor.y,319.25);
  e.x=200;e.y=310;delete e.body;delete e.collider;e.pose={angle:12,pivot:0};e.supportProbe={at:1};
  await snap(l,ref,{threshold:30});const p=posePoint(e,1),expected=303+(p.x-100)/400*50;assert.ok(Math.abs(p.y-expected)<1e-7);
});

test('road endpoints join real geometry and dragging preserves their slope',async()=>{
  const {l}=fixture();l.entities=[];l.platforms.push({x:505,y:310,width:120,yEnd:330});const ref={type:'platform',index:1};
  await snap(l,ref,{threshold:12});assert.equal(l.platforms[1].x,500);assert.equal(l.platforms[1].y,303);assert.equal(l.platforms[1].yEnd,323);
});

test('endpoint resizing fixes only the grabbed end and enables slope physics when needed',async()=>{
  const {l}=fixture();l.entities=[];delete l.world.physics;l.platforms.push({x:505,y:310,width:120});const ref={type:'platform',index:1};
  await snap(l,ref,{handle:'w'});const p=l.platforms[1];
  assert.deepEqual(p,{x:500,y:303,width:125,yEnd:310});assert.ok(l.world.physics,'a new slope needs physics');
});

test('bottom resizing keeps its opposite edge; top resizing and world clamps never invent a snap',async()=>{
  const {l,ref,e}=fixture();e.height=36;const top=e.y-e.height;
  await snap(l,ref,{handle:'se'});assert.equal(e.y,303);assert.equal(e.y-e.height,top);
  e.y=310;await snap(l,ref,{handle:'ne'});assert.equal(e.y,310);
  l.platforms[0].y=155;e.y=163;assert.deepEqual(await snap(l,ref),[]);assert.equal(e.y,163);
});

test('only actual supports participate and an object never snaps to itself',async()=>{
  const {l,ref,e}=fixture();l.platforms=[];e.height=8;assert.deepEqual(await snap(l,ref),[]);assert.equal(e.y,310);
  const surface={id:'beam',kind:'object',x:100,y:303,width:400,pose:{angle:0,pivot:0},surface:{enabled:false}};l.entities.push(surface);
  assert.deepEqual(await snap(l,ref),[]);surface.surface.enabled=true;await snap(l,ref);assert.equal(e.y,303);
  e.y=310;l.entities=[e,{id:'lift',kind:'lift',x:100,y:440,toY:303,width:400,state:'upper'}];await snap(l,ref);assert.equal(e.y,303);
});

test('height-channel placement and endpoint resizing honor a disabled surface snap',()=>{
  const {l}=fixture();l.entities=[];l.platforms.push({x:100,y:220,width:400});
  const ref=addHeightTransport(l,200,310,{snap:false}),e=l.entities[0];assert.equal(e.y,310);assert.equal(e.transport.toY,160);
  e.transport.toY=210;resizeObject(l,ref,'n',0,8,{snap:false});assert.equal(e.transport.toY,218);
});
