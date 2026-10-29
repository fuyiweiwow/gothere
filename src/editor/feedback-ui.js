import {MOTIONS,PARTICLES,SOUNDS,feedbackDefault} from '../content/feedback-presets.js';
import {STATES,eventTypes} from '../core/schema.js';

const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const entries=o=>Object.entries(o);
const unique=(list,prefix)=>{let i=1;while(list.some(f=>f.id===prefix+i))i++;return prefix+i;};

/** Author subscriptions in the same document/history as geometry and artwork. */
export function createFeedbackUI({change,preview,stop,notify}) {
  const expanded=new Set();let target=null;
  function render(level,nodeId){
    const slots=(level.scene?.feedback??[]).filter(f=>f.target===nodeId);if(target!==nodeId){expanded.clear();if(slots[0])expanded.add(slots[0].id);target=nodeId;}
    const root=el('details');root.id='feedback-panel';root.className='feedback-panel';root.open=true;root.append(el('summary','动画与音效 · '+slots.length));
    const actions=el('div');actions.className='resource-actions';
    const add=el('button','＋ 添加反馈');add.id='feedback-add';add.className='button secondary';add.onclick=()=>change(d=>{const scene=d.scene;scene.feedback??=[];const id=unique(scene.feedback,'feedback-');expanded.add(id);scene.feedback.push(feedbackDefault(nodeId,id));});
    const cancel=el('button','停止预览');cancel.id='feedback-stop';cancel.className='text-button';cancel.onclick=stop;actions.append(add,cancel);root.append(actions);
    root.append(el('p','选择通用动画或特效；行为触发时播放。所有修改共用撤销和 JSON。'));
    for(const f of slots){
      const card=el('details');card.className='feedback-slot';card.dataset.feedbackId=f.id;card.open=expanded.has(f.id);card.ontoggle=()=>{if(card.open)expanded.add(f.id);else expanded.delete(f.id);};card.append(el('summary',f.label+' · '+MOTIONS[f.motion]));
      const update=(key,value)=>change(d=>{d.scene.feedback.find(s=>s.id===f.id)[key]=value;});
      const field=(label,key,value,options={})=>{const w=el('label'),title=el('span',label),input=el('input');w.className='edit-field';input.dataset.feedbackField=key;input.type=options.type??'number';input.value=value;
        for(const k of ['min','max','step','maxLength'])if(options[k]!==undefined)input[k]=options[k];
        input.onchange=()=>{if(!input.checkValidity()||input.type==='number'&&(!input.value||!Number.isFinite(Number(input.value)))){input.reportValidity();return;}update(key,input.type==='number'?(options.factor?Math.round(Number(input.value)*options.factor):Number(input.value)):input.value);};
        input.onkeydown=e=>{if(['Enter','Escape'].includes(e.key)&&!e.isComposing){e.stopPropagation();e.preventDefault();if(e.key==='Escape')input.value=value;input.blur();}};w.append(title,input);card.append(w);};
      const select=(label,key,items,value,fn=v=>update(key,v))=>{const w=el('label'),s=el('select');w.className='edit-field';s.dataset.feedbackField=key;for(const [id,label]of items){const o=el('option',label);o.value=id;s.append(o);}s.value=value;s.onchange=()=>fn(s.value);w.append(el('span',label),s);card.append(w);};
      const check=(label,key)=>{const w=el('label'),c=el('input');w.className='resource-check';c.type='checkbox';c.checked=f[key]??false;c.dataset.feedbackField=key;c.onchange=()=>update(key,c.checked);w.append(c,document.createTextNode(label));card.append(w);};
      field('反馈名称','label',f.label,{type:'text',maxLength:60});
      const types=[['start','场景开始'],['behavior','行为开始'],['event','物体事件'],['state','状态变为'],['lost','主角死亡'],['won','到达终点']].filter(([type])=>!['state','event','behavior'].includes(type)||level.entities.some(e=>type!=='behavior'||e.behaviors?.length));
      const setTrigger=(type,source)=>{const eligible=e=>type!=='behavior'||e.behaviors?.length,e=level.entities.find(e=>e.id===source&&eligible(e))??level.entities.find(eligible);
        update('trigger',['start','lost','won'].includes(type)?{type}:{type,source:e.id,...(type==='behavior'?{behavior:e.behaviors[0].id}:type==='state'?{state:e.state}:{event:eventTypes(e)[0]})});};
      select('触发时机','trigger-type',types,f.trigger.type,type=>setTrigger(type,f.trigger.source));
      if(['behavior','state','event'].includes(f.trigger.type)){
        const e=level.entities.find(e=>e.id===f.trigger.source),sources=level.entities.filter(e=>f.trigger.type!=='behavior'||e.behaviors?.length);
        select('来源物体','trigger-source',sources.map(e=>[e.id,e.label]),e.id,id=>setTrigger(f.trigger.type,id));
        const key={behavior:'behavior',state:'state',event:'event'}[f.trigger.type],items=key==='behavior'?e.behaviors.map(b=>[b.id,b.label]):key==='state'?STATES[e.kind].map(s=>[s,s]):eventTypes(e).map(s=>[s,s]);
        select(key==='behavior'?'命名行为':key==='state'?'目标状态':'事件槽','trigger-detail',items,f.trigger[key],v=>update('trigger',{...f.trigger,[key]:v}));
      }
      if(f.trigger.type==='lost')select('失败原因','trigger-reason',[['','所有失败'],['hurt','接触伤害'],['hard-landing','坠落'],['boundary','边界']],f.trigger.reason??'',v=>update('trigger',v?{type:'lost',reason:v}:{type:'lost'}));
      select('本体动画','motion',entries(MOTIONS),f.motion);select('特效','particles',entries(PARTICLES),f.particles);
      select('音效槽','sound',[...entries(SOUNDS),...(level.scene.sounds??[]).map(s=>[s.id,s.label])],f.sound);
      field('时长（秒）','duration',f.duration/60,{min:.1,max:6,step:.1,factor:60});field('延迟（秒）','delay',f.delay/60,{min:0,max:10,step:.1,factor:60});
      field('动画 / 发射强度','strength',f.strength,{min:0,max:2,step:.05});field('音量','volume',f.volume,{min:0,max:1,step:.05});
      select('重复触发','policy',[['restart','从头重播'],['overlay','叠加实例']],f.policy);check('循环播放','loop');check('结束保留本体姿态','hold');
      if(f.particles!=='none'){
        field('粒子数量','count',f.count,{min:1,max:48,step:1});field('粒子颜色','color',f.color,{type:'color'});field('发射方向（上=-90°）','direction',f.direction,{min:-180,max:180,step:1});
        for(const [k,label]of [['x','挂点 X（0左，1右）'],['y','挂点 Y（0上，1下）']]){
          const w=el('label'),input=el('input');w.className='edit-field';input.type='number';input.min=0;input.max=1;input.step=.05;input.value=f.anchor[k];input.dataset.feedbackField='anchor-'+k;input.onchange=()=>{if(input.value&&input.checkValidity())update('anchor',{...f.anchor,[k]:Number(input.value)});};w.append(el('span',label),input);card.append(w);
        }
      }
      const buttons=el('div');buttons.className='resource-actions';const play=el('button','▶ 预览'),remove=el('button','删除反馈');play.className=remove.className='button secondary';play.dataset.feedbackPreview=f.id;play.onclick=()=>preview(f);remove.onclick=()=>change(d=>{d.scene.feedback=d.scene.feedback.filter(s=>s.id!==f.id);});buttons.append(play,remove);card.append(buttons);
      select('复制到其他图层','copy-target',[['','选择目标图片…'],...level.scene.nodes.filter(n=>n.id!==nodeId).map(n=>[n.id,n.label])],'',id=>{if(id)change(d=>{const copy=structuredClone(f);copy.id=unique(d.scene.feedback,'feedback-');copy.target=id;d.scene.feedback.push(copy);});});
      root.append(card);
    }
    const audio=el('input');audio.id='sound-file';audio.type='file';audio.accept='.wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg';audio.hidden=true;
    const upload=el('button','＋ 导入音效 WAV / MP3 / OGG');upload.className='button secondary';upload.onclick=()=>audio.click();
    audio.onchange=async()=>{const file=audio.files[0];if(!file)return;try{
      const ext=file.name.split('.').at(-1).toLowerCase(),mime={wav:'wav',mp3:'mpeg',ogg:'ogg'}[ext];if(!mime||file.size>262144)throw new Error('请选择256 KiB以内、8秒以内的 WAV、MP3 或 OGG。');
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('声音文件读取失败。'));reader.readAsDataURL(file);});
      change(d=>{d.scene.sounds??=[];d.scene.sounds.push({id:unique(d.scene.sounds,'sound-'),label:file.name.slice(0,60),src:'data:audio/'+mime+';base64,'+src.split(',')[1]});});
    }catch(error){notify(error.message);}finally{audio.value='';}};
    root.append(upload,audio);return root;
  }
  return {render};
}
