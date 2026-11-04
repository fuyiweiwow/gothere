import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusStopLevel,BUS_STOP_PLAN} from '../src/editor/bus-stop-level.js';
import {createSimulation,validateLevel,replayRecording} from '../src/core/engine.js';
import {artTransform,entityArtBounds} from '../src/render/resources.js';
import {createEditorStore} from '../src/editor/model.js';
import {moveArt} from '../src/editor/resources.js';

function run(level=createBusStopLevel(),plan=BUS_STOP_PLAN){
  const game=createSimulation(level).start();for(let t=1;t<=1200&&game.snapshot().status==='running';t++){
    for(const a of plan)if(a.tick===t)game.click(a.source);game.step();
  }return game;
}
test('bus slice has a causal solution, visible queue hazards and deterministic replay',()=>{
  const l=createBusStopLevel();assert.equal(validateLevel(l).valid,true);
  const game=run(l),s=game.snapshot();assert.equal(s.status,'won');assert.equal(s.tick,1045);
  for(const suffix of ['a','b','c'])assert.equal(s.entities['passenger-'+suffix].state,'inactive');
  assert.ok(entityArtBounds(l,s,'bus').x>l.world.width,'the entire vehicle must leave the visible canvas');assert.equal(s.entities.approach.state,'disabled');
  assert.ok(!l.entities.some(e=>e.id==='driver'));assert.ok(!l.scene.nodes.some(n=>n.asset==='stopRefusal'));
  assert.deepEqual(replayRecording(l,game.recording()).snapshot(),s);
  for(const plan of [[],[{source:'bus',tick:480}]]){const failed=run(l,plan).snapshot();assert.equal(failed.status,'lost');assert.equal(failed.reason,'hurt');assert.ok(failed.actor.x<550);}
  for(const tick of [1,120,240]){const s=run(l,[{source:'bus',tick}]).snapshot();assert.equal(s.status,'won','early input need not reset a coherent one-off event');assert.ok(entityArtBounds(l,s,'bus').x>1200);}
});

test('passengers walk to the entrance in order; moved events, not guesses, advance boarding',()=>{
  const l=createBusStopLevel(),game=createSimulation(l).start().step(179);game.click('bus');game.step();
  assert.equal(game.snapshot().entities.bus.state,'inactive');assert.ok(game.snapshot().entities['passenger-c'].translation);
  assert.equal(game.snapshot().entities['passenger-b'].translation,undefined);
  game.step(80);let s=game.snapshot();assert.equal(s.entities['passenger-c'].state,'active');assert.equal(s.entities['passenger-b'].translation,undefined);
  game.step();s=game.snapshot();assert.equal(s.entities['passenger-c'].state,'inactive');assert.equal(s.entities['passenger-c'].x,771);assert.ok(s.entities['passenger-b'].translation);
  assert.equal(s.entities['passenger-a'].translation,undefined);game.step(218);s=game.snapshot();
  assert.equal(s.entities['passenger-a'].state,'inactive');assert.equal(s.entities.bus.state,'inactive');
  game.step(30);assert.equal(game.snapshot().entities.bus.state,'active');assert.equal(game.snapshot().entities.bus.x,680);
  const faster=createBusStopLevel();faster.entities.find(e=>e.id==='passenger-c').behaviors[0].actions[0].ticks=41;
  const quick=createSimulation(faster).start();quick.click('bus');quick.step(41);
  assert.equal(quick.snapshot().entities['passenger-c'].state,'inactive');assert.ok(quick.snapshot().entities['passenger-b'].translation);
});

test('the closed bus starts as the walker approaches and moves continuously out of the scene',()=>{
  const game=createSimulation(createBusStopLevel()).start();game.click('bus');game.step(500);
  assert.equal(game.snapshot().entities.bus.x,680);assert.equal(game.snapshot().entities['depart-ready'].state,'active');
  game.step(60);assert.equal(game.snapshot().entities['depart-ready'].state,'inactive');assert.equal(game.snapshot().entities.bus.x,680);
  game.step(18);const a=game.snapshot().entities.bus.x;game.step();const b=game.snapshot().entities.bus.x;
  assert.ok(a>680&&b>a);assert.ok(b-a<3);
  const before=game.snapshot();game.click('bus');game.step();assert.equal(game.snapshot().entities.boarding.state,'inactive');assert.equal(game.snapshot().entities.bus.state,before.entities.bus.state);
});

test('continuous scenery is independent editable data; grouping, history and JSON preserve gameplay',()=>{
  const l=createBusStopLevel(),s=createEditorStore();s.open('bus',l);
  assert.ok(l.scene.nodes.some(n=>n.asset==='stopAtmosphere'&&n.width===1200));
  assert.ok(l.scene.nodes.some(n=>n.asset==='stopGround'&&n.width===1200));
  s.change(d=>{moveArt(d,'stop-left',20,-8);d.scene.nodes.find(n=>n.id==='stop-left').group='街区建筑';});
  assert.deepEqual(run(s.document()).snapshot(),run(l).snapshot());
  assert.deepEqual(createEditorStore(s.serialize()).document(),s.document());s.undo();assert.deepEqual(s.document(),l);
  const bare=structuredClone(l);delete bare.scene;assert.deepEqual(run(bare).snapshot(),run(l).snapshot());
  l.scene.nodes[0].group='x'.repeat(31);assert.equal(validateLevel(l).valid,false);
});

test('any active moving object can use a moving animation, while inactive visibility and explicit previews take precedence',()=>{
  const l=createBusStopLevel(),game=createSimulation(l).start(),n=l.scene.nodes.find(n=>n.bind?.id==='passenger-c');
  assert.equal(artTransform(n,l).asset,'stopPassengerCIdle');game.click('bus');game.step(8);const s=game.snapshot();
  assert.equal(artTransform(n,l,s).asset,'stopPassengerCWalk');assert.equal(artTransform(n,l,s,{animate:false}).asset,'stopPassengerCIdle');
  const withState=structuredClone(n);withState.variants.active={opacity:.4};assert.equal(artTransform(withState,l,s).opacity,.4);
  assert.equal(artTransform(n,l,s,{variant:'inactive'}).visible,false);assert.equal(artTransform(n,l,s,{variant:'active'}).asset,'stopPassengerCIdle');
  game.step(100);assert.equal(artTransform(n,l,game.snapshot()).visible,false);
  const bus=l.entities.find(e=>e.id==='bus');assert.ok(entityArtBounds(l,undefined,bus.id).width>bus.width*8,'scene clicks use visible vehicle dimensions');
  const generic={...n,id:'generic',bind:{type:'entity',id:'boarding'},asset:'stopWorkerIdle',variants:{moving:{asset:'stopWorkerWalk'}}};
  const snap=structuredClone(s);snap.entities.boarding.state='active';snap.entities.boarding.translation={ticks:60};assert.equal(artTransform(generic,l,snap).asset,'stopWorkerWalk');
});
