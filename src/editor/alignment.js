/** Screen-sized tolerance, measured against immutable geometry from the gesture start. */
export function alignMove(box, targets, dx, dy, {threshold=5, disabled=false}={}) {
  if(disabled)return {dx,dy,guides:[]};
  const guides=[];
  for(const axis of ['x','y']){
    const size=axis==='x'?'width':'height',delta=axis==='x'?dx:dy;
    let best=null;
    for(const target of targets)for(const edge of [0,.5,1])for(const other of [0,.5,1]){
      const position=target[axis]+target[size]*other;
      const correction=position-(box[axis]+box[size]*edge+delta);
      if(Math.abs(correction)<=threshold&&(!best||Math.abs(correction)<Math.abs(best.correction)))best={axis,position,correction};
    }
    if(best){if(axis==='x')dx+=best.correction;else dy+=best.correction;guides.push({axis,position:best.position});}
  }
  return {dx,dy,guides};
}

export function drawGuides(container,guides) {
  container.replaceChildren();
  for(const guide of guides){
    if(guide.kind==='surface'){
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),line=document.createElementNS(ns,'line');
      svg.classList.add('surface-guide');svg.dataset.snapKind='surface';svg.setAttribute('viewBox','0 0 1200 640');svg.setAttribute('preserveAspectRatio','none');
      for(const [key,value] of Object.entries({x1:guide.x,y1:guide.y,x2:guide.x+guide.width,y2:guide.yEnd}))line.setAttribute(key,String(value));
      line.setAttribute('vector-effect','non-scaling-stroke');svg.append(line);container.append(svg);continue;
    }
    const line=document.createElement('div');line.className='alignment-guide '+guide.axis;line.dataset.axis=guide.axis;
    line.style[guide.axis==='x'?'left':'top']=guide.position/(guide.axis==='x'?12:6.4)+'%';container.append(line);}
}
