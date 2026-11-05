import test from 'node:test';
import assert from 'node:assert/strict';
import {createTowStreetLevel,TOW_STREET_PLAN} from '../src/editor/tow-street-level.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {artTransform,entityArtBounds} from '../src/render/resources.js';
import {createEditorStore} from '../src/editor/model.js';

function run(level=createTowStreetLevel(),plan=TOW_STREET_PLAN){
  const game=createSimulation(level).start();for(let tick=1;tick<=1800&&game.snapshot().status==='running';tick++){
    for(const input of plan)if(input.tick===tick)game.click(input.source);game.step();
  }return game;
}
test('the towing encounter is a short causal solution with a continuous departure and deterministic replay',()=>{
  const level=createTowStreetLevel();assert.equal(validateLevel(level).valid,true,validateLevel(level).errors.join('\n'));
  const game=run(level),s=game.snapshot();assert.equal(s.status,'won');assert.ok(s.tick>1400&&s.tick<1450);
  assert.equal(s.entities.caller.state,'inactive');assert.equal(s.entities.car.state,'inactive');assert.equal(s.entities.coupled.state,'active');
  assert.ok(entityArtBounds(level,s,'car').x>1200);assert.equal(s.entities.owner.x,1340);
  assert.equal(s.entities.tow.x,2066);assert.equal(s.entities.owner.state,'inactive');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),s);
});

test('inaction and a late call fail against the actual car while early calls and repeated input remain coherent',()=>{
  for(const plan of [[],[{source:'caller',tick:660}]]){const s=run(undefined,plan).snapshot();assert.equal(s.status,'lost');assert.equal(s.reason,'hurt');assert.equal(s.entities.car.state,'active');}
  for(const tick of [1,180,360])assert.equal(run(undefined,[{source:'caller',tick}]).snapshot().status,'won');
  const spam=Array.from({length:20},(_,i)=>({source:'caller',tick:180+i*5}));assert.deepEqual(run(undefined,spam).snapshot().entities,run().snapshot().entities);
});

test('a call summons the offscreen tow; only arrival starts lifting and only completed lifting clears the car',()=>{
  const level=createTowStreetLevel(),game=createSimulation(level).start();
  assert.ok(entityArtBounds(level,undefined,'tow')===null);game.click('caller');game.step();assert.equal(game.snapshot().entities.caller.state,'inactive');
  game.step(71);assert.equal(game.snapshot().entities.tow.state,'inactive');game.step();assert.equal(game.snapshot().entities.tow.state,'active');
  game.step(178);assert.equal(game.snapshot().entities.car.translation,undefined);assert.equal(game.snapshot().entities.car.state,'active');
  game.step();let s=game.snapshot();assert.equal(s.entities.tow.x,686);assert.ok(s.entities.car.translation);assert.equal(s.entities.owner.state,'inactive');
  game.step(47);assert.equal(game.snapshot().entities.car.state,'active');game.step();s=game.snapshot();
  assert.equal(s.entities.car.state,'inactive');assert.equal(s.entities.car.space.height,12);assert.equal(s.entities.owner.state,'inactive','owner has not reacted to the tow yet');
  assert.equal(s.entities.tow.x-s.entities.car.x,56);game.step(100);s=game.snapshot();assert.ok(Math.abs(s.entities.tow.x-s.entities.car.x-56)<1e-8);
  assert.ok(s.entities.tow.translation);assert.ok(s.entities.car.translation);assert.equal(s.entities.owner.state,'inactive');
  game.step(32);s=game.snapshot();assert.equal(s.entities.owner.state,'active');assert.ok(s.entities.owner.translation);
  assert.ok(entityArtBounds(level,s,'car').x>entityArtBounds(level,s,'owner').x+entityArtBounds(level,s,'owner').width,'car passes the doorway before its owner emerges');
  game.step(228);assert.equal(game.snapshot().entities.tow.state,'inactive');assert.ok(game.snapshot().entities.owner.translation,'owner is still chasing after the car leaves');
  game.step(174);assert.equal(game.snapshot().entities.owner.state,'inactive');assert.equal(game.snapshot().entities.owner.x,1340);
});

test('scenery and animations are ordinary editable art; removing all art leaves the same simulation',()=>{
  const l=createTowStreetLevel(),bare=structuredClone(l);delete bare.scene;assert.deepEqual(run(l).snapshot(),run(bare).snapshot());
  const caller=l.scene.nodes.find(n=>n.bind?.id==='caller');assert.equal(artTransform(caller,l,undefined,{tick:30}).asset,'towCallerPoint');
  const game=createSimulation(l).start();game.click('caller');game.step();assert.equal(artTransform(caller,l,game.snapshot()).asset,'towCallerPhone');
  const store=createEditorStore();store.open('tow',l);store.change(d=>{d.scene.nodes.find(n=>n.id==='tow-caller').width=60;});
  assert.deepEqual(run(store.document()).snapshot(),run(l).snapshot());assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  store.undo();assert.deepEqual(store.document(),l);
  const rule=l.rules.find(r=>r.on.source==='tow'&&r.if?.some(c=>c.entity==='coupled'&&c.state==='inactive'));
  l.rules=l.rules.filter(r=>r!==rule);assert.equal(run(l).snapshot().status,'lost','missing the hook sequence cannot magically clear the obstacle');
});
