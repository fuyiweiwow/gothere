import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createBlankLevel,moveObject,resizeObject,createEditorStore} from '../src/editor/model.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {offscreenX,canPlaceOffscreen} from '../src/editor/offscreen.js';
import {artBounds} from '../src/render/resources.js';
import {createAuthoringAPI,AUTHORING_EXAMPLE} from '../src/editor/authoring-api.js';
import {validateLevel,createSimulation,replayRecording} from '../src/core/engine.js';

test('offscreen placement clears logical bounds and every bound art variant on either side',()=>{
  for(const id of ['bus','scooter'])for(const side of ['left','right']){
    const level=createCommuteChapter(),object=level.entities.find(e=>e.id===id);
    object.x=offscreenX(level,object,side);
    for(const node of level.scene.nodes.filter(n=>n.bind?.id===id))for(const variant of [undefined,...Object.keys(node.variants??{})]){
      const box=artBounds(node,level,null,{variant,animate:false});
      assert.ok(side==='left'?box.x+box.width<=-23.9:box.x>=1223.9,JSON.stringify({id,side,box}));
    }
    assert.equal(validateLevel(level).valid,true);
  }
});

test('dragging, resizing, persistence and undo support the same offscreen range as numeric editing',()=>{
  const level=createCommuteChapter(),ref={type:'entity',id:'scooter'},store=createEditorStore();store.open('offscreen',level);
  store.change(doc=>{moveObject(doc,ref,-400);resizeObject(doc,ref,'e',18,0);});
  const e=store.document().entities.find(e=>e.id===ref.id);assert.equal(e.x,-510);assert.equal(e.width,48);
  assert.equal(validateLevel(store.document()).valid,true);assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  store.undo();assert.deepEqual(store.document(),level);store.redo();assert.equal(store.document().entities.find(e=>e.id===ref.id).x,-510);
  moveObject(level,ref,-10000);assert.equal(level.entities.find(e=>e.id===ref.id).x,-1200);
  moveObject(level,ref,10000);assert.equal(level.entities.find(e=>e.id===ref.id).x,2370);
  moveObject(level,{type:'actor'},-10000);assert.equal(level.actor.x,25,'actor keeps map boundary');
  assert.equal(canPlaceOffscreen(level.entities.find(e=>e.id==='alley')),false);
});

test('oversized artwork reports unreachable offscreen placement instead of silently clipping',()=>{
  const level=createCommuteChapter(),e=level.entities.find(e=>e.id==='bus'),node=level.scene.nodes.find(n=>n.bind?.id==='bus');
  node.x=-2400;node.width=2400;assert.throws(()=>offscreenX(level,e,'right'),/范围/);
});

test('the JavaScript example compiles to ordinary playable DSL with reproducible replay',()=>{
  const base=createBlankLevel('base',{layered:true}),createAPI=level=>createAuthoringAPI(level,base);
  const generated=runInNewContext('(function(level,api,createAPI){'+AUTHORING_EXAMPLE+'})(level,api,createAPI)',{level:base,api:createAPI(base),createAPI},{timeout:1000});
  const level=JSON.parse(JSON.stringify(generated)),validation=validateLevel(level);assert.equal(validation.valid,true,validation.errors.join('\n'));
  const game=createSimulation(level).start();game.click('cart');game.step(1200);assert.equal(game.snapshot().status,'won');
  const unattended=createSimulation(level).start();unattended.step(1200);assert.equal(unattended.snapshot().status,'lost');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
});

test('authoring helpers accept references, replace named behaviors, and retain explicit movement semantics',()=>{
  const level=createBlankLevel('loop',{layered:true}),api=createAuthoringAPI(level,level);
  for(let i=0;i<3;i++){
    const e=api.object('item-'+i,{x:300+i*100});
    api.behavior(e,'leave',[api.move(e,{x:1300,seconds:2})]);
    api.behavior(e,'leave',[api.after(.25,[api.move(e,{x:-100,seconds:1.5})])]);
    api.on(e,'click',[api.invoke(e,'leave')],[api.condition(e,'active')]);
  }
  assert.equal(level.entities.length,3);assert.equal(level.rules.length,3);assert.equal(level.entities[0].behaviors.length,1);
  assert.equal(level.entities[0].behaviors[0].actions[0].ticks,15);assert.equal(validateLevel(level).valid,true);
  assert.throws(()=>api.entity('missing'),/找不到物体/);assert.throws(()=>api.move('item-0',{plane:'bad'}),/行走层/);assert.throws(()=>api.after(Infinity,[]),/时长/);assert.throws(()=>api.object('item-0'),/重复/);
});
