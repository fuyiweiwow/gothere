// World coordinates are independent of the screen. Increasing depth goes away from the viewer.
const EPS=1e-7;
const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const position=o=>({x:o.x,depth:o.space?.depth??0,height:o.space?.height??(440-(o.y??440))});

export function projectSpace(level,p) {
  const c=level.spatial.projection;
  return {x:p.x+p.depth*c.depthX,y:c.originY+p.depth*c.depthY-p.height};
}
export function unprojectSpace(level,p,height=0) {
  const c=level.spatial.projection,depth=(p.y+height-c.originY)/c.depthY;
  return {x:p.x-depth*c.depthX,depth,height};
}
export function spaceBounds(level,kind,o) {
  const p=projectSpace(level,position(o));
  if(kind==='actor'||kind==='goal')return {x:p.x-(kind==='actor'?12:16),y:p.y-(kind==='actor'?32:40),width:kind==='actor'?24:32,height:kind==='actor'?32:40};
  const w=o.width??28,h=kind==='platform'?8:o.height??36,d=o.space?.depthSize??24;
  const points=[projectSpace(level,{...position(o),height:position(o).height+(kind==='platform'?0:h)}),
    projectSpace(level,{x:o.x+w,depth:position(o).depth+d,height:o.space?.heightEnd??position(o).height}),p,
    projectSpace(level,{x:o.x+w,depth:position(o).depth,height:o.space?.heightEnd??position(o).height})];
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(8,Math.max(...ys)-Math.min(...ys))};
}

export function spaceSurfaces(level,entities) {
  return [...level.platforms.map((p,i)=>({...p,id:'platform:'+i})),...Object.values(entities).filter(e=>
    e.state==='active'&&(e.surface?.enabled||e.collider?.enabled)).map(e=>({...e,space:{...e.space,
      height:(e.space?.height??0)+(e.collider?e.height??36:0)}}))];
}
function surfaceAt(s,x,depth) {
  const p=position(s);
  if(x<s.x-EPS||x>s.x+s.width+EPS||depth<p.depth-EPS||depth>p.depth+(s.space?.depthSize??24)+EPS)return null;
  return p.height+((s.space?.heightEnd??p.height)-p.height)*(x-s.x)/s.width;
}
export function spaceSupport(level,entities,actor,tolerance=EPS) {
  const p=position(actor);
  const matches=spaceSurfaces(level,entities).map(s=>({id:s.id,height:surfaceAt(s,p.x,p.depth)}))
    .filter(s=>s.height!==null&&Math.abs(s.height-p.height)<=tolerance);
  return matches.sort((a,b)=>Math.abs(a.height-p.height)-Math.abs(b.height-p.height)||a.id.localeCompare(b.id))[0]??null;
}

export function validateSpatial(level,{draft=false}={}) {
  const s=level.spatial,errors=[],check=(ok,message)=>{if(!ok)errors.push('空间：'+message);};
  if(s===undefined)return errors;
  if(!s||typeof s!=='object'||Array.isArray(s))return ['空间：配置必须是对象。'];
  if(!Array.isArray(level.platforms)||!Array.isArray(level.entities)||!Array.isArray(level.rules))return ['空间：路面、物体和规则必须是数组。'];
  const c=s.projection;
  check(c&&finite(c.originY,200,620)&&finite(c.depthX,-0.5,0.5)&&finite(c.depthY,-1,-0.2),'投影需要 originY（200～620）、depthX（-0.5～0.5）与 depthY（-1～-0.2）。');
  check(Boolean(level.world?.physics),'必须启用重力。');
  const ids=new Set(),nodes=Array.isArray(s.nodes)?s.nodes:[];
  check(nodes.length>0&&nodes.length<=64,'路线需要 1～64 个节点。');
  for(const n of nodes.slice(0,65)){
    check(n&&typeof n.id==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(n.id)&&!ids.has(n.id),'路线节点 ID 必须合法且唯一。');
    if(!n)continue;ids.add(n.id);
    check(finite(n.x,20,1180)&&finite(n.depth,0,600)&&finite(n.height,0,360),'路线节点坐标超出范围。');
  }
  for(const n of nodes)if(n?.next!==undefined){
    const target=nodes.find(t=>t?.id===n.next);
    check(ids.has(n.next)&&n.next!==n.id,'下一节点不存在或指向自身。');
    if(target)check(Math.hypot(n.x-target.x,n.depth-target.depth)>EPS,'相连节点需要不同地面位置，升降能力暂不支持。');
  }
  check(ids.has(s.start),'起始节点不存在。');
  for(const [name,o] of [['主角',level.actor],['终点',level.goal],...(level.platforms??[]).map((o,i)=>['路面'+(i+1),o]),...(level.entities??[]).map(o=>[o?.label,o])]){
    const p=o?.space;
    check(p&&finite(p.depth,0,600)&&finite(p.height,0,360)&&(p.depthSize===undefined||finite(p.depthSize,1,600))&&
      (p.heightEnd===undefined||finite(p.heightEnd,0,360)),name+' 需要合法的纵深、离地高度及占地深度。');
  }
  for(const e of level.entities??[])check(e&&['object','zone','switch','gate','plate'].includes(e.kind)&&
    !e.body&&!e.pose&&!e.transport&&!e.supportProbe&&!e.carriedPhysics,'当前支持普通物体、区域与水平巡逻；动态刚体、旋转和高度通道尚未接入。');
  const actions=(list,depth=0)=>{if(!Array.isArray(list)||depth>4)return;for(const a of list){if(!a)continue;if(a.type==='after')actions(a.actions,depth+1);else check(['set','hurt','invoke','enable'].includes(a.type),'动作 '+a.type+' 尚未接入空间模型。');}};
  for(const r of level.rules)actions(r?.actions);
  for(const e of level.entities)if(Array.isArray(e?.behaviors))for(const b of e.behaviors)actions(b?.actions);
  if(!draft&&errors.length===0){
    const n=nodes.find(n=>n.id===s.start),a=position(level.actor);
    check(Math.hypot(n.x-a.x,n.depth-a.depth,n.height-a.height)<EPS,'主角起点必须与起始节点一致。');
    const entities=Object.fromEntries(level.entities.map(e=>[e.id,e]));
    check(Boolean(spaceSupport(level,entities,level.actor)),'角色起点需要真实支撑。');
    check(Boolean(spaceSupport(level,entities,level.goal)),'终点需要真实支撑。');
  }
  return errors;
}

