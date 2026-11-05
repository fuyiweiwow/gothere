import {createAuthoringAPI} from './authoring-api.js';
import {createBlankLevel} from './model.js';
import {parseDSL} from './dsl.js';

/** Explicitly executed author code, never runtime callbacks. Workers keep loops off the UI.
 * This is not a security sandbox: only run code the author trusts. */
export function generateFromJavaScript(source,base,{timeout=2500}={}){
  let worker,url,timer,settled=false,rejectTask;
  const cleanup=()=>{clearTimeout(timer);worker?.terminate();if(url)URL.revokeObjectURL(url);};
  const promise=new Promise((resolve,reject)=>{
    rejectTask=reject;
    const finish=(error,value)=>{if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve(value);};
    try{
      if(typeof source!=='string'||new TextEncoder().encode(source).length>131072)throw new Error('JS 编排源码不能超过128 KiB。');
      const script=`"use strict";
self.onmessage = event => {
  try {
    const {base,blank} = event.data;
    const createAPI = level => (${createAuthoringAPI.toString()})(level,blank);
    const generate = (level,api,createAPI) => {
${source}
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
