import {feedbackDefault} from '../content/feedback-presets.js';

/** Art direction is data, composed from broad continuous environment pieces,
 * editable architecture and small independently animated performers. */
export function createBusStopScene(){
  const scene={background:'#d7d3b5',assets:[],nodes:[],feedback:[],sounds:[]};
  const add=(id,asset,label,x,y,width,height,layer,extra={})=>{const n={id,asset,label,group:label.split(' / ')[0],x,y,width,height,layer,...extra};scene.nodes.push(n);return n;};
  const actor=(id,asset,label,target,x,y,w,h,layer=20,extra={})=>add(id,asset,label,x,y,w,h,layer,{bind:{type:target==='actor'?'actor':'entity',...(target==='actor'?{}:{id:target})},...extra});
  add('stop-sky','stopAtmosphere','环境 / 晨雾与远城',0,0,1200,640,-100);
  add('stop-left','stopCorner','建筑 / 转角早餐铺',-26,72,350,351,-80);
  add('stop-middle','stopTenement','建筑 / 老公寓',328,114,344,309,-79);
  add('stop-right','stopOfficeBlock','建筑 / 街角办公楼',740,91,382,332,-78);
  add('stop-right-edge','stopTenement','建筑 / 画外延伸',1126,114,344,309,-79);
  add('stop-ground','stopGround','街道 / 连续铺面与路缘',0,418,1200,222,-60);
  add('stop-tree-left','stopTree','布景 / 路边树池',267,243,132,210,-45);
  add('stop-tree-right','stopTree','布景 / 街角树池',1063,238,132,210,-44);
  add('stop-shelter','stopShelter','站台 / 透视候车亭',420,301,163,184,-40);
  // Same plane: body below people; door leaf overlays their final step.
  actor('stop-bus','stopBus','公交 / 车身','bus',0,-113,365,132,10);
  for(const [suffix,asset]of [['a','stopPassengerA'],['b','stopPassengerB'],['c','stopPassengerC']]){
    actor('stop-person-'+suffix,asset+'Idle','乘客 / '+suffix,'passenger-'+suffix,-9,-65,43,70,20,{variants:{inactive:{visible:false},moving:{animation:{frames:[asset+'Idle',asset+'Walk'],fps:8}}}});
  }
  actor('stop-door','stopBusDoor','公交 / 门扇','bus',75,-95,43,94,25,{variants:{inactive:{width:8,opacity:.85}}});
  actor('stop-player','stopWorkerWalk','角色 / 赶路职员','actor',-19,-68,43,70,35,{animation:{frames:['stopWorkerIdle','stopWorkerWalk'],fps:7},variants:{
    lost:{asset:'stopWorkerIdle',animation:null},won:{asset:'stopWorkerIdle',animation:null}}});
  add('stop-foreground','stopPole','前景 / 裁切路灯',-11,453,110,180,90);
  const cue=(target,trigger,extra)=>scene.feedback.push({...feedbackDefault(target,'stop-feedback-'+scene.feedback.length),trigger,...extra});
  cue('stop-door',{type:'behavior',source:'bus',behavior:'open'},{motion:'squash',sound:'clack',duration:24,strength:.15});
  cue('stop-door',{type:'state',source:'bus',state:'active'},{motion:'recoil',sound:'clack',duration:18,strength:.2});
  cue('stop-bus',{type:'behavior',source:'bus',behavior:'leave'},{motion:'recoil',sound:'puff',duration:40,strength:.12});
  cue('stop-player',{type:'lost'},{motion:'fall',particles:'dust',sound:'thud',duration:70,hold:true,strength:.6});
  cue('stop-player',{type:'won'},{motion:'hop',sound:'success',duration:40,strength:.15});
  scene.compositions=[
    {id:'stop-background',label:'晨间街景 · 背景',origin:{x:0,y:0},nodes:scene.nodes.filter(n=>!n.bind).map(n=>n.id),entities:[]},
    {id:'stop-encounter',label:'公交与候车队伍',origin:{x:680,y:490},nodes:scene.nodes.filter(n=>n.bind?.type==='entity').map(n=>n.id),entities:['bus','boarding','depart-ready','passenger-a','passenger-b','passenger-c','approach']},
  ];
  return scene;
}
