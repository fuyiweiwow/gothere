import {validateLevel} from '../core/schema.js';
import {projectSpace} from '../core/spatial.js';
import {artBounds} from '../render/resources.js';
import {deleteObject} from './model.js';
import {pruneFeedback} from '../core/feedback-schema.js';

const clone=v=>structuredClone(v);
const visitActions=(actions,fn)=>{for(const a of actions??[]){fn(a);if(a.type==='after')visitActions(a.actions,fn);}};
const eachAction=(level,fn)=>{for(const e of level.entities)for(const b of e.behaviors??[])visitActions(b.actions,fn);for(const r of level.rules)visitActions(r.actions,fn);};
function assertPortable(entities){
  const planes=new Set(entities.map(e=>e.space?.plane));
  if(entities.length&&(planes.size!==1||planes.has(undefined)||entities.some(e=>!['object','zone'].includes(e.kind)||e.motion||e.body||e.transport||e.passage||e.space.passage||e.supportProbe)))
    throw new Error('首版逻辑模板支持同一行走层的普通物体、区域与行为。');
}
function assertClosed(template){
  const entities=new Set(template.entities.map(e=>e.id)),check=id=>{if(id!==undefined&&id!==null&&!entities.has(id))throw new Error('模板仍引用组合外的逻辑对象：'+id);};
  eachAction(template,a=>{check(a.target);check(a.at);});
  for(const e of template.entities)for(const id of e.draggable?.targets??[])check(id);
  for(const r of template.rules){check(r.on.source);check(r.on.other);for(const c of r.if??[]){check(c.entity);check(c.holding);}}
  for(const n of template.nodes)if(n.bind){if(n.bind.type!=='entity')throw new Error('模板成员只可绑定组合内的逻辑对象。');check(n.bind.id);}
  for(const f of template.feedback)if(['behavior','state','event'].includes(f.trigger.type))check(f.trigger.source);
}

/** Capture authored pieces, never infer collisions or behavior from their pixels. */
export function captureTemplate(level,{id,label,nodes,entities=[],origin}){
  const selected=new Set(nodes),actors=new Set(entities),scene=level.scene;
  if(level.entities.some(e=>!actors.has(e.id)&&e.draggable?.targets.some(id=>actors.has(id))))throw new Error('组合存在外部拖放引用，请先纳入对应物体。');
  const incoming=actions=>{let found=false;visitActions(actions,a=>{if(actors.has(a.target)||actors.has(a.at))found=true;});return found;};
  if(level.rules.some(r=>!actors.has(r.on.source)&&(incoming(r.actions)||actors.has(r.on.other)||(r.if??[]).some(c=>actors.has(c.entity)||actors.has(c.holding))))||
    level.entities.some(e=>!actors.has(e.id)&&(e.behaviors??[]).some(b=>incoming(b.actions))))throw new Error('组合存在外部逻辑引用，请先纳入对应物体或解除引用。');
  const template={format:'gothere-template',version:1,id,label,origin:clone(origin),
    nodes:clone(scene.nodes.filter(n=>selected.has(n.id))),entities:clone(level.entities.filter(e=>actors.has(e.id))),
    rules:clone(level.rules.filter(r=>actors.has(r.on.source))),feedback:clone((scene.feedback??[]).filter(f=>selected.has(f.target))),assets:[],sounds:[]};
  if(!template.nodes.length||template.nodes.length!==selected.size||template.entities.length!==actors.size)throw new Error('模板成员不存在。');
  assertPortable(template.entities);assertClosed(template);
  const art=new Set();for(const n of template.nodes)for(const v of [n,...Object.values(n.variants??{})]){if(v.asset)art.add(v.asset);for(const frame of v.animation?.frames??[])art.add(frame);}
  template.assets=clone((scene.assets??[]).filter(a=>art.has(a.id)));
  template.sounds=clone((scene.sounds??[]).filter(s=>template.feedback.some(f=>f.sound===s.id)));
  return template;
}

function allocator(level){
  const used=new Set([...level.entities,...(level.scene?.nodes??[]),...(level.scene?.compositions??[]),...(level.scene?.feedback??[]),...(level.scene?.assets??[]),...(level.scene?.sounds??[])].map(v=>v.id));
  let serial=0;return prefix=>{let id;do{id=prefix+'-'+(++serial);}while(used.has(id));used.add(id);return id;};
}
function translateActions(level,ids,dx,plane){
  eachAction(level,a=>{
    if(a.type==='move'&&ids.has(a.target)){if(!a.editor?.keepWorldX)a.x+=dx;if(plane){a.depth=plane.depth;if(a.plane!==undefined)a.plane=plane.id;}}
    if(a.editor?.waypoints&&(ids.has(a.target)))a.editor.waypoints=a.editor.waypoints.map(p=>({...p,x:Math.max(0,Math.min(1200,p.x+dx))}));
  });
}
function shiftNode(n,dx,dy,movingEntities){
  if(n.bind&&movingEntities.has(n.bind.id))return;
  if(n.bind||n.ground)throw new Error('组合不支持绑定外部对象或旧空间地贴。');
  if(n.anchor){n.anchor.x+=dx;if(dy)throw new Error('带行走层锚点的布景暂只支持水平整体移动。');return;}
  n.x+=dx;n.y+=dy;
  for(const v of Object.values(n.variants??{})){if(v.x!==undefined)v.x+=dx;if(v.y!==undefined)v.y+=dy;}
}
function checkResult(level){const result=validateLevel(level,{spatialDraft:true});if(!result.valid)throw new Error(result.errors[0]);}

