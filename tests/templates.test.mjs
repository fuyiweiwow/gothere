import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneTemplates,createTemplatePractice} from '../src/editor/template-catalog.js';
import {captureTemplate,placeTemplate,moveComposition,copyComposition,detachComposition,removeComposition,compositionBounds} from '../src/editor/templates.js';
import {createEditorStore,deleteObject} from '../src/editor/model.js';
import {deleteArt} from '../src/editor/resources.js';
import {validateLevel} from '../src/core/schema.js';
import {createSimulation,replayRecording} from '../src/core/engine.js';
import {artTransform,entityArtBounds} from '../src/render/resources.js';
import {feedbackDefault} from '../src/content/feedback-presets.js';
import {setWirePoints} from '../src/editor/routing.js';

const encounter=()=>sceneTemplates().find(t=>t.id==='bus-encounter');
const run=(level,bus)=>{const game=createSimulation(level).start();game.step(180);game.click(bus);game.step(1500);return game;};

test('background and building templates remain broad editable art with no inferred gameplay',()=>{
  const l=createTemplatePractice('practice');assert.equal(validateLevel(l).valid,true);assert.equal(l.entities.length,0);assert.equal(l.scene.compositions.length,1);
  assert.ok(l.scene.nodes.some(n=>n.asset==='stopAtmosphere'));assert.ok(l.scene.nodes.some(n=>n.asset==='stopGround'));
  const before=structuredClone(l.actor),id=placeTemplate(l,sceneTemplates()[2],{x:500,y:423});
  assert.equal(l.scene.compositions.find(c=>c.id===id).entities.length,0);assert.deepEqual(l.actor,before);
  const bounds=compositionBounds(l,id);moveComposition(l,id,30,-20);const after=compositionBounds(l,id);
  assert.equal(after.x,bounds.x+30);assert.equal(after.y,bounds.y-20);
});

test('template placement remaps internal rules, nested behaviors, art and animation/sound subscriptions',()=>{
  const l=createTemplatePractice('practice'),id=placeTemplate(l,encounter()),c=l.scene.compositions.find(c=>c.id===id),bus=l.entities.find(e=>e.behaviors?.some(b=>b.id==='open'));
  assert.equal(validateLevel(l).valid,true);assert.equal(c.entities.length,8);assert.equal(c.nodes.length,5);
  assert.ok(l.scene.feedback.some(f=>f.trigger.source===bus.id&&f.sound==='clack'));
  const person=l.scene.nodes.find(n=>n.asset==='stopPassengerAIdle'),e=l.entities.find(e=>e.id===person.bind.id);
  assert.equal(artTransform(person,l,{tick:10,entities:{[e.id]:{...e,translation:{}}}}).asset,'stopPassengerAWalk');
  const game=run(l,bus.id);assert.equal(game.snapshot().status,'won');assert.ok(entityArtBounds(l,game.snapshot(),bus.id).x>1200);
  assert.deepEqual(replayRecording(l,game.recording()).snapshot(),game.snapshot());
});

test('moving a logical composition preserves boarding alignment and explicitly pinned world destinations',()=>{
  const l=createTemplatePractice('practice'),id=placeTemplate(l,encounter());moveComposition(l,id,-40);
  const bus=l.entities.find(e=>e.behaviors?.some(b=>b.id==='open')),person=l.entities.find(e=>e.label==='队尾的公文包乘客');
  assert.equal(bus.x,640);assert.equal(person.behaviors[0].actions[0].x,731);
  assert.equal(bus.behaviors.find(b=>b.id==='leave').actions[1].actions[0].x,1240);
  assert.equal(person.behaviors[0].actions[0].height,7);
  assert.equal(run(l,bus.id).snapshot().status,'won');
  assert.throws(()=>moveComposition(l,id,0,1),/行走层/);
});

test('duplicated instances have independent objects, rules, art and feedback, and survive history/JSON',()=>{
  const store=createEditorStore();store.open('practice',createTemplatePractice('practice'));let a,b;
  store.change(l=>{a=placeTemplate(l,encounter());});const before=store.document();
  store.change(l=>{b=copyComposition(l,a);});const l=store.document(),one=l.scene.compositions.find(c=>c.id===a),two=l.scene.compositions.find(c=>c.id===b);
  assert.ok(two.entities.every(id=>!one.entities.includes(id)));assert.ok(two.nodes.every(id=>!one.nodes.includes(id)));
  const secondBus=l.entities.find(e=>two.entities.includes(e.id)&&e.behaviors?.some(b=>b.id==='open'));
  const game=createSimulation(l).start();game.click(secondBus.id);game.step(2);
  const firstPassenger=l.entities.find(e=>one.entities.includes(e.id)&&e.label==='车门前的乘客');
  assert.equal(game.snapshot().entities[firstPassenger.id].translation,undefined);
  assert.deepEqual(createEditorStore(store.serialize()).document(),l);store.undo();assert.deepEqual(store.document(),before);store.redo();assert.deepEqual(store.document(),l);
});

