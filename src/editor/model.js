import { STATES, validateLevel, floorY } from '../core/schema.js';
import { verticalTransport, landingHeights } from '../core/transport.js';
import { diagramBounds } from '../core/geometry.js';
import { surfaceEndY } from '../core/surfaces.js';
import { posePoint, poseInBounds } from '../core/pose.js';

const clone = (value) => structuredClone(value);
const finiteY = value => value?.y === undefined || Number.isFinite(value.y);
const shape = (level) => Boolean(level && level.schemaVersion === 1 && level.world?.width === 1200 &&
  level.world?.height === 640 && level.world?.groundY === 440 && typeof level.id === 'string' &&
  typeof level.name === 'string' && typeof level.description === 'string' &&
  Number.isFinite(level.actor?.x) && Number.isFinite(level.actor?.speed) && Number.isFinite(level.goal?.x) && finiteY(level.actor) && finiteY(level.goal) &&
  Array.isArray(level.platforms) && level.platforms.length <= 64 && level.platforms.every(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.width) && finiteY(p) && (p.yEnd===undefined||Number.isFinite(p.yEnd))) &&
  Array.isArray(level.entities) && level.entities.length <= 64 && level.entities.every(e =>
    e && typeof e.id === 'string' && Object.hasOwn(STATES, e.kind) && Number.isFinite(e.x) &&
    (e.width === undefined || Number.isFinite(e.width)) && finiteY(e) && typeof e.label === 'string' &&
    (!['ladder','lift'].includes(e.kind) || Number.isFinite(e.toY)) &&
    (e.transport === undefined || Number.isFinite(e.transport?.toY)) &&
    (e.motion === undefined || (Number.isFinite(e.motion?.minX) && Number.isFinite(e.motion?.maxX)))) &&
  Array.isArray(level.rules) && level.rules.length <= 128 &&
  // Geometry can be unfinished; references, states and action trees must remain safe to edit.
  validateLevel({...level, world:{...level.world,...(level.world.physics===undefined&&(level.actor.maxLandingSpeed!==undefined||level.entities.some(e=>e.surface||e.collider||e.body||e.supportProbe||e.carriedPhysics))?{physics:{gravity:900,maxFallSpeed:480}}:{})},
    actor:{...level.actor,x:95,y:440,speed:68}, goal:{x:1100},
    platforms:[{x:0,width:1200},{x:0,width:1200,y:260}],
    entities:level.entities.map(e=>({...e,x:25,width:8,y:440,
      ...(['ladder','lift'].includes(e.kind)?{toY:260}:{}),
      ...(e.transport?{transport:{...e.transport,toY:260}}:{}),
      ...(e.motion?{motion:{...e.motion,minX:25,maxX:100}}:{})}))}).valid);

/** Drafts may be temporarily unplayable. Each slot owns its document and bounded history. */
export function createEditorStore(serialized) {
  const slots = new Map(); let active = null;
  if (serialized !== undefined) {
    if (typeof serialized !== 'string' || serialized.length > 2097152) throw new Error('草稿文件过大。');
    const saved = JSON.parse(serialized);
    if (saved.version !== 1 || !Array.isArray(saved.documents) || saved.documents.length > 32 ||
      !saved.documents.length || typeof saved.activeKey !== 'string') throw new Error('无法识别草稿版本。');
    for (const entry of saved.documents) {
      if (typeof entry.key !== 'string' || slots.has(entry.key) || !shape(entry.level)) throw new Error('草稿结构损坏。');
      slots.set(entry.key, { level:clone(entry.level), past:[], future:[] });
    }
    if (!slots.has(saved.activeKey)) throw new Error('草稿缺少当前关卡。');
    active = saved.activeKey;
  }
  const current = () => { if (!slots.has(active)) throw new Error('请先打开关卡。'); return slots.get(active); };
  return {
    open(key, initial) {
      if (!slots.has(key)) {
        if (slots.size >= 32) throw new Error('草稿已满（32 张）。请先导出备份并清理浏览器草稿。');
        if (!shape(initial)) throw new Error('关卡结构无效。');
        slots.set(key, { level:clone(initial), past:[], future:[] });
      }
      active = key;
    },
    key: () => active,
    document: () => clone(current().level),
    entries: () => [...slots].map(([key, slot]) => ({ key, name:slot.level.name })),
    change(edit) {
      const slot = current(), next = clone(slot.level); edit(next);
      if (JSON.stringify(next) === JSON.stringify(slot.level)) return false;
      if (!shape(next)) throw new Error('修改超出编辑器范围。');
      slot.past.push(slot.level); if (slot.past.length > 100) slot.past.shift();
      slot.level = clone(next); slot.future = []; return true;
    },
    undo() {
      const slot = current(); if (!slot.past.length) return false;
      slot.future.push(slot.level); slot.level = slot.past.pop(); return true;
    },
    redo() {
      const slot = current(); if (!slot.future.length) return false;
      slot.past.push(slot.level); slot.level = slot.future.pop(); return true;
    },
    history: () => ({ undo:current().past.length > 0, redo:current().future.length > 0 }),
    serialize: () => {
      const saved=JSON.stringify({version:1, activeKey:active,
        documents:[...slots].map(([key,slot]) => ({key,level:slot.level}))});
      if(saved.length>2097152)throw new Error('草稿超过 2 MiB，请导出 JSON 备份。');
      return saved;
    },
  };
}

