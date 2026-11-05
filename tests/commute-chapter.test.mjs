import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {placementAnchor} from '../src/core/placement.js';
import {artBounds} from '../src/render/resources.js';

function play(level=createCommuteChapter(),omit=''){
  const game=createSimulation(level).start(),used=new Set(),visits=new Set(),passages=new Set();
  for(let i=0;i<6000&&game.snapshot().status==='running';i++){
    const s=game.snapshot(),e=s.entities;
    const click=(id,ready)=>{if(ready&&!used.has(id)&&id!==omit){game.click(id);used.add(id);}};
    const place=(id,target,ready)=>{if(ready&&!used.has(id)&&id!==omit){game.placeAt(id,placementAnchor(level,e[target]));used.add(id);}};
    visits.add(s.actor.space.plane);if(s.actor.passage)passages.add(s.actor.passage.id);
    click('bus',s.tick>=60);
    click('officer',e.intrusion.state==='active');
    click('caller',e['tow-ready'].state==='active');
    place('barrier','gap',e['scooter-awake'].state==='active');
    place('breakfast','bowl',s.actor.space.plane==='far'&&s.actor.x>360);
    game.step();
  }
  return {game,visits,passages};
}

test('one continuous commute visits three streets and two equal-height inward passages',()=>{
  const l=createCommuteChapter(),v=validateLevel(l);assert.equal(v.valid,true,v.errors.join('\n'));
  const {game,visits,passages}=play(l),s=game.snapshot();assert.equal(s.status,'won',JSON.stringify(s.events));
  assert.deepEqual([...visits],['front','middle','far']);assert.deepEqual([...passages],['crosswalk','alley']);
  assert.equal(s.actor.space.height,0);assert.equal(s.actor.space.plane,'far');assert.ok(s.tick>3000&&s.tick<3900);
  assert.deepEqual(replayRecording(l,game.recording()).snapshot(),s);
  assert.equal(s.entities.scooter.space.passage,undefined);assert.equal(s.entities.scooter.space.plane,'far');
  assert.ok(s.entities.bus.x>1200);assert.ok(s.entities.car.x>1200);assert.ok(s.entities.tow.x>1200);assert.ok(s.entities.owner.x>1200);
});

test('each encounter remains necessary; crossing and scooter failures occur on physical contact',()=>{
  for(const id of ['bus','officer','caller','barrier','breakfast']){
    const {game}=play(undefined,id),s=game.snapshot();assert.equal(s.status,'lost',id);assert.equal(s.reason,'hurt',id);
    if(id==='officer'){assert.ok(s.actor.passage);assert.equal(s.actor.passage.id,'crosswalk');assert.ok(s.actor.passage.travelled>0);}
    if(id==='barrier'){assert.ok(s.actor.passage);assert.equal(s.actor.passage.id,'alley');assert.ok(s.actor.passage.travelled>0);}
  }
});

test('later episodes sleep until approached and barrier placement is resolved before the rider decides',()=>{
  const l=createCommuteChapter(),g=createSimulation(l).start();g.click('caller');g.click('officer');g.step(1);
  let s=g.snapshot();assert.equal(s.entities.tow.state,'inactive');assert.equal(s.entities.noticed.state,'inactive');
  assert.equal(s.entities['scooter-awake'].state,'inactive');assert.equal(s.entities.scooter.space.progress,1);
  assert.equal(s.entities.owner.state,'inactive');
  const {game}=play(l);s=game.snapshot();assert.equal(s.entities.blocked.state,'active');assert.equal(s.entities.barrier.draggable.enabled,false);
  assert.equal(s.entities.gap.dropTarget.enabled,false);assert.equal(s.entities['dog-fed'].state,'active');
});

test('all content survives JSON roundtrip and removing art does not change the route or outcome',()=>{
  const l=createCommuteChapter(),bare=JSON.parse(JSON.stringify(l));delete bare.scene;
  assert.deepEqual(play(bare).game.snapshot(),play(l).game.snapshot());
  const ids=new Set(l.entities.map(e=>e.id));for(const n of l.scene.nodes)if(n.bind?.type==='entity')assert.ok(ids.has(n.bind.id),n.id);
  const object=l.entities.find(e=>e.id==='scooter');assert.equal(object.space.passage,'alley');
  assert.ok(l.entities.length<=64);assert.equal(l.spatial.planes.filter(p=>['front','middle','far'].includes(p.id)).length,3);
  for(const id of ['crosswalk','alley']){
    const node=l.scene.nodes.find(n=>n.bind?.id===id);assert.equal(node.fitPassage,true);
    const changed=structuredClone(l),passage=changed.entities.find(e=>e.id===id).passage;
    for(const endpoint of changed.spatial.nodes.filter(n=>[passage.from,passage.to].includes(n.id)))endpoint.x-=35;
    assert.equal(Math.round(artBounds(node,l).x-artBounds(node,changed).x),35);
  }
});

test('late repeated bus inputs and after-failure placement cannot bypass the queue collision',()=>{
  const l=createCommuteChapter(),g=createSimulation(l).start();
  for(let i=0;i<700&&g.snapshot().status==='running';i++){
    if(i>=240&&i<265)g.click('bus');g.step();
  }
  const failed=g.snapshot();assert.equal(failed.status,'lost');assert.equal(failed.reason,'hurt');
  g.placeAt('barrier',placementAnchor(l,l.entities.find(e=>e.id==='gap')));g.step();assert.deepEqual(g.snapshot(),failed);
});
