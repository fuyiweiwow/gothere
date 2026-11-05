import test from 'node:test';
import assert from 'node:assert/strict';
import {createScooterLevel} from '../src/editor/scooter-level.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {canDrag,placementAnchor,placementReceiver} from '../src/core/placement.js';
import {createPreview} from '../src/app/preview.js';
import {deleteObject} from '../src/editor/model.js';
import {captureTemplate,placeTemplate} from '../src/editor/templates.js';

test('placing the roadblock changes the rider decision; inaction produces a real contact failure',()=>{
  const level=createScooterLevel(),original=structuredClone(level);
  assert.equal(validateLevel(level).valid,true,validateLevel(level).errors.join('\n'));
  const solution=createSimulation(level).start();assert.equal(solution.placeAt('barrier',{x:842,y:490}),true);solution.step(1800);
  const s=solution.snapshot();assert.equal(s.status,'won');assert.equal(s.entities.scooter.x,1310);assert.equal(s.entities.barrier.x,842);
  assert.equal(s.entities.barrier.draggable.enabled,false);assert.equal(s.entities.blocked.state,'active');assert.deepEqual(level,original);
  assert.deepEqual(replayRecording(level,solution.recording()).snapshot(),s);
  const failure=createSimulation(level).start().step(1800).snapshot();assert.equal(failure.status,'lost');assert.equal(failure.reason,'hurt');
  assert.ok(Math.abs(failure.actor.x-failure.entities.scooter.x)<90);assert.ok(failure.entities.scooter.translation);
});

test('wrong drops preserve the previous placement, emit a reusable event and remain replayable',()=>{
  const level=createScooterLevel(),g=createSimulation(level).start();g.placeAt('barrier',{x:400,y:250});g.step();
  assert.equal(g.snapshot().entities.barrier.x,260);assert.equal(g.snapshot().entities.blocked.state,'inactive');
  assert.ok(g.snapshot().signals.some(s=>s.event==='droprejected'));assert.equal(g.snapshot().clicks,0);
  assert.deepEqual(replayRecording(level,g.recording()).snapshot(),g.snapshot());
  g.placeAt('barrier',{x:850,y:500});g.step();assert.equal(g.snapshot().entities.barrier.x,842);
  g.reset();assert.equal(g.snapshot().entities.barrier.x,260);assert.equal(g.snapshot().entities.barrier.draggable.enabled,true);assert.deepEqual(g.recording().inputs,[]);
});

test('placement is a bounded input, refuses paused/end/held/moving items and does not alter authored data',()=>{
  const l=createScooterLevel(),g=createSimulation(l),point={x:842,y:490};assert.equal(g.placeAt('barrier',point),false);g.start();
  for(const p of [null,{}, {x:NaN,y:490},{x:-1,y:490},{x:842,y:641}])assert.equal(g.placeAt('barrier',p),false);
  assert.equal(g.placeAt('scooter',point),false);assert.equal(g.placeAt('missing',point),false);
  for(let i=0;i<32;i++)assert.equal(g.placeAt('barrier',{x:100,y:100}),true);assert.equal(g.placeAt('barrier',point),false);
  g.step();g.pause();assert.equal(g.placeAt('barrier',point),false);g.start().step(1800);assert.equal(g.placeAt('barrier',point),false);
  const s=createSimulation(l).snapshot();s.actor.holding='barrier';assert.equal(canDrag(s,'barrier'),false);s.actor.holding=null;s.entities.barrier.translation={};assert.equal(canDrag(s,'barrier'),false);
  const preview=createPreview(l);assert.equal(preview.placeAt('barrier',point),false);preview.start();assert.equal(preview.placeAt('barrier',point),true);preview.advance(1);assert.equal(preview.snapshot().entities.barrier.x,842);
});

test('queued placement rechecks receiver availability after timers and preserves input coordinates',()=>{
  const l=createScooterLevel();l.rules.push({on:{source:'barrier',type:'click'},actions:[{type:'after',ticks:1,actions:[{type:'enable',target:'gap',capability:'dropTarget',enabled:false}]}]});
  const g=createSimulation(l).start();g.click('barrier');g.step();const point={x:842,y:490};g.placeAt('barrier',point);point.x=100;
  g.step();assert.equal(g.snapshot().entities.barrier.x,260);assert.equal(g.recording().inputs.at(-1).point.x,842);
  assert.deepEqual(replayRecording(l,g.recording()).snapshot(),g.snapshot());
});

