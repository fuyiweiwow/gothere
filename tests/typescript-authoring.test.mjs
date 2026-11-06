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
  assert.match(map,/\.layer\(/);assert.match(map,/\.at\(/);assert.match(map,/level\.route/);
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
