import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreetLevel,STREET_PLAN} from '../src/editor/street-level.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {artTransform} from '../src/render/resources.js';
import {actorAnimationState} from '../src/core/locomotion.js';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {assignWalkPlane,connectLayeredNodes,setPlaneBaseline} from '../src/editor/layered-editing.js';
import {createEditorStore,deleteObject} from '../src/editor/model.js';
import {layeredArtOrder} from '../src/render/layered.js';
import {snapSpacePoint} from '../src/editor/spatial-snapping.js';

const run=(level,plan=STREET_PLAN)=>{const game=createSimulation(level).start();for(let tick=1;tick<=3600&&game.snapshot().status==='running';tick++){for(const a of plan.filter(a=>a.tick===tick))game.click(a.source);game.step();}return game;};

test('street item has two causal uses, continuous local passages and deterministic replay',()=>{
  const level=createStreetLevel(),game=run(level);assert.equal(game.snapshot().status,'won');
  assert.equal(game.snapshot().entities.barrier.state,'inactive');assert.equal(game.snapshot().entities.breakfast.state,'inactive');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
  for(let i=0;i<STREET_PLAN.length;i++)assert.equal(run(level,STREET_PLAN.filter((_,j)=>i!==j)).snapshot().status,'lost','omitting action '+i+' must fail');
  const copy=structuredClone(level);delete copy.scene;assert.equal(run(copy).snapshot().status,'won');
});

test('putting an item is local, requires holding and filters the actual receiver',()=>{
  const level=createStreetLevel(),game=createSimulation(level).start();
  game.click('bowl');game.step(59);assert.equal(game.snapshot().entities.dog.state,'active');
  game.click('breakfast');game.step();assert.equal(game.snapshot().actor.holding,'breakfast');
  game.click('guard');game.step();assert.equal(game.snapshot().actor.holding,'breakfast','far or cross-plane receivers cannot take an item');
  game.click('bowl');game.step();assert.equal(game.snapshot().entities.dog.state,'active','out-of-range placement cannot trigger placed');
  game.step(172);game.click('bowl');game.step();assert.equal(game.snapshot().actor.holding,null);assert.equal(game.snapshot().entities.dog.state,'inactive');
  assert.equal(game.snapshot().entities.barrier.state,'active','bowl placement cannot trigger guard reception');
});

test('inward/outward clips are selected from traversal, can be previewed and never affect physics',()=>{
  const level=createStreetLevel(),node=level.scene.nodes.find(n=>n.bind?.type==='actor'),game=createSimulation(level).start();
  for(let tick=1;tick<=850;tick++){for(const a of STREET_PLAN.filter(a=>a.tick===tick))game.click(a.source);game.step();}const s=game.snapshot();
  assert.equal(actorAnimationState(level,s),'inward');assert.ok(artTransform(node,level,s).asset.startsWith('streetWalkIn'));
  assert.ok(artTransform(node,level,s,{variant:'outward'}).asset.startsWith('streetWalkOut'));
  const fallback={...node};delete fallback.variants;
  assert.ok(artTransform(fallback,level,s).asset.startsWith('commuteWorkerWalk'));
  assert.equal(artTransform(node,level,s,{animate:false}).asset,'streetWalkIn1');
  const before=structuredClone(s);artTransform(node,level,s);assert.deepEqual(s,before);
  const visual=structuredClone(level);visual.scene.nodes.find(n=>n.bind?.type==='actor').variants.inward.width=80;
  assert.deepEqual(run(visual).snapshot(),run(level).snapshot());
});

test('layer baselines, assignment and explicit connector edits survive history without changing real height',()=>{
  const level=createLayeredLevel(),store=createEditorStore();store.open('test',level);
  store.change(d=>setPlaneBaseline(d,'back',340));assert.equal(store.document().spatial.nodes[2].depth,240);assert.equal(store.document().spatial.nodes[2].height,0);
  store.undo();assert.deepEqual(store.document(),level);
  store.change(d=>{deleteObject(d,{type:'entity',id:'alley'});connectLayeredNodes(d,'front-turn','back-entry');});
  assert.equal(validateLevel(store.document()).valid,true);assert.equal(run(store.document(),[]).snapshot().status,'won');
  store.change(d=>assignWalkPlane(d,d.entities.find(e=>e.id==='marker'),'front'));
  assert.equal(store.document().entities.find(e=>e.id==='marker').space.depth,30);
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
});

test('plane order controls occlusion, art layer only orders art within its plane',()=>{
  const level=createStreetLevel(),back=level.scene.nodes.find(n=>n.bind?.id==='guard'),front=level.scene.nodes.find(n=>n.bind?.id==='bowl');
  back.layer=100;front.layer=-100;
  const order=layeredArtOrder(level);assert.ok(order.indexOf(back)<order.indexOf(front));
});

test('recomposing plane baselines affects display, never passage timing or game outcome',()=>{
  const level=createStreetLevel(),edited=structuredClone(level);
  setPlaneBaseline(edited,'lane',370);setPlaneBaseline(edited,'court',260);
  const original=run(level).snapshot(),changed=run(edited).snapshot();
  assert.equal(changed.status,original.status);assert.equal(changed.tick,original.tick);
  assert.deepEqual(changed.signals,original.signals);assert.equal(changed.actor.space.height,original.actor.space.height);
});

test('deleting a receiver prunes its place actions and filtered events',()=>{
  const level=createStreetLevel(),store=createEditorStore();store.open('street',level);
  store.change(d=>deleteObject(d,{type:'entity',id:'bowl'}));
  assert.equal(validateLevel(store.document()).valid,true);
  assert.ok(!store.document().rules.some(r=>r.on.other==='bowl'));
  store.undo();assert.deepEqual(store.document(),level);
});

test('snapping stays on the selected plane and measures actual supporting height',()=>{
  const level=createLayeredLevel(),point={x:300,plane:'front',depth:30,height:8};
  assert.deepEqual(snapSpacePoint(level,point),{x:300,plane:'front',depth:30,height:0});
  assert.deepEqual(snapSpacePoint(level,{...point,height:40}),{...point,height:40});
  assert.deepEqual(snapSpacePoint(level,point,{disabled:true}),point);
  const node={x:329,plane:'front',depth:30,height:0};assert.equal(snapSpacePoint(level,node,{surfaces:false}).x,330);
  assert.deepEqual(snapSpacePoint(level,point,{nodes:false,surfaces:false}),point);
  assert.deepEqual(snapSpacePoint(level,{x:180,plane:'front',depth:30,height:180}),{x:180,plane:'front',depth:30,height:180});
});

test('falling and real elevation never select inward animation, and open doors show their capability',()=>{
  const level=createStreetLevel();
  for(const mode of ['falling','climbing','riding'])assert.equal(actorAnimationState(level,{status:'running',actor:{mode,direction:1,space:{height:100}}}),mode);
  assert.equal(actorAnimationState(level,{status:'running',actor:{mode:'walking',direction:-1,space:{height:100}}}),'walk-left');
  assert.equal(actorAnimationState(level,{status:'lost',actor:{mode:'walking'}}),'lost');
  const door=level.scene.nodes.find(n=>n.bind?.id==='barrier'),before=artTransform(door,level);
  level.entities.find(e=>e.id==='barrier').state='inactive';
  assert.notEqual(artTransform(door,level).rotation,before.rotation,'raised barrier reads the real state');
});
