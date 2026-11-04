import {projectSpace} from '../core/spatial.js';
import {feedbackDefault} from '../content/feedback-presets.js';

/** Modular CC0 art: structures are backdrops, street props have real world anchors.
 * Every layer and anchor remains editable; no renderer recognizes their IDs. */
export function createCommuteScene(level){
  const scene={background:'#d9ddd0',assets:[],nodes:[],feedback:[],sounds:[]};let serial=0;
  const add=(asset,label,x,y,width,height,layer=0,extra={})=>{const n={id:'commute-art-'+(++serial),asset,label,x,y,width,height,layer,...extra};scene.nodes.push(n);return n;};
  const anchored=(asset,label,x,depth,elevation,width,height,extra={})=>add(asset,label,-width/2,-height,width,height,0,{anchor:{x,depth,height:elevation},...extra});
  const bind=(id,asset,label,x,y,width,height,extra={})=>add(asset,label,x,y,width,height,10,{bind:{type:'entity',id},...extra});
  const cue=(n,trigger,extra)=>scene.feedback.push({...feedbackDefault(n.id,'commute-cue-'+scene.feedback.length),trigger,...extra});
  for(const [x,y,w,h] of [[-20,40,140,260],[140,75,130,240],[300,0,150,270],[480,45,140,280],[650,20,130,270],[810,45,145,250]])add('commuteOffice','远处写字楼',x,y,w,h,-80,{opacity:.14});
  for(const [x,y,w] of [[90,20,120],[450,32,140],[780,8,180]])add('cloud1','晨雾',x,y,w,w*.4,-70,{opacity:.3});
  add('wallStone','旧小区外墙',0,225,145,205,-55,{tile:{width:70,height:70}});
  add('wallRose','候车亭后住宅',300,185,140,190,-55,{tile:{width:70,height:70}});
  add('wallTeal','早餐铺墙',150,330,145,110,-54,{tile:{width:70,height:70}});
  for(const [x,y] of [[8,240],[76,240],[8,305],[76,305],[310,200],[375,200],[310,266],[375,266]])add('windowLow','居民窗户',x,y,48,48,-45);
  anchored('commuteShelter','候车亭',380,95,140,160,100);
  add('doorKnob','小区门',48,365,45,66,-40);add('awningGreen','早餐铺篷布',165,326,115,25,-35);add('commuteDesk','早餐案台',180,390,58,45,-32);
  add('commuteCables','街巷电线',10,228,285,65,-35);
  add('commuteOffice','公司玻璃幕墙',985,-5,210,340,-50);add('commuteClock','公司的钟',1115,42,55,55,-32);
  for(const x of [1003,1067,1131])for(const y of [20,90]){add('commuteDesk','相同的工位',x,y,37,35,-25);add('commuteWorkerIdle','窗内的职员',x+10,y,17,30,-24);}
  add('commuteCamera','朝着打卡处的镜头',1140,114,38,32,-20);
  add('doorOpen','办公室入口',-17,-60,46,60,-14,{bind:{type:'goal'}});
  // Vehicle lanes are segmented ground-plane art, so their texture follows the
  // same depth projection as the logic instead of masquerading as a slope.
  add('commuteAsphalt','车道地面',400,100,620,150,-10,{ground:{x:400,depth:100,height:140,width:620,depthSize:150}});
  add('commuteStripes','被占的横道',765,125,90,100,-9,{ground:{x:765,depth:125,height:140,width:90,depthSize:100}});
  for(const [x,d,h] of [[170,140,140],[430,270,140],[880,290,140]])anchored('commuteTree','街边行道树',x,d,h,60,110);
  for(const [x,d] of [[110,95],[415,120],[885,300]])anchored('commuteBin','街角垃圾桶',x,d,140,24,36);
  for(const [x,d,h] of [[140,80,140],[310,100,240],[1045,60,240],[755,320,0]])anchored('commuteCone','检修区锥桶',x,d,h,20,30);
  for(const x of [360,540,720,900]){const p=projectSpace(level,{x,depth:320,height:280});add('commuteSlab','天桥立柱',p.x,p.y,12,205,-30);}
  for(const x of [460,620,780,940])anchored('commuteRail','天桥后侧栏杆',x,338,280,160,28);
  for(const x of [470,790])anchored('commuteArrow','地下通道图形指引',x,340,0,26,26,{flipX:true});
  for(const [x,d] of [[180,120],[330,250],[600,265],[860,140]]){
    anchored('commuteCamera','路口监控',x,d,140,30,75);anchored('commuteAircon','墙外设备',x+12,d,210,32,22);
  }
  for(const x of [345,415,515])anchored('commuteWorkerIdle','等车的人',x,150,140,26,43);
  const bus=bind('bus','commuteBus','关门的公交车',0,-100,240,100);bind('bus','commuteHand','车门拒绝手势',165,-80,23,23);
  const sedan=bind('sedan','commuteSedan','占着横道的私家车',0,-56,145,56);
  bind('late-commuter','commuteWorkerWalk1','追赶公交的人',-3,-50,30,50,{animation:{frames:['commuteWorkerWalk1','commuteWorkerWalk2','commuteWorkerWalk3'],fps:7}});
  bind('phone-walker','commutePhoneWalker','低头穿过车流的人',0,-54,28,54);
  for(const id of ['sidewalk-scooter','foreground-scooter'])bind(id,'commuteScooter','穿行的电瓶车',-5,-52,55,52,{flipWithDirection:true});
  const signal=bind('traffic-light','commuteSignalGreen','路口信号灯',-5,-100,32,100,{variants:{inactive:{asset:'commuteSignalRed'}}});
  bind('loading-ramp','commuteMetal','卸货板',0,0,Math.hypot(150,100),10);
  bind('trench-cover','commuteMetal','检修盖板',0,0,140,10);
  const lift=bind('service-lift','commuteLift','黄色维修台',0,-12,160,30);bind('service-lift','commuteArrow','升降方向图形',65,-10,24,24,{rotation:-90});
  const reader=bind('office-reader','commuteReader','门禁读卡器',-7,-48,30,48,{variants:{active:{asset:'commuteReaderGreen'}}});
  bind('turnstile','commuteGate','闸机',-9,-48,32,48,{variants:{open:{opacity:.25}}});
  const actor=add('commuteWorkerWalk1','持续赶路的上班族',-16,-49,32,49,20,{bind:{type:'actor'},flipWithDirection:true,
    animation:{frames:['commuteWorkerWalk1','commuteWorkerWalk2','commuteWorkerWalk3','commuteWorkerWalk2'],fps:8}});
  bind('badge','commuteBadge','工牌',-18,-34,10,16);
  cue(actor,{type:'lost'},{motion:'fall',particles:'dust',sound:'thud',duration:84,hold:true,count:9,color:'#b5b59d',strength:.6});
  cue(actor,{type:'won'},{motion:'squash',sound:'clack',duration:32,strength:.22});
  cue(bus,{type:'behavior',source:'bus',behavior:'depart'},{motion:'recoil',sound:'thud',duration:50,strength:.2});
  cue(bus,{type:'behavior',source:'bus',behavior:'brake'},{motion:'squash',sound:'clack',duration:35,strength:.15});
  for(const [n,source,behavior] of [[sedan,'sedan','yield'],[signal,'traffic-light','red'],[lift,'service-lift','call'],[reader,'office-reader','scan']])cue(n,{type:'behavior',source,behavior},{motion:'pulse',sound:'clack',duration:40,strength:.18});
  return scene;
}
