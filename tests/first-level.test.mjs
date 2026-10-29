import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {createBlankLevel,createEditorStore,copyObject,pasteObject,setSupportProbe,setPhysicalCapability} from '../src/editor/model.js';
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

test('reactivating a held fall limiter during a fast fall clamps velocity without moving upward',()=>{
  const l=fallFixture();l.rules.push({on:{type:'click',source:'landing'},actions:[{type:'set',target:'item',state:'inactive'}]});
  const s=createSimulation(l);s.start();s.click('item');s.step(100);s.click('landing');s.step(12);
  const before=s.snapshot().actor;assert.ok(before.vy>90);s.click('item');s.step();
  assert.equal(s.snapshot().actor.vy,90);assert.ok(s.snapshot().actor.y>before.y);
});

test('held probes suspend detection and resume without a false loss on dropping',()=>{
  const l=fixture();l.actor={x:295,y:300,speed:15};l.platforms.push({x:0,y:300,width:300});
  l.rules.push({on:{type:'click',source:'panel'},actions:[{type:'hold',target:'panel'}]},
    {on:{type:'click',source:'signal'},actions:[{type:'drop'}]});
  const s=createSimulation(l);s.start();s.click('panel');s.step(3);assert.equal(s.snapshot().entities.panel.supportState.mode,'held');
  s.click('signal');s.step();assert.equal(s.snapshot().entities.panel.supportState.mode,'supported');
  assert.equal(s.snapshot().events.some(e=>e.kind==='supportlost'),false);
});

test('capability editing protects support event references and rejects duplicate support models',()=>{
  const l=fixture(),e=l.entities[0];assert.throws(()=>setSupportProbe(l,e,false),/连线/);
  l.rules=l.rules.filter(r=>r.on.source!==e.id);setSupportProbe(l,e,false);assert.equal(e.supportProbe,undefined);
  setSupportProbe(l,e,true);delete e.pose;delete e.surface;
  assert.throws(()=>setPhysicalCapability(l,e,'body',true),/支撑检测/);
  delete e.supportProbe;setPhysicalCapability(l,e,'body',true);assert.throws(()=>setSupportProbe(l,e,true),/动态/);
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

test('first-level route wins through every real mechanic, replays, resets, and each missing intervention fails',()=>{
  const level=createEditorExample('first-level'),original=structuredClone(level),inputs=['cloud','antenna','umbrella','prop','pot'];
  const run=(l,omit)=>{const s=createSimulation(l),kinds=new Set(),schedule={540:'cloud',750:'antenna',1050:'umbrella',1250:'prop',1650:'pot'};s.start();
    for(let i=0;i<4500&&s.snapshot().status==='running';i++){if(schedule[i]!==omit&&schedule[i])s.click(schedule[i]);s.step();for(const e of s.snapshot().events)kinds.add(e.kind);}
    return {s,kinds};};
  const {s,kinds}=run(level);assert.equal(s.snapshot().status,'won',JSON.stringify(s.snapshot()));
  for(const kind of ['rotated','supportlost','actorlanded','landed','impact'])assert.ok(kinds.has(kind),kind);
  assert.deepEqual(replayRecording(level,s.recording()).snapshot(),s.snapshot());assert.deepEqual(level,original);
  s.reset();assert.equal(s.snapshot().actor.direction,-1);assert.equal(s.snapshot().entities.creature.state,'active');
  for(const omitted of inputs){const result=run(level,omitted).s.snapshot();assert.equal(result.status,'lost','missing '+omitted);}
  const shifted=structuredClone(level);shifted.entities.find(e=>e.id==='pot').x+=120;
  assert.equal(run(shifted).s.snapshot().reason,'hurt','a misplaced pot must not silence the creature by script');
});

test('early activations restore, late interventions miss, and edited lifetimes change the playable window',()=>{
  const level=createEditorExample('first-level'),normal={cloud:540,antenna:750,umbrella:1050,prop:1250,pot:1650};
  const run=times=>{const s=createSimulation(level);s.start();for(let t=0;t<3000&&s.snapshot().status==='running';t++){for(const [id,when] of Object.entries(times))if(t===when)s.click(id);s.step();}return s;};
  for(const id of ['cloud','antenna','umbrella','pot'])assert.equal(run({...normal,[id]:0}).snapshot().status,'lost','too early: '+id);
  for(const [id,late] of [['cloud',750],['antenna',1000],['umbrella',1300],['prop',2000],['pot',2100]])assert.equal(run({...normal,[id]:late}).snapshot().status,'lost','too late: '+id);
  const s=createSimulation(level);s.start();s.click('cloud');s.click('antenna');s.click('umbrella');s.step(500);
  assert.equal(s.snapshot().entities.cloud.state,'inactive');assert.equal(s.snapshot().entities.cloud.surface.enabled,false);
  assert.equal(s.snapshot().entities.antenna.pose.angle,0);assert.equal(s.snapshot().entities.umbrella.state,'inactive');
  s.reset().start();s.click('cloud');s.step(200);s.click('cloud');s.step(101);
  assert.equal(s.snapshot().entities.cloud.state,'inactive','repeated clicks cannot stack the active lifetime');
  const cloud=level.entities.find(e=>e.id==='cloud');cloud.behaviors[0].actions.find(a=>a.type==='after').ticks=1200;
  assert.equal(run({...normal,cloud:0}).snapshot().status,'won','the time window is authored data');
});
