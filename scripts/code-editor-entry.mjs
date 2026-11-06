import {basicSetup,EditorView} from 'codemirror';
import {EditorState,Prec} from '@codemirror/state';
import {javascript} from '@codemirror/lang-javascript';
import {autocompletion} from '@codemirror/autocomplete';
import {hoverTooltip,keymap} from '@codemirror/view';
import {setDiagnostics,lintGutter} from '@codemirror/lint';
import {oneDark} from '@codemirror/theme-one-dark';
import {indentWithTab} from '@codemirror/commands';
import {analyzeModule,isModule,zipProject,unzipProject} from './project-code-tools.mjs';
import {typeScriptClient} from '../src/editor/typescript-client.js';

globalThis.gothereProjectTools={analyzeModule,isModule,zipProject,unzipProject};

function relative(from,target){
  const parent=from.split('/').slice(0,-1),parts=target.split('/');
  while(parent.length&&parent[0]===parts[0]){parent.shift();parts.shift();}
  const value='../'.repeat(parent.length)+parts.join('/');return value.startsWith('../')?value:'./'+value;
}

globalThis.createGothereCodeEditor=(parent,onChange,{project:getProject,onDiagnostics=()=>{},onNavigate=()=>{},onNotice=()=>{}}={})=>{
  let current=null,files=[],timer,revision=0,destroyed=false;const states=new Map();
  const snapshot=()=>getProject?.();
  const navigation=[];
  async function definition(position=view.state.selection.main.head){
    const project=snapshot(),path=current,doc=view.state.doc;if(!project||!Object.hasOwn(project.files,path))return;
    try{
      const definitions=await typeScriptClient().request('definitions',project,path,position);
      if(destroyed||current!==path||view.state.doc!==doc)return;
      const target=definitions[0];if(!target){onNotice('当前位置没有可跳转的项目定义。');return;}
      navigation.push({path,position});onNavigate(target.path,target.start);
    }catch(error){if(!destroyed)onNotice(error.message);}
  }
  function back(){const target=navigation.pop();if(target)onNavigate(target.path,target.position);else onNotice('没有更早的源码位置。');return true;}
  function check(){
    clearTimeout(timer);const ticket=++revision;
    timer=setTimeout(async()=>{
      const project=snapshot();if(!project||destroyed)return;
      try{
        const diagnostics=await typeScriptClient().request('diagnostics',project);
        if(destroyed||ticket!==revision)return;
        onDiagnostics(diagnostics);
        const size=view.state.doc.length;
        view.dispatch(setDiagnostics(view.state,diagnostics.filter(d=>d.path===current).map(d=>({
          from:Math.min(d.start,size),to:Math.min(d.start+Math.max(1,d.length),size),severity:d.severity,
          message:`TS${d.code} ${d.message}`,source:'TypeScript'
        }))));
      }catch(error){if(!destroyed&&ticket===revision)onDiagnostics([],error.message);}
    },350);
  }
  async function complete(context){
    const quote=context.matchBefore(/['"][^'"\n]*/);
    if(quote&&/\b(?:from|import)\s*$/.test(context.state.sliceDoc(Math.max(0,quote.from-30),quote.from))){
      return {from:quote.from+1,options:['@gothere/core',...files.filter(p=>p!==current).map(p=>relative(current,p))].map(label=>({label,type:'module'})),validFor:/^[\p{ID_Continue}$@./-]*$/u};
    }
    const word=context.matchBefore(/[\p{ID_Continue}$]*/u),project=snapshot(),path=current;
    if(!project||!Object.hasOwn(project.files,path)||!context.explicit&&!word?.text&&!context.matchBefore(/\.$/))return null;
    const options=await typeScriptClient().request('completions',project,path,context.pos);
    if(context.aborted||destroyed||current!==path)return null;
    return {from:word?.from??context.pos,options,validFor:/^[\p{ID_Continue}$]*$/u};
  }
  const hover=hoverTooltip(async(view,pos)=>{
    const project=snapshot(),path=current,doc=view.state.doc;
    if(!project||!Object.hasOwn(project.files,path))return null;
    try{
      const info=await typeScriptClient().request('hover',project,path,pos);
      if(!info||destroyed||current!==path||view.state.doc!==doc)return null;
      return {pos:info.start,end:info.start+info.length,create(){
        const dom=document.createElement('div');dom.className='script-type-tooltip';
        const code=document.createElement('pre');code.textContent=info.text;dom.append(code);
        if(info.documentation){const p=document.createElement('p');p.textContent=info.documentation;dom.append(p);}
        return {dom};
      }};
    }catch{return null;}
  });
  function state(text,readOnly,path=''){
    return EditorState.create({doc:text,extensions:[basicSetup,javascript({typescript:path.endsWith('.ts')||path==='@gothere/core'}),oneDark,
      Prec.high(keymap.of([indentWithTab,{key:'F12',run:()=>{void definition();return true;}},{key:'Alt-ArrowLeft',run:back}])),
      Prec.high(EditorView.domEventHandlers({mousedown(event,view){
        if(event.button!==0||!event.ctrlKey&&!event.metaKey)return false;
        const position=view.posAtCoords({x:event.clientX,y:event.clientY});if(position===null)return false;
        void definition(position);return true;
      }})),
      autocompletion({override:[context=>complete(context).catch(()=>null)]}),lintGutter(),hover,
      EditorView.lineWrapping,EditorState.readOnly.of(readOnly),EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({'aria-label':'关卡 TypeScript / JavaScript 源码'}),
      EditorView.updateListener.of(update=>{if(current)states.set(current,update.state);if(update.docChanged){onChange(update.state.doc.toString());check();}})]});
  }
  const view=new EditorView({parent,state:state('',false)});
  return {
    get:()=>view.state.doc.toString(),
    set:text=>view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}}),
    open(path,text,{readOnly=false,files:paths=[]}={}){
      if(current)states.set(current,view.state);current=path;files=paths;
      const saved=states.get(path);view.setState(saved&&saved.doc.toString()===text?saved:state(text,readOnly,path));check();
    },
    jump(position){const at=Math.min(position,view.state.doc.length);view.dispatch({selection:{anchor:at},effects:EditorView.scrollIntoView(at,{y:'center'})});view.focus();},
    check,
    definition,back,
    reset(){states.clear();navigation.length=0;current=null;clearTimeout(timer);revision++;},
    focus:()=>view.focus(),refresh:()=>view.requestMeasure(),
    destroy(){destroyed=true;clearTimeout(timer);revision++;view.destroy();},
  };
};
