import {createBusStopScene} from './bus-stop-scene.js';
import {feedbackDefault} from '../content/feedback-presets.js';

export function createTowStreetScene(level){
  const source=createBusStopScene(),scene={background:source.background,assets:[],sounds:[],nodes:[],feedback:[]};
  const keep=['stop-sky','stop-left','stop-middle','stop-right','stop-right-edge','stop-ground','stop-tree-left','stop-tree-right','stop-foreground'];
  scene.nodes=source.nodes.filter(n=>keep.includes(n.id));
  const ground=scene.nodes.find(n=>n.id==='stop-ground');ground.asset='towGround';ground.label='街道 / 连续铺面与窄路沿';
  const right=scene.nodes.find(n=>n.id==='stop-right');right.asset='stopCorner';right.label='建筑 / 街角早点铺';right.x=828;right.y=72;right.width=350;right.height=351;
  scene.nodes=scene.nodes.filter(n=>!['stop-tree-right','stop-right-edge'].includes(n.id));
  const add=(id,asset,label,bind,x,y,width,height,layer,extra={})=>scene.nodes.push({id,asset,label,group:label.split(' / ')[0],bind:{type:bind==='actor'?'actor':'entity',...(bind==='actor'?{}:{id:bind})},x,y,width,height,layer,...extra});
  add('tow-caller','towCallerAngry','路人 / 指着挡路的车','caller',-12,-68,45,73,30,{animation:{frames:['towCallerAngry','towCallerPoint'],fps:2},variants:{inactive:{asset:'towCallerPhone',animation:null}}});
  add('tow-car','towCar','车辆 / 占道私家车','car',-34,-78,255,101,20,{flipX:true,variants:{inactive:{rotation:-3,y:-65}}});
  add('tow-truck','towTruck','清障 / 拖车','tow',100,-111,310,116,10,{flipX:true,variants:{inactive:{visible:false},moving:{animation:{frames:['towTruck','towTruckRoll'],fps:8}}}});
  add('tow-owner','towOwnerIdle','车主 / 端着早饭追车','owner',-13,-70,45,73,35,{variants:{inactive:{visible:false},moving:{animation:{frames:['towOwnerIdle','towOwnerRun'],fps:9}}}});
  const player=source.nodes.find(n=>n.bind?.type==='actor');scene.nodes.push(player);
  scene.feedback.push(...source.feedback.filter(f=>f.target===player.id));
  const cue=(target,trigger,extra)=>scene.feedback.push({...feedbackDefault(target,'tow-cue-'+scene.feedback.length),trigger,...extra});
  cue('tow-caller',{type:'behavior',source:'caller',behavior:'call'},{motion:'hop',sound:'clack',duration:24,strength:.15});
  cue('tow-truck',{type:'behavior',source:'tow',behavior:'approach'},{motion:'none',sound:'puff',duration:36,strength:.1});
  cue('tow-car',{type:'behavior',source:'car',behavior:'lift'},{motion:'shake',sound:'clack',duration:48,strength:.2});
  cue('tow-owner',{type:'state',source:'owner',state:'active'},{motion:'hop',sound:'pop',duration:24,strength:.15});
  scene.compositions=[
    {id:'tow-backdrop',label:'清晨店铺与路边',origin:{x:0,y:0},nodes:scene.nodes.filter(n=>!n.bind).map(n=>n.id),entities:[]},
    {id:'tow-sidewalk',label:'占道、打电话和追车',origin:{x:630,y:490},nodes:['tow-caller','tow-car','tow-owner'],entities:level.entities.filter(e=>e.space.plane==='street').map(e=>e.id)},
    {id:'tow-road',label:'路边拖车',origin:{x:1170,y:535},nodes:['tow-truck'],entities:['tow']},
  ];
  return scene;
}
