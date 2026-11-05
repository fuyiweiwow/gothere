import {syncPassageObject} from '../core/spatial.js';
import {createCommuteChapterScene} from './commute-chapter-scene.js';

/** One authored block. All timing starts from ordinary proximity/completion
 * events; the same public DSL runs the isolated encounters and this chapter. */
export function createCommuteChapter(){
  const planes=[{id:'front',label:'公交站前街',depth:40,order:4},
    {id:'bus-road',label:'公交车道',depth:10,order:5},
    {id:'middle',label:'早餐铺与清障街',depth:225,order:2},
    {id:'road',label:'清障车道',depth:171,order:3},
    {id:'far',label:'公司外街',depth:400,order:0}];
  const space=(plane,height=0)=>({plane,depth:planes.find(p=>p.id===plane).depth,depthSize:20,height});
  const obj=(id,label,x,plane,extra={})=>({id,label,kind:'object',x,width:24,height:44,state:'active',space:space(plane),...extra});
  const flag=(id,label)=>obj(id,label,30,'far',{width:8,height:8,state:'inactive'});
  const zone=(id,label,x,plane)=>({...obj(id,label,x,plane,{width:10,height:8}),kind:'zone',state:'enabled'});
  const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior});
  const after=(ticks,actions)=>({type:'after',ticks,actions});
  const move=(target,x,ticks,plane,height=0,exit=false)=>({type:'move',target,x,depth:space(plane).depth,height,ticks,...(exit?{plane}:{})});
  const along=(target,progress,ticks)=>({type:'move',target,progress,ticks});
  const enable=(target,capability,enabled)=>({type:'enable',target,capability,enabled});
  const is=(entity,state='active')=>({entity,state});
  const rule=(source,type,actions,conditions,other)=>({on:{source,type,...(other?{other}:{})},...(conditions?{if:conditions}:{}),actions});
  const node=(id,x,plane,next,via)=>({id,x,plane,depth:space(plane).depth,height:0,...(next?{next}:{}),...(via?{via}:{})});
  const l={schemaVersion:3,id:'commute-chapter',name:'上班路 · 还得去',
    description:'穿过公交站、路口、早餐街和窄巷，到公司门外。一张地图，一直往前走。',
    hint:'约一分钟。先让公交载走队伍；靠近路口后点交警，进入中街后点生气的路人；把活动路障拖到窄巷路桩间，远街的早餐可以放进狗碗。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:620,depthX:0,depthY:-1},planes,start:'start',nodes:[
      node('start',60,'front','front-curb'),node('front-curb',1050,'front','middle-entry','crosswalk'),
      node('middle-entry',1050,'middle','alley-mouth'),node('alley-mouth',160,'middle','far-entry','alley'),
      node('far-entry',160,'far','office'),node('office',1109,'far'),node('tow-curb',575,'middle'),node('tow-road',620,'road')]},
    actor:{x:60,speed:55,space:space('front')},goal:{x:1109,space:space('far')},
    platforms:['front','middle','far'].map(plane=>({x:25,width:1150,space:space(plane)})),
    entities:[
      obj('bus','等着队伍上车的公交',500,'bus-road',{width:30,height:75,behaviors:[
        {id:'open',label:'开门让队伍上车',actions:[set('boarding','inactive'),set('bus','inactive'),invoke('passenger-c','board')]},
        {id:'close',label:'乘客上完后关门',actions:[after(24,[set('bus','active'),set('depart-ready','active')])]},
        {id:'leave',label:'赶路者接近时驶离',actions:[set('depart-ready','inactive'),move('bus',1280,180,'bus-road')]},
      ]}),flag('boarding','还可招呼公交'),flag('depart-ready','公交已关门'),
      ...[['a',350,66],['b',385,54],['c',420,42]].map(([id,x,ticks])=>obj('passenger-'+id,'候车乘客 '+id,x,'front',{
        width:18,height:44,contact:{effect:'lethal',message:'撞进了候车队伍。'},
        behaviors:[{id:'board',label:'依次走进车门',actions:[move('passenger-'+id,566,ticks,'front',5)]}]})),
      zone('bus-approach','走近公交车门',540,'front'),

      obj('crosswalk','向里过街的斑马线',1050,'front',{height:8,passage:{from:'front-curb',to:'middle-entry',distance:160,enabled:true}}),
      zone('cross-approach','走近右侧路口',800,'front'),
      obj('officer','低头看手机的交警',1132,'middle',{state:'inactive',behaviors:[
        {id:'notice',label:'收手机走过去制止行人',actions:[set('noticed','active'),set('officer','active'),after(24,[move('officer',1102,72,'middle')])]},
        {id:'check-phone',label:'自己的手机又响了',actions:[set('officer','inactive')]},
      ]}),
      obj('jaywalker','闯进路口的手机行人',1050,'middle',{width:22,height:46,
        space:{passage:'crosswalk',progress:1,length:30,depth:225,height:0},
        contact:{effect:'lethal',message:'在斑马线上撞到了低头看手机的人。'},behaviors:[
          {id:'cross',label:'走到车道半路低头停下',actions:[along('jaywalker',.82,72)]},
          {id:'retreat',label:'听见哨声退回路边',actions:[along('jaywalker',1,60)]},
          {id:'aside',label:'真正退出通路听训',actions:[move('jaywalker',1082,60,'middle',0,true)]},
        ]}),
      obj('signal','行人信号灯',1005,'front',{height:68}),
      flag('intrusion','行人已经闯入'),flag('noticed','交警已抬头'),flag('lecture','交警已抵达'),flag('halfway','行人已走到车道半路'),
      flag('aside','行人正在退到路旁'),flag('settled','路口已经清空'),

      zone('tow-approach','进入早餐街',970,'middle'),flag('tow-ready','清障事件已开始'),
      obj('caller','被堵住的生气路人',845,'middle',{state:'inactive',behaviors:[
        {id:'call',label:'拨电话叫来拖车',actions:[set('caller','inactive'),after(54,[invoke('tow','approach')])]},
      ]}),
      obj('car','占住人行道的汽车',575,'middle',{width:130,height:44,contact:{effect:'lethal',message:'被占住人行道的车挡住了。'},behaviors:[
        {id:'lift',label:'沿路沿拖到车道挂接',actions:[{...along('car',1,48),passage:'tow-access'}]},
        {id:'haul',label:'与拖车保持距离驶离',actions:[move('car',1705,240,'road',9,true)]},
      ]}),
      obj('tow-access','从人行道到拖车道的清障连接',575,'middle',{height:8,passage:{from:'tow-curb',to:'tow-road',distance:70,enabled:true}}),
      obj('tow','来清障的拖车',1280,'road',{width:20,height:55,state:'inactive',behaviors:[
        {id:'approach',label:'从画外倒车到车前',actions:[set('tow','active'),move('tow',665,132,'road')]},
        {id:'haul',label:'拖着汽车驶到画面外',actions:[move('tow',1750,240,'road')]},
      ]}),
      flag('coupled','车辆已挂接'),flag('chasing','车主已走下店门'),
      obj('owner','端着早饭追出来的车主',470,'middle',{state:'inactive',space:space('middle',24),behaviors:[
        {id:'emerge',label:'发现车被拖后冲出早餐铺',actions:[after(60,[set('owner','active'),move('owner',470,30,'middle')])]},
        {id:'chase',label:'端着早饭一路追车',actions:[move('owner',1330,270,'middle')]},
      ]}),

      obj('alley','向里穿过的窄巷',160,'middle',{height:8,passage:{from:'alley-mouth',to:'far-entry',distance:150,enabled:true}}),
      obj('barrier','巷口的活动路障',305,'middle',{width:54,height:30,draggable:{enabled:true,targets:['gap']}}),
      obj('gap','巷口路桩间的缺口',197,'middle',{width:58,height:8,dropTarget:{enabled:true,radius:35}}),
      flag('blocked','电瓶车缺口已封住'),flag('scooter-awake','骑手已发现近路'),flag('scooter-arrived','骑手到达巷子入口'),flag('scooter-decided','骑手已作出决定'),flag('scooter-exit','骑手已经退出巷子'),
      zone('scooter-approach','走近左侧窄巷',355,'middle'),
      obj('scooter','想从窄巷借道的电瓶车',-110,'far',{width:30,height:48,state:'inactive',
        contact:{effect:'lethal',message:'在窄巷里迎面撞上了电瓶车。'},behaviors:[
          {id:'approach',label:'从画外驶到巷口',actions:[move('scooter',160,48,'far')]},
          {id:'enter',label:'从真实端点进入窄巷',actions:[set('scooter','active'),{...along('scooter',.22,120),passage:'alley'}]},
          {id:'give-way',label:'看见路障停下再原路退回',actions:[set('scooter','inactive'),after(48,[{...along('scooter',1,114),passage:'alley'}])]},
          {id:'shortcut',label:'抢进人行通路',actions:[{...along('scooter',0,132),passage:'alley'}]},
          {id:'exit',label:'退到外街后绕路离开',actions:[set('scooter','active'),move('scooter',-170,100,'far',0,true)]},
        ]}),

      obj('breakfast','外街摊边的早餐',440,'far',{width:20,height:20,draggable:{enabled:true,targets:['bowl']}}),
      obj('bowl','路边空着的狗碗',735,'far',{width:28,height:8,dropTarget:{enabled:true,radius:34}}),
      obj('dog','守在路中的狗',660,'far',{width:44,height:29,contact:{effect:'lethal',message:'狗还守在路中央。'},behaviors:[
        {id:'eat',label:'闻到早餐走到碗边',actions:[set('dog','inactive'),move('dog',710,78,'far')]},
      ]}),flag('dog-fed','狗已经去吃早餐'),
    ],rules:[
      rule('bus','click',[invoke('bus','open')],[is('boarding')]),
      ...[['c','b'],['b','a']].map(([a,b])=>rule('passenger-'+a,'moved',[set('passenger-'+a,'inactive'),invoke('passenger-'+b,'board')])),
      rule('passenger-a','moved',[set('passenger-a','inactive'),invoke('bus','close')]),
      rule('bus-approach','enter',[invoke('bus','leave')],[is('depart-ready')]),
      rule('bus-approach','enter',[set('bus-approach','disabled')]),
      {on:{source:'bus',type:'done',behavior:'close'},if:[is('bus-approach','disabled'),is('depart-ready')],actions:[invoke('bus','leave')]},

      rule('cross-approach','enter',[set('cross-approach','disabled'),set('intrusion','active'),invoke('jaywalker','cross')]),
      rule('officer','click',[invoke('officer','notice')],[is('intrusion'),is('noticed','inactive')]),
      rule('officer','moved',[invoke('jaywalker','retreat')],[is('halfway'),is('lecture','inactive')]),
      rule('officer','moved',[set('lecture','active')],[is('lecture','inactive')]),
      rule('jaywalker','moved',[set('settled','active'),set('jaywalker','inactive'),set('signal','inactive')],[is('aside'),is('settled','inactive')]),
      rule('jaywalker','moved',[set('aside','active'),invoke('jaywalker','aside')],[is('lecture'),is('halfway'),is('aside','inactive')]),
      rule('jaywalker','moved',[invoke('jaywalker','retreat')],[is('lecture'),is('halfway','inactive')]),
      rule('jaywalker','moved',[set('halfway','active')],[is('halfway','inactive')]),
      rule('crosswalk','board',[after(78,[invoke('officer','check-phone')])],[is('settled')]),

      rule('tow-approach','enter',[set('tow-approach','disabled'),set('tow-ready','active'),set('caller','active')]),
      rule('caller','click',[invoke('caller','call')],[is('tow-ready'),is('caller')]),
      rule('tow','moved',[invoke('car','lift')],[is('coupled','inactive')]),
      rule('car','moved',[set('car','inactive'),set('coupled','active'),invoke('tow','haul'),invoke('car','haul'),invoke('owner','emerge')],[is('car')]),
      rule('tow','moved',[set('tow','inactive')],[is('coupled')]),
      rule('owner','moved',[set('owner','inactive')],[is('chasing'),is('owner')]),
      rule('owner','moved',[set('chasing','active'),invoke('owner','chase')],[is('owner'),is('chasing','inactive')]),

      rule('barrier','placed',[set('blocked','active'),enable('barrier','draggable',false)],undefined,'gap'),
      rule('scooter-approach','enter',[set('scooter-approach','disabled'),set('scooter-awake','active'),invoke('scooter','approach')]),
      // Completion rules precede phase changes: one event cannot skip two stages.
      rule('scooter','moved',[set('scooter','inactive')],[is('scooter-exit')]),
      rule('scooter','moved',[set('scooter-exit','active'),invoke('scooter','exit')],[is('scooter-decided'),is('blocked'),is('scooter-exit','inactive')]),
      rule('scooter','moved',[set('scooter-decided','active'),enable('gap','dropTarget',false),invoke('scooter','give-way')],[is('scooter-arrived'),is('scooter-decided','inactive'),is('blocked')]),
      rule('scooter','moved',[set('scooter-decided','active'),enable('gap','dropTarget',false),invoke('scooter','shortcut')],[is('scooter-arrived'),is('scooter-decided','inactive'),is('blocked','inactive')]),
      rule('scooter','moved',[set('scooter-arrived','active'),invoke('scooter','enter')],[is('scooter-awake'),is('scooter-arrived','inactive')]),

      rule('breakfast','placed',[set('dog-fed','active'),set('breakfast','inactive'),enable('breakfast','draggable',false),enable('bowl','dropTarget',false),invoke('dog','eat')],undefined,'bowl'),
    ]};
  l.entities.find(e=>e.id==='boarding').state='active';
  for(const e of l.entities)if(e.space.passage)syncPassageObject(l,e);
  l.scene=createCommuteChapterScene(l);return l;
}
