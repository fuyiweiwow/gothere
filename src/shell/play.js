import {createCommuteChapter} from '../editor/commute-chapter.js';
import {createPaintedBusStopLevel} from '../editor/painted-bus-stop.js';
import {createPreview} from '../app/preview.js';
import {drawSpatial} from '../render/spatial.js';
import {loadResources,entityArtBounds} from '../render/resources.js';
import {spaceBounds} from '../core/spatial.js';
import {createFeedbackPlayer} from '../render/feedback.js';
import {createSoundPlayer} from '../render/audio.js';
import {canDrag} from '../core/placement.js';
import {createRuntimeDrag} from './runtime-drag.js';
import {PLAY_STYLE,PLAY_MARKUP} from './play-view.js';

/** The published level uses the editor's simulation, resources and input queue.
 * It never reads drafts or exposes editing, timing advice or debug panels. */
export async function startPlay(){
  const settings=document.getElementById('standalone-play');
  const sample=new URLSearchParams(location.search).get('sample')??(settings?JSON.parse(settings.textContent||'{}').sample:undefined);
  const paintedBus=sample==='painted-bus-stop';
  if(settings)settings.textContent=JSON.stringify(paintedBus?{sample}:{});
  const portable=settings?'<!doctype html>\n'+document.documentElement.outerHTML:null;
  document.title='一定要到达那里 · 试玩';document.body.className='';
  document.body.removeAttribute('data-display');document.body.innerHTML=PLAY_MARKUP;
  const style=document.createElement('style');style.textContent=PLAY_STYLE;document.head.append(style);
  const $=id=>document.getElementById(id),canvas=$('play-canvas'),ctx=canvas.getContext('2d'),overlay=$('play-targets');
  const level=paintedBus?createPaintedBusStopLevel():createCommuteChapter(),preview=createPreview(level),sound=createSoundPlayer({notify:message=>{$('play-status').textContent=message;}});
  let endingTicks=0,accumulator=0,previous=0,frame=0,loaded=false,muted=false,tailPaused=false;
  const feedback=createFeedbackPlayer(level,{onSound:event=>sound.play(event)});sound.setLevel(level);
  const drag=createRuntimeDrag({overlay,viewport:$('play-stage'),session:()=>({level,preview}),paint:draw,notify:()=>{},click});
  function clickable(id,state){return state.status==='running'&&level.rules.some(r=>r.on.type==='click'&&r.on.source===id&&(r.if??[]).every(c=>Object.hasOwn(c,'holding')?state.actor.holding===c.holding:state.entities[c.entity]?.state===c.state));}
  function click(id){if(clickable(id,preview.snapshot())){preview.click(id);draw();}}
  for(const entity of level.entities.filter(e=>e.draggable||level.rules.some(r=>r.on.type==='click'&&r.on.source===e.id))){
    const button=document.createElement('button');button.type='button';button.dataset.source=entity.id;
    button.setAttribute('aria-label',entity.label);button.addEventListener('click',()=>click(entity.id));overlay.append(button);
  }
  function draw(){
    const state=preview.snapshot(),fx=state.status==='ready'?null:feedback.sample(state,{endingTicks,audible:!muted});
    drawSpatial(ctx,level,drag.visualState(level,state),{logic:false,animate:true,feedback:fx});
    drag.drawTargets(ctx,level,state,{nearOnly:true});
    canvas.dataset.status=state.status;canvas.dataset.tick=String(state.tick);canvas.dataset.feedbackEnded=String(fx?.tailFinished??true);
    for(const button of overlay.children){
      const id=button.dataset.source,e=state.entities[id],draggable=state.status==='running'&&canDrag(state,id),usable=clickable(id,state)||draggable;
      const b=entityArtBounds(level,state,id,{feedback:fx})??spaceBounds(level,e.kind,e);
      button.disabled=!usable;button.dataset.draggable=String(draggable);
      Object.assign(button.style,{left:(b.x-4)/12+'%',top:(b.y-4)/6.4+'%',width:(b.width+8)/12+'%',height:Math.max(24,b.height+8)/6.4+'%',pointerEvents:usable?'auto':'none',zIndex:String(Math.max(1,1000-Math.round(b.width*b.height/100)))});
    }
    const finished=['lost','won'].includes(state.status),covered=state.status==='ready'||state.status==='paused'||finished&&fx?.tailFinished;
    $('play-cover').hidden=!covered;
    $('play-message').textContent=state.status==='won'?'到了。':state.status==='lost'?'再试一次。':state.status==='paused'?'歇一会儿':'一定要到达那里';
    $('play-start').textContent=!loaded?'加载中…':state.status==='paused'?'继续':finished?'再来一次':'出发';
    $('play-start').disabled=!loaded;$('play-restart').disabled=!loaded||state.status==='ready';
    $('play-pause').disabled=!loaded||!['paused','running'].includes(state.status);$('play-pause').textContent=state.status==='paused'?'继续':'暂停';
    const label=state.status==='won'?'已到达':state.status==='lost'?'请再试一次':state.status==='paused'?'已暂停':state.status==='ready'?'准备出发':'赶路中';
    if($('play-status').textContent!==label)$('play-status').textContent=label;return fx;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(animate);}
  function animate(time){
    frame=0;const elapsed=previous?Math.min(100,time-previous):0;previous=time;const state=preview.snapshot();
    if(state.status==='running'){accumulator+=elapsed;const count=Math.floor(accumulator/(1000/60));if(count){preview.advance(count);accumulator-=count*1000/60;}}
    else if(['lost','won'].includes(state.status)&&!tailPaused)endingTicks=Math.min(960,endingTicks+elapsed*60/1000);
    const fx=draw(),status=preview.snapshot().status;
    if(status==='running'||['lost','won'].includes(status)&&!tailPaused&&!fx.tailFinished)schedule();
  }
  function reset(){drag.cancel();preview.reset();feedback.reset();endingTicks=0;accumulator=0;previous=0;tailPaused=false;sound.stop();}
  function start(){if(!loaded)return;if(['lost','won'].includes(preview.snapshot().status))reset();preview.start();sound.setPaused(false);if(!muted)sound.unlock();previous=0;draw();schedule();}
  function pause(){if(preview.snapshot().status==='running'){preview.pause();drag.cancel();sound.setPaused(true);previous=0;draw();}}
  $('play-start').onclick=start;$('play-pause').onclick=()=>{if(preview.snapshot().status==='running')pause();else start();};
  $('play-restart').onclick=()=>{if(loaded){reset();start();}};
  $('play-sound').onclick=()=>{muted=!muted;sound.setMuted(muted);$('play-sound').textContent=muted?'声音：关':'声音：开';$('play-sound').setAttribute('aria-pressed',String(!muted));if(!muted&&preview.snapshot().status==='running')sound.unlock();};
  window.addEventListener('keydown',e=>{
    if(e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.key.toLowerCase()==='r'){e.preventDefault();if(loaded){reset();start();}}
    else if(e.key==='Escape'||e.code==='Space'&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='A'){e.preventDefault();if(preview.snapshot().status==='running')pause();else if(preview.snapshot().status==='paused')start();}
  });
  function background(){pause();if(['lost','won'].includes(preview.snapshot().status)){tailPaused=true;sound.setPaused(true);previous=0;}}
  function foreground(){if(tailPaused){tailPaused=false;previous=0;sound.setPaused(false);schedule();}}
  window.addEventListener('blur',background);window.addEventListener('focus',foreground);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)background();else foreground();});
  new ResizeObserver(()=>{const scale=Math.max(1,Math.min(3,canvas.clientWidth/1200*(devicePixelRatio||1)));canvas.width=Math.round(1200*scale);canvas.height=Math.round(640*scale);ctx.setTransform(canvas.width/1200,0,0,canvas.height/640,0,0);draw();}).observe(canvas);
  const download=$('play-download');let downloadURL;
  if(portable){downloadURL=URL.createObjectURL(new Blob([portable],{type:'text/html;charset=utf-8'}));download.href=downloadURL;}
  else if(location.protocol!=='file:')download.href=paintedBus?'gothere-painted-bus.html':'gothere-play.html';else download.hidden=true;
  window.addEventListener('pagehide',()=>{sound.stop();if(downloadURL)URL.revokeObjectURL(downloadURL);},{once:true});
  canvas.dataset.assets='loading';draw();
  try{await loadResources(level);loaded=true;canvas.dataset.assets='ready';draw();}
  catch(error){canvas.dataset.assets='error';$('play-message').textContent='画面未能加载，请重新打开';$('play-start').textContent='加载失败';console.error('Unable to load play resources:',error);}
}
