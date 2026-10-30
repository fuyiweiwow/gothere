import {eventTypes} from '../core/schema.js';

/** Named completion slots retain their behavior identity when wired. */
export function eventSlots(entity) {
  return eventTypes(entity).flatMap(type=>type==='done'?(entity.behaviors??[]).map(b=>({type,behavior:b.id})):[{type}]);
}

/** All connection gestures create the same ordinary event-to-behavior rule. */
export function connectWire(level,on,target,behavior) {
  const source=level.entities.find(e=>e.id===on.source),destination=level.entities.find(e=>e.id===target);
  if(!source||!eventSlots(source).some(e=>e.type===on.type&&e.behavior===(on.type==='done'?on.behavior:undefined)))throw new Error('事件槽已不存在，请重新选择起点。');
  if(!destination?.behaviors?.some(b=>b.id===behavior))throw new Error('行为槽已不存在，请重新选择目标。');
  const event={source:on.source,type:on.type,...(on.type==='done'?{behavior:on.behavior}:{})};
  if(level.rules.some(r=>r.on.source===event.source&&r.on.type===event.type&&r.on.behavior===event.behavior&&!r.on.other&&!r.if?.length&&r.actions.some(a=>a.type==='invoke'&&a.target===target&&a.behavior===behavior)))return false;
  if(level.rules.length>=128)throw new Error('最多配置 128 条规则。');
  level.rules.push({on:event,actions:[{type:'invoke',target,behavior}]});return true;
}
