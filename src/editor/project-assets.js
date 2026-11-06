import {ASSET_IDS} from '../content/asset-ids.js';
import {validateScene} from '../core/scene-schema.js';

export const ASSETS_MODULE = '@gothere/assets';
export const ASSETS_INDEX = '.gothere/assets.ts';
export const ASSETS_MANIFEST = '.gothere/project.json';
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const literal = value => JSON.stringify(value).replace(/"__proto__":/g,'["__proto__"]:');

export function assetPath(path) {
  if(typeof path!=='string'||path.length>180||/[\\\x00-\x1f:#?@<>"|*]/.test(path))throw new Error('资源需要项目内的 assets/images 或 assets/sounds 路径。');
  const parts=path.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'))throw new Error('资源路径不能越出项目或包含空段。');
  const valid=parts[0]==='assets'&&parts.length>=3&&(parts[1]==='images'?/\.(png|jpe?g|webp)$/i:parts[1]==='sounds'?/\.(wav|mp3|ogg)$/i:null)?.test(path);
  if(!valid)throw new Error('图片放在 assets/images/**，声音放在 assets/sounds/**；支持 PNG/JPEG/WebP/WAV/MP3/OGG。');
  return path;
}

export function assetKeys(path) {
  assetPath(path);
  return path.replace(/\.[^.]+$/,'').split('/').slice(1).map(part=>{
    const key=part.normalize('NFC').replace(/[-\s]+(.)/gu,(_,c)=>c.toUpperCase());
    if(!/^[\p{ID_Start}_$][\p{ID_Continue}$]*$/u.test(key)||['__proto__','constructor','prototype'].includes(key))throw new Error('目录或文件名需要能转换为属性名：'+part);
    return key;
  });
}

export function assetId(path) {
  let hash=2166136261;
  for(const c of new TextEncoder().encode(path))hash=Math.imul(hash^c,16777619)>>>0;
  return (path.startsWith('assets/images/')?'image-':'sound-')+hash.toString(36);
}

export function assetEntries(project) {
  return Object.entries(project.assets??{}).sort(([a],[b])=>compare(a,b)).map(([path,asset])=>({...asset,path,keys:assetKeys(path)}));
}

/** Directory order is deterministic; explicit ordinals preserve imported DSL array order. */
export function validateProjectAssets(project) {
  if(project.assets===undefined)return project;
  if(project.version!==2||!project.assets||typeof project.assets!=='object'||Array.isArray(project.assets))throw new Error('目录资源需要版本2的作者项目。');
  const entries=assetEntries(project),paths=new Set(),filenames=new Set(),ids=new Set(),images=[],sounds=[];
  if(entries.length>256)throw new Error('项目目录最多256个资源。');
  for(const entry of entries){
    const key=entry.keys.join('.');
    const filename=entry.path.normalize('NFC').toLowerCase();
    if(filenames.has(filename))throw new Error('资源路径大小写冲突：'+entry.path);
    filenames.add(filename);
    if(paths.has(key)||[...paths].some(p=>p.startsWith(key+'.')||key.startsWith(p+'.')))throw new Error('资源属性名冲突：'+entry.path);
    paths.add(key);
  }
  for(const entry of entries){
    const identity=entry.keys[0]+':'+entry.id;
    if(typeof entry.id!=='string'||(!entry.builtin&&!/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(entry.id))||ids.has(identity))throw new Error('资源标识无效或重复：'+entry.path);
    ids.add(identity);
    if(entry.order!==undefined&&(!Number.isSafeInteger(entry.order)||entry.order<0))throw new Error('资源顺序无效：'+entry.path);
    if(entry.builtin!==undefined&&entry.builtin!==true)throw new Error('内置资源标记无效：'+entry.path);
    if(entry.builtin){
      if(entry.keys[0]!=='images'||!ASSET_IDS.includes(entry.id)||entry.definition!==undefined)throw new Error('内置资源无效：'+entry.path);
    }else{
      const d=entry.definition;
      if(!d||typeof d!=='object'||Array.isArray(d)||Object.hasOwn(d,'id'))throw new Error('缺少资源定义：'+entry.path);
      const ext=entry.path.split('.').at(-1).toLowerCase(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',wav:'audio/(?:wav|x-wav|wave)',mp3:'audio/(?:mp3|mpeg)',ogg:'audio/ogg'}[ext];
      if(typeof d.src!=='string'||!new RegExp('^data:'+mime+';base64,[A-Za-z0-9+/]+={0,2}$').test(d.src)||d.src.length>350000)throw new Error('资源格式或大小无效：'+entry.path);
      (entry.keys[0]==='images'?images:sounds).push({id:entry.id,...d});
    }
  }
  const errors=validateScene({scene:{background:'#ffffff',assets:images,sounds,nodes:[]}});
  if(errors.length)throw new Error(errors.join('\n'));
  return project;
}

export function withProjectAsset(project,path,definition) {
  const keys=assetKeys(path);
  if(Object.hasOwn(project.assets??{},path))throw new Error('资源文件已存在：'+path);
  const entries=assetEntries(project);
  const order=Math.max(-1,...entries.filter(e=>e.keys[0]===keys[0]).map(e=>e.order??-1))+1;
  const next={...project,version:2,assets:{...project.assets,[path]:{id:assetId(path),order,definition:structuredClone(definition)}}};
  return validateProjectAssets(next);
}

export function renameProjectAsset(project,from,to) {
  if(!Object.hasOwn(project.assets??{},from))throw new Error('找不到资源：'+from);
  if(Object.hasOwn(project.assets,to))throw new Error('资源文件已存在：'+to);
  if(assetKeys(from)[0]!==assetKeys(to)[0])throw new Error('图片和声音不能互换目录。');
  const assets=Object.fromEntries(Object.entries(project.assets).map(([path,value])=>[path===from?to:path,value]));
  return validateProjectAssets({...project,assets,active:to});
}

/** The declaration contains no bytes. Its leaf positions map F12 back to original files. */
export function assetModule(project,{runtime=false}={}) {
  validateProjectAssets(project);
  const entries=assetEntries(project),tree=new Map([['images',new Map()],['sounds',new Map()]]),positions=[];
  entries.forEach((entry,index)=>{
    let branch=tree;for(const key of entry.keys.slice(0,-1)){if(!branch.has(key))branch.set(key,new Map());branch=branch.get(key);}
    branch.set(entry.keys.at(-1),{entry,index});
  });
  let source=runtime?'':"import type { Level, ImageAsset, SoundAsset } from '@gothere/core';\n\n// 自动目录索引 · 从引用转到定义可查看资源原文件。\nexport declare function createAssets(level: Level): ";
  function emit(branch,indent=0){
    source+='{\n';
    for(const [key,value]of branch){
      source+=' '.repeat(indent+2)+(runtime?'':'readonly ');
      const start=source.length;source+=key;
      if(value.entry)positions.push({path:value.entry.path,start,length:key.length});
      source+=': ';
      if(value.entry)source+=runtime?'r'+value.index:value.entry.keys[0]==='images'?'ImageAsset':'SoundAsset';
      else emit(value,indent+2);
      source+=runtime?',\n':';\n';
    }
    source+=' '.repeat(indent)+'}';
  }
  if(runtime){
    source+='const cache = new WeakMap();\nexport function createAssets(level) {\n  if (cache.has(level)) return cache.get(level);\n';
    const ordered=[...entries].sort((a,b)=>compare(a.keys[0],b.keys[0])||(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER)||compare(a.path,b.path));
    for(const e of ordered){const index=entries.indexOf(e);source+=`  const r${index} = level.scene.resources.${e.keys[0]==='images'?'image':'sound'}(${literal(e.id)}${e.definition?', '+literal(e.definition):''});\n`;}
    source+='  const assets = ';
  }
  emit(tree);
  source+=runtime?';\n  cache.set(level, assets);\n  return assets;\n}\n':';\n';
  return {source,positions};
}

export function materializeProjectAssets(project) {
  if(project.version!==2)return project;
  return {...project,files:{...project.files,[ASSETS_INDEX]:assetModule(project,{runtime:true}).source}};
}

/** Existing IDs, metadata and custom resource order survive canvas -> source exactly. */
export function sceneDirectoryAssets(scene,imageIds) {
  const assets={},references=new Map(),soundReferences=new Map();
  function add(kind,id,definition,order){
    const mime=definition?.src?.match(/^data:[^/]+\/([^;]+)/)?.[1];
    const extension=kind==='images'?mime==='jpeg'?'jpg':mime??'png':mime==='mpeg'||mime==='mp3'?'mp3':mime==='ogg'?'ogg':'wav';
    const filename=id.replace(/[^a-zA-Z0-9-]/g,'-');
    let path=`assets/${kind}/${definition?'imported':'builtin'}/${filename}.${extension}`;
    // Keep exports usable on case-insensitive filesystems and resolve property collisions.
    for(let n=2;Object.keys(assets).some(p=>p.toLowerCase()===path.toLowerCase()||assetKeys(p).join('.')===assetKeys(path).join('.'));n++)path=`assets/${kind}/${definition?'imported':'builtin'}/${filename}-${n}.${extension}`;
    assets[path]={id,...(definition?{definition:structuredClone(definition),order}:{builtin:true})};
    // Compute collisions from the paths; no generated metadata leaks into runtime definitions.
    (kind==='images'?references:soundReferences).set(id,assetKeys(path).join('.'));
  }
  for(const [order,{id,...definition}]of (scene?.assets??[]).entries())add('images',id,definition,order);
  for(const id of imageIds)if(!references.has(id))add('images',id);
  for(const [order,{id,...definition}]of (scene?.sounds??[]).entries())add('sounds',id,definition,order);
  return {assets,references,soundReferences};
}
