import {ASSETS} from '../content/library.js';
import {floorY} from '../core/schema.js';
import {applyMotion} from './feedback.js';
import {projectSpace,passagePosition} from '../core/spatial.js';
import {actorAnimationState} from '../core/locomotion.js';

const images=new Map();
export function assetLibrary(level) {return [...ASSETS,...(level.scene?.assets??[])];}
export function boundObject(node,level,snapshot) {
  const b=node.bind;if(!b)return null;
  if(b.type==='entity')return snapshot?.entities[b.id]??level.entities.find(e=>e.id===b.id);
  if(b.type==='platform')return level.platforms[b.index];
  return b.type==='actor'?(snapshot?.actor??level.actor):level.goal;
}

/** A pure visual transform sampled from actual logical geometry, never the other way around. */
export function artTransform(node,level,snapshot,{tick=snapshot?.tick??0,animate=true,variant,feedback,previewTarget}={}) {
  const object=boundObject(node,level,snapshot),state=variant??(node.bind?.type==='actor'?actorAnimationState(level,snapshot):object?.passage?(object.state==='active'&&object.passage.enabled?'passage-enabled':'passage-disabled'):object?.state);
  const variantData=node.variants?.[state]??(node.bind?.type==='actor'&&['walk-left','walk-right','inward','outward'].includes(state)?node.variants?.walking:object?.passage?node.variants?.[object.state]:undefined),n={...node,...variantData};
  if(n.ground){const g=n.ground,p=projectSpace(level,{x:g.x,depth:g.depth+g.depthSize,height:g.height}),q=projectSpace(level,{x:g.x+g.width,depth:g.depth,height:g.height});
    return {...n,x:Math.min(p.x,q.x,g.x+g.depth*level.spatial.projection.depthX),y:p.y,width:g.width+Math.abs(g.depthSize*level.spatial.projection.depthX),height:q.y-p.y,rotation:0};}
  if(!snapshot&&previewTarget===node.id)n.visible=true;
  let x=n.x,y=n.y,rotation=n.rotation??0;
  if(node.anchor){const p=projectSpace(level,node.anchor);x+=p.x;y+=p.y;}
  if(object){
    const angle=object.pose?.angle??0,r=angle*Math.PI/180,pivot=(object.width??28)*(object.pose?.pivot??0);
    x=object.x+pivot+(n.x-pivot)*Math.cos(r)-n.y*Math.sin(r);
    y=floorY(object)+(n.x-pivot)*Math.sin(r)+n.y*Math.cos(r);rotation+=angle;
    if(level.spatial){const p=projectSpace(level,object.space?.passage?{...passagePosition(level,object.space.passage,object.space.progress),height:object.space.height}:{x:object.x,depth:object.space?.depth??0,height:object.space?.height??0});x+=p.x-object.x;y+=p.y-floorY(object);}
    if(n.fitPassage&&object.passage){
      const nodes=level.spatial.nodes,a=projectSpace(level,nodes.find(p=>p.id===object.passage.from)),b=projectSpace(level,nodes.find(p=>p.id===object.passage.to));
      const r=Math.atan2(b.y-a.y,b.x-a.x);x=a.x+n.x*Math.cos(r)-n.y*Math.sin(r);y=a.y+n.x*Math.sin(r)+n.y*Math.cos(r);
      rotation=(n.rotation??0)+r*180/Math.PI;n.width=Math.hypot(b.x-a.x,b.y-a.y);
    }
  }
  const animation=variantData&&Object.hasOwn(variantData,'animation')?variantData.animation:variantData?.asset?null:node.animation;
  const frames=animation?.frames,frame=animate&&!['lost','won'].includes(snapshot?.status)?Math.floor(tick*(animation?.fps??1)/60):0;
  return applyMotion({...n,x,y,rotation,asset:frames?.[frame%frames.length]??n.asset,
    flipX:Boolean(n.flipX)!==Boolean(n.flipWithDirection&&(object?.direction??object?.motionDirection)===-1)},feedback?.motions[node.id]);
}

export function artCorners(node,level,snapshot,options) {
  if(node.ground){const g=node.ground;return Object.fromEntries([['nw',0,0],['ne',g.width,0],['se',g.width,g.depthSize],['sw',0,g.depthSize]].map(([key,x,depth])=>[key,projectSpace(level,{x:g.x+x,depth:g.depth+depth,height:g.height})]));}
  const n=artTransform(node,level,snapshot,options),r=n.rotation*Math.PI/180,C=Math.cos(r),S=Math.sin(r);
  if(n.fitPassage&&n.passageView){const h=n.height/2,end=h*n.passageView.endScale;
    return Object.fromEntries([['nw',0,-h],['ne',n.width,-end],['se',n.width,end],['sw',0,h]].map(([key,x,y])=>[key,{x:n.x+x*C-y*S,y:n.y+x*S+y*C}]));}
  return Object.fromEntries([['nw',0,0],['ne',n.width,0],['se',n.width,n.height],['sw',0,n.height]].map(([key,x,y])=>[key,{x:n.x+x*C-y*S,y:n.y+x*S+y*C}]));
}

