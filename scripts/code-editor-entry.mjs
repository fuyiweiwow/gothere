import {basicSetup,EditorView} from 'codemirror';
import {javascript} from '@codemirror/lang-javascript';
import {autocompletion} from '@codemirror/autocomplete';
import {oneDark} from '@codemirror/theme-one-dark';

const signatures={
  addObject:'addObject(data) → 物体；注册完整的物体定义',
  addRule:'addRule(data) → 规则；注册完整的事件和动作',
  addArt:'addArt(data) → 图层；注册完整的美术图层',
  entity:'entity(id) → 已有物体',
  object:'object(id, { plane, x, width, height, ... }) → 新物体',
  behavior:'behavior(物体, id, 动作数组, 名称?) → 行为',
  on:'on(物体, 事件名, 动作数组, 条件数组?, 详情?) → 规则',
  set:'set(物体, 状态) → 改变状态动作',
  invoke:'invoke(物体, 行为名) → 调用动作',
  after:'after(秒数, 动作数组) → 延迟动作',
  move:'move(物体, { x, seconds, plane?, progress? }) → 移动动作',
  condition:'condition(物体, 状态) → 状态条件',
  empty:'empty() → 空白二维分层关卡',
};
function completeAPI(context){
  const match=context.matchBefore(/\b[a-zA-Z_$][\w$]*\.[\w]*/);if(!match)return null;
  const owner=match.text.slice(0,match.text.indexOf('.'));
  let items=signatures;
  if(owner!=='api'){
    const declarations=context.state.doc.toString().matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*api\.(?:entity|object|addObject)\s*\(/g);
    if(![...declarations].some(m=>m[1]===owner))return null;
    items={move:'move({ x, seconds, ... }) → 移动动作',set:'set(状态) → 改变状态动作',invoke:'invoke(行为名) → 调用行为动作',behavior:'behavior(id, 动作数组, 名称?) → 添加行为',on:'on(事件名, 动作数组, 条件数组?) → 添加规则',condition:'condition(状态) → 状态条件'};
  }
  return {from:match.from+owner.length+1,options:Object.entries(items).map(([label,info])=>({label,type:'method',info})),validFor:/^\w*$/};
}
globalThis.createGothereCodeEditor=(parent,onChange)=>{
  const view=new EditorView({parent,doc:'',extensions:[basicSetup,javascript(),oneDark,autocompletion({override:[completeAPI]}),
    EditorView.lineWrapping,EditorView.contentAttributes.of({'aria-label':'关卡 JavaScript 源码'}),
    EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString());})]});
  return {get:()=>view.state.doc.toString(),set:text=>view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}}),focus:()=>view.focus(),refresh:()=>view.requestMeasure(),destroy:()=>view.destroy()};
};
