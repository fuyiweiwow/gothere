import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankLevel,createEditorStore,addObject,copyObject,pasteObject,deleteObject,ruleWires,deleteWire} from '../src/editor/model.js';
test('copy/paste preserves geometry and rewrites self behavior references without duplicating scene wires',()=>{
  const level=createBlankLevel('copy'),r=addObject(level,'object',300);level.entities[0].height=80;
  level.entities[0].behaviors=[{id:'pickup',label:'拿起',actions:[{type:'after',ticks:5,actions:[{type:'hold',target:r.id}]}]}];
  level.rules=[{on:{type:'contact',source:r.id},actions:[{type:'invoke',target:r.id,behavior:'pickup'}]}];
  const clip=copyObject(level,r),store=createEditorStore();store.open('map',level);
  let pasted;store.change(d=>{pasted=pasteObject(d,clip);});const doc=store.document(),e=doc.entities[1];
  assert.equal(e.height,80);assert.equal(e.x,320);assert.equal(e.id,pasted.id);assert.notEqual(e.id,r.id);
  assert.equal(e.behaviors[0].actions[0].actions[0].target,e.id);assert.equal(doc.rules.length,1);
  store.undo();assert.equal(store.document().entities.length,1);store.redo();assert.equal(store.document().entities.length,2);
  assert.equal(clip.value.id,r.id);
});
test('cut/paste and repeated duplicates retain capabilities; invalid external references do not mutate the draft',()=>{
  const level=createBlankLevel('cut'),r=addObject(level,'object',300);level.entities[0].transport={type:'vertical',toY:260,speed:90};
  const clip=copyObject(level,r);deleteObject(level,r);pasteObject(level,clip);assert.equal(level.entities[0].transport.toY,260);
  const bad=copyObject(level,{type:'entity',id:level.entities[0].id});bad.value.behaviors=[{id:'call',label:'调用',actions:[{type:'set',target:'missing',state:'on'}]}];
  const store=createEditorStore();store.open('map',level);assert.throws(()=>store.change(d=>pasteObject(d,bad)),/不存在/);assert.deepEqual(store.document(),level);
  assert.equal(copyObject(level,{type:'actor'}),null);
});
test('deleting a wire keeps sibling action branches and removes only empty delays or rules',()=>{
  const level=createBlankLevel('wires');addObject(level,'switch',200);
  level.rules=[{on:{type:'click',source:'switch-1'},actions:[{type:'turn',direction:1},{type:'after',ticks:10,actions:[{type:'turn',direction:-1}]}]}];
  deleteWire(level,ruleWires(level)[1]);assert.equal(level.rules[0].actions.length,1);assert.equal(level.rules[0].actions[0].type,'turn');
  deleteWire(level,ruleWires(level)[0]);assert.equal(level.rules.length,0);
});
