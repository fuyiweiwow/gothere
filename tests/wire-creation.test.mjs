import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankLevel,createEditorStore} from '../src/editor/model.js';
const fixture=()=>({...createBlankLevel('drag-wire'),entities:[
  {id:'a',label:'按钮',kind:'object',x:200,y:440,width:40,state:'active',behaviors:[{id:'press',label:'按下',actions:[{type:'set',target:'a',state:'inactive'}]}]},
  {id:'b',label:'目标',kind:'object',x:650,y:440,width:40,state:'active',behaviors:[{id:'open',label:'打开',actions:[{type:'set',target:'b',state:'inactive'}]}]}],rules:[]});
const module=()=>import('../src/editor/wire-creation.js');
test('event slots include named completions and direct connections persist with one undo',async()=>{
  const {eventSlots,connectWire}=await module(),l=fixture();
  assert.deepEqual(eventSlots(l.entities[0]),[{type:'contact'},{type:'click'},{type:'done',behavior:'press'}]);
  const store=createEditorStore();store.open('wire',l);store.change(d=>connectWire(d,{source:'a',type:'click'},'b','open'));
  assert.deepEqual(store.document().rules,[{on:{source:'a',type:'click'},actions:[{type:'invoke',target:'b',behavior:'open'}]}]);
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());store.undo();assert.deepEqual(store.document(),l);
});
test('connections allow fan-out, fan-in and self-links; duplicates do not accumulate',async()=>{
  const {connectWire}=await module(),l=fixture();
  assert.equal(connectWire(l,{source:'a',type:'click'},'b','open'),true);
  assert.equal(connectWire(l,{source:'a',type:'click'},'b','open'),false);
  connectWire(l,{source:'a',type:'click'},'a','press');connectWire(l,{source:'b',type:'done',behavior:'open'},'a','press');
  assert.equal(l.rules.length,3);
});
test('bad endpoints, missing completion behaviors and rule limits leave the document intact',async()=>{
  const {connectWire}=await module();
  for(const on of [{source:'missing',type:'click'},{source:'a',type:'arrive'},{source:'a',type:'done'},{source:'a',type:'done',behavior:'missing'}]){
    const l=fixture(),before=structuredClone(l);assert.throws(()=>connectWire(l,on,'b','open'));assert.deepEqual(l,before);
  }
  const l=fixture();assert.throws(()=>connectWire(l,{source:'a',type:'click'},'b','missing'));
  l.rules=Array.from({length:128},()=>({on:{source:'a',type:'contact'},actions:[{type:'invoke',target:'a',behavior:'press'}]}));
  assert.throws(()=>connectWire(l,{source:'a',type:'click'},'b','open'));assert.equal(l.rules.length,128);
});
