import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createSimulation,replayRecording} from '../src/core/engine.js';
import {validateLevel} from '../src/core/schema.js';
import {deleteObject,createEditorStore,renameBehavior,deleteBehavior} from '../src/editor/model.js';
import {deleteArt,duplicateArt} from '../src/editor/resources.js';

const slot=(l,extra={})=>({id:'feedback-test',label:'反馈',target:l.scene.nodes.find(n=>n.bind?.id==='pipe').id,
  trigger:{type:'behavior',source:'pipe',behavior:'lower'},motion:'squash',particles:'smoke',sound:'puff',
  duration:60,delay:0,strength:1,loop:false,policy:'restart',anchor:{x:.5,y:0},count:8,color:'#b9d2dc',direction:-90,volume:.2,...extra});
const state=(tick,signals=[],status='running')=>({tick,signals,status});

test('feedback DSL rejects missing references, malformed presets and unsafe audio',()=>{
  for(const edit of [s=>s.target='missing',s=>s.motion='execute',s=>s.duration=NaN,s=>s.count=999,s=>s.anchor.x=9,s=>s.trigger.behavior='missing',s=>s.sound='missing']){
    const l=createFirstLevel(),s=slot(l);l.scene.feedback=[s];edit(s);assert.equal(validateLevel(l).valid,false);
  }
  const l=createFirstLevel();l.scene.sounds=[{id:'bad',label:'bad',src:'https://example.org/a.mp3'}];assert.equal(validateLevel(l).valid,false);
});

test('behavior, state and lifecycle signals are structured, deterministic and survive the small display log',()=>{
  const l=createFirstLevel(),s=createSimulation(l);s.start();s.click('pipe');s.step();
  assert.ok(s.snapshot().signals.some(e=>e.type==='behavior'&&e.source==='pipe'&&e.behavior==='lower'));
  assert.ok(s.snapshot().signals.some(e=>e.type==='state'&&e.source==='pipe'&&e.state==='active'));
  s.step(600);assert.deepEqual(replayRecording(l,s.recording()).snapshot(),s.snapshot());
  const lost=createSimulation(l);lost.start().step(3000);assert.ok(lost.snapshot().signals.some(e=>e.type==='lost'&&e.source==='actor'));
});

test('feedback starts at invocation time, pauses, delays audio once and clears on reset',async()=>{
  const {createFeedbackPlayer}=await import('../src/render/feedback.js');
  const l=createFirstLevel(),s=slot(l,{delay:12});l.scene.feedback=[s];const heard=[],p=createFeedbackPlayer(l,{onSound:e=>heard.push(e)});
  const signal={sequence:1,tick:100,type:'behavior',source:'pipe',behavior:'lower'};
  assert.equal(p.sample(state(100,[signal])).active,1);assert.equal(heard.length,0);
  const halfway=p.sample(state(130,[signal]));assert.ok(halfway.motions[s.target].scaleX!==1);assert.ok(halfway.particles.length>0);assert.equal(heard.length,1);
  assert.deepEqual(p.sample(state(130,[signal],'paused')),halfway);p.sample(state(131,[signal]));assert.equal(heard.length,1);
  assert.equal(p.sample(state(180,[signal])).active,0);p.reset();assert.equal(p.sample(state(0)).active,0);
});

test('particles are seeded, bounded and reusable; identical presets apply to different art without changing logic',async()=>{
  const {createFeedbackPlayer}=await import('../src/render/feedback.js');const l=createFirstLevel();l.scene.feedback=[slot(l)];
  const signal={sequence:1,tick:0,type:'behavior',source:'pipe',behavior:'lower'},before=structuredClone(l);
  const a=createFeedbackPlayer(l),b=createFeedbackPlayer(l);a.sample(state(0,[signal]));b.sample(state(0,[signal]));
  assert.deepEqual(a.sample(state(30,[signal])),b.sample(state(30,[signal])));assert.deepEqual(l,before);
  const next=structuredClone(l);next.scene.feedback[0].target=next.scene.nodes.find(n=>n.bind?.id==='pot').id;
  const c=createFeedbackPlayer(next);assert.ok(c.sample(state(30,[signal])).motions[next.scene.feedback[0].target]);
});

