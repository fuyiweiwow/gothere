import { STATES } from '../core/schema.js';

const clone = (value) => structuredClone(value);
const shape = (level) => level && level.schemaVersion === 1 && level.world?.width === 1200 &&
  level.world?.height === 640 && level.world?.groundY === 440 && typeof level.id === 'string' &&
  typeof level.name === 'string' && typeof level.description === 'string' &&
  Number.isFinite(level.actor?.x) && Number.isFinite(level.actor?.speed) && Number.isFinite(level.goal?.x) &&
  Array.isArray(level.platforms) && level.platforms.length <= 64 && level.platforms.every(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.width)) &&
  Array.isArray(level.entities) && level.entities.length <= 64 && level.entities.every(e =>
    e && typeof e.id === 'string' && Object.hasOwn(STATES, e.kind) && Number.isFinite(e.x) &&
    (e.width === undefined || Number.isFinite(e.width)) && typeof e.label === 'string') &&
  Array.isArray(level.rules) && level.rules.length <= 128 && level.rules.every(r => r?.on && Array.isArray(r.actions));

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
    serialize: () => JSON.stringify({version:1, activeKey:active,
      documents:[...slots].map(([key,slot]) => ({key,level:slot.level}))}),
  };
}

export function createBlankLevel(id) {
  return { schemaVersion:1, id, name:'下一个那里', description:'路已经铺好，接下来给旅途添一点小麻烦。',
    hint:'看看机关之间会发生什么。', world:{width:1200,height:640,groundY:440},
    actor:{x:95,speed:68}, goal:{x:1100}, platforms:[{x:0,width:1200}], entities:[], rules:[] };
}

export const KIND_NAMES = {platform:'地面',bridge:'木桥',switch:'开关',hazard:'风扇',plate:'压力板',gate:'小门',actor:'旅行者',goal:'目的地'};

export function addObject(level, kind, x) {
  if (kind === 'platform') {
    if (level.platforms.length >= 64) throw new Error('最多放置 64 段地面。');
    level.platforms.push({x:Math.max(0,Math.min(1000,x)),width:200});
    return {type:'platform',index:level.platforms.length-1};
  }
  if (!Object.hasOwn(STATES,kind)) throw new Error('未知机关。');
  if (level.entities.length >= 64) throw new Error('最多放置 64 个机关。');
  let serial=1; while (level.entities.some(e=>e.id===kind+'-'+serial)) serial++;
  const id=kind+'-'+serial, width={bridge:160,switch:28,hazard:58,plate:44,gate:24}[kind];
  level.entities.push({id,kind,x:Math.max(25,Math.min(1200-width,x)),width,state:STATES[kind][0],label:KIND_NAMES[kind]+serial});
  return {type:'entity',id};
}

export function deleteObject(level, ref) {
  if (ref?.type==='platform') { level.platforms.splice(ref.index,1); return; }
  if (ref?.type!=='entity') return;
  level.entities = level.entities.filter(e=>e.id!==ref.id);
  const clean = (actions) => actions.flatMap(a => a.type==='set' ? (a.target===ref.id?[]:[a]) :
    a.type==='after' ? ((nested) => nested.length ? [{...a,actions:nested}] : [])(clean(a.actions)) : []);
  level.rules = level.rules.filter(r=>r.on.source!==ref.id && !(r.if??[]).some(c=>c.entity===ref.id))
    .map(r=>({...r,actions:clean(r.actions)})).filter(r=>r.actions.length);
}