/** Flatten a template to ordinary IDs and DSL. No template execution in the engine. */
export function placeTemplate(level,template,{x=template.origin.x,y=template.origin.y,plane:planeId}={}){
  if(template.format!=='gothere-template'||template.version!==1)throw new Error('模板格式无效。');
  assertPortable(template.entities);assertClosed(template);
  const next=clone(level);next.scene??={background:'#d7d3b5',assets:[],nodes:[]};
  const scene=next.scene,fresh=allocator(next),copy=clone(template),dx=x-template.origin.x;
  const entityMap=new Map(),nodeMap=new Map(),assetMap=new Map(),soundMap=new Map();
  const plane=copy.entities.length?next.spatial?.planes?.find(p=>p.id===(planeId??next.spatial.planes[0]?.id)):null;
  if(copy.entities.length&&(!plane||next.spatial?.mode!=='layered'))throw new Error('逻辑模板需要二维分层场景和行走层。');
  const baseline=plane?projectSpace(next,{x,depth:plane.depth,height:0}).y:y,dy=baseline-template.origin.y;
  for(const [list,map]of [[copy.entities,entityMap],[copy.nodes,nodeMap]])for(const v of list)map.set(v.id,fresh('part'));
  for(const [list,target,prefix,map]of [[copy.assets,scene.assets,'image',assetMap],[copy.sounds,scene.sounds??=[], 'audio',soundMap]])for(const resource of list){
    const existing=target.find(v=>v.id===resource.id&&v.src===resource.src);if(existing)continue;
    const old=resource.id;resource.id=fresh(prefix);map.set(old,resource.id);target.push(resource);
  }
  const remap=id=>entityMap.get(id)??id,remapArt=id=>assetMap.get(id)??id;
  for(const e of copy.entities){e.id=remap(e.id);e.x+=dx;e.space.plane=plane.id;e.space.depth=plane.depth;if(e.draggable)e.draggable.targets=e.draggable.targets.map(remap);}
  eachAction(copy,a=>{if(a.target)a.target=remap(a.target);if(a.at)a.at=remap(a.at);});
  for(const r of copy.rules){r.on.source=remap(r.on.source);if(r.on.other)r.on.other=remap(r.on.other);for(const c of r.if??[]){if(c.entity)c.entity=remap(c.entity);if(c.holding)c.holding=remap(c.holding);}}
  const entityIds=new Set(copy.entities.map(e=>e.id));translateActions(copy,entityIds,dx,plane);
  for(const n of copy.nodes){n.id=nodeMap.get(n.id);if(n.bind)n.bind.id=remap(n.bind.id);shiftNode(n,dx,dy,entityIds);
    for(const v of [n,...Object.values(n.variants??{})]){if(v.asset)v.asset=remapArt(v.asset);if(v.animation)v.animation.frames=v.animation.frames.map(remapArt);}}
  for(const f of copy.feedback){f.id=fresh('cue');f.target=nodeMap.get(f.target);if(['behavior','state','event'].includes(f.trigger.type))f.trigger.source=remap(f.trigger.source);f.sound=soundMap.get(f.sound)??f.sound;}
  next.entities.push(...copy.entities);next.rules.push(...copy.rules);scene.nodes.push(...copy.nodes);(scene.feedback??=[]).push(...copy.feedback);
  const composition={id:fresh('composition'),label:template.label,origin:{x,y:baseline},nodes:copy.nodes.map(n=>n.id),entities:[...entityIds]};
  (scene.compositions??=[]).push(composition);checkResult(next);Object.assign(level,next);return composition.id;
}

export function compositionBounds(level,id){
  const c=level.scene?.compositions?.find(c=>c.id===id);if(!c)return null;
  const boxes=level.scene.nodes.filter(n=>c.nodes.includes(n.id)).map(n=>artBounds(n,level));
  if(!boxes.length)return null;const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}

export function moveComposition(level,id,dx,dy=0){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new Error('组合位移无效。');
  const next=clone(level),c=next.scene?.compositions?.find(c=>c.id===id);if(!c)throw new Error('组合不存在。');
  const entities=next.entities.filter(e=>c.entities.includes(e.id));assertPortable(entities);
  if(entities.length&&dy)throw new Error('逻辑组合沿当前行走层水平移动，部件偏移可展开编辑。');
  const ids=new Set(c.entities);for(const e of entities)e.x+=dx;
  translateActions(next,ids,dx);for(const n of next.scene.nodes.filter(n=>c.nodes.includes(n.id)))shiftNode(n,dx,dy,ids);
  c.origin.x+=dx;c.origin.y+=dy;checkResult(next);Object.assign(level,next);
}

export function copyComposition(level,id,offset=24){
  const c=level.scene?.compositions?.find(c=>c.id===id);if(!c)throw new Error('组合不存在。');
  const t=captureTemplate(level,{...c,id:'copy'});return placeTemplate(level,t,{x:c.origin.x+offset,y:c.origin.y,plane:level.entities.find(e=>c.entities.includes(e.id))?.space.plane});
}
export function detachComposition(level,id){level.scene.compositions=level.scene.compositions.filter(c=>c.id!==id);}
export function removeComposition(level,id){
  const c=level.scene.compositions.find(c=>c.id===id);if(!c)return;
  for(const entity of c.entities)deleteObject(level,{type:'entity',id:entity});
  level.scene.nodes=level.scene.nodes.filter(n=>!c.nodes.includes(n.id));detachComposition(level,id);pruneFeedback(level);
}
