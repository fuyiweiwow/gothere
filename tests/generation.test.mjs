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

test('cooperative verification yields, cancels and matches the synchronous evidence',async()=>{
  const {buildCandidate}=await generation(),{verifyCandidate,verifyCandidateAsync}=await verification();
  const candidate=buildCandidate({seed:'async',steps:3});let yielded=0;
  assert.deepEqual(await verifyCandidateAsync(candidate,{yieldTask:async()=>{yielded++;}}),verifyCandidate(candidate));assert.ok(yielded>1);
  const controller=new AbortController();let count=0;
  await assert.rejects(verifyCandidateAsync(candidate,{signal:controller.signal,yieldTask:async()=>{if(++count===2)controller.abort();}}),{name:'AbortError'});
  assert.deepEqual(await verifyCandidateAsync({level:{}}),verifyCandidate({level:{}}));
});

test('candidate batches are bounded, distinct and cancellable without changing drafts',async()=>{
  const {generateCandidates}=await import('../src/generation/batch.js'),events=[];
  const result=await generateCandidates({seed:'batch',steps:3,count:2,onProgress:p=>events.push(p)});
  assert.equal(result.candidates.length,2);assert.equal(new Set(result.candidates.map(c=>c.candidate.signature)).size,2);
  assert.ok(result.candidates.every(c=>c.report.passed));assert.ok(result.attempts<=8);assert.ok(events.length>=2);
  const controller=new AbortController();controller.abort();await assert.rejects(generateCandidates({seed:'a',steps:3,signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(generateCandidates({seed:'a',steps:3,count:10}));
});

test('batch variants preserve the full seed and reject invalid variant inputs',async()=>{
  const {buildCandidate}=await generation(),{generateCandidates}=await import('../src/generation/batch.js');
  const seed='a'.repeat(80),result=await generateCandidates({seed,steps:3,count:1});
  assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].candidate.seed,seed);
  assert.deepEqual(result.candidates[0].candidate,buildCandidate({seed,steps:3,variant:1}));
  assert.notDeepEqual(buildCandidate({seed:'a',variant:1}),buildCandidate({seed:'a',variant:2}));
  for(const options of [undefined,{seed:' '},{seed:'a'.repeat(81)},{seed:'a',variant:-1},{seed:'a',variant:1.5},{seed:'a',variant:9}])assert.throws(()=>buildCandidate(options));
});

test('the verifier rejects malformed plans and reports ineffective mechanisms instead of granting a proof',async()=>{
  const {buildCandidate}=await generation(),{verifyCandidate}=await verification(),candidate=buildCandidate({seed:'invalid'});
  for(const plan of [null,[],[{tick:1,source:'missing'}],candidate.plan.map(p=>({...p,tick:6001}))])assert.equal(verifyCandidate({...candidate,plan}).passed,false);
  const trivial=structuredClone(candidate);trivial.level.platforms=[{x:0,y:440,width:1200}];trivial.level.actor.y=440;trivial.level.goal.y=440;trivial.level.rules=[];
  trivial.level.entities=trivial.plan.map(p=>({id:p.source,label:'按钮',kind:'object',state:'active',x:100,y:440,width:20}));
  const report=verifyCandidate(trivial);assert.equal(report.passed,false);assert.equal(report.noInput.status,'won');assert.ok(report.errors.length>=3);
  const late={...candidate,plan:candidate.plan.map(p=>({...p,tick:5000}))};assert.equal(verifyCandidate(late).passed,false);
});
