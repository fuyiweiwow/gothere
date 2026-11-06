import ts from 'typescript';

export const OBJECTS_MODULE='@gothere/objects';
export const GROUPS_MODULE='@gothere/scene-groups';
export const OBJECTS_INDEX='.gothere/objects.ts';
export const GROUPS_INDEX='.gothere/scene-groups.ts';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const safeKey=name=>/^[\p{ID_Start}_$][\p{ID_Continue}$]*$/u.test(name)&&!['__proto__','constructor','prototype'].includes(name);
const quote=JSON.stringify;

/** Discover only explicit exported declarations. Indexing never imports or executes modules. */
export function projectAssembly(project) {
  const declarations={instance:[],sceneGroup:[]},seen={instance:new Set(),sceneGroup:new Set()};
  for(const [path,source]of Object.entries(project.files).sort(([a],[b])=>compare(a,b))){
    if(path.startsWith('.gothere/'))continue;
    const file=ts.createSourceFile(path,source,ts.ScriptTarget.ES2022,true,path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS),bindings=new Map();
    for(const node of file.statements)if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&node.moduleSpecifier.text==='@gothere/core'){
      const clause=node.importClause;
      if(clause?.isTypeOnly)continue;
      if(clause?.namedBindings&&ts.isNamedImports(clause.namedBindings)){for(const binding of clause.namedBindings.elements)if(!binding.isTypeOnly)bindings.set(binding.name.text,(binding.propertyName??binding.name).text);}
      else if(clause?.namedBindings&&ts.isNamespaceImport(clause.namedBindings))bindings.set(clause.namedBindings.name.text,'*');
    }
    for(const statement of file.statements)if(ts.isVariableStatement(statement)&&statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
      for(const node of statement.declarationList.declarations){
        const call=node.initializer;if(!call||!ts.isCallExpression(call))continue;
        const expression=call.expression;
        const kind=ts.isIdentifier(expression)?bindings.get(expression.text):ts.isPropertyAccessExpression(expression)&&ts.isIdentifier(expression.expression)&&bindings.get(expression.expression.text)==='*'?expression.name.text:null;
        if(!Object.hasOwn(declarations,kind))continue;
        if(!ts.isIdentifier(node.name)||!safeKey(node.name.text))throw new Error(path+' · 自动装配的导出名需要有效且非保留的标识符。');
        if(!(statement.declarationList.flags&ts.NodeFlags.Const))throw new Error(path+' · 装配声明需要 export const。');
        const name=node.name.text;
        if(seen[kind].has(name))throw new Error(path+' · 装配名称重复：'+name);seen[kind].add(name);
        const options=call.arguments[1];let order=0;
        if(options){
          if(!ts.isObjectLiteralExpression(options))throw new Error(path+' · 装配选项需要对象字面量，order 使用固定数字。');
          for(const prop of options.properties){
            if(ts.isSpreadAssignment(prop))throw new Error(path+' · 装配选项不支持展开；请明确填写 order 和 args。');
            if(prop.name&&ts.isComputedPropertyName(prop.name))throw new Error(path+' · 装配选项不支持计算属性，请直接填写 order 或 args。');
            const propName=prop.name&&(ts.isStringLiteralLike(prop.name)?prop.name.text:prop.name.getText(file));
            if(propName!=='order')continue;
            const value=prop.initializer;
            if(ts.isNumericLiteral(value??{}))order=Number(value.text);
            else if(ts.isPrefixUnaryExpression(value??{})&&value.operator===ts.SyntaxKind.MinusToken&&ts.isNumericLiteral(value.operand))order=-Number(value.operand.text);
            else throw new Error(path+' · order 需要固定数字，不能依赖运行时计算。');
            if(!Number.isSafeInteger(order))throw new Error(path+' · order 需要安全整数。');
          }
        }
        declarations[kind].push({path,name,start:node.name.getStart(file),length:node.name.getWidth(file),order});
      }
    }
  }
  const files={},positions={};
  for(const [kind,entries]of Object.entries(declarations)){
    entries.sort((a,b)=>a.order-b.order||compare(a.path,b.path)||compare(a.name,b.name));
    const path=kind==='instance'?OBJECTS_INDEX:GROUPS_INDEX;
    let source='// 自动装配索引 · 通过导出声明编辑内容；此文件只读。\n';
    entries.forEach((entry,i)=>{source+=`import { ${entry.name} as d${i} } from ${quote('../'+entry.path)};\n`;});
    if(kind==='instance'){
      source+='\ntype Item<D> = D extends { readonly Type: new (...args: any[]) => infer T } ? T : never;\nexport interface Objects {\n';
      positions[path]=[];
      entries.forEach((entry,i)=>{source+='  readonly ';const start=source.length;source+=`${entry.name}: Item<typeof d${i}>;\n`;positions[path].push({...entry,generatedStart:start});});
      source+='}\n';
      const context=entries.map((_,i)=>`ConstructorParameters<typeof d${i}.Type>[0]`).join(' & ')||"import('@gothere/core').LevelContext";
      source+=`export function createObjects(context: ${context}): Objects {\n  const objects = {\n`;
      entries.forEach((entry,i)=>{source+=`    ${entry.name}: new d${i}.Type(context, ...('args' in d${i} ? d${i}.args!(context) : [])),\n`;});
      source+='  };\n';
      entries.forEach((entry,i)=>{source+=`  if ('configure' in objects.${entry.name}) {\n    const configure = objects.${entry.name}.configure;\n    if (typeof configure !== 'function') throw new Error(${quote(entry.path+' · configure 必须是函数。')});\n    const result: unknown = configure.call(objects.${entry.name}, objects);\n    if (result && typeof result === 'object' && 'then' in result) throw new Error(${quote(entry.path+' · configure 必须同步完成。')});\n  }\n`;});
      source+='  return objects;\n}\n';
    }else{
      source+='\nexport function createSceneGroups(';
      const types=parameter=>entries.map((_,i)=>`Parameters<typeof d${i}.build>[${parameter}]`).join(' & ')||'unknown';
      source+=`context: ${types(0)}, objects: ${types(1)}, styles: ${types(2)}) {\n`;
      source+='  const names = new Set<string>();\n  const ids = new Set<string>();\n';
      source+='  function checked<T extends Record<string, { id: string }>>(group: T, path: string): T {\n    if (!group || typeof group !== "object" || "then" in group) throw new Error(path + " · 场景分组必须同步返回图层引用对象。");\n    for (const [name, visual] of Object.entries(group)) {\n      if (!visual || typeof visual.id !== "string") throw new Error(path + " · 分组必须返回图层引用。");\n      if (names.has(name) || ids.has(visual.id)) throw new Error(path + " · 分组图层名称或 ID 重复：" + name);\n      names.add(name); ids.add(visual.id);\n    }\n    return group;\n  }\n';
      source+='  const visuals = {\n';
      entries.forEach((entry,i)=>{source+=`    ...checked(d${i}.build(context, objects, styles), ${quote(entry.path)}),\n`;});
      source+='  };\n  return visuals;\n}\n';
    }
    files[path]=source;
  }
  return {files,positions,declarations};
}
