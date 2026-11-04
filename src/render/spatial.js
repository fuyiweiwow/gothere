import {projectSpace,spaceObjectSurface,isLayered} from '../core/spatial.js';
import {drawLayered} from './layered.js';
import {artTransform,artBounds,artCorners,boundObject,assetImage,assetLibrary} from './resources.js';
import {createDepthBuffer} from './depth-buffer.js';

const frames=new WeakMap();
function frameFor(ctx){
  if(!frames.has(ctx)){
    const canvas=document.createElement('canvas'),scratch=document.createElement('canvas');canvas.width=1200;canvas.height=640;
    const buffer=createDepthBuffer(1200,640),out=canvas.getContext('2d'),image=out.createImageData(1200,640);
    frames.set(ctx,{canvas,scratch,buffer,out,image});
  }
  return frames.get(ctx);
}
const rgba=(hex,opacity=1)=>{const n=hex.slice(1);return [parseInt(n.slice(0,2),16),parseInt(n.slice(2,4),16),parseInt(n.slice(4,6),16),Math.round((n.length===8?parseInt(n.slice(6,8),16):255)*opacity)];};

/** World faces and upright sprites share a per-pixel depth buffer. Route overlays
 * remain editor annotations; drawing never changes support or collision. */
export function drawSpatial(ctx,level,snapshot,{logic=false,...options}={}) {
  if(isLayered(level)){drawLayered(ctx,level,snapshot,{logic,...options});return;}
  ctx.fillStyle=level.scene?.background??'#161e2b';ctx.fillRect(0,0,1200,640);
  const project=(x,depth,height)=>({...projectSpace(level,{x,depth,height}),depth});
  ctx.strokeStyle='#ffffff0a';ctx.lineWidth=1;
  if(logic)for(let d=0;d<=400;d+=40){const a=project(30,d,0),b=project(1150,d,0);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  const frame=frameFor(ctx),commands=[],labels=[];
  function face(points,fill,stroke,opacity=1){
    commands.push({points,color:rgba(fill,opacity)});
    if(stroke)points.forEach((a,i)=>commands.push({a,b:points[(i+1)%points.length],color:rgba(stroke,opacity),bias:-.02}));
  }
  // Canvas handles sprite transforms/antialiasing. Only the cropped RGBA patch
  // enters the depth buffer, preserving holes, alpha and independent art size.
  function sprite(bounds,depth,paint,bias=-.1,depthY=0){
    const x=Math.max(0,Math.floor(bounds.x-2)),y=Math.max(0,Math.floor(bounds.y-2));
    const width=Math.min(1200,Math.ceil(bounds.x+bounds.width+2))-x,height=Math.min(640,Math.ceil(bounds.y+bounds.height+2))-y;
    if(width<=0||height<=0)return;
    frame.scratch.width=width;frame.scratch.height=height;const s=frame.scratch.getContext('2d',{willReadFrequently:true});
    s.translate(-x,-y);paint(s);
    commands.push({x,y,width,height,data:s.getImageData(0,0,width,height).data,depth,depthY,bias});
  }
  const library=new Map(assetLibrary(level).map(a=>[a.id,a]));
  const boundLayers=new Map();
  for(const n of [...(level.scene?.nodes??[])].sort((a,b)=>a.layer-b.layer))if(n.bind){const b=n.bind,key=b.type+':'+(b.id??b.index??'');if(!boundLayers.has(key))boundLayers.set(key,[]);boundLayers.get(key).push(n);}
  function image(n,depth,bias=-.15){
    if(options.hiddenLayers?.has(n.id))return;
    const settings={...options,variant:options.previewVariant?.id===n.id?options.previewVariant.state:undefined};
    const t=artTransform(n,level,snapshot,settings);if(t.visible===false)return;
    const img=assetImage(library.get(t.asset));if(!img)return;
    function paint(s){
      s.save();s.globalAlpha=(t.opacity??1)*(options.artOpacity??1);s.translate(t.x,t.y);s.rotate(t.rotation*Math.PI/180);
      if(t.flipX){s.translate(t.width,0);s.scale(-1,1);}
      if(t.tile){s.beginPath();s.rect(0,0,t.width,t.height);s.clip();for(let y=0;y<t.height;y+=t.tile.height)for(let x=0;x<t.width;x+=t.tile.width)s.drawImage(img,x,y,t.tile.width,t.tile.height);}
      else s.drawImage(img,0,0,t.width,t.height);s.restore();
    }
    if(n.ground){
      const {nw,ne,sw}=artCorners(n,level,snapshot),bounds=artBounds(n,level,snapshot),g=n.ground;
      const top=Math.max(0,Math.floor(bounds.y-2));
      sprite(bounds,(top-level.spatial.projection.originY+g.height)/level.spatial.projection.depthY,s=>{
        s.save();s.globalAlpha=(t.opacity??1)*(options.artOpacity??1);s.transform((ne.x-nw.x)/t.width,(ne.y-nw.y)/t.width,(sw.x-nw.x)/t.height,(sw.y-nw.y)/t.height,nw.x,nw.y);
        s.drawImage(img,0,0,t.width,t.height);s.restore();
      },-.03,1/level.spatial.projection.depthY);
    }else if(depth===undefined)paint(ctx);
    else sprite(artBounds(n,level,snapshot,settings),depth,paint,bias);
  }
  if(!logic)for(const n of (level.scene?.nodes??[]).filter(n=>!n.bind).sort((a,b)=>a.layer-b.layer))image(n,n.anchor?.depth);
  const objects=[...level.platforms.map((p,index)=>({...p,renderKind:'platform',ref:{type:'platform',index}})),
    ...Object.values(snapshot?.entities??Object.fromEntries(level.entities.map(e=>[e.id,e]))).map(e=>({...e,renderKind:e.kind,ref:{type:'entity',id:e.id}})),
    {...level.goal,renderKind:'goal',ref:{type:'goal'}},{...(snapshot?.actor??level.actor),renderKind:'actor',ref:{type:'actor'}}];
  for(const o of objects){
    const s=o.space??{},x=o.x,d=s.depth??0,h=s.height??0,w=o.width??28,ds=s.depthSize??24,opacity=['inactive','disabled'].includes(o.state)?.4:1;
    const layers=boundLayers.get(o.ref.type+':'+(o.ref.id??o.ref.index??''))??[];
    const hasArt=!logic&&layers.some(n=>!options.hiddenLayers?.has(n.id)&&artTransform(n,level,snapshot,options).visible!==false);
    const color=o.renderKind==='platform'?h>0?'#6c8eac':'#52686b':o.contact?'#d58476':'#90a9aa',p=project(x,d,h);
    if(!hasArt&&(o.renderKind==='platform'||o.pose&&o.surface)){
      const surface=o.pose?spaceObjectSurface(o):o,{x,width:w,space:s}=surface,h=s.height,d=s.depth,ds=s.depthSize??24;
      const end=s.heightEnd??h,top=[project(x,d,h),project(x+w,d,end),project(x+w,d+ds,end),project(x,d+ds,h)];
      face([top[0],top[1],project(x+w,d,end-7),project(x,d,h-7)],'#253448');face(top,color,'#a2b6bf');
    }else if(!hasArt&&o.renderKind==='actor'){
      const bounds={x:p.x-16,y:p.y-40,width:32,height:46};
      const shadowTop=Math.max(0,Math.floor(p.y-5));
      sprite({x:p.x-14,y:shadowTop+2,width:28,height:12},(shadowTop-level.spatial.projection.originY+h)/level.spatial.projection.depthY,
        s=>{s.fillStyle='#0005';s.beginPath();s.ellipse(p.x,p.y+2,12,4,0,0,Math.PI*2);s.fill();},-.04,1/level.spatial.projection.depthY);
      sprite(bounds,d,s=>{
        s.fillStyle='#eac67e';s.fillRect(p.x-8,p.y-24,16,19);s.beginPath();s.arc(p.x,p.y-31,7,0,Math.PI*2);s.fill();
        s.strokeStyle='#efddb0';s.lineWidth=3;const step=options.animate===false?0:Math.sin((snapshot?.tick??0)*.3)*4;
        s.beginPath();s.moveTo(p.x-4,p.y-6);s.lineTo(p.x-6+step,p.y);s.moveTo(p.x+4,p.y-6);s.lineTo(p.x+6-step,p.y);s.stroke();
      });
    }else if(!hasArt&&o.renderKind==='goal'){
      sprite({x:p.x-15,y:p.y-39,width:30,height:42},d,s=>{s.strokeStyle='#a7d7bc';s.lineWidth=3;s.strokeRect(p.x-13,p.y-37,26,37);s.fillStyle='#a7d7bc33';s.fillRect(p.x-13,p.y-37,26,37);});
    }else if(!hasArt&&(logic||o.renderKind!=='zone')){
      const tall=o.height??36,a=project(x,d,h+tall),b=project(x+w,d,h+tall),c=project(x+w,d+ds,h+tall);
      face([a,b,project(x+w,d,h),project(x,d,h)],color,'#d3dee1',opacity);
      const side=level.spatial.projection.depthX<0?x:x+w;
      face([project(side,d,h+tall),project(side,d+ds,h+tall),project(side,d+ds,h),project(side,d,h)],color+'99','#b5c9cd',opacity);
      face([a,b,c,project(x,d+ds,h+tall)],color+'bb','#d8e3e6',opacity);
    }
    if(!logic)layers.forEach((n,index)=>image(n,d,-.15-index*.00001));
    if(logic&&o.label)labels.push({text:o.label,x:p.x,y:p.y-(o.height??36)-15});
  }
  if(!logic)for(const p of options.feedback?.particles??[]){
    const n=level.scene.nodes.find(n=>n.id===p.target);if(!n||options.hiddenLayers?.has(n.id))continue;
    const t=artTransform(n,level,snapshot,options);if(t.visible===false||n.ground)continue;
    const r=t.rotation*Math.PI/180,x=t.x+Math.cos(r)*p.x*t.width-Math.sin(r)*p.y*t.height,
      y=t.y+Math.sin(r)*p.x*t.width+Math.cos(r)*p.y*t.height,size=Math.max(3,Math.min(90,Math.max(t.width,t.height)*p.size));
    const paint=s=>{s.save();s.globalAlpha=p.alpha*(options.artOpacity??1);s.fillStyle=p.color;
      if(p.kind==='smoke'){const g=s.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,p.color+'bb');g.addColorStop(1,p.color+'00');s.fillStyle=g;}
      s.beginPath();s.arc(x,y,size,0,Math.PI*2);s.fill();s.restore();};
    const depth=boundObject(n,level,snapshot)?.space?.depth??n.anchor?.depth;
    if(depth===undefined)paint(ctx);else sprite({x:x-size,y:y-size,width:2*size,height:2*size},depth,paint,-.16);
  }
  frame.buffer.render(commands);frame.image.data.set(frame.buffer.data);frame.out.putImageData(frame.image,0,0);ctx.drawImage(frame.canvas,0,0);
  if(logic){
    for(const label of labels){ctx.fillStyle='#c7d6e1';ctx.font='11px Microsoft YaHei, sans-serif';ctx.fillText(label.text,label.x,label.y);}
    const nodes=level.spatial.nodes;ctx.strokeStyle='#eac67eb0';ctx.lineWidth=2;ctx.setLineDash([6,5]);
    for(const n of nodes){const to=nodes.find(t=>t.id===n.next);if(!to)continue;const p=project(n.x,n.depth,n.height),q=project(to.x,to.depth,to.height);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
    ctx.setLineDash([]);
    for(const n of nodes){const p=project(n.x,n.depth,n.height);ctx.fillStyle='#eac67e';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}
  }
}