export function createBlankLevel(id) {
  return { schemaVersion:1, id, name:'下一个那里', description:'路已经铺好，接下来给旅途添一点小麻烦。',
    hint:'看看机关之间会发生什么。', world:{width:1200,height:640,groundY:440},
    actor:{x:95,speed:68}, goal:{x:1100}, platforms:[{x:0,width:1200}], entities:[], rules:[] };
}

export const KIND_NAMES = {platform:'路面 / 平台',bridge:'木桥',switch:'开关',hazard:'旧危险物（兼容）',plate:'压力板',gate:'小门',actor:'旅行者',goal:'目的地',
  object:'物件 / 生物',zone:'区域触发器',ladder:'高度通道（旧版）',lift:'电梯'};

export function addObject(level, kind, x, y=440) {
  if (kind === 'platform') {
    if (level.platforms.length >= 64) throw new Error('最多放置 64 段路面。');
    level.platforms.push({x:Math.max(0,Math.min(1000,x)),width:200,...(y!==440?{y}:{})});
    return {type:'platform',index:level.platforms.length-1};
  }
  if (!Object.hasOwn(STATES,kind)) throw new Error('未知机关。');
  if (level.entities.length >= 64) throw new Error('最多放置 64 个机关。');
  let serial=1; while (level.entities.some(e=>e.id===kind+'-'+serial)) serial++;
  const id=kind+'-'+serial, width={bridge:160,switch:28,hazard:58,plate:44,gate:24,object:48,zone:90,ladder:40,lift:60}[kind];
  level.entities.push({id,kind,x:Math.max(25,Math.min(1200-width,x)),width,state:STATES[kind][0],label:KIND_NAMES[kind]+serial,
    ...(y!==440?{y}:{}),...(kind==='object'?{appearance:{skin:'orb'}}:{}),
    ...(['ladder','lift'].includes(kind)?{y:Math.max(200,y),toY:Math.max(160,y-180),speed:90}:{} )});
  return {type:'entity',id};
}

export function deleteObject(level, ref) {
  if (ref?.type==='platform') { level.platforms.splice(ref.index,1); return; }
  if (ref?.type!=='entity') return;
  level.entities = level.entities.filter(e=>e.id!==ref.id);
  pruneReferences(level);
}

/** Clipboard copies object definitions; scene wires are authored separately. */
export function copyObject(level,ref) {
  const value=ref?.type==='entity'?level.entities.find(e=>e.id===ref.id):ref?.type==='platform'?level.platforms[ref.index]:null;
  return value?{type:ref.type,value:clone(value)}:null;
}

