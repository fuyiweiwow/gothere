import {collectSurfaces,supportAt} from './surfaces.js';
import {posePoint} from './pose.js';

/** A local probe observes actual geometry; it does not impose motion or name a supporting object. */
export function updateSupportProbes(level,entities,held=null,initialize=false) {
  const surfaces=collectSurfaces(level,entities,held),events=[];
  for(const e of Object.values(entities).filter(e=>e.supportProbe)){
    const previous=e.supportState,point=e.pose?posePoint(e,e.supportProbe.at):{x:e.x+(e.width??28)*e.supportProbe.at,y:e.y??440};
    const support=e.id===held?null:supportAt(surfaces.filter(s=>s.id!==e.id),point.x,point.y,previous?.support);
    e.supportState={mode:e.id===held?'held':support?'supported':'unsupported',support:support?.id??null};
    if(initialize||!previous||e.id===held||previous.mode==='held')continue;
    if(previous.mode==='supported'&&!support)events.push({type:'supportlost',source:e.id,other:previous.support});
    if(previous.mode==='unsupported'&&support)events.push({type:'supportfound',source:e.id,other:support.id});
  }
  return events;
}
