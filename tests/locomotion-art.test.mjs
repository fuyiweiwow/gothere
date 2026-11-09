import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {commuterVisual} from '../src/editor/commuter-presentation.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {artTransform} from '../src/render/resources.js';
import {projectSpace} from '../src/core/spatial.js';
import {actorAnimationState} from '../src/core/locomotion.js';
import {levelToProject} from '../src/editor/javascript-project.js';
import {executeProject} from './helpers/project.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const hero=level=>level.scene.nodes.find(n=>n.bind?.type==='actor');

test('walking frames follow distance, so doubling speed does not slide the same feet over twice the road',()=>{
  const slow=createBusStopLevel(),fast=structuredClone(slow),node=hero(slow);
  node.animation.stride=.75;hero(fast).animation.stride=.75;fast.actor.speed*=2;
  const a=createSimulation(slow).start().step(11).snapshot(),b=createSimulation(fast).start().step(11).snapshot();
  const atDistance=createSimulation(slow).start().step(22).snapshot();
  assert.equal(artTransform(node,slow,atDistance).asset,artTransform(hero(fast),fast,b).asset);
  assert.notEqual(artTransform(node,slow,a).asset,artTransform(hero(fast),fast,b).asset);
  near(b.actor.walkDistance,22);
  assert.equal(artTransform(node,slow,a,{animate:false}).asset,node.animation.frames[0]);
  const paused={...a,status:'paused'};
  assert.equal(artTransform(node,slow,paused,{tick:999}).asset,artTransform(node,slow,a).asset);
});

test('stride measures the projected foot route through inward and outward passages and survives pause/reset/replay',()=>{
  const level=createLayeredLevel(),nodes=level.spatial.nodes;
  nodes.find(n=>n.id==='back-entry').next='front-turn';nodes.find(n=>n.id==='back-entry').via='alley';
  nodes.find(n=>n.id==='front-turn').next='start';delete nodes.find(n=>n.id==='front-turn').via;
  Object.assign(level.entities.find(e=>e.id==='alley').passage,{from:'back-entry',to:'front-turn'});
  level.actor={x:450,speed:90,space:{plane:'back',depth:210,height:0}};
  level.spatial.start='back-entry';level.goal={x:80,space:{plane:'front',depth:30,height:0}};
  const game=createSimulation(level).start();let previous=game.snapshot(),saw=false;
  const foot=a=>projectSpace(level,{x:a.x,...a.space});
  const start=projectSpace(level,nodes.find(n=>n.id==='back-entry')),end=projectSpace(level,nodes.find(n=>n.id==='front-turn'));
  const length=Math.hypot(end.x-start.x,end.y-start.y);
  for(let i=0;i<1600&&previous.status==='running';i++){
    game.step();const s=game.snapshot(),b=foot(s.actor);
    const total=s.actor.passage?Math.hypot(b.x-start.x,b.y-start.y):length+Math.abs(b.x-end.x);
    if(s.status==='running')near(s.actor.walkDistance,total);
    else assert.ok(Math.abs(s.actor.walkDistance-total)<=level.actor.speed/60,'the final tick can include a route-node turn');
    if(s.actor.passage){saw=true;assert.equal(actorAnimationState(level,s),'outward');}
    previous=s;
  }
  assert.ok(saw);assert.equal(previous.status,'won');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),previous);
  game.reset().start().step(10);game.pause();const paused=game.snapshot();game.step(10);assert.deepEqual(game.snapshot(),paused);
  game.reset();assert.equal(game.snapshot().actor.walkDistance,0);
});

test('turning from horizontal to depth walking keeps the foot-cycle phase continuous',()=>{
  const level=createLayeredLevel(),node=commuterVisual('hero',50);
  level.scene={background:'#ffffff',assets:[],nodes:[node]};
  const game=createSimulation(level).start();let prior=0,turns=0,previousState='walk-right';
  for(let i=0;i<1000;i++){
    game.step();const s=game.snapshot();if(s.status!=='running')break;
    const state=actorAnimationState(level,s),frame=Number(artTransform(node,level,s).asset.match(/(\d+)$/)[1])-1;
    if(state!==previousState){turns++;assert.ok((frame-prior+12)%12<=1,'a turn must not jump to an arbitrary foot pose');}
    prior=frame;previousState=state;
  }
  assert.ok(turns>=2);
});

test('inward/outward artwork does not inherit the previous horizontal mirror or change the foot anchor',()=>{
  const level=createLayeredLevel(),node=commuterVisual('hero',50),game=createSimulation(level).start();
  level.scene={background:'#ffffff',assets:[],nodes:[node]};
  const snapshot=game.snapshot();snapshot.actor.direction=-1;
  for(const [from,to,state]of [['front-turn','back-entry','inward'],['back-entry','front-turn','outward']]){
    snapshot.actor.passage={id:'alley',from,to,distance:200,travelled:50};
    const view=artTransform(node,level,snapshot);
    assert.equal(actorAnimationState(level,snapshot),state);assert.equal(view.flipX,false);
    near(view.x+view.width*56/112,snapshot.actor.x);
    near(view.y+view.height*90/96,projectSpace(level,{x:snapshot.actor.x,...snapshot.actor.space}).y);
  }
});

test('sample walking clips expose a configurable stride while still preserving legacy fps-only animations',async()=>{
  for(const level of [createBusStopLevel(),createCommuteChapter()]){
    const node=hero(level);
    for(const animation of [node.animation,node.variants.inward.animation,node.variants.outward.animation]){
      assert.ok(animation.frames.length>=12);assert.ok(animation.stride>0);
    }
    assert.equal(validateLevel(level).valid,true);
  }
  const level=createBusStopLevel(),node=hero(level);node.animation.stride=.6;
  assert.deepEqual(await executeProject(levelToProject(level,{typescript:true})),level);
  for(const stride of [0,-1,NaN,Infinity,'fast',5]){
    node.animation.stride=stride;assert.equal(validateLevel(level).valid,false,'invalid stride '+stride);
  }
  delete node.animation.stride;
  assert.equal(validateLevel(level).valid,true);
  const s=createSimulation(level).start().step(15).snapshot();
  assert.equal(artTransform(node,level,s).asset,node.animation.frames[Math.floor(15*node.animation.fps/60)%node.animation.frames.length]);
});
