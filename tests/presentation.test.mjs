import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstLevel} from '../src/editor/first-level.js';
import {validateLevel} from '../src/core/schema.js';
import {createSimulation} from '../src/core/engine.js';

test('presentation metadata is editable, validated, and independent from the simulation',()=>{
  const l=createFirstLevel(),object=l.entities[0];object.presentation={symbol:'cloud',color:'#b6e3df',animation:'bob'};
  assert.equal(validateLevel(l).valid,true);
  for(const bad of [{symbol:'script',color:'#ff0000',animation:'none'},{symbol:'cloud',color:'url(evil)',animation:'bob'},{symbol:'cloud',color:'#ff0000',animation:'random'}]){
    object.presentation=bad;assert.equal(validateLevel(l).valid,false);
  }
});

test('animation frames and hit geometry use simulation ticks without changing physics',async()=>{
  const {presentationFrame,presentationBounds}=await import('../src/render/presentation.js');
  const l=createFirstLevel(),e={...l.entities.find(e=>e.id==='umbrella'),presentation:{symbol:'umbrella',color:'#f2b655',animation:'bob'},state:'active'};
  const original=structuredClone(e),a=presentationFrame(e,0,true),b=presentationFrame(e,20,true);
  assert.notEqual(a.offsetY,b.offsetY);assert.equal(presentationFrame(e,20,false).offsetY,0);assert.deepEqual(e,original);
  const bounds=presentationBounds(e);assert.ok(bounds.width>e.width);assert.ok(bounds.y<e.y-e.height);
  assert.ok(bounds.y<=e.y-e.height-32,'the open canopy stays inside the clickable scene bounds');
  const s=createSimulation(l);s.start().step(20);const state=s.snapshot();for(let i=0;i<300;i++)presentationFrame(e,i,true);assert.deepEqual(s.snapshot(),state);
});
