import {projectSpace,isLayered} from '../core/spatial.js';

/** Authoring-only: return ordinary coordinates, with tolerance measured on the projected canvas. */
export function snapSpacePoint(level,point,{threshold=12,disabled=false,exclude,nodes=true,surfaces=true}={}) {
  if(disabled)return point;
  if(isLayered(level)){
    const candidates=nodes?level.spatial.nodes.filter(n=>n.id!==exclude&&n.plane===point.plane):[];
    if(surfaces)for(const p of level.platforms.filter(p=>p.space.plane===point.plane)){
      const x=Math.max(p.x,Math.min(p.x+p.width,point.x)),height=p.space.height+((p.space.heightEnd??p.space.height)-p.space.height)*(x-p.x)/p.width;
      candidates.push({x,depth:p.space.depth,plane:point.plane,height});
    }
    return candidates.map(p=>({p,distance:Math.hypot(p.x-point.x,p.height-point.height)})).filter(p=>p.distance<=threshold).sort((a,b)=>a.distance-b.distance)[0]?.p??point;
  }
  const anchors=nodes?level.spatial.nodes.filter(n=>n.id!==exclude).map(n=>({x:n.x,depth:n.depth,height:n.height})):[];
  if(surfaces)for(const p of level.platforms){const s=p.space;
    for(const [x,height] of [[p.x,s.height],[p.x+p.width,s.heightEnd??s.height]])for(const depth of [s.depth,s.depth+s.depthSize])anchors.push({x,depth,height});
  }
  const projected=projectSpace(level,point);
  const closest=anchors.filter(a=>Math.abs(a.height-point.height)<1e-7).map(a=>{const p=projectSpace(level,a);return {point:a,distance:Math.hypot(p.x-projected.x,p.y-projected.y)};})
    .filter(a=>a.distance<=threshold).sort((a,b)=>a.distance-b.distance)[0];
  return closest?.point??point;
}
