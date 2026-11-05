import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {createSimulation,replayRecording,validateLevel} from '../src/core/engine.js';
import {createEditorStore} from '../src/editor/model.js';
import {setPlaneBaseline,assignWalkPlane} from '../src/editor/layered-editing.js';

function fixture(progress=1,plane=progress===1?'back':'front'){
  const l=createLayeredLevel(),end=l.spatial.nodes.find(n=>n.id===(progress===0?'front-turn':'back-entry'));
  l.entities.push({id:'visitor',label:'测试访客',kind:'object',x:end.x,width:24,height:48,state:'active',
    space:{passage:'alley',progress,length:28,depth:end.depth,height:0},
    behaviors:[{id:'leave',label:'离开通路沿街走',actions:[{type:'move',target:'visitor',plane,x:end.x+120,depth:l.spatial.planes.find(p=>p.id===plane).depth,height:0,ticks:60}]}]});
  l.rules=[{on:{source:'visitor',type:'click'},actions:[{type:'invoke',target:'visitor',behavior:'leave'}]}];return l;
}

test('either passage endpoint can continue onto its own plane without a jump or height change',()=>{
  for(const progress of [0,1]){
    const l=fixture(progress),end=l.spatial.nodes.find(n=>n.id===(progress?'back-entry':'front-turn'));
    assert.equal(validateLevel(l).valid,true,validateLevel(l).errors.join('\n'));
    const game=createSimulation(l).start();game.click('visitor');game.step(30);const e=game.snapshot().entities.visitor;
    assert.equal(e.space.plane,end.plane);assert.equal(e.space.passage,undefined);assert.equal(e.x,end.x+60);assert.equal(e.space.height,0);assert.equal(e.space.depth,end.depth);
    assert.equal(game.snapshot().signals.some(s=>s.source==='visitor'&&s.event==='moved'),false);
    game.step(30);assert.equal(game.snapshot().entities.visitor.x,end.x+120);assert.ok(game.snapshot().signals.some(s=>s.source==='visitor'&&s.event==='moved'));
    assert.deepEqual(replayRecording(l,game.recording()).snapshot(),game.snapshot());
    const store=createEditorStore();store.open('exit',l);store.change(d=>d.entities.at(-1).behaviors[0].actions[0].x+=30);store.undo();assert.deepEqual(store.document(),l);
  }
});

test('an exit attempted mid-passage or at the opposite end is rejected and emits an editable event',()=>{
  for(const [progress,plane,height] of [[.4,'back',0],[0,'back',0],[1,'front',0],[1,'back',8]]){
    const l=fixture(progress,plane);l.entities.at(-1).space.height=height;l.entities.find(e=>e.id==='marker').state='inactive';
    l.rules.push({on:{source:'visitor',type:'moveblocked'},actions:[{type:'set',target:'marker',state:'active'}]});
    const game=createSimulation(l).start(),before=game.snapshot().entities.visitor;
    game.click('visitor');game.step();const e=game.snapshot().entities.visitor;
    assert.deepEqual(e.space,before.space);assert.equal(e.x,before.x);assert.equal(e.translation,undefined);
    assert.ok(game.snapshot().signals.some(s=>s.source==='visitor'&&s.event==='moveblocked'));
    assert.equal(game.snapshot().entities.marker.state,'active','blocked events participate in ordinary rule wiring');
  }
});

test('a rejected exit does not cancel an in-progress passage movement',()=>{
  const l=fixture(.4,'back');l.rules.push({on:{source:'marker',type:'click'},actions:[{type:'move',target:'visitor',progress:1,ticks:60}]});
  const game=createSimulation(l).start();game.click('marker');game.step(20);const before=game.snapshot().entities.visitor.translation;
  game.click('visitor');game.step();assert.equal(game.snapshot().entities.visitor.translation.elapsed,before.elapsed+1);
  game.step(39);assert.equal(game.snapshot().entities.visitor.space.progress,1);assert.equal(game.snapshot().entities.visitor.space.plane,undefined);
});

test('exit destinations reject unrelated planes, mixed progress, malformed data, and ordinary cross-plane teleporting',()=>{
  for(const change of [a=>a.plane='unknown',a=>a.depth=45,a=>a.progress=.5,a=>a.plane=undefined,a=>a.x=2400,a=>a.ticks=0]){
    const l=fixture();change(l.entities.at(-1).behaviors[0].actions[0]);assert.equal(validateLevel(l).valid,false);
  }
  const l=fixture();l.entities.at(-1).space={plane:'front',depth:30,height:0};assert.equal(validateLevel(l).valid,false);
});

test('after exiting, a stale passage-progress command is blocked without corrupting subsequent motion',()=>{
  const l=fixture();l.entities.at(-1).behaviors.push({id:'stale',label:'旧进度指令',actions:[{type:'move',target:'visitor',progress:.4,ticks:30}]});
  l.rules.push({on:{source:'visitor',type:'moved'},actions:[{type:'invoke',target:'visitor',behavior:'stale'}]});
  const game=createSimulation(l).start();game.click('visitor');game.step(90);
  assert.equal(game.snapshot().entities.visitor.x,570);assert.equal(game.snapshot().entities.visitor.space.plane,'back');assert.equal(game.snapshot().entities.visitor.translation,undefined);
  assert.ok(game.snapshot().signals.some(s=>s.event==='moveblocked'));assert.equal(game.snapshot().status,'running');
});

test('editing endpoint baselines and converting position ownership keeps exit actions valid',()=>{
  const l=fixture();setPlaneBaseline(l,'back',350);assert.equal(l.entities.at(-1).behaviors[0].actions[0].depth,230);
  assert.equal(validateLevel(l).valid,true);const game=createSimulation(l).start();game.click('visitor');game.step(60);assert.equal(game.snapshot().entities.visitor.space.depth,230);
  assignWalkPlane(l,l.entities.at(-1),'front');assert.equal(l.entities.at(-1).behaviors[0].actions[0].plane,undefined);assert.equal(validateLevel(l).valid,true);
});
