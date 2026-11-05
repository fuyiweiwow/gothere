import {createScooterScene} from './scooter-scene.js';

/** A reusable placement capability drives an authored roadside encounter. */
export function createScooterLevel(){
  const space=()=>({plane:'street',depth:130,depthSize:24,height:0});
  const obj=(id,label,x,extra={})=>({id,label,kind:'object',x,width:24,height:50,state:'active',space:space(),...extra});
  const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior});
  const enable=(target,capability,enabled)=>({type:'enable',target,capability,enabled});
  const move=(x,ticks)=>({type:'move',target:'scooter',x,depth:130,height:0,ticks});
  const rule=(source,type,actions,conditions,other)=>({on:{source,type,...(other?{other}:{})},...(conditions?{if:conditions}:{}),actions});
  const l={schemaVersion:3,id:'commute-scooter',name:'上班路 · 此路不借',
    description:'小巷里的电瓶车正准备借人行道抄近路。两根路桩之间，恰好少了一截。',
    hint:'运行后，把左侧的活动路障拖到右侧两根路桩之间；放错会归位。约20秒，无需编辑。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:620,depthX:0,depthY:-1},planes:[{id:'street',label:'沿街人行道',depth:130,order:0}],start:'start',nodes:[
      {id:'start',x:60,plane:'street',depth:130,height:0,next:'exit'},{id:'exit',x:1060,plane:'street',depth:130,height:0}]},
    actor:{x:60,speed:50,space:space()},goal:{x:1060,space:space()},platforms:[{x:20,width:1160,space:space()}],
    entities:[
      obj('barrier','活动路障',260,{width:70,height:45,draggable:{enabled:true,targets:['gap']}}),
      obj('gap','两根路桩之间',842,{width:76,height:8,dropTarget:{enabled:true,radius:42}}),
      obj('blocked','捷径已封住',30,{width:8,height:8,state:'inactive'}),
      obj('phase','车辆已经靠近',40,{width:8,height:8,state:'inactive'}),
      {...obj('approach','主角走近巷口',320,{width:10,height:8}),kind:'zone',state:'enabled'},
      obj('scooter','借人行道抄近路的骑手',1120,{width:72,height:68,contact:{effect:'lethal',message:'电瓶车借走了人行道，也借走了这次上班机会。'},behaviors:[
        {id:'approach',label:'从巷口探出来',actions:[move(938,90)]},
        {id:'shortcut',label:'抢上人行道',actions:[set('phase','active'),enable('gap','dropTarget',false),move(30,210)]},
        {id:'give-way',label:'堵住捷径后原路退回',actions:[set('phase','active'),set('scooter','inactive'),{type:'after',ticks:60,actions:[move(1310,150)]}]},
      ]}),
    ],rules:[
      rule('barrier','placed',[set('blocked','active'),enable('barrier','draggable',false)],undefined,'gap'),
      rule('approach','enter',[set('approach','disabled'),invoke('scooter','approach')]),
      rule('scooter','moved',[invoke('scooter','give-way')],[{entity:'phase',state:'inactive'},{entity:'blocked',state:'active'}]),
      rule('scooter','moved',[invoke('scooter','shortcut')],[{entity:'phase',state:'inactive'},{entity:'blocked',state:'inactive'}]),
    ]};
  l.scene=createScooterScene();return l;
}