test('repeated triggers obey restart versus overlay and muted/disabled feedback never catches up audio',async()=>{
  const {createFeedbackPlayer}=await import('../src/render/feedback.js');const l=createFirstLevel();l.scene.feedback=[slot(l)];
  const one={sequence:1,tick:0,type:'behavior',source:'pipe',behavior:'lower'},two={...one,sequence:2,tick:10};
  const heard=[],p=createFeedbackPlayer(l,{onSound:e=>heard.push(e)});p.sample(state(1,[one]),{audible:false});p.sample(state(2,[one]));assert.equal(heard.length,0);
  assert.equal(p.sample(state(10,[one,two])).active,1);assert.equal(heard.length,1);
  l.scene.feedback[0].policy='overlay';const other=createFeedbackPlayer(l);assert.equal(other.sample(state(10,[one,two])).active,2);
  const quiet=createFeedbackPlayer(l,{onSound:e=>heard.push(e)});const frame=quiet.sample(state(10,[one,two]),{enabled:false,audible:false});assert.equal(Object.keys(frame.motions).length,0);assert.equal(frame.particles.length,0);
});

test('death completes on a separate finite presentation tail while gameplay tick stays stopped',async()=>{
  const {createFeedbackPlayer}=await import('../src/render/feedback.js');const l=createFirstLevel(),actor=l.scene.nodes.find(n=>n.bind?.type==='actor');
  l.scene.feedback=[slot(l,{target:actor.id,trigger:{type:'lost'},motion:'fall',particles:'dust',hold:true})];
  const s=state(200,[{sequence:1,tick:200,type:'lost',source:'actor'}],'lost'),p=createFeedbackPlayer(l);
  const first=p.sample(s),last=p.sample(s,{endingTicks:100});assert.notDeepEqual(first.motions,last.motions);assert.equal(s.tick,200);assert.equal(last.tailFinished,true);
  assert.deepEqual(last,p.sample(s,{endingTicks:300}),'terminal pose stops at its final frame');
});

test('deleting/duplicating art and renaming/removing behaviors keep feedback references valid',()=>{
  const l=createFirstLevel();l.scene.feedback=[slot(l)];renameBehavior(l,'pipe','lower','new-lower');assert.equal(l.scene.feedback[0].trigger.behavior,'new-lower');
  const copied=duplicateArt(l,l.scene.feedback[0].target);assert.ok(l.scene.feedback.some(f=>f.target===copied));deleteArt(l,copied);assert.ok(!l.scene.feedback.some(f=>f.target===copied));
  deleteBehavior(l,'pipe','new-lower');assert.ok(!l.scene.feedback.some(f=>f.trigger.source==='pipe'&&f.trigger.behavior==='new-lower'));
  deleteObject(l,{type:'entity',id:'pipe'});assert.equal(validateLevel(l).valid,true);
  const store=createEditorStore();store.open('feedback',l);store.change(d=>d.scene.feedback=[]);assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
});

test('visual motion changes art only and preserves the bottom-center pivot under existing rotations',async()=>{
  const {artTransform}=await import('../src/render/resources.js');const l=createFirstLevel(),n=l.scene.nodes.find(n=>n.bind?.id==='pot'),before=artTransform(n,l);
  const physics=structuredClone(l.entities),m={dx:0,dy:0,rotation:45,scaleX:1.2,scaleY:.8,opacity:.5};
  const after=artTransform(n,l,undefined,{feedback:{motions:{[n.id]:m}}});assert.equal(after.rotation,before.rotation+45);assert.equal(after.opacity,.5);
  const pivot=v=>{const r=v.rotation*Math.PI/180;return {x:v.x+v.width*.5*Math.cos(r)-v.height*Math.sin(r),y:v.y+v.width*.5*Math.sin(r)+v.height*Math.cos(r)};};
  assert.ok(Math.hypot(pivot(before).x-pivot(after).x,pivot(before).y-pivot(after).y)<1e-8);assert.deepEqual(l.entities,physics);
});

test('sound playback obeys mute, reset and asynchronous decode cancellation',async()=>{
  const {createSoundPlayer}=await import('../src/render/audio.js');const started=[],stopped=[];
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const source=()=>({connect(){},start(){started.push(this);},stop(){stopped.push(this);},frequency:param(),onended:null});
  let resolveDecode;const context={state:'running',currentTime:0,sampleRate:8000,destination:{},resume:async()=>{},suspend:async()=>{},
    createGain:()=>({gain:param(),connect(){}}),createOscillator:source,createBufferSource:source,
    createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),decodeAudioData:()=>new Promise(r=>resolveDecode=r)};
  const audio=createSoundPlayer({contextFactory:()=>context});await audio.unlock();audio.setLevel({scene:{sounds:[{id:'custom',src:'data:audio/wav;base64,AAAA'}]}});
  await audio.play({sound:'pop',volume:.2});assert.ok(started.length>0);audio.setMuted(true);assert.ok(stopped.length>0);
  const count=started.length;await audio.play({sound:'pop',volume:.2});assert.equal(started.length,count);audio.setMuted(false);
  const pending=audio.play({sound:'custom',volume:.2});await Promise.resolve();audio.stop();resolveDecode({duration:1});await pending;assert.equal(started.length,count,'reset discards a pending decoded sound');
});

