/** Content examples use only geometry and rules. They require no artwork or game shell. */
export function createEditorExample(name='logic') {
  const common = { schemaVersion:1, world:{width:1200,height:640,groundY:440} };
  if(name==='floors')return { ...common, id:'editor-floors', name:'多层运输',
    description:'先点开关召回电梯。登车事件调用上行行为；没有车时主角继续走并掉落。',
    actor:{x:80,y:520,speed:100},goal:{x:1080,y:180},
    platforms:[{x:0,width:480,y:520},{x:240,width:520,y:350},{x:730,width:470,y:180}],
    entities:[{id:'ladder',kind:'ladder',x:260,y:520,toY:350,width:40,speed:100,state:'enabled',label:'梯子'},
      {id:'call',kind:'switch',x:620,y:350,width:28,state:'off',label:'召回开关'},
      {id:'lift',kind:'lift',x:760,y:350,toY:180,width:60,speed:100,state:'upper',label:'升降平台',
        behaviors:[{id:'down',label:'下行',actions:[{type:'set',target:'lift',state:'lower'}]},
          {id:'up',label:'上行',actions:[{type:'set',target:'lift',state:'upper'}]}]}],
    rules:[{on:{type:'click',source:'call'},actions:[{type:'set',target:'call',state:'on'},{type:'invoke',target:'lift',behavior:'down'}]},
      {on:{type:'board',source:'lift'},actions:[{type:'invoke',target:'lift',behavior:'up'}]}] };
  return { ...common, id:'editor-logic', name:'事件、行为与持有',
    description:'碰到物件自动持有；带着它走入区域，门延迟 30 帧打开，完成后点亮开关。也可以直接点击开关开门。',
    actor:{x:80,speed:100},goal:{x:1100},platforms:[{x:0,width:1200}],
    entities:[{id:'signal',kind:'switch',x:170,width:28,state:'off',label:'开关',
      behaviors:[{id:'light',label:'亮起',actions:[{type:'set',target:'signal',state:'on'}]}]},
      {id:'item',kind:'object',x:340,width:48,state:'active',label:'可持有物',
        behaviors:[{id:'pickup',label:'拿起',actions:[{type:'hold',target:'item'}]},
          {id:'drop',label:'放下',actions:[{type:'drop'}]}]},
      {id:'region',kind:'zone',x:540,width:120,state:'enabled',label:'感应区域'},
      {id:'door',kind:'gate',x:800,width:28,state:'closed',label:'门',
        behaviors:[{id:'open',label:'延迟开启',actions:[{type:'after',ticks:30,actions:[{type:'set',target:'door',state:'open'}]}]},
          {id:'close',label:'关闭',actions:[{type:'set',target:'door',state:'closed'}]}]}],
    rules:[{on:{type:'contact',source:'item'},actions:[{type:'invoke',target:'item',behavior:'pickup'}]},
      {on:{type:'enter',source:'region'},if:[{holding:'item'}],actions:[{type:'invoke',target:'door',behavior:'open'}]},
      {on:{type:'click',source:'signal'},actions:[{type:'invoke',target:'door',behavior:'open'}]},
      {on:{type:'done',source:'door',behavior:'open'},actions:[{type:'invoke',target:'signal',behavior:'light'}]}] };
}
