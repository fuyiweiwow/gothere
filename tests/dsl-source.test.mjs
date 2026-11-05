import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDSL,replaceDSLDocument} from '../src/editor/dsl.js';
import {createEditorStore,createBlankLevel} from '../src/editor/model.js';

test('DSL source replaces the current document atomically with one undo, redo and reload',()=>{
  const original=createBlankLevel('source-test',{layered:true});original.hint='remove this';
  const edited=structuredClone(original);edited.name='源码修改';edited.actor.speed=81;delete edited.hint;
  const level=parseDSL(JSON.stringify(edited)),store=createEditorStore();store.open('current',original);
  store.change(doc=>replaceDSLDocument(doc,level));assert.deepEqual(store.document(),edited);
  assert.equal(store.entries().length,1);assert.equal(store.key(),'current');
  store.undo();assert.deepEqual(store.document(),original);store.redo();assert.deepEqual(store.document(),edited);
  assert.deepEqual(createEditorStore(store.serialize()).document(),edited);
});

test('invalid source reports syntax, semantics and byte limits before changing the document',()=>{
  const original=createBlankLevel('source-test',{layered:true}),store=createEditorStore();store.open('current',original);
  const invalid=structuredClone(original);invalid.actor.speed=-1;
  for(const source of ['{',JSON.stringify(invalid),' '.repeat(1048577)]){
    assert.throws(()=>store.change(doc=>replaceDSLDocument(doc,parseDSL(source))));
    assert.deepEqual(store.document(),original);assert.equal(store.history().undo,false);
  }
  assert.throws(()=>parseDSL('"'+ '桃'.repeat(350000)+'"'),/1 MiB/);
});

test('replacement keeps JSON keys as data without changing the document prototype',()=>{
  const original=createBlankLevel('source-keys',{layered:true});
  const source=JSON.stringify(original).slice(0,-1)+',"__proto__":{"polluted":true}}';
  const level=parseDSL(source),target={};replaceDSLDocument(target,level);
  assert.equal(Object.getPrototypeOf(target),Object.prototype);assert.equal(Object.hasOwn(target,'__proto__'),true);
  assert.equal(target.polluted,undefined);assert.deepEqual(JSON.parse(JSON.stringify(target)),level);
  replaceDSLDocument(target,target);assert.deepEqual(JSON.parse(JSON.stringify(target)),level);
});
