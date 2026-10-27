import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankLevel, createEditorStore, ruleWires, deleteObject } from '../src/editor/model.js';
import { filterCatalog } from '../src/editor/catalog.js';
import { routeWire, nearestInsertion, setWirePoints, wireAction } from '../src/editor/routing.js';
import { createSimulation, validateLevel } from '../src/core/engine.js';

function fixture(){const d=createBlankLevel('workspace');d.entities=[{id:'switch',kind:'switch',x:200,state:'off',label:'开关'}];
  d.rules=[{on:{source:'switch',type:'click'},actions:[{type:'after',ticks:10,actions:[{type:'set',target:'switch',state:'on'}]}]}];return d;}
test('warehouse combines category and case-insensitive keyword filters',()=>{
  assert.deepEqual(filterCatalog('LIFT','traversal').map(i=>i.kind),['lift']);
  assert.deepEqual(filterCatalog('生物 物品','objects').map(i=>i.kind),['object']);
  assert.equal(filterCatalog('lift','interaction').length,0);assert.equal(filterCatalog('不在仓库').length,0);
});
test('orthogonal routes support self-connections and insertion on each manual segment',()=>{
  for(const to of [{x:500,y:300},{x:80,y:400}]){
    const route=routeWire({x:100,y:400},to,[],2);assert.ok(route.segments.length>=3);
    for(const s of route.segments)assert.ok(s.from.x===s.to.x||s.from.y===s.to.y);
  }
  const r=routeWire({x:100,y:400},{x:600,y:400},[{x:300,y:200}]);
  assert.equal(nearestInsertion(r,{x:220,y:400}),0);assert.equal(nearestInsertion(r,{x:500,y:200}),1);
});
test('route metadata follows nested actions through reorder, persistence, history and deletion',()=>{
  const store=createEditorStore();store.open('x',fixture());const w=ruleWires(store.document())[0];
  store.change(d=>setWirePoints(d,w,[{x:251,y:137}]));
  assert.deepEqual(wireAction(store.document(),w).editor.waypoints,[{x:250,y:140}]);
  const restored=createEditorStore(store.serialize());assert.deepEqual(restored.document(),store.document());
  store.undo();assert.equal(ruleWires(store.document())[0].points.length,0);store.redo();
  const d=store.document();d.rules.unshift({on:{source:'switch',type:'contact'},actions:[{type:'turn',direction:-1}]});
  assert.deepEqual(ruleWires(d)[1].points,[{x:250,y:140}]);deleteObject(d,{type:'entity',id:'switch'});assert.equal(d.rules.length,0);
});
test('routing is excluded from simulation and invalid metadata is rejected',()=>{
  const a=fixture(),b=fixture();setWirePoints(b,ruleWires(b)[0],[{x:300,y:100}]);
  const x=createSimulation(a),y=createSimulation(b);for(const g of [x,y]){g.start();g.click('switch');g.step(3);}
  assert.deepEqual(x.snapshot(),y.snapshot());assert.deepEqual(x.recording(),y.recording());
  for(const points of [[{x:NaN,y:30}],[{x:30,y:-1}],Array(17).fill({x:30,y:30}),[null]]){
    const d=fixture();d.rules[0].actions[0].editor={waypoints:points};assert.equal(validateLevel(d).valid,false);
  }
});
