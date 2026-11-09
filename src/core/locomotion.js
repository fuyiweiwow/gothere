/** Derived visual state. It cannot change a route, support or traversal speed. */
export const ACTOR_ANIMATIONS=[['walking','普通行走'],['walk-left','向左行走'],['walk-right','向右行走'],['inward','向里行走'],['outward','向外行走'],['falling','下落'],['climbing','爬升'],['riding','乘坐'],['lost','失败'],['won','抵达']];

/** Deterministic presentation distances, independent of any sprite or clip. */
export function recordWalk(actor,distance,state){
  actor.walkDistance=(actor.walkDistance??0)+distance;
  actor.walkByState??={};actor.walkByState[state]=(actor.walkByState[state]??0)+distance;
}

export function actorAnimationState(level,snapshot){
  const actor=snapshot?.actor;
  if(!actor)return 'walking';
  if(['lost','won'].includes(snapshot.status))return snapshot.status;
  if(actor.passage){
    const nodes=level.spatial.nodes,a=nodes.find(n=>n.id===actor.passage.from),b=nodes.find(n=>n.id===actor.passage.to);
    return b.depth>a.depth?'inward':'outward';
  }
  if(['falling','climbing','riding'].includes(actor.mode))return actor.mode;
  return actor.direction===-1?'walk-left':'walk-right';
}