test('all motion presets respect zero strength and stay finite on arbitrary artwork',async()=>{
  const {motionAt}=await import('../src/render/feedback.js');const {MOTIONS}=await import('../src/content/feedback-presets.js');
  for(const preset of Object.keys(MOTIONS))for(const phase of [0,.25,.5,1]){
    assert.deepEqual(motionAt(preset,phase,0),{dx:0,dy:0,rotation:0,scaleX:1,scaleY:1,opacity:1},preset);
    assert.ok(Object.values(motionAt(preset,phase,2)).every(Number.isFinite));
  }
});

test('terminal presentation waits for delayed feedback then freezes ambient loops without rewinding',async()=>{
  const {createFeedbackPlayer}=await import('../src/render/feedback.js');const l=createFirstLevel();l.scene.feedback=[slot(l,{id:'loop',trigger:{type:'start'},motion:'sway',loop:true}),slot(l,{trigger:{type:'lost'},delay:600})];
  const p=createFeedbackPlayer(l),s=state(200,[{sequence:1,tick:0,type:'start'},{sequence:2,tick:200,type:'lost',source:'actor'}],'lost');
  assert.equal(p.sample(s,{endingTicks:601}).tailFinished,false);const done=p.sample(s,{endingTicks:700});assert.equal(done.tailFinished,true);
  assert.deepEqual(done,p.sample(s,{endingTicks:900}),'ambient loops freeze at the end of the longest one-shot');
});

test('malformed feedback sources cannot create silently unreachable subscriptions',()=>{
  for(const trigger of [{type:'lost',source:'pipe'},{type:'start',source:'missing'},{type:'event',source:'pipe',event:'done',behavior:'missing'}]){
    const l=createFirstLevel();l.scene.feedback=[slot(l,{trigger})];assert.equal(validateLevel(l).valid,false);
  }
});

test('first sound waits for browser audio unlock and reset cancels the pending first cue',async()=>{
  const {createSoundPlayer}=await import('../src/render/audio.js');let resumed,plays=0;
  const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
  const context={state:'suspended',currentTime:0,destination:{},resume:()=>new Promise(r=>{resumed=()=>{context.state='running';r();};}),
    createGain:()=>({gain:param,connect(){},disconnect(){}}),createOscillator:()=>({frequency:param,connect(){},disconnect(){},start(){plays++;},stop(){}})};
  const audio=createSoundPlayer({contextFactory:()=>context});const first=audio.play({sound:'pop'});
  assert.equal(typeof resumed,'function','the first preview unlocks audio');resumed();await first;assert.equal(plays,1);
  audio.stop();context.state='suspended';const cancelled=audio.play({sound:'pop'});audio.stop();resumed();await cancelled;assert.equal(plays,1);
});

test('audio disconnects completed and stopped sources and repeated pause changes are idempotent',async()=>{
  const {createSoundPlayer}=await import('../src/render/audio.js');const sources=[],gains=[];let suspends=0,resumes=0;
  const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
  const connection=()=>({connected:true,connect(){},disconnect(){this.connected=false;}});
  const context={state:'running',currentTime:0,destination:{},resume:async()=>{resumes++;},suspend:async()=>{suspends++;},
    createGain:()=>{const g={...connection(),gain:param};gains.push(g);return g;},
    createOscillator:()=>{const n={...connection(),frequency:param,start(){},stop(){}};sources.push(n);return n;}};
  const audio=createSoundPlayer({contextFactory:()=>context});await audio.unlock();await audio.play({sound:'pop'});sources[0].onended();
  assert.equal(sources[0].connected,false);assert.equal(gains[0].connected,false);
  await audio.play({sound:'pop'});audio.stop();assert.equal(sources[1].connected,false);assert.equal(gains[1].connected,false);
  await audio.setPaused(true);await audio.setPaused(true);assert.equal(suspends,1);
  context.state='suspended';await audio.setPaused(false);await audio.setPaused(false);assert.equal(resumes,1);
});

test('removing a behavior also prunes its done-event feedback subscription',()=>{
  const l=createFirstLevel();l.scene.feedback=[slot(l,{trigger:{type:'event',source:'pipe',event:'done',behavior:'lower'}})];
  assert.equal(validateLevel(l).valid,true);deleteBehavior(l,'pipe','lower');assert.equal(l.scene.feedback.length,0);assert.equal(validateLevel(l).valid,true);
});
