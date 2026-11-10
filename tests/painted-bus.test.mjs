import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createPaintedBusStopLevel} from '../src/editor/painted-bus-stop.js';
import {createBusStopLevel,BUS_STOP_PLAN} from '../src/editor/bus-stop-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {ASSETS} from '../src/content/library.js';
import {validateLevel,createSimulation,replayRecording} from '../src/core/engine.js';
import {artTransform,entityArtBounds} from '../src/render/resources.js';
import {createFeedbackPlayer} from '../src/render/feedback.js';
import {layeredArtOrder} from '../src/render/layered.js';
import {levelToProject} from '../src/editor/javascript-project.js';
import {executeProject} from './helpers/project.mjs';

const visual=level=>level.scene.nodes.find(n=>n.bind?.type==='actor');

test('the bus stays on the foreground road and its boarding doors face away from the camera',()=>{
  const level=createPaintedBusStopLevel(),bus=level.entities.find(e=>e.id==='bus');
  const road=level.spatial.planes.find(p=>p.id===bus.space.plane),street=level.spatial.planes.find(p=>p.id===level.actor.space.plane);
  assert.notEqual(road.id,street.id,'vehicles must not inherit the sidewalk plane from the old slice');
  assert.ok(road.depth<street.depth&&road.order>street.order,'the road is closer to the camera than the queue');
  assert.ok(!level.scene.nodes.some(n=>n.id==='stop-door'),'far-side door leaves must not be visible');
  assert.equal(level.scene.nodes.find(n=>n.id==='stop-bus').asset,'paintedBusBack');
  assert.ok(!level.scene.feedback.some(f=>f.target==='stop-door'),'removed leaves must not retain feedback slots');
  const order=layeredArtOrder(level).map(n=>n.id);
  for(const id of ['stop-player','stop-person-a','stop-person-b','stop-person-c'])
    assert.ok(order.indexOf('stop-bus')>order.indexOf(id),'the bus must occlude people boarding from the sidewalk');
  const game=createSimulation(level).start();game.click('bus');
  for(let tick=0;tick<=900;tick++){
    const state=game.snapshot(),view=artTransform(level.scene.nodes.find(n=>n.id==='stop-bus'),level,state);
    assert.ok(view.y+view.height>=550,'wheel contact stays below the curb throughout departure');
    assert.equal(state.entities.bus.space.plane,road.id);
    assert.equal(state.entities.bus.space.depth,road.depth);
    game.step();
  }
});
function run(level,plan=BUS_STOP_PLAN){
  const game=createSimulation(level).start();
  for(let t=1;t<=1200&&game.snapshot().status==='running';t++){
    for(const action of plan)if(action.tick===t)game.click(action.source);
    game.step();
  }
  return game;
}

test('the corrected street/road layout preserves the causal sequence and its timing',()=>{
  const painted=createPaintedBusStopLevel(),original=createBusStopLevel();
  assert.equal(validateLevel(painted).valid,true,validateLevel(painted).errors.join('\n'));
  assert.deepEqual(painted.rules,original.rules);
  assert.deepEqual(painted.actor,original.actor);
  assert.deepEqual(painted.entities.filter(e=>e.id!=='bus'),original.entities.filter(e=>e.id!=='bus'));
  const outcome=s=>({actor:s.actor,status:s.status,tick:s.tick,reason:s.reason,signals:s.signals,clicks:s.clicks});
  const success=run(painted);assert.equal(success.snapshot().status,'won');
  assert.deepEqual(outcome(success.snapshot()),outcome(run(original).snapshot()));
  assert.deepEqual(replayRecording(painted,success.recording()).snapshot(),success.snapshot());
  assert.ok(entityArtBounds(painted,success.snapshot(),'bus').x>painted.world.width);
  const failed=run(painted,[]).snapshot();assert.equal(failed.status,'lost');assert.equal(failed.signals.find(s=>s.type==='lost').cause,'passenger-a');
  assert.deepEqual(outcome(failed),outcome(run(original,[]).snapshot()));
});

test('new idle, moving and terminal clips never switch back to old artwork',()=>{
  const level=createPaintedBusStopLevel(),library=new Map(ASSETS.map(a=>[a.id,a]));
  for(const node of level.scene.nodes){
    const images=[node.asset,...(node.animation?.frames??[]),...Object.values(node.variants??{}).flatMap(v=>[v.asset,...(v.animation?.frames??[])].filter(Boolean))];
    assert.ok(images.every(id=>id.startsWith('painted')),node.id);
    assert.ok(images.every(id=>library.has(id)),node.id);
  }
  const game=createSimulation(level).start(),hero=visual(level);
  assert.equal(hero.asset,'paintedHeroIdle');
  game.step(10);assert.match(artTransform(hero,level,game.snapshot()).asset,/^paintedHeroWalk/);
  game.click('bus');game.step(10);
  const person=level.scene.nodes.find(n=>n.id==='stop-person-c');
  assert.match(artTransform(person,level,game.snapshot()).asset,/^paintedPassengerCWalk/);
  const lost=run(level,[]).snapshot(),feedback=createFeedbackPlayer(level);
  const first=feedback.sample(lost),final=feedback.sample(lost,{endingTicks:90});
  assert.equal(first.frames[hero.id],'paintedHeroFall1');assert.equal(final.frames[hero.id],'paintedHeroFall6');
  assert.equal(final.tailFinished,true);
  for(const clip of [hero.animation,...level.scene.feedback.filter(f=>f.animation).map(f=>f.animation)])
    for(const frame of clip.frames){assert.equal(library.get(frame).width,192);assert.equal(library.get(frame).height,192);}
  assert.equal(visual(createBusStopLevel()).asset,'toonCommuterIdle');
  assert.equal(visual(createCommuteChapter()).asset,'toonCommuterIdle');
});

test('all body states retain the authored ground anchor and background pieces are independently editable',()=>{
  const level=createPaintedBusStopLevel(),hero=visual(level),game=createSimulation(level).start();
  for(const state of [game.snapshot(),game.step(50).snapshot(),run(level,[]).snapshot(),run(level).snapshot()]){
    const transform=artTransform(hero,level,state);
    assert.ok(Math.abs(transform.y+transform.height*180/192-490)<1e-8);
  }
  for(const id of ['stop-sky','stop-left','stop-middle','stop-right','stop-ground','stop-shelter','stop-tree-left'])
    assert.ok(level.scene.nodes.some(n=>n.id===id));
  level.scene.nodes.find(n=>n.id==='stop-shelter').x+=100;
  assert.deepEqual(run(level).snapshot(),run(createPaintedBusStopLevel()).snapshot());
});

test('raster formats and provenance survive bundling without labeling generated art as CC0',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/library.json',import.meta.url),'utf8'));
  const generated=manifest.filter(a=>a.file.startsWith('generated/painted-bus-v1/'));
  assert.equal(generated.length,41);
  let bytes=0;
  for(const entry of generated){
    assert.match(entry.license,/AI-generated/);assert.doesNotMatch(entry.license,/CC0/);
    const asset=ASSETS.find(a=>a.id===entry.id);
    assert.ok(asset.src.startsWith('data:image/'+(entry.file.endsWith('.webp')?'webp':'png')+';base64,'));
    bytes+=(await stat(new URL('../assets/'+entry.file,import.meta.url))).size;
  }
  assert.ok(bytes<1_500_000,'the trial should remain a small offline asset pack');
});

test('painted scene and animation bindings round trip as an editable typed project',async()=>{
  const level=createPaintedBusStopLevel();
  assert.deepEqual(await executeProject(levelToProject(level,{typescript:true})),level);
});
