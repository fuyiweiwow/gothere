import {createAuthoringAPI} from './authoring-api.js';
import {createBlankLevel} from './model.js';
import {parseDSL} from './dsl.js';
import {authoringLibrarySource,projectModuleGraph,rewriteModuleImports,validateProject,CORE_MODULE} from './javascript-project.js';
import {typeScriptClient} from './typescript-client.js';

/** Native ES modules resolve only against files in this project and the bundled core. */
export function generateFromProject(project,{timeout=2500}={}) {
  let worker,timer,rejectTask,settled=false;
  let workerURL;
  const cleanup=()=>{clearTimeout(timer);worker?.terminate();if(workerURL)URL.revokeObjectURL(workerURL);};
  const promise=new Promise((resolve,reject)=>{
    rejectTask=reject;
    const finish=(error,value)=>{if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve(value);};
    const start=async()=>{try {
      const snapshot=structuredClone(validateProject(project));
      const compiled=snapshot.version===2||Object.keys(snapshot.files).some(path=>path.endsWith('.ts'))?await typeScriptClient().request('compile',snapshot):snapshot;
      if(settled)return;
      const graph=projectModuleGraph(compiled);
      // Create module URLs inside the Worker. An offline file has an opaque origin,
      // so modules created in the parent page cannot be fetched by its Worker.
      const bootstrap=`self.onmessage = async event => {
        const urls = new Map();
        try {
          const {graph, core, entry: entryPath} = event.data;
          const moduleURL = (path, source) => {
            const url = URL.createObjectURL(new Blob([source + '\\n//# sourceURL=gothere-project/' + encodeURI(path)], {type:'text/javascript'}));
            urls.set(path, url); return url;
          };
          moduleURL(${JSON.stringify(CORE_MODULE)}, core);
          const rewrite = ${rewriteModuleImports.toString()};
          for (const module of graph) moduleURL(module.path, rewrite(module.source, module.imports, ref => urls.get(ref.target)));
          const entry = await import(urls.get(entryPath));
          const build = entry.default;
          if (typeof build !== 'function') throw new Error('入口文件需要 export default function buildLevel()。');
          const result = build();
          if (!result || typeof result !== 'object' || typeof result.then === 'function') throw new Error('入口应同步返回 Level 或关卡数据，不支持异步生成。');
          const level = typeof result.toJSON === 'function' ? result.toJSON() : result;
          const json = JSON.stringify(level, (key,value) => {
            if (['function','symbol','bigint','undefined'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw new Error('生成结果必须是纯 JSON 数据，不能包含函数、undefined 或非有限数值。');
            return value;
          });
          if (new TextEncoder().encode(json).length > 1048576) throw new Error('生成结果不能超过1 MiB。');
          self.postMessage({json});
        } catch (error) {
          let detail = String(error.message || error) + '\\n' + String(error.stack || '');
          for (const [path, url] of urls) detail = detail.split(url).join(path);
          self.postMessage({error:detail.split('\\n').slice(0, 6).join('\\n')});
        } finally { for (const url of urls.values()) URL.revokeObjectURL(url); }
      };`;
      workerURL=URL.createObjectURL(new Blob([bootstrap],{type:'text/javascript'}));worker=new Worker(workerURL);
      worker.onmessage=event=>{
        try {
          if(event.data.error)throw new Error(event.data.error);
          finish(null,parseDSL(event.data.json));
        }catch(error){finish(error);}
      };
      worker.onerror=event=>{event.preventDefault();finish(new Error('JS 模块错误：'+event.message));};
      timer=setTimeout(()=>finish(new Error('生成超过'+timeout/1000+'秒，已停止。请检查无限循环或过大的生成量。')),timeout);
      worker.postMessage({graph,core:authoringLibrarySource(),entry:compiled.entry});
    }catch(error){finish(error);}
    };void start();
  });
  return {promise,cancel(){if(settled)return;settled=true;cleanup();rejectTask(new Error('已取消生成。'));}};
}

/** Explicitly executed author code, never runtime callbacks. Workers keep loops off the UI.
 * This is not a security sandbox: only run code the author trusts. */
export function generateFromJavaScript(source,base,{timeout=2500}={}){
  let worker,url,timer,settled=false,rejectTask;
  const cleanup=()=>{clearTimeout(timer);worker?.terminate();if(url)URL.revokeObjectURL(url);};
  const promise=new Promise((resolve,reject)=>{
    rejectTask=reject;
    const finish=(error,value)=>{if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve(value);};
    try{
      if(typeof source!=='string'||new TextEncoder().encode(source).length>2097152)throw new Error('JS 源码不能超过 2 MiB。');
      const script=`"use strict";
self.onmessage = event => {
  try {
    const {base,blank} = event.data;
    const createAPI = level => (${createAuthoringAPI.toString()})(level,blank);
    const generate = (level,api,createAPI) => {
${source}
      return typeof createLevel === 'function' ? createLevel(level,api,createAPI) : undefined;
    };
    const level = generate(base,createAPI(base),createAPI);
    if (!level || typeof level !== 'object' || typeof level.then === 'function') throw new Error('请同步 return level；运行中不支持回调或异步脚本。');
    const json = JSON.stringify(level, (key,value) => {
      if (['function','symbol','bigint','undefined'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) throw new Error('生成结果必须是纯 JSON 数据，不能包含函数、undefined 或非有限数值。');
      return value;
    });
    if (new TextEncoder().encode(json).length > 1048576) throw new Error('生成结果不能超过1 MiB。');
    self.postMessage({json});
  } catch (error) { self.postMessage({error: String(error.message || error)}); }
};`;
      url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));worker=new Worker(url);
      worker.onmessage=event=>{try{if(event.data.error)throw new Error(event.data.error);finish(null,parseDSL(event.data.json));}catch(error){finish(error);}};
      worker.onerror=event=>{event.preventDefault();finish(new Error('JS 编排错误：'+event.message));};
      timer=setTimeout(()=>finish(new Error('生成超过2.5秒，已停止。请检查无限循环或过大的生成量。')),timeout);
      worker.postMessage({base:structuredClone(base),blank:createBlankLevel('script-level',{layered:true})});
    }catch(error){finish(error);}
  });
  return {promise,cancel(){if(settled)return;settled=true;cleanup();rejectTask(new Error('已取消生成。'));}};
}
