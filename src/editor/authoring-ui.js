import {AUTHORING_START,AUTHORING_EXAMPLE} from './authoring-api.js';
import {generateFromJavaScript} from './authoring.js';

export function createAuthoringUI({editor,notify,download,pause}){
  const $=id=>document.getElementById(id),dialog=$('script-dialog'),source=$('script-source');
  let base=null,result=null,task=null,storageKey=null;
  const message=(text,error=false)=>{const output=$('script-status');output.textContent=text;output.dataset.error=String(error);};
  function invalidate(){result=null;$('script-result').value='';$('script-apply').disabled=$('script-import').disabled=true;}
  function stop(){task?.cancel();task=null;$('script-generate').disabled=false;$('script-stop').disabled=true;}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify({source:source.value,base}));return true;}catch{message('源码未能保存：本地存储空间不足，请导出 JS 备份。',true);return false;}}
  function load(){
    base=editor.document();source.value=AUTHORING_START;
    try{const saved=JSON.parse(localStorage.getItem(storageKey));if(typeof saved?.source==='string'&&saved?.base){source.value=saved.source;base=saved.base;}}catch{message('无法读取之前的编排稿，已载入当前草稿。',true);}
  }
  $('open-script').onclick=()=>{pause();storageKey='gothere.authoring.'+editor.documentKey();load();invalidate();message('以保存的基稿生成；可视化修改不会反写 JS。仅执行自己信任的代码。');$('script-generate').disabled=false;$('script-base').disabled=$('script-example').disabled=!editor.isEditing();dialog.showModal();};
  $('script-base').onclick=()=>{stop();base=editor.document();invalidate();save();message('已使用当前草稿作为基稿；每次生成都从此快照开始。');};
  $('script-example').onclick=()=>{stop();source.value=AUTHORING_EXAMPLE;invalidate();save();message('示例已载入，点击生成预览；尚未修改草稿。');};
  source.oninput=()=>{stop();invalidate();save();};
  source.onkeydown=e=>{
    if(e.isComposing)return;
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('script-generate').click();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(save())message('编排源码和基稿已保存，尚未应用。');}
    else if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();source.setRangeText('  ',source.selectionStart,source.selectionEnd,'end');source.dispatchEvent(new Event('input'));}
  };
  $('script-generate').onclick=async()=>{
    stop();invalidate();save();const running=generateFromJavaScript(source.value,base);task=running;$('script-generate').disabled=true;$('script-stop').disabled=false;message('生成中…');
    try{const level=await running.promise;if(task!==running)return;result=level;$('script-result').value=JSON.stringify(level,null,2);
      const before=base.entities.length,after=level.entities.length;
      message(`校验通过 · 物体 ${before} → ${after} · 规则 ${base.rules.length} → ${level.rules.length} · 图层 ${base.scene?.nodes.length??0} → ${level.scene?.nodes.length??0}。应用会整体替换当前草稿，可撤销；另存可保留两份。`);
      $('script-apply').disabled=$('script-import').disabled=!editor.isEditing();
    }catch(error){if(task===running)message(error.message,true);}
    finally{if(task===running){task=null;$('script-generate').disabled=false;$('script-stop').disabled=true;}}
  };
  $('script-stop').onclick=()=>{stop();message('已停止，草稿未改变。');};
  const apply=separate=>{try{if(!result)return;if(separate){editor.importDocument(result);storageKey='gothere.authoring.'+editor.documentKey();save();}else editor.applyDocument(result);dialog.close();notify(separate?'生成结果已另存为新草稿。':'生成结果已应用 · Ctrl+Z 可撤销。');}catch(error){message(error.message,true);}};
  $('script-apply').onclick=()=>apply(false);$('script-import').onclick=()=>apply(true);
  $('script-export').onclick=()=>download(source.value,'level.author.js','text/javascript');
  $('script-load').onclick=()=>$('script-file').click();
  $('script-file').onchange=async()=>{const file=$('script-file').files[0];try{if(!file)return;if(file.size>131072)throw new Error('源码不能超过128 KiB。');stop();source.value=await file.text();invalidate();save();message('源码已载入，尚未执行。请先检查代码再生成。');}catch(error){message(error.message,true);}finally{$('script-file').value='';}};
  $('close-script').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{stop();save();});
}
