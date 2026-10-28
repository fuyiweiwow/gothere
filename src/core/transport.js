/** Shared vertical-travel capability. Legacy ladder records remain supported. */
export function verticalTransport(entity) {
  return entity?.kind==='ladder'?entity:entity?.kind==='object'&&entity.transport?.type==='vertical'?entity.transport:null;
}
export function transportEnabled(entity) {
  return Boolean(verticalTransport(entity))&&(entity.kind==='ladder'?entity.state==='enabled':entity.state==='active');
}
/** A landing may overlap any part of the object's width; its centre need not be supported. */
export function landingX(level, entity, y, preferred=entity.x+(entity.width??28)/2) {
  const overlaps=level.platforms.filter(p=>(p.y??440)===y&&p.x<=entity.x+(entity.width??28)&&p.x+p.width>=entity.x)
    .map(p=>Math.max(Math.max(p.x,entity.x),Math.min(Math.min(p.x+p.width,entity.x+(entity.width??28)),preferred)));
  return overlaps.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b)[0]??null;
}
