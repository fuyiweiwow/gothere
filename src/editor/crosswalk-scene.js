import {createBusStopScene} from './bus-stop-scene.js';
import {feedbackDefault} from '../content/feedback-presets.js';

export function createCrosswalkScene(){
  const source=createBusStopScene(),scene={background:source.background,assets:[],sounds:[],nodes:[],feedback:[]};
  const add=(id,asset,label,x,y,width,height,layer,extra={})=>scene.nodes.push({id,asset,label,group:label.split(' / ')[0],x,y,width,height,layer,...extra});
  const person=(id,asset,label,entity,x,y,w,h,extra={})=>add(id,asset,label,x,y,w,h,30,{bind:{type:'entity',id:entity},...extra});
  add('cross-sky','stopAtmosphere','环境 / 清晨远城',0,0,1200,640,-100);
  add('cross-left','stopCorner','建筑 / 早餐铺',-26,0,350,351,-80);
  add('cross-middle','stopTenement','建筑 / 沿街公寓',328,40,344,309,-79);
  add('cross-right','stopOfficeBlock','建筑 / 对街楼房',740,18,382,332,-78);
  add('cross-edge','stopTenement','建筑 / 画外延伸',1126,40,344,309,-79);
  add('cross-ground','crossGround','街道 / 两侧路沿与斑马线',0,350,1200,290,-60);
  add('cross-tree-left','stopTree','布景 / 对街树池',210,175,132,210,-45);
  add('cross-umbrella','crossUmbrella','布景 / 执勤遮阳伞',710,218,145,183,-40);
  person('cross-officer','crossOfficerWhistle','交警 / 收起手机吹哨','officer',-14,-69,47,72,{flipX:true,variants:{
    inactive:{asset:'crossOfficerPhone',animation:null},moving:{animation:{frames:['crossOfficerWalk1','crossOfficerWalk2'],fps:8}}}});
  person('cross-walker','crossWalkerPhone','行人 / 低头看手机','jaywalker',-18,-68,44,71,{variants:{
    inactive:{asset:'crossWalkerListen',animation:null},moving:{animation:{frames:['crossWalkerWalk1','crossWalkerWalk2'],fps:7}}}});
  person('cross-signal','crossSignalRed','信号 / 行人灯','signal',-12,-98,30,100,{layer:5,variants:{inactive:{asset:'crossSignalGreen'}}});
  const player=structuredClone(source.nodes.find(n=>n.bind?.type==='actor'));player.id='cross-player';
  player.variants.inward={asset:'crossHeroIn1',animation:{frames:['crossHeroIn1','crossHeroIn2'],fps:8}};
  player.variants['walk-left']={flipX:true};
  scene.nodes.push(player);
  scene.feedback=source.feedback.filter(f=>f.target==='stop-player').map(f=>({...f,target:player.id}));
  const cue=(target,trigger,extra)=>scene.feedback.push({...feedbackDefault(target,'cross-cue-'+scene.feedback.length),trigger,...extra});
  cue('cross-officer',{type:'behavior',source:'officer',behavior:'notice'},{motion:'recoil',sound:'clack',duration:30,strength:.2});
  cue('cross-officer',{type:'event',source:'officer',event:'moved'},{motion:'hop',sound:'pop',duration:20,strength:.15});
  cue('cross-walker',{type:'state',source:'jaywalker',state:'inactive'},{motion:'squash',duration:24,strength:.15});
  cue('cross-signal',{type:'state',source:'signal',state:'inactive'},{motion:'pulse',sound:'clack',duration:24,strength:.08});
  cue('cross-officer',{type:'behavior',source:'officer',behavior:'check-phone'},{motion:'shake',sound:'clack',duration:30,strength:.18});
  cue('cross-walker',{type:'state',source:'jaywalker',state:'active'},{motion:'hop',sound:'pop',duration:24,strength:.12});
  return scene;
}
