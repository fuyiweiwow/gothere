import { createEditorUI } from '../editor/ui.js';
import {createFirstLevel} from '../editor/first-level.js';
import { createPreview } from '../app/preview.js';
import { drawDiagram } from '../render/diagram.js';
import { eventTypes } from '../core/schema.js';
import { diagramBounds } from '../core/geometry.js';
import {drawScene} from '../render/scene.js';
import {presentationBounds,recoveryTicks} from '../render/presentation.js';
import {createResourceUI} from '../editor/resource-ui.js';
import {loadResources,entityArtBounds} from '../render/resources.js';
import {createFirstScene} from '../editor/first-scene.js';
import {createViewport} from '../editor/viewport.js';
import {createBindingUI} from '../editor/binding-ui.js';
import {createFeedbackPlayer} from '../render/feedback.js';
import {createSoundPlayer} from '../render/audio.js';
import {createSpatialLevel} from '../editor/spatial-level.js';
import {createCommuteLevel} from '../editor/commute-level.js';
import {createStreetLevel} from '../editor/street-level.js';
import {createBusStopLevel} from '../editor/bus-stop-level.js';
import {createTowStreetLevel} from '../editor/tow-street-level.js';
import {createCrosswalkLevel} from '../editor/crosswalk-level.js';
import {createScooterLevel} from '../editor/scooter-level.js';
import {createCommuteChapter} from '../editor/commute-chapter.js';
import {createTemplatePractice} from '../editor/template-catalog.js';
import {createLayeredLevel} from '../editor/layered-level.js';
import {drawSpatial} from '../render/spatial.js';
import {spaceBounds} from '../core/spatial.js';
import {canDrag} from '../core/placement.js';
import {createRuntimeDrag} from './runtime-drag.js';
import {parseDSL} from '../editor/dsl.js';
import {createAuthoringUI} from '../editor/authoring-ui.js';

const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');
const params=new URLSearchParams(location.search),spatialEntry=!params.has('legacy');
const templateEntry=params.get('sample')==='templates';
const chapterEntry=(!params.has('sample')&&!params.has('spatial'))||params.get('sample')==='chapter';
const scooterEntry=params.get('sample')==='scooter';
const crossEntry=params.get('sample')==='crosswalk';
const towEntry=params.get('sample')==='tow-street';
const graybox=params.get('sample')==='graybox',busStop=params.get('sample')==='bus-stop';
const oldSpatial=params.has('spatial')||params.get('sample')==='spatial-commute',layeredDemo=params.get('sample')==='layered';
const layeredEntry=spatialEntry&&!graybox&&!oldSpatial;
const sample=spatialEntry?(chapterEntry?createCommuteChapter:scooterEntry?createScooterLevel:crossEntry?createCrosswalkLevel:towEntry?createTowStreetLevel:templateEntry?()=>createTemplatePractice('template-practice'):graybox?createSpatialLevel:oldSpatial?createCommuteLevel:layeredDemo?createLayeredLevel:busStop?createBusStopLevel:createStreetLevel):createFirstLevel;
const sampleKey=spatialEntry?(chapterEntry?'commute:chapter:04':scooterEntry?'commute:scooter:01':crossEntry?'commute:crosswalk:01':towEntry?'commute:tow-street:01':templateEntry?'templates:practice:01':graybox?'spatial:01':oldSpatial?'commute:spatial:01':layeredDemo?'layered:graybox:01':busStop?'commute:bus-stop:03':'commute:layered:02'):'milestone:02:v017';
const standaloneHTML=document.getElementById('standalone-editor')?'<!doctype html>\n'+document.documentElement.outerHTML:null;
let editor,resourceUI,bindingUI,authoringUI,lastDraft,loadSerial=0,preview=null,previewLevel=null,accumulator=0,last=0,debugLast=0,toastTimer,serial=0;
let feedback=null,feedbackFrame=null,audition=null,endingTicks=0;
const sound=createSoundPlayer({notify,onPlay:()=>{canvas.dataset.audioPlayed=String(Number(canvas.dataset.audioPlayed??0)+1);}});
const runtimeDrag=createRuntimeDrag({overlay:$('scene-interactions'),viewport:$('viewport'),session:()=>({preview,level:previewLevel}),
  paint:()=>{if(preview)draw(previewLevel,preview.snapshot());},notify,
  click:source=>{if(canClick(source,preview.snapshot())&&preview.click(source))notify('点击已排队：'+preview.snapshot().entities[source].label);}});
