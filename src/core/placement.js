import {projectSpace} from './spatial.js';

/** Gameplay placement uses logical anchors, independent of artwork and zoom. */
export const placementAnchor=(level,e)=>level.spatial?projectSpace(level,{x:e.x,...e.space}):{x:e.x,y:e.y??440};
export const validPlacementPoint=p=>p!==null&&typeof p==='object'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1200&&p.y>=0&&p.y<=640;
export const canDrag=(state,id)=>Boolean(state.entities[id]?.draggable?.enabled&&state.actor.holding!==id&&
  !state.entities[id].translation&&!state.entities[id].rotation);

export function placementReceiver(level,state,id,point){
  if(!validPlacementPoint(point)||!canDrag(state,id))return null;
  const item=state.entities[id];
  return item.draggable.targets.map(target=>state.entities[target]).filter(e=>{
    if(!e?.dropTarget?.enabled||e.x+item.width>1200)return false;
    const p=placementAnchor(level,e);return Math.hypot(p.x-point.x,p.y-point.y)<=e.dropTarget.radius;
  }).sort((a,b)=>{
    const p=placementAnchor(level,a),q=placementAnchor(level,b);
    return Math.hypot(p.x-point.x,p.y-point.y)-Math.hypot(q.x-point.x,q.y-point.y)||(a.id<b.id?-1:a.id>b.id?1:0);
  })[0]??null;
}
