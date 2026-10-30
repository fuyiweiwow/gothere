import {collectSurfaces, surfaceHeight, surfaceEndY} from '../core/surfaces.js';
import {footprintHeight} from '../core/bodies.js';
import {posePoint, posedSurface} from '../core/pose.js';
import {verticalTransport} from '../core/transport.js';
import {moveObject, resizeObject} from './model.js';

const EPSILON=1e-7;
const resolve=(level,ref)=>ref.type==='entity'?level.entities.find(e=>e.id===ref.id):ref.type==='platform'?level.platforms[ref.index]:level[ref.type];
const ends=surface=>[{x:surface.x,y:surface.y??440},{x:surface.x+surface.width,y:surfaceEndY(surface)}];

/** Author exact logical coordinates; the simulation's support tolerance stays unchanged. */
export function snapToSurface(level,ref,{threshold=12,disabled=false,handle}={}) {
  if(disabled||threshold<0)return [];
  const object=resolve(level,ref);
  if(!object||verticalTransport(object)||object.kind==='lift')return [];
  const entities=level.entities.map(e=>({...e,...(e.kind==='lift'?{carY:e.state==='upper'?e.toY:e.y??440}:{})}));
  const surfaces=collectSurfaces(level,entities).filter(s=>s.id!==(ref.type==='platform'?'platform:'+ref.index:object.id));
  const segment=ref.type==='platform'?object:object.surface&&!object.supportProbe?posedSurface(object):null;
  const candidates=[];
  if(segment){
    const source=ends(segment);
    for(const [index,point] of source.entries()){
      if(handle&&handle!==(index===0?'w':'e'))continue;
      for(const surface of surfaces)for(const target of ends(surface)){
        const dx=target.x-point.x,dy=target.y-point.y,distance=Math.hypot(dx,dy);
        if(distance<=threshold)candidates.push({surface,dx,dy,distance,index});
      }
    }
  }else{
    // Top-only resizing leaves the foot fixed. Point probes use the same anchor as runtime.
    if(handle&&!handle.includes('s'))return [];
    const point=['actor','goal'].includes(ref.type)?{x:object.x,y:object.y??440}:object.supportProbe?
      object.pose?posePoint(object,object.supportProbe.at):{x:object.x+(object.width??28)*object.supportProbe.at,y:object.y??440}:null;
    for(const surface of surfaces){
      const height=point?surfaceHeight(surface,point.x):footprintHeight(surface,object);
      if(height===null)continue;
      const dy=height-(point?.y??object.y??440),distance=Math.abs(dy);
      if(distance<=threshold)candidates.push({surface,dx:0,dy,distance});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  for(const candidate of candidates){
    // Try on a small draft so a world-bound clamp cannot leave a misleading partial snap.
    const copy=structuredClone(object),draft={...level,world:{...level.world},entities:[...level.entities],platforms:[...level.platforms]};
    if(ref.type==='entity')draft.entities[level.entities.indexOf(object)]=copy;
    else if(ref.type==='platform')draft.platforms[ref.index]=copy;
    else draft[ref.type]=copy;
    if(handle)resizeObject(draft,ref,handle,candidate.dx,candidate.dy,{snap:false});
    else moveObject(draft,ref,candidate.dx,candidate.dy);
    const actualSegment=ref.type==='platform'?copy:segment?posedSurface(copy):null;
    const beforePoint=segment?ends(segment)[candidate.index]:null,afterPoint=actualSegment?ends(actualSegment)[candidate.index]:null;
    if(segment?(Math.abs(afterPoint.x-beforePoint.x-candidate.dx)>EPSILON||Math.abs(afterPoint.y-beforePoint.y-candidate.dy)>EPSILON):Math.abs((copy.y??440)-(object.y??440)-candidate.dy)>EPSILON)continue;
    Object.assign(object,copy);
    if(draft.world.physics&&!level.world.physics)level.world.physics=draft.world.physics;
    return [{kind:'surface',x:candidate.surface.x,y:candidate.surface.y??440,width:candidate.surface.width,yEnd:surfaceEndY(candidate.surface)}];
  }
  return [];
}
