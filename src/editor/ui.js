import { createEditorStore, createBlankLevel, addObject, deleteObject, addBehavior, renameBehavior, deleteBehavior, ruleWires, KIND_NAMES } from './model.js';
import { STATES, SKINS, eventTypes, floorY, validateLevel } from '../core/schema.js';
import { stateLabel } from '../core/engine.js';

const $ = id => document.getElementById(id);
const STORAGE = 'gothere.editor.v1';
const refKey = ref => ref.type==='entity' ? 'entity:'+ref.id : ref.type==='platform' ? 'platform:'+ref.index : ref.type;
const resolveObject = (d,ref) => ref?.type==='entity' ? d.entities.find(e=>e.id===ref.id) :
  ref?.type==='platform' ? d.platforms[ref.index] : ref?.type==='actor' ? d.actor : ref?.type==='goal' ? d.goal : null;
const element = (tag,text,className) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
function select(options,value,label,onChange,attribute) {
  const el=element('select');el.setAttribute('aria-label',label);
  if(attribute) el.setAttribute(attribute,'');
  for(const [id,name] of options){const option=element('option',name);option.value=id;el.append(option);}
  el.value=value;el.addEventListener('change',()=>onChange(el.value));return el;
}
function field(label,input) {const wrap=element('label',undefined,'edit-field');wrap.append(element('span',label),input);return wrap;}
function input(value,label,onChange,settings={}) {
  const el=element('input');Object.assign(el,settings);el.value=String(value);el.setAttribute('aria-label',label);
  el.addEventListener('change',()=>{const next=el.type==='number'?Number(el.value):el.value;
    if(el.type==='number' && (!el.value || !Number.isFinite(next) || !el.checkValidity())){el.reportValidity();el.value=String(value);return;}
    onChange(next);});return el;
}
const button = (name,handler,className='button secondary') => {const el=element('button',name,className);el.type='button';el.addEventListener('click',handler);return el;};
const eventNames={click:'点击',contact:'碰到',enter:'走入区域',board:'登上电梯',arrive:'抵达出口',done:'行为完成'};
const availableEvents=e=>eventTypes(e.kind).filter(t=>t!=='done'||e.behaviors?.length);
const actionList = (actions,path) => {for(const index of path)actions=actions[index].actions;return actions;};

