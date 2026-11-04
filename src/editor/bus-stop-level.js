import {createBusStopScene} from './bus-stop-scene.js';

export const BUS_STOP_PLAN=[{source:'bus',tick:180}];

/** A focused authored encounter. Sequence is ordinary move/moved and behaviors;
 * no renderer, engine or input branch knows about buses or passengers. */
export function createBusStopLevel(){
  const space=(height=0)=>({plane:'street',depth:130,depthSize:20,height});
  const move=(target,x,ticks,height=0)=>({type:'move',target,x,depth:130,height,ticks});
  const set=(target,state)=>({type:'set',target,state});
  const invoke=(target,behavior)=>({type:'invoke',target,behavior});
  const after=(ticks,actions)=>({type:'after',ticks,actions});
  const object=(id,label,x,width,height,extra={})=>({id,label,kind:'object',x,width,height,space:space(),state:'active',...extra});
  const l={schemaVersion:3,id:'commute-bus-stop',name:'上班路 · 末班乘客',
    description:'早高峰的一个公交站。有人排队，有人赶路。',
    hint:'试着让公交打开车门。观察队伍和车门；主角会一直往前走。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:620,depthX:0,depthY:-1},planes:[{id:'street',label:'站台人行道',depth:130,order:0}],start:'start',nodes:[
      {id:'start',x:85,plane:'street',depth:130,height:0,next:'exit'},
      {id:'exit',x:1130,plane:'street',depth:130,height:0}]},
    actor:{x:85,speed:60,space:space()},goal:{x:1130,space:space()},platforms:[{x:20,width:1160,space:space()}],
    entities:[
      object('bus','公交车',680,40,106,{behaviors:[
        {id:'open',label:'开门招呼排队乘客',actions:[set('boarding','inactive'),set('bus','inactive'),invoke('passenger-c','board')]},
        {id:'close',label:'最后一位上车后关门',actions:[after(30,[set('bus','active'),set('depart-ready','active')])]},
        {id:'leave',label:'关门后驶出画面',actions:[set('depart-ready','inactive'),after(18,[move('bus',1240,238)])]}
      ]}),
      object('boarding','是否仍接受开门',680,8,8),
      object('depart-ready','已关门等候驶出',680,8,8,{state:'inactive'}),
      object('passenger-a','队尾的公文包乘客',540,26,60,{contact:{effect:'lethal',message:'撞进了候车队伍。'},behaviors:[{id:'board',label:'队尾走进车门',actions:[move('passenger-a',771,118,7)]}]}),
      object('passenger-b','队伍中间的乘客',580,26,60,{contact:{effect:'lethal',message:'撞进了候车队伍。'},behaviors:[{id:'board',label:'跟上前一位乘客',actions:[move('passenger-b',771,100,7)]}]}),
      object('passenger-c','车门前的乘客',620,26,60,{contact:{effect:'lethal',message:'撞进了候车队伍。'},behaviors:[{id:'board',label:'先上车',actions:[move('passenger-c',771,82,7)]}]}),
      {...object('approach','赶路者接近公交',655,12,8),kind:'zone',state:'enabled'},
    ],rules:[
      {on:{source:'bus',type:'click'},if:[{entity:'boarding',state:'active'}],actions:[invoke('bus','open')]},
      {on:{source:'passenger-c',type:'moved'},actions:[set('passenger-c','inactive'),invoke('passenger-b','board')]},
      {on:{source:'passenger-b',type:'moved'},actions:[set('passenger-b','inactive'),invoke('passenger-a','board')]},
      {on:{source:'passenger-a',type:'moved'},actions:[set('passenger-a','inactive'),invoke('bus','close')]},
      {on:{source:'approach',type:'enter'},if:[{entity:'depart-ready',state:'active'}],actions:[invoke('bus','leave')]},
      {on:{source:'approach',type:'enter'},actions:[set('approach','disabled')]},
      {on:{source:'bus',type:'done',behavior:'close'},if:[{entity:'approach',state:'disabled'},{entity:'depart-ready',state:'active'}],actions:[invoke('bus','leave')]},
    ]};
  l.scene=createBusStopScene(l);return l;
}
