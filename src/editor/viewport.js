const clamp=v=>Math.max(.5,Math.min(4,v));

/** Preserve the world point below the pointer while changing the local canvas scale. */
export function zoomAt(camera,next,x,y) {
  const zoom=clamp(next),ratio=zoom/camera.zoom;
  return {zoom,left:(camera.left+x)*ratio-x,top:(camera.top+y)*ratio-y};
}

export function createViewport({isEditing,onChange=()=>{}}) {
  const scroll=document.getElementById('map-scroll'),stage=document.getElementById('viewport');
  let zoom=1,space=false,pan=null;
  function setZoom(next,x=scroll.clientWidth/2,y=scroll.clientHeight/2){
    if(pan||document.querySelector('[data-dragging=true]'))return;
    const camera=zoomAt({zoom,left:scroll.scrollLeft,top:scroll.scrollTop},next,x,y);zoom=camera.zoom;
    stage.style.width=Math.max(600,scroll.clientWidth)*zoom+'px';
    scroll.scrollLeft=camera.left;scroll.scrollTop=camera.top;
    document.getElementById('zoom-level').textContent=Math.round(zoom*100)+'%';stage.dataset.zoom=String(zoom);onChange();
  }
  function resize(){scroll.style.height=Math.max(600,scroll.clientWidth)*640/1200+'px';setZoom(zoom);}
  document.getElementById('zoom-in').onclick=()=>setZoom(zoom*1.25);
  document.getElementById('zoom-out').onclick=()=>setZoom(zoom/1.25);
  document.getElementById('zoom-fit').onclick=()=>{setZoom(1,0,0);scroll.scrollTo(0,0);};
  document.getElementById('zoom-level').onclick=()=>setZoom(1);
  scroll.addEventListener('wheel',e=>{if(e.altKey)return;e.preventDefault();const b=scroll.getBoundingClientRect();setZoom(zoom*Math.exp(-Math.sign(e.deltaY)*.18),e.clientX-b.left,e.clientY-b.top);},{passive:false});
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&isEditing()&&!e.target.matches('input,textarea,select')&&!document.querySelector('dialog[open]')){space=true;scroll.dataset.hand='true';e.preventDefault();}},true);
  const stopSpace=()=>{space=false;delete scroll.dataset.hand;};
  document.addEventListener('keyup',e=>{if(e.code==='Space')stopSpace();});
  scroll.addEventListener('pointerdown',e=>{if(e.button!==1&&!(space&&e.button===0))return;e.preventDefault();e.stopImmediatePropagation();pan={id:e.pointerId,x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop};scroll.setPointerCapture(e.pointerId);scroll.dataset.panning='true';},true);
  scroll.addEventListener('pointermove',e=>{if(!pan||pan.id!==e.pointerId)return;scroll.scrollLeft=pan.left-(e.clientX-pan.x);scroll.scrollTop=pan.top-(e.clientY-pan.y);});
  const stopPan=()=>{if(!pan)return;const id=pan.id;pan=null;if(scroll.hasPointerCapture(id))scroll.releasePointerCapture(id);delete scroll.dataset.panning;};
  scroll.addEventListener('pointerup',stopPan);scroll.addEventListener('pointercancel',stopPan);scroll.addEventListener('lostpointercapture',stopPan);
  scroll.addEventListener('click',e=>{if(space||e.button===1){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('blur',()=>{stopSpace();stopPan();});new ResizeObserver(resize).observe(scroll);resize();
  return {zoom:()=>zoom,fit:()=>{setZoom(1,0,0);scroll.scrollTo(0,0);}};
}
