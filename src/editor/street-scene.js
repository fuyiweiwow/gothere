import {feedbackDefault} from '../content/feedback-presets.js';

/** Three flat street elevations. Only the two local crossings use a perspective surface. */
export function createStreetScene(level){
  const scene={background:'#e5e2d3',assets:[],nodes:[],feedback:[],sounds:[]};let serial=0;
  const add=(asset,label,x,y,width,height,layer=-10,extra={})=>{const n={id:'street-art-'+(++serial),asset,label,x,y,width,height,layer,...extra};scene.nodes.push(n);return n;};
  const bind=(id,asset,label,x,y,w,h,extra={})=>add(asset,label,x,y,w,h,15,{bind:{type:'entity',id},...extra});
  const anchor=(plane,x,asset,label,w,h,layer=0,extra={})=>add(asset,label,0,-h,w,h,layer,{anchor:{x,plane,depth:level.spatial.planes.find(p=>p.id===plane).depth,height:0},...extra});
  const cue=(n,trigger,extra)=>scene.feedback.push({...feedbackDefault(n.id,'street-cue-'+scene.feedback.length),trigger,...extra});
  // Each facade ends above its own sidewalk. The crossings keep clear sight lines.
  for(const [plane,baseline,blocks] of [
    ['front',575,[[28,140],[190,130],[345,120],[485,135],[650,160],[835,115]]],
    ['lane',400,[[250,150],[425,140],[590,130],[745,160],[925,70]]],
    ['court',225,[[235,135],[395,150],[570,145],[740,135],[900,110]]],
  ])for(const [i,[x,w]] of blocks.entries()){
    const height=plane==='court'?104:112;
    add('streetFacade','沿街楼面',x,baseline-height-12,w,height,-75);
    for(let xx=x+12;xx<x+w-20;xx+=40)for(const yy of [baseline-height,baseline-height+39])add('streetWindow','沿街窗户',xx,yy,25,31,-70);
    add('commuteAircon','外墙空调',x+w-30,baseline-42,23,17,-68);
    add('commuteCables','楼间电线',x,baseline-height-17,w,22,-66,{opacity:.7});
    if(plane!=='court')add(i%2?'awningGreenRed':'awningGreen','小店遮篷',x+8,baseline-41,w-16,18,-60);
  }
  // No company interior: a closed facade and its street-side entrance finish this chapter.
  add('streetFacade','公司外墙',1092,95,96,118,-65);add('streetWindow','公司窗户',1104,109,26,36,-60);add('streetWindow','公司窗户',1146,109,26,36,-60);
  add('commuteClock','门外时钟',1132,155,26,26,-55);
  add('streetCanopy','早餐摊棚',75,493,130,22,-45);add('commuteDesk','早餐摊案台',105,530,65,42,-40);
  add('commuteShelter','公交候车亭',516,493,100,78,-44);
  for(const x of [525,550,575])anchor('front',x,'commuteWorkerIdle','挤在站台的人',22,39,10);
  for(const p of level.platforms){
    anchor(p.space.plane,p.x,'streetRoad','街面车道',p.width,36,1,{y:10,tile:{width:200,height:36}});
    anchor(p.space.plane,p.x,'streetPavement','人行道',p.width,20,2,{y:-9});
    anchor(p.space.plane,p.x,'commuteSlab','路沿',p.width,7,3,{y:3});
  }
  // Tapered surfaces use endpoint geometry; they never acquire slope or height physics.
  for(const [id,asset,w,scale] of [['alley','streetCrossing',62,.65],['side-door','streetPassage',56,.62]])
    add(asset,'内外直路铺面',0,0,175,w,-30,{bind:{type:'entity',id},fitPassage:true,passageView:{endScale:scale}});
  for(const [plane,x] of [['front',35],['front',470],['lane',210],['lane',880],['court',200],['court',920]])anchor(plane,x,'commuteTree','路边行道树',32,63,-4);
  for(const [plane,x] of [['front',855],['lane',360],['court',560]])anchor(plane,x,'commuteCamera','街角摄像头',23,52,-1);
  for(const [plane,x] of [['front',905],['lane',835],['court',930]])anchor(plane,x,'commuteCone','路口锥桶',16,24,8);
  for(const [plane,x] of [['front',220],['lane',730],['court',420]])anchor(plane,x,'commuteBin','路边杂物桶',25,31,5);
  const breakfast=bind('breakfast','streetBreakfast','早餐袋',-1,-25,24,25,{variants:{inactive:{visible:false}}});
  const bowl=bind('bowl','streetBowl','狗碗',0,-10,27,10);
  const dog=bind('dog','streetDog','守摊的狗',-3,-35,48,35,{variants:{inactive:{rotation:-4,y:9}}});
  const signal=bind('ped-signal','commuteSignalRed','行人红绿灯',-4,-58,26,58,{variants:{inactive:{asset:'commuteSignalGreen'}}});
  const runner=bind('red-runner','streetWalkOut1','不看灯的行人',-14,-45,28,45,{animation:{frames:['streetWalkOut1','streetWalkOut2'],fps:10},variants:{inactive:{x:-45,y:-47}}});
  const scooter=bind('scooter','streetScooterFront','堵在人行通道的电瓶车',-20,-52,40,52,{variants:{inactive:{x:30,y:-34,rotation:-9}}});
  const scooterBell=bind('scooter-bell','commuteReader','车铃',-4,-30,23,30);
  const bell=bind('bell','commuteReader','被占道的行人呼叫器',0,-30,18,30);
  const sedan=bind('sedan','commuteSedan','横霸人行道的车',-13,-40,96,40,{variants:{inactive:{y:19}}});
  const guard=bind('guard','commuteWorkerIdle','公司门外的人',-2,-46,28,46);
  const barrier=bind('barrier','commuteGate','门外横杆',-10,-35,60,35,{variants:{inactive:{rotation:-75,x:25}}});
  const bus=bind('bus','commuteBus','不肯再开门的公交',0,-48,190,76);bind('bus','commuteHand','车窗伸出的手',127,-39,19,19);
  const walk={animation:{frames:['commuteWorkerWalk1','commuteWorkerWalk2','commuteWorkerWalk3','commuteWorkerWalk2'],fps:8},flipWithDirection:true};
  bind('late-worker','commuteWorkerWalk1','追不上车的人',0,-40,25,42,walk);
  bind('phone-walker','commutePhoneWalker','低头横穿的人',0,-45,25,45);
  const bin=bind('bin','commuteBin','快满的垃圾桶',0,-35,28,35);
  const actor=add('commuteWorkerWalk1','一定要去上班的人',-13,-44,26,44,35,{bind:{type:'actor'},...walk,variants:{
    inward:{asset:'streetWalkIn1',animation:{frames:['streetWalkIn1','streetWalkIn2'],fps:8},flipWithDirection:false},
    outward:{asset:'streetWalkOut1',animation:{frames:['streetWalkOut1','streetWalkOut2'],fps:8},flipWithDirection:false}}});
  add('streetDoor','公司门外终点',-12,-51,36,52,10,{bind:{type:'goal'}});
  for(const [n,source,behavior,motion] of [[dog,'dog','sniff','hop'],[signal,'ped-signal','cross','squash'],[runner,'red-runner','clear','hop'],[scooter,'scooter','clear','shake'],
    [scooterBell,'scooter-bell','ring','shake'],[bell,'bell','ring','shake'],[sedan,'sedan','yield','recoil'],[guard,'guard','wave','hop'],[barrier,'guard','wave','recoil'],[bus,'bus','leave','recoil'],[bin,'bin','rattle','shake']])
    cue(n,{type:'behavior',source,behavior},{motion,sound:'clack',duration:45,strength:.18});
  cue(breakfast,{type:'event',source:'breakfast',event:'placed'},{motion:'squash',sound:'pop',duration:24,strength:.2});
  cue(bowl,{type:'behavior',source:'bowl',behavior:'offer'},{motion:'squash',sound:'clack',duration:24,strength:.15});
  cue(actor,{type:'lost'},{motion:'fall',particles:'dust',sound:'thud',duration:72,hold:true,strength:.5});
  cue(actor,{type:'won'},{motion:'hop',sound:'success',duration:48,strength:.2});
  return scene;
}
