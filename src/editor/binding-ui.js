import {diagramBounds} from '../core/geometry.js';
import {posePolygon} from '../core/pose.js';
import {floorY} from '../core/schema.js';
import {surfaceEndY} from '../core/surfaces.js';
import {artBounds} from '../render/resources.js';
import {bindArt} from './resources.js';

const key=b=>b?b.type+':'+(b.id??b.index??''):'';
const svg=(name,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};

/** A temporary calibration view. Visibility and picking never enter the game document. */
export function createBindingUI({editor,resources,paint,notify}) {
  const overlay=document.getElementById('binding-overlay'),hint=document.getElementById('binding-hint');let picking=null;
  const cancel=()=>{picking=null;overlay.dataset.picking='false';hint.textContent='图片与逻辑叠加校准 · 淡化其中一层，或点选绑定对象';};
  function render(level,snapshot){
    overlay.replaceChildren();overlay.style.opacity=document.getElementById('logic-opacity').value;
    const selected=level.scene?.nodes.find(n=>n.id===resources.selected()),editingLogic=document.body.dataset.editTarget==='logic';
    const highlight=key(picking?null:editingLogic?editor.selection():selected?.bind);
    const objects=[...level.platforms.map((p,index)=>({ref:{type:'platform',index},p,kind:'platform',label:'路面 '+(index+1)})),
      ...level.entities.map(e=>({ref:{type:'entity',id:e.id},p:snapshot?.entities[e.id]??e,kind:e.kind,label:e.label})),
      {ref:{type:'actor'},p:snapshot?.actor??level.actor,kind:'actor',label:'主角'},{ref:{type:'goal'},p:level.goal,kind:'goal',label:'终点'}];
    for(const {ref,p,kind,label}of objects){
      const b=diagramBounds(kind,p),chosen=key(ref)===highlight,group=svg('g',{'data-binding-ref':key(ref),class:chosen?'binding-shape selected':'binding-shape'});
      const shape=p.pose?svg('polygon',{points:posePolygon(p).map(p=>p.x+','+p.y).join(' ')}):kind==='platform'?
        svg('polygon',{points:`${p.x},${floorY(p)} ${p.x+p.width},${surfaceEndY(p)} ${p.x+p.width},${surfaceEndY(p)+10} ${p.x},${floorY(p)+10}`}):svg('rect',{x:b.x,y:b.y,width:b.width,height:b.height});
      const title=svg('title');title.textContent=label;group.append(title,shape);
      if(chosen||picking){const text=svg('text',{x:b.x,y:Math.max(12,b.y-6)});text.textContent=label;group.append(text);}
      if(picking){group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label','绑定到 '+label);
        const choose=e=>{e.preventDefault();e.stopPropagation();if(!picking||!editor.isEditing())return;const id=picking;cancel();if(editor.change(d=>bindArt(d,id,ref))){resources.select(id);notify('已绑定到 '+label+'，图片保持原位置。');}paint(editor.document());};
        group.addEventListener('click',choose);group.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key))choose(e);});}
      overlay.append(group);
    }
    if(selected?.bind&&!picking){const target=objects.find(o=>key(o.ref)===key(selected.bind));if(target){const a=artBounds(selected,level,snapshot),b=diagramBounds(target.kind,target.p);overlay.append(svg('line',{x1:a.x+a.width/2,y1:a.y+a.height/2,x2:b.x+b.width/2,y2:b.y+b.height/2,class:'binding-link'}));}}
  }
  document.getElementById('cancel-binding').onclick=()=>{cancel();paint(editor.document());};
  window.addEventListener('keydown',e=>{if(picking&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();paint(editor.document());}},true);
  return {render,cancel,start(id){if(!editor.isEditing())return;picking=id;overlay.dataset.picking='true';hint.textContent='点选图片要跟随的逻辑实体 · Esc 取消';paint(editor.document());}};
}
