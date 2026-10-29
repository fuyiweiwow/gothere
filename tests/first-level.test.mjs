import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {createBlankLevel,createEditorStore,copyObject,pasteObject} from '../src/editor/model.js';
import {createEditorExample} from '../src/editor/starter.js';

const fixture=()=>({...createBlankLevel('support-probe'),world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
  actor:{x:80,y:520,speed:30},goal:{x:1100,y:520},platforms:[{x:0,width:1200,y:520}],
  entities:[{id:'panel',kind:'object',label:'檐面',x:300,y:300,width:160,state:'active',pose:{angle:0,pivot:0},surface:{enabled:true},supportProbe:{at:1},
    behaviors:[{id:'lower',label:'放下',actions:[{type:'rotate',target:'panel',angle:30,ticks:60}]}]},
    {id:'prop',kind:'object',label:'支撑',x:445,y:320,width:30,height:20,state:'active',collider:{enabled:true}},
    {id:'signal',kind:'switch',label:'信号',x:800,y:520,state:'off'}],
  rules:[{on:{type:'click',source:'prop'},actions:[{type:'enable',target:'prop',capability:'collider',enabled:false}]},
    {on:{type:'supportlost',source:'panel'},actions:[{type:'invoke',target:'panel',behavior:'lower'}]},
    {on:{type:'supportfound',source:'panel'},actions:[{type:'set',target:'signal',state:'on'}]}]});

test('a real local support probe releases a hinged surface once, with no body or hidden helper',()=>{
  const level=fixture(),sim=createSimulation(level);sim.start().step(2);
  assert.equal(sim.snapshot().entities.panel.supportState.support,'prop');
  sim.click('prop');sim.step();assert.ok(sim.snapshot().entities.panel.rotation);
  assert.equal(sim.snapshot().entities.panel.pose.angle,0);sim.step(60);
  assert.equal(sim.snapshot().entities.panel.pose.angle,30);
  assert.equal(sim.snapshot().events.filter(e=>e.kind==='supportlost').length,1);
  assert.deepEqual(replayRecording(level,sim.recording()).snapshot(),sim.snapshot());
  sim.reset();assert.equal(sim.snapshot().entities.panel.supportState.support,'prop');
});

test('support probes sample transformed arbitrary ratios, same-height replacements and new supports',()=>{
  for(const at of [0,0.5,1]){
    const l=fixture(),p=l.entities[0];p.supportProbe.at=at;p.pose.pivot=1;p.pose.angle=-20;
    const r=-20*Math.PI/180,x=460+160*(at-1)*Math.cos(r),y=300+160*(at-1)*Math.sin(r);
    Object.assign(l.entities[1],{x:x-10,y:y+20});
    const backup={...structuredClone(l.entities[1]),id:'backup',label:'备用支撑'};l.entities.push(backup);
    const s=createSimulation(l);s.start();s.click('prop');s.step();
    assert.equal(s.snapshot().entities.panel.supportState.support,'backup');assert.equal(s.snapshot().entities.panel.rotation,undefined);
  }
  const l=fixture();l.rules[1].actions=[{type:'set',target:'signal',state:'off'}];
  l.rules.push({on:{type:'click',source:'signal'},actions:[{type:'enable',target:'prop',capability:'collider',enabled:true}]});
  const s=createSimulation(l);s.start();s.click('prop');s.step();s.click('signal');s.step();
  assert.equal(s.snapshot().entities.signal.state,'on');assert.ok(s.snapshot().events.some(e=>e.kind==='supportfound'));
  const unsupported=fixture();unsupported.entities[1].collider.enabled=false;
  const u=createSimulation(unsupported);u.start().step();assert.equal(u.snapshot().entities.panel.rotation,undefined);
});

const fallFixture=()=>({...createBlankLevel('carried-physics'),world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
  actor:{x:300,y:180,speed:45,maxLandingSpeed:220},goal:{x:1100,y:520},platforms:[{x:250,width:100,y:180},{x:0,width:350,y:520},{x:590,width:610,y:520}],
  entities:[{id:'item',kind:'object',label:'缓降物',x:310,y:180,width:30,state:'inactive',carriedPhysics:{gravityScale:0.25,maxFallSpeed:90},
    behaviors:[{id:'open',label:'打开并持有',actions:[{type:'set',target:'item',state:'active'},{type:'hold',target:'item'}]}]},
    {id:'landing',kind:'object',label:'落点',x:350,y:520,width:240,state:'active',pose:{angle:0,pivot:0},surface:{enabled:true}}],
  rules:[{on:{type:'click',source:'item'},actions:[{type:'invoke',target:'item',behavior:'open'}]},
    {on:{type:'actorlanded',source:'landing'},actions:[{type:'turn',direction:-1}]}]});

test('an active held capability limits real falling speed and safe landing emits a receiver event',()=>{
  const l=fallFixture(),s=createSimulation(l);s.start();s.click('item');
  let max=0;for(let i=0;i<400;i++){s.step();max=Math.max(max,s.snapshot().actor.vy);}
  assert.equal(s.snapshot().status,'running');assert.equal(max,90);assert.equal(s.snapshot().actor.direction,-1);
  assert.ok(s.snapshot().events.some(e=>e.kind==='actorlanded'&&e.source==='landing'&&e.speed<=90));
  assert.deepEqual(replayRecording(l,s.recording()).snapshot(),s.snapshot());
  const fail=createSimulation(l);fail.start().step(200);assert.equal(fail.snapshot().reason,'hard-landing');
  assert.equal(fail.snapshot().actor.direction,1,'unsafe landing does not invoke a successful landing reaction');
});

test('dropping or closing the held item restores gravity; a speed cap never reverses a falling actor',()=>{
  for(const action of [{type:'drop'},{type:'set',target:'item',state:'inactive'}]){
    const l=fallFixture();l.rules.push({on:{type:'click',source:'landing'},actions:[action]});
    const s=createSimulation(l);s.start();s.click('item');s.step(100);assert.equal(s.snapshot().actor.vy,90);
    s.click('landing');s.step(80);assert.equal(s.snapshot().reason,'hard-landing');
  }
});

test('new capabilities reject malformed data and survive history and object copies',()=>{
  for(const mutate of [l=>l.entities[0].supportProbe.at=2,l=>l.entities[0].supportProbe.at=NaN,l=>delete l.world.physics]){
    const l=fixture();mutate(l);assert.equal(validateLevel(l).valid,false);
  }
  for(const mutate of [l=>l.entities[0].carriedPhysics.maxFallSpeed=0,l=>l.entities[0].carriedPhysics.gravityScale=2,l=>l.actor.maxLandingSpeed=NaN]){
    const l=fallFixture();mutate(l);assert.equal(validateLevel(l).valid,false);
  }
  const l=fixture(),store=createEditorStore();store.open('support',l);store.change(d=>d.entities[0].supportProbe.at=0.5);
  store.undo();assert.equal(store.document().entities[0].supportProbe.at,1);store.redo();
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  const d=store.document(),ref=pasteObject(d,copyObject(d,{type:'entity',id:'panel'}));
  assert.equal(d.entities.find(e=>e.id===ref.id).supportProbe.at,0.5);
});

test('the full reference graybox exists as editable ordinary objects',()=>{
  const l=createEditorExample('first-level');assert.equal(l.id,'editor-first-level');
  assert.equal(validateLevel(l).valid,true);assert.ok(l.entities.some(e=>e.supportProbe));assert.ok(l.entities.some(e=>e.carriedPhysics));
});
