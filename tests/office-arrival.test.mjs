import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfficeArrival} from '../src/editor/office-arrival.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {placementAnchor} from '../src/core/placement.js';

const place=(game,level,target)=>game.placeAt('parcel',placementAnchor(level,game.snapshot().entities[target]));
function play(level=createOfficeArrival(),omit='',observe=()=>{}){
  const game=createSimulation(level).start();let wedged=false,covered=false,closed=false;
  for(let i=0;i<3600&&game.snapshot().status==='running';i++){
    const s=game.snapshot();observe(s);
    if(!wedged&&s.tick>=60&&omit!=='door'){place(game,level,'door-gap');wedged=true;}
    if(!closed&&s.actor.space.plane==='gallery'&&omit!=='tap'){game.click('dispenser');closed=true;}
    if(!covered&&s.actor.space.plane==='gallery'&&omit!=='cardboard'){place(game,level,'wet-floor');covered=true;}
    game.step();
  }
  return game;
}

test('the office is a normal editable level; one item is used twice to reach the clock',()=>{
  const l=createOfficeArrival(),validation=validateLevel(l);assert.equal(validation.valid,true,validation.errors.join('\n'));
  const game=play(l),s=game.snapshot();assert.equal(s.status,'won',JSON.stringify(s.events));
  assert.ok(s.tick>2100&&s.tick<2800,'a compact 35–47 second scene');
  assert.equal(s.actor.space.plane,'gallery');assert.equal(s.entities.parcel.space.plane,'gallery');
  assert.equal(s.entities.parcel.x,s.entities['wet-floor'].x);assert.equal(s.entities.parcel.state,'inactive');
  assert.equal(s.entities.door.state,'active','taking back the box actually recloses the door');
  assert.equal(s.entities.dispenser.state,'inactive');assert.equal(s.entities['wet-floor'].state,'inactive');
  assert.deepEqual(game.recording().inputs.map(i=>[i.source,i.type??'click']),[['parcel','place'],['dispenser','click'],['parcel','place']]);
  assert.deepEqual(replayRecording(l,game.recording()).snapshot(),s);
});

test('omitting the doorstop, cardboard or closing the tap causes real contact failure',()=>{
  for(const [omit,cause]of [['door','door'],['cardboard','wet-floor'],['tap','wet-floor']]){
    const s=play(undefined,omit).snapshot();assert.equal(s.status,'lost',omit);assert.equal(s.reason,'hurt',omit);
    assert.equal(s.signals.findLast(signal=>signal.type==='lost')?.cause,cause,omit);
  }
});

test('a premature second use releases the door; an invalid drop keeps its existing placement',()=>{
  const l=createOfficeArrival(),g=createSimulation(l).start();place(g,l,'door-gap');g.step();
  assert.equal(g.snapshot().entities.door.state,'inactive');const wedged=structuredClone(g.snapshot().entities.parcel);
  g.placeAt('parcel',{x:950,y:80});g.step();assert.deepEqual(g.snapshot().entities.parcel,wedged);
  place(g,l,'wet-floor');g.step();assert.equal(g.snapshot().entities.door.state,'active');
  g.step(900);assert.equal(g.snapshot().status,'lost');
  assert.equal(g.snapshot().signals.findLast(s=>s.type==='lost')?.cause,'door');
});

test('ongoing water defeats cardboard after a delay; closing the source also rescues an already wet mat',()=>{
  const l=createOfficeArrival(),g=createSimulation(l).start();place(g,l,'wet-floor');g.step();
  assert.equal(g.snapshot().entities['wet-floor'].state,'inactive');g.step(151);
  assert.equal(g.snapshot().entities['wet-floor'].state,'active','the running tap wets the cardboard again');
  g.click('dispenser');g.step();assert.equal(g.snapshot().entities['wet-floor'].state,'inactive');
  g.step(100);assert.equal(g.snapshot().entities['wet-floor'].state,'inactive');
  // Moving the paper back to the door removes protection from the existing spill.
  place(g,l,'door-gap');g.step();assert.equal(g.snapshot().entities['wet-floor'].state,'active');
});

test('delivery actually travels through the connector and the plant is scanned as the employee approaches',()=>{
  const frames=[];const game=play(undefined,'',s=>frames.push(s)),s=game.snapshot();
  assert.equal(s.status,'won');assert.ok(frames.some(s=>s.entities.courier.space.passage==='corridor'));
  assert.ok(frames.some(s=>s.actor.passage?.id==='corridor'));assert.equal(s.entities.reader.state,'inactive');
  const scan=frames.find(s=>s.entities['scan-started'].state==='active');assert.ok(scan);
  assert.equal(scan.actor.space.plane,'gallery');assert.ok(scan.actor.x<540,'the employee has reached the reader approach zone');
  assert.ok(frames.some(s=>s.entities.guard.state==='inactive'));assert.ok(s.entities.courier.x<0);
  for(let i=1;i<frames.length;i++){
    const a=frames[i-1].entities.courier,b=frames[i].entities.courier;
    assert.ok(Math.hypot(a.x-b.x,a.space.depth-b.space.depth)<4,'delivery must not teleport between route legs');
  }
  assert.ok(!frames.some(s=>s.signals.some(signal=>signal.event==='moveblocked')));
});

test('artwork, serialization and swapped input order do not change gameplay',()=>{
  const level=createOfficeArrival(),bare=JSON.parse(JSON.stringify(level));delete bare.scene;
  assert.deepEqual(play(level).snapshot(),play(bare).snapshot());
  const g=createSimulation(level).start();place(g,level,'door-gap');g.step(1200);
  place(g,level,'wet-floor');g.step(30);g.click('dispenser');g.step(3000);assert.equal(g.snapshot().status,'won');
  const final=g.snapshot();g.placeAt('parcel',{x:431,y:520});g.click('dispenser');g.step(100);assert.deepEqual(g.snapshot(),final);
});