let displayMode='scene';
try{displayMode=localStorage.getItem('gothere.studio.display')??'scene';}catch{}
if(!['logic','scene','binding'].includes(displayMode))displayMode='scene';
$('display-mode').value=displayMode;
$('animation-toggle').checked=!matchMedia('(prefers-reduced-motion: reduce)').matches;
function draw(level,state){
  if(!state){runtimeDrag.cancel();lastDraft=level;}
  const actualState=state;if(state)state=runtimeDrag.visualState(level,state);
  feedbackFrame=state&&feedback?state.status==='ready'?null:feedback.sample(state,{endingTicks,enabled:$('animation-toggle').checked,audible:$('sound-toggle').checked}):
    audition?audition.player.sample({tick:Math.floor(audition.tick),status:'running',signals:[]},{enabled:$('animation-toggle').checked,audible:$('sound-toggle').checked}):null;
  canvas.dataset.feedbackActive=String(feedbackFrame?.active??0);canvas.dataset.feedbackParticles=String(feedbackFrame?.particles.length??0);canvas.dataset.feedbackEnded=String(feedbackFrame?.tailFinished??true);
  canvas.dataset.view=displayMode;
  const wing=$('workspace-scene');
  if(!wing.hidden&&!state){const scale=canvas.width/1200;if(wing.width!==canvas.width*3||wing.height!==canvas.height){wing.width=canvas.width*3;wing.height=canvas.height;}const w=wing.getContext('2d');w.setTransform(scale,0,0,scale,1200*scale,0);w.clearRect(-1200,0,3600,640);
    const options={logic:displayMode==='logic',animate:false,hiddenLayers:resourceUI?.hiddenLayers(),previewVariant:resourceUI?.variant(),artOpacity:displayMode==='binding'?Number($('calibration-art-opacity').value):1};
    if(level.spatial)drawSpatial(w,level,null,options);else if(displayMode==='logic')drawDiagram(w,level);else drawScene(w,level,null,options);
  }
  if(level.spatial)drawSpatial(ctx,level,state,{logic:displayMode==='logic',animate:$('animation-toggle').checked,hiddenLayers:state?null:resourceUI?.hiddenLayers(),previewVariant:state?null:resourceUI?.variant(),
    feedback:feedbackFrame,previewTarget:state?null:audition?.target,artOpacity:displayMode==='binding'?Number($('calibration-art-opacity').value):1});
  else if(displayMode!=='logic')drawScene(ctx,level,state,{animate:$('animation-toggle').checked,previewVariant:state?null:resourceUI?.variant(),
    feedback:feedbackFrame,previewTarget:state?null:audition?.target,hiddenLayers:state?null:resourceUI?.hiddenLayers(),artOpacity:displayMode==='binding'?Number($('calibration-art-opacity').value):1});else drawDiagram(ctx,level,state);
  if(displayMode==='binding')bindingUI?.render(level,state);
  if(actualState)runtimeDrag.drawTargets(ctx,level,actualState);
  if(state)updateInteractions(state);
}
function workspace(){document.body.dataset.display=displayMode;const editing=editor?.isEditing()??false,target=displayMode==='binding'?$('binding-target').value:displayMode==='logic'?'logic':'art';
  window.dispatchEvent(new Event('editor-workspace-mode'));window.dispatchEvent(new Event('editor-cancel-destination'));
  document.body.dataset.editTarget=target;$('resource-panel').hidden=!editing||target!=='art';$('resource-overlay').hidden=!editing||target!=='art';$('editor-panel').hidden=!editing||target!=='logic';$('editor-overlay').hidden=!editing||target!=='logic';
  $('calibration-controls').hidden=displayMode!=='binding';$('binding-overlay').toggleAttribute('hidden',displayMode!=='binding');
  $('binding-target').disabled=!editing;$('cancel-binding').disabled=!editing;
}
function changeDisplay(mode,target){editor?.cancel();resourceUI?.cancel();bindingUI?.cancel();displayMode=mode;$('display-mode').value=mode;if(target)$('binding-target').value=target;try{localStorage.setItem('gothere.studio.display',mode);}catch{}workspace();if(preview)draw(previewLevel,preview.snapshot());else draw(editor.document());}
$('display-mode').addEventListener('change',()=>changeDisplay($('display-mode').value));
$('binding-target').addEventListener('change',()=>changeDisplay('binding'));
for(const id of ['calibration-art-opacity','logic-opacity'])$(id).addEventListener('input',()=>{if(preview)draw(previewLevel,preview.snapshot());else draw(editor.document());});
$('animation-toggle').addEventListener('change',()=>{if(preview)draw(previewLevel,preview.snapshot());else draw(editor.document());});
$('sound-toggle').addEventListener('change',()=>{sound.setMuted(!$('sound-toggle').checked);if($('sound-toggle').checked)sound.unlock();});
const labels={ready:'准备运行',running:'运行中',paused:'已暂停',won:'已到达终点',lost:'模拟结束'};
function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);}
function drawDocument(level){if(audition){audition=null;sound.stop();}bindingUI?.cancel();draw(level);resourceUI?.render(level);workspace();const request=++loadSerial;canvas.dataset.assets='loading';loadResources(level).then(()=>{if(request!==loadSerial)return;canvas.dataset.assets='ready';if(editor?.isEditing())draw(lastDraft);});$('stage-note').textContent=level.description;$('level-hint').textContent=level.hint??'自由编辑地图和物体，运行查看效果。';$('document-summary').textContent=`${level.entities.length} 个逻辑物体 · ${level.scene?.nodes.length??0} 个资源图层 · ${level.rules.length} 条规则`;authoringUI?.canvasChanged();}
function canClick(id,state){return previewLevel.rules.some(r=>r.on.source===id&&r.on.type==='click'&&(r.if??[]).every(c=>Object.hasOwn(c,'holding')?state.actor.holding===c.holding:state.entities[c.entity].state===c.state));}
function updateInteractions(state){
  for(const button of document.querySelectorAll('#scene-interactions button,#runtime-inputs button')){
    const e=state.entities[button.dataset.source],remaining=recoveryTicks(e.id,state),draggable=state.status==='running'&&canDrag(state,e.id),disabled=['won','lost'].includes(state.status)||(!canClick(e.id,state)&&!draggable);
    button.disabled=disabled;const status=remaining===null?(disabled?'暂不可触发':draggable?'可拖放':'可触发'):'剩余 '+(remaining/60).toFixed(1)+'秒 · 恢复';
    button.title=e.label+' · '+status;
    if(button.parentElement.id==='scene-interactions'){
      button.dataset.draggable=String(draggable);
      const logical=()=>previewLevel.spatial?spaceBounds(previewLevel,e.kind,e):diagramBounds(e.kind,e);
      const b=displayMode==='logic'?logical():(entityArtBounds(previewLevel,state,e.id,{feedback:feedbackFrame})??(previewLevel.spatial?logical():presentationBounds(e)));
      button.style.left=(b.x-4)/12+'%';button.style.top=(b.y-4)/6.4+'%';button.style.width=(b.width+8)/12+'%';button.style.height=Math.max(24,b.height+8)/6.4+'%';
      // Small items remain reachable when receivers share the same screen area.
      // Disabled rules never cover a usable target underneath them.
      button.style.pointerEvents=disabled?'none':'auto';button.style.zIndex=String(Math.max(1,1000-Math.round(b.width*b.height/100)));
      button.setAttribute('aria-label',(draggable?'拖放 ':'触发 ')+e.label+' · '+status);
    }else button.querySelector('small').textContent=status;
  }
}
function updateDebug(){
  if(!preview)return;
  const state=preview.snapshot();
  $('runtime-status').textContent=labels[state.status]+(state.reason?' · '+state.reason:'');
  $('runtime-status').dataset.status=state.status;
  $('runtime-tick').textContent='tick '+state.tick+' · '+(state.tick/60).toFixed(2)+' s';
  $('preview-toggle').textContent=state.status==='running'?'Ⅱ 暂停':state.status==='paused'||state.status==='ready'?'▶ 运行':'↻ 再次运行';
  $('runtime-actor').textContent=`X ${state.actor.x.toFixed(1)}  Y ${state.actor.y.toFixed(1)}\n朝向 ${state.actor.direction===1?'右':'左'} · ${state.actor.mode}\n持有 ${state.actor.holding??'无'}`+(state.actor.vy!==undefined?'\n下落速度 '+state.actor.vy.toFixed(1)+(state.actor.maxLandingSpeed!==undefined?' · 安全上限 '+state.actor.maxLandingSpeed:''):'');
  if(state.actor.space)$('runtime-actor').textContent=`X ${state.actor.x.toFixed(1)} · 纵深 ${state.actor.space.depth.toFixed(1)}\n离地高度 ${state.actor.space.height.toFixed(1)} · ${state.actor.mode}\n路线 ${state.actor.routeNode} → ${state.actor.targetNode??'沿当前方向'}\n垂直速度 ${state.actor.vh.toFixed(1)}`;
  const list=$('runtime-entities');list.replaceChildren();
  for(const e of Object.values(state.entities)){const row=document.createElement('div');row.className='runtime-entity';const name=document.createElement('span');name.textContent=e.label;const value=document.createElement('code');value.textContent=e.state+(e.kind==='lift'?' · Y '+e.carY.toFixed(1):'')+(e.pose?' · '+e.pose.angle.toFixed(1)+'°'+(e.rotation?' · 旋转中':''):'')+(e.bodyState?' · Y '+e.y.toFixed(1)+' · '+e.bodyState.mode+' · 支撑 '+(e.bodyState.support??'无'):'')+(e.supportState?' · '+e.supportState.mode+' · 支撑 '+(e.supportState.support??'无'):'')+(e.collider&&!e.collider.enabled?' · 碰撞停用':'');row.append(name,value);list.append(row);}
  $('runtime-timers').textContent=state.timers.length?state.timers.map(t=>`tick ${t.due}（余 ${Math.max(0,t.due-state.tick)} 帧）\n${t.actions.map(a=>a.type+(a.target?' → '+a.target:'')).join(', ')}`).join('\n'):'无';
  const log=$('runtime-log');log.replaceChildren();
  for(const e of state.events.slice().reverse()){const li=document.createElement('li');const time=document.createElement('code');time.textContent=String(e.tick).padStart(4,'0');li.append(time,document.createTextNode(' '+e.message));log.append(li);}
  if(!state.events.length){const li=document.createElement('li');li.textContent='尚无状态变化。';log.append(li);}
  updateInteractions(state);
}
function runPreview(level,{run=true}={}){
  runtimeDrag.cancel();
  audition=null;previewLevel=level;preview=createPreview(level);accumulator=0;endingTicks=0;
  sound.setLevel(level);sound.setPaused(!run);sound.setMuted(!$('sound-toggle').checked);if(run)sound.unlock();canvas.dataset.audioPlayed='0';
  feedback=createFeedbackPlayer(level,{onSound:e=>sound.play(e)});
  if(run)preview.start();
  const inputs=$('runtime-inputs');inputs.replaceChildren();
  $('scene-interactions').replaceChildren();
  for(const e of level.entities.filter(e=>e.draggable||eventTypes(e).includes('click')&&level.rules.some(r=>r.on.source===e.id&&r.on.type==='click'))){
    for(const container of [inputs,$('scene-interactions')]){const b=document.createElement('button');b.className=container===inputs?'button secondary':'scene-target';b.dataset.source=e.id;
      if(container===inputs&&e.draggable&&!level.rules.some(r=>r.on.source===e.id&&r.on.type==='click'))continue;
      if(container===inputs){const title=document.createElement('span');title.textContent=e.label;b.append(title,document.createElement('small'));}
      b.addEventListener('click',()=>{if(canClick(e.id,preview.snapshot())&&preview.click(e.id)){notify('点击已排队：'+e.label);updateDebug();}});container.append(b);}
  }
  if(!inputs.children.length)inputs.textContent=level.entities.some(e=>e.draggable)?'在画布中拖放物品。':'没有点击事件源。';
  draw(level,preview.snapshot());updateDebug();
}
editor=createEditorUI({play:runPreview,leave:()=>{},pause:()=>preview?.pause(),notify,diagram:true,
  storageKey:layeredEntry?'gothere.studio.layered.v1':spatialEntry?'gothere.studio.spatial.v1':'gothere.studio.v1',onChange:drawDocument,onPreview:draw,
  editResources:(ref,id)=>{changeDisplay('binding','art');resourceUI.select(id??editor.document().scene?.nodes.find(n=>n.bind?.type===ref.type&&(ref.type==='entity'?n.bind.id===ref.id:ref.type==='platform'?n.bind.index===ref.index:true))?.id??null);},
  onMode:mode=>{const testing=mode==='testing';resourceUI?.cancel();bindingUI?.cancel();$('simulation-panel').hidden=!testing;$('preview-reset').disabled=!testing;$('scene-tag-text').textContent=testing?'模拟中':'正在创作';
    workspace();
    $('scene-interactions').hidden=!testing;
    $('reset-level').disabled=testing;
    if(!testing){preview=null;previewLevel=null;feedback=null;audition=null;sound.stop();accumulator=0;$('runtime-status').textContent='编辑中';delete $('runtime-status').dataset.status;$('runtime-tick').textContent='tick 0';$('preview-toggle').textContent='▶ 运行';}}
});
resourceUI=createResourceUI({editor,notify,preview:draw,requestBind:id=>{changeDisplay('binding','art');bindingUI.start(id);},inspectLogic:ref=>{changeDisplay('binding','logic');editor.select(ref);},
  createPractice:()=>{const id='template-practice-'+Date.now().toString(36)+'-'+serial++;if(editor.openDocument(createTemplatePractice(id),'custom:'+id))$('editor-example').value='templates';},
  stopFeedback:()=>{audition=null;sound.stop();draw(editor.document());},previewFeedback:f=>{
    if(!editor.isEditing())return;const level=editor.document();sound.setLevel(level);sound.setPaused(false);sound.setMuted(!$('sound-toggle').checked);sound.unlock();
    const player=createFeedbackPlayer(level,{onSound:e=>sound.play(e)});player.preview({...f,delay:0},0);audition={player,tick:0,duration:f.duration,target:f.target};$('animation-toggle').checked=true;draw(level);
  }});
