import {diagramBounds} from '../core/geometry.js';

export const PRESENTATION_SYMBOLS={block:'几何物件',cloud:'云状通路',beam:'横梁 / 天线',umbrella:'伞状物',pot:'落物容器',creature:'生物',support:'支撑物'};
export const PRESENTATION_ANIMATIONS={none:'无循环动画',bob:'轻微浮动',pulse:'呼吸反馈'};

/** Pure visual samples. Simulation ticks freeze animations on pause and make replay repeatable. */
export function presentationFrame(entity,tick=0,animate=true) {
  const active=!['inactive','disabled','stopped','folded','open'].includes(entity.state),animation=entity.presentation?.animation??'none';
  return {active,offsetY:animate&&active&&animation==='bob'?Math.sin(tick/18)*2:0,
    opacity:!active?0.48:animate&&animation==='pulse'?0.86+0.14*Math.cos(tick/15):1};
}

export function presentationBounds(entity) {
  const b=diagramBounds(entity.kind,entity),extra=entity.presentation?.symbol==='umbrella'?22:8;
  return {x:b.x-8,y:b.y-extra,width:b.width+16,height:b.height+extra+8};
}

export function recoveryTicks(entityId,snapshot) {
  const refers=actions=>actions.some(a=>a.target===entityId||(a.type==='after'&&refers(a.actions)));
  const pending=snapshot.timers.filter(t=>t.invocation?.source===entityId||refers(t.actions));
  return pending.length?Math.max(0,Math.min(...pending.map(t=>t.due))-snapshot.tick):null;
}