export function pasteObject(level,clipboard,offset=20) {
  if(!clipboard||!['entity','platform'].includes(clipboard.type))throw new Error('请先复制一个物体或路面。');
  const source=clone(clipboard.value);
  const ref=addObject(level,clipboard.type==='platform'?'platform':source.kind,source.x,floorY(source));
  if(clipboard.type==='platform')level.platforms[ref.index]=source;
  else{
    const oldId=source.id;source.id=ref.id;source.label=source.label.slice(0,27)+' 副本';
    const rewrite=actions=>{for(const a of actions){if(a.type==='after')rewrite(a.actions);else if(a.target===oldId)a.target=ref.id;}};
    for(const b of source.behaviors??[])rewrite(b.actions);
    level.entities[level.entities.length-1]=source;
  }
  moveObject(level,ref,offset);
  if(!shape(level))throw new Error('无法粘贴：物体引用的目标或行为在当前草稿中已不存在。');
  return ref;
}

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const channelConfig=e=>verticalTransport(e)??(e.kind==='lift'?e:null);

/** Snap authored endpoints to nearby overlapping roads, never invent a landing at runtime. */
export function snapTransport(level, entity, ends=['lower','upper']) {
  const t=channelConfig(entity);if(!t)return;
  const rows=landingHeights(level,entity);
  const nearest=(value,valid)=>rows.filter(y=>Math.abs(y-value)<=24&&valid(y)).sort((a,b)=>Math.abs(a-value)-Math.abs(b-value)||a-b)[0];
  if(ends.includes('lower')){const y=nearest(floorY(entity),y=>y>=t.toY+40);if(y!==undefined)entity.y=y;}
  if(ends.includes('upper')){const y=nearest(t.toY,y=>y<=floorY(entity)-40);if(y!==undefined)t.toY=y;}
}

/** The warehouse preset is an ordinary object with a vertical movement capability. */
export function addHeightTransport(level,x,y=440) {
  const ref=addObject(level,'object',x,Math.max(200,y)),e=level.entities.at(-1);
  delete e.appearance;e.width=60;e.x=clamp(x,25,1140);e.label='高度通道'+e.id.slice(7);
  e.transport={type:'vertical',toY:Math.max(160,floorY(e)-180),speed:90};
  snapTransport(level,e,['lower']);
  const rows=landingHeights(level,e).filter(y=>y<=floorY(e)-40);
  rows.sort((a,b)=>Math.abs(a-e.transport.toY)-Math.abs(b-e.transport.toY));
  if(rows.length)e.transport.toY=rows[0];
  return ref;
}

export function setHeightTransport(level,entity,enabled) {
  if(enabled){
    if(entity.motion)throw new Error('请先关闭左右巡逻，再启用高度移动。');
    if(floorY(entity)<200)throw new Error('下端至少需要 Y=200，才能连接更高的路面。');
    entity.transport={type:'vertical',toY:Math.max(160,floorY(entity)-180),speed:90};snapTransport(level,entity);
  }else{
    if(level.rules.some(r=>r.on.source===entity.id&&r.on.type==='arrive'))throw new Error('请先移除「抵达出口」事件的连线，再关闭高度移动。');
    delete entity.transport;
  }
}

/** Add capabilities without discarding existing rules; disabling execution is a separate action/property. */
export function setPhysicalCapability(level,entity,capability,enabled) {
  if(enabled){
    if(entity.pose||entity.transport)throw new Error('矩形碰撞体暂不与姿态或高度通道组合。');
    if(capability==='body'&&entity.motion)throw new Error('请先关闭巡逻，再启用受重力影响。');
    if(capability==='body'&&entity.supportProbe)throw new Error('请先关闭固定物体的支撑检测，再启用动态重力。');
    entity.collider??={enabled:true};entity.height??=36;
    if(capability==='body')entity.body={type:'dynamic'};
    level.world.physics??={gravity:900,maxFallSpeed:480};
  }else{
    if(capability==='collider'&&entity.body)throw new Error('请先关闭受重力影响，再移除碰撞体。');
    const used=actions=>actions.some(a=>a.type==='after'?used(a.actions):a.type==='enable'&&a.target===entity.id&&a.capability===capability);
    const events=capability==='body'?['supportlost','landed']:['impact'];
    if(level.rules.some(r=>(r.on.source===entity.id&&events.includes(r.on.type))||(capability==='body'&&r.on.other===entity.id)||used(r.actions))||
      level.entities.some(e=>(e.behaviors??[]).some(b=>used(b.actions))))throw new Error('请先移除引用此能力的事件连线及动作，再移除能力。');
    delete entity[capability];
  }
}

