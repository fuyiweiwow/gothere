import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createEditorStore,createBlankLevel} from '../src/editor/model.js';
import {createSimulation,replayRecording} from '../src/core/engine.js';
import {artTransform} from '../src/render/resources.js';
import {motionAt} from '../src/render/feedback.js';

test('the chimney below the gap emits the initially hidden temporary surface and resets it',()=>{
  const level=createFirstLevel(),cloud=level.scene.nodes.find(n=>n.bind?.id==='cloud'),chimney=level.entities.find(e=>e.id==='chimney');
  assert.equal(artTransform(cloud,level).visible,false,'there is no ghost bridge before emission');
  assert.ok(chimney.x>480&&chimney.x<660&&chimney.y>280,'the input belongs to the lower chimney');
  assert.equal(level.rules.some(r=>r.on.type==='click'&&r.on.source==='cloud'),false,'the hidden smoke is not an input');
  const sim=createSimulation(level);sim.start();sim.click('chimney');sim.step();
  assert.equal(sim.snapshot().entities.cloud.surface.enabled,false,'smoke has a preparation stage');
  sim.step(18);assert.equal(artTransform(cloud,level,sim.snapshot()).visible,true);assert.equal(sim.snapshot().entities.cloud.surface.enabled,true);
  assert.ok(sim.snapshot().signals.some(s=>s.type==='behavior'&&s.source==='cloud'&&s.behavior==='appear'));
  sim.step(301);assert.equal(artTransform(cloud,level,sim.snapshot()).visible,false);assert.equal(sim.snapshot().entities.cloud.surface.enabled,false);
  assert.equal(sim.snapshot().entities.chimney.state,'inactive');assert.deepEqual(replayRecording(level,sim.recording()).snapshot(),sim.snapshot());
});

test('emergence is a relative reusable animation that ends at the authored artwork',()=>{
  const first=motionAt('emerge',0),last=motionAt('emerge',1);
  assert.equal(first.opacity,0);assert.ok(first.scaleX<.5&&first.scaleY<.5);
  assert.deepEqual(last,{dx:0,dy:0,rotation:0,scaleX:1,scaleY:1,opacity:1});
  assert.deepEqual(motionAt('emerge',.5,0),last);
});

test('milestone reset clears old drafts once, restores safely and retains subsequent work',()=>{
  const store=createEditorStore();store.open('old:first',createBlankLevel('first'));store.open('old:second',createBlankLevel('second'));
  const previous=store.serialize(),level=createFirstLevel();
  assert.equal(typeof store.resetWorkspace,'function');assert.equal(store.resetWorkspace('milestone:02',level,'milestone-02-v017'),true);
  assert.equal(store.entries().length,1);assert.equal(store.key(),'milestone:02');
  store.change(d=>{d.name='里程碑中的修改';});const restored=createEditorStore(store.serialize());
  assert.equal(restored.resetWorkspace('milestone:02',level,'milestone-02-v017'),false);assert.equal(restored.document().name,'里程碑中的修改');
  assert.equal(createEditorStore(previous).entries().length,2,'the archived workspace can still be recovered');
  assert.throws(()=>restored.resetWorkspace('broken',{},'next'));assert.equal(restored.document().name,'里程碑中的修改');
});