export function artBounds(node,level,snapshot,options) {
  const corners=Object.values(artCorners(node,level,snapshot,options));
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}

export function entityArtBounds(level,snapshot,id,options) {
  const boxes=(level.scene?.nodes??[]).filter(n=>n.bind?.type==='entity'&&n.bind.id===id&&artTransform(n,level,snapshot,options).visible!==false).map(n=>artBounds(n,level,snapshot,options));
  if(!boxes.length)return null;
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}

export function assetImage(asset) {
  if(!asset||typeof Image==='undefined')return null;
  if(!images.has(asset.src)){const image=new Image();image.src=asset.src;images.set(asset.src,image);}
  const image=images.get(asset.src);return image.complete&&image.naturalWidth?image:null;
}

export function loadResources(level) {
  return Promise.all(assetLibrary(level).map(a=>{assetImage(a);const image=images.get(a.src);return image?.decode().catch(()=>{});}));
}

export function drawResources(ctx,level,snapshot,options={}) {
  const library=new Map(assetLibrary(level).map(a=>[a.id,a]));
  ctx.fillStyle=level.scene.background;ctx.fillRect(0,0,1200,640);
  for(const node of [...level.scene.nodes].sort((a,b)=>a.layer-b.layer)){
    if(options.hiddenLayers?.has(node.id))continue;
    const n=artTransform(node,level,snapshot,{...options,variant:options.previewVariant?.id===node.id?options.previewVariant.state:undefined});if(n.visible===false)continue;
    const image=assetImage(library.get(n.asset));ctx.save();ctx.translate(n.x,n.y);ctx.rotate(n.rotation*Math.PI/180);ctx.globalAlpha=(n.opacity??1)*(options.artOpacity??1);
    if(n.flipX){ctx.translate(n.width,0);ctx.scale(-1,1);}
    if(image&&n.fitPassage&&n.passageView){
      const end=n.height*n.passageView.endScale,steps=Math.ceil(n.width/4);
      ctx.beginPath();ctx.moveTo(0,-n.height/2);ctx.lineTo(n.width,-end/2);ctx.lineTo(n.width,end/2);ctx.lineTo(0,n.height/2);ctx.closePath();ctx.clip();
      for(let i=0;i<steps;i++){const t=i/steps,w=n.height+(end-n.height)*(i+.5)/steps;
        ctx.drawImage(image,t*image.naturalWidth,0,image.naturalWidth/steps,image.naturalHeight,t*n.width,-w/2,n.width/steps+.5,w);}
    }else if(image&&n.tile){ctx.beginPath();ctx.rect(0,0,n.width,n.height);ctx.clip();for(let y=0;y<n.height;y+=n.tile.height)for(let x=0;x<n.width;x+=n.tile.width)ctx.drawImage(image,x,y,n.tile.width,n.tile.height);}
    else if(image)ctx.drawImage(image,0,0,n.width,n.height);
    else{ctx.fillStyle='#59727d';ctx.fillRect(0,0,n.width,n.height);ctx.strokeStyle='#a1beb8';ctx.strokeRect(0,0,n.width,n.height);}
    ctx.restore();
  }
  const byId=new Map(level.scene.nodes.map(n=>[n.id,n]));
  for(const p of options.feedback?.particles??[]){
    const node=byId.get(p.target);if(!node||options.hiddenLayers?.has(p.target))continue;
    const n=artTransform(node,level,snapshot,options);if(n.visible===false)continue;
    const size=Math.max(3,Math.min(90,Math.max(n.width,n.height)*p.size)),r=n.rotation*Math.PI/180;
    const x=n.x+Math.cos(r)*p.x*n.width-Math.sin(r)*p.y*n.height,y=n.y+Math.sin(r)*p.x*n.width+Math.cos(r)*p.y*n.height;
    ctx.save();ctx.globalAlpha=p.alpha*(options.artOpacity??1);ctx.fillStyle=p.color;
    if(p.kind==='smoke'){const gradient=ctx.createRadialGradient(x,y,0,x,y,size);gradient.addColorStop(0,p.color+'bb');gradient.addColorStop(1,p.color+'00');ctx.fillStyle=gradient;}
    ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}
