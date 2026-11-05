import {createBusStopScene} from './bus-stop-scene.js';
import {feedbackDefault} from '../content/feedback-presets.js';

export function createScooterScene(){
  const source=createBusStopScene(),scene={background:source.background,assets:[],sounds:[],nodes:[],feedback:[]};
  const add=(id,asset,label,x,y,width,height,layer,extra={})=>scene.nodes.push({id,asset,label,group:label.split(' / ')[0],x,y,width,height,layer,...extra});
  add('scoot-sky','stopAtmosphere','环境 / 晨间街区',0,0,1200,640,-100);
  add('scoot-left','stopCorner','建筑 / 早餐铺',-26,72,350,351,-80);
  add('scoot-center','stopTenement','建筑 / 沿街公寓',328,114,344,309,-79);
  add('scoot-right','scootAlley','建筑 / 住宅小巷与院门',740,36,485,389,-78);
  add('scoot-ground','towGround','街道 / 连续人行道与路缘',0,418,1200,222,-60);
  add('scoot-tree','stopTree','布景 / 树池',382,243,132,210,-45);
  add('scoot-rack','scootBikes','布景 / 院墙边的自行车',564,380,140,73,-39);
  add('scoot-bin','scootBins','布景 / 分类垃圾桶',704,396,70,61,-38);
  add('scoot-posts','scootPosts','巷口 / 固定路桩与空缺',803,456,149,56,15);
  add('scoot-barrier','scootBarrier','路障 / 可移动的一截',-8,-41,96,58,45,{bind:{type:'entity',id:'barrier'}});
  add('scoot-rider','scootRider','骑手 / 叠满货物的电瓶车',-33,-91,154,110,25,{bind:{type:'entity',id:'scooter'},variants:{inactive:{asset:'scootRiderPhone'}}});
  const player=structuredClone(source.nodes.find(n=>n.bind?.type==='actor'));player.id='scoot-player';scene.nodes.push(player);
  scene.feedback=source.feedback.filter(f=>f.target==='stop-player').map(f=>({...f,target:player.id}));
  const cue=(target,trigger,extra)=>scene.feedback.push({...feedbackDefault(target,'scoot-cue-'+scene.feedback.length),trigger,...extra});
  cue('scoot-barrier',{type:'event',source:'barrier',event:'placed'},{motion:'squash',sound:'clack',duration:20,strength:.12});
  cue('scoot-barrier',{type:'event',source:'barrier',event:'droprejected'},{motion:'shake',sound:'clack',duration:18,strength:.12});
  cue('scoot-rider',{type:'behavior',source:'scooter',behavior:'approach'},{motion:'none',sound:'clack',duration:18});
  cue('scoot-rider',{type:'behavior',source:'scooter',behavior:'give-way'},{motion:'recoil',sound:'pop',duration:24,strength:.18});
  return scene;
}
