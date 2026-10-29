import { floorY } from '../core/schema.js';
import { diagramBounds } from '../core/geometry.js';
import { verticalTransport, landingX } from '../core/transport.js';
import { surfaceEndY } from '../core/surfaces.js';
import { posePoint, posePolygon } from '../core/pose.js';

export function drawPosedObject(ctx,object,color='#8baad1') {
  const points=posePolygon(object);ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color+'35';ctx.lineWidth=2;
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
  if(object.surface?.enabled){ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);ctx.lineTo(points[1].x,points[1].y);ctx.stroke();}
  const pivot=posePoint(object,object.pose.pivot);ctx.setLineDash([]);ctx.fillStyle='#181e28';ctx.beginPath();ctx.arc(pivot.x,pivot.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
}

export function drawColliderObject(ctx,object,color='#8baad1') {
  const height=object.height??36,y=(object.y??440)-height,width=object.width??28;
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color+'25';ctx.lineWidth=2;
  ctx.setLineDash(object.collider.enabled?[]:[5,4]);ctx.fillRect(object.x,y,width,height);ctx.strokeRect(object.x,y,width,height);
  if(object.collider.enabled){ctx.setLineDash([]);ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(object.x,y);ctx.lineTo(object.x+width,y);ctx.stroke();}
  if(object.body){ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='16px sans-serif';ctx.fillText('↓',object.x+width/2-6,y+height/2+5);}
  ctx.restore();
}

const colors = { actor:'#39c3bd', goal:'#e3b454', switch:'#a6a0f0', object:'#8baad1', zone:'#83998b',
  gate:'#d7ad75', bridge:'#d7ad75', ladder:'#9cacc1', lift:'#9cacc1', plate:'#a6a0f0', hazard:'#d88080' };

/** A read-only view of a document or simulation snapshot. No asset loading, rules or timing. */
export function drawDiagram(ctx, level, snapshot) {
  const { width, height } = level.world;
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#181e28';ctx.fillRect(0,0,width,height);
  for(let x=0;x<=width;x+=50){ctx.strokeStyle=x%100?'#202834':'#2a3341';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,height);ctx.stroke();}
  for(let y=0;y<=height;y+=50){ctx.strokeStyle=y%100?'#202834':'#2a3341';ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(width,y+.5);ctx.stroke();}
  ctx.font='11px ui-monospace, Consolas, monospace';ctx.fillStyle='#7c8b9f';
  for(let x=100;x<width;x+=100)ctx.fillText(String(x),x+4,17);
  for(let y=100;y<height;y+=100)ctx.fillText(String(y),6,y-5);
  for(const p of level.platforms){const y=floorY(p),end=surfaceEndY(p);ctx.fillStyle='#596779';ctx.beginPath();
    ctx.moveTo(p.x,y+2);ctx.lineTo(p.x+p.width,end+2);ctx.lineTo(p.x+p.width,end+14);ctx.lineTo(p.x,y+14);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#9eafc3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,y);ctx.lineTo(p.x+p.width,end);ctx.stroke();}
  const entities = snapshot ? Object.values(snapshot.entities) : level.entities;
  for(const e of entities){
    const b=diagramBounds(e.kind,e), inactive=['inactive','disabled','stopped','folded','open'].includes(e.state);
    const color=colors[e.kind]??'#9cacc1';ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color+'25';ctx.lineWidth=2;
    if(inactive)ctx.setLineDash([6,4]);
    if(e.pose)drawPosedObject(ctx,e,color);else if(e.collider)drawColliderObject(ctx,e,color);else{ctx.fillRect(b.x,b.y,b.width,b.height);ctx.strokeRect(b.x,b.y,b.width,b.height);}
    const transport=verticalTransport(e);
    if(transport){
      const cx=b.x+b.width/2,cy=(transport.toY+floorY(e))/2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(cx,transport.toY);ctx.lineTo(cx,floorY(e));ctx.stroke();ctx.setLineDash([]);
      ctx.font='22px sans-serif';ctx.fillStyle=color;ctx.fillText('↕',cx-9,cy+7);
      for(const y of [transport.toY,floorY(e)]){ctx.fillStyle=landingX(level,e,y)===null?'#e58b88':'#60d1c7';ctx.fillRect(b.x-2,y-3,b.width+4,6);}
    }
    if(e.kind==='lift'){ctx.setLineDash([]);ctx.fillStyle=color;ctx.fillRect(e.x,(e.carY??(e.state==='upper'?e.toY:floorY(e)))-5,b.width,10);}
    if(e.contact?.effect==='lethal'&&!inactive){ctx.fillStyle='#e58b88';ctx.font='bold 16px sans-serif';ctx.fillText('!',b.x+b.width/2-3,b.y+20);}
    ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='12px ui-monospace, Consolas, monospace';ctx.fillText(e.label,b.x,b.y-10);
    ctx.fillStyle='#96a3b5';ctx.font='10px ui-monospace, Consolas, monospace';ctx.fillText(e.state,b.x,b.y+b.height+16);ctx.restore();
  }
  const goal=diagramBounds('goal',level.goal);ctx.strokeStyle=colors.goal;ctx.lineWidth=2;ctx.strokeRect(goal.x,goal.y,goal.width,goal.height);
  ctx.fillStyle=colors.goal;ctx.font='12px sans-serif';ctx.fillText('终点',goal.x-2,goal.y-10);
  const actor=snapshot?.actor??level.actor, a=diagramBounds('actor',actor);
  ctx.fillStyle=colors.actor;ctx.fillRect(a.x,a.y,a.width,a.height);ctx.fillStyle='#15252c';ctx.font='bold 17px sans-serif';ctx.fillText((actor.direction??1)===1?'›':'‹',a.x+8,a.y+22);
  ctx.fillStyle=colors.actor;ctx.font='12px sans-serif';ctx.fillText('主角',a.x-2,a.y-10);
  if(actor.holding){ctx.strokeStyle=colors.actor;ctx.setLineDash([3,3]);const held=entities.find(e=>e.id===actor.holding);if(held){ctx.beginPath();ctx.moveTo(actor.x,a.y+16);ctx.lineTo(held.x,a.y+16);ctx.stroke();}ctx.setLineDash([]);}
}
