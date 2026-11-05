import {createBusStopLevel} from './bus-stop-level.js';
import {createTowStreetScene} from './tow-street-scene.js';

export const TOW_STREET_PLAN=[{source:'caller',tick:180}];

/** A new authored encounter built exclusively from existing DSL actions. */
export function createTowStreetLevel(){
  const level=createBusStopLevel();
  const space=(plane='street',height=0)=>({plane,depth:plane==='street'?130:85,depthSize:20,height});
  const obj=(id,label,x,width,height,extra={})=>({id,label,kind:'object',state:'active',x,width,height,space:space(),...extra});
  const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior});
  const move=(target,x,ticks,height=0,plane='street')=>({type:'move',target,x,depth:space(plane).depth,height,ticks});
  const after=(ticks,actions)=>({type:'after',ticks,actions});
  const rule=(source,type,actions,conditions)=>({on:{source,type},...(conditions?{if:conditions}:{}),actions});
  Object.assign(level,{id:'commute-tow-street',name:'上班路 · 借过一下',
    description:'早餐铺门口，一辆车占住了人行道。赶路的人照常往前走。',
    hint:'点击车旁正在生气的路人，观察他打电话后发生的事。约24秒；不用拖动或编辑。'});
  level.actor.speed=44;
  level.spatial.planes.push({id:'road',label:'路边拖车作业带',depth:85,order:1});
  level.entities=[
    obj('caller','被挡住的路人',482,25,62,{behaviors:[{id:'call',label:'拨电话请求清障',actions:[set('caller','inactive'),after(72,[invoke('tow','approach')])]}]}),
    obj('car','占着人行道的私家车',630,168,58,{contact:{effect:'lethal',message:'人行道被堵住了。'},behaviors:[
      {id:'lift',label:'挂接后抬起前轮',actions:[move('car',630,48,12)]},
      {id:'haul',label:'保持挂接距离驶离',actions:[move('car',2010,360,12)]},
    ]}),
    obj('tow','来清障的拖车',1170,20,70,{state:'inactive',space:space('road'),behaviors:[
      {id:'approach',label:'从路外倒车到车前',actions:[set('tow','active'),move('tow',686,180,0,'road')]},
      {id:'haul',label:'挂接后把车拖走',actions:[move('tow',2066,360,0,'road')]},
    ]}),
    obj('coupled','车辆已挂接',30,8,8,{state:'inactive'}),
    obj('chasing','车主已走出店门',30,8,8,{state:'inactive'}),
    obj('owner','端着早饭追出来的车主',1015,25,62,{state:'inactive',space:space('street',65),behaviors:[
      {id:'emerge',label:'发现车被拖后从店门冲出来',actions:[after(132,[set('owner','active'),move('owner',1015,60)])]},
      {id:'chase',label:'追着自己的车跑到画外',actions:[move('owner',1340,342)]},
    ]}),
  ];
  level.rules=[
    rule('caller','click',[invoke('caller','call')],[{entity:'caller',state:'active'}]),
    rule('tow','moved',[invoke('car','lift')],[{entity:'coupled',state:'inactive'}]),
    rule('car','moved',[set('car','inactive'),set('coupled','active'),invoke('tow','haul'),invoke('car','haul'),invoke('owner','emerge')],[{entity:'car',state:'active'}]),
    rule('tow','moved',[set('tow','inactive')],[{entity:'coupled',state:'active'}]),
    rule('owner','moved',[set('owner','inactive')],[{entity:'chasing',state:'active'},{entity:'owner',state:'active'}]),
    rule('owner','moved',[set('chasing','active'),invoke('owner','chase')],[{entity:'owner',state:'active'},{entity:'chasing',state:'inactive'}]),
  ];
  level.scene=createTowStreetScene(level);return level;
}
