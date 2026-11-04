import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialLevel} from '../src/editor/spatial-level.js';
import {createSimulation} from '../src/core/engine.js';
import {validateLevel} from '../src/core/schema.js';
import {projectSpace,spaceBounds} from '../src/core/spatial.js';
import {moveObject,resizeObject,createEditorStore,addObject} from '../src/editor/model.js';

test('spatial demonstration is ordinary editable data, succeeds with normal click behavior and fails if omitted',()=>{
  const l=createSpatialLevel();assert.deepEqual(validateLevel(l),{valid:true,errors:[]});
  const s=createSimulation(l).start();s.click('traffic');s.step(3600);assert.equal(s.snapshot().status,'won');
  const failed=createSimulation(l).start().step(3600).snapshot();assert.equal(failed.status,'lost');assert.equal(failed.reason,'hurt');
});
test('screen dragging changes world ground position and preserves elevation and the starting route anchor',()=>{
  const l=createSpatialLevel(),before=structuredClone(l.actor),p=projectSpace(l,{x:before.x,...before.space});
  moveObject(l,{type:'actor'},28,-26);
  const after=projectSpace(l,{x:l.actor.x,...l.actor.space});
  assert.ok(Math.abs(after.x-p.x-28)<1e-6);assert.ok(Math.abs(after.y-p.y+26)<1e-6);
  assert.equal(l.actor.space.height,before.space.height);
  const start=l.spatial.nodes.find(n=>n.id===l.spatial.start);assert.equal(start.x,l.actor.x);assert.equal(start.depth,l.actor.space.depth);
});
test('spatial resize does not alter legacy y or world height; new generic items have authored space',()=>{
  const l=createSpatialLevel(),e=l.entities[0],h=e.space.height,b=spaceBounds(l,e.kind,e);
  resizeObject(l,{type:'entity',id:e.id},'e',30,0);assert.equal(e.width,b.width-Math.abs(l.spatial.projection.depthX)*e.space.depthSize+30);
  assert.equal(e.space.height,h);assert.equal(e.y,undefined);
  const ref=addObject(l,'object',600,440);assert.ok(l.entities.find(e=>e.id===ref.id).space);
  const store=createEditorStore();store.open('demo',l);assert.equal(store.document().spatial.start,l.spatial.start);
});
