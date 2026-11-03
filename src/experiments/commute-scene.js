import {feedbackDefault} from '../content/feedback-presets.js';

/** Open licensed layers; no flattened background, scene-specific rendering or narrative text. */
export function createCommuteScene(level){
  const scene={background:'#d9ddd0',assets:[],nodes:[],feedback:[],sounds:[]};let serial=0;
  const add=(asset,label,x,y,width,height,layer=0,extra={})=>{
    const n={id:'commute-node-'+(++serial),asset,label,x,y,width,height,layer,...extra};scene.nodes.push(n);return n;
  };
  const bind=(id,asset,label,x,y,w,h,layer=25,extra={})=>add(asset,label,x,y,w,h,layer,{bind:{type:'entity',id},...extra});
  const cue=(node,trigger,extra)=>scene.feedback.push({...feedbackDefault(node.id,'commute-feedback-'+(scene.feedback.length+1)),trigger,...extra});
  const road=(x,y,w,h=15,layer=0)=>add('commuteSlab','路面边沿',x,y,w,h,layer);
  for(const [x,y,w,h] of [[-50,42,150,260],[112,90,120,220],[240,28,140,290],[420,60,150,220],[590,15,120,320],[730,50,160,230]])
    add('commuteOffice','远处写字楼',x,y,w,h,-80,{opacity:.17});
  for(const [x,y,w] of [[70,24,140],[520,52,100],[780,5,170]])add('cloud1','晨雾',x,y,w,w*.4,-75,{opacity:.22});
  add('wallStone','旧小区外墙',0,172,148,208,-55,{tile:{width:70,height:70}});
  add('wallTeal','沿街门面墙',265,305,185,75,-55,{tile:{width:70,height:70}});
  add('wallRose','公交站后住宅',316,97,139,180,-57,{tile:{width:70,height:70}});
  for(const [x,y] of [[12,190],[82,190],[12,262],[82,262],[326,115],[390,115],[326,187],[390,187]])
    add('windowLow','居民窗户',x,y,48,48,-45);
  add('doorKnob','小区门',48,310,48,70,-43);
  add('awningGreen','早餐铺遮阳篷',289,304,112,25,-36);
  add('commuteDesk','早餐铺案台',300,339,54,41,-35);
  add('commuteAircon','墙外空调',326,250,45,28,-38);add('commuteAircon','旧墙空调',4,319,35,22,-38);
  add('commuteCables','横跨小区的电线',4,167,275,70,-36);
  for(const [x,y,h] of [[176,258,122],[472,302,78],[875,303,110]])add('commuteTree','街边行道树',x,y,h*.55,h,-42);
  add('commuteBin','小区垃圾桶',106,340,28,40,-21);add('commuteBin','公交站垃圾桶',402,344,25,36,-21);
  add('commuteOffice','公司玻璃幕墙',995,-30,205,430,-50);
  add('commuteClock','公司的钟',1115,84,56,56,-35);
  for(const x of [1017,1083,1149])for(const y of [30,105]){
    add('commuteDesk','窗内相同的工位',x,y,36,35,-31);
    add('travelerIdle','窗内坐着的职员',x+12,y+1,15,26,-32,{opacity:.8});
  }
  add('commuteCamera','朝着打卡处的摄像头',1142,143,44,38,-15);
  add('doorOpen','办公室入口',1140,139,46,61,-15);
  for(const x of [350,520,690,860]){
    add('commuteSlab','天桥立柱',x,210,14,170,-39);
    add('commuteRail','天桥栏杆',x-10,166,170,34,-16);
  }
  road(340,200,820,13,-10);
  add('commuteAsphalt','机动车道',450,380,660,97,-25,{tile:{width:180,height:97}});
  add('commuteStripes','被占的斑马线',783,385,90,62,-22);
  add('commuteStripes','远处人行横道',500,390,72,45,-22,{opacity:.55});
  road(25,380,125,20,0);road(200,380,250,20,0);
  road(300,280,160,12,5);add('commuteShelter','公交候车亭',300,280,160,100,-19);
  const bus=bind('bus','commuteBus','关门的公交车',0,-100,240,100,25);
  bind('bus','commuteHand','车门上的拒绝手势',164,-82,25,25,30);
  const sedan=bind('sedan','commuteSedan','压在横道上的私家车',0,-64,145,64,30);
  const signal=bind('traffic-light','commuteSignalGreen','车道信号灯',-7,-110,34,110,38,
    {variants:{inactive:{asset:'commuteSignalRed'}}});
  bind('late-commuter','travelerWalk2','刚被关在门外的人',-3,-54,35,54,32,
    {animation:{frames:['travelerWalk1','travelerWalk2','travelerWalk3','travelerWalk2'],fps:7}});
  bind('phone-walker','commutePhoneWalker','低头穿过车流的人',0,-61,32,61,33);
  for(const [id,label] of [['sidewalk-scooter','借道的人行道电瓶车'],['foreground-scooter','车流中逆行电瓶车']])
    bind(id,'commuteScooter',label,-8,-67,61,67,37);
  for(const [x,y,flip] of [[232,380,true],[275,380,false],[414,380,false],[946,399,true],[1034,380,false]])
    add('travelerIdle','等车或赶路的人',x,y-49,29,49,18,{flipX:flip});
  add('commutePhoneWalker','抱着手机等车的人',368,321,30,59,18);
  for(const x of [219,443,888,1090])add('commuteCone','路边锥桶',x,350,20,30,18);
  road(900,280,30,10,8);
  add('commuteSedan','坡道下的检修车',940,331,142,62,9);
  add('commuteMetal','检修车的卸货斜板',930,280,Math.hypot(150,100),12,10,{rotation:Math.atan2(100,150)*180/Math.PI});
  road(1080,400,55,15,10);add('commuteRail','右侧封闭围栏',1104,353,68,47,40);
  add('commuteArrow','地下通道入口箭头',1118,415,31,31,10,{flipX:true});
  add('wallStone','地下通道剖面',335,478,610,140,-30,{tile:{width:90,height:70},opacity:.6});
  for(const [x,y,w] of [[343,500,110],[474,500,100],[775,500,115]]){
    add('commuteMetal','地下管线',x,y,w,6,-14);
    add('commuteAircon','通道排风口',x+30,y-8,30,19,-13);
  }
  road(340,540,260,18,5);road(750,540,150,18,5);
  add('commuteSlab','下行通道',900,540,Math.hypot(180,140),15,5,{rotation:-Math.atan2(140,180)*180/Math.PI});
  add('commuteRail','下行通道扶手',904,505,Math.hypot(180,140),31,6,{rotation:-Math.atan2(140,180)*180/Math.PI});
  for(const x of [370,495,803])add('commuteArrow','地下通道方向标',x,485,24,24,-5,{flipX:true});
  add('commuteCone','盖板边锥桶',756,507,22,33,14);
  add('commuteAsphalt','检修沟底部阴影',600,559,150,81,-15);
  const cover=bind('trench-cover','commuteMetal','可以放下的检修盖板',0,0,150,12,20);
  const ramp=bind('loading-ramp','commuteMetal','早餐推车旁卸货板',0,0,Math.hypot(150,100),12,20);
  for(const x of [139,298])add('commuteCone','卸货区锥桶',x,350,18,30,10);
  add('commuteSlab','维修井后墙',337,206,106,334,-32);
  for(const x of [342,431])add('commuteRail','维修井轨道',x,207,8,330,-13);
  const lift=bind('service-lift','commuteLift','黄色维修升降平台',0,-32,100,52,24);
  bind('service-lift','commuteArrow','维修台升降符号',38,-23,24,24,26,{rotation:-90});
  bind('turnstile','commuteGate','门禁闸机',-10,-58,36,58,35,{variants:{open:{opacity:.3}}});
  const reader=bind('office-reader','commuteReader','无字读卡器',-8,-55,35,55,37,
    {variants:{active:{asset:'commuteReaderGreen'}}});
  const actor=add('commuteWorkerWalk1','始终往前走的上班族',-18,-55,36,55,45,{bind:{type:'actor'},flipWithDirection:true,
    animation:{frames:['commuteWorkerWalk1','commuteWorkerWalk2','commuteWorkerWalk3','commuteWorkerWalk2'],fps:8}});
  bind('badge','commuteBadge','始终带着的工牌',-21,-38,12,20,46);
  for(const x of [42,140,240,530,860]){
    add('commuteCamera','街角监控',x,235,28,26,-9);
    add('commuteAircon','背景设备',x+13,115,31,20,-34);
  }
  cue(actor,{type:'lost'},{motion:'fall',particles:'dust',sound:'thud',duration:84,hold:true,count:9,color:'#b5b59d',strength:.6});
  cue(actor,{type:'won'},{motion:'squash',sound:'clack',duration:32,strength:.22});
  cue(bus,{type:'behavior',source:'bus',behavior:'depart'},{motion:'recoil',sound:'thud',particles:'smoke',duration:65,count:10,anchor:{x:.05,y:1},color:'#91a09a',strength:.3});
  cue(bus,{type:'behavior',source:'bus',behavior:'brake'},{motion:'none',sound:'clack',duration:35});
  cue(sedan,{type:'behavior',source:'sedan',behavior:'yield'},{motion:'recoil',sound:'pop',duration:40,strength:.3});
  cue(signal,{type:'behavior',source:'traffic-light',behavior:'red'},{motion:'pulse',sound:'clack',duration:40,strength:.2});
  for(const [node,source,behavior] of [[ramp,'loading-ramp','raise'],[cover,'trench-cover','lower'],[lift,'service-lift','call']])
    cue(node,{type:'behavior',source,behavior},{motion:'none',sound:'clack',duration:45});
  cue(reader,{type:'behavior',source:'office-reader',behavior:'scan'},{motion:'pulse',sound:'pop',duration:30,strength:.2});
  return scene;
}