bindingUI=createBindingUI({editor,resources:resourceUI,paint:draw,notify});
if(spatialEntry)editor.open(sample(),sampleKey,{updateSample:layeredEntry&&!layeredDemo,offerSample:layeredEntry&&(chapterEntry||scooterEntry||crossEntry||towEntry||busStop||templateEntry)});
else editor.open(createFirstLevel(),'milestone:02:v017',{workspaceRevision:'milestone-02-v017'});
// An explicit sample link selects its saved slot, preserving authored edits.
if(spatialEntry&&params.has('sample'))editor.openDocument(sample(),sampleKey);
if(editor.document().id==='editor-first-level'&&!editor.document().scene)editor.change(d=>{d.scene=createFirstScene(d);});
workspace();resourceUI.render(editor.document());
if(templateEntry)$('resource-template-tab').click();
createViewport({isEditing:()=>editor.isEditing(),onChange:()=>{
  const scale=Math.max(1,Math.min(3,$('viewport').getBoundingClientRect().width/1200*(devicePixelRatio||1)));
  const width=Math.round(1200*scale),height=Math.round(640*scale);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;ctx.setTransform(width/1200,0,0,height/640,0,0);}
  if(preview)draw(previewLevel,preview.snapshot());else draw(lastDraft??editor.document());
}});
$('editor-example').value=spatialEntry?(editor.document().id==='commute-chapter'?'chapter':editor.document().id==='commute-scooter'?'scooter':editor.document().id==='commute-crosswalk'?'crosswalk':editor.document().id==='commute-tow-street'?'tow-street':editor.document().id.startsWith('template-practice')?'templates':editor.document().id==='spatial-graybox'?'graybox':editor.document().id==='commute-spatial'?'spatial-commute':editor.document().id==='layered-graybox'?'layered':editor.document().id==='commute-bus-stop'?'bus-stop':'commute'):'rooftop';
$('editor-example').addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.delete('legacy');url.searchParams.delete('sample');url.searchParams.delete('spatial');
  if($('editor-example').value==='rooftop')url.searchParams.set('legacy','1');else url.searchParams.set('sample',$('editor-example').value);location.href=url.href;});
