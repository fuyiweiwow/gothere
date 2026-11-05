import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createSpatialLevel} from '../src/editor/spatial-level.js';
import {createBlankLevel} from '../src/editor/model.js';
import {createAuthoringAPI} from '../src/editor/authoring-api.js';
import {levelToJavaScript,portableJavaScript} from '../src/editor/javascript-source.js';
import {validateLevel,createSimulation,replayRecording} from '../src/core/engine.js';

function execute(source,base){
  const createAPI=level=>createAuthoringAPI(level,createBlankLevel('blank',{layered:true}));
  return runInNewContext('(function(level,api,createAPI){'+source+'\nreturn typeof createLevel === "function" ? createLevel(level,api,createAPI) : undefined;})(level,api,createAPI)',{level:base,api:createAPI(base),createAPI,structuredClone},{timeout:2000});
}
test('complete JS reproduces v1, v2 and v3 exactly without relying on the importing draft',()=>{
  for(const original of [createFirstLevel(),createSpatialLevel(),createCommuteChapter()]){
    const script=levelToJavaScript(original),copy=execute(script,createBlankLevel('other',{layered:true}));
    assert.deepEqual(JSON.parse(JSON.stringify(copy)),original);assert.equal(validateLevel(copy).valid,true);
    assert.equal(portableJavaScript(script,original),script);
  }
});
test('old base-dependent scripts export a portable complete file',()=>{
  const original=createCommuteChapter(),script=portableJavaScript('level.actor.speed += 2; return level;',original);
  const result=execute(script,createBlankLevel('other',{layered:true}));assert.equal(result.actor.speed,original.actor.speed+2);assert.equal(result.id,original.id);
});
test('object methods express behaviors and events without leaking functions into saved data',()=>{
  const level=createBlankLevel('oop',{layered:true}),api=createAuthoringAPI(level,level),item=api.object('cart',{x:400});
  item.behavior('leave',[item.set('inactive'),item.move({x:1300,seconds:2})]);
  item.on('click',[item.invoke('leave')],[item.condition('active')]);
  const serialized=JSON.parse(JSON.stringify(level));assert.equal(validateLevel(serialized).valid,true);
  assert.equal(serialized.entities[0].behaviors[0].actions[1].ticks,120);assert.equal(serialized.rules[0].on.source,'cart');
  assert.equal(typeof serialized.entities[0].move,'undefined');
});
test('generated source preserves prototype-shaped data as own properties',()=>{
  const original=createBlankLevel('keys',{layered:true});Object.defineProperty(original,'__proto__',{value:{test:true},enumerable:true,configurable:true});
  const result=execute(levelToJavaScript(original),createBlankLevel('other',{layered:true}));assert.equal(Object.hasOwn(result,'__proto__'),true);assert.equal(result.__proto__.test,true);
});
test('generated level preserves simulation and recording behavior',()=>{
  const original=createCommuteChapter(),level=execute(levelToJavaScript(original),createBlankLevel('other',{layered:true}));
  const game=createSimulation(level).start();game.step(100);assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
  const baseline=createSimulation(original).start();baseline.step(100);assert.deepEqual(game.snapshot(),baseline.snapshot());
});
