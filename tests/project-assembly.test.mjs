import test from 'node:test';
import assert from 'node:assert/strict';
import {executeProject,typeService} from './helpers/project.mjs';
import {levelToProject,renameProjectFile} from '../src/editor/javascript-project.js';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {zipProject,unzipProject} from '../scripts/project-code-tools.mjs';
import {authoringFileSource} from '../src/editor/authoring-file-templates.js';

function project(){return {version:2,entry:'level.ts',files:{
  'level.ts':`import {Level, LevelContext} from '@gothere/core';
import {createObjects} from '@gothere/objects';
export default function build(){const context=new LevelContext(new Level());createObjects(context);return context.level;}`,
  'objects/obstacles.ts':`import {Entity,instance,Actions,Events,States,type LevelContext} from '@gothere/core';
import type {Objects} from '@gothere/objects';
export class Obstacle extends Entity {
  readonly leave=this.behaviorSlot('leave');
  constructor(context:LevelContext,id:string,x:number){super(context,id,{x});}
  configure(objects:Objects){this.leave.actions([objects.second.set(States.Inactive)]);this.on(Events.Click,[this.leave.invoke()]);}
}
export const first=instance(Obstacle,{args:context=>['first',300],order:0});
export const second=instance(Obstacle,{args:context=>['second',600],order:1});`,
  'shared/library.ts':`import {Entity} from '@gothere/core';export class Unused extends Entity {constructor(c:any){super(c,'unused',{x:900});}}`
},assets:{}};}

test('explicit instance declarations automate construction then binding with exact typed references',async()=>{
  const p=project(),service=await typeService();
  assert.deepEqual(service.diagnostics(p),[]);
  const level=await executeProject(p);assert.deepEqual(level.entities.map(e=>e.id),['first','second']);
  assert.equal(level.entities[0].behaviors[0].actions[0].target,'second');assert.equal(level.rules.length,2);
  const source=p.files['objects/obstacles.ts'],at=source.indexOf('objects.second')+'objects.'.length;
  assert.ok(service.definitions(p,'objects/obstacles.ts',at).some(d=>d.path==='objects/obstacles.ts'));
  p.files['objects/obstacles.ts']=source.replace('objects.second.set','objects.missing.set');
  assert.ok(service.diagnostics(p).some(d=>d.code===2339));
});

test('assembly discovers declarations without running author code and keeps deterministic declared order',async()=>{
  const p=project(),service=await typeService();p.files['unused.ts']="throw new Error('must not execute');export {};";
  const a=service.assembly(p),b=service.assembly({...p,files:Object.fromEntries(Object.entries(p.files).reverse())});
  assert.deepEqual(a,b);assert.ok(a['.gothere/objects.ts'].includes('first'));
  assert.deepEqual((await executeProject(p)).entities.map(e=>e.id),['first','second']);
});

test('definitions are reusable and explicit instances remain independent after rename and ZIP',async()=>{
  const p=project(),service=await typeService();
  const moved=renameProjectFile(p,'objects/obstacles.ts','shared/props/obstacles.ts',(_,path)=>service.analyzeFiles(p)[path]);
  assert.deepEqual(await executeProject(moved),await executeProject(p));
  const copy=unzipProject(zipProject(moved.files,moved.entry,moved.assets));assert.deepEqual(await executeProject(copy),await executeProject(p));
  assert.ok(!Object.keys(copy.files).some(path=>path.startsWith('.gothere/')));
});

test('bad declarations, duplicate instance names and required constructor args report actionable errors',async()=>{
  const p=project(),service=await typeService();
  const duplicate={...p,files:{...p.files,'extra.ts':`import {instance} from '@gothere/core';import {Obstacle} from './objects/obstacles.ts';export const first=instance(Obstacle,{args:c=>['extra',900]});`}};
  assert.throws(()=>service.assembly(duplicate),/first.*重复|重复.*first/);
  const dynamic={...p,files:{...p.files,'objects/obstacles.ts':p.files['objects/obstacles.ts'].replace('order:0','order:Math.random()')}};
  assert.throws(()=>service.assembly(dynamic),/order|顺序/);
  const missing={...p,files:{...p.files,'objects/obstacles.ts':p.files['objects/obstacles.ts'].replace("{args:context=>['first',300],order:0}",'{}')}};
  assert.ok(service.diagnostics(missing).some(d=>d.path==='objects/obstacles.ts'&&d.severity==='error'));
  const wrong={...p,files:{...p.files,'objects/obstacles.ts':p.files['objects/obstacles.ts'].replace("['first',300]","['first','wrong']")}};
  assert.ok(service.diagnostics(wrong).some(d=>d.path==='objects/obstacles.ts'&&d.severity==='error'));
  const computed={...p,files:{...p.files,'objects/obstacles.ts':p.files['objects/obstacles.ts'].replace('order:0',"['order']:0")}};
  assert.throws(()=>service.assembly(computed),/计算属性/);
});

