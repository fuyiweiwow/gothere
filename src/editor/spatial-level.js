/** An ordinary DSL fixture. No runtime code recognizes its IDs or the example's subject matter. */
export function createSpatialLevel() {
  const node=(id,x,depth,height,next)=>({id,x,depth,height,...(next?{next}:{})});
  return {schemaVersion:1,id:'spatial-graybox',name:'空间灰盒 · 近路与远路',
    description:'点击近侧移动物使它休息，再观察人物向远处走、上坡、穿过高架并落回地面。路线与物体都可编辑。',
    hint:'逻辑视图拖动圆点编辑路线；物体属性分别设置纵深与离地高度。美术视图显示同一空间，可添加并绑定自己的图片。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    spatial:{projection:{originY:550,depthX:0.18,depthY:-0.65},start:'start',nodes:[
      node('start',100,60,0,'near-turn'),node('near-turn',300,60,0,'far-turn'),node('far-turn',300,300,0,'ramp-base'),
      node('ramp-base',500,300,0,'ramp-top'),node('ramp-top',700,300,80,'bridge-bend'),
      node('bridge-bend',820,300,80,'bridge-near'),node('bridge-near',820,80,80,'finish'),node('finish',1080,80,0)]},
    actor:{x:100,speed:75,space:{depth:60,height:0}},goal:{x:1080,space:{depth:80,height:0}},
    platforms:[{x:40,width:1100,space:{depth:20,depthSize:330,height:0}},
      {x:500,width:200,space:{depth:280,depthSize:40,height:0,heightEnd:80}},
      {x:700,width:160,space:{depth:280,depthSize:40,height:80}},
      {x:800,width:40,space:{depth:60,depthSize:260,height:80}}],
    entities:[{id:'traffic',kind:'object',label:'移动物 · 点击休息',x:190,width:50,height:28,state:'active',
      space:{depth:45,depthSize:30,height:0},motion:{type:'patrol',minX:180,maxX:240,speed:45},contact:{effect:'lethal'},
      behaviors:[{id:'rest',label:'休息',actions:[{type:'set',target:'traffic',state:'inactive'}]}]},
      {id:'underpass',kind:'object',label:'桥下移动物',x:790,width:50,height:30,state:'active',
        space:{depth:150,depthSize:45,height:0},motion:{type:'patrol',minX:760,maxX:840,speed:65},contact:{effect:'lethal'}},
      {id:'marker',kind:'object',label:'遮挡参照物',x:410,width:70,height:85,state:'active',space:{depth:100,depthSize:40,height:0}}],
    rules:[{on:{type:'click',source:'traffic'},actions:[{type:'invoke',target:'traffic',behavior:'rest'}]}]};
}
