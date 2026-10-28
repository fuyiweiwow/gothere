import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankLevel, createEditorStore, deleteObject } from '../src/editor/model.js';
import { createSimulation, replayRecording, validateLevel } from '../src/core/engine.js';
import { examples } from '../src/examples.js';

const fixture=()=>({...createBlankLevel('content-test'),actor:{x:80,speed:120},goal:{x:800},
  entities:[{id:'tool',kind:'object',x:150,width:40,state:'active',label:'东西',appearance:{skin:'axe'}}],
  rules:[{on:{type:'contact',source:'tool'},actions:[{type:'hold',target:'tool'}]}]});
const journey=(kind)=>({...fixture(),goal:{x:800,y:260},
  platforms:[{x:0,width:500},{x:200,width:800,y:260}],
  entities:[{id:'up',kind,x:280,width:40,y:440,toY:260,speed:120,
    state:kind==='ladder'?'enabled':'lower',label:'上楼'}],
  rules:kind==='lift'?[{on:{type:'board',source:'up'},actions:[{type:'set',target:'up',state:'upper'}]}]:[]});

test('appearance swaps preserve pickup, held conditions, and exact replay',()=>{
  for(const skin of ['axe','crate','crocodile','orb']) {
    const level=fixture();level.entities[0].appearance.skin=skin;
    level.entities.push({id:'door',kind:'gate',x:360,state:'closed',label:'门'});
    level.rules.push({on:{type:'contact',source:'door'},if:[{holding:'tool'}],actions:[{type:'set',target:'door',state:'open'}]});
    const game=createSimulation(level);game.start().step(1000);
    assert.equal(game.snapshot().status,'won');assert.equal(game.snapshot().actor.holding,'tool');
    assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
    game.reset();assert.equal(game.snapshot().actor.holding,null);
  }
});
test('the same object can hurt instead of being picked up',()=>{
  const level=fixture();level.rules[0].actions=[{type:'hurt',message:'斧子今天心情一般。'}];
  const game=createSimulation(level);game.start().step(1000);
  assert.equal(game.snapshot().reason,'hurt');assert.match(game.snapshot().events.at(-1).message,/心情/);
});
test('patrol creatures stop when inactive; held objects stop patrolling and may be dropped',()=>{
  const level=fixture();level.entities[0].motion={type:'patrol',minX:140,maxX:200,speed:60};
  level.rules[0].actions.push({type:'after',ticks:10,actions:[{type:'drop'},{type:'set',target:'tool',state:'inactive'}]});
  const game=createSimulation(level);game.start().step(100);
  assert.equal(game.snapshot().actor.holding,null);assert.equal(game.snapshot().entities.tool.state,'inactive');
  const x=game.snapshot().entities.tool.x;game.step(40);assert.equal(game.snapshot().entities.tool.x,x);
});
test('contact triggers on entry, not every overlapping tick; remote pickup is ignored',()=>{
  const level=fixture();level.rules=[{on:{type:'contact',source:'tool'},actions:[{type:'after',ticks:100,actions:[{type:'drop'}]}]},
    {on:{type:'click',source:'tool'},actions:[{type:'hold',target:'tool'}]}];
  const game=createSimulation(level);game.start();game.click('tool');game.step();assert.equal(game.snapshot().actor.holding,null);
  game.step(50);assert.equal(game.snapshot().timers.length,1);
});
test('different floors isolate pickup, hazards, pressure plates and goals',()=>{
  const level=fixture();level.entities[0].y=260;
  level.entities.push({id:'fan',kind:'hazard',x:200,y:260,state:'running',label:'楼上风扇'});
  const game=createSimulation(level);game.start().step(1000);
  assert.equal(game.snapshot().status,'won');assert.equal(game.snapshot().actor.holding,null);
});
for(const kind of ['ladder','lift']) {
  test(kind+' transports the actor between floors and replays without reboarding',()=>{
    const level=journey(kind);const game=createSimulation(level);game.start().step(1500);
    assert.equal(game.snapshot().status,'won');assert.equal(game.snapshot().actor.y,260);
    assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
    const initial=createSimulation(level).snapshot();game.reset();assert.deepEqual(game.snapshot(),initial);
  });
  test(kind+' can lead left on an upper floor and descend on a second connector',()=>{
    const level=journey(kind);level.actor={x:700,y:440,speed:120,direction:-1};
    level.goal={x:80,y:440};level.platforms=[{x:0,width:1200},{x:100,width:600,y:260}];
    level.entities[0].x=500;level.entities[0].upperDirection=-1;
    level.entities.push({...level.entities[0],id:'down',x:160,lowerDirection:-1});
    if(kind==='lift')level.entities[1].state='upper';
    if(kind==='lift')level.rules.push({on:{type:'board',source:'down'},actions:[{type:'set',target:'down',state:'lower'}]});
    const game=createSimulation(level);game.start().step(2000);assert.equal(game.snapshot().status,'won');
  });
}
test('an absent or idle lift never makes the actor wait',()=>{
  for(const state of ['upper','lower']) {
    const level=journey('lift');level.entities[0].state=state;level.rules=[];
    const game=createSimulation(level);game.start().step(150);
    assert.equal(game.snapshot().actor.x,380);assert.equal(game.snapshot().actor.mode,'walking');
    assert.equal(game.snapshot().actor.y,440);
  }
  const gap=journey('lift');gap.platforms[0].width=280;gap.entities[0].state='upper';gap.rules=[];
  const game=createSimulation(gap);game.start().step(500);
  assert.equal(game.snapshot().reason,'fall');assert.equal(game.snapshot().actor.mode,'walking');
});

