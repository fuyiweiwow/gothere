import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLevel,replayRecording} from '../src/core/engine.js';
import {createEditorStore} from '../src/editor/model.js';

const experiments=()=>import('../src/experiments/levels.js');
const runner=()=>import('../src/experiments/play-plan.js');
async function setup(id){
  const {buildExperiments}=await experiments(),{runPlan}=await runner();
  return {entry:buildExperiments().find(e=>e.id===id),runPlan};
}

test('three mechanism experiments are ordinary editable DSL and each build is independent',async()=>{
  const {buildExperiments}=await experiments(),entries=buildExperiments(),before=structuredClone(entries);
  assert.equal(entries.length,3);assert.equal(entries[0].id,'return-route');
  for(const e of entries){
    assert.equal(validateLevel(e.level).valid,true,validateLevel(e.level).errors.join('\n'));
    const store=createEditorStore();store.open(e.id,e.level);
    assert.deepEqual(createEditorStore(store.serialize()).document(),e.level);
    assert.equal(e.level.scene,undefined,'grayboxes do not depend on art');
  }
  entries[0].level.entities[0].x+=10;
  assert.deepEqual(buildExperiments(),before,'editing one copy must not alter the catalog');
});

test('all experiment plans win in the real simulation and replay without changing level data',async()=>{
  const {buildExperiments}=await experiments(),{runPlan}=await runner();
  for(const e of buildExperiments()){
    const before=structuredClone(e),result=runPlan(e.level,e.plan);
    assert.equal(result.status,'won',e.id+': '+result.reason);
    assert.equal(replayRecording(e.level,result.recording).snapshot().status,'won');
    assert.equal(result.recording.inputs.length,e.plan.length);assert.deepEqual(e,before);
  }
});

test('the return route really uses the same beam on two different floors and directions',async()=>{
  const {entry,runPlan}=await setup('return-route'),result=runPlan(entry.level,entry.plan);
  const crossing=result.trace.filter(s=>s.actor.support==='return-beam');
  assert.ok(crossing.some(s=>s.actor.direction===1&&Math.abs(s.actor.y-260)<0.01&&s.actor.x>220));
  assert.ok(crossing.some(s=>s.actor.direction===-1&&s.actor.y>290&&s.actor.y<400));
  assert.ok(result.trace.some(s=>s.actor.mode==='climbing'&&s.actor.y>280&&s.actor.y<390),'explicit descent, not teleport');
  assert.equal(result.trace.at(-1).actor.x,entry.level.goal.x);
});

test('an unprepared return, no input or a too-early change fails for actual geometric reasons',async()=>{
  const {entry,runPlan}=await setup('return-route');
  assert.equal(runPlan(entry.level,entry.plan.slice(0,1)).status,'lost');
  assert.equal(runPlan(entry.level,[]).status,'lost');
  const early=entry.plan.map((p,i)=>({...p,tick:i?80:p.tick}));
  assert.equal(runPlan(entry.level,early).status,'lost');
  const moved=structuredClone(entry.level);moved.entities.find(e=>e.id==='return-beam').width=210;
  assert.equal(runPlan(moved,entry.plan).status,'lost','a shorter beam cannot reach the outbound floor');
});

test('the symmetric lower-outbound route is a legitimate alternative, not rejected for skipping a planned click',async()=>{
  const {entry,runPlan}=await setup('return-route'),result=runPlan(entry.level,entry.plan.slice(1));
  assert.equal(result.status,'won');
  const crossing=result.trace.filter(s=>s.actor.support==='return-beam');
  assert.ok(crossing.some(s=>s.actor.direction===1&&s.actor.y>300));
  assert.ok(crossing.some(s=>s.actor.direction===-1&&s.actor.y===260));
});

test('return puzzle has a broad useful timing range instead of one exact answer frame',async()=>{
  const {entry,runPlan}=await setup('return-route');
  for(const offset of [-24,24])for(let i=0;i<entry.plan.length;i++){
    const plan=entry.plan.map((p,j)=>({...p,tick:p.tick+(i===j?offset:0)}));
    assert.equal(runPlan(entry.level,plan).status,'won');
  }
});

test('handoff study boards two actual moving platforms and reverses across the upper floor',async()=>{
  const {entry,runPlan}=await setup('lift-handoff'),result=runPlan(entry.level,entry.plan);
  for(const [id,low,high] of [['left-car',500,350],['right-car',350,200]]){
    assert.ok(result.trace.some(s=>s.actor.connector===id&&s.actor.mode==='riding'&&s.actor.y<low-20&&s.actor.y>high+20));
  }
  assert.ok(result.trace.some(s=>s.actor.y===200&&s.actor.direction===-1));
  for(let i=0;i<entry.plan.length;i++)assert.equal(runPlan(entry.level,entry.plan.filter((_,j)=>j!==i)).status,'lost');
  assert.equal(runPlan(entry.level,entry.plan.map((p,i)=>({...p,tick:i+1}))).status,'lost');
});

test('pose study changes a harmful object into real support and exposes editable rotation duration',async()=>{
  const {entry,runPlan}=await setup('pose-support'),result=runPlan(entry.level,entry.plan);
  assert.ok(result.trace.some(s=>s.actor.support==='tilting-object'&&s.actor.x>440&&s.actor.x<580));
  assert.equal(runPlan(entry.level,[]).status,'lost');
  const slow=structuredClone(entry.level);
  slow.entities.find(e=>e.id==='tilting-object').behaviors[0].actions.find(a=>a.type==='rotate').ticks=1000;
  assert.equal(runPlan(slow,entry.plan).status,'lost','unfinished rotation does not get a fake success');
});

test('plan runner validates budgets, input references and ordering before simulation',async()=>{
  const {entry,runPlan}=await setup('return-route');
  for(const plan of [null,[{tick:0,source:'return-beam'}],[{tick:3601,source:'return-beam'}],
    [{tick:1.5,source:'return-beam'}],[{tick:1,source:'missing'}],entry.plan.toReversed(),Array(33).fill(entry.plan[0])]){
    assert.throws(()=>runPlan(entry.level,plan));
  }
  for(const untilTick of [0,3601,1.5])assert.throws(()=>runPlan(entry.level,[],{untilTick}));
  assert.throws(()=>runPlan(entry.level,entry.plan,{untilTick:10}));
  assert.throws(()=>runPlan({id:'invalid'},[]));
  const timeout=runPlan(entry.level,[],{untilTick:1});
  assert.equal(timeout.status,'running');assert.equal(timeout.trace.at(-1).tick,1);
});

test('plan runner preserves same-tick inputs and stops at actual failure before later inputs',async()=>{
  const {entry,runPlan}=await setup('lift-handoff');
  const same=runPlan(entry.level,entry.plan.map(p=>({...p,tick:1})));
  assert.equal(same.recording.inputs.length,2);
  const late=runPlan(entry.level,[{...entry.plan[0],tick:3000}]);
  assert.equal(late.status,'lost');assert.equal(late.recording.inputs.length,0);
});
