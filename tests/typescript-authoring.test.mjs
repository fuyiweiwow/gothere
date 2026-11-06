import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankLevel} from '../src/editor/model.js';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createSpatialLevel} from '../src/editor/spatial-level.js';
import {createLayeredLevel} from '../src/editor/layered-level.js';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';
import {createTowStreetLevel} from '../src/editor/tow-street-level.js';
import {createCrosswalkLevel} from '../src/editor/crosswalk-level.js';
import {createScooterLevel} from '../src/editor/scooter-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createAuthoringAPI} from '../src/editor/authoring-api.js';
import {createAuthoringLibrary} from '../src/editor/authoring-library.js';
import {levelToProject,createProjectExample,renameProjectFile,projectModuleGraph} from '../src/editor/javascript-project.js';
import {semanticMapSource} from '../src/editor/semantic-source.js';
import {zipProject,unzipProject,analyzeModule} from '../scripts/project-code-tools.mjs';
import {validateLevel,createSimulation,replayRecording} from '../src/core/engine.js';
import {placementAnchor} from '../src/core/placement.js';
import {executeProject,typeService} from './helpers/project.mjs';

test('typed semantic projects preserve all existing map schemas, artwork and action order exactly',async()=>{
  for(const factory of [()=>createBlankLevel('blank',{layered:true}),createFirstLevel,createSpatialLevel,createLayeredLevel,createBusStopLevel,createTowStreetLevel,createCrosswalkLevel,createScooterLevel,createCommuteChapter]){
    const original=factory(),project=levelToProject(original,{typescript:true}),service=await typeService();
    assert.deepEqual(service.diagnostics(project),[],original.id);
    assert.equal(project.entry,'level.ts');
    assert.deepEqual(await executeProject(project),original,original.id);
  }
  const map=levelToProject(createCommuteChapter(),{typescript:true}).files['map.ts'];
  assert.match(map,/\.layer\(/);assert.match(map,/\.at\(/);assert.match(levelToProject(createCommuteChapter(),{typescript:true}).files['routes.ts'],/level\.route/);
  assert.doesNotMatch(map,/schemaVersion|"depth"|"space"|"projection"/);
});

test('missing or extended map fields use lossless compatibility definitions',async()=>{
  for(const mutate of [l=>delete l.world.physics,l=>delete l.spatial.planes[0].label,l=>delete l.platforms[0].space.height,l=>{l.custom={message:'retained'};},l=>{l.spatial.nodes[0].depth+=1;},l=>{l.actor.editor={note:'keep'};},l=>{l.platforms[0].height=50;}]){
    const original=createBlankLevel('fallback',{layered:true});mutate(original);
    assert.equal(semanticMapSource(original),null);
    assert.deepEqual(await executeProject(levelToProject(original,{typescript:true})),original);
  }
  const slope=createBlankLevel('slope',{layered:true});slope.platforms[0].space.heightEnd=80;
  assert.match(semanticMapSource(slope),/endHeight/);
  assert.deepEqual(await executeProject(levelToProject(slope,{typescript:true})),slope);
  const custom=createBlankLevel('names',{layered:true});custom.description="A note from './kept.js'";
  custom.custom={quote:"from './source.js'"};createAuthoringAPI(custom,custom).object('level');
  assert.deepEqual(await executeProject(levelToProject(custom,{typescript:true})),custom);
  const extended=createCommuteChapter();extended.platforms[0].space.custom={note:'preserve'};
  assert.equal(semanticMapSource(extended),null);
  assert.deepEqual(await executeProject(levelToProject(extended,{typescript:true})),extended,'partial semantic-map fallback retains anchored artwork and linked actions');
});

test('semantic references, passages and generic object capabilities build a playable typed sample',async()=>{
  const project=createProjectExample({typescript:true}),level=await executeProject(project);
  assert.equal(validateLevel(level).valid,true,validateLevel(level).errors.join('\n'));
  const game=createSimulation(level).start();game.click('cart');game.step(1200);assert.equal(game.snapshot().status,'won');
  const unattended=createSimulation(level).start();unattended.step(1200);assert.equal(unattended.snapshot().status,'lost');
  const blank=createBlankLevel('sdk',{layered:true});
  const {Level,Entity}=createAuthoringLibrary(l=>createAuthoringAPI(l,blank),blank);
  const map=new Level('Semantic'),front=map.layer('front',{screenY:560}),back=map.layer('back',{screenY:320});
  front.ground({from:20,to:1180});back.ground({from:20,to:1180});
  const start=map.point('start',front.at(60)),entry=map.point('entry',front.at(500)),exit=map.point('exit',back.at(500)),finish=map.point('finish',back.at(1100));
  const passage=map.passage('steps',entry,exit,{size:{width:40,height:10}});
  map.route(start,entry,passage,exit,finish).traveler({start}).destination(finish);
  const object=new Entity(map,'any-art',{at:back.at(900),size:{width:30,height:20}}).contact({effect:'lethal'});
  object.behavior('leave',[object.set('inactive'),object.move({to:back.at(1350),seconds:1})]).on('click',[object.invoke('leave')]);
  assert.equal(validateLevel(map.toJSON()).valid,true,validateLevel(map.toJSON()).errors.join('\n'));
  assert.throws(()=>map.object('wrong',{at:front}),/Position/);
  assert.throws(()=>map.point('foreign',new Level('Other').layer('street',{screenY:400}).at(60)),/同一关卡/);
  assert.throws(()=>map.route(start,finish),/跨行走层/);
  assert.throws(()=>front.ground({from:500,to:400}),/终点/);
});

test('real TypeScript checks primitive values, reference kinds, methods and cross-file subclasses',async()=>{
  const service=await typeService(),project=createProjectExample({typescript:true});
  project.files['level.ts']=project.files['level.ts'].replace('speed: 70',"speed: 'fast'").replace("street.at(520)","street");
  const errors=service.diagnostics(project);assert.ok(errors.some(d=>d.code===2322));assert.ok(errors.some(d=>d.code===2345));
  assert.throws(()=>service.compile(project),/level.ts:\d+:\d+ · TS/);
  project.files['level.ts']="import { Level } from '@gothere/core'; const level = new Level('Typed'); level.fakeMethod(); export default () => level;";
  assert.ok(service.diagnostics(project).some(d=>d.code===2339));
  const prefix="import { DepartingObject as Obstacle } from './objects/departing-object.ts';\nimport { Level } from '@gothere/core';\nconst level = new Level('Test'); const street = level.layer('front', {screenY:500});\nconst custom = new Obstacle(level, 'cart', street.at(500));\ncustom.";
  project.files['objects/departing-object.ts']=project.files['objects/departing-object.ts'].replace('  constructor(',"  clearTheWay(): string { return 'done'; }\n  constructor(");
  project.files['level.ts']=prefix;
  const options=service.completions(project,'level.ts',prefix.length);
  assert.ok(options.some(e=>e.label==='clearTheWay'&&e.detail.includes('string')));
  assert.ok(options.some(e=>e.label==='behavior'));
  const hover=service.hover(project,'level.ts',prefix.indexOf('custom =')+2);assert.match(hover.text,/Obstacle/);
});

test('type-only imports survive folder rename, ZIP and compile without reaching runtime',async()=>{
  const service=await typeService(),project=createProjectExample({typescript:true});
  const refs=service.analyzeFiles(project);
  const renamed=renameProjectFile(project,'objects/departing-object.ts','shared/props/obstacle.ts',(source,path)=>refs[path]);
  assert.match(renamed.files['level.ts'],/shared\/props\/obstacle.ts/);
  const copy=unzipProject(zipProject(renamed.files,renamed.entry));assert.deepEqual(copy.files,renamed.files);
  const compiled=service.compile(copy);assert.doesNotMatch(compiled.files['shared/props/obstacle.ts'],/type Level|type Position|: Level|: Position/);
  assert.ok(projectModuleGraph(compiled,analyzeModule).length===2);
  assert.equal(validateLevel(await executeProject(copy)).valid,true);
  const syntactic={...project,files:{...project.files,'broken.ts':'export const = 5;'}};assert.throws(()=>service.compile(syntactic),/broken.ts/);
  const dynamic={...project,files:{...project.files,'unused.ts':"export const lazy = () => import('./level.ts');"}};
  assert.throws(()=>service.analyzeFiles(dynamic),/动态 import/);
  const declaration={...project,files:{...project.files,'shared.d.ts':'export interface Metadata { score: number }'}};
  assert.equal(service.compile(declaration).files['shared.d.ts'],'export {};\n');
  assert.equal(validateLevel(await executeProject(declaration)).valid,true);
});

test('compiled commute chapter retains the full solution and deterministic replay',async()=>{
  const level=await executeProject(levelToProject(createCommuteChapter(),{typescript:true})),game=createSimulation(level).start(),used=new Set();
  for(let i=0;i<6000&&game.snapshot().status==='running';i++){
    const s=game.snapshot(),e=s.entities;
    const click=(id,ready)=>{if(ready&&!used.has(id)){game.click(id);used.add(id);}};
    const place=(id,target,ready)=>{if(ready&&!used.has(id)){game.placeAt(id,placementAnchor(level,e[target]));used.add(id);}};
    click('bus',s.tick>=60);click('officer',e.intrusion.state==='active');click('caller',e['tow-ready'].state==='active');
    place('barrier','gap',e['scooter-awake'].state==='active');place('breakfast','bowl',s.actor.space.plane==='far'&&s.actor.x>360);game.step();
  }
  assert.equal(game.snapshot().status,'won');assert.deepEqual(replayRecording(level,game.recording()).snapshot(),game.snapshot());
});

test('injected contexts expose concrete resources, references and behavior slots with project definitions',async()=>{
  const project=levelToProject(createCommuteChapter(),{typescript:true}),service=await typeService();
  assert.match(project.files['objects/bus.ts'],/extends Entity<ProjectContext>/);
  assert.match(project.files['objects/bus.ts'],/objects\.itemPassengerC\.doBoard\.invoke/);
  assert.doesNotMatch(project.files['events.ts'],/level\.entity\(|"target"|"source"/);
  assert.match(project.files['events.ts'],/Events\.Click/);assert.match(project.files['events.ts'],/States\.Active/);
  assert.ok(project.files['scene.ts'].length<1000,'scene is orchestration, not an embedded document');
  assert.match(project.files['scene/styles.ts'],/scene\.template\(assets\.images\./);
  assert.match(project.files['scene/feedback.ts'],/behavior: objects\.itemBus\.doLeave/);
  const eventPosition=project.files['events.ts'].indexOf('itemBus')+2;
  assert.ok(service.definitions(project,'events.ts',eventPosition).some(d=>d.path==='objects/index.ts'));
  const behaviorPosition=project.files['events.ts'].indexOf('doOpen')+2;
  assert.ok(service.definitions(project,'events.ts',behaviorPosition).some(d=>d.path==='objects/bus.ts'));
  const eventConstant=project.files['events.ts'].indexOf('Events.Click')+'Events.'.length+1;
  assert.ok(service.definitions(project,'events.ts',eventConstant).some(d=>d.path==='@gothere/core'));
  const probe='\nconst known = context.assets.images.builtin.';
  project.files['objects/bus.ts']+=probe;
  // Probe inside the configure scope for actual inferred resource names.
  project.files['objects/bus.ts']=project.files['objects/bus.ts'].replace(probe,'').replace('    const context = this.context;','    const context = this.context;\n    context.assets.images.builtin.');
  const position=project.files['objects/bus.ts'].indexOf('context.assets.images.builtin.')+'context.assets.images.builtin.'.length;
  assert.ok(service.completions(project,'objects/bus.ts',position).some(c=>c.label==='blockStreets'));
  project.files['objects/bus.ts']=project.files['objects/bus.ts'].replace('context.assets.images.builtin.','context.assets.images.builtin.missingPicture;');
  assert.ok(service.diagnostics(project).some(d=>d.code===2339&&d.path==='objects/bus.ts'));
});

test('art resource API retains imported asset order, sounds, frame animation and extended definitions',async()=>{
  const level=createCommuteChapter();
  level.scene.assets=[{id:'customA',label:'A',width:1,height:1,src:'data:image/png;base64,AAAA'},{id:'customB',label:'B',width:1,height:1,src:'data:image/png;base64,AAAA'}];
  level.scene.nodes[0].asset='customB';level.scene.nodes[1].asset='customA';
  level.scene.nodes[0].animation={frames:['customB','customA'],fps:6};
  level.scene.sounds=[{id:'mySound',label:'sound',src:'data:audio/wav;base64,AAAA'}];level.scene.feedback[0].sound='mySound';
  level.entities[0].behaviors[0].custom={preserve:true};
  level.entities.find(e=>!e.behaviors).behaviors=[];
  level.entities[0].space.depth+=1;
  level.scene.nodes.find(n=>n.anchor).anchor.depth+=1;
  assert.deepEqual(await executeProject(levelToProject(level,{typescript:true})),level);
});

test('resource references reject foreign scenes and type confusion without changing old data schemas',()=>{
  const blank=createBlankLevel('ctx',{layered:true}),{Level,Entity,LevelContext,Events,States}=createAuthoringLibrary(l=>createAuthoringAPI(l,blank),blank);
  const a=new Level(),b=new Level(),context=new LevelContext(a);
  class Component extends Entity {inspect(){return this.context.resources;}}
  const item=new Component(context,'bound',{x:400});assert.equal(item.context,context);assert.equal(item.inspect(),a.scene.resources);
  const image=a.scene.resources.image('crate'),foreign=b.scene.resources.image('crate');
  const view=a.scene.template(image,{width:32,height:32,layer:0}).place('view').label('view').at(0,0).bind(item);
  assert.throws(()=>a.scene.image('foreign',foreign),/同一关卡/);
  assert.throws(()=>view.bind(b.object('elsewhere')),/同一关卡/);
  assert.throws(()=>view.bind(b.scene.actor),/同一关卡/);
  const slot=item.behaviorSlot('depart');slot.actions([item.set(States.Inactive)]);item.on(Events.Click,[slot.invoke()]);
  const feedback=a.scene.feedbackTemplate({motion:'none'});
  const cue=feedback.attach('done',view,{type:'event',source:item,event:Events.Done,behavior:slot});
  assert.deepEqual(cue.trigger,{type:'event',event:'done',source:item.id,behavior:slot.id});
  assert.throws(()=>feedback.attach('foreign-slot',view,{type:'event',source:a.object('different'),event:Events.Done,behavior:slot}),/来源物体/);
  assert.throws(()=>feedback.attach('foreign-source',view,{type:'event',source:b.object('bound'),event:Events.Done,behavior:slot}),/同一关卡/);
  assert.equal(a.data.rules[0].on.source,'bound');assert.equal(a.data.rules[0].on.type,'click');
  assert.equal(a.data.scene.nodes[0].bind.id,'bound');assert.equal(a.data.scene.nodes[0].asset,'crate');
});

test('project outline follows typed objects, behavior implementations and art bindings across renamed files',async()=>{
  const project=levelToProject(createCommuteChapter(),{typescript:true}),service=await typeService();
  const outline=service.outline(project),bus=outline.find(item=>item.id==='bus');
  assert.equal(bus.label,'等着队伍上车的公交');assert.equal(bus.path,'objects/bus.ts');
  const leave=bus.behaviors.find(b=>b.id==='leave');
  assert.ok(project.files[leave.path].slice(leave.start).startsWith('this.doLeave.actions'));
  assert.ok(bus.references.some(ref=>ref.category==='事件'&&ref.path==='events.ts'));
  assert.ok(bus.references.some(ref=>ref.category==='资源'&&ref.path.includes('scene/')));
  const refs=service.analyzeFiles(project),renamed=renameProjectFile(project,'objects/bus.ts','shared/traffic/vehicle.ts',(_,path)=>refs[path]);
  assert.equal(service.outline(renamed).find(item=>item.id==='bus').path,'shared/traffic/vehicle.ts');
});

test('project outline leaves dynamic IDs unresolved and never executes author source',async()=>{
  const service=await typeService(),project={version:1,entry:'dynamic.ts',files:{'dynamic.ts':`
    import { Entity } from '@gothere/core';
    throw new Error('Indexing must not execute this');
    export class Dynamic extends Entity {
      constructor(context: any, id: string) { super(context, id, {label:'自定义对象'}); }
    }
    export class Unrelated { constructor() {} }
  `}};
  const items=service.outline(project);assert.equal(items.length,1);assert.equal(items[0].id,null);
  assert.equal(items[0].className,'Dynamic');assert.equal(items[0].label,'自定义对象');
});
