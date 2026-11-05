import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {beginSpatialMove} from '../src/core/spatial.js';
import {createEditorStore,deleteObject} from '../src/editor/model.js';
import {assignWalkPlane,setPlaneBaseline} from '../src/editor/layered-editing.js';
import {captureTemplate} from '../src/editor/templates.js';

function fixture(){
  const l=createLayeredLevel(),n=l.spatial.nodes.find(n=>n.id==='back-entry');
  l.entities.push({id:'visitor',label:'画外来客',kind:'object',state:'active',x:-100,width:24,height:44,space:{plane:n.plane,depth:n.depth,height:0},behaviors:[
    {id:'arrive',label:'到达入口',actions:[{type:'move',target:'visitor',x:n.x,depth:n.depth,height:0,ticks:30}]},
    {id:'enter',label:'进入通路',actions:[{type:'move',target:'visitor',passage:'alley',progress:.3,ticks:30}]},
    {id:'return',label:'退回出口',actions:[{type:'move',target:'visitor',passage:'alley',progress:1,ticks:30}]},
    {id:'leave',label:'离开画面',actions:[{type:'move',target:'visitor',plane:n.plane,x:1300,depth:n.depth,height:0,ticks:30}]},
  ]});
  for(const id of ['entry-control','return-control','exit-control'])l.entities.unshift({id,label:id,kind:'object',x:30,width:10,height:10,state:'active',space:{plane:'front',depth:30,height:0}});
  l.rules=['arrive','enter','return','leave'].map((behavior,i)=>({on:{source:['marker','entry-control','return-control','exit-control'][i],type:'click'},actions:[{type:'invoke',target:'visitor',behavior}]}));
  return l;
}

test('an offscreen object continuously reaches an endpoint, enters and leaves a passage, then exits the camera',()=>{
  const l=fixture(),v=validateLevel(l);assert.equal(v.valid,true,v.errors.join('\n'));
  const g=createSimulation(l).start();g.click('marker');g.step(30);g.click('entry-control');g.step(1);
  let e=g.snapshot().entities.visitor;assert.equal(e.space.passage,'alley');assert.ok(e.space.progress<1&&e.space.progress>.9);
  g.step(28);e=g.snapshot().entities.visitor;assert.ok(e.space.progress>.3&&e.space.progress<.4);
  g.step();g.click('return-control');g.step(30);e=g.snapshot().entities.visitor;assert.equal(e.space.progress,1);assert.equal(e.x,450);
  g.click('exit-control');g.step(30);assert.equal(g.snapshot().entities.visitor.x,1300);assert.equal(g.snapshot().entities.visitor.space.plane,'back');
  assert.deepEqual(replayRecording(l,g.recording()).snapshot(),g.snapshot());
  const store=createEditorStore();store.open('entry',l);assert.deepEqual(createEditorStore(store.serialize()).document(),l);
});

test('entry needs the actual endpoint, matching height and plane; rejected moves preserve existing movement',()=>{
  const l=fixture(),e=l.entities.at(-1),action=e.behaviors[1].actions[0];
  e.translation={sentinel:true};assert.equal(beginSpatialMove(l,e,action),false);assert.deepEqual(e.translation,{sentinel:true});
  for(const change of [v=>v.space.height=5,v=>v.space.plane='front',v=>v.space.depth+=1,v=>v.x+=1]){
    const object=structuredClone(e);object.x=450;change(object);const before=structuredClone(object);
    assert.equal(beginSpatialMove(l,object,action),false);assert.deepEqual(object,before);
  }
  for(const id of ['front-turn','back-entry']){
    const n=l.spatial.nodes.find(n=>n.id===id),object={...structuredClone(e),x:n.x,space:{plane:n.plane,depth:n.depth,height:0}};
    assert.equal(beginSpatialMove(l,object,action),true);assert.equal(object.space.progress,id==='front-turn'?0:1);
  }
});

test('invalid passage entry commands are rejected and deleting a referenced passage prunes entry commands',()=>{
  for(const change of [a=>a.passage='missing',a=>a.progress=2,a=>a.plane='back',a=>a.x=100,a=>a.passage=null]){
    const l=fixture();change(l.entities.at(-1).behaviors[1].actions[0]);assert.equal(validateLevel(l).valid,false);
  }
  const l=fixture();deleteObject(l,{type:'entity',id:'alley'});
  assert.ok(l.entities.at(-1).behaviors.every(b=>b.actions.every(a=>a.passage!=='alley')));
});

test('entry failure uses normal moveblocked wiring and does not cancel the ongoing approach',()=>{
  const l=fixture();l.entities.find(e=>e.id==='return-control').state='inactive';
  l.rules.push({on:{source:'visitor',type:'moveblocked'},actions:[{type:'set',target:'return-control',state:'active'}]});
  const g=createSimulation(l).start();g.click('marker');g.step(5);g.click('entry-control');g.step();
  let e=g.snapshot().entities.visitor;assert.equal(e.translation.elapsed,6);assert.equal(e.space.plane,'back');
  assert.equal(g.snapshot().entities['return-control'].state,'active');g.step(24);assert.equal(g.snapshot().entities.visitor.x,450);
  e=structuredClone(e);e.space={passage:'another-path',progress:.3,length:24,depth:30,height:0};const before=structuredClone(e);
  assert.equal(beginSpatialMove(l,e,{passage:'alley',progress:1,ticks:30}),false);assert.deepEqual(e,before);
});

test('plane reassignment resets explicit entry actions, and templates cannot silently retain external passages',()=>{
  const l=fixture(),visitor=l.entities.at(-1);assignWalkPlane(l,visitor,'front');
  const entry=visitor.behaviors.find(b=>b.id==='enter').actions[0];
  assert.equal(entry.passage,undefined);assert.equal(entry.progress,undefined);assert.equal(entry.depth,30);
  assert.equal(validateLevel(l).valid,true,validateLevel(l).errors.join('\n'));
  const source=fixture();source.rules=[];
  const node={id:'visitor-art',bind:{type:'entity',id:'visitor'}};source.scene={nodes:[node]};
  assert.throws(()=>captureTemplate(source,{id:'entry-pack',label:'entry pack',nodes:[node.id],entities:['visitor'],origin:{x:0,y:0}}),/组合外的逻辑对象：alley/);
});

test('moving a plane baseline preserves entry and exit destinations on other planes',()=>{
  const l=fixture(),visitor=l.entities.at(-1),entry=structuredClone(visitor.behaviors[1].actions[0]);
  visitor.behaviors.at(-1).actions[0]={type:'move',target:'visitor',plane:'front',x:600,depth:30,height:0,ticks:30};
  setPlaneBaseline(l,'back',330);
  assert.deepEqual(visitor.behaviors[1].actions[0],entry);
  assert.equal(visitor.behaviors.at(-1).actions[0].plane,'front');assert.equal(visitor.behaviors.at(-1).actions[0].depth,30);
  assert.equal(visitor.behaviors[0].actions[0].depth,250);assert.equal(validateLevel(l).valid,true,validateLevel(l).errors.join('\n'));
});
