import {artTransform} from '../render/resources.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function ensureScene(level) {return level.scene??={background:'#182044',assets:[],nodes:[]};}
export function addArt(level,asset,x,y) {
  const scene=ensureScene(level);if(scene.nodes.length>=600)throw new Error('资源图层已满（600）。');
  let serial=1;while(scene.nodes.some(n=>n.id==='art-'+serial))serial++;
  const scale=Math.min(1,150/Math.max(asset.width,asset.height));
  const node={id:'art-'+serial,label:asset.label,asset:asset.id,x,y,width:Math.round(asset.width*scale),height:Math.round(asset.height*scale),layer:10};scene.nodes.push(node);return node.id;
}
function editTransform(level,id,variant) {
  const node=level.scene.nodes.find(n=>n.id===id);
  const n={...node,...node.variants?.[variant]};
  const target=variant?((node.variants??={})[variant]??={}):node;
  return {node,n,target};
}
export function moveArt(level,id,dx,dy,variant='') {
  const {node,n,target}=editTransform(level,id,variant),rotation=(artTransform(node,level,undefined,{variant}).rotation-(n.rotation??0))*Math.PI/180;
  target.x=clamp(n.x+dx*Math.cos(rotation)+dy*Math.sin(rotation),-2400,3600);
  target.y=clamp(n.y-dx*Math.sin(rotation)+dy*Math.cos(rotation),-1280,1920);
}
export function resizeArt(level,id,handle,dx,dy,variant='') {
  const {node,n,target}=editTransform(level,id,variant),r=artTransform(node,level,undefined,{variant}).rotation*Math.PI/180;
  const localX=dx*Math.cos(r)+dy*Math.sin(r),localY=-dx*Math.sin(r)+dy*Math.cos(r);
  const w=clamp(n.width+(handle.includes('w')?-localX:handle.includes('e')?localX:0),1,2400);
  const h=clamp(n.height+(handle.includes('n')?-localY:handle.includes('s')?localY:0),1,1920);
  const offsetX=handle.includes('w')?n.width-w:0,offsetY=handle.includes('n')?n.height-h:0;
  moveArt(level,id,offsetX*Math.cos(r)-offsetY*Math.sin(r),offsetX*Math.sin(r)+offsetY*Math.cos(r),variant);target.width=w;target.height=h;
}
export function deleteArt(level,id) {level.scene.nodes=level.scene.nodes.filter(n=>n.id!==id);}
export function duplicateArt(level,id) {const n=structuredClone(level.scene.nodes.find(n=>n.id===id));let i=1;while(level.scene.nodes.some(n=>n.id==='art-'+i))i++;n.id='art-'+i;n.label=n.label.slice(0,57)+' 副本';n.x+=12;n.y+=12;level.scene.nodes.push(n);return n.id;}

export function bindArt(level,id,bind) {
  const n=level.scene.nodes.find(n=>n.id===id),before=artTransform(n,level,undefined,{variant:''});
  if(bind)n.bind=bind;else delete n.bind;
  const origin=artTransform({...n,x:0,y:0,rotation:0},level,undefined,{variant:''}),r=origin.rotation*Math.PI/180,dx=before.x-origin.x,dy=before.y-origin.y;
  n.x=dx*Math.cos(r)+dy*Math.sin(r);n.y=-dx*Math.sin(r)+dy*Math.cos(r);n.rotation=before.rotation-origin.rotation;
}
