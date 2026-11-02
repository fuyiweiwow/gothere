import {createPeachScene} from './peach-scene.js';

/** A themed vignette composed entirely of existing editable capabilities. */
export function buildPeachDelivery(){
  const level={schemaVersion:1,id:'experiment-peach-delivery',name:'仙长，请收桃',
    description:'王母寿宴将近，小驿卒奉命送桃。住山上的这位仙长还在打盹，扇子倒把路挡得严严实实。腾云符只够一口气——脚下没路，他也照走。',
    hint:'点击扇子可借道；桃篓上的符只能短暂缓降。云台由茶气托起，到达仙长身边后会自动交桃。提示和演示在「关卡实验」中。',
    world:{width:1200,height:640,groundY:440,physics:{gravity:900,maxFallSpeed:480}},
    actor:{x:100,y:300,speed:60,direction:1,maxLandingSpeed:240},goal:{x:730,y:260},
    platforms:[{x:30,y:300,width:270},{x:500,y:300,width:80},{x:610,y:470,width:240},{x:720,y:260,width:230}],
    entities:[
      {id:'borrowed-fan',label:'借扇过崖',kind:'object',x:300,y:300,width:200,height:16,state:'active',
        pose:{angle:-40,pivot:0},surface:{enabled:true},behaviors:[
          {id:'borrow',label:'借扇铺路',actions:[{type:'rotate',target:'borrowed-fan',angle:0,ticks:60},{type:'set',target:'borrowed-fan',state:'inactive'}]},
        ]},
      {id:'peach-satchel',label:'腾云符 · 只能一口气',kind:'object',x:110,y:300,width:24,height:28,state:'active',
        carriedPhysics:{gravityScale:.18,maxFallSpeed:90},behaviors:[
          {id:'pack',label:'背好蟠桃',actions:[{type:'hold',target:'peach-satchel'},{type:'set',target:'peach-satchel',state:'inactive'}]},
          {id:'glide',label:'憋气腾云',actions:[{type:'set',target:'peach-satchel',state:'active'},
            {type:'after',ticks:210,actions:[{type:'set',target:'peach-satchel',state:'inactive'}]}]},
        ]},
      {id:'cloud-car',label:'茶气云台',kind:'lift',x:850,y:470,toY:260,width:100,speed:90,state:'lower',upperDirection:-1,
        behaviors:[{id:'rise',label:'茶气托云',actions:[{type:'set',target:'cloud-car',state:'upper'}]}]},
      {id:'sleeping-immortal',label:'打盹的仙长',kind:'object',x:740,y:260,width:60,height:70,state:'inactive',
        behaviors:[{id:'receive',label:'手先醒了',actions:[{type:'set',target:'sleeping-immortal',state:'active'},
          {type:'drop'},{type:'set',target:'peach-satchel',state:'inactive'},
          {type:'set',target:'delivery-gate',state:'open'}]}]},
      {id:'delivery-zone',label:'递桃位置',kind:'zone',x:795,y:260,width:12,state:'enabled'},
      {id:'delivery-gate',label:'先把桃递到',kind:'gate',x:770,y:260,width:8,state:'closed'},
    ],rules:[
      {on:{type:'contact',source:'peach-satchel'},if:[{holding:null}],actions:[{type:'invoke',target:'peach-satchel',behavior:'pack'}]},
      {on:{type:'click',source:'borrowed-fan'},if:[{entity:'borrowed-fan',state:'active'}],actions:[{type:'invoke',target:'borrowed-fan',behavior:'borrow'}]},
      {on:{type:'click',source:'peach-satchel'},if:[{holding:'peach-satchel'},{entity:'peach-satchel',state:'inactive'}],actions:[{type:'invoke',target:'peach-satchel',behavior:'glide'}]},
      {on:{type:'board',source:'cloud-car'},actions:[{type:'invoke',target:'cloud-car',behavior:'rise'}]},
      {on:{type:'enter',source:'delivery-zone'},if:[{holding:'peach-satchel'}],actions:[{type:'invoke',target:'sleeping-immortal',behavior:'receive'},{type:'set',target:'delivery-zone',state:'disabled'}]},
    ]};
  level.scene=createPeachScene(level);
  return {id:'peach-delivery',kind:'主题试作 · 神仙驿站',display:'scene',level,
    summary:'王母寿宴，第一篓桃。山水之间很有仙气，送货过程有一点不靠谱。',
    help:'先借扇铺路。小驿卒走到扇子后的石台、准备离开高处时，再点桃篓启用腾云符。落下后他会搭茶气云台到仙长身边。符只能撑3.5秒；仙长的手会自己签收。',
    plan:[{source:'borrowed-fan',tick:30,label:'借扇铺路'},{source:'peach-satchel',tick:450,label:'离崖前憋气腾云'}]};
}