test('canvas exports preserve every entity, rule and visual order while removing repetitive assembly',async()=>{
  for(const level of [createFirstLevel(),createCommuteChapter()]){
    const p=levelToProject(level,{typescript:true});
    assert.ok(p.files['objects/index.ts'].length<250);assert.doesNotMatch(p.files['objects/index.ts'],/new |\.configure\(/);
    assert.ok((p.files['scene/visuals.ts'].match(/^import /gm)??[]).length<=4);
    assert.deepEqual(await executeProject(p),level);
  }
});

test('adding and removing an explicit contribution updates the typed catalog without an index edit',async()=>{
  const p=project(),service=await typeService();
  p.files['extra.ts']="import {instance as selected} from '@gothere/core';import {Obstacle} from './objects/obstacles.ts';export const third=selected(Obstacle,{args:c=>['third',900],order:2});";
  assert.deepEqual((await executeProject(p)).entities.map(e=>e.id),['first','second','third']);
  p.files['level.ts']+='\nfunction probe(){ const context=new LevelContext(new Level()); createObjects(context). }';
  const position=p.files['level.ts'].lastIndexOf(').')+2;
  assert.ok(service.completions(p,'level.ts',position).some(c=>c.label==='third'));
  p.files['level.ts']=p.files['level.ts'].slice(0,p.files['level.ts'].indexOf('\nfunction probe'));
  p.files['extra.ts']=p.files['extra.ts'].replace('export const third','const third');
  assert.deepEqual((await executeProject(p)).entities.map(e=>e.id),['first','second']);
});

test('namespace marker imports and JavaScript-only projects use the same assembly',async()=>{
  const p=project();
  p.files['extra.js']="import * as core from '@gothere/core';export class Extra extends core.Entity {constructor(c){super(c,'third',{x:900});}} export const third=core.instance(Extra);";
  assert.equal((await executeProject(p)).entities.length,3);
  const js={version:2,assets:{},entry:'level.js',files:{'level.js':"import {Level,LevelContext} from '@gothere/core';import {createObjects} from '@gothere/objects';export default ()=>{const c=new LevelContext(new Level());createObjects(c);return c.level;};",'extra.js':p.files['extra.js']}};
  assert.deepEqual((await executeProject(js)).entities.map(e=>e.id),['third']);
});

test('new scene groups append artwork while retaining existing order and reject duplicate exported views',async()=>{
  const p=levelToProject(createCommuteChapter(),{typescript:true}),original=await executeProject(p);
  p.files['scene/extra.ts']=`import {sceneGroup} from '@gothere/core';import type {ProjectContext} from '../context.ts';
export const newDecor=sceneGroup((context:ProjectContext)=>({extra:context.scene.image('extra-picture',context.assets.images.builtin.blockStreets).label('Extra').at(0,0).size(40,40).order(0)}),{order:100});`;
  const result=await executeProject(p);
  assert.deepEqual(result.scene.nodes.slice(0,-1),original.scene.nodes);assert.equal(result.scene.nodes.at(-1).id,'extra-picture');
  p.files['scene/other.ts']=p.files['scene/extra.ts'].replace('newDecor','otherDecor').replace('extra-picture','other-picture');
  await assert.rejects(()=>executeProject(p),/重复.*extra/);
});

test('new file templates compile and contribute without editing assembly lists',async()=>{
  const p=levelToProject(createCommuteChapter(),{typescript:true}),service=await typeService();
  p.files['custom/toy.ts']=authoringFileSource(p,'custom/toy.ts','instance');
  p.files['scene/decor.ts']=authoringFileSource(p,'scene/decor.ts','group');
  assert.deepEqual(service.diagnostics(p),[]);
  assert.ok((await executeProject(p)).entities.some(e=>e.id==='item-toy'));
  assert.doesNotMatch(authoringFileSource(p,'tools/helper.ts'),/instance\(/);
});

test('asynchronous configure cannot silently produce an incomplete generated level',async()=>{
  const p=project();p.files['objects/obstacles.ts']=p.files['objects/obstacles.ts'].replace('configure(objects:Objects)','async configure(objects:Objects)');
  await assert.rejects(()=>executeProject(p),/configure.*同步/);
});
