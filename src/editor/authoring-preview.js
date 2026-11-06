import {createPreview} from '../app/preview.js';
import {drawScene} from '../render/scene.js';
import {drawSpatial} from '../render/spatial.js';
import {drawDiagram} from '../render/diagram.js';
import {loadResources,entityArtBounds} from '../render/resources.js';
import {createFeedbackPlayer} from '../render/feedback.js';
import {createSoundPlayer} from '../render/audio.js';
import {diagramBounds} from '../core/geometry.js';
import {spaceBounds} from '../core/spatial.js';
import {canDrag} from '../core/placement.js';
import {createRuntimeDrag} from '../shell/runtime-drag.js';

/** A disposable simulation result. It never applies to the document or writes a draft. */
export function createAuthoringPreview({root,onInspect=()=>{}}) {
  const $=id=>root.querySelector('#'+id),canvas=$('script-preview-canvas'),ctx=canvas.getContext('2d'),overlay=$('script-preview-targets');
  let level,preview,feedback,frame=0,previous=0,accumulator=0,endingTicks=0,loadTicket=0,selected=null,pendingRun=false;
  const labels={ready:'准备试玩',running:'运行中',paused:'已暂停',won:'已到达',lost:'失败'};
  const notice=text=>{$('script-preview-notice').textContent=text;};
  const sound=createSoundPlayer({notify:notice});sound.setMuted(true);
  const drag=createRuntimeDrag({overlay,viewport:$('script-preview-viewport'),session:()=>({level,preview}),paint:draw,notify:notice,
    click:id=>{if(clickable(id))preview.click(id);}});
  function clickable(id,state=preview?.snapshot()) {
    return state&&level.rules.some(rule=>rule.on.source===id&&rule.on.type==='click'&&(rule.if??[]).every(c=>Object.hasOwn(c,'holding')?state.actor.holding===c.holding:state.entities[c.entity]?.state===c.state));
  }
  function bounds(id,state,feedbackFrame) {
    const entity=state.entities[id];return ($('script-preview-view').value==='scene'?entityArtBounds(level,state,id,{feedback:feedbackFrame}):null)??(level.spatial?spaceBounds(level,entity.kind,entity):diagramBounds(entity.kind,entity));
  }
  function draw() {
    if(!preview)return;
    const actual=preview.snapshot(),state=drag.visualState(level,actual),logic=$('script-preview-view').value==='logic';
    const fx=actual.status==='ready'?null:feedback.sample(actual,{endingTicks,enabled:true,audible:$('script-preview-sound').checked});
    if(level.spatial)drawSpatial(ctx,level,state,{logic,animate:true,feedback:fx});
    else if(logic)drawDiagram(ctx,level,state);else drawScene(ctx,level,state,{animate:true,feedback:fx});
    drag.drawTargets(ctx,level,actual);
    if(selected&&actual.entities[selected]){const b=bounds(selected,actual,fx);ctx.save();ctx.strokeStyle='#f6d97b';ctx.lineWidth=4;ctx.strokeRect(b.x-3,b.y-3,b.width+6,b.height+6);ctx.restore();}
    for(const button of overlay.children) {
      const id=button.dataset.source,b=bounds(id,actual,fx),inspect=$('script-preview-inspect').checked;
      const usable=inspect||['ready','paused','running'].includes(actual.status)&&(clickable(id,actual)||actual.status==='running'&&canDrag(actual,id));
      Object.assign(button.style,{left:(b.x-4)/12+'%',top:(b.y-4)/6.4+'%',width:(b.width+8)/12+'%',height:Math.max(20,b.height+8)/6.4+'%',pointerEvents:usable?'auto':'none',zIndex:String(Math.max(1,1000-Math.round(b.width*b.height/100)))});
      button.disabled=!usable;button.title=actual.entities[id].label;
    }
    canvas.dataset.tick=String(actual.tick);canvas.dataset.status=actual.status;
    $('script-preview-status').textContent=`${labels[actual.status]} · ${(actual.tick/60).toFixed(2)} 秒${actual.reason?' · '+actual.reason:''}`;
    $('script-preview-run').textContent=actual.status==='running'?'Ⅱ 暂停':'▶ 运行';
    return fx;
  }
  function animate(time) {
    frame=0;if(!preview)return;
    const elapsed=previous?Math.min(100,time-previous):0;previous=time;
    const state=preview.snapshot();
    if(state.status==='running'){accumulator+=elapsed;const count=Math.floor(accumulator/(1000/60));if(count){preview.advance(count);accumulator-=count*1000/60;}}
    else if(['won','lost'].includes(state.status))endingTicks+=elapsed/(1000/60);
    const fx=draw(),status=preview.snapshot().status;
    if(status==='running'||['won','lost'].includes(status)&&fx&&!fx.tailFinished)frame=requestAnimationFrame(animate);
  }
  function start() {pendingRun=false;if(!preview)return;$('script-preview-inspect').checked=false;if(['won','lost'].includes(preview.snapshot().status))reset();preview.start();sound.setPaused(false);if($('script-preview-sound').checked)sound.unlock();previous=0;if(!frame)frame=requestAnimationFrame(animate);draw();}
  function pause() {pendingRun=false;preview?.pause();sound.setPaused(true);cancelAnimationFrame(frame);frame=0;previous=0;drag.cancel();draw();}
  function reset() {if(!preview)return;pause();preview.reset();feedback=createFeedbackPlayer(level,{onSound:e=>sound.play(e)});accumulator=0;endingTicks=0;sound.stop();draw();}
  $('script-preview-run').onclick=()=>{if(preview?.snapshot().status==='running')pause();else start();};
  $('script-preview-step').onclick=()=>{pause();if(preview){preview.step();draw();}};
  $('script-preview-reset').onclick=reset;
  $('script-preview-view').onchange=draw;
  $('script-preview-sound').onchange=()=>{sound.setMuted(!$('script-preview-sound').checked);if($('script-preview-sound').checked)sound.unlock();};
  $('script-preview-inspect').onchange=()=>{if($('script-preview-inspect').checked)pause();draw();};
  const hide=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hide);
  return {
    async show(definition,{run=false}={}) {
      this.clear();const ticket=++loadTicket;pendingRun=run;level=structuredClone(definition);preview=createPreview(level);feedback=createFeedbackPlayer(level,{onSound:e=>sound.play(e)});
      sound.setLevel(level);sound.setPaused(true);notice('临时结果 · 尚未应用到画布');
      for(const entity of level.entities) {
        const button=document.createElement('button');button.type='button';button.dataset.source=entity.id;button.className='scene-target';button.setAttribute('aria-label',entity.label);
        button.onclick=()=>{if($('script-preview-inspect').checked){selected=entity.id;onInspect(entity.id);draw();}else if(clickable(entity.id)){preview.click(entity.id);draw();}};overlay.append(button);
      }
      canvas.dataset.assets='loading';draw();await loadResources(level);if(ticket!==loadTicket)return;
      canvas.dataset.assets='ready';draw();if(pendingRun)start();
    },
    clear(){loadTicket++;pause();preview=null;level=null;selected=null;overlay.replaceChildren();sound.stop();endingTicks=0;accumulator=0;},
    pause,
    select(id){selected=id;draw();},
  };
}
