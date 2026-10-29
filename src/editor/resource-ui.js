import {assetLibrary,artTransform,artCorners,artBounds} from '../render/resources.js';
import {ensureScene,addArt,moveArt,resizeArt,deleteArt,duplicateArt,bindArt} from './resources.js';
import {STATES} from '../core/schema.js';
import {alignMove,drawGuides} from './alignment.js';

const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,fn,cls='button secondary')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};

/** Resource authoring uses the same document/history, with its own visual selection and gestures. */
export function createResourceUI({editor,notify,preview,requestBind=()=>{},inspectLogic=()=>{}}) {
  let selected=null,tool=null,tab='library',query='',category='全部',variant='',gesture=null,suppress=false,current;
  const hiddenLayers=new Set(),lockedLayers=new Set();
  const panel=$('resource-panel'),overlay=$('resource-overlay');overlay.tabIndex=0;
  panel.innerHTML='<div class="resource-title"><h2>资源场景</h2><span>图片与判定独立</span></div><div class="editor-tabs"><button id="resource-library-tab" class="editor-tab">资源库</button><button id="resource-inspect-tab" class="editor-tab">选中资源</button></div><div id="resource-content" class="resource-content"></div><div class="resource-layers"><div class="resource-layer-heading"><strong>场景图层</strong><button id="art-select" class="text-button">选择 · Esc</button></div><input id="layer-search" type="search" placeholder="筛选图层名称…" aria-label="筛选资源图层"><div id="resource-layers"></div></div>';
  let layerQuery='';$('layer-search').addEventListener('input',()=>{layerQuery=$('layer-search').value;renderLayers(current);});
  $('resource-library-tab').onclick=()=>{tab='library';render(current);};$('resource-inspect-tab').onclick=()=>{tab='inspect';render(current);};
  $('art-select').onclick=()=>{tool=null;render(current);};
  const change=fn=>editor.change(fn);
  function choose(id){selected=id;tool=null;variant='';tab='inspect';render(editor.document());preview(current);overlay.focus({preventScroll:true});}
  function field(name,value,fn,{id,type='number',min,max,step=1}={}) {
    const label=el('label',undefined,'edit-field'),input=el('input');label.append(el('span',name),input);input.type=type;input.value=value;
    if(id)input.id=id;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(type==='number')input.step=step;
    input.addEventListener('change',()=>{if(!input.checkValidity()||type==='number'&&(!input.value||!Number.isFinite(Number(input.value)))){input.reportValidity();return;}fn(type==='number'?Number(input.value):input.value);});
    input.addEventListener('keydown',e=>{if(['Enter','Escape'].includes(e.key)&&!e.isComposing){e.stopPropagation();e.preventDefault();if(e.key==='Escape')input.value=value;input.blur();overlay.focus({preventScroll:true});}});return label;
  }
  function select(label,items,value,fn,id){const wrapper=el('label',undefined,'edit-field'),s=el('select');wrapper.append(el('span',label),s);if(id)s.id=id;for(const [v,text]of items){const o=el('option',text);o.value=v;s.append(o);}s.value=value;s.onchange=()=>fn(s.value);return wrapper;}
  function checkbox(label,checked,fn,id){const w=el('label',undefined,'resource-check'),c=el('input');c.type='checkbox';c.checked=checked;if(id)c.id=id;c.onchange=()=>fn(c.checked);w.append(c,document.createTextNode(label));return w;}
  function renderLibrary(d,box){
    const search=el('input');search.type='search';search.id='asset-search';search.placeholder='搜索图片、窗、屋顶…';search.value=query;search.setAttribute('aria-label','搜索美术资源');box.append(search);
    search.oninput=()=>{query=search.value;renderItems(d,items);};
    const filters=el('div',undefined,'library-categories');box.append(filters);
    for(const name of ['全部','墙面','屋顶','窗门','细节','机关','角色','天空远景','自定义']){const b=button(name,()=>{category=name;renderLibraryRefresh();},'library-filter');b.setAttribute('aria-pressed',String(name===category));filters.append(b);}
    const hint=el('p',tool?'点击地图连续放置 · Esc 切回选择':'选择图片后连续放置；点击图层编辑资源。','panel-note');box.append(hint);
    box.append(field('场景底色',d.scene?.background??'#182044',v=>change(doc=>{ensureScene(doc).background=v;}),{id:'scene-background',type:'color'}));
    const upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.id='asset-upload';upload.hidden=true;upload.onchange=()=>importImage(upload.files[0]);
    box.append(button('＋ 导入本地 PNG / JPEG / WebP',()=>upload.click()),upload);
    const items=el('div',undefined,'asset-grid');items.id='asset-grid';box.append(items);renderItems(d,items);
    const credit=el('details',undefined,'panel-note');credit.append(el('summary','素材来源 · CC0'));
    for(const [label,path]of [['Kenney · 建筑与门窗','platformer-art-buildings'],['Kenney · 天空与远景','background-elements'],['Kenney · 人物动作','toon-characters']]){const p=el('p'),link=el('a',label);link.href='https://kenney.nl/assets/'+path;link.target='_blank';link.rel='noopener';p.append(link);credit.append(p);}
    const license=el('a','CC0 1.0 许可');license.href='https://creativecommons.org/publicdomain/zero/1.0/';license.target='_blank';license.rel='noopener';credit.append(license,el('p','项目补充图形也为 CC0。离线文件内含素材；可修改、分享并用于商业项目。'));box.append(credit);
  }
  function renderLibraryRefresh(){render(current);}
  function renderItems(d,box){box.replaceChildren();for(const asset of assetLibrary(d).filter(a=>(category==='全部'||(a.category??'自定义')===category)&&(a.label+' '+a.id).toLowerCase().includes(query.toLowerCase()))){
    const b=button('',()=>{tool=asset.id;selected=null;render(current);},'asset-card');b.dataset.asset=asset.id;b.setAttribute('aria-pressed',String(tool===asset.id));b.title=asset.label+' · '+asset.width+' × '+asset.height;
    const image=el('img');image.src=asset.src;image.alt='';image.loading='lazy';b.append(image,el('span',asset.label));box.append(b);
  }}
  async function importImage(file){
    if(!file)return;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>262144)throw new Error('请选择256 KiB以内的 PNG、JPEG 或 WebP。');
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('图片读取失败。'));r.readAsDataURL(file);});
      const image=new Image();image.src=data;await image.decode();if(image.naturalWidth>2048||image.naturalHeight>2048)throw new Error('图片最长边不能超过2048。');
      const key=editor.document().id,id='custom-'+Date.now().toString(36);if(!editor.isEditing())return;
      if(change(d=>{if(d.id!==key)throw new Error('草稿已改变，请重新导入。');ensureScene(d).assets.push({id,label:file.name.slice(0,60),src:data,width:image.naturalWidth,height:image.naturalHeight});})){tool=id;category='自定义';tab='library';query='';render(editor.document());notify('图片已加入资源库，点击地图放置。');}
    }catch(e){notify(e.message);}
  }
  function renderInspector(d,box){
    const n=d.scene?.nodes.find(n=>n.id===selected);if(!n){box.append(el('p','点击地图资源或下方图层，调整图片而不改变逻辑实体。','empty-state'));return;}
    const library=assetLibrary(d),editing=variant?(n.variants?.[variant]??{}):n,effective={...n,...editing};
    const animation=Object.hasOwn(editing,'animation')?editing.animation:variant&&editing.asset?null:n.animation;
    const update=(key,v)=>change(doc=>{const node=doc.scene.nodes.find(n=>n.id===selected);if(variant){node.variants??={};node.variants[variant]??={};node.variants[variant][key]=v;}else node[key]=v;});
    box.append(field('图层名称',n.label,v=>change(doc=>{doc.scene.nodes.find(n=>n.id===selected).label=v;}),{id:'art-label',type:'text'}));
    const bindings=[['','独立布景（无逻辑）'],['actor','主角'],['goal','终点'],...d.entities.map(e=>['entity:'+e.id,e.label]),...d.platforms.map((_,i)=>['platform:'+i,'路面 '+(i+1)])];
    const b=n.bind,value=b?.type==='entity'?'entity:'+b.id:b?.type==='platform'?'platform:'+b.index:b?.type??'';
    box.append(select('跟随逻辑对象',bindings,value,v=>{variant='';change(doc=>bindArt(doc,selected,!v?null:v.startsWith('entity:')?{type:'entity',id:v.slice(7)}:v.startsWith('platform:')?{type:'platform',index:Number(v.slice(9))}:{type:v}));},'art-bind'));
    const bindActions=el('div',undefined,'resource-actions');
    const pick=button('在画布中点选绑定',()=>requestBind(selected));pick.id='pick-art-binding';bindActions.append(pick);
    if(n.bind){const inspect=button('查看逻辑实体',()=>inspectLogic(n.bind));inspect.id='inspect-art-logic';bindActions.append(inspect);}
    box.append(bindActions);
    if(n.bind?.type==='entity'){const e=d.entities.find(e=>e.id===n.bind.id);box.append(select('编辑状态变体',[['','基础资源'],...[...new Set([...STATES[e.kind],...Object.keys(n.variants??{})])].map(s=>[s,s])],variant,v=>{variant=v;render(current);preview(current);},'art-state'));
      if(variant)box.append(button('移除此状态覆盖',()=>{const state=variant;variant='';change(doc=>{const node=doc.scene.nodes.find(n=>n.id===selected);if(node.variants)delete node.variants[state];});},'text-button'));
    }
    box.append(select('图片',library.map(a=>[a.id,a.label]),effective.asset,v=>update('asset',v),'art-asset'));
    const image=el('img',undefined,'asset-inspector-image');image.src=library.find(a=>a.id===effective.asset)?.src??'';image.alt=effective.label;box.append(image);
    const grid=el('div',undefined,'asset-field-grid');box.append(grid);
    for(const [k,label,min,max]of [['x',n.bind?'偏移 X':'位置 X',-2400,3600],['y',n.bind?'偏移 Y':'位置 Y',-1280,1920],['width','图片宽度',1,2400],['height','图片高度',1,1920],['rotation','附加角度',-180,180],['layer','显示层级',-100,100]])
      grid.append(field(label,effective[k]??0,v=>update(k,v),{id:'art-'+k,min,max,step:k==='rotation'?.1:1}));
    box.append(field('不透明度',effective.opacity??1,v=>update('opacity',v),{id:'art-opacity',min:0,max:1,step:.05}));
    box.append(checkbox('水平翻转',effective.flipX??false,v=>update('flipX',v),'art-flip'));
    box.append(checkbox('显示此图片',effective.visible!==false,v=>update('visible',v),'art-visible'));
    if(!variant){box.append(checkbox('平铺纹理',Boolean(n.tile),v=>change(doc=>{const node=doc.scene.nodes.find(n=>n.id===selected);if(v)node.tile={width:64,height:64};else delete node.tile;}),'art-tile'));
      if(n.tile)for(const [key,label]of [['width','纹理单元宽'],['height','纹理单元高']])box.append(field(label,n.tile[key],v=>change(doc=>{doc.scene.nodes.find(n=>n.id===selected).tile[key]=v;}),{id:'art-tile-'+key,min:8,max:512}));}
    const setAnimation=value=>change(doc=>{const node=doc.scene.nodes.find(n=>n.id===selected);if(variant){node.variants??={};node.variants[variant]??={};node.variants[variant].animation=value;}else if(value)node.animation=value;else delete node.animation;});
    box.append(checkbox('启用逐帧动画',Boolean(animation),v=>setAnimation(v?{frames:[effective.asset,effective.asset],fps:6}:null),'art-animation'));
    if(animation){animation.frames.forEach((id,i)=>{
        box.append(select('动画帧 '+(i+1),library.map(a=>[a.id,a.label]),id,v=>{const a=structuredClone(animation);a.frames[i]=v;setAnimation(a);},'art-frame-'+i));
        if(animation.frames.length>1)box.append(button('移除第 '+(i+1)+' 帧',()=>{const a=structuredClone(animation);a.frames.splice(i,1);setAnimation(a);},'text-button'));
      });
      box.append(field('动画帧率',animation.fps,v=>setAnimation({...animation,fps:v}),{id:'art-fps',min:1,max:30}));
      if(animation.frames.length<24)box.append(button('＋ 动画帧',()=>setAnimation({...animation,frames:[...animation.frames,animation.frames.at(-1)]}),'text-button'));
    }
    box.append(el('p','图片边框是显示范围。跟随对象时，位置是相对偏移；移动、缩放、换图不会改变碰撞体、路面或行为。','panel-note'));
    const actions=el('div',undefined,'resource-actions');actions.append(button('复制图层',()=>{let id;change(doc=>{id=duplicateArt(doc,selected);});choose(id);}),button('删除图片',()=>{const id=selected;selected=null;change(doc=>deleteArt(doc,id));},'button danger'));box.append(actions);
  }
  function renderLayers(d){const list=$('resource-layers');list.replaceChildren();for(const n of [...(d.scene?.nodes??[])].sort((a,b)=>b.layer-a.layer).filter(n=>(n.label+' '+n.id).toLowerCase().includes(layerQuery.toLowerCase()))){
    const row=el('div',undefined,'resource-layer-row'),b=button('',()=>choose(n.id),'resource-layer');b.dataset.artId=n.id;b.setAttribute('aria-pressed',String(selected===n.id));b.append(el('code',String(n.layer)),el('span',n.label),el('small',n.bind?'↔':'·'));
    const eye=button(hiddenLayers.has(n.id)?'隐':'显',()=>{if(hiddenLayers.has(n.id))hiddenLayers.delete(n.id);else hiddenLayers.add(n.id);render(current);preview(current);},'layer-visibility');eye.title='仅在编辑时隐藏此图层';eye.dataset.layerVisibility=n.id;eye.setAttribute('aria-pressed',String(!hiddenLayers.has(n.id)));
    const lock=button(lockedLayers.has(n.id)?'锁':'解',()=>{if(lockedLayers.has(n.id))lockedLayers.delete(n.id);else lockedLayers.add(n.id);render(current);},'layer-lock');lock.title='锁定画布和快捷键操作；仍可在属性面板编辑';lock.dataset.layerLock=n.id;lock.setAttribute('aria-pressed',String(lockedLayers.has(n.id)));
    row.append(b,eye,lock);list.append(row);
  }}
  function renderOverlay(d){overlay.replaceChildren();
    for(const n of [...(d.scene?.nodes??[])].sort((a,b)=>a.layer-b.layer)){
      const t=artTransform(n,d,undefined,{variant:selected===n.id?variant:undefined});if((t.visible===false&&selected!==n.id)||hiddenLayers.has(n.id)||lockedLayers.has(n.id))continue;
      const b=button('',()=>{},'art-object');b.dataset.art=n.id;b.title=n.label;b.setAttribute('aria-label','选择资源：'+n.label);b.setAttribute('aria-pressed',String(n.id===selected));
      Object.assign(b.style,{left:t.x/12+'%',top:t.y/6.4+'%',width:t.width/12+'%',height:t.height/6.4+'%',transform:'rotate('+t.rotation+'deg)',zIndex:String(n.layer+101)});
      b.onpointerdown=e=>{if(tool||e.button!==0)return;e.preventDefault();e.stopPropagation();begin(e,n.id);};
      b.onclick=e=>{if(tool)return;if(suppress){suppress=false;return;}e.stopPropagation();choose(n.id);};overlay.append(b);
    }
    const n=d.scene?.nodes.find(n=>n.id===selected);if(n&&!tool&&!hiddenLayers.has(n.id)&&!lockedLayers.has(n.id)){const corners=artCorners(n,d,undefined,{variant});for(const h of ['nw','ne','se','sw']){const handle=button('',()=>{},'resize-handle art-resize');handle.dataset.artResize=h;handle.setAttribute('aria-label','缩放资源 '+h);handle.style.left=corners[h].x/12+'%';handle.style.top=corners[h].y/6.4+'%';handle.style.zIndex='205';handle.onpointerdown=e=>{e.preventDefault();e.stopPropagation();begin(e,n.id,h);};overlay.append(handle);}}
    overlay.dataset.placing=String(Boolean(tool));
  }
  function begin(event,id,handle){document.activeElement?.blur();if(selected!==id)variant='';selected=id;tool=null;tab='inspect';const before=editor.document();gesture={id,handle,variant,startX:event.clientX,startY:event.clientY,dx:0,dy:0,before,pointerId:event.pointerId,
    box:artBounds(before.scene.nodes.find(n=>n.id===id),before,undefined,{variant}),targets:before.scene.nodes.filter(n=>n.id!==id&&!hiddenLayers.has(n.id)&&artTransform(n,before).visible!==false).map(n=>artBounds(n,before))};overlay.setPointerCapture(event.pointerId);overlay.dataset.dragging='true';render(editor.document());preview(current);overlay.focus({preventScroll:true});}
  const apply=(d,g)=>g.handle?resizeArt(d,g.id,g.handle,g.dx,g.dy,g.variant):moveArt(d,g.id,g.dx,g.dy,g.variant);
  overlay.addEventListener('pointermove',e=>{if(!gesture||gesture.pointerId!==e.pointerId)return;const b=overlay.getBoundingClientRect();gesture.dx=Math.round((e.clientX-gesture.startX)/b.width*12000)/10;gesture.dy=Math.round((e.clientY-gesture.startY)/b.height*6400)/10;
    let guides=[];if(!gesture.handle){const aligned=alignMove(gesture.box,gesture.targets,gesture.dx,gesture.dy,{threshold:6*1200/b.width,disabled:e.altKey||!$('snap-enabled').checked});gesture.dx=aligned.dx;gesture.dy=aligned.dy;guides=aligned.guides;}drawGuides($('alignment-guides'),guides);
    const d=structuredClone(gesture.before);apply(d,gesture);renderOverlay(d);preview(d);});
  overlay.addEventListener('pointerup',e=>{if(!gesture||gesture.pointerId!==e.pointerId)return;const g=gesture;gesture=null;delete overlay.dataset.dragging;drawGuides($('alignment-guides'),[]);overlay.releasePointerCapture(e.pointerId);suppress=true;if(g.dx||g.dy)change(d=>apply(d,g));else render(current);});
  const cancel=()=>{if(!gesture)return;const id=gesture.pointerId;gesture=null;delete overlay.dataset.dragging;drawGuides($('alignment-guides'),[]);if(overlay.hasPointerCapture(id))overlay.releasePointerCapture(id);render(editor.document());preview(editor.document());};
  overlay.addEventListener('pointerdown',()=>{suppress=false;},{capture:true});
  overlay.addEventListener('lostpointercapture',cancel);overlay.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
  overlay.addEventListener('click',e=>{if(suppress){suppress=false;return;}if(!tool){selected=null;variant='';render(current);preview(current);return;}const b=overlay.getBoundingClientRect(),asset=assetLibrary(editor.document()).find(a=>a.id===tool);change(d=>addArt(d,asset,Math.round((e.clientX-b.left)/b.width*1200),Math.round((e.clientY-b.top)/b.height*640)));});
  document.addEventListener('keydown',e=>{
    if(document.body.dataset.editTarget!=='art'||!editor.isEditing()||e.isComposing||e.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();tool=null;selected=null;variant='';render(editor.document());preview(current);return;}
    if(gesture){if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();cancel();}return;}
    if(selected&&lockedLayers.has(selected)&&(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'].includes(e.key)||e.ctrlKey&&e.key.toLowerCase()==='d')){e.preventDefault();e.stopImmediatePropagation();return;}
    if(selected&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();const id=selected;if(['Delete','Backspace'].includes(e.key)){selected=null;change(d=>deleteArt(d,id));}else change(d=>moveArt(d,id,(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)*(e.shiftKey?10:1),(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)*(e.shiftKey?10:1),variant));}
    if(selected&&e.ctrlKey&&e.key.toLowerCase()==='d'){e.preventDefault();let id;change(d=>{id=duplicateArt(d,selected);});choose(id);}
    if(e.ctrlKey&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopImmediatePropagation();tab='library';render(current);$('asset-search').focus();$('asset-search').select();}
    if(selected&&e.key==='F2'){e.preventDefault();e.stopImmediatePropagation();tab='inspect';render(current);$('art-label').focus();$('art-label').select();}
    if(!e.ctrlKey&&e.key.toLowerCase()==='v'){e.preventDefault();tool=null;render(current);}
  },true);
  function render(d){if(!d)return;current=d;if(selected&&!d.scene?.nodes.some(n=>n.id===selected))selected=null;
    $('resource-library-tab').setAttribute('aria-selected',String(tab==='library'));$('resource-inspect-tab').setAttribute('aria-selected',String(tab==='inspect'));
    const box=$('resource-content');box.replaceChildren();if(tab==='library')renderLibrary(d,box);else renderInspector(d,box);renderLayers(d);renderOverlay(d);
  }
  return {render,select:choose,cancel,selected:()=>selected,hiddenLayers:()=>hiddenLayers,variant:()=>selected?{id:selected,state:variant}:null};
}
