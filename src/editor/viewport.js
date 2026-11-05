const clamp=v=>Math.max(.5,Math.min(4,v));

/** Preserve the world point below the pointer while changing the local canvas scale. */
export function zoomAt(camera,next,x,y) {
  const zoom=clamp(next),ratio=zoom/camera.zoom;
  return {zoom,left:(camera.left+x)*ratio-x,top:(camera.top+y)*ratio-y};
}

export function createViewport({isEditing,onChange=()=>{}}) {
  const scroll=document.getElementById('map-scroll'),stage=document.getElementById('viewport'),workspace=document.getElementById('map-workspace');
  const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='offscreen-enabled';
  const label=document.createElement('label');label.append(toggle,document.createTextNode('画外工作区'));document.getElementById('zoom-fit').after(label);
  let zoom=1,space=false,pan=null,extended=false;
  const gutter=()=>extended?Math.max(600,scroll.clientWidth)*zoom:0;
  function layout(){const width=Math.max(600,scroll.clientWidth)*zoom;stage.style.width=width+'px';stage.style.left=(extended?width:0)+'px';workspace.style.width=width*(extended?3:1)+'px';workspace.dataset.offscreen=String(extended);document.getElementById('workspace-scene').hidden=!extended;}
  function setZoom(next,x=scroll.clientWidth/2,y=scroll.clientHeight/2){
    if(pan||document.querySelector('[data-dragging=true]'))return;
    const camera=zoomAt({zoom,left:scroll.scrollLeft,top:scroll.scrollTop},next,x,y);zoom=camera.zoom;
    layout();
    scroll.scrollLeft=camera.left;scroll.scrollTop=camera.top;
    document.getElementById('zoom-level').textContent=Math.round(zoom*100)+'%';stage.dataset.zoom=String(zoom);onChange();
  }
  function resize(){scroll.style.height=Math.max(600,scroll.clientWidth)*640/1200+'px';setZoom(zoom);}
  document.getElementById('zoom-in').onclick=()=>setZoom(zoom*1.25);
  document.getElementById('zoom-out').onclick=()=>setZoom(zoom/1.25);
  const fit=()=>{setZoom(1,0,0);scroll.scrollTo(gutter(),0);};
  document.getElementById('zoom-fit').onclick=fit;
  function sync(){const next=toggle.checked&&isEditing();toggle.disabled=!isEditing();if(next===extended)return;const before=gutter();extended=next;layout();scroll.scrollLeft+=gutter()-before;onChange();}
  toggle.onchange=sync;
  window.addEventListener('editor-workspace-mode',sync);
  window.addEventListener('editor-focus-world',e=>{
    if(!isEditing())return;const b=e.detail;
    if(b.x<0||b.x+b.width>1200){toggle.checked=true;sync();}
    const scale=stage.getBoundingClientRect().width/1200;
    scroll.scrollLeft=gutter()+(b.x+b.width/2)*scale-scroll.clientWidth/2;
    scroll.scrollTop=(b.y+b.height/2)*scale-scroll.clientHeight/2;
  });
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
  return {zoom:()=>zoom,fit};
}
