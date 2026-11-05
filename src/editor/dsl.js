import {validateLevel} from '../core/schema.js';
import {normalizeLevel} from '../core/level-version.js';

/** Source editing shares the public JSON DSL and never evaluates JavaScript. */
export function parseDSL(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>1048576)throw new Error('DSL 不能超过 1 MiB。');
  let level;
  try{level=JSON.parse(source);}catch(error){throw new Error('JSON 语法错误：'+error.message);}
  const result=validateLevel(level);
  if(!result.valid)throw new Error(result.errors.join('\n'));
  return normalizeLevel(level);
}

export function replaceDSLDocument(document,level){
  const replacement=structuredClone(level);
  for(const key of Object.keys(document))delete document[key];
  Object.defineProperties(document,Object.getOwnPropertyDescriptors(replacement));
}
