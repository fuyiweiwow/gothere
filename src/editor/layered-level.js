/** A small authorable fixture: two streets at equal physical height and a real
 * raised walkway. Cross-plane travel belongs to an explicit object capability. */
export function createLayeredLevel(){
  const node=(id,x,plane,depth,height,next,via)=>({id,x,plane,depth,height,...(next?{next}:{}),...(via?{via}:{})});
  const road=(x,width,plane,depth,height=0,heightEnd)=>({x,width,space:{plane,depth,depthSize:20,height,...(heightEnd!==undefined?{heightEnd}:{})}});
  return {schemaVersion:3,id:'layered-graybox',name:'分层样例 · 前街与后街',description:'前街经巷口通往后街，之后才是真正的上坡。两街画面重叠时互不接触。',
    hint:'地图面板选择行走层；选择路线节点配置下一节点与跨层连接。关闭巷口能力后，人物仍会继续向前。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{mode:'layered',projection:{originY:580,depthX:0,depthY:-1},planes:[{id:'front',label:'前街',depth:30,order:1},{id:'back',label:'后街',depth:210,order:0}],start:'start',nodes:[
      node('start',80,'front',30,0,'front-turn'),node('front-turn',330,'front',30,0,'back-entry','alley'),
      node('back-entry',450,'back',210,0,'ramp-foot'),node('ramp-foot',700,'back',210,0,'ramp-top'),
      node('ramp-top',850,'back',210,100,'finish'),node('finish',1100,'back',210,100)]},
    actor:{x:80,speed:90,space:{plane:'front',depth:30,height:0}},goal:{x:1100,space:{plane:'back',depth:210,height:100}},
    platforms:[road(40,290,'front',30),road(450,250,'back',210),road(700,150,'back',210,0,100),road(850,300,'back',210,100)],
    entities:[{id:'alley',kind:'object',label:'巷口连接',x:330,width:24,height:12,state:'active',space:{plane:'front',depth:30,depthSize:20,height:0},passage:{from:'front-turn',to:'back-entry',distance:Math.hypot(120,180),enabled:true}},
      {id:'marker',kind:'object',label:'后街参照物',x:180,width:60,height:180,state:'active',space:{plane:'back',depth:210,depthSize:20,height:0}}],rules:[]};
}
