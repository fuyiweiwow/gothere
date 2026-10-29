/** Local baseline coordinates: x/y are the unrotated left endpoint, pivot is a length ratio. */
export function posePoint(object, ratio, angle = object.pose?.angle ?? 0) {
  const width=object.width??28,pivot=object.pose?.pivot??0,radians=angle*Math.PI/180;
  const distance=width*(ratio-pivot);
  return {x:object.x+width*pivot+distance*Math.cos(radians),y:(object.y??440)+distance*Math.sin(radians)};
}

export function posedSurface(object, angle = object.pose?.angle ?? 0) {
  const left=posePoint(object,0,angle),right=posePoint(object,1,angle);
  return {id:object.id,x:left.x,y:left.y,width:right.x-left.x,yEnd:right.y};
}

export function poseInBounds(object, angle = object.pose?.angle ?? 0) {
  return [posePoint(object,0,angle),posePoint(object,1,angle)].every(p=>p.x>=0&&p.x<=1200&&p.y>=160&&p.y<=560);
}

/** Support has its thickness below the baseline; other objects keep their body above it. */
export function posePolygon(object) {
  const a=posePoint(object,0),b=posePoint(object,1),r=(object.pose?.angle??0)*Math.PI/180;
  const height=(object.height??(object.surface?12:36))*(object.surface?1:-1);
  const dx=-Math.sin(r)*height,dy=Math.cos(r)*height;
  return [a,b,{x:b.x+dx,y:b.y+dy},{x:a.x+dx,y:a.y+dy}];
}
