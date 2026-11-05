import {syncPassageObject} from '../core/spatial.js';
import {createCrosswalkScene} from './crosswalk-scene.js';

export const CROSSWALK_PLAN=[{source:'officer',tick:240}];

/** One authored encounter; actors, signals and interruptions use ordinary DSL. */
export function createCrosswalkLevel(){
  const planes=[{id:'near',label:'近侧人行道',depth:80,order:1},{id:'far',label:'对街人行道',depth:220,order:0}];
  const space=plane=>({plane,depth:planes.find(p=>p.id===plane).depth,depthSize:20,height:0});
  const obj=(id,label,x,extra={})=>({id,label,kind:'object',x,width:24,height:60,state:'active',space:space('far'),...extra});
  const flag=(id,label)=>obj(id,label,30,{width:8,height:8,state:'inactive'});
  const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior});
  const after=(ticks,actions)=>({type:'after',ticks,actions});
  const along=(progress,ticks)=>({type:'move',target:'jaywalker',progress,ticks});
  const walk=(target,x,ticks,exit=false)=>({type:'move',target,x,depth:220,height:0,ticks,...(exit?{plane:'far'}:{})});
  const is=(entity,state='active')=>({entity,state});
  const rule=(source,type,actions,conditions)=>({on:{source,type},...(conditions?{if:conditions}:{}),actions});
  const l={schemaVersion:3,id:'commute-crosswalk',name:'上班路 · 抬头看路',
    description:'斑马线边，两个人都在低头看手机。赶路的人已经走过来了。',
    hint:'运行后试着让路边的交警抬起头。约23秒，不需要编辑。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:620,depthX:0,depthY:-1},planes,start:'start',nodes:[
      {id:'start',x:50,plane:'near',depth:80,height:0,next:'near-curb'},
      {id:'near-curb',x:520,plane:'near',depth:80,height:0,next:'far-curb',via:'crosswalk'},
      {id:'far-curb',x:520,plane:'far',depth:220,height:0,next:'exit'},
      {id:'exit',x:90,plane:'far',depth:220,height:0}]},
    actor:{x:50,speed:48,space:space('near')},goal:{x:90,space:space('far')},
    platforms:[{x:20,width:1160,space:space('near')},{x:20,width:1160,space:space('far')}],
    entities:[
      obj('crosswalk','斑马线内外通路',520,{space:space('near'),height:12,passage:{from:'near-curb',to:'far-curb',distance:200,enabled:true}}),
      obj('officer','低头看手机的交警',760,{state:'inactive',behaviors:[
        {id:'notice',label:'收起手机走到斑马线边',actions:[set('noticed','active'),set('officer','active'),after(24,[walk('officer',650,90)])]},
        {id:'check-phone',label:'自己的手机响了',actions:[set('officer','inactive'),after(36,[set('jaywalker','active')])]},
      ]}),
      obj('jaywalker','看手机走上斑马线的人',520,{space:{passage:'crosswalk',progress:1,length:34,depth:220,height:0},contact:{effect:'lethal',message:'迎面撞上了低头看手机的人。'},behaviors:[
        {id:'cross',label:'低头走进斑马线',actions:[along(.42,150)]},
        {id:'retreat',label:'听见哨声退回路边',actions:[along(1,72)]},
        {id:'aside',label:'走出斑马线听交警说话',actions:[walk('jaywalker',599,72,true)]},
      ]}),
      obj('signal','行人信号灯',440,{height:78,behaviors:[{id:'green',label:'清空通路后转为绿灯',actions:[set('signal','inactive')]}]}),
      {...obj('approach','主角走近斑马线',250,{space:space('near'),width:10,height:8}),kind:'zone',state:'enabled'},
      flag('intrusion','行人已走进斑马线'),flag('noticed','交警已抬头'),flag('lecture','交警已到路边'),
      flag('aside','行人正在退出通路'),flag('settled','行人已退到路旁'),
    ],rules:[
      rule('approach','enter',[set('approach','disabled'),set('intrusion','active'),invoke('jaywalker','cross')],[is('noticed','inactive')]),
      rule('officer','click',[invoke('officer','notice')],[is('noticed','inactive')]),
      rule('officer','moved',[invoke('jaywalker','retreat')],[is('lecture','inactive'),is('intrusion')]),
      rule('officer','moved',[set('aside','active'),invoke('jaywalker','aside')],[is('lecture','inactive'),is('intrusion','inactive')]),
      rule('officer','moved',[set('lecture','active')],[is('lecture','inactive')]),
      // Evaluate completion before starting a new phase on this same event.
      rule('jaywalker','moved',[set('settled','active'),set('jaywalker','inactive'),invoke('signal','green')],[is('aside'),is('settled','inactive')]),
      rule('jaywalker','moved',[set('aside','active'),invoke('jaywalker','aside')],[is('lecture'),is('aside','inactive')]),
      rule('crosswalk','board',[{type:'hurt',message:'还没清空的斑马线。'}],[is('signal')]),
      rule('crosswalk','board',[after(96,[invoke('officer','check-phone')])],[is('settled')]),
    ]};
  for(const e of l.entities)if(e.space.passage)syncPassageObject(l,e);
  l.scene=createCrosswalkScene(l);return l;
}
