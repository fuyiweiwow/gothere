import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, replayRecording, validateLevel } from '../src/core/engine.js';
import { createBlankLevel, createEditorStore, deleteObject, copyObject, pasteObject, setPhysicalCapability } from '../src/editor/model.js';
import { createEditorExample } from './fixtures/editor-examples.js';

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

test('falling onto another dynamic body produces the same stack in either declaration order',()=>{
  const results=[];
  for(const reverse of [false,true]){
    const level=fixture();level.actor.speed=15;level.rules=[];
    level.entities=[{...level.entities[1],id:'top',y:489.7},{...structuredClone(level.entities[1]),id:'bottom',y:519.8}];
    if(reverse)level.entities.reverse();const sim=createSimulation(level);sim.start().step(90);const s=sim.snapshot();
    near(s.entities.bottom.y,520);near(s.entities.top.y,490);
    results.push(s.events.map(e=>[e.kind,e.source,e.other,e.tick]));
  }
  assert.deepEqual(results[0],results[1]);
});

test('the falling object example uses ordinary capability and behavior data to pass its creature',()=>{
  const level=createEditorExample('bodies');assert.equal(level.id,'editor-bodies');const sim=createSimulation(level);
  sim.start();sim.click('release');sim.step(3000);assert.equal(sim.snapshot().status,'won');
  const fail=createSimulation(level);fail.start().step(3000);assert.equal(fail.snapshot().reason,'hurt');
});

test('an overhanging upright body follows the contact point of a rotating support, retaining finite coordinates',()=>{
  const level=fixture();level.entities=level.entities.filter(e=>!['shelf','receiver'].includes(e.id));
  const weight=level.entities.find(e=>e.id==='weight');weight.x=250;weight.width=100;weight.y=260+50*Math.tan(75*Math.PI/180);
  level.entities.push({id:'beam',kind:'object',label:'旋转梁',x:200,y:260,width:200,state:'active',pose:{angle:75,pivot:0},surface:{enabled:true}});
  level.rules=[{on:{type:'click',source:'beam'},actions:[{type:'rotate',target:'beam',angle:0,ticks:1}]}];
  const sim=createSimulation(level);sim.start();sim.click('beam');sim.step();const e=sim.snapshot().entities.weight;
  assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));near(e.y,260);assert.equal(e.bodyState.support,'beam');
});

test('support enable actions work for sloped surfaces as well as boxes, without changing active state',()=>{
  const level=fixture();level.entities=level.entities.filter(e=>!['shelf','receiver'].includes(e.id));
  const weight=level.entities.find(e=>e.id==='weight');weight.y=280;
  level.entities.push({id:'beam',kind:'object',label:'梁',x:350,y:280,width:100,state:'inactive',pose:{angle:0,pivot:1},surface:{enabled:true}});
  level.rules=[{on:{type:'click',source:'beam'},actions:[{type:'enable',target:'beam',capability:'surface',enabled:false}]}];
  const sim=createSimulation(level);sim.start();sim.click('beam');sim.step();let s=sim.snapshot();
  assert.equal(s.entities.weight.bodyState.mode,'falling');assert.equal(s.entities.beam.state,'inactive');
  assert.equal(s.events.filter(e=>e.kind==='supportlost').length,1);sim.step(100);near(sim.snapshot().entities.weight.y,520);
});

test('physical capability controls preserve referenced definitions and reject incompatible motion',()=>{
  const level=fixture(),weight=level.entities.find(e=>e.id==='weight'),shelf=level.entities.find(e=>e.id==='shelf');
  assert.throws(()=>setPhysicalCapability(level,weight,'body',false),/引用/);
  assert.throws(()=>setPhysicalCapability(level,weight,'collider',false),/重力/);
  assert.throws(()=>setPhysicalCapability(level,shelf,'collider',false),/引用/);
  const e={id:'new',kind:'object',x:700,y:300,width:40,label:'新物体',state:'active'};level.entities.push(e);
  e.pose={angle:0,pivot:0};assert.throws(()=>setPhysicalCapability(level,e,'body',true),/组合/);delete e.pose;
  e.motion={type:'patrol',minX:600,maxX:800,speed:30};assert.throws(()=>setPhysicalCapability(level,e,'body',true),/巡逻/);delete e.motion;
  setPhysicalCapability(level,e,'body',true);assert.equal(e.height,36);assert.equal(e.collider.enabled,true);
  setPhysicalCapability(level,e,'body',false);setPhysicalCapability(level,e,'collider',false);assert.equal(e.collider,undefined);
});

test('standing on a collider top counts as contact and respects ordinary contact effects',()=>{
  const level=fixture();level.actor={x:385,y:230,speed:15};level.entities.find(e=>e.id==='weight').contact={effect:'lethal'};
  const sim=createSimulation(level);sim.start().step();assert.equal(sim.snapshot().reason,'hurt');
});
