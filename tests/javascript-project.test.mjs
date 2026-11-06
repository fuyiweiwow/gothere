import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoringAPI} from '../src/editor/authoring-api.js';
import {createAuthoringLibrary} from '../src/editor/authoring-library.js';
import {createBlankLevel} from '../src/editor/model.js';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createSpatialLevel} from '../src/editor/spatial-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {levelToJavaScript} from '../src/editor/javascript-source.js';
import {levelToProject,legacyToProject,createProjectExample,validateProject,projectModuleGraph,renameProjectFile,resolveProjectImport} from '../src/editor/javascript-project.js';
import {analyzeModule,isModule,zipProject,unzipProject} from '../scripts/project-code-tools.mjs';
import {createSimulation,validateLevel,replayRecording} from '../src/core/engine.js';
import {executeProject} from './helpers/project.mjs';

test('modular class projects exactly roundtrip every supported schema and its artwork',async()=>{
  for(const original of [createFirstLevel(),createSpatialLevel(),createCommuteChapter()]){
    const project=levelToProject(original),copy=await executeProject(project);
    assert.ok(project.files['level.js'].length<650,'entry only orchestrates');
    assert.match(project.files['objects/index.js'],/new [A-Z][\w]*\(level\)/);
    assert.deepEqual(copy,original);assert.equal(validateLevel(copy).valid,true);
    const simulation=createSimulation(copy).start();simulation.step(100);
    assert.deepEqual(replayRecording(copy,simulation.recording()).snapshot(),simulation.snapshot());
  }
});

test('native imports support reusable classes, aliases, namespaces and reexports',async()=>{
  const project=createProjectExample();
  project.files['shared/index.js']="export { DepartingObject as Cart } from '../objects/departing-object.js';";
  project.files['level.js']=`import * as core from '@gothere/core';
import { Cart as Obstacle } from './shared/index.js';
export default function build() {
  const level = new core.Level();
  for (let i = 0; i < 2; i++) new Obstacle(level, 'cart-' + i, { x: 400 + i * 200 });
  return level;
}`;
  const level=await executeProject(project);assert.equal(validateLevel(level).valid,true);assert.equal(level.entities.length,2);assert.equal(level.rules.length,2);
  const game=createSimulation(level).start();game.click('cart-0');game.click('cart-1');game.step(1200);assert.equal(game.snapshot().status,'won');
  const unattended=createSimulation(level).start();unattended.step(1200);assert.equal(unattended.snapshot().status,'lost');
});

test('Level and Entity register plain data; generic action methods remain deterministic',()=>{
  const blank=createBlankLevel('oop',{layered:true}),createAPI=level=>createAuthoringAPI(level,blank);
  const {Level,Entity,Actions}=createAuthoringLibrary(createAPI,blank);
  class SlidingObject extends Entity { leave(){return this.move({x:1300,seconds:1.5});} }
  const level=new Level(),item=level.object('box',{x:400},SlidingObject);
  assert.ok(item instanceof SlidingObject);assert.equal(level.entity('box').id,'box');
  assert.equal(item.behavior('leave',[Actions.after(.2,[item.leave()]),Actions.set(item,'inactive')]).on('click',[Actions.invoke(item,'leave')]),item);
  const data=JSON.parse(JSON.stringify(level));assert.equal(data.entities[0].behaviors[0].actions[0].ticks,12);assert.equal(data.rules[0].on.source,'box');
  assert.equal(validateLevel(data).valid,true);assert.equal(typeof data.entities[0].move,'undefined');assert.deepEqual(blank.entities,[]);
  assert.throws(()=>level.entity('missing'),/找不到物体/);assert.throws(()=>Actions.after(NaN,[]),/时长/);
});

test('old generated scripts migrate to modules and handwritten scripts retain loops and functions',async()=>{
  const base=createCommuteChapter();assert.ok(Object.keys(legacyToProject(levelToJavaScript(base),base).files).length>5);
  const source='function createLevel(level) { function speed(x) { return x + 3; } for (const e of level.entities) e.label += "!"; level.actor.speed = speed(level.actor.speed); return level; }';
  const result=await executeProject(legacyToProject(source,base));assert.equal(result.actor.speed,base.actor.speed+3);assert.equal(result.entities[0].label,base.entities[0].label+'!');
  const body=await executeProject(legacyToProject('level.actor.speed += 1; return level;',base));assert.equal(body.actor.speed,base.actor.speed+1);
  assert.equal(isModule(source),false);assert.equal(isModule('return level;'),false);assert.equal(isModule("export default function() {}"),true);
});