$('reset-level').textContent='新建示例副本';
$('reset-level').addEventListener('click',()=>editor.openDocument(sample(),'sample:'+Date.now().toString(36)+'-'+serial++));
$('preview-toggle').addEventListener('click',()=>{
  if(editor.isEditing()){editor.preview();return;}
  const state=preview.snapshot();if(state.status==='running'){preview.pause();sound.setPaused(true);}else{if(['won','lost'].includes(state.status)){preview.reset();resetFeedback();}preview.start();sound.setPaused(false);sound.unlock();}
  accumulator=0;updateDebug();
});
function resetFeedback(){feedback?.reset();endingTicks=0;sound.stop();canvas.dataset.audioPlayed='0';}
$('preview-step').addEventListener('click',()=>{if(editor.isEditing()&&!editor.preview({run:false}))return;preview.step();sound.setPaused(true);accumulator=0;draw(previewLevel,preview.snapshot());updateDebug();});
$('preview-reset').addEventListener('click',()=>{preview.reset();resetFeedback();sound.setPaused(true);accumulator=0;draw(previewLevel,preview.snapshot());updateDebug();});
function frame(now){
  const elapsed=last?Math.min(250,now-last):0;last=now;
  if(preview){
    const status=preview.snapshot().status;
    sound.setPaused(status==='paused'||status==='ready'||document.hidden);
    if(preview.snapshot().status==='running'){accumulator+=elapsed;const steps=Math.floor(accumulator/(1000/60));if(steps){preview.advance(steps);accumulator-=steps*1000/60;}}
    else accumulator=0;
    if(['lost','won'].includes(status)&&!document.hidden)endingTicks=Math.min(960,endingTicks+elapsed*60/1000);
    draw(previewLevel,preview.snapshot());
    if(now-debugLast>=100){updateDebug();debugLast=now;}
  }else if(audition){
    if(!document.hidden)audition.tick+=elapsed*60/1000;
    if(audition.tick>audition.duration+2){audition=null;sound.stop();}draw(editor.document());
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){preview?.pause();sound.setPaused(true);accumulator=0;updateDebug();}});
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
authoringUI=createAuthoringUI({editor,notify,download,pause:()=>{preview?.pause();updateDebug();}});
$('download-editor').addEventListener('click',()=>{if(standaloneHTML){download(standaloneHTML,'gothere-editor.html','text/html');}
  else{const a=document.createElement('a');a.href='gothere-editor.html';a.download='gothere-editor.html';a.click();}});
