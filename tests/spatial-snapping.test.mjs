import test from 'node:test';
import assert from 'node:assert/strict';
import {snapSpacePoint} from '../src/editor/spatial-snapping.js';
import {createSpatialLevel} from '../src/editor/spatial-level.js';
import {projectSpace,unprojectSpace} from '../src/core/spatial.js';
test('snapping uses projected screen distance while retaining the chosen elevation',()=>{
  const l=createSpatialLevel(),target=l.spatial.nodes.find(n=>n.id==='near-turn'),p=projectSpace(l,target),candidate=unprojectSpace(l,{x:p.x+4,y:p.y+3},target.height);
  assert.deepEqual(snapSpacePoint(l,candidate,{threshold:10}),{x:target.x,depth:target.depth,height:target.height});
  assert.deepEqual(snapSpacePoint(l,candidate,{threshold:2}),candidate);assert.deepEqual(snapSpacePoint(l,candidate,{disabled:true}),candidate);
});
test('point snapping does not join different heights and excluded nodes cannot snap to themselves',()=>{
  const l=createSpatialLevel(),target=l.spatial.nodes.find(n=>n.id==='ramp-top'),p={x:target.x+.2,depth:target.depth+.2,height:target.height};
  assert.deepEqual(snapSpacePoint(l,p,{exclude:target.id,surfaces:false}),p);
  const q={...p,height:0};assert.deepEqual(snapSpacePoint(l,q,{surfaces:false}),q);
});
test('surface corners are optional and never relax the runtime support model',()=>{
  const l=createSpatialLevel(),p={x:41,depth:21,height:0};
  assert.deepEqual(snapSpacePoint(l,p,{nodes:false}),{x:40,depth:20,height:0});
  assert.deepEqual(snapSpacePoint(l,p,{nodes:false,surfaces:false}),p);
});
