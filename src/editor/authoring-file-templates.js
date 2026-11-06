import {relativeProjectImport} from './javascript-project.js';

/** Templates declare one contribution; changing the declaration changes what gets assembled. */
export function authoringFileSource(project,path,kind='module') {
  if(kind==='module')return "// 在这里定义可复用的类或函数；普通模块不会自动创建实例。\nexport {};\n";
  if(project.version!==2)throw new Error('自动装配模板需要目录资源项目；可从当前画布生成新源码后使用。');
  if(!path.endsWith('.ts'))throw new Error('物体与布景模板请使用 .ts，普通模块仍支持 .js。');
  if(!Object.hasOwn(project.files,'context.ts'))throw new Error('模板需要项目的 context.ts；手写项目也可自行 import instance / sceneGroup 声明。');
  const context=relativeProjectImport(path,'context.ts');
  let name=path.split('/').at(-1).replace(/\.ts$/,'').replace(/[^a-zA-Z0-9]+(.)?/g,(_,c)=>c?c.toUpperCase():'');
  if(!/^[a-zA-Z]/.test(name))name='newItem'+name;
  const exported='item'+name[0].toUpperCase()+name.slice(1),className=exported[0].toUpperCase()+exported.slice(1);
  const id='item-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()).slice(0,40);
  if(kind==='instance')return `import { Entity, instance, Events, States } from '@gothere/core';\nimport type { ProjectContext } from '${context}';\nimport type { Objects } from '@gothere/objects';\n\nexport class ${className} extends Entity<ProjectContext> {\n  constructor(context: ProjectContext) {\n    super(context, '${id}', { label: '新物体', x: 400, size: { width: 40, height: 40 } });\n  }\n\n  configure(objects: Objects) {\n    // 此时所有实例已经创建，可引用 objects 中的具体物体和行为。\n    this.on(Events.Click, [this.set(States.Inactive)]);\n  }\n}\n\nexport const ${exported} = instance(${className}, {});\n`;
  if(kind==='group')return `import { sceneGroup } from '@gothere/core';\nimport type { ProjectContext } from '${context}';\nimport type { Objects } from '@gothere/objects';\n\nexport const ${name}Group = sceneGroup((context: ProjectContext, objects: Objects) => {\n  const { scene, assets } = context;\n  // 使用 assets.images 中的图片放置图层，并返回具名的图层引用。\n  return {};\n});\n`;
  throw new Error('未知的新建文件模板。');
}
