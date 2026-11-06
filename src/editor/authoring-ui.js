import {generateFromProject} from './authoring.js';
import {levelToProject,legacyToProject,createProjectExample,authoringLibrarySource,validateProject,projectPath,renameProjectFile,CORE_MODULE} from './javascript-project.js';
import {parseDSL} from './dsl.js';
import {typeScriptClient} from './typescript-client.js';

export function createAuthoringUI({editor,notify,download,pause}) {
  const $=id=>document.getElementById(id),dialog=$('script-dialog'),source=$('script-source');
  let base,project,active,storageKey,result,task,codeEditor,programmatic=false,dirty=false;
  const changedFiles=new Set(),opened=new Set(),collapsed=new Set();
  const core=globalThis.gothereAuthoringTypes??authoringLibrarySource();
  function diagnostics(items,error){
    const panel=$('script-problems'),list=$('script-problem-list');list.replaceChildren();panel.hidden=!items.length&&!error;
    $('script-problem-count').textContent=error?'类型服务：'+error:`问题 ${items.length}`;
    for(const item of items.slice(0,50)){
      const button=document.createElement('button');button.type='button';button.dataset.problemPath=item.path;
      button.textContent=`${item.path}:${item.line}:${item.column} · TS${item.code} ${item.message}`;
      button.onclick=()=>{showFile(item.path);codeEditor?.jump(item.start);};list.append(button);
    }
  }
  const getSource=()=>codeEditor?codeEditor.get():source.value;
  function message(text,error=false){$('script-status').textContent=text;$('script-status').dataset.error=String(error);}
  function invalidate(){result=null;$('script-apply').disabled=$('script-import').disabled=true;}
  function stop(){task?.cancel();task=null;$('script-generate').disabled=false;$('script-stop').disabled=true;}
  function save(){try{validateProject(project);localStorage.setItem(storageKey,JSON.stringify({project,base}));dirty=false;changedFiles.clear();renderTabs();return true;}catch(error){dirty=true;message('保存失败：'+error.message+' 请导出项目备份。',true);return false;}}
  function backup(){try{localStorage.setItem(storageKey+'.previous',JSON.stringify({project,base}));return true;}catch{message('未能备份当前项目，请先导出后再试。',true);return false;}}
  function decode(saved){
    if(!saved?.base)throw new Error('缺少源码基稿。');
    if(saved.project)return {base:saved.base,project:validateProject(saved.project)};
    if(typeof saved.source==='string')return {base:saved.base,project:legacyToProject(saved.source,saved.base)};
    throw new Error('源码草稿格式不正确。');
  }
  function changed(text){
    source.value=text;if(programmatic||active===CORE_MODULE)return;
    project.files[active]=text;dirty=true;changedFiles.add(active);stop();invalidate();renderTabs();
  }
  function showFile(path){
    if(path!==CORE_MODULE&&!Object.hasOwn(project.files,path))return;
    active=path;opened.add(path);if(path!==CORE_MODULE)project.active=path;
    programmatic=true;const text=path===CORE_MODULE?core:project.files[path];source.value=text;source.readOnly=path===CORE_MODULE;
    if(codeEditor)codeEditor.open(path,text,{readOnly:path===CORE_MODULE,files:Object.keys(project.files)});
    programmatic=false;
    $('script-current-path').textContent=path;$('script-readonly').hidden=path!==CORE_MODULE;
    $('script-rename').disabled=$('script-delete').disabled=path===CORE_MODULE;
    $('script-file-form').hidden=true;renderTree();renderTabs();codeEditor?.refresh();
  }
  function renderTabs(){
    $('script-tabs').replaceChildren();
    for(const path of opened){
      const button=document.createElement('button');button.type='button';button.role='tab';button.dataset.scriptTab=path;
      button.setAttribute('aria-selected',String(path===active));button.title=path;
      button.textContent=(path===CORE_MODULE?'core.d.ts':path.split('/').at(-1))+(changedFiles.has(path)?' •':'');button.onclick=()=>showFile(path);$('script-tabs').append(button);
    }
    $('script-save-state').textContent=dirty?'有未保存修改':'已保存在本机';
  }
  function renderTree(){
    const tree=$('script-tree'),filter=$('script-search').value.trim().toLowerCase();tree.replaceChildren();
    const root={folders:new Map(),files:[]};
    for(const path of Object.keys(project.files).sort()){
      if(filter&&!path.toLowerCase().includes(filter))continue;
      const parts=path.split('/');let folder=root;
      for(const part of parts.slice(0,-1)){if(!folder.folders.has(part))folder.folders.set(part,{folders:new Map(),files:[]});folder=folder.folders.get(part);}
      folder.files.push(path);
    }
    function draw(folder,prefix='',depth=0){
      for(const path of folder.files){
        const button=document.createElement('button');button.type='button';button.className='script-tree-file';button.dataset.scriptPath=path;button.style.paddingLeft=(12+depth*14)+'px';button.title=path;
        button.setAttribute('aria-current',String(path===active));
        const icon=document.createElement('span');icon.className='script-js-icon';icon.textContent=path.endsWith('.ts')?'TS':'JS';
        const name=document.createElement('span');name.textContent=path.split('/').at(-1);button.append(icon,name);
        if(path===project.entry){const badge=document.createElement('small');badge.textContent='入口';button.append(badge);}
        button.onclick=()=>showFile(path);tree.append(button);
      }
      for(const [name,child]of folder.folders){
        const path=prefix+name+'/',button=document.createElement('button');button.type='button';button.className='script-folder';button.style.paddingLeft=(12+depth*14)+'px';
        button.textContent=(collapsed.has(path)&&!filter?'▸ ':'▾ ')+name;button.setAttribute('aria-expanded',String(!collapsed.has(path)||!!filter));
        button.onclick=()=>{if(collapsed.has(path))collapsed.delete(path);else collapsed.add(path);renderTree();};tree.append(button);
        if(!collapsed.has(path)||filter)draw(child,path,depth+1);
      }
    }
    draw(root);
    if(!tree.childElementCount){const empty=document.createElement('p');empty.className='panel-note';empty.textContent='没有匹配的文件';tree.append(empty);}
    $('script-core').setAttribute('aria-current',String(active===CORE_MODULE));
    const entry=$('script-entry');entry.replaceChildren();for(const path of Object.keys(project.files)){const option=document.createElement('option');option.value=path;option.textContent=path;entry.append(option);}entry.value=project.entry;
    $('script-file-count').textContent=Object.keys(project.files).length+' 个文件';
  }
  function replaceProject(next){
    validateProject(next);project=structuredClone(next);opened.clear();changedFiles.clear();collapsed.clear();$('script-search').value='';codeEditor?.reset();diagnostics([]);
    dirty=true;showFile(Object.hasOwn(project.files,project.active)?project.active:project.entry);invalidate();
  }
  $('open-script').onclick=()=>{
    pause();storageKey='gothere.authoring.'+editor.documentKey();base=editor.document();
    try{const raw=localStorage.getItem(storageKey);if(raw){const saved=decode(JSON.parse(raw));base=saved.base;project=saved.project;}else project=levelToProject(base,{typescript:true});}
    catch(error){notify('读取源码项目失败，原存储已保留：'+error.message);return;}
    if(typeof globalThis.createGothereCodeEditor==='function'){codeEditor=globalThis.createGothereCodeEditor($('code-editor'),changed,{project:()=>project,onDiagnostics:diagnostics});source.hidden=true;$('code-editor').hidden=false;}
    else{source.hidden=false;$('code-editor').hidden=true;}
    replaceProject(project);dirty=false;changedFiles.clear();renderTabs();
    invalidate();message('地图使用行走层、位置和通路；左侧选择文件。Ctrl+Space 类型提示，悬停查看签名，点击问题定位。');
    $('script-base').disabled=$('script-example').disabled=!editor.isEditing();dialog.showModal();codeEditor?.refresh();
  };
  $('script-search').oninput=renderTree;$('script-core').onclick=()=>showFile(CORE_MODULE);
  $('script-entry').onchange=()=>{project.entry=$('script-entry').value;dirty=true;stop();invalidate();renderTree();renderTabs();};
  $('script-base').onclick=()=>{stop();if(!backup())return;base=editor.document();replaceProject(levelToProject(base,{typescript:true}));if(save())message('已从画布生成 TypeScript 项目；之前的源码项目可恢复。');};
  $('script-example').onclick=()=>{stop();if(!backup())return;replaceProject(createProjectExample({typescript:true}));if(save())message('已载入 TypeScript 类复用示例；之前的项目可恢复。');};
  $('script-restore').onclick=()=>{stop();try{const previous=decode(JSON.parse(localStorage.getItem(storageKey+'.previous')));if(!backup())return;base=previous.base;replaceProject(previous.project);if(save())message('已恢复之前的源码项目。');}catch(error){message(error.message,true);}};
  function fileForm(mode){
    $('script-file-form').dataset.mode=mode;$('script-file-form').hidden=false;$('script-path-label').textContent=mode==='rename'?'重命名并更新 import':'新建 TypeScript / JavaScript 文件';
    $('script-path').value=mode==='rename'?active:'';$('script-path').focus();
  }
  $('script-new').onclick=()=>fileForm('new');$('script-rename').onclick=()=>fileForm('rename');
  $('script-file-cancel').onclick=()=>$('script-file-form').hidden=true;
  $('script-file-form').onsubmit=async e=>{
    e.preventDefault();try{
      const path=projectPath($('script-path').value.trim());
      if($('script-file-form').dataset.mode==='rename'){
        const before=JSON.stringify(project),from=active;
        const refs=Object.keys(project.files).some(p=>p.endsWith('.ts'))?await typeScriptClient().request('analyzeFiles',project):null;
        if(!dialog.open||before!==JSON.stringify(project)||active!==from)throw new Error('项目已变化，请重新重命名。');
        const next=renameProjectFile(project,from,path,refs?((source,file)=>refs[file]):undefined);if(!backup())return;project=next;opened.delete(active);changedFiles.delete(active);codeEditor?.reset();
      }else{
        if(Object.hasOwn(project.files,path))throw new Error('文件已存在：'+path);
        const next={...project,files:{...project.files,[path]:"import { Entity } from '@gothere/core';\n\n// 在这里定义可复用的类或函数。\n"}};validateProject(next);if(!backup())return;project=next;
      }
      stop();invalidate();dirty=true;changedFiles.add(path);showFile(path);message('文件已更新；Ctrl+S 保存项目，Ctrl+Enter 校验入口。');
    }catch(error){message(error.message,true);}
  };
  $('script-delete').onclick=()=>{
    if(active===CORE_MODULE)return;
    if(active===project.entry){message('请先在上方选择其他入口文件，再删除此文件。',true);return;}
    if(!backup())return;delete project.files[active];opened.delete(active);changedFiles.delete(active);dirty=true;stop();invalidate();showFile(project.entry);message('文件已删除，引用它的 import 需调整；可恢复之前的项目。');
  };
  source.oninput=()=>changed(source.value);
  dialog.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('script-generate').click();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(save())message('整个源码项目已保存，尚未应用到画布。');}
    else if(e.target===source&&e.key==='Tab'&&!e.shiftKey&&!source.readOnly){e.preventDefault();source.setRangeText('  ',source.selectionStart,source.selectionEnd,'end');source.dispatchEvent(new Event('input'));}
  },true);
  $('script-generate').onclick=async()=>{
    stop();invalidate();if(!save())return;const running=generateFromProject(project);task=running;$('script-generate').disabled=true;$('script-stop').disabled=false;message('正在生成 '+project.entry+'…');
    try{const level=await running.promise;if(task!==running)return;result=level;
      message(`校验通过 · 物体 ${base.entities.length} → ${level.entities.length} · 规则 ${base.rules.length} → ${level.rules.length} · 图层 ${base.scene?.nodes.length??0} → ${level.scene?.nodes.length??0}。可应用或另存。`);
      $('script-apply').disabled=$('script-import').disabled=!editor.isEditing();
    }catch(error){if(task===running)message(error.message,true);}
    finally{if(task===running){task=null;$('script-generate').disabled=false;$('script-stop').disabled=true;}}
  };
  $('script-stop').onclick=()=>{stop();message('已停止，画布未改变。');};
  const apply=separate=>{try{if(!result)return;let saved=true;if(separate){editor.importDocument(result);storageKey='gothere.authoring.'+editor.documentKey();saved=save();}else editor.applyDocument(result);if(saved){dialog.close();notify(separate?'已另存为新草稿。':'已应用 · Ctrl+Z 可撤销。');}else message('关卡已另存，但源码未能保存；请导出项目备份。',true);}catch(error){message(error.message,true);}};
  $('script-apply').onclick=()=>apply(false);$('script-import').onclick=()=>apply(true);
  $('script-export').onclick=()=>{try{validateProject(project);const bytes=globalThis.gothereProjectTools.zipProject(project.files,project.entry);download(bytes,'gothere-project.zip','application/zip');if(save())message('整个项目已导出，包含所有手写文件；重新载入 ZIP 可继续编辑。');}catch(error){message(error.message,true);}};
  $('script-export-file').onclick=()=>download(getSource(),active===CORE_MODULE?'gothere-core.d.ts':active.split('/').at(-1),'text/plain');
  $('script-load').onclick=()=>$('script-file').click();
  $('script-file').onchange=async()=>{
    const file=$('script-file').files[0];
    try{
      if(!file)return;if(file.size>3145728)throw new Error('导入文件不能超过3 MiB。');stop();
      let next;
      if(/\.zip$/i.test(file.name))next=globalThis.gothereProjectTools.unzipProject(new Uint8Array(await file.arrayBuffer()));
      else{
        const text=await file.text();
        if(/\.json$/i.test(file.name))next=levelToProject(parseDSL(text),{typescript:true});
        else if(/\.ts$/i.test(file.name)){
          if(!await typeScriptClient().request('isModule',{source:text,path:file.name}))throw new Error('TypeScript 文件需要静态 import 或 export。');
          next={version:1,entry:file.name,active:file.name,files:{[file.name]:text}};
        }
        else if(globalThis.gothereProjectTools.isModule(text))next={version:1,entry:file.name,active:file.name,files:{[file.name]:text}};
        else next=legacyToProject(text,base);
      }
      validateProject(next);if(!backup())return;replaceProject(next);if(save())message('项目已载入；之前的源码项目可恢复。');
    }catch(error){message(error.message,true);}finally{$('script-file').value='';}
  };
  $('close-script').onclick=()=>{if(save())dialog.close();};
  dialog.addEventListener('cancel',e=>{if(!save())e.preventDefault();});
  dialog.addEventListener('close',()=>{stop();codeEditor?.destroy();codeEditor=null;});
}
