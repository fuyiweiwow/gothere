import {buildExperiments} from './levels.js';
import {runPlan} from './play-plan.js';
import {drawDiagram} from '../render/diagram.js';
import {drawScene} from '../render/scene.js';
import {loadResources} from '../render/resources.js';

/** Browsing is read-only. Import is explicit and always creates an independent draft. */
export function createExperimentsUI({editor,changeDisplay,changePlayView,notify}){
  const $=id=>document.getElementById(id),dialog=$('experiments-dialog'),entries=buildExperiments();
  let selected=entries[0],paintSerial=0;
  function select(entry){
    selected=entry;
    for(const button of $('experiment-list').children)button.setAttribute('aria-pressed',String(button.dataset.experiment===entry.id));
    $('experiment-kind').textContent=entry.kind;$('experiment-title').textContent=entry.level.name;
    $('experiment-summary').textContent=entry.summary;$('experiment-description').textContent=entry.level.description;
    $('experiment-hint').textContent=entry.help;$('experiment-help').open=false;$('experiment-status').hidden=true;
    const canvas=$('experiment-map'),ctx=canvas.getContext('2d'),request=++paintSerial;
    canvas.dataset.view=entry.display??'logic';canvas.dataset.assets='ready';
    if(entry.display==='scene'){
      canvas.dataset.assets='loading';drawScene(ctx,entry.level);
      loadResources(entry.level).then(()=>{
        if(request!==paintSerial)return;
        drawScene(ctx,entry.level);canvas.dataset.assets='ready';
      });
    }else drawDiagram(ctx,entry.level);
  }
  function importEntry(mode){
    if(!editor.isEditing())return;
    try{
      let recording;
      if(mode==='demo'){
        const result=runPlan(selected.level,selected.plan);
        if(result.status!=='won')throw new Error('当前解法未通过模拟验证，请先编辑或手动试玩。');
        recording=result.recording;
      }
      editor.importDocument(selected.level);changeDisplay(selected.display??'logic');dialog.close();
      if(mode==='play')editor.preview({run:false});
      if(mode==='demo')editor.preview({recording});
      if(mode!=='edit')changePlayView?.(selected.playView==='clean');
      notify(mode==='play'?'已准备试玩，点击「运行」出发。':mode==='demo'?'正在演示一条验证过的解法；返回编辑后可自由修改。':'已创建可编辑副本。');
    }catch(error){$('experiment-status').textContent=error.message;$('experiment-status').hidden=false;}
  }
  for(const entry of entries){
    const button=document.createElement('button'),name=document.createElement('strong'),kind=document.createElement('span');
    button.type='button';button.dataset.experiment=entry.id;name.textContent=entry.level.name;kind.textContent=entry.kind;
    button.append(name,kind);button.addEventListener('click',()=>select(entry));$('experiment-list').append(button);
  }
  $('open-experiments').addEventListener('click',()=>{
    if(!editor.isEditing())return;
    editor.cancel();select(selected);dialog.showModal();
  });
  $('close-experiments').addEventListener('click',()=>dialog.close());
  $('experiment-play').addEventListener('click',()=>importEntry('play'));
  $('experiment-edit').addEventListener('click',()=>importEntry('edit'));
  $('experiment-demo').addEventListener('click',()=>importEntry('demo'));
  select(selected);
}
