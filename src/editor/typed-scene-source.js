import {sourceName} from './semantic-source.js';
import {sceneDirectoryAssets} from './project-assets.js';

const json=value=>JSON.stringify(value).replace(/"__proto__":/g,'["__proto__"]:');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const common=items=>Object.fromEntries(Object.entries(items[0]??{}).filter(([key,value])=>items.every(item=>Object.hasOwn(item,key)&&same(item[key],value))));

/** Artwork is composed through reusable templates and real references; never inferred gameplay. */
export function sceneProjectSource(level,{objects,layers,ref,behavior,state,constant}){
  const files={},scene=level.scene,imageNames=new Map(),soundNames=new Map(),templateNames=new Map(),visualNames=new Map(),used=new Set();
  const image=id=>'assets.'+directory.references.get(id),sound=id=>soundNames.has(id)?'assets.'+directory.soundReferences.get(id):constant('Sounds',id);
  function scanStyle(style){if(style.asset)imageNames.set(style.asset,imageNames.get(style.asset)??sourceName(style.asset,'image',used));for(const id of style.animation?.frames??[])imageNames.set(id,imageNames.get(id)??sourceName(id,'image',used));}
  for(const node of scene?.nodes??[]){scanStyle(node);Object.values(node.variants??{}).forEach(scanStyle);visualNames.set(node.id,sourceName(node.id,'view',used));}
  for(const asset of scene?.assets??[])if(!imageNames.has(asset.id))imageNames.set(asset.id,sourceName(asset.id,'image',used));
  for(const s of scene?.sounds??[])soundNames.set(s.id,sourceName(s.id,'sound',used));
  const directory=sceneDirectoryAssets(scene,imageNames.keys());
  const enumKeys={motion:'Motions',particles:'Particles',policy:'FeedbackPolicies'};
  function style(options){
    return '{ '+Object.entries(options).map(([key,value])=>{
      let text=json(value);
      if(key==='asset')text=image(value);
      if(key==='animation'&&value!==null)text='{ '+Object.entries(value).map(([k,v])=>json(k)+': '+(k==='frames'?'['+v.map(image).join(', ')+']':json(v))).join(', ')+' }';
      if(key==='sound')text=sound(value);
      if(enumKeys[key])text=constant(enumKeys[key],value);
      return json(key)+': '+text;
    }).join(', ')+' }';
  }
  const templateDefaults=new Map();
  for(const [id,name]of imageNames){
    const nodes=(scene?.nodes??[]).filter(n=>n.asset===id);if(!nodes.length)continue;
    const candidates=nodes.map(n=>Object.fromEntries(Object.entries(n).filter(([k])=>!['id','asset','label','group','x','y','bind','anchor','variants','ground'].includes(k))));
    templateDefaults.set(id,common(candidates));templateNames.set(id,sourceName(id,'style',used));
  }
  files['resources.ts']=`// 图片和音效按 assets 目录自动登记。\nexport { createAssets as createResources } from '@gothere/assets';\n`;
  if(!scene)return {files,assets:directory.assets};
  files['scene/styles.ts']=`import { type Scene } from '@gothere/core';\nimport type { createResources } from '../resources.ts';\n\nexport function createStyles(scene: Scene, assets: ReturnType<typeof createResources>) {\n  return {\n${[...templateNames].map(([id,name])=>'    '+name+': scene.template('+image(id)+', '+style(templateDefaults.get(id))+')').join(',\n')}\n  };\n}\n`;
  const groups=new Map();for(const node of scene.nodes){let group=node.group??'ungrouped';if(groups.size>=32&&!groups.has(group))group='additional-groups';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(node);}
  const groupUsed=new Set();
  for(const [group,nodes]of groups){
    const name=sourceName(group,'group',groupUsed),path='scene/'+name+'.ts',lines=[];
    for(const node of nodes){
      const defaults=templateDefaults.get(node.asset),extras=Object.fromEntries(Object.entries(node).filter(([key,value])=>!['id','asset','label','group','x','y','width','height','layer','bind','anchor','variants'].includes(key)&&!same(defaults[key],value)));
      let expression=`styles.${templateNames.get(node.asset)}.place(${json(node.id)}).label(${json(node.label)}${Object.hasOwn(node,'group')?', '+json(node.group):''}).at(${node.x}, ${node.y})`;
      if(defaults.width!==node.width||defaults.height!==node.height)expression+=`.size(${node.width}, ${node.height})`;
      if(defaults.layer!==node.layer)expression+=`.order(${node.layer})`;
      if(node.bind){const b=node.bind;expression+=b.type==='entity'?`.bind(${ref(b.id)})`:b.type==='platform'?`.platform(${b.index})`:`.bind(scene.${b.type})`;}
      if(node.anchor){const a=node.anchor;if(layers.has(a.plane)&&a.depth===level.spatial.planes.find(p=>p.id===a.plane)?.depth&&Object.keys(a).every(k=>['plane','x','depth','height'].includes(k)))expression+=`.anchor(context.layers.${layers.get(a.plane)}.at(${a.x}, { height: ${a.height} }))`;else extras.anchor=a;}
      if(Object.keys(extras).length)expression+=`.properties(${style(extras)})`;
      for(const [key,value]of Object.entries(node.variants??{}))expression+=`\n    .variant(${['moving','carried','idle','forward','backward','inward','outward','upward','downward'].includes(key)?constant('VisualStates',key):state(key)}, ${style(value)})`;
      if(node.variants&&Object.keys(node.variants).length===0)expression+='.properties({ variants: {} })';
      lines.push(`  const ${visualNames.get(node.id)} = ${expression};`);
    }
    files[path]=`import { VisualStates, States, sceneGroup } from '@gothere/core';\nimport type { ProjectContext } from '../context.ts';\nimport type { Objects } from '@gothere/objects';\nimport type { createStyles } from './styles.ts';\n\nexport function ${name}(context: ProjectContext, objects: Objects, styles: ReturnType<typeof createStyles>) {\n  const { scene, assets } = context;\n${lines.join('\n')}\n  return { ${nodes.map(n=>visualNames.get(n.id)).join(', ')} };\n}\n\nexport const ${name}Group = sceneGroup(${name}, { order: ${[...groups.keys()].indexOf(group)} });\n`;
  }
  files['scene/visuals.ts']=`import type { ProjectContext } from '../context.ts';\nimport type { Objects } from '@gothere/objects';\nimport { createStyles } from './styles.ts';\nimport { createSceneGroups } from '@gothere/scene-groups';\n\nexport function createVisuals(context: ProjectContext, objects: Objects) {\n  const styles = createStyles(context.scene, context.assets);\n  const visuals = createSceneGroups(context, objects, styles);\n  context.scene.arrange([${scene.nodes.map(n=>'visuals.'+visualNames.get(n.id)).join(', ')}], { appendRemaining: true });\n  return visuals;\n}\n\nexport type Visuals = ReturnType<typeof createVisuals>;\n`;
  const cues=scene.feedback??[],defaults=common(cues.map(({id,target,trigger,...options})=>options));
  const trigger=t=>{
    const {type,source,behavior:slot,...rest}=t;
    if(type==='behavior'&&behavior(source,slot))return `{ type: FeedbackTriggers.Behavior, behavior: ${behavior(source,slot)}${Object.keys(rest).length?', ...'+json(rest):''} }`;
    const fields=Object.entries(rest).map(([key,value])=>json(key)+': '+(key==='event'?constant('Events',value):key==='state'?state(value):json(value)));
    if(source!==undefined)fields.unshift('source: '+(objects.has(source)?ref(source):json(source)));
    if(slot!==undefined)fields.push('behavior: '+(type==='event'&&behavior(source,slot)?behavior(source,slot):json(slot)));
    return `{ type: ${constant('FeedbackTriggers',type)}${fields.length?', '+fields.join(', '):''} }`;
  };
  files['scene/feedback.ts']=`import { Events, States, Motions, Particles, Sounds, FeedbackPolicies, FeedbackTriggers } from '@gothere/core';\nimport type { ProjectContext } from '../context.ts';\nimport type { Objects } from '../objects/index.ts';\nimport type { Visuals } from './visuals.ts';\n\nexport function addFeedback(context: ProjectContext, objects: Objects, visuals: Visuals) {\n  const { scene, assets } = context;\n  const feedback = scene.feedbackTemplate(${style(defaults)});\n${cues.map(f=>{const options=Object.fromEntries(Object.entries(f).filter(([k,v])=>!['id','target','trigger'].includes(k)&&!same(defaults[k],v)));return `  feedback.attach(${json(f.id)}, visuals.${visualNames.get(f.target)}, ${trigger(f.trigger)}, ${style(options)});`;}).join('\n')}\n}\n`;
  const composition=(scene.compositions??[]).map(c=>{const {id,nodes,entities,...options}=c;return `  scene.compose(${json(id)}, { ...${json(options)}, nodes: [${nodes.map(id=>'visuals.'+visualNames.get(id)).join(', ')}], entities: [${entities.map(ref).join(', ')}] });`;}).join('\n');
  const {nodes,assets,sounds,feedback,compositions,...options}=scene;
  files['scene/compositions.ts']=`import type { ProjectContext } from '../context.ts';\nimport type { Objects } from '../objects/index.ts';\nimport type { Visuals } from './visuals.ts';\n\nexport function addCompositions(context: ProjectContext, objects: Objects, visuals: Visuals) {\n  const { scene } = context;\n${composition}\n}\n`;
  files['scene.ts']=`import type { ProjectContext } from './context.ts';\nimport type { Objects } from './objects/index.ts';\nimport { createVisuals } from './scene/visuals.ts';\nimport { addFeedback } from './scene/feedback.ts';\nimport { addCompositions } from './scene/compositions.ts';\n\nexport function addScene(context: ProjectContext, objects: Objects) {\n  const { scene } = context;\n  scene.configure(${json({...options,...(sounds?.length===0?{sounds:[]}:{}),...(feedback?{feedback:[]}:{}),...(compositions?{compositions:[]}:{})})});\n  const visuals = createVisuals(context, objects);\n  addFeedback(context, objects, visuals);\n  addCompositions(context, objects, visuals);\n  return visuals;\n}\n`;
  return {files,assets:directory.assets};
}
