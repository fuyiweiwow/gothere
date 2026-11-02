import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLevel,replayRecording} from '../src/core/engine.js';
import {runPlan} from '../src/experiments/play-plan.js';
import {createEditorStore} from '../src/editor/model.js';
import {artTransform} from '../src/render/resources.js';

const build=async()=>{const {buildPeachDelivery}=await import('../src/experiments/peach-delivery.js');return buildPeachDelivery();};

test('mountain peach delivery is a fresh editable DSL document with a real carried parcel',async()=>{
  const entry=await build(),before=structuredClone(entry);
  assert.equal(validateLevel(entry.level).valid,true,validateLevel(entry.level).errors.join('\n'));
  const store=createEditorStore();store.open('peach',entry.level);
  assert.deepEqual(createEditorStore(store.serialize()).document(),entry.level);
  assert.equal(entry.display,'scene');assert.ok(new Set(entry.level.scene.nodes.map(n=>n.asset)).size>10);
  assert.ok(entry.level.scene.nodes.length>35,'a layered scene, not a flattened backdrop');
  entry.level.entities[0].x+=10;assert.deepEqual(await build(),before);
});

test('delivery crosses real fan support, glides with its parcel, rides a real cloud and drops peaches before arrival',async()=>{
  const entry=await build(),result=runPlan(entry.level,entry.plan);
  assert.equal(result.status,'won',result.reason);
  assert.ok(result.trace.some(s=>s.actor.support==='borrowed-fan'));
  assert.ok(result.trace.some(s=>s.actor.holding==='peach-satchel'&&s.actor.mode==='falling'&&s.actor.y>340&&s.actor.vy<=90));
  assert.ok(result.trace.some(s=>s.actor.connector==='cloud-car'&&s.actor.mode==='riding'&&s.actor.y>300&&s.actor.y<430));
  assert.equal(result.trace.at(-1).actor.holding,null,'the parcel is actually set down');
  const snapshot=replayRecording(entry.level,result.recording).snapshot();assert.equal(snapshot.status,'won');
  assert.equal(snapshot.entities['sleeping-immortal'].state,'active');
  assert.equal(snapshot.entities['delivery-gate'].state,'open');
  assert.equal(snapshot.entities['peach-satchel'].y,260);
  assert.ok(snapshot.signals.some(s=>s.type==='behavior'&&s.source==='sleeping-immortal'&&s.behavior==='receive'));
});

test('missing preparation, prematurely exhausted magic and a missed jump fail in the ordinary simulation',async()=>{
  const entry=await build();
  for(const plan of [[],entry.plan.slice(0,1),entry.plan.slice(1),entry.plan.map((p,i)=>({...p,tick:i?100:p.tick})),
    entry.plan.map((p,i)=>({...p,tick:i?800:p.tick}))])assert.equal(runPlan(entry.level,plan).status,'lost');
  const narrow=structuredClone(entry.level);narrow.entities.find(e=>e.id==='borrowed-fan').width=150;
  assert.equal(runPlan(narrow,entry.plan).status,'lost');
  const heavy=structuredClone(entry.level);delete heavy.entities.find(e=>e.id==='peach-satchel').carriedPhysics;
  assert.equal(runPlan(heavy,entry.plan).status,'lost');
});

test('the delivery gate requires an actual parcel; accepting it uses ordinary rules and supports broad input samples',async()=>{
  const entry=await build();
  for(const offset of [-24,24])for(let i=0;i<entry.plan.length;i++){
    const plan=entry.plan.map((p,j)=>({...p,tick:p.tick+(i===j?offset:0)}));
    assert.equal(runPlan(entry.level,plan).status,'won');
  }
  const empty=structuredClone(entry.level);
  empty.rules.find(r=>r.on.source==='delivery-zone').if=[{holding:null}];
  assert.equal(runPlan(empty,entry.plan).status,'lost','arrival alone cannot fake a signed delivery');
});

test('removing presentation keeps the same simulation, recording and ending',async()=>{
  const entry=await build(),logic=structuredClone(entry.level);delete logic.scene;
  assert.deepEqual(runPlan(logic,entry.plan),runPlan(entry.level,entry.plan));
});

test('the delivery requirement is visible in the scene and clears after actual handover',async()=>{
  const {level}=await build(),gate=level.scene.nodes.find(n=>n.bind?.id==='delivery-gate');
  assert.ok(gate,'a path-blocking gate must have a visible authored counterpart');
  assert.notEqual(artTransform(gate,level).visible,false);
  const opened=structuredClone(level);opened.entities.find(e=>e.id==='delivery-gate').state='open';
  assert.equal(artTransform(gate,opened).visible,false);
});

test('art bound to a moving lift follows its actual car rather than the original floor',()=>{
  const level={entities:[{id:'car',kind:'lift',x:500,y:470,toY:260,width:80,state:'lower'}]};
  const node={id:'cloud',asset:'cloud',x:-12,y:-10,width:100,height:35,layer:0,bind:{type:'entity',id:'car'}};
  assert.equal(artTransform(node,level).y,460);
  const snapshot={entities:{car:{...level.entities[0],carY:330}},tick:60};
  assert.equal(artTransform(node,level,snapshot).y,320);
  level.entities[0].state='upper';assert.equal(artTransform(node,level).y,250);
  assert.equal(level.entities[0].y,470,'read-only presentation');
});
