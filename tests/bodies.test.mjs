import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, replayRecording, validateLevel } from '../src/core/engine.js';
import { createBlankLevel, createEditorStore, deleteObject, copyObject, pasteObject } from '../src/editor/model.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const fixture=()=>({...createBlankLevel('body-test'),
  world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
  actor:{x:80,y:520,speed:60},goal:{x:1100,y:520},platforms:[{x:0,width:1200,y:520}],
  entities:[{id:'shelf',kind:'object',label:'支撑物',x:350,y:280,width:100,height:20,state:'active',collider:{enabled:true},
    behaviors:[{id:'remove',label:'撤去支撑',actions:[{type:'enable',target:'shelf',capability:'collider',enabled:false}]}]},
    {id:'weight',kind:'object',label:'落物',x:380,y:260,width:30,height:30,state:'active',collider:{enabled:true},body:{type:'dynamic'}},
    {id:'receiver',kind:'object',label:'接收物',x:360,y:520,width:80,height:60,state:'active',collider:{enabled:true},
      behaviors:[{id:'rest',label:'休息',actions:[{type:'set',target:'receiver',state:'inactive'}]}]},
    {id:'lamp',kind:'switch',label:'支撑灯',x:900,y:520,state:'off'}],
  rules:[{on:{type:'click',source:'shelf'},actions:[{type:'invoke',target:'shelf',behavior:'remove'}]},
    {on:{type:'supportlost',source:'weight'},actions:[{type:'set',target:'lamp',state:'on'}]},
    {on:{type:'impact',source:'receiver',other:'weight'},actions:[{type:'invoke',target:'receiver',behavior:'rest'}]}]});

test('removing a collider automatically drops the supported object, emits loss/landing/impact and replays exactly',()=>{
  const level=fixture(),original=structuredClone(level),sim=createSimulation(level),initial=sim.snapshot();
  assert.equal(initial.entities.weight.bodyState.support,'shelf');sim.start().step(20);
  near(sim.snapshot().entities.weight.y,260);sim.click('shelf');sim.step();let s=sim.snapshot();
  assert.ok(s.entities.weight.y>260);assert.equal(s.entities.weight.bodyState.mode,'falling');assert.equal(s.entities.lamp.state,'on');
  sim.step(120);s=sim.snapshot();near(s.entities.weight.y,460);assert.equal(s.entities.weight.bodyState.support,'receiver');
  assert.equal(s.entities.receiver.state,'inactive');assert.equal(s.entities.receiver.collider.enabled,true);
  for(const kind of ['supportlost','landed','impact'])assert.equal(s.events.filter(e=>e.kind===kind).length,1);
  assert.deepEqual(replayRecording(level,sim.recording()).snapshot(),s);assert.deepEqual(level,original);
  sim.reset();assert.deepEqual(sim.snapshot(),initial);
});

test('gravity is independent of active state, pauses with simulation and is bounded at terminal speed',()=>{
  const level=fixture();level.entities[1].state='inactive';level.world.physics={gravity:3600,maxFallSpeed:180};
  const sim=createSimulation(level);sim.start();sim.click('shelf');sim.step(10);sim.pause();const paused=sim.snapshot();sim.step(50);
  assert.deepEqual(sim.snapshot(),paused);sim.start();let y=paused.entities.weight.y;
  for(let n=0;n<100;n++){sim.step();const e=sim.snapshot().entities.weight;assert.ok(e.y-y<=3+1e-7);assert.ok(e.bodyState.vy<=180);y=e.y;}
  near(y,460);
});

test('stack support resolves bottom first independent of entity declaration order, carrying upper objects',()=>{
  for(const reverse of [false,true]){
    const level=fixture();level.entities=level.entities.filter(e=>e.id!=='receiver');
    level.entities.push({id:'upper',kind:'object',label:'上层物体',x:385,y:230,width:20,height:20,state:'active',collider:{enabled:true},body:{type:'dynamic'}});
    level.rules=level.rules.filter(r=>r.on.type!=='impact');if(reverse)level.entities.reverse();
    const sim=createSimulation(level);sim.start();sim.click('shelf');sim.step(5);let s=sim.snapshot();
    near(s.entities.upper.y,s.entities.weight.y-30);assert.equal(s.entities.upper.bodyState.support,'weight');
    sim.step(100);s=sim.snapshot();near(s.entities.weight.y,520);near(s.entities.upper.y,490);
  }
});

