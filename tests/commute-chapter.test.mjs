import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {placementAnchor} from '../src/core/placement.js';
import {artBounds} from '../src/render/resources.js';

function play(level=createCommuteChapter(),omit='',observe=()=>{}){
  const game=createSimulation(level).start(),used=new Set(),visits=new Set(),passages=new Set();
  for(let i=0;i<6000&&game.snapshot().status==='running';i++){
    const s=game.snapshot(),e=s.entities;observe(s);
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
  assert.equal(s.entities['scooter-awake'].state,'inactive');assert.ok(s.entities.scooter.x<0);assert.equal(s.entities.scooter.space.passage,undefined);
  assert.equal(s.entities.owner.state,'inactive');
  const {game}=play(l);s=game.snapshot();assert.equal(s.entities.blocked.state,'active');assert.equal(s.entities.barrier.draggable.enabled,false);
  assert.equal(s.entities.gap.dropTarget.enabled,false);assert.equal(s.entities['dog-fed'].state,'active');
});

test('all content survives JSON roundtrip and removing art does not change the route or outcome',()=>{
  const l=createCommuteChapter(),bare=JSON.parse(JSON.stringify(l));delete bare.scene;
  assert.deepEqual(play(bare).game.snapshot(),play(l).game.snapshot());
  const ids=new Set(l.entities.map(e=>e.id));for(const n of l.scene.nodes)if(n.bind?.type==='entity')assert.ok(ids.has(n.bind.id),n.id);
  const object=l.entities.find(e=>e.id==='scooter');assert.equal(object.space.plane,'far');assert.ok(object.x<0);
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

test('encounters enter once, recall at the actual road midpoint, and change ownership without jumping',()=>{
  const frames=[];play(undefined,'',s=>frames.push(s));
  const progress=frames.map(s=>s.entities.jaywalker.space.progress).filter(p=>p!==undefined);
  assert.equal(Math.min(...progress),.82);
  const directions=[];for(let i=1;i<progress.length;i++){
    const sign=Math.sign(progress[i]-progress[i-1]);if(sign&&sign!==directions.at(-1))directions.push(sign);
  }
  assert.deepEqual(directions,[-1,1],'the pedestrian enters only once before returning to the officer');
  const settled=frames.find(s=>s.entities.settled.state==='active');assert.ok(settled);
  for(const s of frames.filter(s=>s.tick>=settled.tick)){
    assert.equal(s.entities.jaywalker.space.plane,'middle');assert.equal(s.entities.jaywalker.x,1082);
  }
  assert.ok(frames[0].entities.scooter.x+frames[0].entities.scooter.width<0);
  assert.ok(frames.some(s=>s.entities.scooter.space.passage==='alley'));
  assert.ok(frames.some(s=>s.entities.car.space.passage==='tow-access'));
  assert.ok(frames.some(s=>s.entities.car.space.plane==='road'&&s.entities.car.x<1200));
  for(let i=1;i<frames.length;i++)for(const id of ['car','scooter']){
    const a=frames[i-1].entities[id],b=frames[i].entities[id];
    assert.ok(Math.hypot(a.x-b.x,a.space.depth-b.space.depth,a.space.height-b.space.height)<6,id+' moved discontinuously');
  }
  for(const s of frames.filter(s=>s.entities.coupled.state==='active')){
    assert.equal(s.entities.tow.space.plane,'road');assert.equal(s.entities.car.space.plane,'road');
    assert.ok(Math.abs(s.entities.tow.x-s.entities.car.x-45)<1e-6);
  }
});

test('chapter art binds the destination, hides the bus door and places breakfast in the dog bowl',()=>{
  const l=createCommuteChapter(),{game}=play(l),s=game.snapshot();
  assert.equal(l.entities.find(e=>e.id==='bus').space.plane,'bus-road');
  assert.equal(l.scene.nodes.some(n=>n.id==='stop-door'),false);assert.equal(l.entities.some(e=>e.id==='commuter'),false);
  const office=l.scene.nodes.find(n=>n.id==='chapter-office');assert.equal(office.bind.type,'goal');
  const goal=l.goal,bounds=artBounds(office,l);assert.ok(goal.x>bounds.x&&goal.x<bounds.x+bounds.width);
  assert.ok(Math.abs(bounds.y+bounds.height-(l.spatial.projection.originY-goal.space.depth))<12);
  assert.equal(s.entities.breakfast.state,'inactive');assert.equal(s.entities.breakfast.x,s.entities.bowl.x);
  assert.equal(s.entities.dog.x,710);assert.equal(l.scene.nodes.find(n=>n.id==='chapter-food').variants.inactive.asset,'blockMeal');
});
