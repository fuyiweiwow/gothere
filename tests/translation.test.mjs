import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,validateLevel,replayRecording} from '../src/core/engine.js';
import {eventTypes} from '../src/core/schema.js';

const level=()=>({schemaVersion:1,id:'translation-test',name:'移动承托',description:'通用受控位移',
  world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
  actor:{x:120,y:300,speed:15},goal:{x:1100,y:440},platforms:[{x:0,y:440,width:1200}],
  entities:[{id:'carrier',kind:'object',label:'承托物',x:80,y:340,width:200,height:40,state:'active',collider:{enabled:true},
    behaviors:[{id:'travel',label:'行进',actions:[{type:'move',target:'carrier',x:320,y:280,ticks:120}]}]},
    {id:'receipt',kind:'object',label:'结束标记',x:1000,y:440,state:'inactive'}],
  rules:[{on:{source:'carrier',type:'click'},actions:[{type:'invoke',target:'carrier',behavior:'travel'}]},
    {on:{source:'carrier',type:'moved'},actions:[{type:'set',target:'receipt',state:'active'}]}]});

test('controlled translation carries real support and completes with a distinct moved event',()=>{
  const l=level(),v=validateLevel(l);assert.equal(v.valid,true,v.errors.join('\n'));
  assert.ok(eventTypes(l.entities[0]).includes('moved'));
  const s=createSimulation(l);s.start();s.click('carrier');s.step(60);
  const mid=s.snapshot();assert.equal(mid.entities.carrier.x,200);assert.equal(mid.entities.carrier.y,310);
  assert.equal(mid.actor.y,270);assert.ok(mid.actor.x>250&&mid.actor.x<260);assert.equal(mid.actor.support,'carrier');
  assert.equal(mid.entities.receipt.state,'inactive');s.step(60);
  const end=s.snapshot();assert.equal(end.entities.carrier.x,320);assert.equal(end.entities.carrier.y,280);
  assert.equal(end.entities.receipt.state,'active');assert.equal(end.entities.carrier.translation,undefined);
  assert.equal(end.signals.filter(x=>x.event==='moved').length,1);
  assert.deepEqual(replayRecording(l,s.recording()).snapshot(),end);
});

test('a replacement move starts at its real current position, pauses and resets deterministically',()=>{
  const l=level();l.entities[0].behaviors.push({id:'return',label:'返程',actions:[{type:'move',target:'carrier',x:80,y:340,ticks:30}]});
  l.rules.push({on:{source:'receipt',type:'click'},actions:[{type:'invoke',target:'carrier',behavior:'return'}]});
  const s=createSimulation(l);s.start();s.click('carrier');s.step(30);const x=s.snapshot().entities.carrier.x;
  s.pause();s.step(100);assert.equal(s.snapshot().entities.carrier.x,x);s.start();s.click('receipt');s.step();
  assert.ok(s.snapshot().entities.carrier.x<x&&s.snapshot().entities.carrier.x>80);s.step(29);
  assert.equal(s.snapshot().entities.carrier.x,80);assert.equal(s.snapshot().entities.carrier.y,340);
  s.reset();assert.equal(s.snapshot().entities.carrier.x,80);assert.equal(s.snapshot().entities.carrier.translation,undefined);
});

test('translation also moves rotated support without presentation and does not wait for behavior done',()=>{
  const l=level(),e=l.entities[0];delete e.collider;e.y=300;e.height=12;e.pose={angle:0,pivot:0};e.surface={enabled:true};
  l.rules.push({on:{source:'carrier',type:'done',behavior:'travel'},actions:[{type:'set',target:'receipt',state:'active'}]});
  const s=createSimulation(l);s.start();s.click('carrier');s.step();
  assert.equal(s.snapshot().entities.receipt.state,'active');assert.ok(s.snapshot().entities.carrier.translation);
});

test('translation rejects invalid targets, geometry, durations and competing movement capabilities',()=>{
  for(const patch of [{target:'missing'},{x:-1},{x:1100},{y:100},{ticks:0},{ticks:1.5},{ticks:3601}]){
    const l=level();Object.assign(l.entities[0].behaviors[0].actions[0],patch);assert.equal(validateLevel(l).valid,false);
  }
  for(const capability of [{motion:{type:'patrol',minX:80,maxX:400,speed:30}},{body:{type:'dynamic'}},
    {transport:{type:'vertical',toY:200,speed:60}}]){
    const l=level();Object.assign(l.entities[0],capability);assert.equal(validateLevel(l).valid,false);
  }
  const tilted=level();delete tilted.entities[0].collider;tilted.entities[0].pose={angle:-70,pivot:0};
  assert.equal(validateLevel(tilted).valid,false,'the translated pose must stay inside supported world bounds');
});

test('picking up a moving object cancels travel and held move commands cannot pull it away',()=>{
  const l=level(),e=l.entities[0];delete e.collider;e.x=130;e.y=440;e.width=20;l.actor.y=440;
  e.behaviors[0].actions[0].y=440;
  l.rules.push({on:{source:'carrier',type:'contact'},actions:[{type:'hold',target:'carrier'}]});
  const s=createSimulation(l);s.start();s.click('carrier');s.step();
  assert.equal(s.snapshot().actor.holding,'carrier');assert.equal(s.snapshot().entities.carrier.translation,undefined);
  s.click('carrier');s.step(180);const end=s.snapshot();
  assert.equal(end.actor.holding,'carrier');assert.equal(end.entities.carrier.x,end.actor.x+8);
  assert.equal(end.entities.carrier.translation,undefined);assert.equal(end.entities.receipt.state,'inactive');
});
