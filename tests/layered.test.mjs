import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {createEditorStore,moveObject} from '../src/editor/model.js';
import {actorAnimationState} from '../src/core/locomotion.js';

test('local passage changes walkable plane continuously without increasing real height',()=>{
  const level=createLayeredLevel(),game=createSimulation(level).start();
  const heights=[],depths=[];let arrived=false;
  for(let i=0;i<2400&&game.snapshot().status==='running';i++){
    game.step();const s=game.snapshot();
    if(s.actor.passage){heights.push(s.actor.space.height);depths.push(s.actor.space.depth);}
    if(s.signals.some(e=>e.event==='arrive'&&e.source==='alley'))arrived=true;
  }
  assert.equal(game.snapshot().status,'won');assert.ok(arrived);
  assert.ok(depths.length>30);assert.ok(depths.every((d,i)=>i===0||d>depths[i-1]));
  assert.ok(heights.every(h=>h===0));
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
});

test('screen crossings do not produce contact, support or goal on another plane',()=>{
  const level=createLayeredLevel();level.entities.push({id:'back-danger',kind:'object',label:'另一条街的危险物',x:150,width:80,height:180,state:'active',space:{plane:'back',depth:210,height:0,depthSize:24},contact:{effect:'lethal'}});
  const game=createSimulation(level).start().step(90);assert.equal(game.snapshot().status,'running');
  assert.equal(game.snapshot().actor.space.plane,'front');
  level.platforms=level.platforms.filter(p=>p.space.plane!=='front');
  assert.equal(validateLevel(level).valid,false,'a back road cannot support a front-road spawn');
});

test('closed or missing passage does not wait or silently transfer to a back road',()=>{
  for(const kind of ['closed','missing']){
    const level=createLayeredLevel();
    if(kind==='closed')level.entities.find(e=>e.id==='alley').passage.enabled=false;
    else delete level.spatial.nodes.find(n=>n.id==='front-turn').via;
    if(kind==='missing'){assert.equal(validateLevel(level).valid,false);continue;}
    const game=createSimulation(level).start().step(2400),s=game.snapshot();
    assert.equal(s.status,'lost');assert.equal(s.actor.space.plane,'front');
    assert.ok(s.actor.space.height<0,'keeps walking past its supported road');
  }
});

test('layered drafts preserve plane assignment through drag, history and JSON reload',()=>{
  const level=createLayeredLevel(),store=createEditorStore();store.open('layered',level);
  store.change(d=>moveObject(d,{type:'entity',id:'marker'},20,-30));
  const marker=store.document().entities.find(e=>e.id==='marker');
  assert.equal(marker.space.plane,'back');assert.equal(marker.space.depth,210);assert.equal(marker.space.height,30);
  store.undo();assert.deepEqual(store.document(),level);store.redo();
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
});

test('layered DSL rejects undeclared planes, implicit switches and inconsistent coordinates',()=>{
  for(const mutate of [
    l=>l.actor.space.plane='unknown',
    l=>l.actor.space.depth=75,
    l=>delete l.spatial.nodes.find(n=>n.id==='front-turn').via,
    l=>l.entities.find(e=>e.id==='alley').passage.to='start',
    l=>l.spatial.projection.depthX=.1,
    l=>l.spatial.nodes.find(n=>n.id==='back-entry').height=30,
    l=>l.spatial.planes.push(null),
    l=>l.spatial.planes=null,
    l=>l.entities.push(null),
    l=>l.entities.find(e=>e.id==='alley').passage.distance=0,
  ]){const level=createLayeredLevel();mutate(level);assert.equal(validateLevel(level).valid,false);}
});

test('outward traversal keeps its item, finishes after closure and emits real direction',()=>{
  const level=createLayeredLevel(),nodes=level.spatial.nodes;
  level.actor={x:450,speed:90,space:{plane:'back',depth:210,height:0}};level.goal={x:80,space:{plane:'front',depth:30,height:0}};level.spatial.start='back-entry';
  const entry=nodes.find(n=>n.id==='back-entry');entry.next='front-turn';entry.via='alley';
  const exit=nodes.find(n=>n.id==='front-turn');exit.next='start';delete exit.via;
  const e=level.entities.find(e=>e.id==='alley');e.passage.from='back-entry';e.passage.to='front-turn';e.behaviors=[{id:'close',label:'关闭入口',actions:[{type:'enable',target:'alley',capability:'passage',enabled:false}]}];
  level.entities.push({id:'item',kind:'object',label:'随身物品',state:'active',x:450,width:18,height:18,space:{plane:'back',depth:210,height:0},behaviors:[{id:'take',label:'拿起',actions:[{type:'hold',target:'item'}]}]});
  level.rules=[{on:{source:'item',type:'click'},actions:[{type:'invoke',target:'item',behavior:'take'}]},{on:{source:'alley',type:'click'},actions:[{type:'invoke',target:'alley',behavior:'close'}]}];
  const game=createSimulation(level).start();game.click('item');game.step(10);
  assert.equal(actorAnimationState(level,game.snapshot()),'outward');game.click('alley');game.step(1000);
  const s=game.snapshot();assert.equal(s.status,'won');assert.equal(s.actor.holding,'item');assert.equal(s.entities.item.space.plane,'front');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),s);
});
