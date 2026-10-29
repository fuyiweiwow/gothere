import { collectSurfaces, surfaceHeight } from './surfaces.js';

const EPSILON=1e-7,STEP=1/60;

/** Upright boxes are supported by the highest point within their horizontal footprint. */
export function footprintHeight(surface,entity) {
  const left=Math.max(surface.x,entity.x),right=Math.min(surface.x+surface.width,entity.x+(entity.width??28));
  if(right-left<=EPSILON)return null;
  return Math.min(surfaceHeight(surface,left),surfaceHeight(surface,right));
}

function supportFor(surfaces,entity,preferred) {
  const matches=surfaces.filter(s=>s.id!==entity.id&&Math.abs((footprintHeight(s,entity)??Infinity)-entity.y)<EPSILON);
  return matches.find(s=>s.id===preferred)??matches[0]??null;
}

export function initializeBodies(level,entities) {
  const surfaces=collectSurfaces(level,entities);
  for(const e of Object.values(entities).filter(e=>e.body)){
    const support=e.collider.enabled?supportFor(surfaces,e):null;
    e.bodyState={mode:support?'supported':'falling',vy:0,support:support?.id??null};
  }
}

/** Bottom-to-top support resolution makes stacks independent of declaration order. No angular dynamics. */
export function advanceBodies(level,entities,held,previousSurfaces) {
  const events=[],visited=new Set(),visiting=new Set(),oldSurfaces=previousSurfaces??collectSurfaces(level,entities,held);
  const surfacesFor=e=>collectSurfaces(level,entities,held).filter(s=>s.id!==e.id);
  const visit=e=>{
    if(!e?.body||visited.has(e.id)||visiting.has(e.id))return;
    visiting.add(e.id);
    const previous=e.bodyState;
    if(e.id===held){e.bodyState={mode:'held',vy:0,support:null};}
    else if(previous.mode!=='outside'){
      const oldSupport=e.collider.enabled&&previous.mode==='supported'?supportFor(oldSurfaces,e,previous.support):null;
      if(oldSupport)visit(entities[oldSupport.id]);
      let surfaces=surfacesFor(e),support=null;
      if(e.collider.enabled&&oldSupport){
        support=surfaces.find(s=>s.id===oldSupport.id);
        if(support){
          const local=(e.x+(e.width??28)/2-oldSupport.x)/oldSupport.width;
          e.x=support.x+support.width*local-(e.width??28)/2;
          e.y=footprintHeight(support,e);
        }
      }
      if(!support&&e.collider.enabled)support=supportFor(surfaces,e,previous.support);
      if(support)e.bodyState={mode:'supported',vy:0,support:support.id};
      else{
        if(previous.mode==='supported')events.push({type:'supportlost',source:e.id,other:previous.support});
        const {gravity,maxFallSpeed}=level.world.physics;
        const vy=previous.mode==='falling'?previous.vy:0,accelerating=Math.min(STEP,Math.max(0,(maxFallSpeed-vy)/gravity));
        const endY=e.y+vy*accelerating+gravity*accelerating*accelerating/2+maxFallSpeed*(STEP-accelerating);
        let landing=null;
        if(e.collider.enabled)for(const surface of surfaces){
          const y=footprintHeight(surface,e);
          if(y===null||y<e.y-EPSILON||y>endY+EPSILON)continue;
          if(!landing||y<landing.y-EPSILON)landing={surface,y};
        }
        if(landing){
          const speed=Math.min(maxFallSpeed,Math.sqrt(vy*vy+2*gravity*Math.max(0,landing.y-e.y)));
          e.y=landing.y;e.bodyState={mode:'supported',vy:0,support:landing.surface.id};
          events.push({type:'landed',source:e.id,other:landing.surface.id,speed});
          if(entities[landing.surface.id])events.push({type:'impact',source:landing.surface.id,other:e.id,speed});
        }else{
          e.y=endY;e.bodyState={mode:'falling',vy:Math.min(maxFallSpeed,vy+gravity*STEP),support:null};
          if(e.y-(e.height??36)>=640){e.y=640+(e.height??36);e.bodyState={mode:'outside',vy:0,support:null};}
        }
      }
    }
    visiting.delete(e.id);visited.add(e.id);
  };
  for(const entity of Object.values(entities))visit(entity);
  return events;
}
