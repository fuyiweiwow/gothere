import ts from 'typescript';
import {projectOutline} from './project-outline.mjs';

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
    const next=new Map(Object.entries(project.files).map(([path,source])=>['/project/'+path,source]));let changed=files.size!==next.size;
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
      const result={};for(const [path,source]of Object.entries(project.files)){
        result[path]=path.endsWith('.d.ts')?'export {};\n':path.endsWith('.ts')?ts.transpileModule(source,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:false}}).outputText:source;
      }
      return {...project,files:result};
    },
    analyzeFiles(project) { return Object.fromEntries(Object.entries(project.files).map(([path,source])=>[path,analyze(source,path)])); },
    outline(project) { update(project);return projectOutline(service.getProgram()); },
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
        return [{path:target,start:info.textSpan.start,length:info.textSpan.length,name:info.name}];
      });
    },
    dispose(){service.dispose();}
  };
}
