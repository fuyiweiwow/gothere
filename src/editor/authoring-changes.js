/** JSON document comparisons preserve array order and ignore object key order. */
export function sameDocument(a,b) {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameDocument(a[key],b[key]));
}

const groups={entities:'物体',nodes:'图层',assets:'图片',sounds:'声音',feedback:'反馈',compositions:'组合',behaviors:'行为',planes:'行走层'};
const fields={x:'位置 X',y:'位置 Y',width:'宽度',height:'高度',state:'状态',ticks:'时长',asset:'图片',layer:'显示层级',label:'名称',name:'名称',speed:'速度'};

/** Compare actual fields, including same-count edits and unknown compatibility data. */
export function documentChanges(before,after) {
  const changes=[];
  function visit(a,b,path,label) {
    if(sameDocument(a,b))return;
    if(Array.isArray(a)&&Array.isArray(b)) {
      const key=path.split('.').at(-1),named=[...a,...b].every(v=>v&&typeof v==='object'&&typeof v.id==='string');
      if(named&&new Set(a.map(v=>v.id)).size===a.length&&new Set(b.map(v=>v.id)).size===b.length) {
        const old=new Map(a.map(v=>[v.id,v])),next=new Map(b.map(v=>[v.id,v]));
        for(const id of new Set([...old.keys(),...next.keys()])) {
          const value=next.get(id)??old.get(id),title=`${groups[key]??key}「${value.label??value.name??id}」`;
          visit(old.get(id),next.get(id),`${path}[${id}]`,title);
        }
        const commonBefore=a.filter(v=>next.has(v.id)).map(v=>v.id),commonAfter=b.filter(v=>old.has(v.id)).map(v=>v.id);
        if(!sameDocument(commonBefore,commonAfter))changes.push({path: path+'.order',label:label+' · 顺序',before:a.map(v=>v.id),after:b.map(v=>v.id)});
      }else for(let i=0;i<Math.max(a.length,b.length);i++)visit(a[i],b[i],`${path}[${i}]`,`${label} ${i+1}`);
    }else if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)) {
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))visit(a[key],b[key],path?path+'.'+key:key,label?(fields[key]?label+' · '+fields[key]:label):key);
    }else changes.push({path,label:label||path,before:a,after:b});
  }
  visit(before,after,'','');return changes;
}

export function changeValue(value,path='') {
  if(value===undefined)return '无';
  if(typeof value==='number'&&path.endsWith('.ticks'))return `${value/60} 秒（${value} tick）`;
  if(typeof value==='string'&&value.startsWith('data:'))return `内嵌资源（${value.length} 字符）`;
  const text=typeof value==='string'?value:JSON.stringify(value);
  return text.length>150?text.slice(0,147)+'…':text;
}

/** Plain-text project search; offsets refer to the original source, never evaluated. */
export function searchProject(project,query,limit=200) {
  const needle=query.trim().toLowerCase(),matches=[];let total=0;if(!needle)return {matches,total};
  for(const [path,source]of Object.entries(project.files)) {
    let offset=0;
    for(const [index,line]of source.split('\n').entries()) {
      const at=line.toLowerCase().indexOf(needle);
      if(at!==-1){total++;if(matches.length<limit)matches.push({path,start:offset+at,line:index+1,text:line.trim().slice(0,180)});}
      offset+=line.length+1;
    }
  }
  return {matches,total};
}
