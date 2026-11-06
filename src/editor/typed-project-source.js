import {semanticMapSource,sourceLiteral,sourceName} from './semantic-source.js';
import {sceneProjectSource} from './typed-scene-source.js';

const json=value=>JSON.stringify(value).replace(/"__proto__":/g,'["__proto__"]:');
const clean=value=>String(value??'').replace(/[\r\n\u2028\u2029]/g,' ').slice(0,100);
const constant=(type,value)=>type+'.'+String(value).replace(/(^|-)([a-z])/g,(_,dash,c)=>c.toUpperCase());
const standardStates=new Set(['active','inactive','enabled','disabled','off','on','folded','extended','closed','open','running','stopped','idle','pressed','lower','upper']);
const keywords="Actions, Events, States, Kinds, Effects, Capabilities";

/** TS projects inject concrete objects after construction. Runtime data keeps its stable IDs. */
export function typedLevelProject(level){
  const files={},layers=new Map(),points=new Map(),objects=new Map(),used=new Set(['constructor','configure','context','level','data','id','scene','resources']),paths=new Set();
  const base=structuredClone(level);base.entities=[];base.rules=[];delete base.scene;
  const map=semanticMapSource(level,{context:true,layerNames:layers,pointNames:points});
  if(!map){layers.clear();points.clear();}
  files['map.ts']=map??`import { Level } from '@gothere/core';\n\nexport function createMap() {\n  return { level: new Level(${sourceLiteral(base)}), layers: {}, points: {} };\n}\n`;
  for(const [index,definition]of level.entities.entries()){
    const key=sourceName(definition.id,'item',used),className=key[0].toUpperCase()+key.slice(1);
    let filename=String(definition.id).replace(/[^\w-]/g,'_')||'object';
    while(paths.has(filename.toLowerCase())||filename.toLowerCase()==='index')filename+='_'+index;
    paths.add(filename.toLowerCase());
    const slots=new Map(),slotUsed=new Set(['constructor','configure','context','level','data','id','scene','resources','on','behavior','behaviorSlot','move','hold','set','invoke','condition','contact','connect','surface','draggable','dropTarget','carriedPhysics']);
    for(const behavior of definition.behaviors??[])slots.set(behavior.id,sourceName(behavior.id,'do',slotUsed));
    objects.set(definition.id,{key,className,path:'objects/'+filename+'.ts',definition,slots});
  }
  const ref=id=>objects.has(id)?'objects.'+objects.get(id).key:json(id);
  const behavior=(id,name)=>objects.get(id)?.slots.has(name)?ref(id)+'.'+objects.get(id).slots.get(name):null;
  const state=value=>standardStates.has(value)?constant('States',value):json(value);
  function action(a,indent=6){
    const keys=Object.keys(a),only=list=>keys.every(k=>list.includes(k));
    if(a.type==='set'&&only(['type','target','state']))return `Actions.set(${ref(a.target)}, ${state(a.state)})`;
    if(a.type==='invoke'&&only(['type','target','behavior'])&&behavior(a.target,a.behavior))return behavior(a.target,a.behavior)+'.invoke()';
    if(a.type==='after'&&only(['type','ticks','actions']))return `Actions.after(${a.ticks/60}, ${actions(a.actions,indent)})`;
    if(a.type==='move'){const {type,target,ticks,...destination}=a;const entries=Object.entries(destination).map(([key,value])=>json(key)+': '+(key==='plane'&&layers.has(value)?'context.layers.'+layers.get(value)+'.id':key==='passage'&&objects.has(value)?ref(value)+'.id':json(value)));return `Actions.move(${ref(target)}, { ${entries.join(', ')}, seconds: ${ticks/60} })`;}
    if(a.type==='hold'&&only(['type','target']))return `${ref(a.target)}.hold()`;
    if(a.type==='drop'&&only(['type']))return 'Actions.drop()';
    if(a.type==='enable'&&only(['type','target','capability','enabled']))return `Actions.enable(${ref(a.target)}, ${constant('Capabilities',a.capability)}, ${a.enabled})`;
    if(a.type==='rotate'&&only(['type','target','angle','ticks']))return `Actions.rotate(${ref(a.target)}, ${a.angle}, ${a.ticks})`;
    if(a.type==='place'&&only(['type','target','at','range']))return `Actions.place(${ref(a.target)}, ${ref(a.at)}, ${a.range})`;
    if(a.type==='hurt'&&only(['type','message']))return `Actions.hurt(${a.message===undefined?'':json(a.message)})`;
    return json(a);
  }
  const actions=(list,indent=4)=>list.length?'[\n'+list.map(a=>' '.repeat(indent+2)+action(a,indent+2)).join(',\n')+'\n'+' '.repeat(indent)+']':'[]';
  const conditions=list=>'['+list.map(c=>Object.keys(c).every(k=>['entity','state'].includes(k))&&c.entity?`${ref(c.entity)}.condition(${state(c.state)})`:Object.keys(c).length===1&&Object.hasOwn(c,'holding')?`Actions.holding(${c.holding===null?'null':ref(c.holding)})`:json(c)).join(', ')+']';
  for(const info of objects.values()){
    const {definition,path,className,slots}=info,data=structuredClone(definition),setup=[];
    const behaviors=Array.isArray(data.behaviors)&&data.behaviors.every(b=>Object.keys(b).every(k=>['id','label','actions'].includes(k))&&Object.hasOwn(b,'label'))?data.behaviors:null;
    if(behaviors?.length)delete data.behaviors;
    for(const key of ['contact','dropTarget','carriedPhysics'])if(data[key]){setup.push(`    this.${key}(${key==='contact'&&data[key].effect==='lethal'?json(data[key]).replace('"effect":"lethal"','"effect":Effects.Lethal'):json(data[key])});`);delete data[key];}
    if(data.draggable&&Object.hasOwn(data.draggable,'enabled')&&Array.isArray(data.draggable.targets)){
      const {targets,...options}=data.draggable;setup.push(`    this.draggable({ ...${json(options)}, targets: [${targets.map(ref).join(', ')}] });`);delete data.draggable;
    }
    if(data.surface&&data.pose){setup.push(`    this.surface(${json(data.surface)});`);delete data.surface;}
    if(data.passage&&map&&points.has(data.passage.from)&&points.has(data.passage.to)&&Object.keys(data.passage).every(k=>['from','to','distance','enabled'].includes(k))){const {from,to,...options}=data.passage;setup.push(`    this.connect(context.points.${points.get(from)}, context.points.${points.get(to)}, ${json(options)});`);delete data.passage;}
    const basic=['id','label','kind','x','width','height','state','space'];let construct=`super(context, ${sourceLiteral(data)});`;
    if(map&&basic.every(k=>Object.hasOwn(data,k))&&Object.keys(data).every(k=>basic.includes(k))&&layers.has(data.space.plane)&&data.space.depth===level.spatial.planes.find(p=>p.id===data.space.plane)?.depth&&Object.keys(data.space).every(k=>['plane','depth','height','depthSize'].includes(k))){
      const {id,label,kind,x,width,height,state:initial,space}=data;
      construct=`super(context, ${json(id)}, { label: ${json(label)}, at: context.layers.${layers.get(space.plane)}.at(${x}, ${json({height:space.height,...(space.depthSize!==undefined?{depthSize:space.depthSize}:{})})}), size: { width: ${width}, height: ${height} }, kind: ${constant('Kinds',kind)}, state: ${state(initial)} });`;
    }
    files[path]=`import { Entity, ${keywords} } from '@gothere/core';\nimport type { ProjectContext } from '../context.ts';\nimport type { Objects } from './index.ts';\n\n// ${clean(definition.label)}\nexport default class ${className} extends Entity<ProjectContext> {\n`+
      (definition.behaviors??[]).map(b=>`  readonly ${slots.get(b.id)} = this.behaviorSlot(${json(b.id)}, ${json(b.label??b.id)});\n`).join('')+
      `\n  constructor(context: ProjectContext) {\n    ${construct}\n  }\n\n  configure(objects: Objects) {\n    const context = this.context;\n`+setup.join('\n')+'\n'+
      (behaviors??[]).map(b=>`    this.${slots.get(b.id)}.actions(${actions(b.actions)});\n`).join('')+'  }\n}\n';
  }
  const imports=[...objects.values()].map(o=>`import ${o.className} from './${o.path.split('/').at(-1)}';`);
  files['objects/index.ts']=`import type { ProjectContext } from '../context.ts';\n${imports.join('\n')}\n\nexport function createObjects(context: ProjectContext) {\n  const objects = {\n${[...objects.values()].map(o=>'    '+o.key+': new '+o.className+'(context)').join(',\n')}\n  };\n${[...objects.values()].map(o=>'  objects.'+o.key+'.configure(objects);').join('\n')}\n  return objects;\n}\n\nexport type Objects = ReturnType<typeof createObjects>;\n`;
  const rules=level.rules.map(rule=>{
    const {source,type,...details}=rule.on;
    if(objects.has(source)&&Object.keys(rule).every(k=>['on','if','actions'].includes(k))&&(!Object.hasOwn(rule,'if')||rule.if.length)){
      const extra=Object.entries(details).map(([key,value])=>json(key)+': '+(key==='other'&&objects.has(value)?ref(value):key==='behavior'&&behavior(source,value)?behavior(source,value):json(value))).join(', ');
      return `  ${ref(source)}.on(${constant('Events',type)}, ${actions(rule.actions,2)}, ${conditions(rule.if??[])}, {${extra}});`;
    }
    return '  context.level.rule('+sourceLiteral(rule)+');';
  });
  files['events.ts']=`import { ${keywords} } from '@gothere/core';\nimport type { ProjectContext } from './context.ts';\nimport type { Objects } from './objects/index.ts';\n\nexport function addEvents(context: ProjectContext, objects: Objects) {\n${rules.join('\n')}\n}\n`;
  let routes='';if(map){
    const pending=new Set(level.spatial.nodes.filter(n=>n.next).map(n=>n.id));
    const chain=id=>{const result=['context.points.'+points.get(id)];while(pending.has(id)){const node=level.spatial.nodes.find(n=>n.id===id);pending.delete(id);if(node.via)result.push('context.level.through('+ref(node.via)+')');result.push('context.points.'+points.get(node.next));id=node.next;}if(result.length>1)routes+='  context.level.route('+result.join(', ')+');\n';};
    chain(level.spatial.start);for(const id of [...pending])chain(id);
    files['routes.ts']=`import type { ProjectContext } from './context.ts';\nimport type { Objects } from './objects/index.ts';\n\nexport function connectRoutes(context: ProjectContext, objects: Objects) {\n${routes}}\n`;
  }
  const art=sceneProjectSource(level,{objects,layers,ref,behavior,state,constant});Object.assign(files,art.files);
  files['context.ts']=`import { LevelContext } from '@gothere/core';\nimport type { createMap } from './map.ts';\nimport type { createResources } from './resources.ts';\n\n/** Explicit dependencies, shared by every object component. */\nexport class ProjectContext extends LevelContext {\n  constructor(readonly map: ReturnType<typeof createMap>, readonly images: ReturnType<typeof createResources>) {\n    super(map.level);\n  }\n  get layers() { return this.map.layers; }\n  get points() { return this.map.points; }\n}\n`;
  files['level.ts']=`import { createMap } from './map.ts';\nimport { ProjectContext } from './context.ts';\nimport { createResources } from './resources.ts';\nimport { createObjects } from './objects/index.ts';\nimport { addEvents } from './events.ts';\n${map?"import { connectRoutes } from './routes.ts';\n":''}${level.scene?"import { addScene } from './scene.ts';\n":''}\nexport default function buildLevel() {\n  const map = createMap();\n  const context = new ProjectContext(map, createResources(map.level));\n  const objects = createObjects(context);\n${map?'  connectRoutes(context, objects);\n':''}  addEvents(context, objects);\n${level.scene?'  addScene(context, objects);\n':''}  return context.level;\n}\n`;
  return {version:1,entry:'level.ts',active:'level.ts',files};
}