test('new capabilities validate and survive draft persistence; deletion cleans held references',()=>{
  const level=fixture();level.rules[0].if=[{holding:null}];
  const store=createEditorStore();store.open('x',level);store.change(d=>{d.rules[0].if=[{holding:'tool'}];});
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  deleteObject(level,{type:'entity',id:'tool'});assert.equal(validateLevel(level).valid,true);
  for(const mutate of [l=>l.entities[0].y=-1,l=>l.entities[0].appearance.image='https://example.com/a.png',
    l=>l.entities[0].motion={type:'patrol',minX:170,maxX:200,speed:60},
    l=>l.rules[0].actions=[{type:'hold',target:'missing'}]]) {
    const invalid=fixture();mutate(invalid);assert.equal(validateLevel(invalid).valid,false);
  }
});

test('editable demonstrations solve and exactly replay, with creature and lift requiring input',()=>{
  for(const level of examples) {
    assert.equal(validateLevel(level).valid,true);
    const game=createSimulation(level);game.start();
    if(level.id==='example-creature')game.click('croco');
    if(level.id==='example-floors')game.click('call');
    game.step(3000);assert.equal(game.snapshot().status,'won',level.id);
    assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
  }
  const croco=createSimulation(examples[1]);croco.start().step(3000);assert.equal(croco.snapshot().reason,'hurt');
  const lift=createSimulation(examples[2]);lift.start().step(3000);assert.equal(lift.snapshot().reason,'fall');
});

test('patrol reversal, deactivation, empty-hand conditions, and reactivation after a drop are stable',()=>{
  const level=fixture();level.actor.speed=15;level.entities[0].motion={type:'patrol',minX:140,maxX:160,speed:180};
  level.rules=[{on:{type:'click',source:'tool'},actions:[{type:'set',target:'tool',state:'inactive'}]},
    {on:{type:'contact',source:'tool'},if:[{holding:null}],actions:[{type:'hold',target:'tool'},{type:'drop'},
      {type:'after',ticks:10,actions:[{type:'set',target:'tool',state:'active'}]}]}];
  const game=createSimulation(level);game.start().step(60);
  assert.ok(game.snapshot().entities.tool.x>=140 && game.snapshot().entities.tool.x<=160);
  game.click('tool');game.step();const x=game.snapshot().entities.tool.x;game.step(60);assert.equal(game.snapshot().entities.tool.x,x);
  const other=fixture();other.entities[0].motion={type:'patrol',minX:140,maxX:200,speed:60};
  other.rules[0].actions.push({type:'drop'},{type:'after',ticks:10,actions:[{type:'set',target:'tool',state:'active'}]});
  const dropped=createSimulation(other);dropped.start().step(50);
  assert.equal(dropped.snapshot().actor.holding,null);assert.ok(dropped.snapshot().entities.tool.x>=140);
});

test('connectors validate landings and disabled ladders stay passable as ground',()=>{
  const level=journey('ladder');level.entities[0].state='disabled';
  const game=createSimulation(level);game.start().step(150);assert.equal(game.snapshot().actor.y,440);
  const invalid=journey('lift');invalid.platforms[1].x=400;
  assert.equal(validateLevel(invalid).valid,false);
  for(const mutate of [l=>l.entities[0].toY=430,l=>l.entities[0].speed=0,l=>l.entities[0].upperDirection=0,
    l=>l.entities[0].y=600,l=>l.actor.direction=2]) {
    const bad=journey('ladder');mutate(bad);assert.equal(validateLevel(bad).valid,false);
  }
});

test('invalid image formats and non-finite draft geometry are rejected before rendering',()=>{
  for(const image of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,!!',
    'data:image/png;base64,'+'a'.repeat(32769)]) {
    const level=fixture();level.entities[0].appearance.image=image;assert.equal(validateLevel(level).valid,false);
  }
  const level=fixture();level.entities[0].appearance.image='data:image/png;base64,AAAA';
  assert.equal(validateLevel(level).valid,true);
  for(const mutate of [l=>l.actor.y='up',l=>l.goal.y=NaN,l=>l.platforms[0].y={},l=>l.entities[0].y=null,
    l=>l.entities[0].motion={type:'patrol',minX:'140',maxX:200,speed:40}]) {
    const bad=fixture();mutate(bad);assert.throws(()=>createEditorStore().open('bad',bad));
  }
  const bad=journey('ladder');bad.entities[0].toY='upper';assert.throws(()=>createEditorStore().open('bad',bad));
});

test('the valid object id null is not mistaken for the empty hand slot',()=>{
  const level=fixture();level.entities[0].id='null';level.rules=[];
  const game=createSimulation(level);game.start().step(10);
  assert.equal(game.snapshot().actor.holding,null);assert.equal(game.snapshot().entities.null.x,150);
  level.rules=[{on:{type:'contact',source:'null'},actions:[{type:'hold',target:'null'}]}];
  const pickup=createSimulation(level);pickup.start().step(50);assert.equal(pickup.snapshot().actor.holding,'null');
});

test('connectors also expose contact at the upper landing',()=>{
  const level=journey('ladder');level.actor={x:250,y:260,speed:120};
  level.rules=[{on:{type:'contact',source:'up'},actions:[{type:'hurt',message:'楼上也能碰到梯子。'}]}];
  const game=createSimulation(level);game.start().step(30);assert.equal(game.snapshot().reason,'hurt');
});

test('image-heavy workspaces fail saving explicitly before exceeding the restoration limit',()=>{
  const level=fixture(),image='data:image/png;base64,'+'a'.repeat(32740);
  level.entities=Array.from({length:3},(_,i)=>({...level.entities[0],id:'image-'+i,appearance:{skin:'axe',image}}));level.rules=[];
  const store=createEditorStore();for(let i=0;i<25;i++)store.open('map-'+i,level);
  assert.throws(()=>store.serialize(),/2 MiB/);
});
