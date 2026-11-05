/** Convert every supported version into executable, self-contained authoring source.
 * The original fields remain explicit; API helpers register ordinary data. */
export function levelToJavaScript(level){
  const document=structuredClone(level),entities=document.entities,rules=document.rules,nodes=document.scene?.nodes;
  document.entities=[];document.rules=[];if(document.scene)document.scene.nodes=[];
  const literal=value=>JSON.stringify(value,null,2).replace(/^(\s*)"__proto__":/gm,'$1["__proto__"]:');
  const note=value=>String(value??'').replace(/[\r\n\u2028\u2029]/g,' ').slice(0,80);
  const chunks=['// 完整关卡：此文件可独立导入。先定义地图，再添加物体、规则和美术。',
    'function createLevel(level, api, createAPI) {',
    'level = '+literal(document)+';', 'api = createAPI(level);','\n// 物体与它们的行为'];
  for(const entity of entities)chunks.push('// '+note(entity.label)+' · '+note(entity.id)+'\napi.addObject('+literal(entity)+');');
  chunks.push('\n// 事件和动作');for(const rule of rules)chunks.push('api.addRule('+literal(rule)+');');
  if(nodes){chunks.push('\n// 美术图层');for(const node of nodes)chunks.push('// '+note(node.label)+'\napi.addArt('+literal(node)+');');}
  chunks.push('\nreturn level;\n}');return chunks.join('\n\n')+'\n';
}

/** Make an older base-dependent script portable without executing it. */
export function portableJavaScript(source,base){
  if(/^\s*(?:(?:\/\/[^\n]*\n)\s*)*function\s+createLevel\s*\(/.test(source))return source;
  return 'function createLevel(level, api, createAPI) {\nlevel = '+JSON.stringify(base,null,2).replace(/^(\s*)"__proto__":/gm,'$1["__proto__"]:')+';\napi = createAPI(level);\n\n'+source+'\n}\n';
}
