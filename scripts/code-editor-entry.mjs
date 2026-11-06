import {basicSetup,EditorView} from 'codemirror';
import {EditorState} from '@codemirror/state';
import {javascript} from '@codemirror/lang-javascript';
import {autocompletion} from '@codemirror/autocomplete';
import {oneDark} from '@codemirror/theme-one-dark';
import {analyzeModule,isModule,zipProject,unzipProject} from './project-code-tools.mjs';

globalThis.gothereProjectTools={analyzeModule,isModule,zipProject,unzipProject};

const entityMethods={
  move:'move({ x, seconds, plane?, progress? }) → 移动动作',
  set:'set(状态) → 改变状态动作',invoke:'invoke(行为名) → 调用行为动作',
  behavior:'behavior(id, 动作数组, 名称?) → 定义行为，返回此对象',
  on:'on(事件名, 动作数组, 条件数组?, 详情?) → 注册事件，返回此对象',
  condition:'condition(状态) → 状态条件',data:'data → 物体的定义数据',id:'id → 物体标识',
};
const levelMethods={
  object:'object(id, { plane, x, width, height, ... }, Type?) → 新物体',
  addObject:'addObject(完整物体定义, Type?) → Entity',entity:'entity(id) → 查找物体',
  rule:'rule(完整事件规则) → 规则',art:'art(图层定义) → 图层',
  toJSON:'toJSON() → 关卡数据',data:'data → 地图、主角、终点与资源数据',api:'api → 底层编排 API',
};
const legacyMethods={
  addObject:'addObject(data) → 物体',addRule:'addRule(data) → 规则',addArt:'addArt(data) → 图层',
  entity:'entity(id) → 已有物体',object:'object(id, options) → 新物体',empty:'empty() → 空白关卡',
  behavior:'behavior(物体, id, 动作数组, 名称?) → 行为',on:'on(物体, 事件名, 动作数组, 条件数组?, 详情?) → 规则',
  set:'set(物体, 状态) → 状态动作',invoke:'invoke(物体, 行为名) → 调用动作',
  after:'after(秒数, 动作数组) → 延迟动作',move:'move(物体, 位置) → 移动动作',condition:'condition(物体, 状态) → 条件',
};
const actionMethods={after:'after(秒数, 动作数组) → 延迟动作',set:'set(物体或ID, 状态) → 状态动作',invoke:'invoke(物体或ID, 行为名) → 调用动作'};
function relative(from,target){
  const parent=from.split('/').slice(0,-1),parts=target.split('/');
  while(parent.length&&parent[0]===parts[0]){parent.shift();parts.shift();}
  const value='../'.repeat(parent.length)+parts.join('/');return value.startsWith('../')?value:'./'+value;
}

globalThis.createGothereCodeEditor=(parent,onChange)=>{
  let current=null,files=[];const states=new Map();
  function completeAPI(context){
    const quote=context.matchBefore(/['"][^'"\n]*/);
    if(quote&&/\b(?:from|import)\s*$/.test(context.state.sliceDoc(Math.max(0,quote.from-30),quote.from))){
      return {from:quote.from+1,options:['@gothere/core',...files.filter(p=>p!==current).map(p=>relative(current,p))].map(label=>({label,type:'module'})),validFor:/^[\w@./-]*$/};
    }
    const match=context.matchBefore(/\b[a-zA-Z_$][\w$]*\.[\w]*/);
    if(!match)return null;
    const owner=match.text.slice(0,match.text.indexOf('.')),doc=context.state.doc.toString();let items;
    if(owner==='api')items=legacyMethods;
    else if(owner==='Actions')items=actionMethods;
    else if(owner==='level'||new RegExp('\\b(?:const|let|var)\\s+'+owner+'\\s*=\\s*new\\s+Level\\s*\\(').test(doc))items=levelMethods;
    else if(owner==='this'&&/extends\s+Entity\b/.test(doc))items=entityMethods;
    else{
      const declarations=doc.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*(?:[\w$]+\.(?:entity|object|addObject)\s*\(|new\s+[A-Z][\w$]*\s*\()/g);
      if(![...declarations].some(m=>m[1]===owner))return null;items=entityMethods;
    }
    return {from:match.from+owner.length+1,options:Object.entries(items).map(([label,info])=>({label,type:['data','id','api'].includes(label)?'property':'method',info})),validFor:/^\w*$/};
  }
  function state(text,readOnly){
    return EditorState.create({doc:text,extensions:[basicSetup,javascript(),oneDark,autocompletion({override:[completeAPI]}),
      EditorView.lineWrapping,EditorState.readOnly.of(readOnly),EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({'aria-label':'关卡 JavaScript 源码'}),
      EditorView.updateListener.of(update=>{if(current)states.set(current,update.state);if(update.docChanged)onChange(update.state.doc.toString());})]});
  }
  const view=new EditorView({parent,state:state('',false)});
  return {
    get:()=>view.state.doc.toString(),
    set:text=>view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}}),
    open(path,text,{readOnly=false,files:paths=[]}={}){
      if(current)states.set(current,view.state);current=path;files=paths;
      const saved=states.get(path);view.setState(saved&&saved.doc.toString()===text?saved:state(text,readOnly));
    },
    reset(){states.clear();current=null;},focus:()=>view.focus(),refresh:()=>view.requestMeasure(),destroy:()=>view.destroy(),
  };
};
