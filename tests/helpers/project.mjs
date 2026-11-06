import {projectModuleGraph,rewriteModuleImports,authoringLibrarySource,CORE_MODULE} from '../../src/editor/javascript-project.js';
import {analyzeModule} from '../../scripts/project-code-tools.mjs';

let run=0;
export async function executeProject(project){
  const urls=new Map(),nonce=++run;
  const url=(path,text)=>{const value='data:text/javascript;base64,'+Buffer.from(text+'\n// run '+nonce+' '+path).toString('base64');urls.set(path,value);return value;};
  url(CORE_MODULE,authoringLibrarySource());
  for(const module of projectModuleGraph(project,analyzeModule))url(module.path,rewriteModuleImports(module.source,module.imports,ref=>urls.get(ref.target)));
  const module=await import(urls.get(project.entry));
  return JSON.parse(JSON.stringify(module.default()));
}
