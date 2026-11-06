const clientKey='__gothereTypeScriptClient';
/** The compiler is only parsed in a background Worker, never on the map UI thread. */
export function typeScriptClient(){
  if(globalThis[clientKey])return globalThis[clientKey];
  if(!globalThis.gothereTypeScriptWorkerSource)throw new Error('TypeScript 服务未加载，请重新打开编辑器。');
  const url=URL.createObjectURL(new Blob([globalThis.gothereTypeScriptWorkerSource],{type:'text/javascript'}));
  const worker=new Worker(url);URL.revokeObjectURL(url);
  let sequence=0;const pending=new Map();
  worker.onmessage=event=>{const entry=pending.get(event.data.id);if(!entry)return;pending.delete(event.data.id);clearTimeout(entry.timer);if(event.data.error)entry.reject(new Error(event.data.error));else entry.resolve(event.data.result);};
  const close=error=>{worker.terminate();for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(error);}pending.clear();globalThis[clientKey]=null;};
  worker.onerror=event=>{event.preventDefault();close(new Error('TypeScript 服务失败：'+(event.message||'请重试。')));};
  const client={
    request(method,project,...args){
      return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>close(new Error('TypeScript 检查超时，请减少项目大小后重试。')),20000);
        pending.set(id,{resolve,reject,timer});worker.postMessage({id,method,project,args});});
    },
    dispose(){close(new Error('TypeScript 服务已关闭。'));}
  };
  globalThis[clientKey]=client;return client;
}
