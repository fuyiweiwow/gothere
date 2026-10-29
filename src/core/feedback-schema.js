import {MOTIONS,PARTICLES,SOUNDS} from '../content/feedback-presets.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const number=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const id=v=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(v);

export function validateFeedback(level) {
  const scene=level.scene,errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};if(!scene)return errors;
  const sounds=new Set(Object.keys(SOUNDS));let bytes=0;
  if(scene.sounds!==undefined){
    check(Array.isArray(scene.sounds)&&scene.sounds.length<=8,'最多导入8个声音。');
    if(Array.isArray(scene.sounds))for(const s of scene.sounds.slice(0,9)){
      if(!object(s)){check(false,'声音格式无效。');continue;}
      check(id(s.id)&&!sounds.has(s.id),'声音标识无效或重复。');sounds.add(s.id);
      check(typeof s.label==='string'&&s.label.length>0&&s.label.length<=60,'声音名称最多60字。');
      check(typeof s.src==='string'&&s.src.length<=350000&&/^data:audio\/(wav|x-wav|wave|mpeg|mp3|ogg);base64,[A-Za-z0-9+/]+={0,2}$/.test(s.src),'声音只接受内嵌 WAV、MP3、OGG，单个最多256 KiB。');
      if(typeof s.src==='string')bytes+=s.src.length;
    }
    check(bytes<=700000,'自定义声音总计不能超过512 KiB。');
  }
  if(scene.feedback===undefined)return errors;
  check(Array.isArray(scene.feedback)&&scene.feedback.length<=256,'最多256个行为反馈槽。');
  const nodes=new Set((Array.isArray(scene.nodes)?scene.nodes:[]).map(n=>n?.id)),ids=new Set();
  if(Array.isArray(scene.feedback))for(const f of scene.feedback.slice(0,257)){
    if(!object(f)){check(false,'行为反馈格式无效。');continue;}
    check(id(f.id)&&!ids.has(f.id),'行为反馈标识无效或重复。');ids.add(f.id);
    check(typeof f.label==='string'&&f.label.length>0&&f.label.length<=60,'行为反馈名称最多60字。');
    check(nodes.has(f.target),'反馈的目标图片不存在：'+f.id);
    check(Object.hasOwn(MOTIONS,f.motion)&&Object.hasOwn(PARTICLES,f.particles)&&sounds.has(f.sound),'反馈动画、特效或声音不存在：'+f.id);
    check(Number.isInteger(f.duration)&&number(f.duration,6,360)&&Number.isInteger(f.delay)&&number(f.delay,0,600),'反馈时长需要0.1～6秒，延迟0～10秒。');
    check(number(f.strength,0,2)&&number(f.volume,0,1)&&Number.isInteger(f.count)&&number(f.count,1,48)&&number(f.direction,-180,180),'反馈强度、音量、粒子数或方向无效。');
    check(typeof f.loop==='boolean'&&(f.hold===undefined||typeof f.hold==='boolean')&&['restart','overlay'].includes(f.policy),'反馈重复/结束策略无效。');
    check(object(f.anchor)&&number(f.anchor.x,0,1)&&number(f.anchor.y,0,1)&&typeof f.color==='string'&&/^#[a-f0-9]{6}$/i.test(f.color),'反馈挂点或颜色无效。');
    const t=f.trigger,e=level.entities?.find(e=>e.id===t?.source);
    check(object(t)&&['start','behavior','state','event','lost','won'].includes(t.type),'反馈触发类型无效。');
    if(['start','lost','won'].includes(t?.type)&&t.source!==undefined)check(t.source===(t.type==='start'?'scene':'actor'),'反馈生命周期来源无效：'+f.id);
    if(t?.type==='behavior')check(Boolean(e?.behaviors?.some(b=>b.id===t.behavior)),'反馈引用的行为不存在：'+f.id);
    if(t?.type==='state')check(Boolean(e)&&id(t.state),'反馈状态来源无效：'+f.id);
    if(t?.type==='event')check(Boolean(e)&&['click','contact','enter','board','arrive','rotated','supportlost','supportfound','landed','impact','actorlanded','done'].includes(t.event),'反馈事件来源无效：'+f.id);
    if(t?.type==='event'&&t.behavior!==undefined)check(t.event==='done'&&Boolean(e?.behaviors?.some(b=>b.id===t.behavior)),'反馈完成事件的行为不存在：'+f.id);
    if(t?.reason!==undefined)check(typeof t.reason==='string'&&t.reason.length<=64,'反馈失败原因无效。');
  }
  return errors;
}

/** Deletions remove dangling visual subscriptions rather than preventing a valid edit. */
export function pruneFeedback(level) {
  if(!level.scene?.feedback)return;
  const nodes=new Set(level.scene.nodes.map(n=>n.id)),entities=new Map(level.entities.map(e=>[e.id,e]));
  level.scene.feedback=level.scene.feedback.filter(f=>nodes.has(f.target)&&(!['behavior','state','event'].includes(f.trigger.type)||
    entities.has(f.trigger.source)&&(!f.trigger.behavior||entities.get(f.trigger.source).behaviors?.some(b=>b.id===f.trigger.behavior))));
}
