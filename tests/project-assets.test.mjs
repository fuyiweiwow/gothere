import test from 'node:test';
import assert from 'node:assert/strict';
import {assetModule,assetKeys,assetId,withProjectAsset,renameProjectAsset,ASSETS_MODULE,ASSETS_INDEX} from '../src/editor/project-assets.js';
import {validateProject,levelToProject,renameProjectFile} from '../src/editor/javascript-project.js';
import {zipProject,unzipProject,analyzeModule} from '../scripts/project-code-tools.mjs';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {executeProject,typeService} from './helpers/project.mjs';
import {zipSync,strToU8,unzipSync} from 'fflate';

const image={label:'bus',width:1,height:1,src:'data:image/png;base64,AAAA',custom:{author:'test'}};
const sound={label:'brake',src:'data:audio/wav;base64,AAAA'};
function sample(){
  let project={version:1,entry:'level.ts',files:{'level.ts':`import { Level } from '@gothere/core';
import { createAssets } from '${ASSETS_MODULE}';
export default function build(){
  const level=new Level();
  const assets=createAssets(level);
  createAssets(level); // Idempotent per level, never duplicates resource arrays.
  level.scene.image('bus-view',assets.images.street.bus).label('bus').at(100,100).size(32,32).order(0);
  return level;
}`}};
  project=withProjectAsset(project,'assets/images/street/bus.png',image);
  return withProjectAsset(project,'assets/sounds/street/brake.wav',sound);
}

test('directory assets expose nested concrete types, completion and definitions in original files',async()=>{
  const project=sample(),service=await typeService();
  assert.deepEqual(service.diagnostics(project),[]);
  const at=project.files['level.ts'].indexOf('street.bus')+'street.'.length;
  assert.ok(service.definitions(project,'level.ts',at).some(d=>d.path==='assets/images/street/bus.png'));
  project.files['level.ts']+='\nfunction probe(){ const a=createAssets(new Level()); a.images.street. }';
  assert.ok(service.completions(project,'level.ts',project.files['level.ts'].lastIndexOf('street.')+7).some(c=>c.label==='bus'));
  project.files['level.ts']=project.files['level.ts'].replace('street.bus','street.missing');
  assert.ok(service.diagnostics(project).some(d=>d.code===2339));
});

test('catalog materialization is deterministic and registers data without instantiating gameplay',async()=>{
  const project=sample(),copy={...project,assets:Object.fromEntries(Object.entries(project.assets).reverse())};
  assert.deepEqual(assetModule(copy),assetModule(project));
  assert.doesNotMatch(assetModule(project).source,/base64/);
  const level=await executeProject(project);
  assert.deepEqual(level.entities,[]);assert.deepEqual(level.rules,[]);
  assert.equal(level.scene.assets.length,1);assert.equal(level.scene.sounds.length,1);
  assert.equal(level.scene.nodes[0].asset,assetId('assets/images/street/bus.png'));
  assert.deepEqual(level.scene.assets[0].custom,image.custom);
});

test('resource path, property conflicts and invalid definitions fail before applying a map',()=>{
  assert.throws(()=>withProjectAsset(sample(),'assets/images/street/bus.jpg',image),/冲突/);
  for(const path of ['../bus.png','assets/images/../bus.png','assets/images/__proto__/bus.png','assets/images/a.b.png','assets/sounds/pic.png','assets/images/bus.svg'])assert.throws(()=>assetKeys(path),/路径|目录|属性名|图片/);
  assert.throws(()=>validateProject({...sample(),files:{[ASSETS_INDEX]:'export {};'},entry:ASSETS_INDEX}),/编辑器维护/);
  assert.throws(()=>withProjectAsset(sample(),'assets/images/street/too-big.png',{...image,width:2049}),/尺寸/);
  assert.throws(()=>withProjectAsset(sample(),'assets/images/street/wrong.jpg',image),/格式/);
  const next=withProjectAsset(sample(),'assets/images/street/bus-stop.png',image);
  assert.throws(()=>withProjectAsset(next,'assets/images/street/busStop.png',image),/冲突/);
  assert.throws(()=>withProjectAsset(sample(),'assets/images/street/Bus.png',image),/大小写冲突/);
});