test('new plane placement retargets depths and keeps art grounded without changing the background',()=>{
  const l=createTemplatePractice('practice');l.spatial.planes.push({id:'rear',label:'后街',depth:250,order:-1});
  const sky=structuredClone(l.scene.nodes[0]),id=placeTemplate(l,encounter(),{x:680,plane:'rear'}),c=l.scene.compositions.find(c=>c.id===id);
  for(const e of l.entities){assert.equal(e.space.plane,'rear');assert.equal(e.space.depth,250);}
  const bus=l.entities.find(e=>e.behaviors?.some(b=>b.id==='open'));assert.equal(bus.behaviors[2].actions[1].actions[0].depth,250);
  assert.equal(c.origin.y,370);assert.deepEqual(l.scene.nodes[0],sky);assert.equal(validateLevel(l).valid,true);
});

test('detach changes membership only; deletion prunes subscriptions and membership without touching other drafts',()=>{
  const store=createEditorStore();store.open('practice',createTemplatePractice('practice'));let id;
  store.change(l=>{id=placeTemplate(l,encounter());});const l=store.document(),physics=structuredClone(l.entities),rules=structuredClone(l.rules);
  detachComposition(l,id);assert.deepEqual(l.entities,physics);assert.deepEqual(l.rules,rules);assert.equal(validateLevel(l).valid,true);
  store.change(d=>deleteArt(d,d.scene.compositions.find(c=>c.id===id).nodes[0]));assert.equal(validateLevel(store.document()).valid,true);
  store.change(d=>deleteObject(d,{type:'entity',id:d.scene.compositions.find(c=>c.id===id).entities[0]}));assert.equal(validateLevel(store.document()).valid,true);
  store.undo();store.undo();store.change(d=>removeComposition(d,id));assert.equal(store.document().entities.length,0);assert.equal(store.document().rules.length,0);
  assert.equal(store.document().scene.compositions.length,1);assert.equal(validateLevel(store.document()).valid,true);
});

test('failed placement/movement is atomic, and incomplete or malformed template membership is rejected',()=>{
  const l=createTemplatePractice('practice'),id=placeTemplate(l,encounter()),before=structuredClone(l);
  assert.throws(()=>moveComposition(l,id,-900));assert.deepEqual(l,before);assert.throws(()=>placeTemplate(l,encounter(),{x:-200}));assert.deepEqual(l,before);
  assert.throws(()=>captureTemplate(l,{id:'bad',label:'bad',origin:{x:0,y:0},nodes:[l.scene.nodes.find(n=>n.bind?.type==='entity').id]}),/组合外/);
  for(const mutate of [d=>d.scene.compositions[0].nodes.push('missing'),d=>d.scene.compositions[0].origin.x=NaN,d=>d.scene.compositions.push(structuredClone(d.scene.compositions[0]))]){
    const bad=structuredClone(l);mutate(bad);assert.equal(validateLevel(bad).valid,false);
  }
  const linked=structuredClone(l),c=linked.scene.compositions.find(c=>c.id===id);linked.entities.push({id:'external',label:'external',kind:'object',state:'active',x:300,width:20,height:20,space:{plane:'street',depth:130,depthSize:20,height:0}});
  linked.rules.push({on:{source:'external',type:'click'},actions:[{type:'set',target:c.entities[0],state:'inactive'}]});
  assert.throws(()=>copyComposition(linked,id),/外部逻辑引用/);
});

