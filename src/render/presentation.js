import {diagramBounds} from '../core/geometry.js';

export const PRESENTATION_SYMBOLS={block:'几何物件',cloud:'云状通路',beam:'横梁 / 天线',umbrella:'伞状物',pot:'落物容器',creature:'生物',support:'支撑物'};
export const PRESENTATION_ANIMATIONS={none:'无循环动画',bob:'轻微浮动',pulse:'呼吸反馈'};

/** Pure visual samples. Simulation ticks freeze animations on pause and make replay repeatable. */
export function presentationFrame(entity,tick=0,animate=true) {
  const active=!['inactive','disabled','stopped','folded','open'].includes(entity.state),animation=entity.presentation?.animation??'none';
  return {active,offsetY:animate&&active&&animation==='bob'?Math.sin(tick/18)*2:0,
    opacity:!active?0.48:animate&&animation==='pulse'?0.86+0.14*Math.cos(tick/15):1};
}

/** Bounds before the common pose transform, used for every programmatic symbol. */
export function presentationGeometry(entity) {
  return diagramBounds(entity.kind,entity.pose?{...entity,pose:{...entity.pose,angle:0}}:entity);
}

export function presentationBounds(entity) {
  const b=presentationGeometry(entity),symbol=entity.presentation?.symbol;
  const extra=symbol==='umbrella'?36:symbol==='pot'?16:8;
  const side=symbol==='umbrella'?Math.max(8,26-b.width/2):symbol==='cloud'?Math.max(8,b.width*5/84+2):8;
  const corners=[{x:b.x-side,y:b.y-extra},{x:b.x+b.width+side,y:b.y-extra},
    {x:b.x+b.width+side,y:b.y+b.height+8},{x:b.x-side,y:b.y+b.height+8}];
  const r=(entity.pose?.angle??0)*Math.PI/180,px=entity.x+(entity.width??28)*(entity.pose?.pivot??0),py=entity.y??440;
  const points=corners.map(p=>({x:px+(p.x-px)*Math.cos(r)-(p.y-py)*Math.sin(r),y:py+(p.x-px)*Math.sin(r)+(p.y-py)*Math.cos(r)}));
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys)-2;
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)+2-y};
}

export function recoveryTicks(entityId,snapshot) {
  const refers=actions=>actions.some(a=>a.target===entityId||(a.type==='after'&&refers(a.actions)));
  const pending=snapshot.timers.filter(t=>t.invocation?.source===entityId||refers(t.actions));
  return pending.length?Math.max(0,Math.min(...pending.map(t=>t.due))-snapshot.tick):null;
}
