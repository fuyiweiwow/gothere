import {projectSpace,unprojectSpace,spaceBounds,isLayered,syncPassageObject} from '../core/spatial.js';
import {moveObject,resizeObject} from './model.js';
import {snapSpacePoint} from './spatial-snapping.js';
import {assignWalkPlane,connectLayeredNodes,setPlaneBaseline} from './layered-editing.js';

const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn)=>{const b=el('button',text);b.type='button';b.className='button secondary';b.onclick=fn;return b;};
export function createSpatialUI({document:current,change,preview,choose,selection,behaviorFields,wireRender,renderWires,tool,wireEntity}) {
  const overlay=document.getElementById('editor-overlay');let selectedNode=null,gesture=null,suppress=false;
  const round=v=>Math.round(v*10)/10;
  function number(parent,label,id,value,update,min=0,max=1200){
    const row=el('label');row.className='edit-field';row.append(el('span',label));const input=el('input');Object.assign(input,{id,type:'number',min,max,step:'any',value});input.setAttribute('aria-label',label);
    input.onchange=()=>{const v=Number(input.value);if(input.value&&Number.isFinite(v)&&v>=min&&v<=max)update(v);else input.value=value;};
    input.onkeydown=e=>{if(!['Enter','Escape'].includes(e.key)||e.isComposing)return;e.preventDefault();e.stopPropagation();if(e.key==='Escape')input.value=value;input.blur();};row.append(input);parent.append(row);
  }
  function syncStart(d,n){if(n.id===d.spatial.start){d.actor.x=n.x;d.actor.space.depth=n.depth;d.actor.space.height=n.height;if(n.plane)d.actor.space.plane=n.plane;}}
  function planeField(parent,d,id,value,update,label='所属行走层'){
    const row=el('label',label),select=el('select');select.id=id;
    for(const p of d.spatial.planes){const o=el('option',p.label);o.value=p.id;select.append(o);}select.value=value;
    select.onchange=()=>update(select.value);row.append(select);parent.append(row);
  }
  function fields(d,box,map){
    const layered=isLayered(d),plane=d.spatial.planes?.find(p=>p.id===placement.plane)??d.spatial.planes?.[0];
    if(layered){placement.plane=plane.id;placement.depth=plane.depth;}
    const header=el('h3',layered?'行走层与局部连接':'空间与路线');map.append(header,el('p',layered?'在所选层内拖动；内外行走用显式连接，高度只表示真正升降。':'拖动路线圆点改变地面走向；高度单独设置。线路交叉不会自动连通。'));
    if(layered){
      planeField(map,d,'space-placement-plane',plane.id,v=>{placement.plane=v;placement.depth=d.spatial.planes.find(p=>p.id===v).depth;},'放置到行走层');
      for(const p of d.spatial.planes){
        map.append(el('h4',p.label));
        number(map,'画面路面 Y','space-plane-'+p.id,d.spatial.projection.originY-p.depth,v=>change(doc=>setPlaneBaseline(doc,p.id,v)),d.spatial.projection.originY-400,d.spatial.projection.originY);
        number(map,'前后绘制顺序','space-order-'+p.id,p.order,v=>change(doc=>{doc.spatial.planes.find(t=>t.id===p.id).order=v;}),-8,8);
      }
      map.append(button('＋ 行走层',()=>change(doc=>{if(doc.spatial.planes.length>=8)throw new Error('最多8个行走层。');let i=1;while(doc.spatial.planes.some(p=>p.id==='plane-'+i))i++;doc.spatial.planes.push({id:'plane-'+i,label:'行走层 '+i,depth:Math.min(400,plane.depth+100),order:0});})));
    }else number(map,'新节点纵深','space-placement-depth',placement.depth,v=>placement.depth=v,0,600);
    number(map,'放置离地高度','space-placement-height',placement.height,v=>placement.height=v,0,360);
    if(!layered)for(const key of ['originY','depthX','depthY'])number(map,'投影 '+key,'space-projection-'+key,d.spatial.projection[key],v=>change(doc=>doc.spatial.projection[key]=v),key==='originY'?200:key==='depthX'?-.5:-1,key==='originY'?620:key==='depthX'?.5:-.2);
    map.append(button('添加路线节点',()=>change(doc=>{let i=1;while(doc.spatial.nodes.some(n=>n.id==='node-'+i))i++;const n={id:'node-'+i,x:600,depth:placement.depth,height:placement.height,...(layered?{plane:placement.plane}:{})};doc.spatial.nodes.push(n);selectedNode=n.id;})));
    const n=d.spatial.nodes.find(n=>n.id===selectedNode);
    if(n){
      document.getElementById('object-title').textContent='路线节点 · '+n.id;
      if(layered)planeField(box,d,'space-node-plane',n.plane,v=>change(doc=>{const item=doc.spatial.nodes.find(t=>t.id===n.id);item.plane=v;item.depth=doc.spatial.planes.find(p=>p.id===v).depth;syncStart(doc,item);}));
      for(const [key,label,max] of [['x','位置 X',1180],...(!layered?[['depth','地面纵深',600]]:[]),['height','离地高度',360]])number(box,label,'space-node-'+key,n[key],v=>change(doc=>{const item=doc.spatial.nodes.find(t=>t.id===n.id);item[key]=v;syncStart(doc,item);}),key==='x'?20:0,max);
      const label=el('label','下一节点'),select=el('select');select.id='space-node-next';
      for(const t of [{id:'',name:'无 · 继续当前方向'},...d.spatial.nodes.filter(t=>t.id!==n.id)]){const o=el('option',t.name??t.id);o.value=t.id;select.append(o);}select.value=n.next??'';
      select.onchange=()=>change(doc=>{if(layered)connectLayeredNodes(doc,n.id,select.value);else{const item=doc.spatial.nodes.find(t=>t.id===n.id);if(select.value)item.next=select.value;else delete item.next;}});label.append(select);box.append(label);
      if(layered)box.append(el('p','跨层选择下一节点时，会创建普通的连接物体。'));
      if(n.via)box.append(button('检查连接物体',()=>{selectedNode=null;choose({type:'entity',id:n.via});}));
      if(n.id!==d.spatial.start)box.append(button('删除节点',()=>change(doc=>{if(doc.entities.some(e=>e.passage?.from===n.id||e.passage?.to===n.id))throw new Error('请先删除引用此节点的连接物体。');doc.spatial.nodes=doc.spatial.nodes.filter(t=>t.id!==n.id);for(const t of doc.spatial.nodes)if(t.next===n.id){delete t.next;delete t.via;}selectedNode=null;})));
      return;
    }
    const ref=selection(),target=ref?.type==='entity'?d.entities.find(e=>e.id===ref.id):ref?.type==='platform'?d.platforms[ref.index]:ref?.type==='actor'?d.actor:ref?.type==='goal'?d.goal:null;
    if(!target){box.append(el('p','选择物体或路线圆点。'));return;}
    document.getElementById('object-title').textContent=target.label??(ref.type==='platform'?'路面':ref.type==='actor'?'主角':'终点');
    if(target.passage){
      box.append(el('p','移动入口／出口节点调整连接。人物按行走速度连续通过，连接过程保持实际高度。'));
      number(box,'通行距离','object-passage-distance',target.passage.distance,v=>change(doc=>doc.entities.find(e=>e.id===target.id).passage.distance=v),20,1200);
      for(const [key,label] of [['from','入口'],['to','出口']])box.append(button(label+' · '+target.passage[key],()=>{selectedNode=target.passage[key];choose(null);}));
      const row=el('label','启用内外连接'),enabled=el('input');enabled.type='checkbox';enabled.id='object-passage';enabled.checked=target.passage.enabled;enabled.onchange=()=>change(doc=>doc.entities.find(e=>e.id===target.id).passage.enabled=enabled.checked);row.append(enabled);box.append(row);
      behaviorFields(d,target,box);return;
    }
    if(layered&&ref.type==='entity'&&target.kind==='object'&&!target.surface&&!target.collider&&!target.pose&&!target.motion){
      const label=el('label','位置归属'),select=el('select');select.id='object-location';
      for(const [id,text] of [['plane','行走层'],...d.entities.filter(e=>e.passage).map(e=>[e.id,'通路 · '+e.label])]){const option=el('option',text);option.value=id;select.append(option);}select.value=target.space.passage??'plane';
      select.onchange=()=>change(doc=>{const e=doc.entities.find(e=>e.id===target.id);
        if(select.value==='plane')assignWalkPlane(doc,e,doc.spatial.planes[0].id);
        else{delete e.space.plane;e.space.passage=select.value;e.space.progress=.5;e.space.length=28;syncPassageObject(doc,e);}
        const strip=actions=>{for(const a of actions)if(a.type==='after')strip(a.actions);else if(a.type==='move'&&a.target===e.id){delete a.progress;delete a.x;delete a.depth;delete a.height;delete a.plane;Object.assign(a,e.space.passage?{progress:e.space.progress}:{x:e.x,depth:e.space.depth,height:e.space.height});}};
        for(const r of doc.rules)strip(r.actions);for(const o of doc.entities)for(const b of o.behaviors??[])strip(b.actions);
      });label.append(select);box.append(label);box.append(el('p','切换位置归属会将移动目的地重置到当前位置。'));
    }
    if(target.space.passage){
      number(box,'通路进度','object-passage-progress',target.space.progress,v=>change(doc=>{const e=doc.entities.find(e=>e.id===target.id);e.space.progress=v;syncPassageObject(doc,e);}),0,1);
      number(box,'占用通路长度','object-passage-length',target.space.length,v=>change(doc=>doc.entities.find(e=>e.id===target.id).space.length=v),8,160);
      number(box,'物体自身高度','object-height',target.height??36,v=>change(doc=>doc.entities.find(e=>e.id===target.id).height=v),8,240);
      box.append(el('p','拖动沿通路调整位置；行为中的移动动作以 0～1 进度设置目的地。'));behaviorFields(d,target,box);return;
    }
    const update=(key,v)=>change(doc=>{const t=ref.type==='entity'?doc.entities.find(e=>e.id===ref.id):ref.type==='platform'?doc.platforms[ref.index]:doc[ref.type];
      if(key==='x'||key==='width'||key==='height')t[key]=v;else t.space[key==='elevation'?'height':key]=v;
      if(ref.type==='actor'){const n=doc.spatial.nodes.find(n=>n.id===doc.spatial.start);n.x=t.x;n.depth=t.space.depth;n.height=t.space.height;}
    });
    number(box,'位置 X','object-x',target.x,v=>update('x',v),25,1180);
    if(layered)planeField(box,d,'object-space-plane',target.space.plane,v=>change(doc=>{const t=ref.type==='entity'?doc.entities.find(e=>e.id===ref.id):ref.type==='platform'?doc.platforms[ref.index]:doc[ref.type];assignWalkPlane(doc,t,v);if(ref.type==='actor'){const n=doc.spatial.nodes.find(n=>n.id===doc.spatial.start);n.plane=v;n.depth=t.space.depth;}}));
    else number(box,'地面纵深','object-space-depth',target.space.depth,v=>update('depth',v),0,600);
    number(box,'离地高度','object-space-height',target.space.height,v=>update('elevation',v),0,360);
    if(['entity','platform'].includes(ref.type)){
      number(box,'宽度','object-width',target.width??28,v=>update('width',v),8,ref.type==='platform'?1200:600);
      if(!layered)number(box,'占地深度','object-space-size',target.space.depthSize??24,v=>update('depthSize',v),1,600);
      if(ref.type==='platform')number(box,'右端离地高度','object-space-end',target.space.heightEnd??target.space.height,v=>update('heightEnd',v),0,360);
      else{number(box,'物体自身高度','object-height',target.height??36,v=>update('height',v),8,240);behaviorFields(d,target,box);}
    }
  }
  const placement={depth:60,height:0,plane:null};
  function begin(e,spec){if(e.button!==0)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();
    if(spec.ref?.type==='entity'&&current().entities.find(t=>t.id===spec.ref.id)?.passage){selectedNode=null;choose(spec.ref);return;}
    if(spec.node){selectedNode=spec.node;choose(null);}else{selectedNode=null;choose(spec.ref);}
    gesture={...spec,before:current(),x:e.clientX,y:e.clientY,dx:0,dy:0,pointer:e.pointerId};overlay.setPointerCapture(e.pointerId);overlay.dataset.dragging='true';
  }
  function apply(d,g){
    const options={threshold:g.threshold??12,disabled:g.disabled,nodes:document.getElementById('snap-enabled').checked,surfaces:document.getElementById('surface-snap').checked};
    if(g.node){const n=d.spatial.nodes.find(n=>n.id===g.node),delta=unprojectSpace(d,{x:g.dx,y:d.spatial.projection.originY+g.dy},0);n.x=round(Math.max(20,Math.min(1180,n.x+delta.x)));if(isLayered(d))n.height=round(Math.max(0,Math.min(360,n.height-g.dy)));else n.depth=round(Math.max(0,Math.min(600,n.depth+delta.depth)));const p=snapSpacePoint(d,n,{...options,exclude:n.id});n.x=p.x;n.depth=p.depth;n.height=p.height;syncStart(d,n);}
    else if(g.handle)resizeObject(d,g.ref,g.handle,g.dx,g.dy);
    else{moveObject(d,g.ref,g.dx,g.dy);const t=g.ref.type==='entity'?d.entities.find(e=>e.id===g.ref.id):g.ref.type==='platform'?d.platforms[g.ref.index]:d[g.ref.type];if(t.space.passage)return;const p={x:t.x,...t.space};
      const snapped=snapSpacePoint(d,p,{...options,exclude:g.ref.type==='actor'?d.spatial.start:undefined,surfaces:g.ref.type==='platform'?false:options.surfaces}),a=projectSpace(d,p),b=projectSpace(d,snapped);if(a.x!==b.x||a.y!==b.y)moveObject(d,g.ref,b.x-a.x,b.y-a.y);}
  }
  function renderOverlay(d){
    overlay.replaceChildren();renderWires(d);
    const objects=[...d.platforms.map((o,index)=>({o,ref:{type:'platform',index}})),...d.entities.map(o=>({o,ref:{type:'entity',id:o.id}})),{o:d.actor,ref:{type:'actor'}},{o:d.goal,ref:{type:'goal'}}];
    for(const {o,ref} of objects){const b=spaceBounds(d,o.kind??ref.type,o),key=ref.type+(ref.id?':'+ref.id:ref.index!==undefined?':'+ref.index:':'),v=button('',()=>{});v.className='edit-object '+(o.kind??ref.type);v.dataset.ref=key;v.setAttribute('aria-label','选择：'+(o.label??ref.type));
      Object.assign(v.style,{left:b.x/12+'%',top:b.y/6.4+'%',width:Math.max(14,b.width)/12+'%',height:Math.max(14,b.height)/6.4+'%'});
      if(o.passage){const a=d.spatial.nodes.find(n=>n.id===o.passage.from),q=d.spatial.nodes.find(n=>n.id===o.passage.to),p=projectSpace(d,a),r=projectSpace(d,q),length=Math.hypot(r.x-p.x,r.y-p.y),nx=8*(r.y-p.y)/length,ny=-8*(r.x-p.x)/length;
        v.style.clipPath='polygon('+[[p.x+nx,p.y+ny],[r.x+nx,r.y+ny],[r.x-nx,r.y-ny],[p.x-nx,p.y-ny]].map(([x,y])=>((x-b.x)/b.width*100)+'% '+((y-b.y)/b.height*100)+'%').join(',')+')';}
      v.onpointerdown=e=>{if(tool()==='select')begin(e,{ref});};v.onclick=e=>{if(tool()==='wire'){if(ref.type==='entity'){e.stopPropagation();wireEntity(ref.id);}return;}if(tool()!=='select')return;e.stopPropagation();if(suppress){suppress=false;return;}selectedNode=null;choose(ref);};overlay.append(v);
      const selected=selection();if(!o.passage&&selected?.type===ref.type&&(ref.type==='entity'?selected.id===ref.id:ref.type==='platform'?selected.index===ref.index:true)&&['entity','platform'].includes(ref.type))for(const handle of ['e','n']){const h=button('',()=>{});h.className='resize-handle';h.dataset.resize=handle;h.setAttribute('aria-label','调整'+handle);Object.assign(h.style,{left:(b.x+(handle==='e'?b.width:b.width/2))/12+'%',top:(b.y+(handle==='n'?0:b.height/2))/6.4+'%'});h.onpointerdown=e=>begin(e,{ref,handle});overlay.append(h);}
    }
    for(const n of d.spatial.nodes){const p=projectSpace(d,n),v=button('',()=>{});v.className='space-route-node';v.dataset.spaceNode=n.id;v.setAttribute('aria-label','路线节点 '+n.id);v.title=n.id+' · 高度 '+n.height;
      Object.assign(v.style,{left:p.x/12+'%',top:p.y/6.4+'%'});v.onpointerdown=e=>{if(tool()==='select')begin(e,{node:n.id});};v.onclick=e=>{if(tool()!=='select')return;e.stopPropagation();if(suppress){suppress=false;return;}selectedNode=n.id;choose(null);};overlay.append(v);}
    wireRender(d);
  }
  window.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.pointer)return;const r=overlay.getBoundingClientRect();gesture.dx=(e.clientX-gesture.x)/r.width*1200;gesture.dy=(e.clientY-gesture.y)/r.height*640;gesture.threshold=12*1200/r.width;gesture.disabled=e.altKey;const d=structuredClone(gesture.before);apply(d,gesture);renderOverlay(d);preview(d);});
  function cancel(){if(!gesture)return;const id=gesture.pointer;gesture=null;delete overlay.dataset.dragging;if(overlay.hasPointerCapture(id))overlay.releasePointerCapture(id);renderOverlay(current());preview(current());}
  window.addEventListener('pointerup',e=>{if(!gesture||e.pointerId!==gesture.pointer)return;const g=gesture;gesture=null;delete overlay.dataset.dragging;overlay.releasePointerCapture(e.pointerId);suppress=true;if(g.dx||g.dy)change(d=>apply(d,g));});
  overlay.addEventListener('lostpointercapture',cancel);overlay.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
  return {fields,renderOverlay,cancel,placement,clearNode:()=>{selectedNode=null;}};
}
