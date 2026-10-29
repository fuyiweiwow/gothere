import { createEditorUI } from '../editor/ui.js';
import {createFirstLevel} from '../editor/first-level.js';
import { createPreview } from '../app/preview.js';
import { drawDiagram } from '../render/diagram.js';
import { eventTypes } from '../core/schema.js';
import { diagramBounds } from '../core/geometry.js';
import {drawScene} from '../render/scene.js';
import {presentationBounds,recoveryTicks} from '../render/presentation.js';

const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');
const standaloneHTML=document.getElementById('standalone-editor')?'<!doctype html>\n'+document.documentElement.outerHTML:null;
let editor,preview=null,previewLevel=null,accumulator=0,last=0,debugLast=0,toastTimer,serial=0;
let displayMode='scene';
try{displayMode=localStorage.getItem('gothere.studio.display')??'scene';}catch{}
if(!['logic','scene'].includes(displayMode))displayMode='scene';
$('display-mode').value=displayMode;
$('animation-toggle').checked=!matchMedia('(prefers-reduced-motion: reduce)').matches;
function draw(level,state){
  canvas.dataset.view=displayMode;
  if(displayMode==='scene')drawScene(ctx,level,state,{animate:$('animation-toggle').checked});else drawDiagram(ctx,level,state);
  if(state)updateInteractions(state);
}
$('display-mode').addEventListener('change',()=>{displayMode=$('display-mode').value;try{localStorage.setItem('gothere.studio.display',displayMode);}catch{}if(preview)draw(previewLevel,preview.snapshot());else draw(editor.document());});
$('animation-toggle').addEventListener('change',()=>{if(preview)draw(previewLevel,preview.snapshot());else draw(editor.document());});
const labels={ready:'准备运行',running:'运行中',paused:'已暂停',won:'已到达终点',lost:'模拟结束'};
function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);}
function drawDocument(level){draw(level);$('stage-note').textContent=level.description;$('level-hint').textContent=level.hint??'自由编辑地图和物体，运行查看效果。';$('document-summary').textContent=`${level.entities.length} 个物体 · ${level.rules.length} 条规则 · schemaVersion ${level.schemaVersion}`;}
function canClick(id,state){return previewLevel.rules.some(r=>r.on.source===id&&r.on.type==='click'&&(r.if??[]).every(c=>Object.hasOwn(c,'holding')?state.actor.holding===c.holding:state.entities[c.entity].state===c.state));}
function updateInteractions(state){
  for(const button of document.querySelectorAll('#scene-interactions button,#runtime-inputs button')){
    const e=state.entities[button.dataset.source],remaining=recoveryTicks(e.id,state),disabled=['won','lost'].includes(state.status)||!canClick(e.id,state);
    button.disabled=disabled;const status=remaining===null?(disabled?'暂不可触发':'可触发'):'剩余 '+(remaining/60).toFixed(1)+'秒 · 恢复';
    button.title=e.label+' · '+status;
    if(button.parentElement.id==='scene-interactions'){
      const b=displayMode==='scene'?presentationBounds(e):diagramBounds(e.kind,e);
      button.style.left=(b.x-4)/12+'%';button.style.top=(b.y-4)/6.4+'%';button.style.width=(b.width+8)/12+'%';button.style.height=Math.max(24,b.height+8)/6.4+'%';
      button.setAttribute('aria-label','触发 '+e.label+' · '+status);
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
  const list=$('runtime-entities');list.replaceChildren();
  for(const e of Object.values(state.entities)){const row=document.createElement('div');row.className='runtime-entity';const name=document.createElement('span');name.textContent=e.label;const value=document.createElement('code');value.textContent=e.state+(e.kind==='lift'?' · Y '+e.carY.toFixed(1):'')+(e.pose?' · '+e.pose.angle.toFixed(1)+'°'+(e.rotation?' · 旋转中':''):'')+(e.bodyState?' · Y '+e.y.toFixed(1)+' · '+e.bodyState.mode+' · 支撑 '+(e.bodyState.support??'无'):'')+(e.supportState?' · '+e.supportState.mode+' · 支撑 '+(e.supportState.support??'无'):'')+(e.collider&&!e.collider.enabled?' · 碰撞停用':'');row.append(name,value);list.append(row);}
  $('runtime-timers').textContent=state.timers.length?state.timers.map(t=>`tick ${t.due}（余 ${Math.max(0,t.due-state.tick)} 帧）\n${t.actions.map(a=>a.type+(a.target?' → '+a.target:'')).join(', ')}`).join('\n'):'无';
  const log=$('runtime-log');log.replaceChildren();
  for(const e of state.events.slice().reverse()){const li=document.createElement('li');const time=document.createElement('code');time.textContent=String(e.tick).padStart(4,'0');li.append(time,document.createTextNode(' '+e.message));log.append(li);}
  if(!state.events.length){const li=document.createElement('li');li.textContent='尚无状态变化。';log.append(li);}
  updateInteractions(state);
}
function runPreview(level,{run=true}={}){
  previewLevel=level;preview=createPreview(level);accumulator=0;
  if(run)preview.start();
  const inputs=$('runtime-inputs');inputs.replaceChildren();
  $('scene-interactions').replaceChildren();
  for(const e of level.entities.filter(e=>eventTypes(e).includes('click')&&level.rules.some(r=>r.on.source===e.id&&r.on.type==='click'))){
    for(const container of [inputs,$('scene-interactions')]){const b=document.createElement('button');b.className=container===inputs?'button secondary':'scene-target';b.dataset.source=e.id;
      if(container===inputs){const title=document.createElement('span');title.textContent=e.label;b.append(title,document.createElement('small'));}
      b.addEventListener('click',()=>{if(preview.click(e.id)){notify('点击已排队：'+e.label);updateDebug();}});container.append(b);}
  }
  if(!inputs.children.length)inputs.textContent='没有点击事件源。';
  draw(level,preview.snapshot());updateDebug();
}
editor=createEditorUI({play:runPreview,leave:()=>{},pause:()=>preview?.pause(),notify,diagram:true,
  storageKey:'gothere.studio.v1',onChange:drawDocument,
  onMode:mode=>{const testing=mode==='testing';$('simulation-panel').hidden=!testing;$('preview-reset').disabled=!testing;$('scene-tag-text').textContent=testing?'模拟中':'正在创作';
    $('scene-interactions').hidden=!testing;
    $('reset-level').disabled=testing;
    if(!testing){preview=null;previewLevel=null;accumulator=0;$('runtime-status').textContent='编辑中';delete $('runtime-status').dataset.status;$('runtime-tick').textContent='tick 0';$('preview-toggle').textContent='▶ 运行';}}
});
editor.open(createFirstLevel(),'first-level:v013');
$('reset-level').addEventListener('click',()=>editor.openDocument(createFirstLevel(),'first-level:'+Date.now().toString(36)+'-'+serial++));
$('preview-toggle').addEventListener('click',()=>{
  if(editor.isEditing()){editor.preview();return;}
  const state=preview.snapshot();if(state.status==='running')preview.pause();else{if(['won','lost'].includes(state.status))preview.reset();preview.start();}
  accumulator=0;updateDebug();
});
$('preview-step').addEventListener('click',()=>{if(editor.isEditing()&&!editor.preview({run:false}))return;preview.step();accumulator=0;draw(previewLevel,preview.snapshot());updateDebug();});
$('preview-reset').addEventListener('click',()=>{preview.reset();accumulator=0;draw(previewLevel,preview.snapshot());updateDebug();});
canvas.addEventListener('click',event=>{
  if(editor.isEditing()||!preview)return;
  const box=canvas.getBoundingClientRect(),x=(event.clientX-box.left)/box.width*1200,y=(event.clientY-box.top)/box.height*640;
  const entity=Object.values(preview.snapshot().entities).reverse().find(e=>{const b=diagramBounds(e.kind,e);return eventTypes(e).includes('click')&&x>=b.x-8&&x<=b.x+b.width+8&&y>=b.y-8&&y<=b.y+b.height+8;});
  if(entity&&preview.click(entity.id))updateDebug();
});
function frame(now){
  const elapsed=last?Math.min(250,now-last):0;last=now;
  if(preview){
    if(preview.snapshot().status==='running'){accumulator+=elapsed;const steps=Math.floor(accumulator/(1000/60));if(steps){preview.advance(steps);accumulator-=steps*1000/60;}}
    else accumulator=0;
    draw(previewLevel,preview.snapshot());
    if(now-debugLast>=100){updateDebug();debugLast=now;}
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){preview?.pause();accumulator=0;updateDebug();}});
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('open-data').addEventListener('click',()=>{preview?.pause();updateDebug();$('level-json').value=JSON.stringify(editor.document(),null,2);$('data-error').hidden=true;$('apply-level').disabled=!editor.isEditing();$('data-dialog').showModal();});
$('close-data').addEventListener('click',()=>$('data-dialog').close());
$('export-level').addEventListener('click',()=>download(JSON.stringify(editor.document(),null,2),editor.document().id+'.json','application/json'));
$('import-level').addEventListener('click',()=>$('level-file').click());
$('level-file').addEventListener('change',async()=>{const file=$('level-file').files[0];if(!file)return;try{if(file.size>262144)throw new Error('JSON 文件不能超过 256 KiB。');$('level-json').value=await file.text();$('data-error').hidden=true;}catch(error){$('data-error').textContent=error.message;$('data-error').hidden=false;}finally{$('level-file').value='';}});
$('apply-level').addEventListener('click',()=>{try{const text=$('level-json').value;if(text.length>262144)throw new Error('JSON 不能超过 256 KiB。');editor.importDocument(JSON.parse(text));$('data-dialog').close();notify('已导入为新草稿。');}catch(error){$('data-error').textContent=error.message;$('data-error').hidden=false;}});
$('download-editor').addEventListener('click',()=>{if(standaloneHTML){download(standaloneHTML,'gothere-editor.html','text/html');}
  else{const a=document.createElement('a');a.href='gothere-editor.html';a.download='gothere-editor.html';a.click();}});
