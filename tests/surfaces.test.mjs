import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, replayRecording, validateLevel } from '../src/core/engine.js';
import { createBlankLevel, createEditorStore, moveObject, resizeObject, copyObject, pasteObject, snapTransport } from '../src/editor/model.js';
import { createEditorExample } from './fixtures/editor-examples.js';
import { landingX } from '../src/core/transport.js';

const fixture = () => ({ ...createBlankLevel('surface-test'),
  world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
  actor:{x:80,y:240,speed:120},goal:{x:1100,y:520},
  platforms:[{x:0,width:200,y:240},{x:200,width:240,y:240,yEnd:400},
    {x:440,width:100,y:400},{x:580,width:620,y:520}],entities:[],rules:[] });

test('walker follows an actual incline and falls to the next road; replay and reset are exact',()=>{
  const level=fixture(),before=structuredClone(level),sim=createSimulation(level),initial=sim.snapshot();
  sim.start().step(120);assert.equal(sim.snapshot().actor.x,320);assert.equal(sim.snapshot().actor.y,320);
  assert.equal(sim.snapshot().actor.mode,'walking');
  sim.step(113);assert.equal(sim.snapshot().actor.mode,'falling');assert.ok(sim.snapshot().actor.y>400);
  sim.step(1000);assert.equal(sim.snapshot().status,'won');assert.equal(sim.snapshot().actor.y,520);
  assert.ok(sim.snapshot().events.some(e=>e.kind==='land'));
  assert.deepEqual(replayRecording(level,sim.recording()).snapshot(),sim.snapshot());
  assert.deepEqual(level,before);sim.reset();assert.deepEqual(sim.snapshot(),initial);
});

test('the same incline can be walked uphill from right to left across exact seams',()=>{
  const level=fixture();level.actor={x:520,y:400,direction:-1,speed:120};level.goal={x:80,y:240};
  const sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().status,'won');
  assert.equal(sim.snapshot().actor.x,80);assert.equal(sim.snapshot().actor.y,240);
});

test('a goal on an incline uses its sampled height and does not require an exactly divisible step',()=>{
  const level=fixture();level.goal={x:321,y:240+121*160/240};
  assert.equal(validateLevel(level).valid,true);
  const sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().status,'won');
  assert.equal(sim.snapshot().actor.x,321);assert.equal(sim.snapshot().actor.y,level.goal.y);
});

test('falling sweeps a narrow landing between horizontal tick endpoints instead of tunnelling',()=>{
  const level=fixture();level.world.physics={gravity:3600,maxFallSpeed:1800};level.actor.speed=180;
  level.platforms=[{x:0,width:200,y:240},{x:253.2,width:1,y:400}];level.goal={x:253.8,y:400};
  const sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().status,'won');
  assert.equal(sim.snapshot().actor.x,253.8);assert.equal(sim.snapshot().actor.y,400);
});

test('landing exactly on the goal at a road endpoint completes before leaving the edge',()=>{
  const level=fixture();level.world.physics={gravity:1280,maxFallSpeed:1800};
  level.platforms=[{x:0,width:200,y:240},{x:259,width:1,y:400}];level.goal={x:260,y:400};
  const sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().status,'won');
  assert.equal(sim.snapshot().actor.x,260);assert.equal(sim.snapshot().actor.y,400);
});

test('a small gap is support loss, while a road above the feet cannot pull the walker upward',()=>{
  const gap=fixture();gap.platforms=[{x:0,width:200,y:240},{x:201,width:999,y:240}];gap.goal={x:1100,y:240};
  const missed=createSimulation(gap);missed.start().step(1000);assert.equal(missed.snapshot().status,'lost');
  assert.equal(missed.snapshot().reason,'boundary');
  const under=fixture();under.actor={x:80,y:520,speed:120};under.platforms=[{x:0,width:1200,y:520},{x:100,width:300,y:240}];
  const safe=createSimulation(under);safe.start().step(1000);assert.equal(safe.snapshot().status,'won');
  assert.equal(safe.snapshot().actor.y,520);
});

test('overlapping floors preserve the current height; crossing slopes preserve the chosen support',()=>{
  const level=fixture();level.platforms.unshift({x:0,width:1200,y:520});
  level.platforms.push({x:200,width:240,y:400,yEnd:240});
  const sim=createSimulation(level);sim.start().step(121);assert.equal(sim.snapshot().actor.y,321.3333333333333);
  sim.step(1000);assert.equal(sim.snapshot().status,'won');
});

test('terminal fall speed is bounded and missing ground remains a visible fall before boundary failure',()=>{
  const level=fixture();level.world.physics={gravity:3600,maxFallSpeed:180};
  level.platforms=[{x:0,width:200,y:240},{x:1000,width:200,y:520}];
  const sim=createSimulation(level);sim.start().step(70);let last=sim.snapshot();
  assert.equal(last.actor.mode,'falling');assert.equal(last.status,'running');
  for(let i=0;i<200&&sim.snapshot().status==='running';i++){
    sim.step();const next=sim.snapshot();assert.ok(next.actor.y-last.actor.y<=3.000001);last=next;
  }
  assert.equal(last.status,'lost');assert.equal(last.reason,'boundary');
});

