import {floorY} from '../core/schema.js';
import {surfaceEndY} from '../core/surfaces.js';
import {posePolygon} from '../core/pose.js';
import {diagramBounds} from '../core/geometry.js';
import {presentationFrame,presentationGeometry} from './presentation.js';
import {drawResources} from './resources.js';

function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);ctx.fill();}
function round(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}

/** The scene paints the same geometry and states as the logic view; it never advances or edits them. */
export function drawScene(ctx,level,snapshot,options={}) {
  const {animate=true}=options;
  if(level.scene){drawResources(ctx,level,snapshot,options);return;}
  const tick=snapshot?.tick??0,entities=snapshot?Object.values(snapshot.entities):level.entities;
  const sky=ctx.createLinearGradient(0,0,0,640);sky.addColorStop(0,'#101e35');sky.addColorStop(1,'#263c50');ctx.fillStyle=sky;ctx.fillRect(0,0,1200,640);
  ellipse(ctx,1035,77,29,29,'#f5dfad');ellipse(ctx,1047,68,24,24,'#14243b');
  for(let i=0;i<52;i++){ctx.fillStyle=i%3?'#97aabc80':'#e7ce9db0';ctx.fillRect((i*173+31)%1200,25+(i*47)%132,2,2);}
  for(let i=0;i<15;i++){const x=i*90-20,y=250+(i*41)%180;round(ctx,x,y,76,640-y,2,'#142a3d');for(let k=0;k<4;k++)round(ctx,x+12+k%2*33,y+22+Math.floor(k/2)*36,9,14,'#a7c3cf12');}
  for(const p of level.platforms){const y=floorY(p),end=surfaceEndY(p);
    polygon(ctx,[{x:p.x,y},{x:p.x+p.width,y:end},{x:p.x+p.width,y:640},{x:p.x,y:640}],'#304c5d','#476676');
    polygon(ctx,[{x:p.x,y},{x:p.x+p.width,y:end},{x:p.x+p.width,y:end+9},{x:p.x,y:y+9}],'#9bb9b6','#d4d9bb');
    for(let x=p.x+18;x<p.x+p.width-12;x+=44){const top=y+(end-y)*(x-p.x)/p.width;round(ctx,x,top+35,15,23,2,'#142e42');round(ctx,x+3,top+38,8,15,1,'#e7ba7138');}
  }
  const goal=level.goal,gy=floorY(goal);round(ctx,goal.x-20,gy-48,40,48,3,'#c69249');round(ctx,goal.x-15,gy-43,30,39,2,'#ffe4a0');ctx.strokeStyle='#9f7945';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(goal.x,gy-43);ctx.lineTo(goal.x,gy-4);ctx.moveTo(goal.x-15,gy-24);ctx.lineTo(goal.x+15,gy-24);ctx.stroke();
  for(const e of entities){
    if(e.kind==='zone')continue;
    const b=presentationGeometry(e),f=presentationFrame(e,tick,animate),symbol=e.presentation?.symbol??'block',color=e.presentation?.color??'#9db9ad';
    ctx.save();ctx.globalAlpha=f.opacity;ctx.translate(0,f.offsetY);
    if(e.pose){const px=e.x+(e.width??28)*e.pose.pivot,py=floorY(e);ctx.translate(px,py);ctx.rotate(e.pose.angle*Math.PI/180);ctx.translate(-px,-py);}
    if(symbol==='cloud'){
      const y=floorY(e);for(let i=0;i<6;i++)ellipse(ctx,e.x+e.width*(i+.5)/6,y+4-((i%3)*2),e.width/7,8,color);
      if(e.surface?.enabled){ctx.strokeStyle='#effbf1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e.x,y);ctx.lineTo(e.x+e.width,y);ctx.stroke();}
    }else if(symbol==='umbrella'){
      const cx=b.x+b.width/2,cy=b.y+(f.active?-8:4);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,b.y+b.height-2);ctx.quadraticCurveTo(cx-10,b.y+b.height+6,cx-9,b.y+b.height-3);ctx.stroke();
      if(f.active){ctx.fillStyle=color;ctx.beginPath();ctx.arc(cx,cy,24,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff3c5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,cy-24);ctx.lineTo(cx-8,cy);ctx.moveTo(cx,cy-24);ctx.lineTo(cx+8,cy);ctx.stroke();}
      else polygon(ctx,[{x:cx,y:cy-17},{x:cx-7,y:cy+11},{x:cx+7,y:cy+11}],color);
    }else if(symbol==='creature'){
      const y=e.y,w=e.width??80;ellipse(ctx,e.x+w*.5,y-9,w*.5,10,color);
      if(f.active){ellipse(ctx,e.x+w*.4,y-29,w*.32,26,color);ellipse(ctx,e.x+w*.74,y-35,w*.2,15,color);ellipse(ctx,e.x+w*.8,y-40,4,5,'#fff0ce');ellipse(ctx,e.x+w*.82,y-40,2,3,'#172c35');}
      else{ellipse(ctx,e.x+w*.8,y-10,w*.2,8,color);ctx.font='12px sans-serif';ctx.fillStyle='#f0dfa4';ctx.fillText('z',e.x+w*.8,y-30+(animate?Math.sin(tick/15)*3:0));}
    }else if(symbol==='pot'){
      polygon(ctx,[{x:b.x+2,y:b.y+5},{x:b.x+b.width-2,y:b.y+5},{x:b.x+b.width-6,y:b.y+b.height},{x:b.x+6,y:b.y+b.height}],color,'#efcd9b');round(ctx,b.x,b.y,b.width,7,2,'#e9c093');
      ctx.strokeStyle='#9bbb89';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x+b.width/2,b.y);ctx.lineTo(b.x+b.width/2,b.y-12);ctx.stroke();ellipse(ctx,b.x+b.width/2+5,b.y-10,6,3,'#a6c090');
    }else if(e.pose){polygon(ctx,posePolygon({...e,pose:{...e.pose,angle:0}}),color,'#e6d4ad');}
    else{round(ctx,b.x,b.y,b.width,b.height,3,color);ctx.strokeStyle='#d9ddbf';ctx.lineWidth=2;ctx.strokeRect(b.x,b.y,b.width,b.height);}
    if(e.collider&&!e.collider.enabled){ctx.strokeStyle='#d9d0ad';ctx.setLineDash([4,4]);ctx.strokeRect(b.x,b.y,b.width,b.height);}
    ctx.restore();const label=diagramBounds(e.kind,e);ctx.font='11px "Microsoft YaHei",sans-serif';ctx.fillStyle='#e7e9d6';ctx.fillText(e.label,label.x,Math.max(26,label.y-12));
  }
  const a=snapshot?.actor??level.actor,x=a.x,y=floorY(a),walking=a.mode!=='falling',phase=animate&&walking?Math.sin(tick*.35)*4:0;
  ctx.save();ctx.translate(x,y);ctx.scale(a.direction??1,1);ctx.strokeStyle='#e3ba83';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-3,-12);ctx.lineTo(-6+phase,0);ctx.moveTo(3,-12);ctx.lineTo(6-phase,0);ctx.stroke();
  round(ctx,-8,-27,16,17,4,'#e2b56d');ellipse(ctx,0,-34,8,9,'#f3d3a0');round(ctx,-10,-44,20,5,2,'#79b8b4');ellipse(ctx,4,-35,1.5,2,'#192e3a');ctx.restore();
  ctx.font='12px sans-serif';ctx.fillStyle='#d5d9c1';ctx.fillText('亮窗',goal.x-13,gy-59);
}