export function initializeSpatialActor(level,actor) {
  actor.space=structuredClone(level.actor.space);actor.heading={x:actor.direction,depth:0};actor.vh=0;
  actor.routeNode=level.spatial.start;actor.targetNode=level.spatial.nodes.find(n=>n.id===actor.routeNode).next??null;
  actor.support=spaceSupport(level,{},actor)?.id??null;
}

/** Advance only world movement. Events, behavior calls, input and timers belong to the shared engine. */
export function advanceSpatialActor(level,entities,actor) {
  let remaining=1/60,transitions=0;const trace=[],landings=[],nodes=level.spatial.nodes;
  while(remaining>EPS&&transitions++<64){
    const from=position(actor),target=nodes.find(n=>n.id===actor.targetNode);
    const dx=target?target.x-actor.x:actor.heading.x,dd=target?target.depth-actor.space.depth:actor.heading.depth;
    const distance=Math.hypot(dx,dd);
    if(target&&distance<EPS){actor.targetNode=Math.abs(actor.space.height-target.height)<EPS?target.next??null:null;if(Math.abs(actor.space.height-target.height)<EPS)actor.routeNode=target.id;continue;}
    if(distance>EPS)actor.heading={x:dx/distance,depth:dd/distance};
    const dt=target?Math.min(remaining,distance/level.actor.speed):remaining,travel=dt*level.actor.speed;
    actor.x+=actor.heading.x*travel;actor.space.depth+=actor.heading.depth*travel;
    if(Math.abs(actor.heading.x)>EPS)actor.direction=actor.heading.x>0?1:-1;
    const support=spaceSurfaces(level,entities).map(s=>({id:s.id,height:surfaceAt(s,actor.x,actor.space.depth),before:surfaceAt(s,from.x,from.depth)}))
      .filter(s=>s.height!==null&&s.before!==null&&Math.abs(s.before-from.height)<EPS).sort((a,b)=>b.height-a.height)[0];
    if(actor.mode==='walking'&&support){actor.space.height=support.height;actor.support=support.id;actor.vh=0;}
    else {
      if(actor.mode!=='falling'){actor.mode='falling';actor.vh=0;actor.support=null;}
      const g=level.world.physics.gravity,v=Math.max(-level.world.physics.maxFallSpeed,actor.vh-g*dt);
      const nextHeight=actor.space.height+(actor.vh+v)*dt/2;actor.vh=v;
      const hits=spaceSurfaces(level,entities).map(s=>({id:s.id,height:surfaceAt(s,actor.x,actor.space.depth)}))
        .filter(s=>s.height!==null&&s.height<=from.height+EPS&&s.height>=nextHeight-EPS).sort((a,b)=>b.height-a.height);
      if(hits.length){actor.space.height=hits[0].height;actor.support=hits[0].id;actor.mode='walking';landings.push({support:actor.support,speed:-actor.vh});actor.vh=0;}
      else actor.space.height=nextHeight;
    }
    trace.push({from,to:position(actor)});remaining-=dt;
    if(target&&distance<=travel+EPS){actor.x=target.x;actor.space.depth=target.depth;actor.targetNode=null;
      if(Math.abs(actor.space.height-target.height)<EPS){actor.routeNode=target.id;actor.targetNode=target.next??null;}
    }
  }
  return {trace,landings};
}

// Slab intersection in relative world space catches both walkers and moving objects within a tick.
export function spaceTouches(trace,entity) {
  const e=position(entity),w=entity.width??28,d=entity.space?.depthSize??24,h=entity.height??36;
  return trace.some(segment=>{
    const from={...segment.from,x:segment.from.x-(entity.previousX??entity.x)},to={...segment.to,x:segment.to.x-entity.x};
    const mins={x:-10,depth:e.depth-6,height:e.height-32+EPS},maxs={x:w+10,depth:e.depth+d+6,height:e.height+h-EPS};
    let enter=0,leave=1;
    for(const key of ['x','depth','height']){
      const delta=to[key]-from[key];
      if(Math.abs(delta)<EPS){if(from[key]<mins[key]||from[key]>maxs[key])return false;}
      else{const a=(mins[key]-from[key])/delta,b=(maxs[key]-from[key])/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));}
    }
    return enter<=leave+EPS;
  });
}
export function spaceGoalReached(trace,goal) {
  const p=position(goal);
  return trace.some(({from,to})=>{
    const dx=to.x-from.x,dd=to.depth-from.depth,len=dx*dx+dd*dd;
    const t=len?Math.max(0,Math.min(1,((p.x-from.x)*dx+(p.depth-from.depth)*dd)/len)):0;
    return Math.hypot(from.x+dx*t-p.x,from.depth+dd*t-p.depth)<EPS&&Math.abs(from.height+(to.height-from.height)*t-p.height)<EPS;
  });
}
