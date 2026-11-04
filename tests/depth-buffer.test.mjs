import test from 'node:test';
import assert from 'node:assert/strict';
import {createDepthBuffer} from '../src/render/depth-buffer.js';

const quad=(z,color)=>({points:[{x:0,y:0,depth:z},{x:8,y:0,depth:z},{x:8,y:8,depth:z},{x:0,y:8,depth:z}],color});
const pixel=(frame,x,y)=>[...frame.data.slice((y*frame.width+x)*4,(y*frame.width+x)*4+4)];
test('interpolated depth resolves crossing surfaces independent of submission order',()=>{
  const slope={points:[{x:0,y:0,depth:2},{x:8,y:0,depth:10},{x:8,y:8,depth:10},{x:0,y:8,depth:2}],color:[255,0,0,255]};
  for(const commands of [[slope,quad(6,[0,0,255,255])],[quad(6,[0,0,255,255]),slope]]){
    const frame=createDepthBuffer(8,8);frame.render(commands);
    assert.deepEqual(pixel(frame,1,3),[255,0,0,255]);assert.deepEqual(pixel(frame,6,3),[0,0,255,255]);
  }
});
test('transparent faces blend far to near and do not duplicate a polygon diagonal',()=>{
  const frame=createDepthBuffer(8,8);
  for(const commands of [[quad(8,[255,0,0,128]),quad(4,[0,0,255,128])],[quad(4,[0,0,255,128]),quad(8,[255,0,0,128])]]){
    frame.render(commands);assert.deepEqual(pixel(frame,3,3),[85,0,170,192]);
  }
  frame.render([quad(4,[0,255,0,255]),quad(8,[255,0,0,128])]);assert.deepEqual(pixel(frame,3,3),[0,255,0,255]);
});
test('sprite alpha holes preserve geometry; depth lines cannot bleed through a closer sprite',()=>{
  const frame=createDepthBuffer(8,8),sprite={x:2,y:2,width:2,height:1,depth:2,data:new Uint8ClampedArray([255,255,0,255,255,255,0,0])};
  frame.render([quad(8,[0,0,255,255]),sprite,{a:{x:0,y:2.5,depth:5},b:{x:8,y:2.5,depth:5},width:1,color:[255,0,0,255]}]);
  assert.deepEqual(pixel(frame,2,2),[255,255,0,255]);assert.deepEqual(pixel(frame,3,2),[255,0,0,255]);
  frame.render([quad(8,[0,0,255,255])]);assert.deepEqual(pixel(frame,2,2),[0,0,255,255]);
});
test('offscreen and degenerate triangles are clipped without allocating outside the viewport',()=>{
  const frame=createDepthBuffer(8,8);frame.render([{points:[{x:-10,y:-10,depth:0},{x:-1,y:-10,depth:0},{x:-1,y:-1,depth:0}],color:[255,0,0,255]},
    {points:[{x:1,y:1,depth:0},{x:1,y:1,depth:0},{x:2,y:2,depth:0}],color:[255,0,0,255]}]);
  assert.equal(frame.data.some(v=>v!==0),false);
});
