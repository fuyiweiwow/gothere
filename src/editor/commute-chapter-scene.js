import {createBusStopScene} from './bus-stop-scene.js';
import {createTowStreetScene} from './tow-street-scene.js';
import {createCrosswalkScene} from './crosswalk-scene.js';
import {createScooterScene} from './scooter-scene.js';
import {feedbackDefault} from '../content/feedback-presets.js';

/** The whole block is recomposed at a common scale. The large pavement is a
 * resource; architecture, performers and props remain independent editor nodes. */
export function createCommuteChapterScene(level){
  const scene={background:'#d7d3b5',assets:[],sounds:[],nodes:[],feedback:[]};
  const add=(id,asset,label,x,y,width,height,layer=-30,extra={})=>{
    const n={id,asset,label,group:label.split(' / ')[0],x,y,width,height,layer,...extra};scene.nodes.push(n);return n;
  };
  add('chapter-sky','stopAtmosphere','街区 / 清晨远城',0,-40,1200,640,-100);
  add('chapter-streets','chapterStreets','街区 / 三条道路与两个连接口',0,0,1200,640,-90);
  add('chapter-crossing','chapterCrossing','通路 / 向里过街的斑马线',0,7,185,132,-30,{bind:{type:'entity',id:'crosswalk'},fitPassage:true,passageView:{endScale:.8}});
  add('chapter-alley','chapterAlley','通路 / 紧凑的内外窄巷',0,32,175,128,-30,{bind:{type:'entity',id:'alley'},fitPassage:true,passageView:{endScale:.8}});
  // Shop rows are deliberately separated from the passages. Their rooflines
  // finish below the previous street, so the protagonist is never hidden.
  for(const [row,y,blocks]of [
    ['near',438,[[0,180],[185,165],[356,178],[540,145],[690,154],[850,136],[1140,150]]],
    ['middle',258,[[0,110],[265,150],[420,175],[600,165],[770,162],[1148,160]]],
  ])for(const [i,[x,w]]of blocks.entries())add('chapter-shop-'+row+'-'+i,i===2?'chapterBreakfast':'chapterShop','建筑 / '+(row==='near'?'前街店面':'早餐街店面'),x,y,w,105,-75);
  for(const [i,[x,asset,w,h]]of [[0,'stopTenement',160,144],[170,'stopOfficeBlock',177,154],[352,'stopCorner',154,154],[511,'stopTenement',160,144],[676,'stopOfficeBlock',176,154],[860,'stopTenement',158,142]].entries())
    add('chapter-far-building-'+i,asset,'建筑 / 外街楼房',x,170-h,w,h,-76);
  add('chapter-office','chapterOffice','终点 / 公司外门',1042,64,150,151,-74);
  add('chapter-office-clock','commuteClock','终点 / 门外时钟',1096,89,23,23,-65);
  add('chapter-shelter','stopShelter','站台 / 候车亭',305,451,113,126,-40);
  add('chapter-umbrella','crossUmbrella','路口 / 执勤遮阳伞',1094,267,102,128,-40);
  add('chapter-alley-posts','chapterPosts','窄巷 / 人行空隙与路桩',-76,-33,151,39,15,{bind:{type:'entity',id:'gap'}});
  for(const [id,x,y]of [['a',70,355],['b',911,354],['c',861,540],['d',267,169],['e',1001,169]])
    add('chapter-tree-'+id,'stopTree','布景 / 街角树池',x,y-80,64,102,-32);
  for(const [id,x,y]of [['a',272,327],['b',726,517],['c',548,171]])add('chapter-bikes-'+id,'scootBikes','布景 / 靠墙自行车',x,y,78,41,-31);
  for(const [id,x,y]of [['a',15,530],['b',932,345],['c',372,172]])add('chapter-bin-'+id,'scootBins','布景 / 店边垃圾桶',x,y,38,33,-31);

  // Reuse the tested encounter performers and feedback, not their full-width backgrounds.
  const copy=(source,entities,scale=.72)=>{
    const ids=new Set();for(const n of source.nodes.filter(n=>n.bind?.type==='entity'&&entities.includes(n.bind.id))){
      const out=structuredClone(n);for(const k of ['x','y','width','height'])out[k]*=scale;
      for(const v of Object.values(out.variants??{}))for(const k of ['x','y','width','height'])if(v[k]!==undefined)v[k]*=scale;
      scene.nodes.push(out);ids.add(out.id);
    }
    scene.feedback.push(...source.feedback.filter(f=>ids.has(f.target)));
  };
  copy(createBusStopScene(),['bus','passenger-a','passenger-b','passenger-c']);
  copy(createTowStreetScene(level),['caller','car','tow','owner']);
  copy(createCrosswalkScene(),['officer','jaywalker','signal']);
  copy(createScooterScene(),['barrier']);
  const barrier=scene.nodes.find(n=>n.bind?.id==='barrier');Object.assign(barrier,{x:0,y:-29,width:62,height:38,layer:45});
  const car=scene.nodes.find(n=>n.id==='tow-car');car.variants.inactive.y=-47;
  add('chapter-rider','streetScooterFront','骑手 / 窄巷来车',12,-58,47,63,25,{bind:{type:'entity',id:'scooter'},variants:{
    inactive:{asset:'scootRiderPhone',x:7,y:-51,width:76,height:55}}});
  add('chapter-food','streetBreakfast','外街 / 可拖放的早餐',-2,-23,25,26,45,{bind:{type:'entity',id:'breakfast'}});
  add('chapter-bowl','streetBowl','外街 / 狗碗',-1,-9,31,12,15,{bind:{type:'entity',id:'bowl'}});
  add('chapter-dog','streetDog','外街 / 守路与吃早餐的狗',-3,-32,48,35,25,{bind:{type:'entity',id:'dog'},variants:{inactive:{rotation:8,y:-28}}});
  add('chapter-commuter','stopPassengerBIdle','外街 / 也在赶路的人',-10,-49,31,50,30,{bind:{type:'entity',id:'commuter'},variants:{
    inactive:{visible:false},moving:{animation:{frames:['stopPassengerBIdle','stopPassengerBWalk'],fps:8}}}});
  const player=structuredClone(createCrosswalkScene().nodes.find(n=>n.bind?.type==='actor'));
  Object.assign(player,{id:'chapter-player',x:-13,y:-49,width:31,height:50});scene.nodes.push(player);
  const cue=(target,trigger,extra)=>scene.feedback.push({...feedbackDefault(target,'chapter-cue-'+scene.feedback.length),trigger,...extra});
  cue(player.id,{type:'lost'},{motion:'fall',particles:'dust',sound:'thud',duration:70,hold:true,strength:.6});
  cue(player.id,{type:'won'},{motion:'hop',sound:'success',duration:40,strength:.15});
  cue('chapter-rider',{type:'behavior',source:'scooter',behavior:'give-way'},{motion:'recoil',sound:'pop',duration:24,strength:.16});
  cue('chapter-food',{type:'event',source:'breakfast',event:'placed'},{motion:'hop',sound:'pop',duration:20,strength:.12});
  scene.compositions=[
    {id:'chapter-setting',label:'街区总构图',origin:{x:0,y:0},nodes:scene.nodes.filter(n=>!n.bind).map(n=>n.id),entities:[]},
    ...[['front','公交站'],['middle','早餐街'],['far','公司外街']].map(([plane,label])=>({id:'chapter-'+plane,label,
      origin:{x:0,y:620-level.spatial.planes.find(p=>p.id===plane).depth},
      nodes:scene.nodes.filter(n=>n.bind?.type==='entity'&&level.entities.find(e=>e.id===n.bind.id)?.space.plane===plane).map(n=>n.id),
      entities:level.entities.filter(e=>e.space.plane===plane).map(e=>e.id)})),
  ];
  return scene;
}
