import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {createStreetLevel,STREET_PLAN} from '../src/editor/street-level.js';
import {createSimulation,validateLevel,replayRecording} from '../src/core/engine.js';
import {passagePosition,syncPassageObject,spaceTouches,spaceBounds} from '../src/core/spatial.js';
import {artCorners,artTransform} from '../src/render/resources.js';
import {layeredArtOrder} from '../src/render/layered.js';
import {assignWalkPlane,setPlaneBaseline} from '../src/editor/layered-editing.js';
import {createEditorStore,moveObject,deleteObject} from '../src/editor/model.js';

function fixture(){
  const l=createLayeredLevel();l.entities.push({id:'visitor',kind:'object',label:'通路使用者',state:'active',x:390,width:24,height:40,
    space:{passage:'alley',progress:.5,length:24,depth:120,height:0},contact:{effect:'lethal'},behaviors:[
      {id:'clear',label:'离开通路',actions:[{type:'move',target:'visitor',progress:1,ticks:50},{type:'after',ticks:50,actions:[{type:'set',target:'visitor',state:'inactive'}]}]}]});
  l.rules=[{on:{source:'visitor',type:'click'},actions:[{type:'invoke',target:'visitor',behavior:'clear'}]}];return l;
}
function street(plan=STREET_PLAN,level=createStreetLevel()){
  const game=createSimulation(level).start(),seen=new Map();
  for(let tick=1;tick<=3600&&game.snapshot().status==='running';tick++){
    for(const a of plan)if(a.tick===tick)game.click(a.source);game.step();const s=game.snapshot();
    if(!s.actor.passage){const p=s.actor.space.plane;seen.set(p,(seen.get(p)??0)+1);}
  }return {game,seen};
}

test('street has three substantial traversed streets and ends outside, without an office interior',()=>{
  const l=createStreetLevel(),{game,seen}=street();assert.equal(game.snapshot().status,'won');
  assert.equal(seen.size,3);for(const count of seen.values())assert.ok(count>650);
  for(const p of l.spatial.planes)assert.ok(l.platforms.filter(s=>s.space.plane===p.id).reduce((n,s)=>n+s.width,0)>=800);
  assert.equal(game.snapshot().actor.space.height,0);assert.equal(l.goal.space.height,0);
  assert.ok(!l.scene.nodes.some(n=>/工位|内部|室内/.test(n.label)));
  assert.deepEqual(replayRecording(l,game.recording()).snapshot(),game.snapshot());
});

test('passage occupancy hurts only inside its explicit passage and can move clear via ordinary behaviors',()=>{
  const l=fixture(),blocked=createSimulation(l).start().step(1000).snapshot();assert.equal(blocked.status,'lost');assert.equal(blocked.reason,'hurt');assert.ok(blocked.actor.passage);
  const game=createSimulation(l).start().step(150);game.click('visitor');game.step(200);
  assert.equal(game.snapshot().entities.visitor.space.progress,1);assert.equal(game.snapshot().entities.visitor.state,'inactive');
  assert.equal(game.step(1500).snapshot().status,'won');
  assert.equal(spaceTouches([{from:{x:390,depth:120,height:0,plane:'front'},to:{x:390,depth:120,height:0,plane:'front'}}],l.entities.at(-1)),false);
});

test('fast moving passage occupants use swept relative progress, not a screen rectangle',()=>{
  const e=fixture().entities.at(-1);e.previousSpace={...e.space,progress:.9};e.space.progress=.1;
  const point={x:0,depth:0,height:0,passage:'alley',progress:.5};
  assert.equal(spaceTouches([{distance:200,from:point,to:point}],e),true);
  assert.equal(spaceTouches([{distance:200,from:{...point,passage:'other'},to:{...point,passage:'other'}}],e),false);
});

test('traffic windows recover after early input; late input cannot erase a collision',()=>{
  for(const [source,early,late] of [['ped-signal',100,930],['scooter-bell',900,1810]]){
    for(const tick of [early,late]){const plan=STREET_PLAN.map(a=>a.source===source?{...a,tick}:a).sort((a,b)=>a.tick-b.tick);
      const {game}=street(plan);assert.equal(game.snapshot().status,'lost');assert.equal(game.snapshot().reason,'hurt');assert.ok(game.snapshot().actor.passage);}
  }
});