export function setSupportProbe(level,entity,enabled) {
  if(enabled){
    if(entity.body)throw new Error('动态物体已自动检测支撑，无需固定物体的支撑检测。');
    entity.supportProbe={at:1};level.world.physics??={gravity:900,maxFallSpeed:480};
  }else{
    if(level.rules.some(r=>r.on.source===entity.id&&['supportlost','supportfound'].includes(r.on.type)))throw new Error('请先移除支撑变化的事件连线，再关闭支撑检测。');
    delete entity.supportProbe;
  }
}

/** Resize from the opposite edge; one call describes an entire drag from its initial geometry. */
export function resizeObject(level,ref,handle,dx,dy) {
  const e=ref.type==='entity'?level.entities.find(e=>e.id===ref.id):ref.type==='platform'?level.platforms[ref.index]:null;
  if(!e)return;
  const road=ref.type==='platform',b=diagramBounds(e.kind??'platform',e),t=channelConfig(e);
  if(e.pose){
    const left=posePoint(e,0),right=posePoint(e,1);
    const point=handle==='w'?left:right;point.x+=dx;point.y+=dy;
    const width=Math.hypot(right.x-left.x,right.y-left.y),angle=Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI;
    const pivot={x:left.x+(right.x-left.x)*e.pose.pivot,y:left.y+(right.y-left.y)*e.pose.pivot};
    const candidate={...e,x:pivot.x-width*e.pose.pivot,y:pivot.y,width,pose:{...e.pose,angle}};
    if(width>=8&&width<=600&&Math.abs(angle)<=75&&candidate.x>=25&&candidate.x<=1175&&candidate.x+width<=1200&&poseInBounds(candidate))Object.assign(e,candidate);
    return;
  }
  const minX=road?0:25,maxWidth=road?1200:Math.min(600,e.motion?1200-e.motion.maxX:600),minWidth=road?1:8;
  if(handle.includes('w')){
    const right=e.x+(e.width??28),left=clamp(e.x+dx,Math.max(minX,right-maxWidth,e.motion?.minX??minX),Math.min(right-minWidth,e.motion?.maxX??(road?1199:1175)));
    e.x=left;e.width=right-left;
  }else if(handle.includes('e'))e.width=clamp((e.width??28)+dx,minWidth,Math.min(maxWidth,1200-e.x));
  if(road&&e.yEnd!==undefined){
    if(handle==='w')e.y=clamp(floorY(e)+dy,160,560);
    if(handle==='e')e.yEnd=clamp(e.yEnd+dy,160,560);
  }
  if(!road){
    if(t){
      if(handle.includes('n'))t.toY=clamp(t.toY+dy,160,floorY(e)-40);
      if(handle.includes('s'))e.y=clamp(floorY(e)+dy,t.toY+40,560);
      snapTransport(level,e,handle.includes('n')?['upper']:handle.includes('s')?['lower']:['lower','upper']);
    }else{
      if(handle.includes('n'))e.height=clamp(b.height-dy,8,240);
      if(handle.includes('s')){const y=clamp(floorY(e)+dy,Math.max(160,b.y+8),Math.min(560,b.y+240));e.y=y;e.height=y-b.y;}
    }
  }
}

/** Move logical geometry; connectors retain their span and patrol paths move with their object. */
export function moveObject(level, ref, dx, dy=0) {
  const target=ref.type==='entity'?level.entities.find(e=>e.id===ref.id):
    ref.type==='platform'?level.platforms[ref.index]:ref.type==='actor'?level.actor:ref.type==='goal'?level.goal:null;
  if(!target)return;
  let min=ref.type==='platform'?0:ref.type==='goal'?40:ref.type==='actor'?20:25;
  let max=ref.type==='actor'?1150:ref.type==='goal'?1180:Math.min(ref.type==='entity'?1175:1199,1200-(target.width??28));
  if(target.motion){min+=target.x-target.motion.minX;max-=target.motion.maxX-target.x;}
  const x=Math.max(min,Math.min(max,target.x+dx)),shift=x-target.x;
  if(target.motion){target.motion.minX+=shift;target.motion.maxX+=shift;}
  target.x=x;
  if(dy){
    const y=floorY(target),t=channelConfig(target),span=t?y-t.toY:0;
    const ends=target.pose?[y,posePoint(target,0).y,posePoint(target,1).y]:[y,surfaceEndY(target)];
    const shift=ref.type==='platform'||target.pose?clamp(dy,160-Math.min(...ends),560-Math.max(...ends)):clamp(dy,160+span-y,560-y);
    target.y=y+shift;
    if(ref.type==='platform'&&target.yEnd!==undefined)target.yEnd+=shift;
    if(t)t.toY+=target.y-y;
  }
}

