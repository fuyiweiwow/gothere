import {artTransform} from '../render/resources.js';
import {pruneFeedback} from '../core/feedback-schema.js';
import {unprojectSpace,isLayered} from '../core/spatial.js';

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
  if(node.anchor&&isLayered(level)){target.x=clamp(n.x+dx,-2400,3600);target.y=clamp(n.y+dy,-1280,1920);return;}
  if(node.ground||node.anchor){const p=node.ground??node.anchor,delta=unprojectSpace(level,{x:dx,y:level.spatial.projection.originY+dy},0);
    p.x=clamp(p.x+delta.x,0,1200-(node.ground?.width??0));p.depth=clamp(p.depth+delta.depth,0,600-(node.ground?.depthSize??0));return;}
  target.x=clamp(n.x+dx*Math.cos(rotation)+dy*Math.sin(rotation),-2400,3600);
  target.y=clamp(n.y-dx*Math.sin(rotation)+dy*Math.cos(rotation),-1280,1920);
}
export function resizeArt(level,id,handle,dx,dy,variant='') {
  const {node,n,target}=editTransform(level,id,variant),r=artTransform(node,level,undefined,{variant}).rotation*Math.PI/180;
  if(node.ground){const g=node.ground,delta=unprojectSpace(level,{x:dx,y:level.spatial.projection.originY+dy},0),endX=g.x+g.width,endD=g.depth+g.depthSize;
    if(handle.includes('w')){g.x=clamp(g.x+delta.x,0,endX-1);g.width=endX-g.x;}else g.width=clamp(g.width+delta.x,1,1200-g.x);
    if(handle.includes('n')){g.depth=clamp(g.depth+delta.depth,0,endD-1);g.depthSize=endD-g.depth;}else g.depthSize=clamp(g.depthSize+delta.depth,1,600-g.depth);return;}
  const localX=dx*Math.cos(r)+dy*Math.sin(r),localY=-dx*Math.sin(r)+dy*Math.cos(r);
  const w=clamp(n.width+(handle.includes('w')?-localX:handle.includes('e')?localX:0),1,2400);
  const h=clamp(n.height+(handle.includes('n')?-localY:handle.includes('s')?localY:0),1,1920);
  const offsetX=handle.includes('w')?n.width-w:0,offsetY=handle.includes('n')?n.height-h:0;
  moveArt(level,id,offsetX*Math.cos(r)-offsetY*Math.sin(r),offsetX*Math.sin(r)+offsetY*Math.cos(r),variant);target.width=w;target.height=h;
}
export function deleteArt(level,id) {level.scene.nodes=level.scene.nodes.filter(n=>n.id!==id);pruneFeedback(level);}
export function duplicateArt(level,id) {const n=structuredClone(level.scene.nodes.find(n=>n.id===id));let i=1;while(level.scene.nodes.some(n=>n.id==='art-'+i))i++;n.id='art-'+i;n.label=n.label.slice(0,57)+' 副本';n.x+=12;n.y+=12;level.scene.nodes.push(n);
  for(const f of [...(level.scene.feedback??[])].filter(f=>f.target===id)){let j=1;while(level.scene.feedback.some(s=>s.id==='feedback-'+j))j++;level.scene.feedback.push({...structuredClone(f),id:'feedback-'+j,target:n.id});}return n.id;}

export function bindArt(level,id,bind) {
  const n=level.scene.nodes.find(n=>n.id===id),before=artTransform(n,level,undefined,{variant:''});
  if(n.ground){n.width=before.width;n.height=before.height;}
  delete n.anchor;delete n.ground;
  delete n.fitPassage;
  delete n.passageView;
  if(bind)n.bind=bind;else delete n.bind;
  const origin=artTransform({...n,x:0,y:0,rotation:0},level,undefined,{variant:''}),r=origin.rotation*Math.PI/180,dx=before.x-origin.x,dy=before.y-origin.y;
  n.x=dx*Math.cos(r)+dy*Math.sin(r);n.y=-dx*Math.sin(r)+dy*Math.cos(r);n.rotation=before.rotation-origin.rotation;
}
