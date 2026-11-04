import {createCommuteScene} from './commute-scene.js';

export const COMMUTE_PLAN=[{source:'loading-ramp',tick:40},{source:'traffic-light',tick:500},{source:'trench-cover',tick:1000},{source:'service-lift',tick:1200}];
const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior});
const move=(target,x,depth,height,ticks)=>({type:'move',target,x,depth,height,ticks});
const when=(entity,state)=>[{entity,state}];
const rule=(source,type,actions,conditions)=>({on:{source,type},...(conditions?{if:conditions}:{}),actions});

/** Authored street, rebuilt from the earlier 2D study using ordinary world data.
 * No runtime code depends on a street, vehicle or workplace identifier. */
export function createCommuteLevel(){
  const positions=[['start',70,80,140],['ramp-foot',150,80,140],['shelter',300,80,240],['board',480,80,240],
    ['far-stop',920,240,240],['far-turn',1020,240,240],['near-return',1020,60,240],['detour',1120,60,140],['lower-mouth',1120,20,140],
    ['underground',950,20,0],['crossing',820,20,0],['back-lane',820,320,0],['lift-arrival',308,320,280],['office',1130,320,280]];
  const road=(x,width,depth,depthSize,height,heightEnd)=>({x,width,space:{depth,depthSize,height,...(heightEnd!==undefined?{heightEnd}:{})}});
  const obj=(id,label,x,depth,height,width=40,tall=40,extra={})=>({id,label,kind:'object',state:'active',x,width,height:tall,space:{depth,depthSize:40,height},...extra});
  const zone=(id,label,x,depth,height,width=12,depthSize=40)=>({...obj(id,label,x,depth,height,width,8),kind:'zone',state:'enabled',space:{depth,depthSize,height}});
  const level={schemaVersion:2,id:'commute-spatial',name:'上班路 · 一定要打上卡',description:'上班路空间迁移：前后道路、公交车顶、地下绕行与维修升降台。',
    hint:'可操作卸货板、信号灯、检修盖板和升降台。点击准备后，人物仍会持续赶路；平台没有到位就会踏空。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{projection:{originY:620,depthX:.12,depthY:-.55},start:'start',nodes:positions.map(([id,x,depth,height],i)=>({id,x,depth,height,...(positions[i+1]?{next:positions[i+1][0]}:{})}))},
    actor:{x:70,speed:60,space:{depth:80,height:140}},goal:{x:1130,space:{depth:320,height:280}},
    platforms:[road(25,125,50,60,140),road(200,250,50,60,140),road(300,160,60,70,240),
      road(880,160,210,70,240),road(1000,40,40,240,240),road(1040,80,40,50,240,140),road(1120,35,40,50,140),
      road(1120,35,10,80,140),road(950,170,10,30,0,140),road(740,210,10,30,0),road(800,40,10,330,0),road(740,100,300,40,0),road(460,140,300,40,0),
      road(300,860,300,40,280)],
    entities:[
      obj('loading-ramp','卸货板',150,55,140,Math.hypot(150,100),10,{pose:{angle:0,pivot:0},surface:{enabled:true},behaviors:[{id:'raise',label:'支起卸货板',actions:[{type:'rotate',target:'loading-ramp',angle:-Math.atan2(100,150)*180/Math.PI,ticks:50}]}]}),
      obj('badge','工牌',85,70,140,12,14,{behaviors:[{id:'wear',label:'带好工牌',actions:[{type:'hold',target:'badge'},set('badge','inactive')]}]}),
      obj('bus','公交车',460,60,140,240,100,{collider:{enabled:true},space:{depth:60,depthSize:140,height:140},behaviors:[
        {id:'depart',label:'关门发车',actions:[move('bus',950,60,140,240),invoke('late-commuter','chase')]},
        {id:'brake',label:'红灯停车',actions:[move('bus',660,220,140,180),invoke('late-commuter','chase')]}]}),
      zone('bus-roof-zone','车顶经过区域',500,65,240,12,60),
      obj('traffic-light','路口信号灯',790,170,140,20,90,{behaviors:[{id:'red',label:'切换红灯',actions:[set('traffic-light','inactive'),invoke('sedan','yield'),invoke('phone-walker','cross')]}]}),
      obj('sedan','占道私家车',700,170,140,145,56,{behaviors:[{id:'yield',label:'向后挪车',actions:[move('sedan',790,170,140,90)]}]}),
      obj('late-commuter','追公交的上班族',450,95,140,22,50,{behaviors:[{id:'chase',label:'追车',actions:[move('late-commuter',610,95,140,135)]}]}),
      obj('phone-walker','看手机的行人',795,170,140,26,50,{behaviors:[{id:'cross',label:'穿过车流',actions:[move('phone-walker',610,80,140,180)]}]}),
      obj('sidewalk-scooter','借道人行道的电瓶车',270,65,140,44,50,{motion:{type:'patrol',minX:260,maxX:400,speed:135},contact:{effect:'lethal'}}),
      obj('foreground-scooter','逆行电瓶车',600,20,140,44,50,{motion:{type:'patrol',minX:180,maxX:1020,speed:160},contact:{effect:'lethal'}}),
      obj('trench-cover','检修盖板',600,300,0,140,10,{pose:{angle:-70,pivot:0},surface:{enabled:true},behaviors:[{id:'lower',label:'放下检修盖板',actions:[{type:'rotate',target:'trench-cover',angle:0,ticks:60}]}]}),
      obj('service-lift','维修升降台',300,300,280,160,12,{surface:{enabled:true},behaviors:[
        {id:'call',label:'降下升降台',actions:[move('service-lift',300,300,0,180)]},
        {id:'rise',label:'升回天桥',actions:[move('service-lift',300,300,280,100)]}]}),
      zone('lift-entry','登上平台的位置',430,300,0,8,40),
      obj('office-reader','门禁读卡器',1090,300,280,14,40,{state:'inactive',behaviors:[{id:'scan',label:'刷卡',actions:[set('office-reader','active'),set('turnstile','open')]}]}),
      zone('office-zone','刷卡位置',1075,300,280),
      {...obj('turnstile','公司闸机',1110,300,280,12,40),kind:'gate',state:'closed'},
    ],rules:[
      rule('loading-ramp','click',[invoke('loading-ramp','raise')]),rule('badge','contact',[invoke('badge','wear')],[{holding:null}]),
      rule('traffic-light','click',[invoke('traffic-light','red')],when('traffic-light','active')),
      rule('bus-roof-zone','enter',[invoke('bus','depart')],when('traffic-light','active')),
      rule('bus-roof-zone','enter',[invoke('bus','brake')],when('traffic-light','inactive')),
      {...rule('traffic-light','done',[invoke('bus','brake')],[{entity:'bus-roof-zone',state:'disabled'}]),on:{source:'traffic-light',type:'done',behavior:'red'}},
      rule('bus-roof-zone','enter',[set('bus-roof-zone','disabled')]),rule('trench-cover','click',[invoke('trench-cover','lower')]),
      rule('service-lift','click',[invoke('service-lift','call')]),
      rule('lift-entry','enter',[invoke('service-lift','rise'),set('lift-entry','disabled')]),
      rule('office-zone','enter',[invoke('office-reader','scan'),set('office-zone','disabled')],[{holding:'badge'}]),
    ]};
  level.scene=createCommuteScene(level);return level;
}