/** DOM adapter only: the draft store and simulation do not depend on this interface. */
export function createEditorUI({play,leave,pause,notify}) {
  let store=createEditorStore(), restored=false, mode='closed', selection=null, tool='select', drag=null, serial=0,placementY=440;
  let wireSource=null,wireTarget=null,wireEvent=null,wireBehavior=null,wireSourceBehavior=null;
  try {const saved=localStorage.getItem(STORAGE);if(saved){store=createEditorStore(saved);restored=true;}}
  catch {notify('旧草稿无法读取。可以通过关卡数据重新导入备份。');}
  $('editor-toolbar').innerHTML=`<div class="workshop-heading"><div><p class="eyebrow">A LITTLE PLACE FOR BIG IDEAS</p><h2>给旅途添点小麻烦。</h2></div><span id="draft-status" role="status">草稿保存在此浏览器</span></div>
    <div class="editor-commands"><label class="draft-picker">我的草稿 <select id="draft-select" aria-label="切换草稿"></select></label><button id="editor-new" class="button secondary">＋ 空白地图</button><button id="editor-undo" class="button secondary" title="Ctrl+Z">↶ 撤销</button><button id="editor-redo" class="button secondary" title="Ctrl+Shift+Z">↷ 重做</button><button id="editor-save" class="button secondary">保存草稿</button><button id="editor-test" class="button primary">▷ 试玩草稿</button><button id="editor-return" class="button primary" hidden>← 返回编辑</button><button id="editor-exit" class="text-button">收起工坊</button></div>
      <div id="editor-tools" class="editor-tools" role="group" aria-label="选择放置工具"></div><div id="wire-controls" class="wire-controls"></div><p id="editor-help" class="editor-help">点击画面放置；选中后拖动或编辑坐标。方向键可微调，Delete 删除。</p>`;
  $('editor-panel').innerHTML=`<div class="edit-sidebar"><div class="section-heading"><h2>这段旅程</h2><span class="journal-label">THE PLAN</span></div><div id="level-fields"></div><div class="section-heading object-heading"><h2 id="object-title">选中一个东西</h2><span class="journal-label">INSPECT</span></div><div id="object-fields"></div><p class="editor-help">地面高度是脚底 Y。梯子改变楼层；电梯到位才能登上，不会自动等车。出口方向可单独设置。</p></div><div class="edit-rules"><div class="section-heading"><h2>然后，会发生什么？</h2><button id="add-rule" class="button secondary">＋ 新增规则</button></div><p class="editor-help">用连线工具选择起点、目标和行为。一个事件可连到多个物体；行为完成也能接出下一条线。规则面板支持条件与延迟。</p><div id="rule-list"></div></div><div id="editor-errors" class="data-error" role="alert" hidden></div>`;
  function save(explicit=false) {
    try {localStorage.setItem(STORAGE,store.serialize());$('draft-status').textContent='已保存在此浏览器 · 导出 JSON 可备份';if(explicit)notify('草稿已保存。');}
    catch {$('draft-status').textContent='浏览器无法保存 · 请使用关卡数据导出备份';if(explicit)notify('无法保存到浏览器，请导出 JSON 备份。');}
  }
  function edit(fn) {try{store.change(fn);save();render();}catch(error){notify(error.message);}}
  function setMode(next) {
    mode=next;const editing=mode==='editing', active=mode!=='closed';
    document.body.classList.toggle('editing',editing);document.body.classList.toggle('workshop',active);
    $('editor-toolbar').hidden=!active;$('editor-panel').hidden=!editing;$('editor-overlay').hidden=!editing;
    $('editor-tools').hidden=!editing;$('editor-help').hidden=!editing;$('editor-return').hidden=mode!=='testing';
    $('wire-controls').hidden=!editing || tool!=='wire';
    for(const id of ['draft-select','editor-new','editor-undo','editor-redo','editor-save','editor-test'])$(id).disabled=!editing;
    $('open-editor').textContent=active?'工坊已打开':'关卡工坊';
    if(editing)render();
  }
  function openDocument(level,key) {
    try {store.open(key,level);}catch(error){notify(error.message);return false;}
    pause();selection=null;tool='select';save();setMode('editing');return true;
  }
  function render() {
    const d=store.document(), validation=validateLevel(d);
    $('scene-title').textContent=d.name || '还没想好名字';$('scene-tag-text').textContent='正在创作';
    $('stage-note').textContent='✦ 给他安排一点麻烦，再帮他解决。';
    $('editor-errors').hidden=validation.valid;$('editor-errors').textContent='暂时还不能试玩：\n'+validation.errors.join('\n');
    $('editor-test').disabled=!validation.valid;
    const history=store.history();$('editor-undo').disabled=!history.undo;$('editor-redo').disabled=!history.redo;
    const picker=$('draft-select');picker.replaceChildren();
    for(const entry of store.entries()){const option=element('option',entry.name);option.value=entry.key;picker.append(option);}picker.value=store.key();
    renderTools();renderWireControls(d);renderOverlay(d);renderFields(d);renderRules(d);
  }
  function renderTools() {
    $('editor-overlay').dataset.mode=tool;
    $('editor-tools').replaceChildren();
    for(const [kind,name] of [['select','↖ 选择 / 拖动'],['wire','↗ 连线'],...['platform','bridge','switch','plate','gate','object','zone','ladder','lift'].map(k=>[k,KIND_NAMES[k]])]) {
      const el=button(name,()=>{tool=kind;renderTools();renderWireControls(store.document());},'tool-button');el.dataset.tool=kind;el.setAttribute('aria-pressed',String(kind===tool));$('editor-tools').append(el);
    }
    const placement=input(placementY,'放置高度 Y',value=>{placementY=value;},{id:'placement-y',type:'number',min:160,max:560,step:10});
    $('editor-tools').append(field('放置在 Y',placement));
  }
  function renderWireControls(d) {
    const box=$('wire-controls');box.replaceChildren();box.hidden=tool!=='wire';
    if(tool!=='wire')return;
    const source=d.entities.find(e=>e.id===wireSource),target=d.entities.find(e=>e.id===wireTarget);
    if(!source){wireSource=null;box.append(element('span','先点击场景中的事件起点。也可以在下方选择。'));}
    const refresh=()=>renderWireControls(store.document());
    box.append(field('事件起点',select([['','选择起点'],...d.entities.map(e=>[e.id,e.label])],source?.id??'','连线起点',value=>{wireSource=value||null;wireEvent=null;refresh();})));
    if(!source)return;
    const events=availableEvents(source);
    if(!events.includes(wireEvent))wireEvent=events[0];
    box.append(field('何时触发',select(events.map(t=>[t,eventNames[t]]),wireEvent,'连线事件',value=>{wireEvent=value;refresh();})));
    if(wireEvent==='done'){
      if(!source.behaviors.some(b=>b.id===wireSourceBehavior))wireSourceBehavior=source.behaviors[0].id;
      box.append(field('完成行为',select(source.behaviors.map(b=>[b.id,b.label]),wireSourceBehavior,'连线完成行为',value=>{wireSourceBehavior=value;})));
    }
    box.append(field('调用目标',select([['','点击目标物体'],...d.entities.map(e=>[e.id,e.label])],target?.id??'','连线目标',value=>{wireTarget=value||null;wireBehavior=null;refresh();})));
    if(!target)return;
    if(!target.behaviors?.length){
      box.append(button('给目标添加行为',()=>edit(doc=>addBehavior(doc.entities.find(e=>e.id===target.id)))));return;
    }
    if(!target.behaviors.some(b=>b.id===wireBehavior))wireBehavior=target.behaviors[0].id;
    box.append(field('调用行为',select(target.behaviors.map(b=>[b.id,b.label]),wireBehavior,'连线调用行为',value=>{wireBehavior=value;})));
    const connect=button('连接',()=>edit(doc=>{
      doc.rules.push({on:{type:wireEvent,source:wireSource,...(wireEvent==='done'?{behavior:wireSourceBehavior}:{})},
        actions:[{type:'invoke',target:wireTarget,behavior:wireBehavior}]});
    }),'button primary');connect.id='wire-connect';connect.disabled=d.rules.length>=128;box.append(connect);
    box.append(button('更换起点',()=>{wireSource=null;wireTarget=null;refresh();},'text-button'));
  }
  function renderWires(d) {
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 1200 640');svg.classList.add('wire-layer');svg.setAttribute('aria-label','事件连线');
    const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');
    for(const [key,value] of Object.entries({id:'wire-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'}))marker.setAttribute(key,value);
    const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');arrow.setAttribute('fill','#6b588d');marker.append(arrow);defs.append(marker);svg.append(defs);
    const point=id=>{const e=d.entities.find(e=>e.id===id);return e?{x:e.x+(e.width??28)/2,y:(['lift','ladder'].includes(e.kind)?e.toY:floorY(e))-40}:{x:d.actor.x,y:floorY(d.actor)-45};};
    const duplicates=new Map();
    for(const wire of ruleWires(d)){
      const from=point(wire.source),to=point(wire.target),key=wire.source+':'+wire.target,count=duplicates.get(key)??0;
      duplicates.set(key,count+1);
      const height=Math.min(from.y,to.y)-45-(wire.rule%4)*20-count*16;
      const path=document.createElementNS(ns,'path');
      path.setAttribute('d',wire.source===wire.target?
        `M ${from.x-6} ${from.y} C ${from.x-100} ${height-80}, ${from.x+100} ${height-80}, ${from.x+6} ${from.y}`:
        `M ${from.x} ${from.y} C ${from.x} ${height}, ${to.x} ${height}, ${to.x} ${to.y}`);
      path.setAttribute('marker-end','url(#wire-arrow)');path.classList.add('event-wire');path.dataset.rule=String(wire.rule);
      if(wire.delay)path.classList.add('has-delay');
      const title=document.createElementNS(ns,'title');
      title.textContent=`规则 ${wire.rule+1}：${eventNames[d.rules[wire.rule].on.type]} → ${wire.behavior??wire.type}${wire.delay?'（延迟 '+wire.delay/60+' 秒）':''}`;path.append(title);
      const focus=event=>{event.stopPropagation();const card=$('rule-list').querySelector('[data-rule="'+wire.rule+'"]');card?.scrollIntoView({block:'center'});card?.classList.add('wire-focus');};
      path.addEventListener('click',focus);svg.append(path);
      const label=document.createElementNS(ns,'text');label.setAttribute('x',String(wire.source===wire.target?from.x:(from.x+to.x)/2));
      label.setAttribute('y',String(wire.source===wire.target?height-45:(from.y+to.y)/8+height*.75-6));label.textContent=String(wire.rule+1);label.classList.add('wire-number');
      label.addEventListener('click',focus);svg.append(label);
    }
    $('editor-overlay').append(svg);
  }
  function renderOverlay(d) {
    $('editor-overlay').replaceChildren();
    const objects=[...d.platforms.map((p,i)=>({ref:{type:'platform',index:i},p,kind:'platform',name:'地面 '+(i+1)})),
      ...d.entities.map(p=>({ref:{type:'entity',id:p.id},p,kind:p.kind,name:p.label})),
      {ref:{type:'actor'},p:d.actor,kind:'actor',name:'旅行者'},{ref:{type:'goal'},p:d.goal,kind:'goal',name:'目的地'}];
    if(!resolveObject(d,selection))selection=null;
    renderWires(d);
    for(const {ref,p,kind,name} of objects){
      const connection=['ladder','lift'].includes(kind),surface=floorY(p),top=connection?p.toY-12:kind==='platform'?surface+4:surface-({bridge:0,switch:12,hazard:90,plate:7,gate:88,object:48,zone:20,actor:42,goal:145}[kind]??20);
      const height=connection?surface-p.toY+24:{platform:65,bridge:32,switch:53,hazard:110,plate:22,gate:105,object:60,zone:24,actor:82,goal:160}[kind];
      const width=kind==='actor'?44:kind==='goal'?72:Math.max(p.width??28,28), offset=kind==='actor'?22:0;
      const el=button(name,()=>{},'edit-object '+kind);el.dataset.ref=refKey(ref);el.setAttribute('aria-label','选择：'+name);
      el.setAttribute('aria-pressed',String(selection && refKey(selection)===refKey(ref)));
      el.style.left=(p.x-offset)/12+'%';el.style.top=top/6.4+'%';el.style.width=width/12+'%';el.style.height=height/6.4+'%';
      const label=element('span',name);el.replaceChildren(label);
      el.addEventListener('pointerdown',event=>{
        if(tool!=='select')return;
        event.preventDefault();event.stopPropagation();selection=ref;
        for(const sibling of $('editor-overlay').children)sibling.setAttribute('aria-pressed',String(sibling===el));
        renderFields(d);
        drag={ref,el,start:event.clientX,x:p.x,left:p.x-offset,dx:0,pointerId:event.pointerId};
      });
      el.addEventListener('click',event=>{if(tool==='wire'){event.stopPropagation();if(ref.type==='entity'){if(!wireSource){wireSource=p.id;wireEvent=null;}else{wireTarget=p.id;wireBehavior=null;}renderWireControls(store.document());}return;}if(tool==='select'){event.stopPropagation();selection=ref;renderOverlay(store.document());renderFields(store.document());}});
      $('editor-overlay').append(el);
    }
  }
  function renderFields(d) {
    const fields=$('level-fields');fields.replaceChildren();
    for(const [key,label,max] of [['name','名称',60],['description','玩法说明',300],['hint','提示',500]]) {
      fields.append(field(label,input(d[key]??'',label,value=>edit(doc=>{if(value||key!=='hint')doc[key]=value;else delete doc.hint;}),{id:'edit-'+key,maxLength:max})));
    }
    fields.append(field('行走速度（单位 / 秒）',input(d.actor.speed,'行走速度',value=>edit(doc=>{doc.actor.speed=value;}),{id:'edit-speed',type:'number',min:15,max:180,step:1})));
    const target=resolveObject(d,selection), box=$('object-fields');box.replaceChildren();
    $('object-title').textContent=target ? (target.label??KIND_NAMES[selection.type]) : '选中一个东西';
    if(!target){box.append(element('p','点击画面中的物件，或选择工具添加机关。','editor-help'));return;}
    const update=(key,value)=>edit(doc=>{resolveObject(doc,selection)[key]=value;});
    const geometry={platform:[0,1199],actor:[20,1150],goal:[40,1180],entity:[25,1175]}[selection.type];
    box.append(field('位置 X',input(target.x,'位置 X',value=>update('x',value),{id:'object-x',type:'number',min:geometry[0],max:geometry[1],step:1})));
    if(['platform','entity'].includes(selection.type)) box.append(field('宽度',input(target.width??28,'宽度',value=>update('width',value),{id:'object-width',type:'number',min:selection.type==='platform'?1:8,max:selection.type==='platform'?1200:600,step:1})));
    if(['platform','entity','actor','goal'].includes(selection.type))box.append(field('脚底高度 Y',input(floorY(target),'脚底高度 Y',value=>update('y',value===440?undefined:value),{id:'object-y',type:'number',min:160,max:560,step:10})));
    if(selection.type==='actor') {
      const direction=select([['1','向右'],['-1','向左']],String(target.direction??1),'起始朝向',value=>update('direction',Number(value)));
      direction.id='object-direction';box.append(field('起始朝向',direction));
    }
    if(selection.type==='entity') {
      box.append(field('显示名称',input(target.label,'显示名称',value=>update('label',value),{id:'object-label',maxLength:30})));
      const state=select(STATES[target.kind].map(s=>[s,stateLabel(s)]),target.state,'初始状态',value=>update('state',value));state.id='object-state';box.append(field('初始状态',state));
      box.append(element('p','标识：'+target.id,'editor-help'));
      if(target.kind==='object') {
        const skin=select(Object.entries(SKINS),target.appearance?.skin??'axe','外观',value=>edit(doc=>{resolveObject(doc,selection).appearance={skin:value};}));
        skin.id='object-skin';box.append(field('贴图外观',skin));
        const upload=element('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.setAttribute('aria-label','上传自定义 PNG、JPEG 或 WebP 贴图');upload.id='object-image';
        upload.addEventListener('change',()=>{const file=upload.files[0];if(!file)return;if(file.size>24000||!['image/png','image/jpeg','image/webp'].includes(file.type)){notify('贴图只接受 24 KiB 以内的 PNG、JPEG 或 WebP。');upload.value='';return;}
          const ref=structuredClone(selection),key=store.key(),reader=new FileReader();reader.onload=()=>{if(store.key()!==key)return;edit(doc=>{const e=resolveObject(doc,ref);if(e)e.appearance={...e.appearance,skin:e.appearance?.skin??'axe',image:reader.result};});};reader.onerror=()=>notify('无法读取贴图，请重新选择。');reader.readAsDataURL(file);});
        box.append(field('自定义贴图（24 KiB 内）',upload));
      }
      if(['ladder','lift'].includes(target.kind)) {
        box.append(field('上层脚底 Y',input(target.toY,'上层脚底 Y',value=>update('toY',value),{id:'object-to-y',type:'number',min:160,max:floorY(target)-40,step:10})));
        box.append(field('通行速度',input(target.speed,'通行速度',value=>update('speed',value),{id:'object-speed',type:'number',min:15,max:180,step:5})));
        for(const [key,label] of [['upperDirection','上层出口方向'],['lowerDirection','下层出口方向']]) {
          const direction=select([['','保持朝向'],['1','向右'],['-1','向左']],String(target[key]??''),label,value=>update(key,value?Number(value):undefined));direction.id='object-'+key;box.append(field(label,direction));
        }
      }
      if(target.kind==='object') {
        const patrol=element('input');patrol.type='checkbox';patrol.checked=Boolean(target.motion);patrol.setAttribute('aria-label','启用巡逻');patrol.addEventListener('change',()=>edit(doc=>{const e=resolveObject(doc,selection);e.motion=patrol.checked?{type:'patrol',minX:Math.max(25,e.x-50),maxX:Math.min(1200-(e.width??28),e.x+50),speed:45}:undefined;}));box.append(field('左右巡逻',patrol));
        if(target.motion)for(const [key,label,min,max] of [['minX','巡逻左界',25,1175],['maxX','巡逻右界',35,1190],['speed','巡逻速度',15,180]])box.append(field(label,input(target.motion[key],label,value=>edit(doc=>{resolveObject(doc,selection).motion[key]=value;}),{type:'number',min,max,step:5})));

      }
    }
    if(selection.type==='entity') {
      const collision=select([['','无特殊效果'],['lethal','接触致命']],target.contact?.effect??'','接触效果',value=>edit(doc=>{
        const e=resolveObject(doc,selection);if(value)e.contact={effect:value};else delete e.contact;
      }));collision.id='object-contact';box.append(field('接触效果',collision));
      if(target.contact)box.append(field('伤害说明',input(target.contact.message??'','伤害说明',value=>edit(doc=>{resolveObject(doc,selection).contact.message=value||undefined;}),{maxLength:120})));
      const behaviorBox=element('div',undefined,'behavior-editor');
      behaviorBox.append(element('strong','命名行为'),element('p','行为是一组可复用的动作。连线选择要调用的行为；完成后还能继续触发连线。','editor-help'));
      (target.behaviors??[]).forEach((behavior,bi)=>{
        const card=element('div',undefined,'behavior-card');card.dataset.behavior=behavior.id;
        card.append(field('行为 ID',input(behavior.id,'行为 ID',value=>edit(doc=>renameBehavior(doc,target.id,behavior.id,value)),{maxLength:48})));
        card.append(field('行为名称',input(behavior.label,'行为名称',value=>edit(doc=>{resolveObject(doc,selection).behaviors[bi].label=value;}),{maxLength:30})));
        renderActions(d,behavior.actions,card,fn=>edit(doc=>fn(resolveObject(doc,selection).behaviors[bi])));
        card.append(button('删除行为',()=>edit(doc=>deleteBehavior(doc,target.id,behavior.id)),'rule-remove'));behaviorBox.append(card);
      });
      if((target.behaviors??[]).length<16)behaviorBox.append(button('＋ 新行为',()=>edit(doc=>addBehavior(resolveObject(doc,selection))),'text-button'));
      box.append(behaviorBox);
    }
    if(['platform','entity'].includes(selection.type)) {
      const remove=button('删除物件',()=>edit(doc=>{deleteObject(doc,selection);selection=null;}),'button danger');remove.id='object-delete';box.append(remove);
      box.append(element('p','删除机关时，同时移除以它为事件源或条件的规则，并清理指向它的动作。','editor-help'));
    }
  }
  function renderActions(d,actions,parent,changeRule,path=[]) {
    const entities=d.entities.map(e=>[e.id,e.label]);
    actions.forEach((action,ai)=>{
      const changeAction=fn=>changeRule(r=>{const items=actionList(r.actions,path);fn(items[ai],items);});
      const row=element('div',undefined,'rule-row action-row');
      if(action.type!=='after') {
        row.append(select([['set','改变状态'],...(d.entities.some(e=>e.kind==='object')?[['hold','拿起']]:[]),['drop','放下'],['hurt','伤害主角'],...(d.entities.some(e=>e.behaviors?.length)?[['invoke','调用行为']]:[]),['turn','改变朝向']],action.type,'动作类型',value=>changeAction((a,items)=>{
          if(value===a.type)return;
          items[ai]=value==='set'?{type:'set',target:d.entities[0].id,state:d.entities[0].state}:
            value==='hold'?{type:'hold',target:d.entities.find(e=>e.kind==='object').id}:
            value==='hurt'?{type:'hurt',message:'这次不太友好。'}:
            value==='invoke'?{type:'invoke',target:d.entities.find(e=>e.behaviors?.length)?.id,behavior:d.entities.find(e=>e.behaviors?.length)?.behaviors[0]?.id}:
            value==='turn'?{type:'turn',direction:1}:{type:'drop'};
        }),'data-action-type'));
      }
      if(action.type==='after') {
        const group=element('div',undefined,'delayed-actions');
        const delay=input(action.ticks/60,'动作延迟秒数',value=>changeAction(a=>{a.ticks=Math.max(1,Math.round(value*60));}),
          {type:'number',min:1/60,max:60,step:'any'});delay.setAttribute('data-action-delay','');
        row.append(element('span','延迟'),delay,element('span','秒，然后'));
        if(actions.length>1)row.append(button('删除这组',()=>changeAction((a,items)=>items.splice(ai,1)),'rule-remove'));
        group.append(row);renderActions(d,action.actions,group,changeRule,[...path,ai]);parent.append(group);
      } else if(action.type==='set') {
        const target=d.entities.find(e=>e.id===action.target);
        row.append(element('span','设为'),
          select(entities,action.target,'动作目标',value=>changeAction(a=>{a.target=value;a.state=STATES[d.entities.find(e=>e.id===value).kind][0];}),'data-action-target'),
          select((STATES[target?.kind]??[]).map(s=>[s,stateLabel(s)]),action.state,'目标状态',value=>changeAction(a=>{a.state=value;}),'data-action-state'));
        if(actions.length>1)row.append(button('×',()=>changeAction((a,items)=>items.splice(ai,1)),'rule-remove'));
        parent.append(row);
      } else {
        if(action.type==='hold')row.append(select(d.entities.filter(e=>e.kind==='object').map(e=>[e.id,e.label]),action.target,'拿起哪个物件',value=>changeAction(a=>{a.target=value;})));
        if(action.type==='hurt')row.append(input(action.message??'','失败说明',value=>changeAction(a=>{a.message=value||undefined;}),{maxLength:120,className:'message-input'}));
        if(action.type==='invoke')row.append(select(entities.filter(([id])=>d.entities.find(e=>e.id===id)?.behaviors?.length),action.target,'调用哪个物体',value=>changeAction(a=>{a.target=value;a.behavior=d.entities.find(e=>e.id===value).behaviors[0].id;}),'data-action-target'),select((d.entities.find(e=>e.id===action.target)?.behaviors??[]).map(b=>[b.id,b.label]),action.behavior,'调用哪个行为',value=>changeAction(a=>{a.behavior=value;}),'data-action-behavior'));
        if(action.type==='turn')row.append(select([['1','向右'],['-1','向左']],String(action.direction),'改变朝向',value=>changeAction(a=>{a.direction=Number(value);})));
        if(actions.length>1)row.append(button('×',()=>changeAction((a,items)=>items.splice(ai,1)),'rule-remove'));
        parent.append(row);
      }
    });
    if(actions.length<32) {
      const next=()=>({type:'set',target:d.entities.find(e=>e.kind!=='ladder'&&e.kind!=='lift')?.id??d.entities[0]?.id,state:d.entities.find(e=>e.kind!=='ladder'&&e.kind!=='lift')?.state??d.entities[0]?.state});
      parent.append(button('＋ 一个动作',()=>changeRule(r=>{actionList(r.actions,path).push(next());}),'text-button'));
      parent.append(button('＋ 人物动作',()=>changeRule(r=>{actionList(r.actions,path).push({type:d.entities.some(e=>e.kind==='object')?'hold':'hurt',...(d.entities.some(e=>e.kind==='object')?{target:d.entities.find(e=>e.kind==='object').id}:{message:'旅途受挫。'})});}),'text-button'));
      if(path.length<4)parent.append(button('＋ 延迟动作',()=>changeRule(r=>{actionList(r.actions,path).push({type:'after',ticks:60,actions:[next()]});}),'text-button'));
    }
  }
  function renderRules(d) {
    const list=$('rule-list');list.replaceChildren();
    const sources=d.entities.filter(e=>eventTypes(e.kind).length);
    $('add-rule').disabled=!sources.length || d.rules.length>=128;
    if(!d.rules.length)list.append(element('p','还没有规则。用连线工具连接事件与行为，或添加一条规则。','empty-rules'));
    const entities=d.entities.map(e=>[e.id,e.label]);
    d.rules.forEach((rule,index)=>{
      const card=element('div',undefined,'rule-card'), head=element('div',undefined,'rule-heading');
      card.dataset.rule=String(index);
      const sourceName=d.entities.find(e=>e.id===rule.on.source)?.label??rule.on.source;
      const firstAction=rule.actions.find(a=>a.type!=='after');
      const targetName=firstAction?.target ? (d.entities.find(e=>e.id===firstAction.target)?.label??firstAction.target) : firstAction?.type==='hurt'?'主角':firstAction?.type==='hold'?'手持槽':'行为';
      head.append(element('strong','规则 '+String(index+1).padStart(2,'0')),element('span',sourceName+'  →  '+targetName,'wire-summary'),
        button('↑',()=>edit(doc=>{if(index>0)[doc.rules[index-1],doc.rules[index]]=[doc.rules[index],doc.rules[index-1]];}),'rule-remove'),
        button('删除规则',()=>edit(doc=>{doc.rules.splice(index,1);}),'rule-remove'));card.append(head);
      const changeRule=fn=>edit(doc=>fn(doc.rules[index]));
      const eventRow=element('div',undefined,'rule-row'),currentSource=d.entities.find(e=>e.id===rule.on.source);
      eventRow.append(element('span','当'),
        select(sources.map(e=>[e.id,e.label]),rule.on.source,'事件源',value=>changeRule(r=>{const source=d.entities.find(e=>e.id===value);r.on={source:value,type:availableEvents(source)[0]};}),'data-rule-source'),
        select(availableEvents(currentSource).map(type=>[type,eventNames[type]]),rule.on.type,'触发事件',value=>changeRule(r=>{r.on={source:r.on.source,type:value,...(value==='done'?{behavior:currentSource.behaviors[0].id}:{})};}),'data-rule-event'));
      if(rule.on.type==='done')eventRow.append(select((currentSource?.behaviors??[]).map(b=>[b.id,b.label]),rule.on.behavior,'完成哪个行为',value=>changeRule(r=>{r.on.behavior=value;}),'data-rule-behavior'));
      card.append(eventRow);
      (rule.if??[]).forEach((condition,ci)=>{
        const row=element('div',undefined,'rule-row'), target=d.entities.find(e=>e.id===condition.entity);
        if(Object.hasOwn(condition,'holding'))row.append(element('span','手上拿着'),select([['','空手'],...d.entities.filter(e=>e.kind==='object').map(e=>[e.id,e.label])],condition.holding??'','持有物件',value=>changeRule(r=>{r.if[ci]={holding:value||null};})));
        else row.append(element('span','且'),select(entities,condition.entity,'条件机关',value=>changeRule(r=>{r.if[ci]={entity:value,state:STATES[d.entities.find(e=>e.id===value).kind][0]};})),
          select((STATES[target?.kind]??[]).map(s=>[s,stateLabel(s)]),condition.state,'条件状态',value=>changeRule(r=>{r.if[ci].state=value;})));
        row.append(
          button('×',()=>changeRule(r=>{r.if.splice(ci,1);if(!r.if.length)delete r.if;}),'rule-remove'));card.append(row);
      });
      if((rule.if??[]).length<16)card.append(button('＋ 状态条件',()=>changeRule(r=>{r.if??=[];r.if.push({entity:d.entities[0].id,state:d.entities[0].state});}),'text-button'));
      if((rule.if??[]).length<16)card.append(button('＋ 持有条件',()=>changeRule(r=>{r.if??=[];r.if.push({holding:d.entities.find(e=>e.kind==='object')?.id??null});}),'text-button'));
      renderActions(d,rule.actions,card,changeRule);
      list.append(card);
    });
  }
  $('editor-overlay').addEventListener('click',event=>{
    if(tool==='select'||tool==='wire')return;const box=$('editor-overlay').getBoundingClientRect();
    const x=Math.round((event.clientX-box.left)/box.width*1200/10)*10;
    edit(doc=>{selection=addObject(doc,tool,x,placementY);});tool='select';renderTools();
  });
  window.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.pointerId)return;const width=$('editor-overlay').getBoundingClientRect().width;
    drag.dx=Math.round((event.clientX-drag.start)/width*1200/10)*10;
    drag.el.style.left=(drag.left+drag.dx)/12+'%';
  });
  window.addEventListener('pointerup',event=>{
    if(!drag || event.pointerId!==drag.pointerId)return;const moved=drag;drag=null;
    if(!moved.dx)return;
    edit(doc=>{const obj=resolveObject(doc,moved.ref), min=moved.ref.type==='platform'?0:moved.ref.type==='goal'?40:moved.ref.type==='actor'?20:25;
      const max=moved.ref.type==='actor'?1150:moved.ref.type==='goal'?1180:Math.min(moved.ref.type==='entity'?1175:1199,1200-(obj.width??28));
    obj.x=Math.max(min,Math.min(max,moved.x+moved.dx));});
  });
  window.addEventListener('pointercancel',()=>{drag=null;if(mode==='editing')renderOverlay(store.document());});
  $('editor-new').addEventListener('click',()=>{const id='map-'+Date.now().toString(36)+'-'+serial++;openDocument(createBlankLevel(id),'custom:'+id);});
  $('draft-select').addEventListener('change',()=>{store.open($('draft-select').value);selection=null;save();render();});
  $('editor-save').addEventListener('click',()=>save(true));
  const history=(redo)=>{if(redo?store.redo():store.undo()){save();render();}};
  $('editor-undo').addEventListener('click',()=>history(false));$('editor-redo').addEventListener('click',()=>history(true));
  $('add-rule').addEventListener('click',()=>edit(doc=>{
    const selected=resolveObject(doc,selection), source=selected && Object.hasOwn(STATES,selected.kind)?selected:doc.entities.find(e=>eventTypes(e.kind).length);
    if(!source)return;
    const target=doc.entities.find(e=>e.id!==source.id && e.kind!=='ladder' && e.kind!=='lift');
    const action=source.kind==='object'?{type:'hold',target:source.id}:
      ['ladder','lift'].includes(source.kind)?{type:'set',target:source.id,state:source.state}:
      target?{type:'set',target:target.id,state:target.state}:{type:'set',target:source.id,state:source.state};
    doc.rules.push({on:{type:availableEvents(source)[0],source:source.id},actions:[action]});
  }));
  $('editor-test').addEventListener('click',()=>{const d=store.document();if(!validateLevel(d).valid)return;setMode('testing');play(d);});
  $('editor-return').addEventListener('click',()=>{pause();setMode('editing');});
  $('editor-exit').addEventListener('click',()=>{pause();const d=store.document();setMode('closed');leave(validateLevel(d).valid?d:null);});
  document.addEventListener('keydown',event=>{
    if(mode!=='editing' || document.querySelector('dialog[open]') || ['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
    if((event.ctrlKey||event.metaKey) && ['z','y'].includes(event.key.toLowerCase())){event.preventDefault();history(event.shiftKey||event.key.toLowerCase()==='y');}
    else if(event.key==='Delete' && selection){event.preventDefault();edit(doc=>{deleteObject(doc,selection);selection=null;});}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && selection){event.preventDefault();edit(doc=>{const obj=resolveObject(doc,selection);
      if(['ArrowUp','ArrowDown'].includes(event.key))obj.y=Math.max(160,Math.min(560,floorY(obj)+(event.key==='ArrowDown'?10:-10)));
      else obj.x+=event.key==='ArrowRight'?10:-10;});}
    else if(event.key==='Escape'){tool='select';wireSource=null;wireTarget=null;renderTools();renderWireControls(store.document());}
  });
  return {
    active:()=>mode!=='closed',isEditing:()=>mode==='editing',document:()=>store.document(),
    open(level,key){if(restored){pause();restored=false;setMode('editing');}else openDocument(level,key);},
    openDocument,
    importDocument(level){if(!openDocument(level,'import:'+Date.now().toString(36)+'-'+serial++))throw new Error('无法创建导入草稿，请检查草稿数量。');},
    snapshot(){const d=store.document();return {tick:0,status:'ready',reason:null,actor:{x:d.actor.x,y:floorY(d.actor),direction:d.actor.direction??1,holding:null,mode:'walking'},
      entities:Object.fromEntries(d.entities.map(e=>[e.id,{...e,y:floorY(e),width:e.width??28,...(e.kind==='lift'?{carY:e.state==='upper'?e.toY:floorY(e)}:{})}])),events:[],clicks:0,timers:[]};},
  };
}
