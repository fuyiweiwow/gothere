import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {createFeedbackPlayer} from '../src/render/feedback.js';
import {artTransform} from '../src/render/resources.js';
import {deleteObject} from '../src/editor/model.js';
import {feedbackDefault} from '../src/content/feedback-presets.js';
import {levelToProject} from '../src/editor/javascript-project.js';
import {executeProject} from './helpers/project.mjs';

function fixture(){
  const level=createBusStopLevel(),actor=level.scene.nodes.find(n=>n.bind?.type==='actor');
  level.scene.feedback=[{...feedbackDefault(actor.id,'clip'),trigger:{type:'lost',cause:'passenger-a'},
    motion:'none',duration:60,hold:true,animation:{frames:['stopWorkerIdle','stopWorkerWalk'],fps:6}}];
  return {level,actor};
}

test('real lethal contact names the actual cause and keeps failure deterministic after renaming',()=>{
  for(const name of ['passenger-a','another-person']){
    const level=JSON.parse(JSON.stringify(createBusStopLevel()).replaceAll('passenger-a',name));
    const game=createSimulation(level).start().step(1200),state=game.snapshot(),lost=state.signals.find(s=>s.type==='lost');
    assert.equal(state.status,'lost');assert.equal(lost.cause,name);assert.equal(lost.source,'actor');
    assert.deepEqual(replayRecording(level,game.recording()).snapshot(),state);
  }
});

test('feedback frame sequences play once on the finite terminal tail and hold without advancing gameplay',()=>{
  const {level,actor}=fixture(),player=createFeedbackPlayer(level),snapshot={tick:400,status:'lost',signals:[{sequence:1,tick:400,type:'lost',source:'actor',reason:'hurt',cause:'passenger-a'}]};
  assert.equal(player.sample(snapshot).frames[actor.id],'stopWorkerIdle');
  const middle=player.sample(snapshot,{endingTicks:12});assert.equal(middle.frames[actor.id],'stopWorkerWalk');
  const final=player.sample(snapshot,{endingTicks:1000});assert.equal(final.frames[actor.id],'stopWorkerWalk');assert.equal(final.tailFinished,true);
  assert.deepEqual(player.sample(snapshot,{endingTicks:2000}),final);assert.equal(snapshot.tick,400);
  assert.equal(artTransform(actor,level,snapshot,{feedback:middle}).asset,'stopWorkerWalk');
  assert.notEqual(artTransform(actor,level,snapshot,{feedback:middle,animate:false}).asset,'stopWorkerWalk');
  player.reset();assert.deepEqual(player.sample({tick:0,status:'running',signals:[]}).frames,{});
});

test('cause filters do not animate unrelated objects and bad frame/cause references are rejected or pruned',()=>{
  const {level,actor}=fixture(),player=createFeedbackPlayer(level);
  assert.deepEqual(player.sample({tick:20,status:'lost',signals:[{sequence:1,tick:20,type:'lost',source:'actor',cause:'passenger-b'}]}).frames,{});
  for(const mutate of [f=>f.trigger.cause='missing',f=>f.animation.frames=['missing'],f=>f.animation.fps=0,f=>f.animation.frames=[],f=>f.trigger.type='won']){
    const copy=structuredClone(level);mutate(copy.scene.feedback[0]);assert.equal(validateLevel(copy).valid,false);
  }
  deleteObject(level,{type:'entity',id:'passenger-a'});assert.equal(level.scene.feedback.length,0);assert.equal(validateLevel(level).valid,true);
  assert.ok(actor.id);
});

test('moving loops start from local movement time and respect authored left-facing movement',()=>{
  const level=createBusStopLevel(),node=level.scene.nodes.find(n=>n.bind?.id==='passenger-c');
  node.flipWithDirection=true;
  const snapshot=createSimulation(level).start().snapshot(),entity=snapshot.entities['passenger-c'];snapshot.tick=1001;
  entity.translation={elapsed:0,ticks:100,from:{x:620,depth:130,height:0},to:{x:400,depth:130,height:0}};
  assert.equal(artTransform(node,level,snapshot).asset,node.variants.moving.animation.frames[0]);
  assert.equal(artTransform(node,level,snapshot).flipX,true);
  entity.translation.elapsed=8;assert.equal(artTransform(node,level,snapshot).asset,node.variants.moving.animation.frames[1]);
});

test('bus stop and chapter use editable anticipation, source-specific shoves and consistent hero directions',()=>{
  for(const level of [createBusStopLevel(),createCommuteChapter()]){
    assert.equal(validateLevel(level).valid,true,validateLevel(level).errors.join('\n'));
    const actor=level.scene.nodes.find(n=>n.bind?.type==='actor');assert.ok(actor.animation.frames.length>=8);
    for(const direction of ['walk-left','inward','outward'])assert.ok(actor.variants[direction]);
    assert.ok(level.entities.some(e=>e.id==='queue-approach'&&e.kind==='zone'));
    for(const cause of ['passenger-a','passenger-b','passenger-c'])assert.ok(level.scene.feedback.some(f=>f.trigger.type==='lost'&&f.trigger.cause===cause&&f.animation?.frames.length>=4));
    const game=createSimulation(level).start().step(1200),snapshot=game.snapshot(),feedback=createFeedbackPlayer(level);
    const initial=feedback.sample(snapshot),later=feedback.sample(snapshot,{endingTicks:30});assert.notDeepEqual(initial.frames,later.frames);
    const bare=structuredClone(level);delete bare.scene;assert.deepEqual(createSimulation(bare).start().step(1200).snapshot(),snapshot);
  }
});

test('authored failure clips and typed cause references round trip through assembled TypeScript',async()=>{
  const level=fixture().level,project=levelToProject(level,{typescript:true});
  assert.match(project.files['scene/feedback.ts'],/cause: objects\.itemPassengerA/);
  assert.deepEqual(await executeProject(project),level);
});
