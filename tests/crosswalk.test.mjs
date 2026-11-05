import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrosswalkLevel,CROSSWALK_PLAN} from '../src/editor/crosswalk-level.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {artTransform} from '../src/render/resources.js';

function run(level=createCrosswalkLevel(),plan=CROSSWALK_PLAN){
  const game=createSimulation(level).start();for(let tick=1;tick<=1800&&game.snapshot().status==='running';tick++){
    for(const p of plan)if(tick===p.tick)game.click(p.source);game.step();
  }return game;
}

test('the crosswalk vignette clears by real retreat and sidewalk motion, and replays deterministically',()=>{
  const l=createCrosswalkLevel();assert.equal(validateLevel(l).valid,true,validateLevel(l).errors.join('\n'));
  const game=run(l),s=game.snapshot();assert.equal(s.status,'won');assert.ok(s.tick>1300&&s.tick<1450);
  assert.equal(s.actor.space.plane,'far');assert.equal(s.actor.space.height,0);assert.equal(s.actor.direction,-1);
  assert.equal(s.entities.jaywalker.space.plane,'far');assert.equal(s.entities.jaywalker.space.passage,undefined);assert.equal(s.entities.jaywalker.x,599);
  assert.equal(s.entities.signal.state,'inactive');assert.equal(s.entities.officer.state,'inactive');assert.equal(s.entities.jaywalker.state,'active');
  assert.deepEqual(replayRecording(l,game.recording()).snapshot(),s);
});

test('inaction and a late warning fail; anticipation works and repeated clicks cannot restart the scene',()=>{
  for(const plan of [[],[{source:'officer',tick:450}]])assert.equal(run(undefined,plan).snapshot().status,'lost');
  for(const tick of [1,120,240,300])assert.equal(run(undefined,[{source:'officer',tick}]).snapshot().status,'won');
  const spam=Array.from({length:20},(_,i)=>({source:'officer',tick:240+i*5}));assert.deepEqual(run(undefined,spam).snapshot().entities,run().snapshot().entities);
});

test('a proximity trigger starts jaywalking once; a real arrival precedes retreat, clearance and the phone gag',()=>{
  const l=createCrosswalkLevel(),game=createSimulation(l).start();game.step(230);assert.equal(game.snapshot().entities.intrusion.state,'inactive');
  game.step(10);let s=game.snapshot();assert.equal(s.entities.intrusion.state,'active');assert.ok(s.entities.jaywalker.space.progress<1);
  game.click('officer');game.step(114);s=game.snapshot();assert.equal(s.entities.lecture.state,'active');assert.equal(s.entities.signal.state,'active');
  game.step(72);s=game.snapshot();assert.equal(s.entities.jaywalker.space.plane,'far');assert.equal(s.entities.jaywalker.x,520);assert.ok(s.entities.jaywalker.translation);
  game.step(72);s=game.snapshot();assert.equal(s.entities.settled.state,'active');assert.equal(s.entities.signal.state,'inactive');assert.equal(s.entities.jaywalker.state,'inactive');
  game.step(186);assert.equal(game.snapshot().entities.officer.state,'inactive');assert.equal(game.snapshot().entities.jaywalker.state,'inactive');
  game.step(36);assert.equal(game.snapshot().entities.jaywalker.state,'active');
});

test('inward movement uses an actual equal-height passage, and visual editing does not affect play',()=>{
  const l=createCrosswalkLevel(),bare=structuredClone(l);delete bare.scene;assert.deepEqual(run(l).snapshot(),run(bare).snapshot());
  const game=createSimulation(l).start();game.step(180);game.click('officer');game.step(450);const s=game.snapshot();
  assert.ok(s.actor.passage);assert.equal(s.actor.space.height,0);assert.ok(s.actor.space.depth>80&&s.actor.space.depth<220);
  const n=l.scene.nodes.find(n=>n.bind?.type==='actor');assert.match(artTransform(n,l,s).asset,/^crossHeroIn/);
  const changed=structuredClone(l);changed.scene.nodes.find(n=>n.id==='cross-walker').width=70;assert.deepEqual(run(changed).snapshot(),run(l).snapshot());
});
