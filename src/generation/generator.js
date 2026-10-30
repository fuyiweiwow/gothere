import {seededRandom,shuffled} from './random.js';
import {FRAGMENT_KINDS,buildFragment} from './fragments.js';

/** Constraint-based composition, not model training. The output is a normal editable level. */
export function buildCandidate({seed,steps=3,variant=0}={}) {
  if(typeof seed!=='string'||!seed.trim()||seed.length>80)throw new Error('种子需要 1～80 个字符。');
  if(!Number.isInteger(steps)||steps<3||steps>5)throw new Error('机关数量需要是 3～5 的整数。');
  if(!Number.isInteger(variant)||variant<0||variant>8)throw new Error('候选变体需要是 0～8 的整数。');
  const random=seededRandom(variant?seed+'\0'+variant:seed),order=shuffled(FRAGMENT_KINDS,random),speed=36+Math.floor(random()*9);
  const heights=Array.from({length:steps},()=>340+20*Math.floor(random()*4)),stride=920/steps;
  const level={schemaVersion:1,id:'generated-'+Math.floor(random()*0xffffffff).toString(36),name:'生成实验 · '+seed.slice(0,30)+(variant?' · '+variant:''),
    description:'根据种子组合机关顺序和路面高度。角色持续向右走，请按位置触发各段机关。',
    hint:'逻辑模式下点击虚线物体也可以触发。暂停、单步与右侧点击事件列表可辅助操作。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    actor:{x:60,y:heights[0],speed,direction:1,maxLandingSpeed:240},goal:{x:1150,y:heights.at(-1)},
    platforms:[{x:30,y:heights[0],width:150}],entities:[],rules:[]};
  const plan=[],fragments=[];
  for(let i=0;i<steps;i++){
    const x=180+i*stride,y=heights[i],width=stride-30;
    const fragment=buildFragment({kind:order[i%order.length],index:i,x,y,width,speed});
    level.entities.push(...fragment.entities);level.rules.push(...fragment.rules);level.platforms.push(...fragment.platforms);
    level.platforms.push({x:x+width,y,width:30,yEnd:heights[i+1]??y});
    const tick=Math.max(1,Math.floor((fragment.criticalX-level.actor.x)/speed*60)-fragment.prepareTicks-60);
    plan.push({source:fragment.source,tick,label:fragment.label});
    fragments.push({kind:fragment.kind,label:fragment.label,source:fragment.source,explanation:fragment.explanation});
  }
  level.platforms.push({x:1100,y:heights.at(-1),width:80});
  level.hint+=' 参考操作：'+plan.map(p=>(p.tick/60).toFixed(1)+'秒 '+p.label).join(' → ');
  return {seed,steps,variant,level,plan,fragments,signature:fragments.map(f=>f.kind).join('>')};
}
