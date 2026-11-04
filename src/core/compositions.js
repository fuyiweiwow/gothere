const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(v);

/** Flat authoring membership only. Simulation and drawing use the ordinary DSL. */
export function validateCompositions(level){
  const list=level.scene?.compositions;if(list===undefined)return [];
  if(!Array.isArray(list)||list.length>64)return ['场景组合最多64组。'];
  const errors=[],ids=new Set(),nodes=new Set(),entities=new Set();
  const availableNodes=new Set((Array.isArray(level.scene.nodes)?level.scene.nodes:[]).map(n=>n?.id)),availableEntities=new Set((Array.isArray(level.entities)?level.entities:[]).map(e=>e?.id));
  for(const c of list){
    if(!object(c)||!id(c.id)||ids.has(c.id)||typeof c.label!=='string'||!c.label.trim()||c.label.length>60||
      !object(c.origin)||!Number.isFinite(c.origin.x)||!Number.isFinite(c.origin.y)||
      !Array.isArray(c.nodes)||!Array.isArray(c.entities)||!c.nodes.length||c.nodes.length>600||c.entities.length>64){errors.push('场景组合格式无效。');continue;}
    ids.add(c.id);
    for(const [members,seen,available]of [[c.nodes,nodes,availableNodes],[c.entities,entities,availableEntities]])for(const member of members){
      if(!available.has(member)||seen.has(member))errors.push('组合成员不存在或属于多个组合：'+String(member));seen.add(member);
    }
    if(c.entities.length){const planes=new Set((Array.isArray(level.entities)?level.entities:[]).filter(e=>c.entities.includes(e?.id)).map(e=>e.space?.plane));
      if(level.spatial?.mode!=='layered'||planes.size!==1||planes.has(undefined))errors.push('逻辑组合需要位于同一行走层。');}
  }
  return errors;
}

export function pruneCompositions(level){
  if(!Array.isArray(level.scene?.compositions))return;
  const nodes=new Set(level.scene.nodes.map(n=>n.id)),entities=new Set(level.entities.map(e=>e.id));
  for(const c of level.scene.compositions){c.nodes=c.nodes.filter(id=>nodes.has(id));c.entities=c.entities.filter(id=>entities.has(id));}
  level.scene.compositions=level.scene.compositions.filter(c=>c.nodes.length);
}
