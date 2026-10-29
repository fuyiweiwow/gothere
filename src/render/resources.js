import {ASSETS} from '../content/library.js';
import {floorY} from '../core/schema.js';

const images=new Map();
export function assetLibrary(level) {return [...ASSETS,...(level.scene?.assets??[])];}
export function boundObject(node,level,snapshot) {
  const b=node.bind;if(!b)return null;
  if(b.type==='entity')return snapshot?.entities[b.id]??level.entities.find(e=>e.id===b.id);
  if(b.type==='platform')return level.platforms[b.index];
  return b.type==='actor'?(snapshot?.actor??level.actor):level.goal;
}

/** A pure visual transform sampled from actual logical geometry, never the other way around. */
export function artTransform(node,level,snapshot,{tick=snapshot?.tick??0,animate=true,variant}={}) {
  const object=boundObject(node,level,snapshot),state=variant??object?.state;
  const variantData=node.variants?.[state],n={...node,...variantData};
  let x=n.x,y=n.y,rotation=n.rotation??0;
  if(object){
    const angle=object.pose?.angle??0,r=angle*Math.PI/180,pivot=(object.width??28)*(object.pose?.pivot??0);
    x=object.x+pivot+(n.x-pivot)*Math.cos(r)-n.y*Math.sin(r);
    y=floorY(object)+(n.x-pivot)*Math.sin(r)+n.y*Math.cos(r);rotation+=angle;
  }
  const frames=variantData?.asset?variantData.animation?.frames:n.animation?.frames,frame=animate?Math.floor(tick*(n.animation?.fps??1)/60):0;
  return {...n,x,y,rotation,asset:frames?.[frame%frames.length]??n.asset,
    flipX:Boolean(n.flipX)!==Boolean(n.flipWithDirection&&object?.direction===-1)};
}

export function artBounds(node,level,snapshot,options) {
  const n=artTransform(node,level,snapshot,options),r=n.rotation*Math.PI/180,C=Math.cos(r),S=Math.sin(r);
  const corners=[[0,0],[n.width,0],[n.width,n.height],[0,n.height]].map(([x,y])=>({x:n.x+x*C-y*S,y:n.y+x*S+y*C}));
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}

export function entityArtBounds(level,snapshot,id) {
  const boxes=(level.scene?.nodes??[]).filter(n=>n.bind?.type==='entity'&&n.bind.id===id&&artTransform(n,level,snapshot).visible!==false).map(n=>artBounds(n,level,snapshot));
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
    const n=artTransform(node,level,snapshot,{...options,variant:options.previewVariant?.id===node.id?options.previewVariant.state:undefined});if(n.visible===false)continue;
    const image=assetImage(library.get(n.asset));ctx.save();ctx.translate(n.x,n.y);ctx.rotate(n.rotation*Math.PI/180);ctx.globalAlpha=n.opacity??1;
    if(n.flipX){ctx.translate(n.width,0);ctx.scale(-1,1);}
    if(image&&n.tile){ctx.beginPath();ctx.rect(0,0,n.width,n.height);ctx.clip();for(let y=0;y<n.height;y+=n.tile.height)for(let x=0;x<n.width;x+=n.tile.width)ctx.drawImage(image,x,y,n.tile.width,n.tile.height);}
    else if(image)ctx.drawImage(image,0,0,n.width,n.height);
    else{ctx.fillStyle='#59727d';ctx.fillRect(0,0,n.width,n.height);ctx.strokeStyle='#a1beb8';ctx.strokeRect(0,0,n.width,n.height);}
    ctx.restore();
  }
}
