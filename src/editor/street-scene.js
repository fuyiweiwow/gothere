import {feedbackDefault} from '../content/feedback-presets.js';

/** A side-view street assembled from editable art layers with a single palette.
 * Local connector images span only their endpoints; no global isometric ground. */
export function createStreetScene(level){
  const scene={background:'#e5e2d3',assets:[],nodes:[],feedback:[],sounds:[]};let serial=0;
  const add=(asset,label,x,y,width,height,layer=-10,extra={})=>{const n={id:'street-art-'+(++serial),asset,label,x,y,width,height,layer,...extra};scene.nodes.push(n);return n;};
  const bind=(id,asset,label,x,y,w,h,extra={})=>add(asset,label,x,y,w,h,15,{bind:{type:'entity',id},...extra});
  const anchor=(plane,x,asset,label,w,h,layer=0,extra={})=>add(asset,label,0,-h,w,h,layer,{anchor:{x,plane,depth:level.spatial.planes.find(p=>p.id===plane).depth,height:0},...extra});
  const cue=(n,trigger,extra)=>scene.feedback.push({...feedbackDefault(n.id,'street-cue-'+scene.feedback.length),trigger,...extra});
  // Distant skyline and buildings are flat side elevations. The company occupies
  // the upper-right corner, clearly separated from the lower-left start.
  for(const [x,y,w,h] of [[0,35,160,140],[170,0,110,180],[320,20,170,145],[570,0,100,165],[710,30,180,130]])add('commuteOffice','远处楼影',x,y,w,h,-85,{opacity:.14});
  for(const [x,y,w,h] of [[0,230,115,285],[118,275,160,240],[282,245,140,270],[450,208,175,135],[640,235,140,110],[790,185,150,160]]){
    add('streetFacade','旧街楼面',x,y,w,h,-70);
    for(let yy=y+18;yy<y+h-28;yy+=52)for(let xx=x+12;xx<x+w-20;xx+=48)add('streetWindow','居民窗户',xx,yy,28,37,-65);
    add('commuteCables','墙面电线',x,y+4,w,28,-60,{opacity:.75});
  }
  add('commuteOffice','公司正面',1010,20,178,170,-60);add('commuteClock','公司时钟',1128,38,35,35,-55);
  for(const x of [1023,1070,1117])for(const y of [42,96]){add('commuteDesk','工位',x,y,36,25,-54);add('commuteWorkerIdle','工位里的人',x+10,y-7,17,28,-53);}
  add('streetCanopy','早餐摊棚',70,470,147,22,-45);add('commuteDesk','早餐案台',105,537,65,51,-40);
  add('commuteShelter','公交候车亭',276,476,142,110,-44);add('commuteCables','街口缆线',215,435,220,35,-43);
  for(const x of [290,322,355])add('commuteWorkerIdle','候车的人',x,538,25,45,-39);
  // Ordinary sloped images visualize only the two local plane connections.
  for(const id of ['alley','side-door'])add('streetPassage','局部巷道铺面',0,-24,200,48,-30,{bind:{type:'entity',id},fitPassage:true});
  for(const p of level.platforms){const rise=(p.space.heightEnd??p.space.height)-p.space.height;
    anchor(p.space.plane,p.x,'streetPavement','街面铺装',p.width,25,2,{y:-p.space.height-13,rotation:-Math.atan2(rise,p.width)*180/Math.PI,width:Math.hypot(p.width,rise)});
    anchor(p.space.plane,p.x,'commuteSlab','路面边沿',p.width,12,3,{x:0,y:-p.space.height,rotation:-Math.atan2(rise,p.width)*180/Math.PI,width:Math.hypot(p.width,rise)});
  }
  for(let i=0;i<6;i++)anchor('court',1060+i*8.3,'commuteSlab','真正的台阶踏面',10,6,5,{y:-i*9.2-4});
  for(const [plane,x] of [['front',45],['front',225],['lane',530],['lane',815],['court',987]])anchor(plane,x,'commuteTree','行道树',42,88,-4);
  for(const [plane,x] of [['front',380],['lane',590],['court',1040]])anchor(plane,x,'commuteCone','路边锥桶',18,26,6);
  for(const [plane,x] of [['front',92],['lane',665],['court',1080]])anchor(plane,x,'commuteCamera','路口摄像头',28,65,-1);
  for(const x of [472,680,844])anchor('lane',x,'commuteAircon','沿街空调',30,22,-2,{y:-72});
  for(const x of [1050,1095,1140])add('commuteRail','院墙栏杆',x,217,46,20,-31);
  const breakfast=bind('breakfast','streetBreakfast','早餐袋',-1,-25,24,25,{variants:{inactive:{visible:false}}});
  const bowl=bind('bowl','streetBowl','狗碗',0,-10,27,10);
  const dog=bind('dog','streetDog','挡路的狗',-3,-40,55,40,{variants:{inactive:{rotation:-4}}});
  const guard=bind('guard','commuteWorkerIdle','门口的人',-2,-49,30,49);
  bind('side-door','streetDoor','院门',-9,-62,43,63,{variants:{'passage-enabled':{width:13,x:18,opacity:.6}}});
  const bell=bind('bell','commuteReader','门铃',0,-35,20,35);
  const sedan=bind('sedan','commuteSedan','挪不开的车',-14,-42,95,42);
  const bus=bind('bus','commuteBus','关门的公交车',0,-82,205,82);bind('bus','commuteHand','拒绝开门的手',140,-68,20,20);
  bind('scooter','commuteScooter','逆行的电瓶车',-3,-46,58,46,{flipWithDirection:true});
  const walk={animation:{frames:['commuteWorkerWalk1','commuteWorkerWalk2','commuteWorkerWalk3','commuteWorkerWalk2'],fps:8},flipWithDirection:true};
  bind('late-worker','commuteWorkerWalk1','追车的人',0,-48,29,48,walk);
  bind('phone-walker','commutePhoneWalker','低头行人',0,-48,27,48);
  const bin=bind('bin','commuteBin','垃圾桶',0,-37,30,37);
  const actor=add('commuteWorkerWalk1','赶着上班的人',-14,-47,28,47,35,{bind:{type:'actor'},...walk,variants:{
    inward:{asset:'streetWalkIn1',animation:{frames:['streetWalkIn1','streetWalkIn2'],fps:8},flipWithDirection:false},
    outward:{asset:'streetWalkOut1',animation:{frames:['streetWalkOut1','streetWalkOut2'],fps:8},flipWithDirection:false}}});
  add('streetDoor','公司入口',-13,-51,36,52,10,{bind:{type:'goal'}});
  for(const [n,source,behavior,motion] of [[dog,'dog','sniff','hop'],[guard,'guard','wave','hop'],[bell,'bell','ring','shake'],[sedan,'sedan','yield','recoil'],[bus,'bus','leave','recoil'],[bin,'bin','rattle','shake']])cue(n,{type:'behavior',source,behavior},{motion,sound:'clack',duration:45,strength:.2});
  cue(breakfast,{type:'event',source:'breakfast',event:'placed'},{motion:'squash',sound:'pop',duration:24,strength:.2});
  cue(bowl,{type:'behavior',source:'bowl',behavior:'offer'},{motion:'squash',sound:'clack',duration:24,strength:.15});
  cue(actor,{type:'lost'},{motion:'fall',particles:'dust',sound:'thud',duration:72,hold:true,strength:.5});
  cue(actor,{type:'won'},{motion:'hop',sound:'success',duration:48,strength:.2});
  return scene;
}
