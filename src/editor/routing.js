const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const snapPoint=point=>({x:clamp(Math.round(point.x/10)*10,0,1200),y:clamp(Math.round(point.y/10)*10,20,620)});
export function wireAction(level,wire) {
  let actions=level.rules[wire.rule]?.actions;
  for(const index of wire.path.slice(0,-1))actions=actions?.[index]?.actions;
  return actions?.[wire.path.at(-1)];
}
export function setWirePoints(level,wire,points) {
  const action=wireAction(level,wire);
  if(!action)throw new Error('这条连线已不存在。');
  if(points.length>16)throw new Error('每条连线最多 16 个转接点。');
  if(points.length)action.editor={waypoints:points.map(snapPoint)};
  else delete action.editor;
}
/** Orthogonal segments retain their insertion index for adding a waypoint on any bend. */
export function routeWire(from,to,points,lane=0) {
  const manual=points?.length>0;
  const y=clamp(Math.min(from.y,to.y)-40-lane*18,24,600);
  const anchors=manual?[from,...points,to]:[from,{x:clamp(from.x+20,0,1200),y:from.y},
    {x:clamp(from.x+20,0,1200),y},{x:clamp(to.x-20,0,1200),y},{x:clamp(to.x-20,0,1200),y:to.y},to];
  const segments=[],vertices=[from];
  const append=(point,insert)=>{const last=vertices.at(-1);if(last.x===point.x&&last.y===point.y)return;
    segments.push({from:last,to:point,insert});vertices.push(point);};
  for(let i=1;i<anchors.length;i++){
    const a=anchors[i-1],b=anchors[i],insert=manual?i-1:0;
    append({x:b.x,y:a.y},insert);append(b,insert);
  }
  return {vertices,segments,path:vertices.map((p,i)=>(i?'L':'M')+' '+p.x+' '+p.y).join(' ')};
}
export function nearestInsertion(route,point) {
  let distance=Infinity,index=0;
  for(const segment of route.segments){
    const a=segment.from,b=segment.to;
    const x=clamp(point.x,Math.min(a.x,b.x),Math.max(a.x,b.x)),y=clamp(point.y,Math.min(a.y,b.y),Math.max(a.y,b.y));
    const d=(point.x-x)**2+(point.y-y)**2;
    if(d<distance){distance=d;index=segment.insert;}
  }
  return index;
}
