import {generateFromProject} from './authoring.js';
import {levelToProject,legacyToProject,createProjectExample,authoringLibrarySource,validateProject,projectPath,renameProjectFile,CORE_MODULE} from './javascript-project.js';
import {parseDSL} from './dsl.js';
import {typeScriptClient} from './typescript-client.js';
import {sameDocument,documentChanges,changeValue} from './authoring-changes.js';
import {createAuthoringNavigator} from './authoring-navigator.js';
import {createAuthoringPreview} from './authoring-preview.js';
import {ASSETS_INDEX,assetModule,assetKeys} from './project-assets.js';
import {showProjectAsset,importProjectAssets,projectAssetDefinition} from './project-asset-ui.js';

export function createAuthoringUI({editor,notify,download,pause}) {
  const $=id=>document.getElementById(id),dialog=$('script-dialog'),source=$('script-source');
  let base,baseline,project,active,storageKey,result,task,codeEditor,reviewedCanvas,programmatic=false,dirty=false,hasSaved=false;
  const changedFiles=new Set(),opened=new Set(),collapsed=new Set();
  const core=globalThis.gothereAuthoringTypes??authoringLibrarySource();
  const trial=createAuthoringPreview({root:dialog,onInspect:id=>navigator.inspect(id)});
  const navigator=createAuthoringNavigator({project:()=>project,navigate:(path,position)=>{showFile(path);codeEditor?.jump(position);},notice:text=>message(text),onSelect:id=>trial.select(id),isOpen:()=>dialog.open});
  function previewVisible(visible){$('script-preview').hidden=!visible;dialog.classList.toggle('has-script-preview',visible);if(!visible)trial.pause();codeEditor?.refresh();}
  function lifecycle(){
    $('script-save-state').textContent=dirty?(hasSaved?'源码有未保存修改':'源码尚未保存'):'源码已保存在本机';
    if(!baseline)return;
    const current=editor.document(),drift=documentChanges(baseline,current);
    $('script-drift').hidden=!drift.length;
    $('script-drift').textContent=`画布有 ${drift.length} 处后续修改，尚未同步到源码。应用旧源码可能覆盖这些内容，请查看下方差异。`;
    $('script-application-state').textContent=result?(sameDocument(current,result)?'生成结果与画布一致':'生成结果尚未应用'):(drift.length?'画布已偏离源码基准':'画布与上次同步基准一致');
    $('script-overwrite').hidden=!result||!drift.length;
  }
  function changes(){
    const current=editor.document();
    if(!sameDocument(current,reviewedCanvas)){$('script-overwrite-confirm').checked=false;reviewedCanvas=current;}
    const list=$('script-change-list');list.replaceChildren();$('script-changes').hidden=!result;
    if(result){const edits=documentChanges(current,result);$('script-change-count').textContent=`相对当前画布 · ${edits.length} 处变更`;
      for(const edit of edits.slice(0,200)){const row=document.createElement('div');row.className='script-change';
        const title=document.createElement('strong');title.textContent=edit.label;
        const path=document.createElement('code');path.textContent=edit.path;
        const value=document.createElement('span');value.textContent=changeValue(edit.before,edit.path)+' → '+changeValue(edit.after,edit.path);row.append(title,path,value);list.append(row);}
      if(edits.length>200){const p=document.createElement('p');p.textContent=`显示前 200 处，共 ${edits.length} 处；可导出关卡进行完整对比。`;list.append(p);}
    }
    lifecycle();
  }
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
  function invalidate(){trial.pause();result=null;$('script-overwrite-confirm').checked=false;$('script-apply').disabled=$('script-import').disabled=true;$('script-generation-state').textContent='需要重新生成';$('script-preview-stale').hidden=$('script-preview').hidden;changes();}
  function stop(){if(task){task.cancel();$('script-generation-state').textContent='生成已停止 · 画布未改变';}task=null;$('script-generate').disabled=$('script-play').disabled=false;$('script-stop').disabled=true;}
  function save(){try{validateProject(project);localStorage.setItem(storageKey,JSON.stringify({project,base,baseline}));dirty=false;hasSaved=true;changedFiles.clear();renderTabs();return true;}catch(error){dirty=true;lifecycle();message('保存失败：'+error.message+' 请导出项目备份。',true);return false;}}
  function backup(){try{localStorage.setItem(storageKey+'.previous',JSON.stringify({project,base,baseline}));return true;}catch{message('未能备份当前项目，请先导出后再试。',true);return false;}}
  function decode(saved){
    if(!saved?.base)throw new Error('缺少源码基稿。');
    if(saved.project)return {base:saved.base,baseline:saved.baseline??saved.base,project:validateProject(saved.project)};
    if(typeof saved.source==='string')return {base:saved.base,baseline:saved.base,project:legacyToProject(saved.source,saved.base)};
    throw new Error('源码草稿格式不正确。');
  }
  function changed(text){
    source.value=text;if(programmatic||active===CORE_MODULE||active===ASSETS_INDEX||Object.hasOwn(project.assets??{},active))return;
    project.files[active]=text;dirty=true;changedFiles.add(active);stop();invalidate();renderTabs();navigator.changed();
  }
  function showFile(path){
    const asset=Object.hasOwn(project.assets??{},path),generated=path===ASSETS_INDEX&&project.version===2,readonly=path===CORE_MODULE||generated;
    if(path!==CORE_MODULE&&!generated&&!asset&&!Object.hasOwn(project.files,path))return;
    active=path;opened.add(path);if(path!==CORE_MODULE)project.active=path;
    const viewer=$('script-asset-preview');showProjectAsset(viewer,project,asset?path:null);viewer.hidden=!asset;
    $('code-editor').hidden=asset||!codeEditor;source.hidden=asset||!!codeEditor;
    programmatic=true;const text=path===CORE_MODULE?core:generated?assetModule(project).source:asset?'':project.files[path];source.value=text;source.readOnly=readonly||asset;
    if(codeEditor)codeEditor.open(path,text,{readOnly:readonly||asset,files:Object.keys(project.files)});
    programmatic=false;
    $('script-current-path').textContent=path;$('script-readonly').hidden=!readonly;$('script-readonly').textContent=generated?'自动目录索引 · 只读':'内置基础库 · 只读';
    $('script-rename').disabled=$('script-delete').disabled=readonly;
    $('script-definition').disabled=asset||generated;
    $('script-file-form').hidden=true;renderTree();renderTabs();codeEditor?.refresh();
  }
  function renderTabs(){
    $('script-tabs').replaceChildren();
    for(const path of opened){
      const tab=document.createElement('div');tab.className='script-tab';
      const button=document.createElement('button');button.type='button';button.role='tab';button.dataset.scriptTab=path;
      button.setAttribute('aria-selected',String(path===active));button.title=path;
      button.textContent=(path===CORE_MODULE?'core.d.ts':path.split('/').at(-1))+(changedFiles.has(path)?' •':'');button.onclick=()=>showFile(path);tab.append(button);
      if(path!==project.entry){const close=document.createElement('button');close.type='button';close.className='script-tab-close';close.setAttribute('aria-label','关闭 '+path);close.textContent='×';close.onclick=()=>{opened.delete(path);if(active===path)showFile([...opened].at(-1)??project.entry);else renderTabs();};tab.append(close);}
      $('script-tabs').append(tab);
    }
    lifecycle();
  }
  function renderTree(){
    const tree=$('script-tree'),filter=$('script-search').value.trim().toLowerCase();tree.replaceChildren();
    const root={folders:new Map(),files:[]};
    for(const path of [...Object.keys(project.files),...Object.keys(project.assets??{}),...(project.version===2?[ASSETS_INDEX]:[])].sort()){
      if(filter&&!path.toLowerCase().includes(filter))continue;
      const parts=path.split('/');let folder=root;
      for(const part of parts.slice(0,-1)){if(!folder.folders.has(part))folder.folders.set(part,{folders:new Map(),files:[]});folder=folder.folders.get(part);}
      folder.files.push(path);
    }
    function draw(folder,prefix='',depth=0){
      for(const path of folder.files){
        const button=document.createElement('button');button.type='button';button.className='script-tree-file';button.dataset.scriptPath=path;button.style.paddingLeft=(12+depth*14)+'px';button.title=path;
        button.setAttribute('aria-current',String(path===active));
        const icon=document.createElement('span');icon.className='script-js-icon';icon.textContent=Object.hasOwn(project.assets??{},path)?path.startsWith('assets/images/')?'IMG':'SND':path.endsWith('.ts')?'TS':'JS';
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
    $('script-file-count').textContent=Object.keys(project.files).length+' 源码 · '+Object.keys(project.assets??{}).length+' 资源';
  }
  function replaceProject(next){
    validateProject(next);project=structuredClone(next);opened.clear();changedFiles.clear();collapsed.clear();$('script-search').value='';codeEditor?.reset();diagnostics([]);
    opened.add(project.entry);dirty=true;trial.clear();previewVisible(false);navigator.reset();showFile(Object.hasOwn(project.files,project.active)||Object.hasOwn(project.assets??{},project.active)?project.active:project.entry);invalidate();
    if(dialog.open)void navigator.refresh();
  }
  $('open-script').onclick=()=>{
    pause();storageKey='gothere.authoring.'+editor.documentKey();base=editor.document();baseline=base;hasSaved=false;
    try{const raw=localStorage.getItem(storageKey);if(raw){const saved=decode(JSON.parse(raw));base=saved.base;baseline=saved.baseline;project=saved.project;hasSaved=true;}else project=levelToProject(base,{typescript:true});$('script-canvas-backup').hidden=!localStorage.getItem(storageKey+'.canvas.previous');}
    catch(error){notify('读取源码项目失败，原存储已保留：'+error.message);return;}
    if(typeof globalThis.createGothereCodeEditor==='function'){codeEditor=globalThis.createGothereCodeEditor($('code-editor'),changed,{project:()=>project,onDiagnostics:diagnostics,onNavigate:(path,position)=>{showFile(path);codeEditor.jump(position);},onNotice:text=>message(text)});source.hidden=true;$('code-editor').hidden=false;}
    else{source.hidden=false;$('code-editor').hidden=true;}
    replaceProject(project);dirty=!hasSaved;changedFiles.clear();renderTabs();
    invalidate();message('左侧选择文件；Ctrl+Space 类型提示，F12 或 Ctrl+单击转到定义，Alt+← 返回。场景按模板和分组编排。');
    $('script-base').disabled=$('script-example').disabled=!editor.isEditing();dialog.showModal();codeEditor?.refresh();
    $('script-generation-state').textContent='尚未生成 · 可校验或临时试玩';
    void navigator.refresh({focusId:editor.selection()?.type==='entity'?editor.selection().id:null});
  };
  $('script-search').oninput=renderTree;$('script-core').onclick=()=>showFile(CORE_MODULE);
  $('script-definition').onclick=()=>codeEditor?.definition();$('script-back').onclick=()=>codeEditor?.back();
  $('script-entry').onchange=()=>{project.entry=$('script-entry').value;dirty=true;stop();invalidate();renderTree();renderTabs();};
  $('script-base').onclick=()=>{stop();if(!backup())return;base=editor.document();baseline=base;replaceProject(levelToProject(base,{typescript:true}));if(save())message('已从画布生成 TypeScript 项目；之前的源码项目可恢复。');};
  $('script-example').onclick=()=>{stop();if(!backup())return;replaceProject(createProjectExample({typescript:true}));if(save())message('已载入 TypeScript 类复用示例；之前的项目可恢复。');};
  $('script-restore').onclick=()=>{stop();try{const previous=decode(JSON.parse(localStorage.getItem(storageKey+'.previous')));if(!backup())return;base=previous.base;baseline=previous.baseline;replaceProject(previous.project);if(save())message('已恢复之前的源码项目。');}catch(error){message(error.message,true);}};
  function fileForm(mode){
    $('script-file-form').dataset.mode=mode;$('script-file-form').hidden=false;$('script-path-label').textContent=mode==='rename'?'重命名并更新 import':'新建 TypeScript / JavaScript 文件';
    $('script-path').value=mode==='rename'?active:'';if(mode==='rename'&&Object.hasOwn(project.assets??{},active))$('script-path-label').textContent='移动资源并更新完整目录引用（保留资源 ID）';$('script-path').focus();
  }
  $('script-new').onclick=()=>fileForm('new');$('script-rename').onclick=()=>fileForm('rename');
  $('script-file-cancel').onclick=()=>$('script-file-form').hidden=true;
  $('script-file-form').onsubmit=async e=>{
    e.preventDefault();try{
      const renamingAsset=$('script-file-form').dataset.mode==='rename'&&Object.hasOwn(project.assets??{},active);
      const path=$('script-path').value.trim();if(renamingAsset)assetKeys(path);else projectPath(path);
      if($('script-file-form').dataset.mode==='rename'){
        const before=JSON.stringify(project),from=active;
        const nextAsset=renamingAsset?await typeScriptClient().request('renameAsset',project,from,path):null;
        const refs=!renamingAsset&&Object.keys(project.files).some(p=>p.endsWith('.ts'))?await typeScriptClient().request('analyzeFiles',project):null;
        if(!dialog.open||before!==JSON.stringify(project)||active!==from)throw new Error('项目已变化，请重新重命名。');
        const next=nextAsset??renameProjectFile(project,from,path,refs?((source,file)=>refs[file]):undefined);if(!backup())return;project=next;opened.delete(active);changedFiles.delete(active);codeEditor?.reset();
      }else{
        if(Object.hasOwn(project.files,path))throw new Error('文件已存在：'+path);
        const next={...project,files:{...project.files,[path]:"import { Entity } from '@gothere/core';\n\n// 在这里定义可复用的类或函数。\n"}};validateProject(next);if(!backup())return;project=next;
      }
      stop();invalidate();dirty=true;changedFiles.add(path);showFile(path);navigator.changed();message('文件已更新；Ctrl+S 保存项目，Ctrl+Enter 校验入口。');
    }catch(error){message(error.message,true);}
  };
  $('script-delete').onclick=()=>{
    if(active===CORE_MODULE||active===ASSETS_INDEX)return;
    if(active===project.entry){message('请先在上方选择其他入口文件，再删除此文件。',true);return;}
    if(!backup())return;if(Object.hasOwn(project.assets??{},active))delete project.assets[active];else delete project.files[active];opened.delete(active);changedFiles.delete(active);dirty=true;stop();invalidate();showFile(project.entry);navigator.changed();message('文件已删除，失效引用会在校验时报告；可恢复之前的项目。');
  };
  source.oninput=()=>changed(source.value);
  dialog.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(e.key==='F5'){e.preventDefault();e.stopPropagation();$('script-play').click();}
    else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopPropagation();navigator.search();}
    else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('script-generate').click();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(save())message('整个源码项目已保存，尚未应用到画布。');}
    else if(e.target===source&&e.key==='Tab'&&!e.shiftKey&&!source.readOnly){e.preventDefault();source.setRangeText('  ',source.selectionStart,source.selectionEnd,'end');source.dispatchEvent(new Event('input'));}
  },true);
  async function generate({play=false}={}){
    stop();invalidate();if(!save())return;const running=generateFromProject(project);task=running;$('script-generate').disabled=$('script-play').disabled=true;$('script-stop').disabled=false;message('正在生成 '+project.entry+'…');$('script-generation-state').textContent='正在生成…';
    try{const level=await running.promise;if(task!==running)return;result=level;
      changes();$('script-generation-state').textContent='当前源码已生成并通过校验';$('script-preview-stale').hidden=true;
      message('校验通过。下方列出相对当前画布的具体变更；临时试玩不会修改画布。');
      $('script-apply').disabled=$('script-import').disabled=!editor.isEditing();
      previewVisible(true);void trial.show(level,{run:play}).catch(error=>{if(task===running||result===level)message('预览加载失败：'+error.message,true);});
    }catch(error){if(task===running){$('script-generation-state').textContent='生成失败 · 画布未改变';message(error.message,true);}}
    finally{if(task===running){task=null;$('script-generate').disabled=$('script-play').disabled=false;$('script-stop').disabled=true;}}
  }
  $('script-generate').onclick=()=>void generate();$('script-play').onclick=()=>void generate({play:true});
  $('script-preview-close').onclick=()=>previewVisible(false);
  $('script-stop').onclick=()=>{stop();message('已停止，画布未改变。');};
  const apply=separate=>{try{
    if(!result)return;const current=editor.document(),drift=!sameDocument(current,baseline);
    if(!separate&&drift&&(!$('script-overwrite-confirm').checked||!sameDocument(current,reviewedCanvas))){changes();$('script-changes').open=true;message('画布存在后续修改，请先查看具体差异并勾选替换，或另存为新草稿。',true);return;}
    if(!separate&&!sameDocument(current,result)){
      try{localStorage.setItem(storageKey+'.canvas.previous',JSON.stringify({level:current}));$('script-canvas-backup').hidden=false;}
      catch(error){message('无法备份替换前画布，尚未应用。请先导出或释放本机存储：'+error.message,true);return;}
    }
    if(separate){editor.importDocument(result);storageKey='gothere.authoring.'+editor.documentKey();$('script-canvas-backup').hidden=true;}else editor.applyDocument(result);
    baseline=structuredClone(result);changes();
    if(save()){dialog.close();notify(separate?'已另存为新草稿。':'已应用 · Ctrl+Z 可撤销。');}
    else message('关卡已应用，但源码未能保存；请导出项目备份。',true);
  }catch(error){message('未能完成应用：'+error.message,true);}};
  $('script-apply').onclick=()=>apply(false);$('script-import').onclick=()=>apply(true);
  $('script-canvas-backup').onclick=()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey+'.canvas.previous'));if(!saved?.level)throw new Error('没有替换前画布备份。');download(JSON.stringify(saved.level,null,2),'gothere-before-source-apply.json','application/json');message('已导出最近一次替换前的画布，可从关卡导入恢复。');}catch(error){message(error.message,true);}};
  $('script-export').onclick=()=>{try{validateProject(project);const bytes=globalThis.gothereProjectTools.zipProject(project.files,project.entry,project.version===2?project.assets??{}:undefined);download(bytes,'gothere-project.zip','application/zip');if(save())message('整个项目已导出，包含源码、图片、音效及稳定资源标识。');}catch(error){message(error.message,true);}};
  $('script-export-file').onclick=()=>{const definition=projectAssetDefinition(project,active);if(definition){const a=document.createElement('a');a.href=definition.src;a.download=active.split('/').at(-1);a.click();}else download(getSource(),active===CORE_MODULE?'gothere-core.d.ts':active.split('/').at(-1),'text/plain');};
  $('script-add-assets').onclick=()=>$('script-asset-file').click();
  $('script-add-folder').onclick=()=>$('script-asset-folder').click();
  for(const id of ['script-asset-file','script-asset-folder'])$(id).onchange=async()=>{
    const input=$(id),snapshot=JSON.stringify(project),files=[...input.files];
    try{
      if(!files.length)return;
      const folder=id==='script-asset-folder',destination=$('script-asset-destination').value.trim().replace(/\/$/,'');
      const imported=await importProjectAssets(project,files,{folder,destination:destination?destination+'/':''});
      if(!dialog.open||snapshot!==JSON.stringify(project))throw new Error('项目已变化，请重新导入资源。');
      validateProject(imported.project);if(!backup())return;
      project=imported.project;stop();invalidate();dirty=true;codeEditor?.reset();showFile(imported.path);navigator.changed();if(save())message('目录资源已登记，可通过 @gothere/assets 的 createAssets(level) 获取类型化引用。');
    }catch(error){message(error.message,true);}finally{input.value='';}
  };
  $('script-load').onclick=()=>$('script-file').click();
  $('script-file').onchange=async()=>{
    const file=$('script-file').files[0];
    try{
      if(!file)return;if(file.size>4194304)throw new Error('导入文件不能超过4 MiB。');stop();
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
      validateProject(next);if(!backup())return;baseline=editor.document();replaceProject(next);if(save())message('项目已载入；之前的源码项目可恢复。');
    }catch(error){message(error.message,true);}finally{$('script-file').value='';}
  };
  $('close-script').onclick=()=>{if(save())dialog.close();};
  dialog.addEventListener('cancel',e=>{if(!save())e.preventDefault();});
  dialog.addEventListener('close',()=>{stop();trial.clear();showProjectAsset($('script-asset-preview'),project,null);navigator.stop();codeEditor?.destroy();codeEditor=null;});
  return {canvasChanged(){if(dialog.open)changes();}};
}