test('asset rename preserves IDs and safely updates resolved property references across files',async()=>{
  const project=sample(),service=await typeService();
  project.files['level.ts']+='\n// assets.images.street.bus must remain a comment\nconst note="assets.images.street.bus";';
  const renamed=service.renameAsset(project,'assets/images/street/bus.png','assets/images/vehicles/city-bus.png');
  assert.match(renamed.files['level.ts'],/assets.images.vehicles.cityBus/);
  assert.match(renamed.files['level.ts'],/\/\/ assets.images.street.bus/);
  assert.deepEqual(await executeProject(renamed),await executeProject(project));
  const deleted=structuredClone(project);delete deleted.assets['assets/images/street/bus.png'];
  assert.ok(service.diagnostics(deleted).some(d=>d.code===2339));
  const fileRename=renameProjectFile(project,'level.ts','scenes/entry.ts',(_,path)=>service.analyzeFiles(project)[path]);
  assert.match(fileRename.files[fileRename.entry],/@gothere\/assets/);
  assert.throws(()=>renameProjectAsset(project,'assets/images/street/bus.png','assets/sounds/bus.wav'),/互换/);
  const alias=structuredClone(project);alias.files['level.ts']+='\nfunction alias(){ const {bus}=createAssets(new Level()).images.street; return bus; }';
  assert.throws(()=>service.renameAsset(alias,'assets/images/street/bus.png','assets/images/new/bus.png'),/解构|别名/);
});

test('new canvas projects keep old IDs, array order, frame references and unknown metadata',async()=>{
  for(const original of [createFirstLevel(),createCommuteChapter()]){
    const project=levelToProject(original,{typescript:true});
    assert.equal(project.version,2);assert.ok(project.files['resources.ts'].length<180);
    assert.doesNotMatch(Object.values(project.files).join('\n'),/base64,/);
    assert.deepEqual(await executeProject(project),original);
  }
});

test('ZIP preserves raw resource bytes, stable metadata and legacy projects',async()=>{
  const project=sample(),copy=unzipProject(zipProject(project.files,project.entry,project.assets));
  assert.deepEqual(copy.assets,project.assets);assert.deepEqual(copy.files,project.files);
  assert.deepEqual(await executeProject(copy),await executeProject(project));
  const legacy={entry:'legacy.js',files:{'legacy.js':"export default ()=>({answer:42});"}};
  assert.equal(unzipProject(zipProject(legacy.files,legacy.entry)).version,1);
  assert.deepEqual(analyzeModule('export {createAssets} from "@gothere/assets";','resources.js').map(r=>r.specifier),[ASSETS_MODULE]);
});

test('resource ZIP validates metadata, undeclared files and archive path escapes',()=>{
  const project=sample(),original=unzipSync(zipProject(project.files,project.entry,project.assets));
  assert.throws(()=>unzipProject(zipSync({...original,'assets/images/rogue.png':new Uint8Array([1])})),/未登记/);
  const missing={...original};delete missing['assets/images/street/bus.png'];
  assert.throws(()=>unzipProject(zipSync(missing)),/缺少资源/);
  assert.throws(()=>unzipProject(zipSync({'../evil.js':strToU8('export {};')})),/路径/);
  assert.throws(()=>unzipProject(zipSync({'level.js':strToU8('export {};'),'assets/images/bus.png':new Uint8Array([1])})),/元数据/);
});

test('JavaScript-only resource projects compile through the same module graph',async()=>{
  const project=sample(),js={...project,entry:'level.js',files:{'level.js':project.files['level.ts']}};
  assert.deepEqual(await executeProject(js),await executeProject(project));
});
