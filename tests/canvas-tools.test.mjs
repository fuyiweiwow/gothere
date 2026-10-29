import test from 'node:test';
import assert from 'node:assert/strict';
import {zoomAt} from '../src/editor/viewport.js';
import {alignMove} from '../src/editor/alignment.js';
import {createBlankLevel,resizeObject} from '../src/editor/model.js';

test('local zoom preserves the world point under the cursor and clamps the scale',()=>{
  const camera={zoom:1,left:300,top:100},x=120,y=60,next=zoomAt(camera,2,x,y);
  assert.equal((next.left+x)/next.zoom,camera.left+x);assert.equal((next.top+y)/next.zoom,camera.top+y);
  assert.equal(zoomAt(camera,100,x,y).zoom,4);assert.equal(zoomAt(camera,.01,x,y).zoom,.5);
});

test('alignment snaps edges and centers smoothly from the immutable drag start and Alt bypasses it',()=>{
  const box={x:20,y:30,width:40,height:60},targets=[{x:100,y:150,width:60,height:70}];
  assert.deepEqual(alignMove(box,targets,38,58),{dx:40,dy:60,guides:[{axis:'x',position:100},{axis:'y',position:150}]});
  assert.deepEqual(alignMove(box,targets,38,58,{disabled:true}),{dx:38,dy:58,guides:[]});
  assert.equal(alignMove(box,targets,38,58,{threshold:1}).dx,38);
  assert.equal(alignMove(box,[],12.3,4.2).dx,12.3,'no forced 10-unit jumps');
});

test('a road becomes sloped by moving either endpoint without a separate slope capability',()=>{
  const l=createBlankLevel('road');resizeObject(l,{type:'platform',index:0},'e',0,-80);
  assert.equal(l.platforms[0].yEnd,360);assert.ok(l.world.physics);
  resizeObject(l,{type:'platform',index:0},'w',0,20);assert.equal(l.platforms[0].y,460);assert.equal(l.platforms[0].yEnd,360);
});
