import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, replayRecording, validateLevel } from '../src/core/engine.js';
import { createBlankLevel, createEditorStore, addBehavior, renameBehavior, deleteBehavior, deleteObject, ruleWires } from '../src/editor/model.js';
const set=(target,state)=>({type:'set',target,state});
const call=(target,behavior)=>({type:'invoke',target,behavior});
const after=(ticks,...actions)=>({type:'after',ticks,actions});
const fixture=()=>({...createBlankLevel('wires-test'),actor:{x:80,speed:15},entities:[
  {id:'a',kind:'switch',x:200,state:'off',label:'A'},
  {id:'b',kind:'switch',x:300,state:'off',label:'B'},
  {id:'tool',kind:'object',x:550,state:'active',label:'物件',behaviors:[
    {id:'rest',label:'休息',actions:[set('tool','inactive')]},
    {id:'start',label:'开始',actions:[set('tool','active')]}]},
  {id:'door',kind:'gate',x:900,state:'closed',label:'门',behaviors:[{id:'open',label:'开门',actions:[set('door','open')]}]},
],rules:[]});

test('many-to-many wires invoke multiple named behaviors and survive exact replay',()=>{
  const level=fixture();level.rules=[
    {on:{type:'click',source:'a'},actions:[call('tool','rest'),call('door','open')]},
    {on:{type:'click',source:'b'},actions:[call('tool','start'),call('door','open')]},
  ];
  const game=createSimulation(level);game.start();game.click('a');game.step();
  assert.equal(game.snapshot().entities.tool.state,'inactive');assert.equal(game.snapshot().entities.door.state,'open');
  game.click('b');game.step();assert.equal(game.snapshot().entities.tool.state,'active');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
  game.reset();assert.equal(game.snapshot().entities.door.state,'closed');assert.equal(game.snapshot().timers.length,0);
});

test('done waits for all delayed branches and nested behavior calls',()=>{
  const level=fixture();level.entities[2].behaviors[0].actions=[after(20,set('tool','inactive'))];
  level.entities[0].behaviors=[{id:'sequence',label:'一组行为',actions:[call('tool','rest'),after(5,set('b','on')),after(10,set('a','on'))]}];
  level.rules=[{on:{type:'click',source:'a'},actions:[call('a','sequence')]},
    {on:{type:'done',source:'a',behavior:'sequence'},actions:[call('door','open')]}];
  const game=createSimulation(level);game.start();game.click('a');game.step(20);
  assert.equal(game.snapshot().entities.a.state,'on');assert.equal(game.snapshot().entities.b.state,'on');
  assert.equal(game.snapshot().entities.door.state,'closed');game.step();
  assert.equal(game.snapshot().entities.door.state,'open');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
});

test('concurrent calls have independent completion counters',()=>{
  const level=fixture();level.entities[2].behaviors[0].actions=[after(10,set('tool','inactive'))];
  level.rules=[{on:{type:'click',source:'a'},actions:[call('tool','rest')]},
    {on:{type:'done',source:'tool',behavior:'rest'},actions:[after(100,set('a','on'))]}];
  const game=createSimulation(level);game.start();game.click('a');game.step(5);game.click('a');game.step(6);
  assert.equal(game.snapshot().timers.filter(t=>t.due>100).length,1);
  game.step(5);assert.equal(game.snapshot().timers.filter(t=>t.due>100).length,2);
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
});

test('recursive calls and completion-wire loops fail cleanly without stack overflow',()=>{
  for(const completion of [false,true]) {
    const level=fixture();
    if(!completion)level.entities[2].behaviors[0].actions=[call('tool','rest')];
    else level.rules.push({on:{type:'done',source:'tool',behavior:'rest'},actions:[call('tool','rest')]});
    level.rules.push({on:{type:'click',source:'a'},actions:[call('tool','rest')]});
    const game=createSimulation(level);game.start();game.click('a');game.step();assert.equal(game.snapshot().reason,'limit');
    game.reset();assert.equal(game.snapshot().status,'ready');
  }
});

test('delayed recursion is bounded across ticks, including pending completion parents',()=>{
  const level=fixture();level.entities[2].behaviors[0].actions=[after(1,call('tool','rest'))];
  level.rules=[{on:{type:'click',source:'a'},actions:[call('tool','rest')]}];
  const game=createSimulation(level);game.start();game.click('a');game.step(100);
  assert.equal(game.snapshot().reason,'limit');assert.ok(game.snapshot().tick<=34);
});

test('a lift releases its rider after a command reversal returns it to the boarding floor',()=>{
  const level=fixture();level.actor={x:100,speed:120};level.goal={x:800};
  level.platforms.push({x:150,width:250,y:260});
  level.entities.push({id:'lift',kind:'lift',x:180,width:40,y:440,toY:260,speed:120,state:'lower',label:'电梯'});
  level.rules=[{on:{type:'board',source:'lift'},actions:[set('lift','upper'),after(10,set('lift','lower'))]}];
  const game=createSimulation(level);game.start().step(1000);
  assert.equal(game.snapshot().status,'won');assert.equal(game.snapshot().actor.mode,'walking');
  assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
});

test('an invisible zone starts a creature only on its floor and on entry',()=>{
  const level=fixture();level.actor.speed=120;level.entities[2].state='inactive';
  level.entities.push({id:'zone',kind:'zone',x:120,width:60,state:'enabled',label:'区域'});
  level.rules=[{on:{type:'enter',source:'zone'},actions:[call('tool','start'),after(200,set('a','on'))]}];
  const game=createSimulation(level);game.start().step(10);assert.equal(game.snapshot().entities.tool.state,'inactive');
  game.step(20);assert.equal(game.snapshot().entities.tool.state,'active');assert.equal(game.snapshot().timers.length,1);
  for(const change of [e=>e.y=260,e=>e.state='disabled']) {
    const other=structuredClone(level);change(other.entities.at(-1));const sim=createSimulation(other);sim.start().step(60);
    assert.equal(sim.snapshot().entities.tool.state,'inactive');assert.equal(sim.snapshot().timers.length,0);
  }
});

