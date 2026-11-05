import {canDrag,placementAnchor,placementReceiver} from '../core/placement.js';
import {unprojectSpace} from '../core/spatial.js';

/** Gestures preview pixels; a released placement enters the fixed-tick input queue. */
export function createRuntimeDrag({overlay,viewport,session,paint,notify,click}){
  let gesture=null,suppress=false;
  const point=event=>{const b=viewport.getBoundingClientRect();return {x:(event.clientX-b.left)*1200/b.width,y:(event.clientY-b.top)*640/b.height};};
  function cancel(){
    if(!gesture)return;const id=gesture.pointer;gesture=null;delete overlay.dataset.dragging;
    if(overlay.hasPointerCapture(id))overlay.releasePointerCapture(id);
  }
  overlay.addEventListener('pointerdown',e=>{
    suppress=false;
    const {preview,level}=session(),source=e.target.closest('[data-source]')?.dataset.source,state=preview?.snapshot();
    if(e.button!==0||state?.status!=='running'||!canDrag(state,source))return;
    const p=point(e),anchor=placementAnchor(level,state.entities[source]);
    gesture={source,pointer:e.pointerId,start:{x:e.clientX,y:e.clientY},offset:{x:anchor.x-p.x,y:anchor.y-p.y},point:anchor,moved:false};
    e.preventDefault();overlay.setPointerCapture(e.pointerId);overlay.dataset.dragging='true';
  });
  overlay.addEventListener('pointermove',e=>{
    if(!gesture||gesture.pointer!==e.pointerId)return;
    const p=point(e);gesture.point={x:p.x+gesture.offset.x,y:p.y+gesture.offset.y};
    gesture.moved||=Math.hypot(e.clientX-gesture.start.x,e.clientY-gesture.start.y)>4;paint();
  });
  overlay.addEventListener('pointerup',e=>{
    if(!gesture||gesture.pointer!==e.pointerId)return;
    const g=gesture,{preview,level}=session(),state=preview?.snapshot(),p=point(e);
    g.point={x:p.x+g.offset.x,y:p.y+g.offset.y};cancel();suppress=true;
    if(g.moved&&state?.status==='running'){
      const receiver=placementReceiver(level,state,g.source,g.point),queued=preview.placeAt(g.source,g.point);
      notify(queued&&receiver?'放置已排队：'+receiver.label:'未放到接收点，已归位。');
    }else if(!g.moved&&state?.status==='running')click(g.source);
    paint();
  });
  overlay.addEventListener('click',e=>{if(suppress){suppress=false;e.preventDefault();e.stopImmediatePropagation();}},true);
  for(const event of ['pointercancel','lostpointercapture'])overlay.addEventListener(event,()=>{cancel();paint();});
  window.addEventListener('blur',()=>{cancel();paint();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){e.preventDefault();e.stopImmediatePropagation();suppress=true;cancel();paint();}},true);
  return {
    cancel,
    visualState(level,state){
      if(!gesture)return state;
      if(state.status!=='running'||!canDrag(state,gesture.source)){cancel();return state;}
      if(!gesture.moved)return state;
      const copy=structuredClone(state),e=copy.entities[gesture.source],p=gesture.point;
      if(level.spatial){const q=unprojectSpace(level,p,e.space.height);e.x=q.x;e.space.depth=q.depth;}
      else{e.x=p.x;e.y=p.y;}
      return copy;
    },
    drawTargets(ctx,level,state){
      if(!gesture?.moved)return;
      const entity=state.entities[gesture.source],selected=placementReceiver(level,state,gesture.source,gesture.point);
      ctx.save();ctx.lineWidth=2;ctx.setLineDash([5,4]);
      for(const id of entity.draggable.targets){const e=state.entities[id];if(!e?.dropTarget.enabled)continue;const p=placementAnchor(level,e);
        ctx.strokeStyle=selected?.id===id?'#e5bf6c':'#b8d7c5';ctx.fillStyle=selected?.id===id?'#e5bf6c33':'#b8d7c514';
        ctx.beginPath();ctx.arc(p.x,p.y,e.dropTarget.radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.restore();
    }
  };
}