test('imports in strings, regexes and comments are not treated as dependencies',()=>{
  const code=`// import './missing.js';\nconst note = "import './fake.js'";\nconst re = /import x from 'x'/;\nexport { Entity } from '@gothere/core';`;
  assert.deepEqual(analyzeModule(code,'sample.js').map(r=>r.specifier),['@gothere/core']);
  assert.throws(()=>analyzeModule('export const = 1;','bad.js'),/bad.js:1:/);
});

test('invalid graphs report missing modules, escapes, external imports and cycles before execution',()=>{
  const project=createProjectExample();project.files['level.js']="import './missing.js'; export default function() {}";
  assert.throws(()=>projectModuleGraph(project,analyzeModule),/missing.js/);
  for(const specifier of ['https://example.com/mod.js','other-package','../../escape.js'])assert.throws(()=>resolveProjectImport('level.js',specifier),/支持|越出/);
  project.files['level.js']="import './loop.js';";project.files['loop.js']="import './level.js';";
  assert.throws(()=>projectModuleGraph(project,analyzeModule),/循环 import/);
  project.files['level.js']="export default function() { return import('./loop.js'); }";assert.throws(()=>projectModuleGraph(project,analyzeModule),/动态/);
  for(const path of ['../outside.js','/root.js','bad\\path.js','bad\n.js','@gothere/core.js'])assert.throws(()=>validateProject({...project,entry:path,files:{[path]:''}}),/路径|文件名/);
  assert.throws(()=>validateProject({...project,files:{'level.js':' '.repeat(2097153)}}),/2 MiB/);
});

test('renaming across folders updates imports, reexports, entry and imports within the moved file',async()=>{
  const original=createProjectExample();original.files['objects/departing-object.js']="import { Entity, Actions } from '@gothere/core';\nimport { distance } from '../distance.js';\n"+original.files['objects/departing-object.js'].split('\n').slice(1).join('\n');
  original.files['distance.js']='export const distance = 1350;';
  const renamed=renameProjectFile(original,'objects/departing-object.js','shared/props/cart.js',analyzeModule);
  assert.match(renamed.files['level.js'],/shared\/props\/cart.js/);assert.match(renamed.files['shared/props/cart.js'],/\.\.\/\.\.\/distance.js/);
  assert.ok(original.files['objects/departing-object.js']);assert.equal(validateLevel(await executeProject(renamed)).valid,true);
  const entry=renameProjectFile(renamed,'level.js','entry/start.js',analyzeModule);assert.equal(entry.entry,'entry/start.js');assert.match(entry.files[entry.entry],/\.\.\/shared\/props\/cart.js/);
  assert.equal(validateLevel(await executeProject(entry)).valid,true);
});

test('ZIP preserves source files and selected entry without a JSON author-facing manifest',async()=>{
  const project=createProjectExample(),renamed=renameProjectFile(project,'level.js','entry.js',analyzeModule);
  const imported=validateProject(unzipProject(zipProject(renamed.files,renamed.entry)));
  assert.deepEqual(imported.files,renamed.files);assert.equal(imported.entry,'entry.js');assert.equal(validateLevel(await executeProject(imported)).valid,true);
  assert.throws(()=>unzipProject(new Uint8Array([0,1,2,3])));
});

test('prototype-shaped fields and colliding sanitized object ids are preserved in generated modules',async()=>{
  const level=createBlankLevel('special',{layered:true}),api=createAuthoringAPI(level,level);
  api.object('物体一');api.object('物体二');api.object('index');
  Object.defineProperty(level,'__proto__',{value:{test:true},enumerable:true,configurable:true});
  const project=levelToProject(level);assert.equal(Object.keys(project.files).filter(p=>p.startsWith('objects/')).length,4);
  assert.deepEqual(await executeProject(project),level);
});
