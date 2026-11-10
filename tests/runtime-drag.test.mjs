import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeDrag} from '../src/shell/runtime-drag.js';
import {createScooterLevel} from '../src/editor/scooter-level.js';
import {createPreview} from '../src/app/preview.js';

function harness(level=createScooterLevel()){
  const previous=globalThis.window,host=new EventTarget();globalThis.window=host;
  const overlay=new EventTarget(),captured=new Set();overlay.dataset={};
  overlay.setPointerCapture=id=>captured.add(id);overlay.hasPointerCapture=id=>captured.has(id);overlay.releasePointerCapture=id=>captured.delete(id);
  const viewport={getBoundingClientRect:()=>({left:20,top:30,width:600,height:320})};
  const preview=createPreview(level);preview.start();
  const drag=createRuntimeDrag({overlay,viewport,session:()=>({level,preview}),paint:()=>{},notify:()=>{},click:()=>{}});
  const event=(type,x,y)=>{const e=new Event(type,{cancelable:true});
    Object.assign(e,{clientX:20+x/2,clientY:30+y/2,pointerId:1,button:0});
    if(type==='pointerdown')Object.defineProperty(e,'target',{value:{closest:()=>({dataset:{source:'barrier'}})}});
    overlay.dispatchEvent(e);return e;};
  const circles=[];const ctx={save(){},restore(){},setLineDash(){},beginPath(){},arc(...args){circles.push(args);},fill(){},stroke(){}};
  return {level,preview,drag,overlay,host,captured,event,ctx,circles,restore(){drag.cancel();if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}};
}

test('near a receiver the dragged preview matches the eventual snapped location without mutating gameplay',()=>{
  const h=harness();try{
    const before=h.preview.snapshot();
    h.event('pointerdown',280,470);h.event('pointermove',880,470);
    const view=h.drag.visualState(h.level,h.preview.snapshot());
    assert.equal(view.entities.barrier.x,842);assert.equal(view.entities.barrier.space.depth,130);
    assert.deepEqual(h.preview.snapshot(),before);
    h.event('pointerup',880,470);h.preview.advance(1);
    assert.equal(h.preview.snapshot().entities.barrier.x,view.entities.barrier.x);
    assert.equal(h.overlay.dataset.dragging,undefined);assert.equal(h.captured.size,0);
  }finally{h.restore();}
});

test('cross-plane snap previews use the receiver plane and height while preserving item dimensions',()=>{
  const l=createScooterLevel();l.spatial.planes.push({id:'back',label:'back',depth:210,order:-1});
  Object.assign(l.entities.find(e=>e.id==='gap').space,{plane:'back',depth:210,height:12});
  const h=harness(l);try{
    h.event('pointerdown',260,490);h.event('pointermove',855,398);
    const view=h.drag.visualState(l,h.preview.snapshot()).entities.barrier;
    assert.equal(view.space.plane,'back');assert.equal(view.space.height,12);assert.equal(view.space.depth,210);
    assert.equal(view.width,70);assert.equal(view.space.depthSize,24);
    h.event('pointerup',855,398);h.preview.advance(1);
    assert.deepEqual(h.preview.snapshot().entities.barrier.space,view.space);
  }finally{h.restore();}
});

test('formal play only reveals a receiver when the item is actually within its accepted area',()=>{
  const h=harness();try{
    h.drag.drawTargets(h.ctx,h.level,h.preview.snapshot(),{nearOnly:true});assert.equal(h.circles.length,0);
    h.event('pointerdown',260,490);h.event('pointermove',400,490);
    h.drag.drawTargets(h.ctx,h.level,h.preview.snapshot(),{nearOnly:true});assert.equal(h.circles.length,0);
    h.drag.drawTargets(h.ctx,h.level,h.preview.snapshot());assert.equal(h.circles.length,1,'editor preview keeps its receiver guides');h.circles.length=0;
    h.event('pointermove',850,490);h.drag.drawTargets(h.ctx,h.level,h.preview.snapshot(),{nearOnly:true});
    assert.equal(h.circles.length,1);assert.equal(h.circles[0][0],842);
    h.preview.pause();h.drag.visualState(h.level,h.preview.snapshot());
    assert.equal(h.overlay.dataset.dragging,undefined);assert.equal(h.captured.size,0);
  }finally{h.restore();}
});

test('a receiver closing during the gesture stops snapping and the next tick rejects the original input',()=>{
  const l=createScooterLevel();l.rules.push({on:{source:'barrier',type:'click'},actions:[{type:'enable',target:'gap',capability:'dropTarget',enabled:false}]});
  const h=harness(l);try{
    h.event('pointerdown',260,490);h.event('pointermove',855,490);
    assert.equal(h.drag.visualState(l,h.preview.snapshot()).entities.barrier.x,842);
    h.preview.click('barrier');h.preview.advance(1);
    assert.equal(h.drag.visualState(l,h.preview.snapshot()).entities.barrier.x,855);
    h.event('pointerup',855,490);h.preview.advance(1);
    assert.equal(h.preview.snapshot().entities.barrier.x,260);
    assert.ok(h.preview.snapshot().signals.some(s=>s.event==='droprejected'));
  }finally{h.restore();}
});

test('escape cancels a drag without pausing gameplay or submitting a placement',()=>{
  const h=harness();try{
    const before=h.preview.snapshot();h.event('pointerdown',260,490);h.event('pointermove',842,490);
    const escape=new Event('keydown',{cancelable:true});Object.assign(escape,{key:'Escape'});h.host.dispatchEvent(escape);
    assert.equal(escape.defaultPrevented,true);h.event('pointerup',842,490);
    assert.deepEqual(h.preview.snapshot(),before);assert.equal(h.captured.size,0);
    h.preview.advance(1);assert.equal(h.preview.snapshot().entities.barrier.x,260);
  }finally{h.restore();}
});
