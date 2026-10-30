import {diagramBounds} from '../core/geometry.js';
import {eventSlots,connectWire} from './wire-creation.js';

const labels={click:'点击',contact:'碰到',enter:'走入区域',board:'登上电梯',arrive:'抵达出口',rotated:'旋转结束',supportlost:'失去支撑',supportfound:'获得支撑',landed:'落地',actorlanded:'主角落到上面',impact:'受到落物撞击',done:'行为完成'};
const eventLabel=(entity,slot)=>slot.type==='done'?(entity.behaviors.find(b=>b.id===slot.behavior)?.label??'行为')+'完成':labels[slot.type];
const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);return b;};
const center=el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};

/** Transient wiring interaction. Drafts change only after both slots are chosen. */
export function createWireUI({overlay,document:read,enabled,change,notify}) {
  let gesture=null,menu=null,skipClick=false;
  const preview=document.createElementNS('http://www.w3.org/2000/svg','svg');preview.classList.add('wire-drag-preview');
  const path=document.createElementNS(preview.namespaceURI,'path');preview.append(path);
  function cleanup(){
    preview.remove();menu?.remove();menu=null;delete overlay.dataset.wireActive;delete overlay.dataset.dragging;
    for(const el of overlay.querySelectorAll('[data-wire-candidate],[data-wire-ready]')){delete el.dataset.wireCandidate;delete el.dataset.wireReady;}
  }
  function release(id){if(id!=null&&overlay.hasPointerCapture(id))overlay.releasePointerCapture(id);}
  function cancel(){const active=Boolean(gesture||menu),id=gesture?.pointerId;gesture=null;cleanup();release(id);return active;}
  function targetAt(x,y){
    const area=overlay.closest('.map-scroll').getBoundingClientRect();if(x<area.left||x>area.right||y<area.top||y>area.bottom)return null;
    for(const hit of document.elementsFromPoint(x,y)){
      const port=hit.closest('[data-wire-entity]');if(port&&overlay.contains(port))return port.dataset.wireEntity;
      const object=hit.closest('.edit-object[data-ref^="entity:"]');if(object&&overlay.contains(object))return object.dataset.ref.slice(7);
    }
    let nearest=null,distance=18;
    for(const el of overlay.querySelectorAll('.edit-object[data-ref^="entity:"]')){
      const b=el.getBoundingClientRect(),d=Math.hypot(Math.max(b.left-x,0,x-b.right),Math.max(b.top-y,0,y-b.bottom));
      if(d<distance){distance=d;nearest=el.dataset.ref.slice(7);}
    }
    return nearest;
  }
  function mark(){
    const level=read();for(const el of overlay.querySelectorAll('.edit-object[data-ref^="entity:"]')){
      const entity=level.entities.find(e=>e.id===el.dataset.ref.slice(7));
      el.dataset.wireReady=String(gesture.direction==='output'?Boolean(entity.behaviors?.length):eventSlots(entity).length>0);
      el.dataset.wireCandidate=String(entity.id===gesture.target);
    }
  }
  function paint(x,y){
    if(!gesture)return;gesture.x=x;gesture.y=y;gesture.target=targetAt(x,y);mark();
    const origin=gesture.handle?.isConnected?center(gesture.handle):gesture.anchor,point={x,y},from=gesture.direction==='output'?origin:point,to=gesture.direction==='output'?point:origin;
    const bend=Math.max(45,Math.abs(to.x-from.x)*.4);
    preview.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);path.setAttribute('d',`M ${from.x} ${from.y} C ${from.x+bend} ${from.y}, ${to.x-bend} ${to.y}, ${to.x} ${to.y}`);
  }
  function start(event,spec,handle){
    if(!enabled()||event.button!==0)return;event.preventDefault();event.stopPropagation();cancel();
    gesture={...spec,handle,pointerId:event.pointerId,anchor:center(handle),startX:event.clientX,startY:event.clientY,moved:false};
    overlay.dataset.wireActive='true';overlay.dataset.dragging='true';document.body.append(preview);overlay.setPointerCapture(event.pointerId);paint(event.clientX,event.clientY);
  }
  function commit(on,target,behavior){
    cancel();let added=false,completed=false;
    change(level=>{added=connectWire(level,on,target,behavior);completed=true;});
    if(completed)notify(added?'已连接事件与行为。':'这两个槽已经连接。');
    overlay.focus({preventScroll:true});
  }
  function choose(spec,other,x,y){
    const level=read(),source=level.entities.find(e=>e.id===(spec.direction==='output'?spec.entity:other)),target=level.entities.find(e=>e.id===(spec.direction==='output'?other:spec.entity));
    if(!source||!target)return;
    const slots=eventSlots(source),behaviors=target.behaviors??[];
    if(spec.event&&behaviors.length===1){commit({source:source.id,...spec.event},target.id,behaviors[0].id);return;}
    const fixedBehavior=spec.direction==='input'?spec.behavior:null;
    if(slots.length===1&&(fixedBehavior||behaviors.length===1)){commit({source:source.id,...slots[0]},target.id,fixedBehavior??behaviors[0].id);return;}
    menu=document.createElement('div');menu.className='wire-connect-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','选择连线事件和行为');
    const title=document.createElement('strong');title.textContent=source.label+' → '+target.label;menu.append(title);
    let selected=spec.event??null;
    if(selected){const label=document.createElement('p');label.textContent='当「'+eventLabel(source,selected)+'」时';menu.append(label);}
    else{
      const select=document.createElement('select');select.id='wire-menu-event';select.setAttribute('aria-label','选择触发事件');
      const slotKey=slot=>slot.type+(slot.behavior?':'+slot.behavior:'');
      select.append(new Option('选择触发事件',''));slots.forEach(slot=>select.append(new Option(eventLabel(source,slot),slotKey(slot))));
      select.addEventListener('change',()=>{selected=slots.find(slot=>slotKey(slot)===select.value)??null;for(const b of menu.querySelectorAll('[data-wire-choose-behavior]'))b.disabled=!selected;});menu.append(select);
    }
    if(!behaviors.length){const empty=document.createElement('p');empty.textContent='目标还没有行为。请先在物体面板添加行为，再连接。';menu.append(empty);}
    for(const behavior of behaviors.filter(b=>!fixedBehavior||b.id===fixedBehavior)){
      const b=button('→ '+behavior.label,()=>commit({source:source.id,...selected},target.id,behavior.id));b.dataset.wireChooseBehavior=behavior.id;b.disabled=!selected;menu.append(b);
    }
    const close=button('取消 · Esc',()=>cancel());close.className='text-button';menu.append(close);document.body.append(menu);
    const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x+12))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-r.height-8,y+12))+'px';
    menu.querySelector('select,button:not([disabled])')?.focus({preventScroll:true});
  }
  function finish(other,x,y){const spec=gesture;gesture=null;cleanup();release(spec.pointerId);if(other)choose(spec,other,x,y);}
  function bind(handle,spec){
    handle.dataset.wireHandle='true';handle.draggable=false;handle.title='拖动连线，或点一下起点再点目标；Esc 取消';
    handle.addEventListener('pointerdown',event=>start(event,spec,handle));handle.addEventListener('click',event=>event.stopPropagation());
    handle.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key)||!enabled())return;event.preventDefault();event.stopPropagation();cancel();
      gesture={...spec,handle,anchor:center(handle),latched:true};overlay.dataset.wireActive='true';document.body.append(preview);paint(gesture.anchor.x,gesture.anchor.y);});
  }
  function render(level,{selection,wireTool}){
    overlay.querySelector('.wire-handles')?.remove();if(!enabled())return;
    const ports=document.createElement('div');ports.className='wire-handles';
    for(const entity of level.entities.filter(e=>wireTool||selection?.type==='entity'&&selection.id===e.id)){
      const b=diagramBounds(entity.kind,entity);
      for(const direction of ['input','output']){
        const port=button(direction==='output'?'●':'◇',()=>{});port.className='wire-entity-port '+direction;port.dataset.wireEntity=entity.id;port.dataset.wireDirection=direction;
        port.setAttribute('aria-label',entity.label+(direction==='output'?'：拖出事件连线':'：接入行为连线'));port.style.left=(direction==='output'?b.x+b.width:b.x)/12+'%';port.style.top=(b.y+b.height/2)/6.4+'%';
        bind(port,{entity:entity.id,direction});ports.append(port);
      }
    }
    overlay.append(ports);
  }
  function position(level){
    for(const port of overlay.querySelectorAll('[data-wire-entity]')){
      const entity=level.entities.find(e=>e.id===port.dataset.wireEntity);if(!entity)continue;const b=diagramBounds(entity.kind,entity);
      port.style.left=(port.dataset.wireDirection==='output'?b.x+b.width:b.x)/12+'%';port.style.top=(b.y+b.height/2)/6.4+'%';
    }
  }
  window.addEventListener('pointermove',event=>{if(!gesture||!enabled())return;if(gesture.pointerId!=null&&event.pointerId!==gesture.pointerId)return;
    if(Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>4)gesture.moved=true;paint(event.clientX,event.clientY);});
  window.addEventListener('pointerup',event=>{
    if(!gesture||gesture.latched||event.pointerId!==gesture.pointerId)return;skipClick=true;
    if(!gesture.moved){const id=gesture.pointerId;gesture.pointerId=null;gesture.latched=true;delete overlay.dataset.dragging;release(id);return;}
    finish(targetAt(event.clientX,event.clientY),event.clientX,event.clientY);
  });
  document.addEventListener('pointerdown',event=>{
    if(menu&&!menu.contains(event.target))cancel();
    if(!gesture?.latched)return;event.preventDefault();event.stopImmediatePropagation();skipClick=true;finish(targetAt(event.clientX,event.clientY),event.clientX,event.clientY);
  },true);
  document.addEventListener('click',event=>{if(!skipClick||event.detail===0)return;skipClick=false;event.preventDefault();event.stopImmediatePropagation();},true);
  document.addEventListener('keydown',event=>{if((gesture||menu)&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}},true);
  overlay.addEventListener('lostpointercapture',()=>{if(gesture&&!gesture.latched)cancel();});
  window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
  return {bind,render,position,cancel,active:()=>Boolean(gesture||menu)};
}
