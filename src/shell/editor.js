import { createEditorUI } from '../editor/ui.js';
import { createEditorExample } from '../editor/starter.js';
import { createPreview } from '../app/preview.js';
import { drawDiagram } from '../render/diagram.js';
import { eventTypes } from '../core/schema.js';

const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');
const standaloneHTML=document.getElementById('standalone-editor')?'<!doctype html>\n'+document.documentElement.outerHTML:null;
let editor,preview=null,previewLevel=null,accumulator=0,last=0,debugLast=0,toastTimer,serial=0;
const labels={ready:'准备运行',running:'运行中',paused:'已暂停',won:'已到达终点',lost:'模拟结束'};
function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);}
function drawDocument(level){drawDiagram(ctx,level);$('stage-note').textContent=level.description;$('document-summary').textContent=`${level.entities.length} 个物体 · ${level.rules.length} 条规则 · schemaVersion ${level.schemaVersion}`;}
function updateDebug(){
  if(!preview)return;
  const state=preview.snapshot();
  $('runtime-status').textContent=labels[state.status]+(state.reason?' · '+state.reason:'');
  $('runtime-status').dataset.status=state.status;
  $('runtime-tick').textContent='tick '+state.tick+' · '+(state.tick/60).toFixed(2)+' s';
  $('preview-toggle').textContent=state.status==='running'?'Ⅱ 暂停':state.status==='paused'||state.status==='ready'?'▶ 运行':'↻ 再次运行';
  $('runtime-actor').textContent=`X ${state.actor.x.toFixed(1)}  Y ${state.actor.y.toFixed(1)}\n朝向 ${state.actor.direction===1?'右':'左'} · ${state.actor.mode}\n持有 ${state.actor.holding??'无'}`;
  const list=$('runtime-entities');list.replaceChildren();
  for(const e of Object.values(state.entities)){const row=document.createElement('div');row.className='runtime-entity';const name=document.createElement('span');name.textContent=e.label;const value=document.createElement('code');value.textContent=e.state+(e.kind==='lift'?' · Y '+e.carY.toFixed(1):'');row.append(name,value);list.append(row);}
  $('runtime-timers').textContent=state.timers.length?state.timers.map(t=>`tick ${t.due}（余 ${Math.max(0,t.due-state.tick)} 帧）\n${t.actions.map(a=>a.type+(a.target?' → '+a.target:'')).join(', ')}`).join('\n'):'无';
  const log=$('runtime-log');log.replaceChildren();
  for(const e of state.events.slice().reverse()){const li=document.createElement('li');const time=document.createElement('code');time.textContent=String(e.tick).padStart(4,'0');li.append(time,document.createTextNode(' '+e.message));log.append(li);}
  if(!state.events.length){const li=document.createElement('li');li.textContent='尚无状态变化。';log.append(li);}
  for(const b of $('runtime-inputs').querySelectorAll('button'))b.disabled=['lost','won'].includes(state.status);
}
function runPreview(level,{run=true}={}){
  previewLevel=level;preview=createPreview(level);accumulator=0;
  if(run)preview.start();
  const inputs=$('runtime-inputs');inputs.replaceChildren();
  for(const e of level.entities.filter(e=>eventTypes(e).includes('click'))){const b=document.createElement('button');b.className='button secondary';b.textContent='点击：'+e.label;b.dataset.source=e.id;b.addEventListener('click',()=>{if(preview.click(e.id)){notify('点击已排队：'+e.label);updateDebug();}});inputs.append(b);}
  if(!inputs.children.length)inputs.textContent='没有点击事件源。';
  drawDiagram(ctx,level,preview.snapshot());updateDebug();
}
editor=createEditorUI({play:runPreview,leave:()=>{},pause:()=>preview?.pause(),notify,diagram:true,
  storageKey:'gothere.logic-editor.v1',onChange:drawDocument,
  onMode:mode=>{const testing=mode==='testing';$('simulation-panel').hidden=!testing;$('preview-reset').disabled=!testing;$('scene-tag-text').textContent=testing?'模拟中':'正在创作';
    $('load-example').disabled=testing;$('example-select').disabled=testing;
    if(!testing){preview=null;previewLevel=null;accumulator=0;$('runtime-status').textContent='编辑中';delete $('runtime-status').dataset.status;$('runtime-tick').textContent='tick 0';$('preview-toggle').textContent='▶ 运行';}}
});
const requestedExample=new URL(location.href).searchParams.get('example');
const initialExample=['logic','floors','creature','slopes'].includes(requestedExample)?requestedExample:'logic';
editor.open(createEditorExample(initialExample),'starter:'+initialExample);$('example-select').value=initialExample;
$('load-example').addEventListener('click',()=>{const name=$('example-select').value;editor.openDocument(createEditorExample(name),'example:'+name+':'+Date.now().toString(36)+'-'+serial++);});
$('preview-toggle').addEventListener('click',()=>{
  if(editor.isEditing()){editor.preview();return;}
  const state=preview.snapshot();if(state.status==='running')preview.pause();else{if(['won','lost'].includes(state.status))preview.reset();preview.start();}
  accumulator=0;updateDebug();
});
$('preview-step').addEventListener('click',()=>{if(editor.isEditing()&&!editor.preview({run:false}))return;preview.step();accumulator=0;drawDiagram(ctx,previewLevel,preview.snapshot());updateDebug();});
$('preview-reset').addEventListener('click',()=>{preview.reset();accumulator=0;drawDiagram(ctx,previewLevel,preview.snapshot());updateDebug();});
canvas.addEventListener('click',event=>{
  if(editor.isEditing()||!preview)return;
  const box=canvas.getBoundingClientRect(),x=(event.clientX-box.left)/box.width*1200,y=(event.clientY-box.top)/box.height*640;
  const entity=Object.values(preview.snapshot().entities).reverse().find(e=>eventTypes(e).includes('click')&&x>=e.x-8&&x<=e.x+e.width+8&&Math.abs(y-e.y)<64);
  if(entity&&preview.click(entity.id))updateDebug();
});
function frame(now){
  const elapsed=last?Math.min(250,now-last):0;last=now;
  if(preview){
    if(preview.snapshot().status==='running'){accumulator+=elapsed;const steps=Math.floor(accumulator/(1000/60));if(steps){preview.advance(steps);accumulator-=steps*1000/60;}}
    else accumulator=0;
    drawDiagram(ctx,previewLevel,preview.snapshot());
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
