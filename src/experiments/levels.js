const set=(target,state)=>({type:'set',target,state});
const invoke=(target,behavior)=>({type:'invoke',target,behavior});
const defer=actions=>({type:'after',ticks:1,actions});
const rule=(source,type,actions,conditions)=>({on:{source,type},...(conditions?{if:conditions}:{}),actions});
const when=(entity,state)=>[{entity,state}];
const rotate=(target,angle,ticks=45)=>({type:'rotate',target,angle,ticks});

function base(id,name,description,actor,goal,platforms){
  return {schemaVersion:1,id,name,description,
    hint:'可以暂停、单步或重置。地图和右侧的物体按钮均可操作；返回编辑后可修改几何、行为与连线。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    actor:{...actor,speed:60,direction:1,maxLandingSpeed:240},goal,platforms,entities:[],rules:[]};
}

function returnRoute(){
  const angle=Math.atan2(150,200)*180/Math.PI;
  const level=base('experiment-return-route','回来的路',
    '目的地就在身后，不过得先绕一圈。右侧有一条向下的通道；同一块活动路面，能接上哪一层？',
    {x:100,y:260},{x:60,y:260},[
      {x:30,y:260,width:170},{x:450,y:260,width:250},{x:400,y:410,width:300},
    ]);
  level.entities=[
    {id:'return-beam',kind:'object',label:'活动路面',x:200,y:260,width:250,height:16,state:'active',
      pose:{angle,pivot:0},surface:{enabled:true},behaviors:[
        {id:'flatten',label:'放平',actions:[rotate('return-beam',0),defer([set('return-beam','inactive')])]},
        {id:'incline',label:'倾斜',actions:[rotate('return-beam',angle),defer([set('return-beam','active')])]},
      ]},
    {id:'down-passage',kind:'object',label:'下行通道',x:660,y:410,width:24,height:24,state:'active',
      transport:{type:'vertical',toY:260,speed:100,upperDirection:-1,lowerDirection:-1}},
  ];
  level.rules=[
    rule('return-beam','click',[invoke('return-beam','flatten')],when('return-beam','active')),
    rule('return-beam','click',[invoke('return-beam','incline')],when('return-beam','inactive')),
  ];
  return {id:'return-route',kind:'原创小关',level,
    summary:'去程和返程复用同一物体，连接关系随姿态变化。',
    help:'先接通上层去程，等人物离开活动路面，再让它接到下层返程。不必卡某一帧。',
    plan:[{source:'return-beam',tick:30,label:'放平活动路面'},{source:'return-beam',tick:500,label:'倾斜活动路面，接回下层'}]};
}

function liftHandoff(){
  const level=base('experiment-lift-handoff','两次交接',
    '一只调度开关，两座升降台。人物持续前进，不会停在缺口前等车；到顶层后会转身。',
    {x:100,y:500},{x:100,y:200},[
      {x:30,y:500,width:270},{x:380,y:350,width:400},{x:80,y:200,width:780},
    ]);
  level.entities=[
    {id:'dispatcher',kind:'object',label:'调度开关',x:540,y:500,width:40,height:48,state:'inactive',behaviors:[
      {id:'supply-left',label:'接通左台',actions:[defer([set('dispatcher','active')])]},
      {id:'supply-right',label:'接通右台',actions:[defer([set('dispatcher','inactive')])]},
    ]},
    {id:'left-car',kind:'lift',label:'左升降台',x:300,y:500,toY:350,width:80,speed:90,state:'lower',upperDirection:1,
      behaviors:[{id:'up',label:'上升',actions:[set('left-car','upper')]}]},
    {id:'right-car',kind:'lift',label:'右升降台',x:780,y:350,toY:200,width:80,speed:90,state:'lower',upperDirection:-1,
      behaviors:[{id:'up',label:'上升并折返',actions:[set('right-car','upper')]}]},
  ];
  level.rules=[
    rule('dispatcher','click',[invoke('dispatcher','supply-left')],when('dispatcher','inactive')),
    rule('dispatcher','click',[invoke('dispatcher','supply-right')],when('dispatcher','active')),
    rule('left-car','board',[invoke('left-car','up')],when('dispatcher','active')),
    rule('right-car','board',[invoke('right-car','up')],when('dispatcher','inactive')),
  ];
  return {id:'lift-handoff',kind:'机制灰盒 · 跨层运输',level,
    summary:'提炼施工片段的跨层交接与折返；同一个开关调度两座平台。',
    help:'接通左台让人物完成第一次上升，再切换到右台。开关 active 接左台，inactive 接右台。',
    plan:[{source:'dispatcher',tick:30,label:'接通左台'},{source:'dispatcher',tick:500,label:'改接右台'}]};
}

function poseSupport(){
  const level=base('experiment-pose-support','换个姿势',
    '缺口里有一件歪着的危险物。它的姿态、接触伤害与承托是独立能力，可以由同一个行为改变。',
    {x:100,y:400},{x:880,y:400},[{x:30,y:400,width:390},{x:600,y:400,width:330}]);
  level.entities=[
    {id:'tilting-object',kind:'object',label:'可变姿态物体',x:420,y:400,width:180,height:24,state:'active',
      pose:{angle:-50,pivot:0},surface:{enabled:true},contact:{effect:'lethal',message:'碰到了仍有危险的物体。'},
      behaviors:[{id:'settle',label:'停稳并放平',actions:[set('tilting-object','inactive'),rotate('tilting-object',0,60)]}]},
  ];
  level.rules=[rule('tilting-object','click',[invoke('tilting-object','settle')],when('tilting-object','active'))];
  return {id:'pose-support',kind:'机制灰盒 · 姿态承托',level,
    summary:'提炼碰碰车片段的姿态与承托关系，先验证一处缺口。',
    help:'让物体停稳并放平，再观察人物是否真的由它承托。编辑角度、长度和旋转时长可以改变结果。',
    plan:[{source:'tilting-object',tick:120,label:'停稳并放平'}]};
}

/** Fresh ordinary DSL documents; all gameplay runs through the existing engine. */
export function buildExperiments(){return [returnRoute(),liftHandoff(),poseSupport()];}
