/** Self-contained so the same small API can run in a disposable Worker. */
export function createAuthoringAPI(level,blank){
  const id=value=>typeof value==='string'?value:value?.id;
  const entity=value=>{const found=level.entities.find(e=>e.id===id(value));if(!found)throw new Error('找不到物体：'+id(value));return found;};
  const ticks=seconds=>{if(!Number.isFinite(seconds)||seconds<=0||seconds>60)throw new Error('时长必须大于0且不超过60秒。');return Math.max(1,Math.round(seconds*60));};
  return {
    entity,
    empty(){return structuredClone(blank);},
    object(name,options={}){
      if(level.entities.some(e=>e.id===name))throw new Error('物体标识重复：'+name);
      if(level.schemaVersion!==3)throw new Error('object 快捷创建目前需要二维分层关卡；旧版可直接编辑 level。');
      const {plane=level.spatial.planes[0].id,height=40,elevation=0,...rest}=options;
      const p=level.spatial.planes.find(p=>p.id===plane);if(!p)throw new Error('找不到行走层：'+plane);
      const object={id:name,label:name,kind:'object',x:500,width:32,height,state:'active',space:{plane,depth:p.depth,height:elevation,depthSize:20},...rest};
      level.entities.push(object);return object;
    },
    behavior(target,name,actions,label=name){const e=entity(target);e.behaviors??=[];const b={id:name,label,actions};const index=e.behaviors.findIndex(b=>b.id===name);if(index<0)e.behaviors.push(b);else e.behaviors[index]=b;return b;},
    on(target,type,actions,conditions=[],details={}){entity(target);const rule={on:{source:id(target),type,...details},...(conditions.length?{if:conditions}:{}),actions};level.rules.push(rule);return rule;},
    set:(target,state)=>({type:'set',target:id(target),state}),
    invoke:(target,behavior)=>({type:'invoke',target:id(target),behavior:typeof behavior==='string'?behavior:behavior.id}),
    after:(seconds,actions)=>({type:'after',ticks:ticks(seconds),actions}),
    move(target,options){const e=entity(target),{seconds=1,...destination}=options;const plane=destination.plane?level.spatial?.planes?.find(p=>p.id===destination.plane):null;
      if(destination.plane&&!plane)throw new Error('找不到目标行走层：'+destination.plane);
      const position=level.spatial&&destination.progress===undefined?{x:e.x,depth:plane?.depth??e.space.depth,height:e.space.height}:{};
      return {type:'move',target:e.id,...position,...destination,ticks:ticks(seconds)};},
    condition:(target,state)=>({entity:id(target),state}),
  };
}

export const AUTHORING_START=`// level 是打开此窗口时的草稿快照；生成不会直接改动草稿。
// 支持普通 JavaScript：变量、函数、循环，以及 api 快捷编排。
level.actor.speed = 55;

// 示例（取消注释并换成场景中的物体 ID）：
// const bus = api.entity('bus');
// api.behavior(bus, 'leave', [
//   api.after(0.3, [api.move(bus, { x: 1350, seconds: 3 })])
// ]);
// api.on(bus, 'click', [api.invoke(bus, 'leave')]);
// 移动真正结束请连接 moved 事件；after / done 不等待位移。

return level;`;

export const AUTHORING_EXAMPLE=`// 独立的小例子：点击挡路物，让它沿路驶到画外。
// 不加载美术也能运行；应用后可在资源模式为它绑定图片。
level = api.empty();
api = createAPI(level);
level.name = 'JS 编排 · 点击让路';
const cart = api.object('cart', {
  label: '挡路的物体', x: 520, width: 64, height: 44,
  contact: { effect: 'lethal', message: '撞上了挡路物。' }
});
api.behavior(cart, 'leave', [
  api.set(cart, 'inactive'),
  api.after(0.2, [api.move(cart, { x: 1350, seconds: 2 })])
], '向右驶离');
api.on(cart, 'click', [api.invoke(cart, 'leave')], [api.condition(cart, 'active')]);
return level;`;
