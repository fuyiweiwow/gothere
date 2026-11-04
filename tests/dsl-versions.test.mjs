import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLevel} from '../src/core/schema.js';
import {createSimulation,replayRecording} from '../src/core/engine.js';
import {createEditorStore} from '../src/editor/model.js';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createSpatialLevel} from '../src/editor/spatial-level.js';

test('spatial exports have an explicit version; horizontal DSL v1 stays playable without conversion',()=>{
  const spatial=createSpatialLevel();assert.equal(spatial.schemaVersion,2);assert.equal(validateLevel(spatial).valid,true);
  const old=createFirstLevel(),copy=structuredClone(old),store=createEditorStore();store.open('old',old);
  assert.deepEqual(store.document(),copy);assert.equal(old.schemaVersion,1);
  const sim=createSimulation(old).start().step(30);assert.deepEqual(replayRecording(old,sim.recording()).snapshot(),sim.snapshot());
  assert.deepEqual(old,copy);
});
test('previous spatial v1 drafts migrate without resetting content, active key or revision',()=>{
  const previous=createSpatialLevel();previous.schemaVersion=1;previous.name='我修改过的空间草稿';previous.platforms[1].space.heightEnd=76;
  const copy=structuredClone(previous),expected={...copy,schemaVersion:2};
  const store=createEditorStore(JSON.stringify({version:1,activeKey:'mine',workspaceRevision:'my-revision',documents:[{key:'mine',level:previous}]}));
  assert.equal(store.key(),'mine');assert.equal(store.revision(),'my-revision');assert.deepEqual(store.document(),expected);
  assert.deepEqual(createEditorStore(store.serialize()).document(),expected);assert.deepEqual(previous,copy);
  const imported=createEditorStore();imported.open('import',previous);assert.deepEqual(imported.document(),expected);
  imported.change(l=>l.actor.speed=80);imported.undo();assert.deepEqual(imported.document(),expected);imported.redo();assert.equal(imported.document().schemaVersion,2);
  assert.deepEqual(createSimulation(previous).start().step(10).snapshot(),createSimulation(expected).start().step(10).snapshot());
});
test('unknown future versions and v2 without spatial data are rejected rather than reinterpreted',()=>{
  for(const level of [{...createSpatialLevel(),schemaVersion:99},{...createFirstLevel(),schemaVersion:2}]){
    assert.equal(validateLevel(level).valid,false);assert.throws(()=>createSimulation(level));
    const store=createEditorStore();assert.throws(()=>store.open('bad',level));
  }
});
