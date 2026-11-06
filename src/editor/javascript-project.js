import {createAuthoringAPI} from './authoring-api.js';
import {createAuthoringLibrary} from './authoring-library.js';
import {createBlankLevel} from './model.js';
import {levelToJavaScript} from './javascript-source.js';
import {semanticMapSource,actionsSource} from './semantic-source.js';
import {createSceneLibrary} from './authoring-scene.js';
import {typedLevelProject} from './typed-project-source.js';
import {ASSETS_MODULE,ASSETS_INDEX,validateProjectAssets,materializeProjectAssets} from './project-assets.js';

export const CORE_MODULE = '@gothere/core';
const assemblyModules={'@gothere/objects':'.gothere/objects.ts','@gothere/scene-groups':'.gothere/scene-groups.ts'};
export const PROJECT_LIMIT = 2097152;

function literal(value) {
  return JSON.stringify(value, null, 2).replace(/^(\s*)"__proto__":/gm, '$1["__proto__"]:');
}
function note(value) { return String(value ?? '').replace(/[\r\n\u2028\u2029]/g, ' ').slice(0, 100); }

export function projectPath(path) {
  if (typeof path !== 'string' || path.length > 180 || !/\.(?:js|ts)$/.test(path) || /[\\\x00-\x1f:#?@]/.test(path)) throw new Error('文件名须为项目内的 .ts 或 .js 路径，例如 objects/cart.ts。');
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[<>"|*]/.test(part))) throw new Error('文件路径不能包含空段或越出项目。');
  return path;
}

export function validateProject(project) {
  if (![1,2].includes(project?.version) || !project.files || typeof project.files !== 'object' || Array.isArray(project.files)) throw new Error('源码项目格式不正确。');
  const entries = Object.entries(project.files);
  if (!entries.length || entries.length > 256) throw new Error('项目需要1～256个 TypeScript / JavaScript 文件。');
  let size = 0;
  for (const [path, source] of entries) {
    projectPath(path);
    if(path.startsWith('.gothere/'))throw new Error('.gothere 目录由编辑器维护，不能放置手写源码。');
    if (typeof source !== 'string') throw new Error('文件内容必须是文本：' + path);
    size += new TextEncoder().encode(source).length;
  }
  if (size > PROJECT_LIMIT) throw new Error('项目源码合计不能超过2 MiB。');
  if (!Object.hasOwn(project.files, project.entry)) throw new Error('找不到入口文件：' + project.entry);
  return validateProjectAssets(project);
}

export function resolveProjectImport(from, specifier) {
  if (specifier === CORE_MODULE) return CORE_MODULE;
  if (specifier === ASSETS_MODULE) return ASSETS_INDEX;
  if(Object.hasOwn(assemblyModules,specifier))return assemblyModules[specifier];
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw new Error(`${from} · 仅支持项目相对路径和 ${CORE_MODULE}：${specifier}`);
  const parts = from.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') { if (!parts.length) throw new Error(from + ' · import 路径越出项目：' + specifier); parts.pop(); }
    else if (part !== '.') parts.push(part);
  }
  return projectPath(parts.join('/'));
}

export function relativeProjectImport(from, target) {
  const parent = from.split('/').slice(0, -1), parts = target.split('/');
  while (parent.length && parent[0] === parts[0]) { parent.shift(); parts.shift(); }
  const path = '../'.repeat(parent.length) + parts.join('/');
  return path.startsWith('../') ? path : './' + path;
}

/** Dependency order also gives a precise, early error for unsupported circular imports. */
export function projectModuleGraph(project, analyze = globalThis.gothereProjectTools?.analyzeModule) {
  validateProject(project);
  project=materializeProjectAssets(project);
  project={...project,files:{...project.files,...project.generated}};
  if (!analyze) throw new Error('模块解析器未加载，请重新打开编辑器。');
  const ordered = [], visited = new Set(), visiting = [];
  function visit(path) {
    if (path === CORE_MODULE || visited.has(path)) return;
    if (visiting.includes(path)) throw new Error('暂不支持循环 import：' + [...visiting, path].join(' → '));
    if (!Object.hasOwn(project.files, path)) throw new Error('找不到模块：' + path + (visiting.length ? '（来自 ' + visiting.at(-1) + '）' : ''));
    visiting.push(path);
    const imports = analyze(project.files[path], path).map(ref => ({...ref, target: resolveProjectImport(path, ref.specifier)}));
    imports.forEach(ref => visit(ref.target));
    visiting.pop(); visited.add(path); ordered.push({path, source: project.files[path], imports});
  }
  visit(project.entry);
  return ordered;
}

export function rewriteModuleImports(source, imports, replacement) {
  for (const ref of [...imports].sort((a, b) => b.start - a.start)) source = source.slice(0, ref.start) + JSON.stringify(replacement(ref)) + source.slice(ref.end);
  return source;
}

/** Rename both the file and static references, including imports inside a moved folder. */
export function renameProjectFile(project, from, to, analyze = globalThis.gothereProjectTools?.analyzeModule) {
  validateProject(project); projectPath(to);
  if (!Object.hasOwn(project.files, from)) throw new Error('找不到文件：' + from);
  if (Object.hasOwn(project.files, to)) throw new Error('文件已存在：' + to);
  const files = Object.fromEntries(Object.entries(project.files).map(([path, source]) => {
    const next = path === from ? to : path;
    const refs = analyze(source, path).map(ref => ({...ref, target: resolveProjectImport(path, ref.specifier)}));
    return [next, rewriteModuleImports(source, refs, ref => ref.target === CORE_MODULE ? CORE_MODULE : ref.target===ASSETS_INDEX?ASSETS_MODULE:Object.keys(assemblyModules).find(name=>assemblyModules[name]===ref.target)??relativeProjectImport(next, ref.target === from ? to : ref.target))];
  }));
  return validateProject({...project, files, entry: project.entry === from ? to : project.entry, active: to});
}

export function authoringLibrarySource() {
  const blank = createBlankLevel('script-level', {layered: true});
  return '// 内置基础库 · 随编辑器提供；项目中使用 import { Level, Entity, Actions } from "@gothere/core"。\n' +
    'const blank = ' + literal(blank) + ';\n\n' +
    'export const createAPI = level => (' + createAuthoringAPI.toString() + ')(level, blank);\n\n' +
    'export const { Level, Entity, Actions, Layer, Position, RoutePoint, Passage, LevelContext, LevelComponent, BehaviorRef, instance, sceneGroup, States, Events, Kinds, Effects, Motions, Particles, Sounds, VisualStates, FeedbackPolicies, FeedbackTriggers, Capabilities } = (' + createAuthoringLibrary.toString() + ')(createAPI, blank, '+createSceneLibrary.toString()+');\n';
}

export function levelToProject(level, {typescript = false} = {}) {
  if(typescript)return validateProject(typedLevelProject(level));
  const map = structuredClone(level), files = {}, objectImports = [], objectCalls = [];
  map.entities = []; map.rules = [];
  const scene = map.scene; delete map.scene;
  files['level.js'] = `import { createMap } from './map.js';\nimport { addObjects } from './objects/index.js';\nimport { addEvents } from './events.js';\n${scene ? "import { addScene } from './scene.js';\n" : ''}
// 入口只负责组织关卡；具体内容在左侧的各个文件中编辑。
export default function buildLevel() {
  const level = createMap();
  addObjects(level);
  addEvents(level);${scene ? '\n  addScene(level);' : ''}
  return level;
}
`;
  const semanticMap=semanticMapSource(level);
  files['map.js'] = semanticMap ? semanticMap.replace('(): Level','()') : `import { Level } from '@gothere/core';\n\n// 旧版或扩展地图的完整兼容定义。\nexport function createMap() {\n  return new Level(${literal(map)});\n}\n`;
  const used = new Set(), bindings = new Set(['Level']);
  level.entities.forEach((definition, index) => {
    let name = String(definition.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'object';
    while (used.has(name.toLowerCase()) || name.toLowerCase() === 'index') name += '_' + index;
    used.add(name.toLowerCase());
    let binding = name.split(/[-_]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join('') || 'Object';
    if (!/^[A-Za-z_$]/.test(binding)) binding = 'Object' + binding;
    while (bindings.has(binding)) binding += index;
    bindings.add(binding);
    const path = 'objects/' + name + '.js', data = structuredClone(definition);
    const behaviors = data.behaviors?.length && data.behaviors.every(b => Object.keys(b).every(key => ['id', 'label', 'actions'].includes(key)) && Object.hasOwn(b, 'label')) ? data.behaviors : [];
    if (behaviors.length) delete data.behaviors;
    const capabilities=[];
    for(const capability of ['contact','draggable','dropTarget','carriedPhysics'])if(data[capability]){capabilities.push(`    this.${capability}(${literal(data[capability])});`);delete data[capability];}
    if(data.surface&&data.pose){capabilities.push(`    this.surface(${literal(data.surface)});`);delete data.surface;}
    if(data.passage&&Object.keys(data.passage).every(k=>['from','to','distance','enabled'].includes(k))){
      const {from,to,...options}=data.passage;capabilities.push(`    this.connect(level.point(${literal(from)}), level.point(${literal(to)}), ${literal(options)});`);delete data.passage;
    }
    const basicKeys=['id','label','kind','x','width','height','state','space'];
    let constructor=`super(level, ${literal(data)});`;
    if(level.schemaVersion===3&&basicKeys.every(key=>Object.hasOwn(data,key))&&data.space.plane&&data.space.depth===level.spatial.planes.find(p=>p.id===data.space.plane)?.depth&&
        Object.keys(data).every(key=>basicKeys.includes(key))&&Object.keys(data.space).every(k=>['plane','depth','height','depthSize'].includes(k))){
      const {id,label,kind,x,width,height,state,space}=data;
      const atOptions={...(space.height?{height:space.height}:{}),...(space.depthSize!==undefined?{depthSize:space.depthSize}:{})};
      const at=`level.layer(${literal(space.plane)}).at(${x}${Object.keys(atOptions).length?', '+JSON.stringify(atOptions):''})`;
      constructor=`super(level, ${literal(id)}, { label: ${literal(label)}, at: ${at}, size: { width: ${width}, height: ${height} }, kind: ${literal(kind)}, state: ${literal(state)} });`;
    }
    files[path] = `import { Entity, Actions } from '@gothere/core';\n\n// ${note(definition.label)}\nexport default class extends Entity {\n  constructor(level) {\n    ${constructor}\n` +
      capabilities.join('\n')+'\n'+behaviors.map(b => `    this.behavior(${literal(b.id)}, ${actionsSource(b.actions)}, ${literal(b.label)});\n`).join('') + '  }\n}\n';
    objectImports.push(`import ${binding} from './${name}.js';`);
    objectCalls.push(`  new ${binding}(level); // ${note(definition.label)}`);
  });
  files['objects/index.js'] = objectImports.join('\n') + '\n\nexport function addObjects(level) {\n' + objectCalls.join('\n') + '\n}\n';
  files['events.js'] = "import { Actions } from '@gothere/core';\n\n// 物体已全部创建，可在此跨物体连线。on() 注册事件，动作不在编辑时执行。\nexport function addEvents(level) {\n" + level.rules.map(rule => {
    if (level.entities.some(e => e.id === rule.on.source) && Object.keys(rule).every(key => ['on', 'if', 'actions'].includes(key)) && (!Object.hasOwn(rule, 'if') || rule.if.length)) {
      const {source, type, ...details} = rule.on;
      return `  level.entity(${literal(source)}).on(${literal(type)}, ${actionsSource(rule.actions)}, ${literal(rule.if ?? [])}, ${literal(details)});`;
    }
    return '  level.rule(' + literal(rule) + ');';
  }).join('\n') + '\n}\n';
  if (scene) files['scene.js'] = '// 美术、动画与声音只描述表现，逻辑实体在 objects 中定义。\nexport function addScene(level) {\n  level.data.scene = ' + literal(scene) + ';\n}\n';
  return validateProject({version: 1, entry: 'level.js', active: 'level.js', files});
}

/** Preserve old handwritten functions and loops without executing the source during migration. */
export function legacyToProject(source, base) {
  if (source === levelToJavaScript(base)) return levelToProject(base);
  const entry = 'level.js';
  return validateProject({version: 1, entry, active: entry, files: {[entry]:
    `import { createAPI } from '@gothere/core';\n\n// 原有手写源码保留在此，可逐步提取为模块。\nexport default function buildLevel() {\n  const base = ${literal(base)};\n  const generate = (level, api, createAPI) => {\n${source}\n    return typeof createLevel === 'function' ? createLevel(level, api, createAPI) : undefined;\n  };\n  return generate(base, createAPI(base), createAPI);\n}\n`}});
}

export function createProjectExample({typescript=false}={}) {
  if(typescript)return {version:1,entry:'level.ts',active:'level.ts',files:{
    'level.ts':`import { Level } from '@gothere/core';
import { DepartingObject } from './objects/departing-object.ts';

export default function buildLevel(): Level {
  const level = new Level('模块示例 · 点击让路');
  const street = level.layer('street', { screenY: 500 });
  street.ground({ from: 20, to: 1180 });
  const start = level.point('start', street.at(60));
  const finish = level.point('finish', street.at(1100));
  level.route(start, finish);
  level.traveler({ start, speed: 70 });
  level.destination(finish);
  new DepartingObject(level, 'cart', street.at(520));
  return level;
}
`,
    'objects/departing-object.ts':`import { Entity, Actions, Events, States, Effects, LevelContext, type Level, type Position } from '@gothere/core';

// 任意贴图均可搭配这种能力；可在其他关卡中重复使用。
export class DepartingObject extends Entity {
  readonly doLeave = this.behaviorSlot('leave', '向右驶离');

  constructor(context: LevelContext | Level, id: string, at: Position) {
    super(context, id, { at, label: '点击让路的物体', size: { width: 64, height: 44 } });
    this.contact({ effect: Effects.Lethal, message: '撞上了挡路物。' });
    this.doLeave.actions([
      this.set(States.Inactive),
      Actions.after(0.2, [this.move({ to: at.layer.at(1350), seconds: 2 })])
    ]);
    this.on(Events.Click, [this.doLeave.invoke()], [this.condition(States.Active)]);
  }
}
`
  }};
  return {version: 1, entry: 'level.js', active: 'level.js', files: {
    'level.js': `import { Level } from '@gothere/core';
import { DepartingObject } from './objects/departing-object.js';

export default function buildLevel() {
  const level = new Level();
  level.data.name = '模块示例 · 点击让路';
  new DepartingObject(level, 'cart', { x: 520 });
  return level;
}
`,
    'objects/departing-object.js': `import { Entity, Actions } from '@gothere/core';

// 同一种物体可反复实例化；贴图在画布的资源模式中绑定。
export class DepartingObject extends Entity {
  constructor(level, id, { x = 500 } = {}) {
    const object = level.api.object(id, {
      label: '点击让路的物体', x, width: 64, height: 44,
      contact: { effect: 'lethal', message: '撞上了挡路物。' }
    });
    super(level, object.id);
    this.behavior('leave', [
      this.set('inactive'),
      Actions.after(0.2, [this.move({ x: 1350, seconds: 2 })])
    ], '向右驶离');
    this.on('click', [this.invoke('leave')], [this.condition('active')]);
  }
}
`
  }};
}