test('repositioning streets never changes passage encounters or their timing',()=>{
  const l=fixture(),edited=structuredClone(l);setPlaneBaseline(edited,'back',310);
  const a=createSimulation(l).start().step(1000).snapshot(),b=createSimulation(edited).start().step(1000).snapshot();
  assert.equal(a.tick,b.tick);assert.equal(a.status,b.status);assert.deepEqual(a.signals,b.signals);
  assert.equal(a.entities.visitor.space.progress,b.entities.visitor.space.progress);
  assert.notEqual(a.entities.visitor.space.depth,b.entities.visitor.space.depth);
});

test('passage object dragging, history and JSON keep ownership; referenced passages cannot be deleted',()=>{
  const l=fixture(),store=createEditorStore();store.open('example',l);
  store.change(d=>moveObject(d,{type:'entity',id:'visitor'},12,-18));
  const e=store.document().entities.at(-1);assert.equal(e.space.passage,'alley');assert.ok(e.space.progress>.5);
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());
  store.undo();assert.deepEqual(store.document(),l);
  assert.throws(()=>deleteObject(l,{type:'entity',id:'alley'}),/通路/);
  const bounds=spaceBounds(l,'object',l.entities.at(-1));assert.equal(bounds.x,378);assert.equal(bounds.width,24);
});

test('moving a passage occupant to a street converts all move destinations to valid plane coordinates',()=>{
  const l=fixture(),e=l.entities.at(-1);e.behaviors[0].actions.push({type:'after',ticks:60,actions:[{type:'move',target:e.id,progress:.3,ticks:20}]});
  assignWalkPlane(l,e,'front');assert.equal(validateLevel(l).valid,true);assert.equal(e.space.passage,undefined);
  for(const a of [e.behaviors[0].actions[0],e.behaviors[0].actions.at(-1).actions[0]]){
    assert.equal(a.progress,undefined);assert.equal(a.x,e.x);assert.equal(a.depth,e.space.depth);assert.equal(a.height,e.space.height);
  }
});

test('tapered art has a compact trapezoid and stays below actor and held item throughout traversal',()=>{
  const l=createStreetLevel(),node=l.scene.nodes.find(n=>n.fitPassage),corners=Object.values(artCorners(node,l));
  assert.ok(Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x))<=64);
  assert.equal(artTransform(node,l).rotation,-90);
  const width=Math.hypot(corners[1].x-corners[2].x,corners[1].y-corners[2].y);
  assert.ok(width<Math.hypot(corners[0].x-corners[3].x,corners[0].y-corners[3].y));
  for(const progress of [.01,.3,.7,.99]){
    const actor={x:1040,space:{plane:'front',depth:45+175*progress,height:0},holding:'breakfast',passage:{id:'alley',to:'lane-entry',from:'front-alley',travelled:160*progress,distance:160}};
    const order=layeredArtOrder(l,{actor,entities:Object.fromEntries(l.entities.map(e=>[e.id,e]))});
    assert.ok(order.indexOf(node)<order.findIndex(n=>n.bind?.type==='actor'));
    assert.ok(order.indexOf(node)<order.findIndex(n=>n.bind?.id==='breakfast'));
  }
  for(const p of l.spatial.planes)p.order-=6;
  assert.ok(layeredArtOrder(l).indexOf(node)<layeredArtOrder(l).findIndex(n=>n.bind?.type==='actor'));
  for(const p of l.spatial.planes)p.order+=6;
  const before=street().game.snapshot(),visual=structuredClone(l);visual.scene.nodes.find(n=>n.fitPassage).passageView.endScale=.3;
  assert.deepEqual(street(STREET_PLAN,visual).game.snapshot(),before);
});

test('invalid passage ownership, moves and perspective inputs are rejected',()=>{
  for(const mutate of [
    l=>l.entities.at(-1).space.passage='missing',l=>l.entities.at(-1).space.plane='front',
    l=>l.entities.at(-1).space.progress=1.1,l=>l.entities.at(-1).space.length=0,
    l=>l.entities.at(-1).behaviors[0].actions[0].progress=-1,
    l=>l.entities.at(-1).collider={enabled:true},l=>l.entities.at(-1).space.height=null,
  ]){const l=fixture();mutate(l);assert.equal(validateLevel(l).valid,false);}
  const l=createStreetLevel();l.scene.nodes.find(n=>n.fitPassage).passageView.endScale=0;assert.equal(validateLevel(l).valid,false);
  assert.deepEqual(passagePosition(fixture(),'alley',.5),{x:390,depth:120,height:0});
  const e=fixture().entities.at(-1);e.x=0;syncPassageObject(fixture(),e);assert.equal(e.x,390);
});
