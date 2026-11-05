import {syncPassageObject} from '../core/spatial.js';

/** Explicit editor operations; all resulting connectors are ordinary DSL objects. */
export function connectLayeredNodes(level,sourceId,targetId){
  const source=level.spatial.nodes.find(n=>n.id===sourceId),target=level.spatial.nodes.find(n=>n.id===targetId);
  if(!source)throw new Error('路线起点不存在。');
  if(!target){delete source.next;delete source.via;return;}
  if(target.id===source.id)throw new Error('路线不能连接自己。');
  source.next=target.id;
  if(source.plane===target.plane){delete source.via;return;}
  if(source.height!==target.height)throw new Error('内外连接两端应同高；真正升降请使用斜面或移动承托。');
  let e=level.entities.find(e=>e.passage?.from===source.id&&e.passage.to===target.id);
  if(!e){
    if(level.entities.length>=64)throw new Error('最多放置 64 个物体。');
    let i=1;while(level.entities.some(e=>e.id==='passage-'+i))i++;
    e={id:'passage-'+i,kind:'object',label:'内外连接 '+i,x:source.x,width:24,height:12,state:'active',
      space:{plane:source.plane,depth:source.depth,height:source.height,depthSize:20},passage:{from:source.id,to:target.id,distance:Math.max(20,Math.hypot(target.x-source.x,target.depth-source.depth)),enabled:true}};
    level.entities.push(e);
  }
  source.via=e.id;
}

export function assignWalkPlane(level,target,planeId){
  const p=level.spatial.planes.find(p=>p.id===planeId);if(!p)throw new Error('行走层不存在。');
  const fromPassage=Boolean(target.space.passage);if(fromPassage)syncPassageObject(level,target);
  target.space.plane=p.id;target.space.depth=p.depth;
  delete target.space.passage;delete target.space.progress;delete target.space.length;
  // Plane moves retain coordinates; passage moves reset to the converted position.
  const update=actions=>{for(const a of actions){if(a.type==='after')update(a.actions);else if(a.type==='move'&&a.target===target.id){
    if(fromPassage){delete a.progress;delete a.plane;a.x=target.x;a.height=target.space.height;}else if(a.plane!==undefined)a.plane=p.id;a.depth=p.depth;
  }}};
  if(target.id){for(const r of level.rules)update(r.actions);for(const e of level.entities)for(const b of e.behaviors??[])update(b.actions);}
}

export function setPlaneBaseline(level,planeId,baseline){
  const plane=level.spatial.planes.find(p=>p.id===planeId);if(!plane)throw new Error('行走层不存在。');
  plane.depth=level.spatial.projection.originY-baseline;
  for(const target of [level.actor,level.goal,...level.platforms,...level.entities])if(target.space.plane===planeId)assignWalkPlane(level,target,planeId);
  for(const n of level.spatial.nodes)if(n.plane===planeId)n.depth=plane.depth;
  const update=actions=>{for(const a of actions)if(a.type==='after')update(a.actions);else if(a.type==='move'&&a.plane===planeId)a.depth=plane.depth;};
  for(const r of level.rules)update(r.actions);for(const e of level.entities)for(const b of e.behaviors??[])update(b.actions);
  for(const n of level.scene?.nodes??[])if(n.anchor?.plane===planeId)n.anchor.depth=plane.depth;
  for(const e of level.entities)if(e.space.passage)syncPassageObject(level,e);
}
