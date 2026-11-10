import {createBusStopLevel} from './bus-stop-level.js';

const frames=(prefix,count)=>Array.from({length:count},(_,i)=>prefix+(i+1));

/** A separate, unapproved art study. The street/road relationship is ordinary
 * authored space data; the renderer and the original chapter stay unchanged. */
export function createPaintedBusStopLevel(){
  const level=createBusStopLevel(),scene=level.scene;
  level.id='commute-painted-bus-stop';level.name='公交站 · 手绘素材试作';
  const road={id:'bus-road',label:'站台前的公交车道',depth:40,order:1};
  level.spatial.planes.push(road);
  const bus=level.entities.find(e=>e.id==='bus');
  bus.space={...bus.space,plane:road.id,depth:road.depth};
  const roadMoves=actions=>{
    for(const action of actions){
      if(action.type==='after')roadMoves(action.actions);
      else if(action.type==='move'&&action.target===bus.id)action.depth=road.depth;
    }
  };
  for(const behavior of bus.behaviors)roadMoves(behavior.actions);
  const node=id=>scene.nodes.find(n=>n.id===id);
  const image=(id,asset,x,y,width,height)=>Object.assign(node(id),{asset,x,y,width,height});
  scene.background='#e1e1cc';
  image('stop-sky','paintedBusSky',0,0,1200,442);
  image('stop-left','paintedBusCorner',0,85.7,320,356);
  image('stop-middle','paintedBusTenement',328.1,128.2,328,314);
  image('stop-right','paintedBusOffice',704.3,103.3,371,338);
  image('stop-right-edge','paintedBusEdge',1081.6,129.4,118,312);
  image('stop-ground','paintedBusGround',0,442,1200,198);
  image('stop-tree-left','paintedBusTree',270,254,146,198);
  image('stop-tree-right','paintedBusTree',1060,254,146,198);
  image('stop-shelter','paintedBusShelter',500,320,245,166);
  // Tires rest on the road below the curb. Boarding happens behind the bus;
  // neither a door overlay nor a dark painted doorway faces this camera.
  image('stop-bus','paintedBusBack',-18,-151,365,151);
  scene.nodes=scene.nodes.filter(n=>!['stop-foreground','stop-door'].includes(n.id));
  for(const cue of scene.feedback.filter(f=>f.target==='stop-door')){
    cue.target='stop-bus';cue.motion='none';
  }
  for(const cue of scene.feedback.filter(f=>f.target==='stop-bus'))cue.motion='none';

  // All character images use a common square canvas with foot origin (96,180).
  // The visible body is 144px high; transparent padding also holds falling poses.
  const body=(n,id,height)=>{
    const size=height*192/144;
    Object.assign(n,{asset:id+'Idle',x:-size/2,y:-size*180/192,width:size,height:size});
  };
  const hero=node('stop-player');body(hero,'paintedHero',70);
  hero.animation={frames:frames('paintedHeroWalk',8),fps:10,stride:.58};
  hero.variants={
    'walk-left':{},'walk-right':{},
    lost:{asset:'paintedHeroFall6',animation:null},
    won:{asset:'paintedHeroIdle',animation:null},
  };
  for(const [suffix,letter]of [['a','A'],['b','B'],['c','C']]){
    const person=node('stop-person-'+suffix),prefix='paintedPassenger'+letter;
    body(person,prefix,66);
    person.flipWithDirection=true;
    // Existing durations cover different walking distances. Pick the cadence
    // from each move rather than forcing all passengers to take identical steps.
    const entity=level.entities.find(e=>e.id==='passenger-'+suffix),move=entity.behaviors[0].actions[0];
    const speed=(move.x-entity.x)*60/move.ticks;
    person.variants={inactive:{visible:false},moving:{animation:{frames:frames(prefix+'Walk',4),fps:speed/45*4}}};
  }
  for(const cue of scene.feedback){
    if(cue.target===hero.id){
      if(cue.animation)cue.animation={frames:frames('paintedHeroFall',6),fps:10};
      if(cue.id.endsWith('-landing')){cue.delay=30;cue.anchor={x:.5,y:180/192};}
    }else if(cue.id.startsWith('queue-')){
      // No old-style animation may override the new characters on contact.
      delete cue.animation;cue.motion=cue.id.endsWith('-shove')?'recoil':'none';cue.hold=false;cue.strength=.09;
    }
  }
  for(const group of scene.compositions)group.nodes=group.nodes.filter(id=>scene.nodes.some(n=>n.id===id));
  const encounter=scene.compositions.find(c=>c.id==='stop-encounter');
  encounter.nodes=encounter.nodes.filter(id=>id!=='stop-bus');
  encounter.entities=encounter.entities.filter(id=>id!=='bus');
  scene.compositions.push({id:'stop-road-vehicle',label:'车道 / 公交车',origin:{x:680,y:580},nodes:['stop-bus'],entities:['bus']});
  return level;
}
