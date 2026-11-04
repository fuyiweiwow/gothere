import {createStreetScene} from './street-scene.js';

export const STREET_PLAN=[{source:'breakfast',tick:60},{source:'bowl',tick:235},{source:'breakfast',tick:250},{source:'guard',tick:790},{source:'bell',tick:985}];
const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior});
const rule=(source,type,actions,conditions,other)=>({on:{source,type,...(other?{other}:{})},...(conditions?{if:conditions}:{}),actions});

/** Layered street authored entirely in the public DSL. Items, receivers and
 * creature reactions use the same actions as any other editor object. */
export function createStreetLevel(){
  const planes=[{id:'front',label:'前街',depth:30,order:2},{id:'lane',label:'后巷',depth:220,order:1},{id:'court',label:'公司院落',depth:380,order:0}];
  const space=(plane,height=0)=>({plane,depth:planes.find(p=>p.id===plane).depth,depthSize:20,height});
  const obj=(id,label,x,plane,width=32,height=40,extra={})=>({id,label,kind:'object',x,width,height,state:'active',space:space(plane),...extra});
  const move=(target,x,plane,ticks)=>({type:'move',target,x,depth:space(plane).depth,height:0,ticks});
  const node=(id,x,plane,next,via,height=0)=>({id,x,plane,depth:space(plane).depth,height,...(next?{next}:{}),...(via?{via}:{})});
  const road=(x,width,plane,height=0,heightEnd)=>({x,width,space:{...space(plane,height),...(heightEnd!==undefined?{heightEnd}:{})}});
  const level={schemaVersion:3,id:'commute-layered',name:'上班路 · 早餐也要打卡',description:'前街的早餐摊、后巷的狗和公司的小门。三条行走层以局部通路连接，楼梯保留真实高度。',
    hint:'取走早餐，走近狗碗时放下，引开挡路的狗后再取回。到公司门口把早餐交出去；院子里的车可按铃让道。早点取物，晚点放下。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:620,depthX:0,depthY:-1},planes,start:'start',nodes:[
      node('start',70,'front','front-alley'),node('front-alley',420,'front','lane-entry','alley'),node('lane-entry',500,'lane','lane-end'),
      node('lane-end',925,'lane','court-entry','side-door'),node('court-entry',985,'court','stairs'),node('stairs',1060,'court','landing'),
      node('landing',1110,'court','office',undefined,55),node('office',1150,'court',undefined,undefined,55)]},
    actor:{x:70,speed:70,space:space('front')},goal:{x:1150,space:space('court',55)},
    platforms:[road(30,390,'front'),road(500,425,'lane'),road(985,75,'court'),road(1060,50,'court',0,55),road(1110,65,'court',55)],
    entities:[
      obj('breakfast','早餐袋',145,'front',18,20,{behaviors:[{id:'take',label:'拿起',actions:[{type:'hold',target:'breakfast'}]}]}),
      obj('alley','前街巷口',420,'front',24,12,{passage:{from:'front-alley',to:'lane-entry',distance:Math.hypot(80,190),enabled:true}}),
      obj('bowl','路边狗碗',342,'front',24,12,{behaviors:[{id:'offer',label:'放下持有物',actions:[{type:'place',target:'breakfast',at:'bowl',range:105}]}]}),
      obj('dog','挡住后巷的狗',555,'lane',48,36,{contact:{effect:'lethal'},behaviors:[{id:'sniff',label:'闻到食物走开',actions:[set('dog','inactive'),move('dog',735,'lane',100)]}]}),
      obj('side-door','通往院落的小门',925,'lane',24,12,{passage:{from:'lane-end',to:'court-entry',distance:Math.hypot(60,160),enabled:false}}),
      obj('guard','门口的人',880,'lane',30,48,{behaviors:[{id:'receive',label:'接收持有物',actions:[{type:'place',target:'breakfast',at:'guard',range:100}]},
        {id:'wave',label:'接过早餐让路',actions:[move('guard',810,'lane',90),{type:'enable',target:'side-door',capability:'passage',enabled:true},set('breakfast','inactive')]}]}),
      obj('bell','院落门铃',1000,'court',18,28,{behaviors:[{id:'ring',label:'按铃',actions:[invoke('sedan','yield')]}]}),
      obj('sedan','占着楼梯口的车',1025,'court',48,34,{contact:{effect:'lethal'},behaviors:[{id:'yield',label:'挪车',actions:[set('sedan','inactive'),move('sedan',905,'court',80)]}]}),
      obj('bus','关门的公交车',620,'front',205,82,{behaviors:[{id:'leave',label:'关门开走',actions:[move('bus',920,'front',360)]}]}),
      {...obj('bus-zone','靠近站台',270,'front',10,8),kind:'zone',state:'enabled'},
      obj('late-worker','赶车的人',515,'front',27,48,{behaviors:[{id:'run',label:'追公交',actions:[move('late-worker',890,'front',340)]}]}),
      obj('scooter','逆行电瓶车',770,'front',55,44,{motion:{type:'patrol',minX:650,maxX:1050,speed:100}}),
      obj('phone-walker','低头过路的人',700,'lane',26,48,{behaviors:[{id:'step',label:'慢慢让开',actions:[move('phone-walker',780,'lane',220)]}]}),
      {...obj('walker-zone','经过巷子',650,'lane',10,8),kind:'zone',state:'enabled'},
      obj('bin','快满的垃圾桶',610,'lane',30,36,{behaviors:[{id:'rattle',label:'晃一晃',actions:[set('bin','inactive'),{type:'after',ticks:75,actions:[set('bin','active')]}]}]}),
    ],rules:[
      rule('breakfast','click',[invoke('breakfast','take')],[{holding:null},{entity:'breakfast',state:'active'}]),
      rule('bowl','click',[invoke('bowl','offer')],[{holding:'breakfast'}]),
      rule('breakfast','placed',[invoke('dog','sniff')],undefined,'bowl'),
      rule('guard','click',[invoke('guard','receive')],[{holding:'breakfast'}]),
      rule('breakfast','placed',[invoke('guard','wave')],undefined,'guard'),
      rule('bell','click',[invoke('bell','ring')]),
      rule('bus-zone','enter',[invoke('bus','leave'),invoke('late-worker','run')]),
      rule('walker-zone','enter',[invoke('phone-walker','step')]),
      rule('bin','click',[invoke('bin','rattle')],[{entity:'bin',state:'active'}]),
    ]};
  level.scene=createStreetScene(level);return level;
}