test('success, wrong target and late placement use actual anchors independent of scene resources',()=>{
  const l=createScooterLevel(),s=createSimulation(l).snapshot();
  assert.equal(placementReceiver(l,s,'barrier',{x:883,y:490}).id,'gap');assert.equal(placementReceiver(l,s,'barrier',{x:885,y:490}),null);
  s.entities.gap.dropTarget.enabled=false;assert.equal(placementReceiver(l,s,'barrier',{x:842,y:490}),null);
  s.entities.gap.dropTarget.enabled=true;s.entities.barrier.draggable.targets=[];assert.equal(placementReceiver(l,s,'barrier',{x:842,y:490}),null);
  const late=createSimulation(l).start().step(420);assert.equal(late.placeAt('barrier',{x:842,y:490}),true);late.step(1000);assert.equal(late.snapshot().status,'lost');assert.equal(late.snapshot().entities.barrier.x,260);
  const early=createSimulation(l).start().step(360);early.placeAt('barrier',{x:842,y:490});early.step(1600);assert.equal(early.snapshot().status,'won');
  const bare=structuredClone(l);delete bare.scene;const g=createSimulation(bare).start(),r=createSimulation(l).start();
  for(const game of [g,r]){game.placeAt('barrier',{x:842,y:490});game.step(1800);}assert.deepEqual(g.snapshot(),r.snapshot());
});

test('draggable targets, capabilities and malformed recordings are validated',()=>{
  const check=edit=>{const l=createScooterLevel();edit(l);assert.equal(validateLevel(l).valid,false);};
  check(l=>l.entities[0].draggable.targets=['missing']);check(l=>l.entities[0].draggable.targets=['gap','gap']);
  check(l=>l.entities[0].draggable.enabled=1);check(l=>l.entities[0].collider={enabled:true});check(l=>l.entities[1].dropTarget.radius=0);
  check(l=>l.entities[1].dropTarget=null);check(l=>l.entities[0].draggable=null);
  const l=createScooterLevel(),g=createSimulation(l).start();g.placeAt('barrier',{x:842,y:490});g.step();
  for(const change of [r=>r.inputs[0].type='unknown',r=>r.inputs[0].point.y=Infinity,r=>r.inputs[0].source='missing']){const r=g.recording();change(r);assert.throws(()=>replayRecording(l,r));}
});

test('multiple receivers choose the nearest valid anchor with a stable tie break',()=>{
  const l=createScooterLevel();delete l.scene;const target=structuredClone(l.entities[1]);target.id='another';target.x=862;l.entities.push(target);l.entities[0].draggable.targets=['gap','another'];
  const s=createSimulation(l).snapshot();assert.equal(placementReceiver(l,s,'barrier',{x:860,y:490}).id,'another');
  assert.equal(placementReceiver(l,s,'barrier',{x:852,y:490}).id,'another');
  s.entities.another.x=1190;assert.equal(placementReceiver(l,s,'barrier',{x:1190,y:490}),null);
});

test('legacy v1 and layered cross-plane receiver placement share the same input without changing hold/place',()=>{
  const l=createScooterLevel();delete l.scene;delete l.spatial;delete l.world.physics;l.schemaVersion=1;
  for(const o of [l.actor,l.goal,...l.platforms,...l.entities])delete o.space;
  l.rules=[];for(const e of l.entities)delete e.behaviors;
  const g=createSimulation(l).start();assert.deepEqual(placementAnchor(l,g.snapshot().entities.gap),{x:842,y:440});g.placeAt('barrier',{x:842,y:440});g.step();assert.equal(g.snapshot().entities.barrier.x,842);
  const layered=createScooterLevel();delete layered.scene;layered.spatial.planes.push({id:'back',label:'后街',depth:210,order:-1});const target=layered.entities.find(e=>e.id==='gap');target.space.plane='back';target.space.depth=210;
  const h=createSimulation(layered).start();h.placeAt('barrier',{x:842,y:410});h.step();assert.equal(h.snapshot().entities.barrier.space.plane,'back');assert.equal(h.snapshot().entities.barrier.space.depth,210);
});

test('deleting a receiver prunes references and templates remap placement links together',()=>{
  const l=createScooterLevel();deleteObject(l,{type:'entity',id:'gap'});assert.deepEqual(l.entities[0].draggable.targets,[]);assert.equal(validateLevel(l).valid,true);
  const t=createScooterLevel();t.rules=[];for(const e of t.entities)delete e.behaviors;t.scene.feedback=[];t.scene.nodes=t.scene.nodes.filter(n=>n.bind?.id==='barrier');
  const template=captureTemplate(t,{id:'barrier-template',label:'活动路障组合',nodes:['scoot-barrier'],entities:['barrier','gap'],origin:{x:260,y:490}});
  placeTemplate(t,template,{x:280,y:490,plane:'street'});const added=t.entities.slice(-2);assert.deepEqual(added[0].draggable.targets,[added[1].id]);assert.equal(validateLevel(t).valid,true);
});
