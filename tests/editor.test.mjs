import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore, createBlankLevel, deleteObject, addObject, moveObject } from '../src/editor/model.js';
import { levels } from '../src/levels.js';
import { createSimulation, validateLevel } from '../src/core/engine.js';

test('a playable document and simulation never mutate the authoring draft', () => {
  const store = createEditorStore(); store.open('first', levels[0]);
  const original = store.document();
  const game = createSimulation(store.document()); game.start(); game.click('lever'); game.step(1000);
  assert.equal(game.snapshot().status, 'won');
  assert.deepEqual(store.document(), original);
  original.name = 'external mutation'; assert.notEqual(store.document().name, original.name);
});
test('each document has independent undo/redo; a new edit discards only its redo branch', () => {
  const store = createEditorStore(); store.open('a', levels[0]);
  store.change(d => { d.name = '我的桥'; });
  store.open('b', levels[1]); store.change(d => { d.actor.speed = 80; });
  store.open('a', levels[0]); assert.equal(store.document().name, '我的桥');
  assert.equal(store.undo(), true); assert.equal(store.document().name, levels[0].name);
  assert.equal(store.redo(), true); assert.equal(store.document().name, '我的桥');
  store.undo(); store.change(d => { d.name = '第二座桥'; }); assert.equal(store.redo(), false);
  store.open('b', levels[1]); assert.equal(store.document().actor.speed, 80);
  store.undo(); assert.equal(store.document().actor.speed, 68);
});
test('incomplete geometry is editable and undo restores a valid document', () => {
  const store = createEditorStore(); store.open('a', levels[0]);
  store.change(d => { d.platforms = []; }); assert.equal(validateLevel(store.document()).valid, false);
  store.undo(); assert.equal(validateLevel(store.document()).valid, true);
  assert.throws(() => store.change(d => { d.name = 'partial'; throw new Error('abort'); }));
  assert.equal(store.document().name, levels[0].name);
});
test('workspace persists all drafts and restores invalid drafts; corrupt data is rejected', () => {
  const store = createEditorStore(); store.open('a', levels[0]); store.change(d => { d.goal.x = 30; });
  store.open('b', levels[1]); store.change(d => { d.name = '风有点大'; });
  const restored = createEditorStore(store.serialize());
  assert.equal(restored.key(), 'b'); assert.equal(restored.document().name, '风有点大');
  restored.open('a', levels[0]); assert.equal(restored.document().goal.x, 30);
  assert.throws(() => createEditorStore('{'));
  assert.throws(() => createEditorStore('{"version":9,"documents":[]}'));
  assert.throws(() => createEditorStore(JSON.stringify({version:1, activeKey:'x', documents:[{key:'x',level:{}}]})));
});
test('blank document and placed objects have unique ids and serialize into the existing DSL', () => {
  const level = createBlankLevel('my-map');
  for (const kind of ['switch','switch','bridge','hazard','plate','gate','platform']) addObject(level, kind, 500);
  assert.equal(new Set(level.entities.map(e=>e.id)).size, 6);
  assert.equal(validateLevel(level).valid, true);
  assert.equal(level.platforms.length, 2);
});
test('roads can be created and moved on upper floors; lower roads never fill an upper-floor gap',()=>{
  const level=createBlankLevel('upper-roads');
  addObject(level,'platform',100,300);addObject(level,'platform',450,300);
  level.actor={x:150,y:300,speed:100};level.goal={x:500,y:300};
  assert.equal(validateLevel(level).valid,true);
  const gap=createSimulation(level);gap.start();gap.step(500);assert.equal(gap.snapshot().reason,'fall');
  const ref=addObject(level,'platform',280,300),store=createEditorStore();store.open('upper',level);
  const run=()=>{const sim=createSimulation(store.document());sim.start();sim.step(500);return sim.snapshot();};
  assert.equal(run().status,'won');
  store.change(doc=>moveObject(doc,ref,0,-20));assert.equal(store.document().platforms[ref.index].y,280);assert.equal(run().reason,'fall');
  store.undo();assert.equal(run().status,'won');store.redo();
  const restored=createEditorStore(store.serialize());assert.equal(restored.document().platforms[ref.index].y,280);
});
test('moving a connector retains both landing heights; a moved patrol retains a bounded patrol path',()=>{
  const level=createBlankLevel('movement');const lift=addObject(level,'lift',500,520);
  moveObject(level,lift,100,-100);const connector=level.entities[0];assert.equal(connector.y,420);assert.equal(connector.toY,240);
  moveObject(level,lift,0,-1000);assert.equal(connector.toY,160);assert.equal(connector.y,340);
  const creature=addObject(level,'object',700,300),e=level.entities[1];e.motion={type:'patrol',minX:650,maxX:900,speed:55};
  moveObject(level,creature,50,20);assert.equal(e.x,750);assert.equal(e.y,320);assert.equal(e.motion.minX,700);assert.equal(e.motion.maxX,950);
  moveObject(level,creature,2000,0);assert.equal(e.motion.maxX,1200-e.width);assert.equal(e.x>=e.motion.minX&&e.x<=e.motion.maxX,true);
});
test('deleting an entity removes dependent rules and nested actions without dangling references', () => {
  const level = structuredClone(levels[2]);
  deleteObject(level, {type:'entity',id:'bridge'});
  assert.equal(validateLevel(level).valid, true);
  assert.ok(!JSON.stringify(level.rules).includes('bridge'));
  deleteObject(level, {type:'entity',id:'lever'});
  assert.ok(!level.rules.some(r=>r.on.source==='lever'));
  level.rules.push({on:{type:'click',source:'fan'},if:[{entity:'gate',state:'closed'}],actions:[{type:'set',target:'fan',state:'inactive'}]});
  deleteObject(level, {type:'entity',id:'gate'});
  assert.equal(validateLevel(level).valid, true);
  assert.ok(!JSON.stringify(level.rules).includes('gate'));
});

test('restoring corrupt rules rejects the whole workspace before the UI sees it', () => {
  const corruptions = [
    d => { d.rules[0].actions = [null]; },
    d => { d.rules[0].actions = [{type:'after',ticks:1,actions:'broken'}]; },
    d => { d.rules[0].if = {}; },
    d => { d.rules[0].on.source = 'missing'; },
    d => { d.entities[0].state = 'missing'; },
  ];
  for (const corrupt of corruptions) {
    const level = structuredClone(levels[0]); corrupt(level);
    assert.throws(() => createEditorStore(JSON.stringify({version:1,activeKey:'x',documents:[{key:'x',level}]})));
  }
});