test('bridge removed under the walker loses support, including removal from a contact rule',()=>{
  for(const click of [true,false]){
    const level=fixture();level.actor={x:320,y:300,speed:120};level.goal={x:1100,y:520};
    level.platforms=[{x:0,width:250,y:300},{x:0,width:1200,y:520}];
    level.entities=[{id:'bridge',kind:'bridge',x:250,y:300,width:200,state:'extended',label:'承托桥'},
      {id:'cut',kind:'object',x:325,y:300,width:20,state:'active',label:'移除支撑'}];
    // Start and goal validation intentionally requires authored roads.
    level.platforms.push({x:315,width:1,y:300});level.actor.x=315;
    level.rules=[{on:{type:click?'click':'contact',source:'cut'},actions:[{type:'set',target:'bridge',state:'folded'}]}];
    const sim=createSimulation(level);sim.start().step(3);if(click)sim.click('cut');sim.step();
    assert.equal(sim.snapshot().actor.mode,'falling');
    sim.step(1000);assert.equal(sim.snapshot().status,'won');
  }
});

test('swept contact on a slope triggers its rule without touching a different floor',()=>{
  const level=fixture();level.entities=[{id:'touch',kind:'object',x:315,y:320,width:10,state:'active',label:'坡上感应'},
    {id:'overhead',kind:'object',x:315,y:240,width:10,state:'active',label:'另一层',contact:{effect:'lethal'}}];
  level.rules=[{on:{type:'contact',source:'touch'},actions:[{type:'hurt',message:'坡上接触已触发'}]}];
  const sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().reason,'hurt');
  assert.equal(sim.snapshot().events.at(-1).message,'坡上接触已触发');
});

test('gravity maps still support explicit vertical travel and lift boarding',()=>{
  for(const example of ['floors','creature']){
    const level=createEditorExample(example);level.world.physics={gravity:900,maxFallSpeed:480};
    const sim=createSimulation(level);sim.start();sim.click(example==='floors'?'call':'stop');sim.step(3000);
    assert.equal(sim.snapshot().status,'won',example);
  }
});

test('slope and physics data reject malformed values and slope imports need the new movement mode',()=>{
  for(const mutate of [l=>l.world.physics=null,l=>l.world.physics.gravity=-1,l=>l.world.physics.maxFallSpeed=Infinity,
    l=>l.world.physics={gravity:900},l=>l.platforms[1].yEnd='down',l=>l.platforms[1].yEnd=NaN,
    l=>l.platforms[1].yEnd=640,l=>delete l.world.physics]){
    const level=fixture();mutate(level);assert.equal(validateLevel(level).valid,false);
    assert.throws(()=>createSimulation(level));
  }
  const misplaced=fixture();misplaced.actor={x:320,y:240,speed:120};assert.equal(validateLevel(misplaced).valid,false);
});

test('slope endpoints resize independently, move as a pair, survive clipboard/history and reload',()=>{
  const level=fixture(),ref={type:'platform',index:1},store=createEditorStore();store.open('slope',level);
  store.change(d=>resizeObject(d,ref,'e',30,40));let p=store.document().platforms[1];
  assert.equal(p.width,270);assert.equal(p.y,240);assert.equal(p.yEnd,440);
  store.change(d=>resizeObject(d,ref,'w',-20,-20));p=store.document().platforms[1];
  assert.equal(p.x,180);assert.equal(p.width,290);assert.equal(p.y,220);assert.equal(p.yEnd,440);
  store.change(d=>moveObject(d,ref,10,150));p=store.document().platforms[1];
  assert.equal(p.y,340);assert.equal(p.yEnd,560);assert.equal(p.x,190);
  store.undo();assert.equal(store.document().platforms[1].y,220);store.redo();
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  const copied=store.document(),pasted=pasteObject(copied,copyObject(copied,ref));
  assert.equal(copied.platforms[pasted.index].yEnd,560);
  assert.throws(()=>store.change(d=>{d.platforms[1].yEnd=NaN;}));
});

test('a closed gate on a slope catches the swept foot path even between tick heights',()=>{
  const level=fixture();level.entities=[{id:'door',kind:'gate',x:321,y:240+121*160/240,width:20,state:'closed',label:'坡上门'}];
  const sim=createSimulation(level);sim.start().step(1000);assert.equal(sim.snapshot().reason,'gate');
});

test('height channels connect to sampled incline heights rather than the road left endpoint',()=>{
  const level=fixture(),channel={id:'channel',kind:'object',x:310,y:520,width:60,state:'active',label:'通道',
    transport:{type:'vertical',toY:320,speed:90}};
  level.platforms[3]={x:0,width:1200,y:520};
  level.entities.push(channel);assert.equal(landingX(level,channel,320),320);
  assert.equal(validateLevel(level).valid,true);
  channel.transport.toY=330;snapTransport(level,channel,['upper']);assert.equal(channel.transport.toY,240+140*160/240);
  assert.equal(landingX(level,channel,channel.transport.toY),340);
});

test('new editor example exposes a complete art-free slope and falling route',()=>{
  const level=createEditorExample('slopes');assert.equal(level.id,'editor-slopes');
  assert.ok(level.world.physics);assert.ok(level.platforms.some(p=>p.yEnd!==undefined));
  const sim=createSimulation(level);sim.start().step(3000);assert.equal(sim.snapshot().status,'won');
});
