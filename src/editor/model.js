import { STATES, validateLevel } from '../core/schema.js';

const clone = (value) => structuredClone(value);
const finiteY = value => value?.y === undefined || Number.isFinite(value.y);
const shape = (level) => Boolean(level && level.schemaVersion === 1 && level.world?.width === 1200 &&
  level.world?.height === 640 && level.world?.groundY === 440 && typeof level.id === 'string' &&
  typeof level.name === 'string' && typeof level.description === 'string' &&
  Number.isFinite(level.actor?.x) && Number.isFinite(level.actor?.speed) && Number.isFinite(level.goal?.x) && finiteY(level.actor) && finiteY(level.goal) &&
  Array.isArray(level.platforms) && level.platforms.length <= 64 && level.platforms.every(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.width) && finiteY(p)) &&
  Array.isArray(level.entities) && level.entities.length <= 64 && level.entities.every(e =>
    e && typeof e.id === 'string' && Object.hasOwn(STATES, e.kind) && Number.isFinite(e.x) &&
    (e.width === undefined || Number.isFinite(e.width)) && finiteY(e) && typeof e.label === 'string' &&
    (!['ladder','lift'].includes(e.kind) || Number.isFinite(e.toY)) &&
    (e.motion === undefined || (Number.isFinite(e.motion?.minX) && Number.isFinite(e.motion?.maxX)))) &&
  Array.isArray(level.rules) && level.rules.length <= 128 &&
  // Geometry can be unfinished; references, states and action trees must remain safe to edit.
  validateLevel({...level, actor:{...level.actor,x:95,y:440,speed:68}, goal:{x:1100},
    platforms:[{x:0,width:1200},{x:0,width:1200,y:260}],
    entities:level.entities.map(e=>({...e,x:25,width:8,y:440,
      ...(['ladder','lift'].includes(e.kind)?{toY:260}:{}),
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

export const KIND_NAMES = {platform:'地面',bridge:'木桥',switch:'开关',hazard:'旧危险物（兼容）',plate:'压力板',gate:'小门',actor:'旅行者',goal:'目的地',
  object:'物件 / 生物',zone:'区域触发器',ladder:'梯子',lift:'电梯'};

export function addObject(level, kind, x, y=440) {
  if (kind === 'platform') {
    if (level.platforms.length >= 64) throw new Error('最多放置 64 段地面。');
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
      if(!source || (r.on.type==='done' && !source.behaviors?.some(b=>b.id===r.on.behavior)) ||
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
