import {AUTHORING_EXAMPLE} from './authoring-api.js';
import {generateFromJavaScript} from './authoring.js';
import {levelToJavaScript,portableJavaScript} from './javascript-source.js';
import {parseDSL} from './dsl.js';

export function createAuthoringUI({editor,notify,download,pause}){
  const $=id=>document.getElementById(id),dialog=$('script-dialog'),source=$('script-source');
  let base=null,result=null,task=null,storageKey=null,programmatic=false,codeEditor=null,dirty=false;
  const getSource=()=>codeEditor?codeEditor.get():source.value;
  function setSource(value){programmatic=true;source.value=value;if(codeEditor)codeEditor.set(value);programmatic=false;}
  function invalidate(){result=null;$('script-apply').disabled=$('script-import').disabled=true;}
  function message(text,error=false){const output=$('script-status');output.textContent=text;output.dataset.error=String(error);}
  function stop(){task?.cancel();task=null;$('script-generate').disabled=false;$('script-stop').disabled=true;}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify({source:getSource(),base}));dirty=false;return true;}catch{dirty=true;message('本地存储空间不足，请导出 JS 备份。',true);return false;}}
  function backup(){try{localStorage.setItem(storageKey+'.previous',JSON.stringify({source:getSource(),base}));return true;}catch{message('未能备份当前源码，请先导出后再试。',true);return false;}}
  function changed(text){source.value=text;if(programmatic)return;dirty=true;stop();invalidate();}
  function initEditor(){if(typeof globalThis.createGothereCodeEditor==='function'){
    codeEditor=globalThis.createGothereCodeEditor($('code-editor'),changed);source.hidden=true;$('code-editor').hidden=false;
  }else $('code-editor').hidden=true;}
  function load(){
    base=editor.document();let text=levelToJavaScript(base);
    try{const raw=localStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw);if(typeof saved?.source!=='string'||!saved?.base)throw new Error('源码草稿格式不正确。');text=saved.source;base=saved.base;}}catch{throw new Error('读取源码草稿失败；已保留原存储，无法打开以免覆盖。');}
    setSource(text);dirty=false;
  }
  $('open-script').onclick=()=>{pause();storageKey='gothere.authoring.'+editor.documentKey();initEditor();try{load();}catch(error){codeEditor?.destroy?.();codeEditor=null;notify(error.message);return;}invalidate();message('源码和关卡可分别保存；重新从画布生成源码会替换当前源码，请先导出需要保留的版本。');$('script-base').disabled=$('script-example').disabled=!editor.isEditing();dialog.showModal();codeEditor?.refresh();};
  $('script-base').onclick=()=>{stop();if(!backup())return;base=editor.document();setSource(levelToJavaScript(base));dirty=true;invalidate();if(save())message('已从当前画布生成完整 JS；可以恢复之前的源码。');};
  $('script-example').onclick=()=>{stop();if(!backup())return;setSource(portableJavaScript(AUTHORING_EXAMPLE,base));dirty=true;invalidate();if(save())message('已载入点击离场示例；可以恢复之前的源码。');};
  $('script-restore').onclick=()=>{stop();try{const previous=JSON.parse(localStorage.getItem(storageKey+'.previous'));if(!previous?.base||typeof previous.source!=='string')throw new Error('没有可恢复的源码。');if(!backup())return;base=previous.base;setSource(previous.source);dirty=true;invalidate();if(save())message('已恢复之前的源码。');}catch(error){message(error.message,true);}};
  source.oninput=()=>changed(source.value);
  dialog.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('script-generate').click();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(save())message('源码已保存，尚未应用到画布。');}
    else if(e.target===source&&e.key==='Tab'&&!e.shiftKey){e.preventDefault();source.setRangeText('  ',source.selectionStart,source.selectionEnd,'end');source.dispatchEvent(new Event('input'));}
  },true);
  $('script-generate').onclick=async()=>{
    stop();invalidate();if(!save())return;const running=generateFromJavaScript(getSource(),base);task=running;$('script-generate').disabled=true;$('script-stop').disabled=false;message('生成中…');
    try{const level=await running.promise;if(task!==running)return;result=level;
      message(`校验通过 · 物体 ${base.entities.length} → ${level.entities.length} · 规则 ${base.rules.length} → ${level.rules.length} · 图层 ${base.scene?.nodes.length??0} → ${level.scene?.nodes.length??0}。可应用或另存。`);
      $('script-apply').disabled=$('script-import').disabled=!editor.isEditing();
    }catch(error){if(task===running)message(error.message,true);}
    finally{if(task===running){task=null;$('script-generate').disabled=false;$('script-stop').disabled=true;}}
  };
  $('script-stop').onclick=()=>{stop();message('已停止，草稿未改变。');};
  const apply=separate=>{try{if(!result)return;let saved=true;if(separate){editor.importDocument(result);storageKey='gothere.authoring.'+editor.documentKey();saved=save();}else editor.applyDocument(result);if(saved){dialog.close();notify(separate?'已另存为新草稿。':'已应用 · Ctrl+Z 可撤销。');}else message('关卡已另存，但源码未能保存；请导出 JS 备份。',true);}catch(error){message(error.message,true);}};
  $('script-apply').onclick=()=>apply(false);$('script-import').onclick=()=>apply(true);
  $('script-export').onclick=()=>{const text=portableJavaScript(getSource(),base);if(new TextEncoder().encode(text).length>2097152){message('导出的源码超过 2 MiB，请减少资源或从画布重新生成。',true);return;}download(text,'level.js','text/javascript');if(dirty&&save())message('源码已导出并保存。');};
  $('script-load').onclick=()=>$('script-file').click();
  $('script-file').onchange=async()=>{const file=$('script-file').files[0];try{if(!file)return;if(file.size>2097152)throw new Error('文件不能超过 2 MiB。');stop();const text=await file.text(),next=/\.json$/i.test(file.name)?levelToJavaScript(parseDSL(text)):text;if(!backup())return;setSource(next);dirty=true;invalidate();if(save())message('文件已载入；可以恢复之前的源码。');}catch(error){message(error.message,true);}finally{$('script-file').value='';}};
  $('close-script').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(dirty&&!save())e.preventDefault();});
  $('close-script').onclick=()=>{if(!dirty||save())dialog.close();};
  dialog.addEventListener('close',()=>{stop();if(dirty)save();codeEditor?.destroy?.();codeEditor=null;});
}
