import {createOfficeScene} from './office-scene.js';

/** The same parcel becomes a doorstop and then a piece of cardboard flooring.
 * These are ordinary placement events, states and behaviors, not level hooks. */
export function createOfficeArrival(){
  const planes=[{id:'lobby',label:'门厅',depth:100,order:1},{id:'gallery',label:'考勤走廊',depth:310,order:0}];
  const space=plane=>({plane,depth:planes.find(p=>p.id===plane).depth,depthSize:20,height:0});
  const obj=(id,label,x,plane,extra={})=>({id,label,kind:'object',x,width:24,height:44,state:'active',space:space(plane),...extra});
  const flag=(id,label)=>obj(id,label,30,'gallery',{width:8,height:8,state:'inactive'});
  const zone=(id,label,x,plane)=>({...obj(id,label,x,plane,{width:10,height:8}),kind:'zone',state:'enabled'});
  const set=(target,state)=>({type:'set',target,state}),invoke=(target,behavior)=>({type:'invoke',target,behavior});
  const after=(ticks,actions)=>({type:'after',ticks,actions});
  const move=(target,x,ticks,plane)=>({type:'move',target,x,depth:space(plane).depth,height:0,ticks,plane});
  const is=(entity,state='active')=>({entity,state});
  const rule=(source,type,actions,conditions,other,behavior)=>({on:{source,type,...(other?{other}:{}),...(behavior?{behavior}:{})},...(conditions?{if:conditions}:{}),actions});
  const level={schemaVersion:3,id:'office-arrival',name:'上班路 · 人到就行',
    description:'门厅、饮水机和打卡机。先到的未必是职员。',
    hint:'把纸箱拖到自动门的缝隙；人通过后，再将同一个纸箱铺到里侧积水上。饮水机仍在滴水时纸板会重新湿透，记得关水。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:620,depthX:0,depthY:-1},planes,start:'start',nodes:[
      {id:'start',x:75,plane:'lobby',depth:100,height:0,next:'turn'},
      {id:'turn',x:1045,plane:'lobby',depth:100,height:0,next:'return',via:'corridor'},
      {id:'return',x:1045,plane:'gallery',depth:310,height:0,next:'clock'},
      {id:'clock',x:205,plane:'gallery',depth:310,height:0},
    ]},
    actor:{x:75,speed:48,space:space('lobby')},goal:{x:205,space:space('gallery')},
    platforms:planes.map(p=>({x:20,width:1160,space:space(p.id)})),
    entities:[
      obj('door','总在合拢的玻璃门',430,'lobby',{width:24,height:95,
        contact:{effect:'lethal',message:'一头撞上了合拢的玻璃门。'}}),
      obj('door-gap','玻璃门下的缝隙',431,'lobby',{width:55,height:8,dropTarget:{enabled:true,radius:39}}),
      obj('parcel','可拆开的空纸箱',258,'lobby',{width:54,height:36,draggable:{enabled:true,targets:['door-gap','wet-floor']}}),
      obj('wet-floor','饮水机前的积水',664,'gallery',{width:132,height:8,dropTarget:{enabled:true,radius:44},
        contact:{effect:'lethal',message:'鞋底一滑，打卡又晚了一步。'},behaviors:[
          {id:'cover',label:'纸板先吸走表面积水',actions:[set('wet-floor','inactive'),after(150,[set('soak-check','active')])]},
        ]}),
      obj('dispenser','还在漏水的饮水机',804,'gallery',{width:42,height:88,behaviors:[
        {id:'close',label:'拧紧水龙头',actions:[set('dispenser','inactive')]},
      ]}),
      obj('corridor','绕过玻璃隔墙的走廊',1045,'lobby',{height:8,passage:{from:'turn',to:'return',distance:150,enabled:true}}),
      obj('courier','推着盆栽送货的师傅',330,'lobby',{width:36,height:52,behaviors:[
        {id:'deliver',label:'门开后推货进门',actions:[set('delivery-started','active'),set('delivery-approach','active'),move('courier',1045,360,'lobby')]},
        {id:'turn',label:'沿真实走廊推到里面',actions:[set('delivery-approach','inactive'),set('delivery-turn','active'),{type:'move',target:'courier',passage:'corridor',progress:1,ticks:126}]},
        {id:'park',label:'把盆栽推到考勤机旁等候',actions:[set('delivery-turn','inactive'),set('delivery-park','active'),move('courier',405,300,'gallery')]},
        {id:'scan',label:'先让盆栽对着摄像头',actions:[set('delivery-park','inactive'),set('courier-ready','inactive'),set('scan-started','active'),set('delivery-scan','active'),move('courier',272,96,'gallery')]},
        {id:'leave',label:'绿灯后继续送货',actions:[set('delivery-scan','inactive'),set('delivery-leave','active'),after(100,[move('courier',-160,240,'gallery')])]},
      ]}),
      obj('guard','忙着看手机的保安',340,'gallery',{width:22,height:50,behaviors:[
        {id:'welcome',label:'看到盆栽获准便起身招呼',actions:[set('guard','inactive'),after(90,[set('guard','active')])]},
      ]}),
      obj('reader','人脸识别考勤机',225,'gallery',{width:24,height:62}),
      flag('delivery-started','送货已开始'),flag('courier-ready','送货已到等候位'),
      ...['approach','turn','park','scan','leave'].map(stage=>flag('delivery-'+stage,'送货阶段 / '+stage)),
      flag('scan-requested','赶路者已进入考勤区'),flag('scan-started','盆栽已开始识别'),flag('soak-check','纸板吸水检查'),
      zone('reader-approach','进入考勤机所在的走廊',505,'gallery'),
    ],
    rules:[
      rule('parcel','placed',[set('parcel','active'),set('door','inactive'),set('wet-floor','active')],undefined,'door-gap'),
      rule('parcel','placed',[invoke('courier','deliver')],[is('delivery-started','inactive')],'door-gap'),
      rule('parcel','placed',[set('parcel','inactive'),set('door','active'),invoke('wet-floor','cover')],undefined,'wet-floor'),
      rule('dispenser','click',[invoke('dispenser','close')],[is('dispenser')]),
      rule('dispenser','done',[set('wet-floor','inactive')],[is('parcel','inactive')],undefined,'close'),
      rule('wet-floor','done',[set('wet-floor','active')],[is('dispenser'),is('parcel','inactive')],undefined,'cover'),
      // A move starts immediately; its `moved` event, rather than behavior done,
      // confirms real arrival. Reverse phase order prevents skipping a leg.
      rule('courier','moved',[set('courier','inactive'),set('delivery-leave','inactive')],[is('delivery-leave')]),
      rule('courier','moved',[set('reader','inactive'),invoke('guard','welcome'),invoke('courier','leave')],[is('delivery-scan')]),
      rule('courier','moved',[invoke('courier','scan')],[is('delivery-park'),is('scan-requested'),is('scan-started','inactive')]),
      rule('courier','moved',[set('delivery-park','inactive'),set('courier-ready','active')],[is('delivery-park')]),
      rule('courier','moved',[invoke('courier','park')],[is('delivery-turn')]),
      rule('courier','moved',[invoke('courier','turn')],[is('delivery-approach')]),
      rule('reader-approach','enter',[set('reader-approach','disabled'),set('scan-requested','active')]),
      rule('reader-approach','enter',[invoke('courier','scan')],[is('courier-ready'),is('scan-started','inactive')]),
    ]};
  level.scene=createOfficeScene(level);return level;
}
