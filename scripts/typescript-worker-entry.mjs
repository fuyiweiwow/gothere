import {createTypeScriptService} from './typescript-service.mjs';
const service=createTypeScriptService(__TS_LIBRARIES__,__SDK_TYPES__);
self.onmessage=event=>{
  const {id,method,project,args=[]}=event.data;
  try{self.postMessage({id,result:service[method](project,...args)});}
  catch(error){self.postMessage({id,error:String(error.message||error)});}
};
