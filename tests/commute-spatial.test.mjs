import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,replayRecording} from '../src/core/engine.js';
import {validateLevel} from '../src/core/schema.js';
import {createEditorStore} from '../src/editor/model.js';

const build=async()=>{const {createCommuteLevel,COMMUTE_PLAN}=await import('../src/editor/commute-level.js');return {level:createCommuteLevel(),plan:COMMUTE_PLAN};};
function run(level,plan){const sim=createSimulation(level).start(),trace=[];for(let tick=0;tick<6000&&sim.snapshot().status==='running';tick++){
  for(const a of plan.filter(a=>a.tick===tick))sim.click(a.source);sim.step();if(tick%10===0)trace.push(sim.snapshot());
}return {state:sim.snapshot(),trace,recording:sim.recording()};}
test('commute is editable v2 data with actual depth routes and reusable street artwork',async()=>{
  const {level}=await build(),v=validateLevel(level);assert.equal(v.valid,true,v.errors.join('\n'));assert.equal(level.schemaVersion,2);
  assert.ok(new Set(level.spatial.nodes.map(n=>n.depth)).size>=3);assert.ok(new Set(level.spatial.nodes.map(n=>n.height)).size>=3);
  assert.ok(level.scene.nodes.length>=70);const store=createEditorStore();store.open('commute',level);assert.deepEqual(createEditorStore(store.serialize()).document(),level);
});
test('commute rides the actual bus in depth, loops beneath the street and takes a moving lift to work',async()=>{
  const {level,plan}=await build(),r=run(level,plan);assert.equal(r.state.status,'won',JSON.stringify(r.state.actor));
  assert.ok(r.trace.some(s=>s.actor.support==='bus'&&s.actor.space.depth>150&&s.actor.space.height===240));
  assert.ok(r.trace.some(s=>s.actor.space.height===0&&s.actor.space.depth>300&&s.actor.direction===-1));
  assert.ok(r.trace.some(s=>s.actor.support==='service-lift'&&s.actor.space.height>20&&s.actor.space.height<260));
  assert.equal(r.state.actor.holding,'badge');assert.equal(r.state.entities.turnstile.state,'open');assert.equal(r.state.entities.bus.space.depth,220);
  assert.deepEqual(replayRecording(level,r.recording).snapshot(),r.state);
});
test('missing interventions and insufficient geometry fail; artwork cannot determine the outcome',async()=>{
  const {level,plan}=await build();for(const a of plan)assert.equal(run(level,plan.filter(p=>p!==a)).state.status,'lost',a.source);
  const noArt=structuredClone(level);delete noArt.scene;assert.deepEqual(run(noArt,plan),run(level,plan));
  const short=structuredClone(level);short.entities.find(e=>e.id==='trench-cover').width=60;assert.equal(run(short,plan).state.status,'lost');
});
