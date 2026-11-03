import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLevel,replayRecording} from '../src/core/engine.js';
import {runPlan} from '../src/experiments/play-plan.js';
import {createEditorStore} from '../src/editor/model.js';
import {ASSETS} from '../src/content/library.js';

const build=async()=>{const {buildCommute}=await import('../src/experiments/commute.js');return buildCommute();};

test('commute is an editable layered street rather than a replacement default or flattened backdrop',async()=>{
  const entry=await build(),before=structuredClone(entry),v=validateLevel(entry.level);
  assert.equal(v.valid,true,v.errors.join('\n'));assert.equal(entry.display,'scene');assert.equal(entry.playView,'clean');
  assert.ok(new Set(entry.level.platforms.map(p=>p.y)).size>=4);assert.ok(entry.level.scene.nodes.length>=100);
  const store=createEditorStore();store.open(entry.id,entry.level);assert.deepEqual(createEditorStore(store.serialize()).document(),entry.level);
  entry.level.entities[0].x+=1;assert.deepEqual(await build(),before);
});

test('commute really rides the bus, loops below the same street, takes the lift and reaches work with a badge',async()=>{
  const e=await build(),r=runPlan(e.level,e.plan);assert.equal(r.status,'won',r.reason);
  assert.ok(r.trace.some(s=>s.actor.support==='bus'&&s.actor.x>700&&s.actor.y===280));
  assert.ok(r.trace.some(s=>s.actor.y===540&&s.actor.direction===-1&&s.actor.x<800));
  assert.ok(r.trace.some(s=>s.actor.connector==='service-lift'&&s.actor.y<500&&s.actor.y>240));
  assert.ok(r.trace.some(s=>s.actor.y===200&&s.actor.direction===1&&s.actor.x>800));
  const end=replayRecording(e.level,r.recording).snapshot();assert.equal(end.entities.turnstile.state,'open');
  assert.equal(end.actor.holding,'badge');assert.equal(end.entities['office-reader'].state,'active');
  assert.equal(end.entities['traffic-light'].state,'inactive');assert.equal(end.entities.sedan.x,780);
  assert.equal(end.entities.bus.x,660);assert.ok(end.entities['late-commuter'].x>500);
});

test('ordinary geometric failures remain when a necessary intervention is omitted or a bridge cannot reach',async()=>{
  const e=await build();assert.equal(runPlan(e.level,[]).status,'lost');
  for(let i=0;i<e.plan.length;i++)assert.equal(runPlan(e.level,e.plan.filter((_,j)=>i!==j)).status,'lost','missing '+e.plan[i].source);
  const short=structuredClone(e.level);short.entities.find(o=>o.id==='trench-cover').width=80;
  assert.equal(runPlan(short,e.plan).status,'lost');
});

test('the authored route tolerates visible timing variation and is identical with art removed',async()=>{
  const e=await build();
  for(let i=0;i<e.plan.length;i++)for(const offset of [-24,24]){
    const p=e.plan.map((a,j)=>({...a,tick:a.tick+(i===j?offset:0)}));assert.equal(runPlan(e.level,p).status,'won',p[i].source+' '+offset);
  }
  const logic=structuredClone(e.level);delete logic.scene;assert.deepEqual(runPlan(logic,e.plan),runPlan(e.level,e.plan));
});

test('scene storytelling uses no text artwork and preserves open licensed modular assets',async()=>{
  const {level}=await build(),used=new Set(level.scene.nodes.map(n=>n.asset));
  assert.ok(ASSETS.filter(a=>used.has(a.id)&&a.source.startsWith('kenney')).length>=5);
  for(const a of ASSETS.filter(a=>used.has(a.id))){
    assert.equal(a.license,'CC0-1.0');
    if(a.src.startsWith('data:image/svg+xml'))assert.doesNotMatch(Buffer.from(a.src.split(',')[1],'base64').toString('utf8'),/<text\b|<foreignObject|<script/i,a.id);
  }
});
