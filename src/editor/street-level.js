import {createStreetScene} from './street-scene.js';
import {syncPassageObject} from '../core/spatial.js';

export const STREET_PLAN=[{source:'breakfast',tick:60},{source:'bowl',tick:235},{source:'breakfast',tick:250},
  {source:'ped-signal',tick:780},{source:'scooter-bell',tick:1660},{source:'bell',tick:2290},{source:'guard',tick:2480}];
const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior}),after=(ticks,actions)=>({type:'after',ticks,actions});
const rule=(source,type,actions,conditions,other)=>({on:{source,type,...(other?{other}:{})},...(conditions?{if:conditions}:{}),actions});

/** Three substantial street segments; every crossing and item relation uses the public DSL. */
export function createStreetLevel(){
  const planes=[{id:'front',label:'早餐街与公交站',depth:45,order:2},{id:'lane',label:'沿街小店与非机动车口',depth:220,order:1},{id:'court',label:'办公区外街',depth:395,order:0}];
  const space=(plane,height=0)=>({plane,depth:planes.find(p=>p.id===plane).depth,depthSize:20,height});
  const obj=(id,label,x,plane,width=32,height=40,extra={})=>({id,label,kind:'object',x,width,height,state:'active',space:space(plane),...extra});
  const move=(target,x,plane,ticks)=>({type:'move',target,x,depth:space(plane).depth,height:0,ticks});
  const along=(target,progress,ticks)=>({type:'move',target,progress,ticks});
  const node=(id,x,plane,next,via)=>({id,x,plane,depth:space(plane).depth,height:0,...(next?{next}:{}),...(via?{via}:{})});
  const road=(x,width,plane)=>({x,width,space:space(plane)});
  const level={schemaVersion:3,id:'commute-layered',name:'上班路 · 三个街口',description:'穿过早餐街、沿街小店和办公区外街。闯灯的人占着斑马线，电瓶车堵在另一条内外通路，终点在公司门外。',
    hint:'拿早餐，在狗碗附近放下并取回。走近右侧斑马线再按行人灯；回到左侧路口时按车铃。外街按铃让车挪开，把早餐交给门口的人。灯和车铃过早操作会恢复。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:620,depthX:0,depthY:-1},planes,start:'start',nodes:[
      node('start',70,'front','front-alley'),node('front-alley',1040,'front','lane-entry','alley'),
      node('lane-entry',1040,'lane','lane-end'),node('lane-end',160,'lane','court-entry','side-door'),
      node('court-entry',160,'court','office'),node('office',1130,'court')]},
    actor:{x:70,speed:70,space:space('front')},goal:{x:1130,space:space('court')},
    platforms:[road(30,1010,'front'),road(160,880,'lane'),road(160,1010,'court')],
    entities:[
      obj('breakfast','早餐袋',145,'front',18,20,{behaviors:[{id:'take',label:'拿起',actions:[{type:'hold',target:'breakfast'}]}]}),
      obj('bowl','路边狗碗',342,'front',24,12,{behaviors:[{id:'offer',label:'放下持有物',actions:[{type:'place',target:'breakfast',at:'bowl',range:105}]}]}),
      obj('dog','守着摊位的狗',415,'front',48,36,{contact:{effect:'lethal'},behaviors:[{id:'sniff',label:'闻到食物走开',actions:[set('dog','inactive'),move('dog',455,'front',100)]}]}),
      obj('alley','斑马线',1040,'front',24,12,{passage:{from:'front-alley',to:'lane-entry',distance:160,enabled:true}}),
      obj('ped-signal','行人信号按钮',975,'front',22,50,{behaviors:[{id:'cross',label:'绿灯与抢行',actions:[set('ped-signal','inactive'),invoke('red-runner','clear'),after(300,[set('ped-signal','active'),invoke('red-runner','return')])]}]}),
      obj('red-runner','闯灯的行人',1040,'front',27,47,{space:{passage:'alley',progress:.55,length:32,depth:140,height:0},contact:{effect:'lethal'},behaviors:[
        {id:'clear',label:'抢先冲过斑马线',actions:[along('red-runner',1,66),after(66,[set('red-runner','inactive')])]},
        {id:'return',label:'又挤回路口',actions:[set('red-runner','active'),along('red-runner',.55,48)]}]}),
      obj('side-door','非机动车横穿口',160,'lane',24,12,{passage:{from:'lane-end',to:'court-entry',distance:150,enabled:true}}),
      obj('scooter-bell','堵路电瓶车的车铃',245,'lane',20,24,{behaviors:[{id:'ring',label:'催车穿过窄口',actions:[set('scooter-bell','inactive'),invoke('scooter','clear'),after(320,[set('scooter-bell','active'),invoke('scooter','return')])]}]}),
      obj('scooter','横占人行通路的电瓶车',160,'lane',40,46,{space:{passage:'side-door',progress:.55,length:40,depth:310,height:0},contact:{effect:'lethal'},behaviors:[
        {id:'clear',label:'挤出通道',actions:[along('scooter',1,84),after(84,[set('scooter','inactive')])]},
        {id:'return',label:'重新占道',actions:[set('scooter','active'),along('scooter',.55,60)]}]}),
      obj('bell','被车挡住的行人呼叫器',710,'court',18,28,{behaviors:[{id:'ring',label:'催促挪车',actions:[invoke('sedan','yield')]}]}),
      obj('sedan','霸着人行道的私家车',790,'court',80,38,{contact:{effect:'lethal'},behaviors:[{id:'yield',label:'慢吞吞挪车',actions:[set('sedan','inactive'),move('sedan',835,'court',120)]}]}),
      obj('guard','公司门外的人',980,'court',30,48,{behaviors:[{id:'receive',label:'接收持有物',actions:[{type:'place',target:'breakfast',at:'guard',range:100}]},
        {id:'wave',label:'接过早餐才抬杆',actions:[set('breakfast','inactive'),set('barrier','inactive'),move('guard',1010,'court',90)]}]}),
      obj('barrier','门外拦着的横杆',1060,'court',24,38,{contact:{effect:'lethal'}}),
      obj('bus','关门的公交车',620,'front',190,76,{behaviors:[{id:'leave',label:'关门开走',actions:[move('bus',800,'front',360)]}]}),
      {...obj('bus-zone','靠近站台',500,'front',10,8),kind:'zone',state:'enabled'},
      obj('late-worker','追公交的人',540,'front',27,48,{behaviors:[{id:'run',label:'追不上也要追',actions:[move('late-worker',805,'front',340)]}]}),
      obj('phone-walker','看手机横穿的行人',650,'lane',26,48,{behaviors:[{id:'step',label:'慢慢让开',actions:[move('phone-walker',550,'lane',220)]}]}),
      {...obj('walker-zone','进入小店街',790,'lane',10,8),kind:'zone',state:'enabled'},
      obj('bin','快满的垃圾桶',455,'lane',30,36,{behaviors:[{id:'rattle',label:'晃一晃',actions:[set('bin','inactive'),after(75,[set('bin','active')])]}]}),
    ],rules:[
      rule('breakfast','click',[invoke('breakfast','take')],[{holding:null},{entity:'breakfast',state:'active'}]),
      rule('bowl','click',[invoke('bowl','offer')],[{holding:'breakfast'}]),rule('breakfast','placed',[invoke('dog','sniff')],undefined,'bowl'),
      rule('ped-signal','click',[invoke('ped-signal','cross')],[{entity:'ped-signal',state:'active'}]),
      rule('scooter-bell','click',[invoke('scooter-bell','ring')],[{entity:'scooter-bell',state:'active'}]),
      rule('bell','click',[invoke('bell','ring')],[{entity:'sedan',state:'active'}]),
      rule('guard','click',[invoke('guard','receive')],[{holding:'breakfast'}]),rule('breakfast','placed',[invoke('guard','wave')],undefined,'guard'),
      rule('bus-zone','enter',[invoke('bus','leave'),invoke('late-worker','run')]),rule('walker-zone','enter',[invoke('phone-walker','step')]),
      rule('bin','click',[invoke('bin','rattle')],[{entity:'bin',state:'active'}]),
    ]};
  for(const e of level.entities)if(e.space.passage)syncPassageObject(level,e);
  level.scene=createStreetScene(level);return level;
}