test('contact lethality is independent of artwork and can be disarmed by pickup',()=>{
  for(const skin of ['axe','crate','orb','crocodile'])for(const pickup of [false,true]) {
    const level=fixture(),tool=level.entities[2];tool.x=120;tool.contact={effect:'lethal'};tool.appearance={skin};
    tool.behaviors.push({id:'pickup',label:'拿起',actions:[{type:'hold',target:'tool'}]});
    level.rules=pickup?[{on:{type:'contact',source:'tool'},actions:[call('tool','pickup')]}]:[];
    const game=createSimulation(level);game.start().step(200);
    assert.equal(game.snapshot().status,pickup?'running':'lost');assert.equal(game.snapshot().actor.holding,pickup?'tool':null);
  }
});

test('held objects remain callable and dropping preserves their independently chosen state',()=>{
  const level=fixture(),tool=level.entities[2];tool.x=100;
  tool.behaviors.push({id:'pickup',label:'拿起',actions:[{type:'hold',target:'tool'}]},{id:'drop',label:'放下',actions:[{type:'drop'}]});
  level.rules=[{on:{type:'click',source:'a'},actions:[call('tool','pickup')]},
    {on:{type:'click',source:'b'},actions:[call('tool','rest'),call('tool','drop')]}];
  const game=createSimulation(level);game.start();game.click('a');game.step();assert.equal(game.snapshot().actor.holding,'tool');
  game.click('b');game.step();assert.equal(game.snapshot().actor.holding,null);assert.equal(game.snapshot().entities.tool.state,'inactive');
});

test('explicit turn changes the route; non-goal boundaries end the journey',()=>{
  const level=fixture();level.goal.x=40;level.rules=[{on:{type:'click',source:'a'},actions:[{type:'turn',direction:-1}]}];
  const game=createSimulation(level);game.start();game.click('a');game.step(500);assert.equal(game.snapshot().status,'won');
  for(const direction of [-1,1]){
    const other=fixture();other.actor={x:direction===1?1150:25,speed:120,direction};other.goal.x=direction===1?40:1100;
    const sim=createSimulation(other);sim.start().step(30);assert.equal(sim.snapshot().reason,'boundary');
  }
});

test('behavior rename updates nested calls and completion sources atomically, with undo',()=>{
  const level=fixture();level.rules=[{on:{type:'done',source:'tool',behavior:'rest'},actions:[after(10,call('tool','rest'))]}];
  level.entities[0].behaviors=[{id:'chain',label:'链',actions:[call('tool','rest')]}];
  const store=createEditorStore();store.open('x',level);store.change(d=>renameBehavior(d,'tool','rest','nap'));
  const renamed=store.document();assert.equal(validateLevel(renamed).valid,true);
  assert.equal(renamed.rules[0].on.behavior,'nap');assert.equal(renamed.rules[0].actions[0].actions[0].behavior,'nap');
  assert.equal(renamed.entities[0].behaviors[0].actions[0].behavior,'nap');
  assert.deepEqual(createEditorStore(store.serialize()).document(),renamed);store.undo();assert.deepEqual(store.document(),level);
});

test('deleting a behavior or entity removes cascading empty behaviors and dangling wires',()=>{
  for(const entity of [false,true]) {
    const level=fixture();level.entities[0].behaviors=[{id:'chain',label:'链',actions:[after(20,call('tool','rest'))]}];
    level.rules=[{on:{type:'click',source:'b'},actions:[call('a','chain'),call('door','open')]},
      {on:{type:'done',source:'tool',behavior:'rest'},actions:[set('b','on')]}];
    if(entity)deleteObject(level,{type:'entity',id:'tool'});else deleteBehavior(level,'tool','rest');
    assert.equal(validateLevel(level).valid,true);assert.equal(level.entities[0].behaviors.length,0);
    assert.equal(level.rules.length,1);assert.deepEqual(level.rules[0].actions,[call('door','open')]);
  }
});

test('new behavior ids stay unique after deletion, and wires preserve delayed branches',()=>{
  const level=fixture(),e=level.entities[0];const first=addBehavior(e);addBehavior(e);deleteBehavior(level,'a',first.id);addBehavior(e);
  assert.equal(new Set(e.behaviors.map(b=>b.id)).size,2);
  level.rules=[{on:{type:'click',source:'a'},actions:[call('door','open'),after(10,after(20,{type:'turn',direction:-1}))]}];
  assert.deepEqual(ruleWires(level).map(w=>[w.target,w.type,w.delay]),[['door','invoke',0],['actor','turn',30]]);
});

test('malformed behaviors, contact effects and dangling completion/call references are rejected',()=>{
  for(const mutate of [l=>l.entities[2].contact=null,l=>l.entities[2].contact={effect:'unknown'},
    l=>l.entities[2].behaviors=[null],l=>l.entities[2].behaviors.push({...l.entities[2].behaviors[0]}),
    l=>l.rules=[{on:{type:'done',source:'tool',behavior:'missing'},actions:[set('a','on')]}],
    l=>l.rules=[{on:{type:'click',source:'a'},actions:[call('tool','missing')]}],
    l=>l.entities[2].behaviors[0].actions=[{type:'turn',direction:0}]]) {
    const level=fixture();mutate(level);assert.equal(validateLevel(level).valid,false);assert.throws(()=>createSimulation(level));
  }
});
