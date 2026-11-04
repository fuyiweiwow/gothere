import {projectSpace,spatialDrawOrder} from '../core/spatial.js';
import {artTransform,assetImage,assetLibrary} from './resources.js';

function polygon(ctx,points,fill,stroke) {
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}
}
/** Paint projected world solids and bound images in one order. No simulation decisions occur here. */
export function drawSpatial(ctx,level,snapshot,{logic=false,...options}={}) {
  ctx.fillStyle=level.scene?.background??'#161e2b';ctx.fillRect(0,0,1200,640);
  const project=(x,depth,height)=>projectSpace(level,{x,depth,height});
  ctx.strokeStyle='#ffffff0a';ctx.lineWidth=1;
  for(let d=0;d<=400;d+=40){const a=project(30,d,0),b=project(1150,d,0);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  const objects=[...level.platforms.map((p,index)=>({...p,renderKind:'platform',ref:{type:'platform',index}})),
    ...Object.values(snapshot?.entities??Object.fromEntries(level.entities.map(e=>[e.id,e]))).map(e=>({...e,renderKind:e.kind,ref:{type:'entity',id:e.id}})),
    {...level.goal,renderKind:'goal',ref:{type:'goal'}},{...(snapshot?.actor??level.actor),renderKind:'actor',ref:{type:'actor'}}];
  const library=new Map(assetLibrary(level).map(a=>[a.id,a]));
  function image(n){
    if(options.hiddenLayers?.has(n.id))return;
    const t=artTransform(n,level,snapshot,{...options,variant:options.previewVariant?.id===n.id?options.previewVariant.state:undefined});if(t.visible===false)return;
    const img=assetImage(library.get(t.asset));ctx.save();ctx.globalAlpha=(t.opacity??1)*(options.artOpacity??1);ctx.translate(t.x,t.y);ctx.rotate(t.rotation*Math.PI/180);
    if(t.flipX){ctx.translate(t.width,0);ctx.scale(-1,1);}if(img)ctx.drawImage(img,0,0,t.width,t.height);ctx.restore();
  }
  if(!logic)for(const n of (level.scene?.nodes??[]).filter(n=>!n.bind).sort((a,b)=>a.layer-b.layer))image(n);
  for(const o of spatialDrawOrder(level,objects)){
    const s=o.space??{},x=o.x,d=s.depth??0,h=s.height??0,w=o.width??28,ds=s.depthSize??24;
    const color=o.renderKind==='platform'?h>0?'#6c8eac':'#52686b':o.contact?'#d58476':'#90a9aa';
    const p=project(x,d,h);ctx.save();
    if(['inactive','disabled'].includes(o.state)){ctx.globalAlpha=.4;ctx.setLineDash([4,4]);}
    if(o.renderKind==='platform'){
      const end=s.heightEnd??h,top=[project(x,d,h),project(x+w,d,end),project(x+w,d+ds,end),project(x,d+ds,h)];
      polygon(ctx,[top[0],top[1],{x:top[1].x,y:top[1].y+7},{x:top[0].x,y:top[0].y+7}],'#253448');polygon(ctx,top,color,'#a2b6bf');
    }else if(o.renderKind==='actor'){
      ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(p.x,p.y+2,12,4,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#eac67e';ctx.fillRect(p.x-8,p.y-24,16,19);ctx.beginPath();ctx.arc(p.x,p.y-31,7,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#efddb0';ctx.lineWidth=3;const step=options.animate===false?0:Math.sin((snapshot?.tick??0)*.3)*4;
      ctx.beginPath();ctx.moveTo(p.x-4,p.y-6);ctx.lineTo(p.x-6+step,p.y);ctx.moveTo(p.x+4,p.y-6);ctx.lineTo(p.x+6-step,p.y);ctx.stroke();
    }else if(o.renderKind==='goal'){
      ctx.strokeStyle='#a7d7bc';ctx.lineWidth=3;ctx.strokeRect(p.x-13,p.y-37,26,37);ctx.fillStyle='#a7d7bc33';ctx.fillRect(p.x-13,p.y-37,26,37);
    }else{
      const tall=o.height??36,a=project(x,d,h+tall),b=project(x+w,d,h+tall),c=project(x+w,d+ds,h+tall),f=project(x+w,d+ds,h);
      polygon(ctx,[a,b,{x:b.x,y:b.y+tall},{x:a.x,y:a.y+tall}],color,'#d3dee1');
      polygon(ctx,[b,c,f,{x:b.x,y:b.y+tall}],color+'99','#b5c9cd');polygon(ctx,[a,b,c,project(x,d+ds,h+tall)],color+'bb','#d8e3e6');
    }
    ctx.restore();
    if(!logic){for(const n of (level.scene?.nodes??[]).filter(n=>n.bind&&n.bind.type===o.ref.type&&
      (o.ref.type==='entity'?n.bind.id===o.ref.id:o.ref.type==='platform'?n.bind.index===o.ref.index:true)).sort((a,b)=>a.layer-b.layer))image(n);}
    if(logic&&o.label){ctx.fillStyle='#c7d6e1';ctx.font='11px Microsoft YaHei, sans-serif';ctx.fillText(o.label,p.x,p.y-(o.height??36)-15);}
  }
  if(logic){
    const nodes=level.spatial.nodes;
    ctx.strokeStyle='#eac67eb0';ctx.lineWidth=2;ctx.setLineDash([6,5]);
    for(const n of nodes){const to=nodes.find(t=>t.id===n.next);if(!to)continue;const p=project(n.x,n.depth,n.height),q=project(to.x,to.depth,to.height);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
    ctx.setLineDash([]);
    for(const n of nodes){const p=project(n.x,n.depth,n.height);ctx.fillStyle='#eac67e';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}
  }
}
