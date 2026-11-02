import {feedbackDefault} from '../content/feedback-presets.js';

/** Editable layered concept artwork. Every reaction is driven by ordinary state or feedback slots. */
export function createPeachScene(level){
  const scene={background:'#e9e2ca',assets:[],nodes:[],feedback:[],sounds:[]};let serial=0;
  const add=(asset,label,x,y,width,height,layer=0,extra={})=>{
    const node={id:'peach-node-'+(++serial),asset,label,x,y,width,height,layer,...extra};scene.nodes.push(node);return node;
  };
  const bind=(id,asset,label,x,y,w,h,extra={})=>add(asset,label,x,y,w,h,25,{bind:{type:'entity',id},...extra});
  const cue=(target,trigger,extra={})=>scene.feedback.push({...feedbackDefault(target,'peach-feedback-'+(scene.feedback.length+1)),trigger,...extra});
  for(const [x,y,w,h,opacity] of [[-50,65,230,390,.24],[110,5,330,470,.15],[385,95,210,360,.2],[540,20,250,480,.13],[780,55,290,420,.21],[1030,0,230,510,.17]])
    add('peachMountain','远山',x,y,w,h,-70,{opacity});
  for(const [x,y,w] of [[-80,155,280],[260,95,230],[550,180,270],[940,135,320],[-30,545,340],[320,560,400],[800,550,460]])
    add('peachCloud','山间流云',x,y,w,w*.22,-55,{opacity:.65});
  for(const [i,p] of level.platforms.entries()){
    add('peachRock','浮山岩体 '+(i+1),p.x,p.y,p.width,Math.min(640-p.y,180+p.width*.2),-15);
    add('peachLedge','真实路面石沿 '+(i+1),0,0,p.width,14,10,{bind:{type:'platform',index:i}});
  }
  add('peachPavilion','送桃驿站',32,172,106,125,-5);add('peachRoof','驿站飞檐',9,143,150,56,0);
  add('peachBanner','蟠桃驿旗',175,168,60,132,5);
  add('peachTree','出发处桃树',215,166,102,134,0);
  add('peachPine','中段崖松',526,210,61,90,3);
  add('peachPine','下层老松',665,325,92,145,0);
  add('peachPavilion','仙长山居',762,103,174,157,-5);add('peachRoof','山居飞檐',729,56,240,84,1);
  add('peachPine','山居背后古松',994,78,149,191,-7);
  add('peachTree','山居旁桃树',1013,220,142,162,-20);
  const pot=add('peachTeapot','托起云台的茶壶',800,420,58,50,15);
  for(const [x,y] of [[49,316],[152,331],[229,370],[653,484],[734,504],[781,280],[890,303]])
    add('peachLedge','山岩纹理',x,y,28,4,-12,{opacity:.45});
  const fan=bind('borrowed-fan','peachFan','仙长搁在崖边的扇子',0,0,200,76);
  const basket=bind('peach-satchel','peachSatchel','要亲手送到的蟠桃篓',-7,-31,34,37);
  const charm=bind('peach-satchel','peachTalisman','桃篓上的腾云符',14,-41,14,29,{variants:{inactive:{opacity:.5},active:{opacity:1}}});
  const cloud=bind('cloud-car','peachCloud','茶气托着的真实云台',-12,-12,124,43);
  const immortal=bind('sleeping-immortal','peachImmortal','打盹仙长与签收动作',-25,-104,97,104,
    {variants:{active:{asset:'peachImmortalReceive',width:134}}});
  bind('delivery-gate','peachDeliveryTag','交接处的请递桃小帘',-6,-60,27,60,
    {variants:{open:{visible:false}}});
  add('peachCloud','仙长的呼噜气',769,139,35,13,26,{opacity:.5});
  const actor=add('peachCourier','一根筋的小驿卒',-16,-49,34,49,35,{bind:{type:'actor'},flipWithDirection:true});
  add('peachLedge','交桃位置的石几',-10,0,35,14,12,{bind:{type:'goal'}});
  const seal=bind('sleeping-immortal','peachSeal','签收后的小笑话',145,36,235,147,
    {visible:false,variants:{inactive:{visible:false},active:{visible:true}}});
  cue(actor.id,{type:'start'},{motion:'hop',duration:32,loop:true,strength:.15});
  cue(actor.id,{type:'lost'},{motion:'fall',sound:'fail',particles:'dust',duration:84,hold:true,color:'#a89571'});
  cue(actor.id,{type:'won'},{motion:'hop',sound:'success',particles:'spark',duration:72,count:15,color:'#cd9c64'});
  cue(fan.id,{type:'behavior',source:'borrowed-fan',behavior:'borrow'},{motion:'none',sound:'clack',duration:45});
  cue(charm.id,{type:'behavior',source:'peach-satchel',behavior:'glide'},{motion:'sway',sound:'puff',particles:'smoke',duration:210,count:15,color:'#9bbaa4'});
  cue(basket.id,{type:'behavior',source:'peach-satchel',behavior:'glide'},{motion:'pulse',duration:210,strength:.4});
  cue(pot.id,{type:'behavior',source:'cloud-car',behavior:'rise'},{motion:'squash',particles:'smoke',sound:'puff',duration:144,count:22,color:'#edf0cf'});
  cue(cloud.id,{type:'behavior',source:'cloud-car',behavior:'rise'},{motion:'none',particles:'smoke',duration:140,count:15,color:'#e8e6c7',strength:.4});
  cue(immortal.id,{type:'behavior',source:'sleeping-immortal',behavior:'receive'},{motion:'recoil',sound:'clack',duration:42,strength:.35});
  cue(seal.id,{type:'behavior',source:'sleeping-immortal',behavior:'receive'},{motion:'emerge',duration:45,hold:true});
  return scene;
}
