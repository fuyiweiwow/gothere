import {createCommuteScene} from './commute-scene.js';

const set=(target,state)=>({type:'set',target,state});
const invoke=(target,behavior)=>({type:'invoke',target,behavior});
const move=(target,x,y,ticks)=>({type:'move',target,x,y,ticks});
const rule=(source,type,actions,conditions)=>({on:{source,type},...(conditions?{if:conditions}:{}),actions});
const when=(entity,state)=>[{entity,state}];

/** An authored street situation, expressed as ordinary capabilities and shared reactions. */
export function buildCommute(){
  const level={schemaVersion:1,id:'experiment-commute',name:'一定要打上卡',description:'上班路 · 无字场景试作',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    actor:{x:70,y:380,speed:60,direction:1,maxLandingSpeed:420},goal:{x:1130,y:200},
    platforms:[{x:25,y:380,width:125},{x:200,y:380,width:250},{x:300,y:280,width:160},{x:900,y:280,width:30},
      {x:930,y:280,width:150,yEnd:380},{x:1080,y:400,width:55},
      {x:900,y:540,width:180,yEnd:400},{x:750,y:540,width:150},{x:340,y:540,width:260},
      {x:340,y:200,width:820}],
    entities:[
      {id:'loading-ramp',kind:'object',label:'卸货板',x:150,y:380,width:Math.hypot(150,100),height:10,state:'active',
        pose:{angle:0,pivot:0},surface:{enabled:true},behaviors:[{id:'raise',label:'支起卸货板',actions:[
          {type:'rotate',target:'loading-ramp',angle:-Math.atan2(100,150)*180/Math.PI,ticks:50},set('loading-ramp','inactive')]}]},
      {id:'badge',kind:'object',label:'工牌',x:80,y:380,width:12,height:14,state:'active',behaviors:[
        {id:'wear',label:'带好工牌',actions:[{type:'hold',target:'badge'},set('badge','inactive')]}]},
      {id:'bus',kind:'object',label:'公交车',x:460,y:380,width:240,height:100,state:'active',collider:{enabled:true},
        behaviors:[
          {id:'depart',label:'关门发车',actions:[move('bus',930,380,240),invoke('late-commuter','chase')]},
          {id:'brake',label:'红灯停车',actions:[move('bus',660,380,90),invoke('late-commuter','chase')]},
        ]},
      {id:'bus-roof-zone',kind:'zone',label:'车顶经过区域',x:500,y:280,width:12,state:'enabled'},
      {id:'traffic-light',kind:'object',label:'路口信号灯',x:780,y:380,width:20,height:100,state:'active',behaviors:[
        {id:'red',label:'切换红灯',actions:[set('traffic-light','inactive'),invoke('sedan','yield'),invoke('phone-walker','cross')]},
      ]},
      {id:'sedan',kind:'object',label:'占道私家车',x:700,y:430,width:145,height:56,state:'active',behaviors:[
        {id:'yield',label:'向后挪车',actions:[move('sedan',780,430,90)]},
      ]},
      {id:'late-commuter',kind:'object',label:'追公交的上班族',x:450,y:380,width:22,height:54,state:'active',behaviors:[
        {id:'chase',label:'追车',actions:[move('late-commuter',610,380,135)]},
      ]},
      {id:'phone-walker',kind:'object',label:'看手机的行人',x:795,y:430,width:26,height:50,state:'active',behaviors:[
        {id:'cross',label:'穿行车流',actions:[move('phone-walker',600,430,180)]},
      ]},
      {id:'sidewalk-scooter',kind:'object',label:'人行道电瓶车',x:240,y:380,width:44,height:58,state:'active',
        motion:{type:'patrol',minX:210,maxX:380,speed:135},contact:{effect:'lethal'}},
      {id:'foreground-scooter',kind:'object',label:'逆行电瓶车',x:600,y:450,width:44,height:58,state:'active',
        motion:{type:'patrol',minX:180,maxX:1020,speed:160}},
      {id:'landing-turn',kind:'zone',label:'围栏前折返',x:1100,y:400,width:12,state:'enabled'},
      {id:'trench-cover',kind:'object',label:'检修盖板',x:600,y:540,width:150,height:10,state:'active',
        pose:{angle:-70,pivot:0},surface:{enabled:true},behaviors:[{id:'lower',label:'放下检修盖板',actions:[
          {type:'rotate',target:'trench-cover',angle:0,ticks:60},set('trench-cover','inactive')]}]},
      {id:'service-lift',kind:'lift',label:'维修升降台',x:340,y:540,toY:200,width:100,speed:100,state:'upper',upperDirection:1,
        behaviors:[{id:'call',label:'降下升降台',actions:[set('service-lift','lower')]},
          {id:'rise',label:'回到天桥',actions:[set('service-lift','upper')]}]},
      {id:'office-reader',kind:'object',label:'门禁读卡器',x:1090,y:200,width:14,height:40,state:'inactive',behaviors:[
        {id:'scan',label:'刷卡',actions:[set('office-reader','active'),set('turnstile','open')]}]},
      {id:'office-zone',kind:'zone',label:'刷卡位置',x:1075,y:200,width:12,state:'enabled'},
      {id:'turnstile',kind:'gate',label:'公司闸机',x:1110,y:200,width:12,state:'closed'},
    ],rules:[
      rule('loading-ramp','click',[invoke('loading-ramp','raise')],when('loading-ramp','active')),
      rule('badge','contact',[invoke('badge','wear')],[{holding:null}]),
      rule('traffic-light','click',[invoke('traffic-light','red')],when('traffic-light','active')),
      rule('bus-roof-zone','enter',[invoke('bus','depart')],when('traffic-light','active')),
      rule('bus-roof-zone','enter',[invoke('bus','brake')],when('traffic-light','inactive')),
      rule('traffic-light','done',[invoke('bus','brake')],[{entity:'traffic-light',state:'inactive'},{entity:'bus-roof-zone',state:'disabled'}]),
      rule('bus-roof-zone','enter',[set('bus-roof-zone','disabled')]),
      rule('landing-turn','enter',[{type:'turn',direction:-1},set('landing-turn','disabled')]),
      rule('trench-cover','click',[invoke('trench-cover','lower')],when('trench-cover','active')),
      rule('service-lift','click',[invoke('service-lift','call')],when('service-lift','upper')),
      rule('service-lift','board',[invoke('service-lift','rise')]),
      rule('office-zone','enter',[invoke('office-reader','scan'),set('office-zone','disabled')],[{holding:'badge'}]),
    ]};
  level.rules.find(r=>r.on.source==='traffic-light'&&r.on.type==='done').on.behavior='red';
  level.scene=createCommuteScene(level);
  return {id:'commute',kind:'无字主题试作 · 上班路',display:'scene',playView:'clean',level,
    summary:'一条街，几种路权，一个还在往前走的人。',
    help:'场景不显示叙事文字。可操作卸货板、信号灯、地下盖板和维修升降台。公交车顶是真实移动路面，红灯会让车靠近停线；升降台需要先降到地下。',
    plan:[{source:'loading-ramp',tick:40},{source:'traffic-light',tick:500},
      {source:'trench-cover',tick:1000},{source:'service-lift',tick:1200}]};
}
