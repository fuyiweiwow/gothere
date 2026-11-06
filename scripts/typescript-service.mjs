import ts from 'typescript';
import {projectOutline} from './project-outline.mjs';
import {ASSETS_MODULE,ASSETS_INDEX,assetModule,renameProjectAsset,assetKeys} from '../src/editor/project-assets.js';
import {projectAssembly,OBJECTS_MODULE,GROUPS_MODULE,OBJECTS_INDEX,GROUPS_INDEX} from './project-assembly.mjs';

/** Virtual project; no filesystem, network, evaluation or user code execution. */
export function createTypeScriptService(libraries, declarations) {
  let files = new Map(), versions = new Map(), projectVersion = 0;
  const fixed = new Map(Object.entries(libraries).map(([path, source])=>['/lib/'+path,source]));
  fixed.set('/sdk/core.d.ts', declarations);
  const normalize = path => {
    const parts=[];for(const part of path.split('/')){if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}return '/'+parts.join('/');
  };
  const read = path => files.get(normalize(path)) ?? fixed.get(normalize(path));
  function resolve(name, containingFile) {
    if(name==='@gothere/core')return {resolvedFileName:'/sdk/core.d.ts',extension:ts.Extension.Dts};
    if(name===ASSETS_MODULE&&files.has('/project/'+ASSETS_INDEX))return {resolvedFileName:'/project/'+ASSETS_INDEX,extension:ts.Extension.Ts};
    const assemblyPath=name===OBJECTS_MODULE?OBJECTS_INDEX:name===GROUPS_MODULE?GROUPS_INDEX:null;
    if(assemblyPath&&files.has('/project/'+assemblyPath))return {resolvedFileName:'/project/'+assemblyPath,extension:ts.Extension.Ts};
    if(!name.startsWith('.'))return undefined;
    const path=normalize(containingFile.split('/').slice(0,-1).join('/')+'/'+name);
    if(!files.has(path))return undefined;
    return {resolvedFileName:path,extension:path.endsWith('.d.ts')?ts.Extension.Dts:path.endsWith('.ts')?ts.Extension.Ts:ts.Extension.Js};
  }
  const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
    allowJs:true,checkJs:false,strict:true,skipLibCheck:true,noEmit:true,allowImportingTsExtensions:true};
  const host={
    getCompilationSettings:()=>options,getScriptFileNames:()=>[...files.keys(),'/sdk/core.d.ts'],getScriptVersion:path=>String(versions.get(path)??0),
    getScriptSnapshot:path=>{const source=read(path);return source===undefined?undefined:ts.ScriptSnapshot.fromString(source);},
    getCurrentDirectory:()=>'/project',getDefaultLibFileName:()=>'/lib/lib.es2022.d.ts',
    fileExists:path=>read(path)!==undefined,readFile:read,readDirectory:()=>[],directoryExists:()=>true,
    getDirectories:()=>[],useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n',
    getProjectVersion:()=>String(projectVersion),resolveModuleNames:(names,containing)=>names.map(name=>resolve(name,containing)),
  };
  const service=ts.createLanguageService(host);
  function update(project) {
    const sources={...project.files};
    if(project.version===2){sources[ASSETS_INDEX]=assetModule(project).source;Object.assign(sources,projectAssembly(project).files);}
    const next=new Map(Object.entries(sources).map(([path,source])=>['/project/'+path,source]));let changed=files.size!==next.size;
    for(const [path,source]of next)if(files.get(path)!==source){versions.set(path,(versions.get(path)??0)+1);changed=true;}
    files=next;if(changed)projectVersion++;
  }
  function diagnostic(d) {
    const at=d.file?.getLineAndCharacterOfPosition(d.start??0);
    return {path:d.file?.fileName.replace('/project/',''),start:d.start??0,length:d.length??0,
      line:(at?.line??0)+1,column:(at?.character??0)+1,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n'),
      severity:d.category===ts.DiagnosticCategory.Error?'error':'warning'};
  }
  function diagnostics(project) {
    update(project);const output=[];
    for(const path of files.keys()){
      output.push(...service.getSyntacticDiagnostics(path));
      if(path.endsWith('.ts'))output.push(...service.getSemanticDiagnostics(path));
    }
    return output.map(diagnostic);
  }
  function analyze(source,path) {
    const ast=ts.createSourceFile(path,source,ts.ScriptTarget.ES2022,true,path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
    if(ast.parseDiagnostics.length)throw new Error(ast.parseDiagnostics.map(d=>{const error=diagnostic(d);return `${path}:${error.line}:${error.column} · ${error.message}`;}).join('\n'));
    const refs=[];
    function visit(node){
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)throw new Error(path+' · 请使用静态 import，暂不支持动态 import()。');
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
        const ref=node.moduleSpecifier;refs.push({specifier:ref.text,start:ref.getStart(ast),end:ref.end});
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);return refs;
  }
  return {
    diagnostics,
    compile(project) {
      const errors=diagnostics(project).filter(d=>d.severity==='error');
      if(errors.length)throw new Error(errors.slice(0,20).map(d=>`${d.path}:${d.line}:${d.column} · TS${d.code} ${d.message}`).join('\n'));
      const sources={...project.files,...(project.version===2?projectAssembly(project).files:{})};
      const result={};for(const [path,source]of Object.entries(sources)){
        result[path]=path.endsWith('.d.ts')?'export {};\n':path.endsWith('.ts')?ts.transpileModule(source,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:false}}).outputText:source;
      }
      // Generated modules travel separately; they are never saved as author files.
      return {...project,files:Object.fromEntries(Object.entries(result).filter(([p])=>!p.startsWith('.gothere/'))),generated:Object.fromEntries(Object.entries(result).filter(([p])=>p.startsWith('.gothere/')))};
    },
    assembly(project) {return projectAssembly(project).files;},
    analyzeFiles(project) { return Object.fromEntries(Object.entries(project.files).map(([path,source])=>[path,analyze(source,path)])); },
    outline(project) { update(project);return projectOutline(service.getProgram()); },
    renameAsset(project,from,to) {
      const next=renameProjectAsset(project,from,to);
      update(project);
      const positions=assetModule(project).positions,leaf=positions.find(p=>p.path===from);
      const oldKeys=assetKeys(from),newKeys=assetKeys(to),edits={},handled=new Set();
      for(const file of service.getProgram().getSourceFiles()){
        const path=file.fileName.replace('/project/','');
        if(!Object.hasOwn(project.files,path))continue;
        function visit(node){
          const token=ts.isPropertyAccessExpression(node)?node.name:ts.isElementAccessExpression(node)&&ts.isStringLiteral(node.argumentExpression)?node.argumentExpression:null;
          if(token){
            const definitions=service.getDefinitionAtPosition(file.fileName,token.getStart(file)+(ts.isStringLiteral(token)?1:0))??[];
            if(definitions.some(d=>d.fileName==='/project/'+ASSETS_INDEX&&d.textSpan.start===leaf.start)){
              let root=node;
              for(let i=0;i<oldKeys.length;i++){
                if(!ts.isPropertyAccessExpression(root)&&!ts.isElementAccessExpression(root))throw new Error('资源通过局部别名引用，无法安全移动；请先改为完整目录引用。');
                root=root.expression;
              }
              // Refuse destructured or shortened directory aliases rather than rewriting unrelated code.
              const suffix=node.getText(file).slice(root.getText(file).length).replace(/\[(['"])([^'"]+)\1\]/g,'.$2').replace(/\s/g,'');
              if(suffix!=='.'+oldKeys.join('.'))throw new Error('存在目录别名引用，请先调整引用再移动资源。');
              (edits[path]??=[]).push({start:root.end,end:node.end,text:'.'+newKeys.join('.')});
              handled.add(file.fileName+':'+token.getStart(file));
              return;
            }
          }
          ts.forEachChild(node,visit);
        }
        visit(file);
      }
      const references=service.findReferences('/project/'+ASSETS_INDEX,leaf.start)??[];
      for(const group of references)for(const ref of group.references){
        if(ref.fileName==='/project/'+ASSETS_INDEX)continue;
        if(!handled.has(ref.fileName+':'+ref.textSpan.start)&&!handled.has(ref.fileName+':'+(ref.textSpan.start-1)))throw new Error('存在解构或别名资源引用，无法安全更新；请先改为完整目录引用。');
      }
      const result={...next,files:{...next.files}};
      for(const [path,changes]of Object.entries(edits))for(const edit of changes.sort((a,b)=>b.start-a.start))result.files[path]=result.files[path].slice(0,edit.start)+edit.text+result.files[path].slice(edit.end);
      return result;
    },
    isModule({source,path}) { const refs=analyze(source,path);return refs.length>0||ts.createSourceFile(path,source,ts.ScriptTarget.ES2022).statements.some(s=>s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)||ts.isExportAssignment(s)); },
    completions(project,path,position) {
      update(project);const full='/project/'+path,info=service.getCompletionsAtPosition(full,position,{includeCompletionsForModuleExports:false});
      if(!info)return [];
      return info.entries.slice(0,180).map(e=>{
        let detail;
        if(info.isMemberCompletion)detail=service.getCompletionEntryDetails(full,position,e.name,{},e.source,{},e.data);
        return {label:e.name,type:['method','function'].includes(e.kind)?'method':e.kind==='class'?'class':'property',
          detail:detail?ts.displayPartsToString(detail.displayParts):e.kind,
          info:detail?ts.displayPartsToString(detail.documentation):undefined};
      });
    },
    hover(project,path,position) {
      update(project);const info=service.getQuickInfoAtPosition('/project/'+path,position);
      return info?{start:info.textSpan.start,length:info.textSpan.length,text:ts.displayPartsToString(info.displayParts),documentation:ts.displayPartsToString(info.documentation)}:null;
    },
    definitions(project,path,position) {
      update(project);
      return (service.getDefinitionAtPosition('/project/'+path,position)??[]).flatMap(info=>{
        const target=info.fileName==='/sdk/core.d.ts'?'@gothere/core':info.fileName.startsWith('/project/')?info.fileName.slice('/project/'.length):null;
        if(!target)return [];
        if(target===ASSETS_INDEX){const original=assetModule(project).positions.find(p=>p.start===info.textSpan.start);if(original)return [{path:original.path,start:0,length:0,name:info.name}];}
        if(target===OBJECTS_INDEX){const original=projectAssembly(project).positions[target]?.find(p=>p.generatedStart===info.textSpan.start);if(original)return [{path:original.path,start:original.start,length:original.length,name:info.name}];}
        return [{path:target,start:info.textSpan.start,length:info.textSpan.length,name:info.name}];
      });
    },
    dispose(){service.dispose();}
  };
}