test('art-only templates preserve ambient animation and keep assets, audio, node and object IDs in separate namespaces',()=>{
  const source=createTemplatePractice('source');source.entities.push({id:'same',label:'test',kind:'object',x:400,width:20,height:20,state:'active',space:{plane:'street',depth:130,depthSize:20,height:0},
    behaviors:[{id:'show',label:'show',actions:[{type:'set',target:'same',state:'inactive'}]}]});
  source.rules.push({on:{source:'same',type:'click'},actions:[{type:'invoke',target:'same',behavior:'show'}]});
  source.scene.assets.push({id:'same',label:'test image',src:'data:image/png;base64,AAAA',width:1,height:1});
  source.scene.sounds.push({id:'same',label:'test sound',src:'data:audio/wav;base64,AAAA'});
  source.scene.nodes.push({id:'same',label:'test part',asset:'same',x:0,y:-20,width:20,height:20,layer:10,bind:{type:'entity',id:'same'},animation:{frames:['same'],fps:6}});
  source.scene.feedback.push({...feedbackDefault('same','same'),trigger:{type:'behavior',source:'same',behavior:'show'},sound:'same'});
  const t=captureTemplate(source,{id:'test',label:'test',nodes:['same'],entities:['same'],origin:{x:400,y:490}}),dest=createTemplatePractice('dest');
  placeTemplate(dest,t);const n=dest.scene.nodes.at(-1),f=dest.scene.feedback.at(-1),e=dest.entities[0];
  assert.equal(n.bind.id,e.id);assert.equal(n.asset,dest.scene.assets[0].id);assert.equal(n.animation.frames[0],n.asset);
  assert.equal(f.target,n.id);assert.equal(f.trigger.source,e.id);assert.equal(f.sound,dest.scene.sounds[0].id);
  assert.equal(validateLevel(dest).valid,true);
  const ambient={...feedbackDefault(source.scene.nodes[0].id,'ambient'),trigger:{type:'start'},motion:'none',particles:'smoke',loop:true};source.scene.feedback.push(ambient);
  const backdrop=captureTemplate(source,{id:'ambient-pack',label:'ambient',nodes:[source.scene.nodes[0].id],origin:{x:0,y:0}});
  const background=placeTemplate(dest,backdrop);assert.equal(dest.scene.compositions.find(c=>c.id===background).entities.length,0);
  assert.equal(dest.scene.feedback.at(-1).loop,true);assert.equal(dest.scene.feedback.at(-1).trigger.type,'start');
});

test('wire routing edits preserve the independent map-coordinate destination annotation',()=>{
  const l=createTemplatePractice('practice');l.entities=[{id:'mover',label:'mover',kind:'object',state:'active',x:200,width:20,height:20,space:{plane:'street',depth:130,depthSize:20,height:0}}];
  l.rules=[{on:{source:'mover',type:'click'},actions:[{type:'move',target:'mover',x:1240,depth:130,height:0,ticks:60,editor:{waypoints:[],keepWorldX:true}}]}];
  setWirePoints(l,{rule:0,path:[0]},[{x:100,y:200}]);assert.equal(l.rules[0].actions[0].editor.keepWorldX,true);
  setWirePoints(l,{rule:0,path:[0]},[]);assert.equal(l.rules[0].actions[0].editor.keepWorldX,true);assert.equal(validateLevel(l).valid,true);
});

test('failure clips travel with imported frames and remap their actual cause when copied',()=>{
  const source=createTemplatePractice('source');
  source.entities.push({id:'person',label:'person',kind:'object',x:400,width:20,height:20,state:'active',space:{plane:'street',depth:130,depthSize:20,height:0}});
  source.scene.assets.push({id:'clip-only',label:'clip frame',src:'data:image/png;base64,AAAA',width:1,height:1});
  source.scene.nodes.push({id:'person-art',label:'person',asset:'stopPassengerAIdle',x:0,y:-20,width:20,height:20,layer:10,bind:{type:'entity',id:'person'}});
  source.scene.feedback.push({...feedbackDefault('person-art','shove'),trigger:{type:'lost',cause:'person'},animation:{frames:['clip-only'],fps:10}});
  const selection={id:'shove',label:'shove',nodes:['person-art'],entities:['person'],origin:{x:400,y:490}};
  assert.throws(()=>captureTemplate(source,{...selection,entities:[]}),/组合外/);
  const template=captureTemplate(source,selection);assert.equal(template.assets[0]?.id,'clip-only');
  const dest=createTemplatePractice('dest');placeTemplate(dest,template);
  const cause=dest.entities[0].id,cue=dest.scene.feedback.at(-1);
  assert.equal(cue.trigger.cause,cause);assert.notEqual(cause,'person');
  assert.equal(cue.animation.frames[0],dest.scene.assets[0].id);assert.notEqual(cue.animation.frames[0],'clip-only');
  assert.equal(validateLevel(dest).valid,true);
  const bad=structuredClone(template);bad.feedback[0].trigger.cause='outsider';
  const before=structuredClone(dest);assert.throws(()=>placeTemplate(dest,bad),/组合外/);assert.deepEqual(dest,before);
});