test('finite footprint rests on a narrow edge or a slope without snapping to a lower overlapping floor',()=>{
  const level=fixture();level.entities=level.entities.filter(e=>!['shelf','receiver'].includes(e.id));level.rules=[];
  level.platforms.push({x:409,width:1,y:340},{x:350,width:100,y:380,yEnd:430});
  const sim=createSimulation(level);sim.start().step(80);near(sim.snapshot().entities.weight.y,340);
  level.platforms.splice(1,1);const slope=createSimulation(level);slope.start().step(100);near(slope.snapshot().entities.weight.y,395);
});

test('impact filtering selects the actual falling object and does not repeatedly fire for a resting object',()=>{
  const level=fixture();level.entities.push({...structuredClone(level.entities[1]),id:'other',x:700});
  level.rules[2].on.other='other';const sim=createSimulation(level);sim.start();sim.click('shelf');sim.step(120);
  assert.equal(sim.snapshot().entities.receiver.state,'active');assert.equal(sim.snapshot().events.filter(e=>e.kind==='impact').length,1);
});

test('a held dynamic object suspends gravity and collision; dropping resumes normal support evaluation',()=>{
  const level=fixture();level.actor.x=190;level.entities[1].x=210;level.entities[1].y=520;
  level.rules[0].actions=[{type:'hold',target:'weight'}];level.rules[1]={on:{type:'click',source:'lamp'},actions:[{type:'drop'}]};
  const sim=createSimulation(level);sim.start();sim.click('shelf');sim.step(20);let s=sim.snapshot();
  assert.equal(s.actor.holding,'weight');assert.equal(s.entities.weight.bodyState.mode,'held');near(s.entities.weight.y,s.actor.y);
  sim.click('lamp');sim.step();s=sim.snapshot();assert.equal(s.actor.holding,null);assert.equal(s.entities.weight.bodyState.mode,'supported');near(s.entities.weight.y,520);
});

test('the walker rides a dynamic collider top and both descend after support disappears',()=>{
  const level=fixture();level.actor={x:385,y:230,speed:15};level.rules[0].actions.push({type:'turn',direction:1});
  const sim=createSimulation(level);sim.start();sim.click('shelf');sim.step(10);const s=sim.snapshot();
  assert.equal(s.actor.support,'weight');near(s.actor.y,s.entities.weight.y-30);assert.ok(s.actor.y>230);
});

test('disabled colliders let bodies fall through; missed bodies settle outside without affecting the run',()=>{
  const level=fixture();level.platforms=[{x:0,width:200,y:520},{x:1000,width:200,y:520}];level.actor.speed=15;
  level.entities[2].collider.enabled=false;level.rules=level.rules.filter(r=>r.on.type!=='impact');
  const sim=createSimulation(level);sim.start();sim.click('shelf');sim.step(150);
  assert.equal(sim.snapshot().entities.weight.bodyState.mode,'outside');assert.equal(sim.snapshot().status,'running');
});

test('body/collider/action/filter validation rejects missing capabilities and unsupported combinations',()=>{
  assert.equal(validateLevel(fixture()).valid,true);
  for(const mutate of [l=>delete l.world.physics,l=>l.entities[1].body.type='rigid',l=>l.entities[1].collider.enabled='yes',
    l=>delete l.entities[1].collider,l=>l.entities[1].pose={angle:0,pivot:0},l=>l.entities[1].motion={type:'patrol',minX:300,maxX:500,speed:50},
    l=>l.rules[0].actions=[{type:'enable',target:'lamp',capability:'collider',enabled:false}],
    l=>l.rules[0].actions=[{type:'enable',target:'shelf',capability:'appearance',enabled:false}],
    l=>l.rules[2].on.other='missing']){
    const level=fixture();mutate(level);assert.equal(validateLevel(level).valid,false);assert.throws(()=>createSimulation(level));
  }
});

test('new capability data survives history/clipboard and deletion removes filtered event references',()=>{
  const level=fixture(),store=createEditorStore();store.open('bodies',level);store.change(d=>delete d.world.physics);
  assert.equal(validateLevel(store.document()).valid,false);store.undo();
  const d=store.document(),ref=pasteObject(d,copyObject(d,{type:'entity',id:'weight'}));assert.deepEqual(d.entities.find(e=>e.id===ref.id).body,{type:'dynamic'});
  deleteObject(d,{type:'entity',id:'weight'});assert.equal(d.rules.some(r=>r.on.other==='weight'),false);
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
});
