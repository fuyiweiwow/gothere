import {feedbackDefault} from '../content/feedback-presets.js';

const frames=(prefix,count)=>Array.from({length:count},(_,i)=>prefix+(i+1));

/** Authored hero artwork and shared clips. This creates ordinary editable data. */
export function commuterVisual(id='stop-player',height=70){
  return {id,asset:'toonCommuterIdle',label:'角色 / 戴厚镜片的赶路职员',group:'角色',bind:{type:'actor'},
    x:-height*56/96,y:-height*90/96,width:height*112/96,height,layer:35,flipWithDirection:true,
    animation:{frames:frames('toonCommuterWalkCycle',12),fps:12,stride:.75},variants:{
      'walk-left':{},'walk-right':{},inward:{animation:{frames:frames('toonCommuterInCycle',12),fps:12,stride:.4},flipWithDirection:false},
      outward:{animation:{frames:frames('toonCommuterOutCycle',12),fps:12,stride:.4},flipWithDirection:false},
      lost:{asset:'toonCommuterDrop1',animation:null},won:{asset:'toonCommuterIdle',animation:null}}};
}

export function commuterFeedback(player){
  const cue=(id,trigger,options)=>({...feedbackDefault(player,id),trigger,...options});
  return [
    cue(player+'-stagger',{type:'lost'},{label:'受击失衡到倒地',motion:'none',animation:{frames:frames('toonCommuterDrop',8),fps:10},duration:60,hold:true}),
    cue(player+'-impact',{type:'lost',reason:'hurt'},{label:'接触时短促声音',motion:'none',sound:'clack',delay:6,duration:6,volume:.12}),
    cue(player+'-landing',{type:'lost'},{label:'身体落地后扬尘',motion:'none',particles:'dust',sound:'thud',delay:38,duration:18,anchor:{x:.42,y:.9375},count:7,strength:.18,volume:.16}),
    cue(player+'-arrival',{type:'won'},{label:'终于到了',motion:'hop',sound:'success',duration:40,strength:.15}),
  ];
}

export function queueFeedback(){
  return ['a','b','c'].flatMap(suffix=>{
    const prefix='queue'+suffix.toUpperCase(),target='stop-person-'+suffix;
    const cue=(id,trigger,options)=>({...feedbackDefault(target,id),trigger,...options});
    return [
      cue('queue-'+suffix+'-notice',{type:'event',source:'queue-approach',event:'enter'},{label:'留意挤进来的赶路者',motion:'none',animation:{frames:frames(prefix+'Ready',4),fps:8},duration:36}),
      cue('queue-'+suffix+'-shove',{type:'lost',cause:'passenger-'+suffix},{label:'接触后伸臂挤开',motion:'none',animation:{frames:frames(prefix+'Shove',6),fps:12},duration:36,hold:true}),
    ];
  });
}
