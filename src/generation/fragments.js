const invoke=(target,behavior)=>({type:'invoke',target,behavior});
const set=(target,state)=>({type:'set',target,state});
const enable=(target,capability,enabled)=>({type:'enable',target,capability,enabled});
const after=(ticks,actions)=>({type:'after',ticks,actions});
export const FRAGMENT_KINDS=Object.freeze(['temporary-surface','delayed-rest','falling-impact','coupled-effects']);
const names={'temporary-surface':'临时通路','delayed-rest':'延迟休息','falling-impact':'撤撑 → 落物 → 休息','coupled-effects':'一路信号，两种效果'};

/** A fragment emits only ordinary DSL objects, behaviors and events, with a namespaced interface. */
export function buildFragment({kind,index,x,y,width,speed}) {
  const prefix='stage-'+(index+1),entities=[],rules=[],platforms=[];
  const object=(suffix,label,options={})=>{
    const e={id:prefix+'-'+suffix,kind:'object',label:(index+1)+' · '+label,x,y,width:28,height:30,state:'active',...options};
    entities.push(e);return e;
  };
  const behavior=(e,id,label,actions)=>{(e.behaviors??=[]).push({id,label,actions});};
  const click=(e,id)=>rules.push({on:{source:e.id,type:'click'},actions:[invoke(e.id,id)]});
  const duration=Math.ceil(120/speed*60)+180;
  let source,criticalX,prepareTicks=0,explanation;
  const surface=()=>{
    const e=object('span','铺路',{x:x+20,width:80,height:12,state:'inactive',pose:{angle:0,pivot:0},surface:{enabled:false}});
    behavior(e,'extend','临时铺路',[set(e.id,'active'),enable(e.id,'surface',true),after(duration,[enable(e.id,'surface',false),set(e.id,'inactive')])]);
    platforms.push({x,y,width:20},{x:x+100,y,width:width-100});return e;
  };
  const hazard=(offset)=>object('obstacle','接触危险物',{x:x+offset,width:26,height:32,contact:{effect:'lethal',message:'这段通路还没有安全开放。'}});
  if(kind==='temporary-surface'){
    source=surface();click(source,'extend');criticalX=x+20;
    explanation='在走到缺口前铺出承托面；过早铺路会在通过前收回。';
  }else if(kind==='delayed-rest'){
    source=hazard(60);prepareTicks=45;
    behavior(source,'rest','延迟休息',[after(prepareTicks,[set(source.id,'inactive'),after(duration,[set(source.id,'active')])])]);click(source,'rest');
    platforms.push({x,y,width});criticalX=source.x-10;
    explanation='触发后有准备时间，危险物才进入短暂休息；需要提前一点操作。';
  }else if(kind==='falling-impact'){
    const blocker=hazard(70);blocker.collider={enabled:true};blocker.height=40;
    const shelf=object('support','撤去支撑',{x:x+78,y:y-130,width:20,height:10,collider:{enabled:true}});
    const weight=object('weight','落物',{x:x+78,y:y-140,width:20,height:22,collider:{enabled:true},body:{type:'dynamic'}});
    behavior(shelf,'withdraw','撤撑',[enable(shelf.id,'collider',false)]);click(shelf,'withdraw');
    behavior(blocker,'rest','被撞后休息',[set(blocker.id,'inactive'),enable(blocker.id,'collider',false),enable(weight.id,'collider',false),
      after(duration,[set(blocker.id,'active'),enable(blocker.id,'collider',true)])]);
    rules.push({on:{source:blocker.id,type:'impact',other:weight.id},actions:[invoke(blocker.id,'rest')]});
    platforms.push({x,y,width});source=shelf;criticalX=blocker.x-10;prepareTicks=40;
    explanation='撤去真实支撑，落物受重力下落，实际撞击危险物后才打开通路。';
  }else if(kind==='coupled-effects'){
    const span=surface(),obstacle=hazard(124);
    behavior(obstacle,'rest','临时休息',[after(30,[set(obstacle.id,'inactive'),after(duration,[set(obstacle.id,'active')])])]);
    source=object('control','接通通路',{x:x+2,width:16,height:28});
    behavior(source,'activate','同时铺路与休息',[invoke(span.id,'extend'),invoke(obstacle.id,'rest')]);click(source,'activate');
    criticalX=x+20;prepareTicks=30;
    explanation='一个点击同时调用两个物体的行为：临时铺路，并让前方危险物休息。';
  }else throw new Error('未知机关片段。');
  return {kind,label:names[kind],source:source.id,criticalX,prepareTicks,explanation,entities,rules,platforms};
}
