import {createBusStopScene} from './bus-stop-scene.js';
import {createTowStreetScene} from './tow-street-scene.js';
import {createCrosswalkScene} from './crosswalk-scene.js';
import {createScooterScene} from './scooter-scene.js';
import {feedbackDefault} from '../content/feedback-presets.js';
import {projectSpace} from '../core/spatial.js';

/** One elevated parallel view: shared ground bands, shallow roofs and constant
 * adult scale. Paving, architecture and performers remain editable resources. */
export function createCommuteChapterScene(level){
  const scene={background:'#d7d3b5',assets:[],sounds:[],nodes:[],feedback:[]};
  const add=(id,asset,label,x,y,width,height,layer=-30,extra={})=>{
    const n={id,asset,label,group:label.split(' / ')[0],x,y,width,height,layer,...extra};scene.nodes.push(n);return n;
  };
  // Preserve screen placement while assigning scenery its authored walk plane.
  const onPlane=(node,plane)=>{
    const depth=level.spatial.planes.find(p=>p.id===plane).depth;
    node.anchor={plane,x:Math.max(0,node.x),depth,height:0};const p=projectSpace(level,node.anchor);
    node.x-=p.x;node.y-=p.y;return node;
  };
  add('chapter-streets','blockStreets','街区 / 同一地面上的三条街',0,0,1200,640,-90);
  // Passage images follow their endpoints. Their local y offset places the
  // actor on the sidewalk; road markings stop at the horizontal carriageway.
  add('chapter-crossing','blockCrossing','通路 / 街角步道与局部斑马线',0,-18,185,114,-85,{bind:{type:'entity',id:'crosswalk'},fitPassage:true});
  add('chapter-junction','blockJunction','通路 / 街角车道延伸',-18,0,114,60,-85,{bind:{type:'entity',id:'crosswalk'}});
  add('chapter-alley','blockAlley','通路 / 建筑间的等宽窄巷',0,-20,175,96,-85,{bind:{type:'entity',id:'alley'},fitPassage:true});
  // The roofs finish below the next walking baseline. Different storefront
  // widths and awnings add variation without changing that ground relationship.
  for(const [row,y,blocks]of [
    ['near',424,[[-22,221,'blockShutter'],[195,215,'blockShop'],[407,207,'blockShop'],[610,188,'blockShutter'],[794,191,'blockShop'],[1150,200,'blockShutter']]],
    ['middle',239,[[-25,135,'blockShutter'],[245,245,'blockBreakfast'],[487,240,'blockShop'],[724,261,'blockShutter'],[1150,200,'blockShop']]],
  ])for(const [i,[x,w,asset]]of blocks.entries())add('chapter-shop-'+row+'-'+i,asset,'建筑 / '+(row==='near'?'前街店面':'早餐街店面'),x,y,w,120,-75);
  for(const [i,[x,w]]of [[-25,222],[199,218],[419,222],[643,215],[862,178]].entries())
    add('chapter-far-building-'+i,'blockApartment','建筑 / 外街公寓',x,2,w,180,-76);
  add('chapter-office','blockOffice','终点 / 公司外门',-69,-199,159,208,-74,{bind:{type:'goal'}});
  add('chapter-office-clock','commuteClock','终点 / 门外时钟',-12,-172,20,20,-65,{bind:{type:'goal'}});
  onPlane(add('chapter-shelter','blockShelter','站台 / 轻薄候车亭',301,486,133,90,-40),'front');
  onPlane(add('chapter-umbrella','crossUmbrella','路口 / 执勤遮阳伞',1137,301,63,80,-40),'middle');
  add('chapter-alley-posts','chapterPosts','窄巷 / 人行空隙与路桩',-76,-33,151,39,15,{bind:{type:'entity',id:'gap'}});
  for(const [id,x,y,plane]of [['a',52,366,'middle'],['b',929,366,'middle'],['c',875,551,'front'],['d',271,191,'far'],['e',993,191,'far']])
    onPlane(add('chapter-tree-'+id,'stopTree','布景 / 街角树池',x,y-89,57,91,-32),plane);
  for(const [id,x,y,plane]of [['a',270,359,'middle'],['b',785,544,'front'],['c',548,184,'far']])onPlane(add('chapter-bikes-'+id,'scootBikes','布景 / 靠墙自行车',x,y,61,32,-31),plane);
  for(const [id,x,y,plane]of [['a',15,542,'front'],['b',949,357,'middle'],['c',372,182,'far']])onPlane(add('chapter-bin-'+id,'scootBins','布景 / 店边垃圾桶',x,y,30,26,-31),plane);

  // A nearer building may hide a road vehicle behind its roof edge. This is
  // authored plane ownership, not a renderer exception for vehicles.
  for(const n of scene.nodes.filter(n=>n.id.startsWith('chapter-shop-'))){
    onPlane(n,n.id.includes('-near-')?'front':'middle');
  }

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
  const door=scene.nodes.find(n=>n.id==='stop-door');
  scene.nodes=scene.nodes.filter(n=>n.id!==door.id);scene.feedback=scene.feedback.filter(f=>f.target!==door.id);
  scene.nodes.find(n=>n.id==='stop-bus').asset='blockBusBack';
  copy(createTowStreetScene(level),['caller','car','tow','owner']);
  copy(createCrosswalkScene(),['officer','jaywalker','signal']);
  copy(createScooterScene(),['barrier']);
  const barrier=scene.nodes.find(n=>n.bind?.id==='barrier');Object.assign(barrier,{x:0,y:-29,width:62,height:38,layer:45});
  const car=scene.nodes.find(n=>n.id==='tow-car');Object.assign(car,{x:-12,y:-53,width:150,height:60});car.variants.inactive.y=-53;
  Object.assign(scene.nodes.find(n=>n.id==='tow-truck'),{x:60,y:-69,width:190,height:71});
  add('chapter-rider','blockRider','骑手 / 窄巷来车',17,-48,37,50,25,{bind:{type:'entity',id:'scooter'},variants:{
    inactive:{asset:'scootRiderPhone',x:4,y:-41,width:62,height:44}}});
  add('chapter-food','streetBreakfast','外街 / 可拖放的早餐',-2,-23,25,26,45,{bind:{type:'entity',id:'breakfast'},variants:{inactive:{asset:'blockMeal',x:5,y:-13,width:20,height:8}}});
  add('chapter-bowl','streetBowl','外街 / 狗碗',-1,-9,31,12,44,{bind:{type:'entity',id:'bowl'}});
  add('chapter-dog','streetDog','外街 / 守路与吃早餐的狗',-3,-32,48,35,40,{bind:{type:'entity',id:'dog'},variants:{inactive:{rotation:12,y:-28}}});
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
