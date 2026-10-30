import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLevel,createSimulation,replayRecording} from '../src/core/engine.js';
import {createEditorStore} from '../src/editor/model.js';
const generation=()=>import('../src/generation/generator.js');
const verification=()=>import('../src/generation/verify.js');

test('a seed reproduces an editable generated level, plan and causal structure',async()=>{
  const {buildCandidate}=await generation(),a=buildCandidate({seed:'breakfast',steps:3});
  assert.deepEqual(buildCandidate({seed:'breakfast',steps:3}),a);assert.equal(validateLevel(a.level).valid,true);
  assert.equal(a.plan.length,3);assert.equal(new Set(a.fragments.map(f=>f.kind)).size,3,'the short route combines distinct mechanics');
  const store=createEditorStore();store.open('generated',a.level);assert.deepEqual(createEditorStore(store.serialize()).document(),a.level);
  assert.notDeepEqual(buildCandidate({seed:'different',steps:3}),a);
});

test('generated routes win in the normal engine and provide exact successful replays',async()=>{
  const {buildCandidate}=await generation(),{verifyCandidate}=await verification();
  for(const steps of [3,4,5]){
    const candidate=buildCandidate({seed:'route-'+steps,steps}),before=structuredClone(candidate);
    const report=verifyCandidate(candidate);assert.equal(report.passed,true,JSON.stringify(report));assert.equal(report.recording.status,'won');
    assert.equal(replayRecording(candidate.level,report.recording).snapshot().status,'won');assert.equal(report.omissions.length,steps);
    assert.ok(report.omissions.every(x=>x.status!=='won'));assert.ok(report.timing.every(x=>x.status==='won'));
    assert.equal(report.early.status==='won',false);assert.equal(report.noInput.status==='won',false);assert.deepEqual(candidate,before);
  }
});

test('mechanism sequences vary, budgets and inputs are bounded, and a broken draft is rejected',async()=>{
  const {buildCandidate}=await generation(),{verifyCandidate}=await verification(),signatures=new Set();
  for(let i=0;i<12;i++)signatures.add(buildCandidate({seed:'diversity-'+i,steps:3}).signature);
  assert.ok(signatures.size>=4,'more than cosmetic or coordinate variation');
  for(const options of [{seed:'',steps:3},{seed:'a',steps:0},{seed:'a',steps:50},{seed:'a',steps:3.5}])assert.throws(()=>buildCandidate(options));
  const candidate=buildCandidate({seed:'broken',steps:3});candidate.level.platforms=[];
  const report=verifyCandidate(candidate);assert.equal(report.passed,false);assert.ok(report.errors.length);assert.equal(createSimulation instanceof Function,true);
});