// Removing the last action can remove a behavior, which can invalidate other calls.
function pruneReferences(level) {
  const byId=new Map(level.entities.map(e=>[e.id,e]));
  let changed;
  do {
    changed=false;
    const clean=actions=>actions.flatMap(a=>{
      if(a.type==='after') {const nested=clean(a.actions);if(nested.length)return [{...a,actions:nested}];}
      else if(!a.target || (byId.has(a.target) && (a.type!=='invoke' || byId.get(a.target).behaviors?.some(b=>b.id===a.behavior))))return [a];
      changed=true;return [];
    });
    for(const e of level.entities)if(e.behaviors)e.behaviors=e.behaviors.flatMap(b=>{
      const actions=clean(b.actions);if(actions.length)return [{...b,actions}];changed=true;return [];
    });
    level.rules=level.rules.flatMap(r=>{
      const source=byId.get(r.on.source);
      if(!source || (r.on.other&&!byId.has(r.on.other)) || (r.on.type==='done' && !source.behaviors?.some(b=>b.id===r.on.behavior)) ||
        (r.if??[]).some(c=>c.entity?!byId.has(c.entity):c.holding!==null&&!byId.has(c.holding)))return [];
      const actions=clean(r.actions);return actions.length?[{...r,actions}]:[];
    });
  }while(changed);
}

export function addBehavior(entity) {
  entity.behaviors??=[];
  if(entity.behaviors.length>=16)throw new Error('每个物体最多定义 16 个行为。');
  let serial=1;while(entity.behaviors.some(b=>b.id==='behavior-'+serial))serial++;
  const behavior={id:'behavior-'+serial,label:'新行为',actions:[entity.kind==='object'?{type:'hold',target:entity.id}:
    {type:'set',target:entity.id,state:STATES[entity.kind].find(s=>s!==entity.state)??entity.state}]};
  entity.behaviors.push(behavior);return behavior;
}

export function renameBehavior(level,entityId,previous,next) {
  level.entities.find(e=>e.id===entityId).behaviors.find(b=>b.id===previous).id=next;
  const visit=actions=>{for(const a of actions){if(a.type==='after')visit(a.actions);else if(a.type==='invoke'&&a.target===entityId&&a.behavior===previous)a.behavior=next;}};
  for(const e of level.entities)for(const b of e.behaviors??[])visit(b.actions);
  for(const r of level.rules){visit(r.actions);if(r.on.type==='done'&&r.on.source===entityId&&r.on.behavior===previous)r.on.behavior=next;}
}

export function deleteBehavior(level,entityId,behaviorId) {
  const e=level.entities.find(e=>e.id===entityId);
  e.behaviors=e.behaviors.filter(b=>b.id!==behaviorId);pruneReferences(level);
}

/** Wires are a projection of rules, never a second source of gameplay data. */
export function ruleWires(level) {
  const result=[];
  const visit=(actions,rule,delay=0,path=[])=>{actions.forEach((a,index)=>{
    const next=[...path,index];
    if(a.type==='after')visit(a.actions,rule,delay+a.ticks,next);
    else result.push({rule,path:next,source:level.rules[rule].on.source,target:a.target??'actor',type:a.type,behavior:a.behavior,delay,points:a.editor?.waypoints??[]});
  });};
  level.rules.forEach((r,index)=>visit(r.actions,index));return result;
}

/** Delete only the selected action branch; keep sibling wires and remove empty delays. */
export function deleteWire(level,wire) {
  const rule=level.rules[wire.rule];if(!rule)return;
  const remove=(actions,depth)=>{
    const index=wire.path[depth];if(!actions[index])return;
    if(depth===wire.path.length-1)actions.splice(index,1);
    else{remove(actions[index].actions,depth+1);if(!actions[index].actions.length)actions.splice(index,1);}
  };
  remove(rule.actions,0);if(!rule.actions.length)level.rules.splice(wire.rule,1);
}
