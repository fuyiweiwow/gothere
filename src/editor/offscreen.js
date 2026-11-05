import {SPATIAL_MOVE_X,projectSpace,spaceBounds,canPlaceOffscreen} from '../core/spatial.js';
import {artBounds} from '../render/resources.js';

export {canPlaceOffscreen} from '../core/spatial.js';

/** Include every authored state so a wider moving sprite also clears the camera. */
export function offscreenX(level,object,side,destination={}){
  if(!level.spatial||object?.kind!=='object'||object.passage)throw new Error('画外位置只适用于普通空间物体。');
  if(!['left','right'].includes(side))throw new Error('请选择左侧或右侧。');
  const space={...object.space};for(const [key,value] of Object.entries(destination))if(value!==undefined)space[key]=value;delete space.passage;delete space.progress;
  const positioned={...object,x:0,space};
  const snapshot={entities:{[object.id]:positioned}};
  const boxes=[spaceBounds(level,'object',positioned)];
  for(const node of level.scene?.nodes??[]){
    if(node.bind?.type!=='entity'||node.bind.id!==object.id)continue;
    for(const variant of [undefined,...Object.keys(node.variants??{})])boxes.push(artBounds(node,level,snapshot,{variant,animate:false}));
  }
  const left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x+b.width));
  const x=side==='left'?-24-right:1224-left;
  if(x<SPATIAL_MOVE_X.min||x>SPATIAL_MOVE_X.max-(object.width??28))throw new Error('图片超出画外移动范围，请先缩小图片或调整绑定偏移。');
  return Math.round(x*10)/10;
}

export function focusWorld(bounds){
  window.dispatchEvent(new CustomEvent('editor-focus-world',{detail:bounds}));
}

/** A temporary authoring overlay; only X changes, ownership and elevation stay explicit. */
export function pickMoveDestination(level,action,onPick){
  window.dispatchEvent(new Event('editor-cancel-destination'));
  const stage=document.getElementById('viewport'),target=level.entities.find(e=>e.id===action.target);
  const point=projectSpace(level,{x:action.x,depth:action.depth,height:action.height});
  focusWorld({x:point.x,y:point.y-40,width:target.width??28,height:44});
  const overlay=document.createElement('div');overlay.className='destination-picker';overlay.tabIndex=0;
  overlay.setAttribute('aria-label','点选移动目标 X，Esc 取消');
  const marker=document.createElement('div');marker.className='destination-marker';marker.style.top=point.y/6.4+'%';
  const hint=document.createElement('span');hint.textContent='点选目标水平位置 · Esc 取消';overlay.append(marker,hint);stage.append(overlay);
  const xAt=e=>{
    const b=stage.getBoundingClientRect(),screenX=(e.clientX-b.left)/b.width*1200;
    return Math.round(Math.max(SPATIAL_MOVE_X.min,Math.min(SPATIAL_MOVE_X.max-(target.width??28),screenX-level.spatial.projection.depthX*action.depth))*10)/10;
  };
  const paint=x=>{marker.style.left=(x+level.spatial.projection.depthX*action.depth+1200)/36+'%';marker.textContent='X '+x;};paint(action.x);
  const cancel=()=>{overlay.remove();document.removeEventListener('keydown',key,true);window.removeEventListener('editor-cancel-destination',cancel);};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}};
  overlay.onpointermove=e=>paint(xAt(e));overlay.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const x=xAt(e);cancel();onPick(x);};
  document.addEventListener('keydown',key,true);window.addEventListener('editor-cancel-destination',cancel);overlay.focus({preventScroll:true});
}
