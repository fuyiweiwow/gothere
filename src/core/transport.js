import { surfaceEndY, surfaceHeight } from './surfaces.js';

/** Shared vertical-travel capability. Legacy ladder records remain supported. */
export function verticalTransport(entity) {
  return entity?.kind==='ladder'?entity:entity?.kind==='object'&&entity.transport?.type==='vertical'?entity.transport:null;
}
export function transportEnabled(entity) {
  return Boolean(verticalTransport(entity))&&(entity.kind==='ladder'?entity.state==='enabled':entity.state==='active');
}
/** A landing may overlap any part of the object's width; its centre need not be supported. */
export function landingX(level, entity, y, preferred=entity.x+(entity.width??28)/2) {
  const overlaps=level.platforms.flatMap(p=>{
    const left=Math.max(p.x,entity.x),right=Math.min(p.x+p.width,entity.x+(entity.width??28));
    if(left>right)return [];
    const start=p.y??440,end=surfaceEndY(p);
    if(Math.abs(end-start)<1e-7)return Math.abs(start-y)<1e-7?[Math.max(left,Math.min(right,preferred))]:[];
    const x=p.x+(y-start)*p.width/(end-start);
    return x>=left-1e-7&&x<=right+1e-7?[Math.max(left,Math.min(right,x))]:[];
  });
  return overlaps.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b)[0]??null;
}

/** Candidate authoring heights at the nearest overlapping point of each road. */
export function landingHeights(level, entity) {
  return level.platforms.filter(p=>p.x<=entity.x+(entity.width??28)&&p.x+p.width>=entity.x)
    .map(p=>surfaceHeight(p,Math.max(p.x,Math.min(p.x+p.width,entity.x+(entity.width??28)/2))));
}
