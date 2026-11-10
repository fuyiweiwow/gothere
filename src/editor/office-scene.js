import {commuterVisual,commuterFeedback} from './commuter-presentation.js';
import {feedbackDefault} from '../content/feedback-presets.js';

/** One room first, then editable performers and state images on its two planes. */
export function createOfficeScene(level){
  const scene={background:'#e9dfc9',assets:[],sounds:[],nodes:[],feedback:[]};
  const add=(id,asset,label,x,y,width,height,layer,extra={})=>{
    const node={id,asset,label,group:label.split(' / ')[0],x,y,width,height,layer,...extra};scene.nodes.push(node);return node;
  };
  const bind=id=>({type:'entity',id});
  const on=(id,asset,label,entity,x,y,width,height,layer,extra={})=>add(id,asset,label,x,y,width,height,layer,{bind:bind(entity),...extra});
  add('office-room','officeLobby','建筑 / 门厅与连续走廊',0,0,1200,640,-90);
  add('office-entrance-mat','officeMat','布景 / 入门地垫',75,506,134,40,-70);
  add('office-left-plant','officePlant','布景 / 落地盆栽',64,215,57,65,-60);
  add('office-clock','commuteClock','布景 / 门厅挂钟',306,91,54,54,-60);
  on('office-door','officeDoorClosed','入口 / 玻璃门','door',-17,-141,92,144,28,{variants:{inactive:{asset:'officeDoorOpen'}}});
  on('office-door-threshold','officeThreshold','入口 / 防撞胶条','door-gap',-2,-2,62,12,2);
  on('office-parcel','officeParcel','物品 / 纸箱与吸水纸板','parcel',0,-42,59,50,40,{variants:{inactive:{asset:'officeCardboard',x:-4,y:-5,width:143,height:20}}});
  on('office-water','officePuddle','饮水 / 通道积水','wet-floor',-16,-9,169,35,0,{variants:{inactive:{visible:false}}});
  on('office-dispenser','officeWaterOn','饮水 / 出水开关','dispenser',-7,-109,64,115,15,{variants:{inactive:{asset:'officeWaterOff'}}});
  on('office-courier','officeCourier','送货 / 推着盆栽的师傅','courier',-24,-67,87,77,34,{flipWithDirection:true,variants:{inactive:{visible:false},moving:{animation:{frames:['officeCourier','officeCourierStep'],fps:6}}}});
  on('office-guard','toonCrossOfficerPhone','保安 / 看手机与欢迎盆栽','guard',-15,-67,47,70,32,{variants:{inactive:{asset:'officeGuardWelcome'}}});
  on('office-reader','officeReader','考勤 / 人脸识别摄像头','reader',-10,-78,48,81,25,{variants:{inactive:{asset:'officeReaderGreen'}}});
  // The destination has its own ordinary art binding, rather than a debug goal.
  add('office-arrival-mark','commuteBadge','考勤 / 识别位置',-13,-7,25,15,1,{bind:{type:'goal'},opacity:.4});
  const player=commuterVisual('office-player',64);scene.nodes.push(player);scene.feedback.push(...commuterFeedback(player.id));
  const cue=(target,trigger,extra)=>scene.feedback.push({...feedbackDefault(target,'office-cue-'+scene.feedback.length),trigger,...extra});
  cue('office-door',{type:'state',source:'door',state:'inactive'},{label:'门被撑开',motion:'none',sound:'clack',duration:12,volume:.12});
  cue('office-parcel',{type:'event',source:'parcel',event:'placed'},{label:'纸箱落点',motion:'squash',sound:'thud',duration:16,strength:.08,volume:.12});
  cue('office-dispenser',{type:'behavior',source:'dispenser',behavior:'close'},{label:'拧紧水龙头',motion:'none',sound:'clack',duration:12,volume:.1});
  cue('office-water',{type:'lost',cause:'wet-floor'},{label:'踩水打滑',motion:'none',particles:'spark',count:7,color:'#95c4c7',anchor:{x:.5,y:.5},direction:-90,sound:'puff',duration:24,strength:.15});
  cue('office-reader',{type:'state',source:'reader',state:'inactive'},{label:'盆栽也识别通过',motion:'pulse',sound:'pop',duration:36,strength:.08,volume:.14});
  scene.compositions=[
    {id:'office-setting',label:'公司门厅整体布景',origin:{x:0,y:0},nodes:scene.nodes.filter(n=>!n.bind).map(n=>n.id),entities:[]},
    ...level.spatial.planes.map(p=>({id:'office-'+p.id,label:p.label,origin:{x:0,y:620-p.depth},
      nodes:scene.nodes.filter(n=>n.bind?.type==='entity'&&level.entities.find(e=>e.id===n.bind.id)?.space.plane===p.id).map(n=>n.id),
      entities:level.entities.filter(e=>e.space.plane===p.id).map(e=>e.id)})),
  ];
  return scene;
}
