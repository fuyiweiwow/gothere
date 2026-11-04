import {sceneTemplates} from './template-catalog.js';
import {moveComposition,copyComposition,detachComposition,removeComposition} from './templates.js';
import {assetLibrary} from '../render/resources.js';

const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(label,fn,cls='button secondary')=>{const b=el('button',label,cls);b.type='button';b.onclick=fn;return b;};

export function createTemplateUI({editor,select,choose,inspect,practice}){
  const templates=sceneTemplates();
  function render(level,box,selected,tool,placementPlane,setPlane){
    const start=button('＋ 新建街景练习',practice);start.id='template-practice';box.append(start);
    box.append(el('p','背景已成套。放入活动模板，再展开调整部件。','panel-note'));
    if(level.spatial?.mode==='layered'){
      const label=el('label',undefined,'edit-field'),s=el('select');s.id='template-plane';
      label.append(el('span','活动模板所属行走层'),s);for(const p of level.spatial.planes){const o=el('option',p.label);o.value=p.id;s.append(o);}
      s.value=placementPlane??level.spatial.planes[0].id;s.onchange=()=>setPlane(s.value);box.append(label);
    }
    const grid=el('div',undefined,'template-grid');box.append(grid);const assets=assetLibrary(level);
    for(const t of templates){
      const b=button('',()=>choose(t.id),'template-card');b.dataset.template=t.id;b.setAttribute('aria-pressed',String(tool==='template:'+t.id));
      b.disabled=Boolean(t.entities.length&&level.spatial?.mode!=='layered');
      const img=el('img');img.src=assets.find(a=>a.id===t.nodes[0].asset)?.src??'';img.alt='';
      b.append(img,el('strong',t.label),el('small',t.entities.length?'点击地图放置 · 自动贴合行走层':'点击地图放置 · 可展开编辑'));grid.append(b);
    }
    if(tool?.startsWith('template:'))box.append(el('p','点击地图放置；Esc 取消。完整背景按画布原位放置。','panel-note'));
    const c=level.scene?.compositions?.find(c=>c.id===selected);
    if(c){
      const section=el('section',undefined,'template-instance');section.dataset.composition=c.id;section.append(el('h3',c.label));
      section.append(el('p',c.entities.length?'整体沿行走层移动；展开后可编辑图片、动作与音效。':'背景和布景可整体移动，也可逐件调整。','panel-note'));
      const field=(label,key)=>{const wrap=el('label',undefined,'edit-field'),input=el('input');input.type='number';input.step='any';input.value=c.origin[key];input.id='composition-'+key;
        if(key==='y'&&c.entities.length)input.disabled=true;
        input.onchange=()=>{if(!input.value||!Number.isFinite(Number(input.value)))return;const delta=Number(input.value)-c.origin[key];editor.change(d=>moveComposition(d,c.id,key==='x'?delta:0,key==='y'?delta:0));};
        input.onkeydown=e=>{if(['Enter','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape')input.value=c.origin[key];input.blur();}};
        wrap.append(el('span',label),input);return wrap;};
      section.append(field('组合基准 X','x'),field('组合基准 Y','y'));
      const actions=el('div',undefined,'resource-actions');
      const duplicate=button('复制整个组合',()=>{let id;if(editor.change(d=>{id=copyComposition(d,c.id);}))select(id);});duplicate.id='composition-copy';
      const detach=button('解除组合',()=>{if(editor.change(d=>detachComposition(d,c.id)))select(null);});detach.id='composition-detach';
      const remove=button('删除整个组合',()=>{if(editor.change(d=>removeComposition(d,c.id)))select(null);},'button danger');remove.id='composition-delete';
      actions.append(duplicate,detach,remove);section.append(actions,el('h3','展开部件'));
      for(const id of c.nodes){const n=level.scene.nodes.find(n=>n.id===id);if(!n)continue;
        const part=button(n.label,()=>inspect(id),'template-part');part.dataset.templatePart=id;section.append(part);}
      box.append(section);
    }
    const list=el('div',undefined,'composition-list');list.append(el('h3','场景中的组合'));
    for(const c of level.scene?.compositions??[]){const b=button(c.label,()=>select(c.id),'template-part');b.dataset.selectComposition=c.id;b.setAttribute('aria-pressed',String(c.id===selected));list.append(b);}box.append(list);
  }
  return {render,find:id=>templates.find(t=>t.id===id)};
}
