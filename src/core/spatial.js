// World coordinates are independent of the screen. Increasing depth goes away from the viewer.
const EPS=1e-7;
const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const position=o=>({x:o.x,depth:o.space?.depth??0,height:o.space?.height??(440-(o.y??440)),...(o.space?.plane?{plane:o.space.plane}:{}),...(o.space?.passage?{passage:o.space.passage,progress:o.space.progress}:{})});
export const isLayered=level=>level.spatial?.mode==='layered';
// Ordinary object motion may leave the camera; the actor still has map bounds.
export const SPATIAL_MOVE_X=Object.freeze({min:-1200,max:2400});

/** Static destinations describe possible ownership; runtime still requires the
 * actual endpoint. This does not authorize an arbitrary plane switch. */
export function objectPassages(level,id){
  const ids=new Set(),object=level.entities.find(e=>e?.id===id);if(object?.space?.passage)ids.add(object.space.passage);
  const visit=list=>{if(!Array.isArray(list))return;for(const a of list){if(a?.type==='after')visit(a.actions);else if(a?.type==='move'&&a.target===id&&a.passage)ids.add(a.passage);}};
  for(const r of level.rules??[])visit(r?.actions);
  for(const e of level.entities)if(Array.isArray(e?.behaviors))for(const b of e.behaviors)visit(b?.actions);
  return level.entities.filter(e=>ids.has(e?.id)&&e.passage);
}

export function passagePosition(level,id,progress){
  const p=level.entities.find(e=>e.id===id)?.passage,a=level.spatial.nodes.find(n=>n.id===p?.from),b=level.spatial.nodes.find(n=>n.id===p?.to);
  return {x:a.x+(b.x-a.x)*progress,depth:a.depth+(b.depth-a.depth)*progress,height:a.height};
}
export function syncPassageObject(level,object){
  const p=passagePosition(level,object.space.passage,object.space.progress);object.x=p.x;object.space.depth=p.depth;
}

/** Leaving a passage changes ownership only at its real, matching endpoint.
 * The following translation starts at the same world position. */
export function beginSpatialMove(level,object,action){
  const space=object.space;
  if(action.progress!==undefined){
    if(action.passage!==undefined){
      const passage=level.entities.find(e=>e.id===action.passage)?.passage;
      if(!passage)return false;
      if(space.passage){if(space.passage!==action.passage)return false;}
      else{
        const ends=[passage.from,passage.to].map(id=>level.spatial.nodes.find(n=>n.id===id));
        const endpoint=ends.findIndex(n=>n.plane===space.plane&&Math.abs(n.x-object.x)<EPS&&Math.abs(n.depth-space.depth)<EPS&&Math.abs(n.height-space.height)<EPS);
        if(endpoint<0)return false;
        object.space={passage:action.passage,progress:endpoint,length:object.width??28,depthSize:space.depthSize??20,depth:space.depth,height:space.height};
      }
    }
    if(!object.space.passage)return false;
    object.translation={fromProgress:object.space.progress,toProgress:action.progress,ticks:action.ticks,elapsed:0};return true;
  }
  if(space.passage){
    const passage=level.entities.find(e=>e.id===space.passage).passage;
    const endpoint=Math.abs(space.progress)<EPS?passage.from:Math.abs(space.progress-1)<EPS?passage.to:null;
    const node=level.spatial.nodes.find(n=>n.id===endpoint);
    if(!node||action.plane!==node.plane||Math.abs(space.height-node.height)>EPS)return false;
    object.space={plane:node.plane,depth:node.depth,depthSize:space.depthSize??20,height:space.height};
  }else if(action.plane!==undefined&&action.plane!==space.plane)return false;
  object.translation={from:{x:object.x,depth:object.space.depth,height:object.space.height},
    to:{x:action.x,depth:action.depth,height:action.height},ticks:action.ticks,elapsed:0};return true;
}

export function projectSpace(level,p) {
  const c=level.spatial.projection;
  return {x:p.x+p.depth*c.depthX,y:c.originY+p.depth*c.depthY-p.height};
}
export function unprojectSpace(level,p,height=0) {
  const c=level.spatial.projection,depth=(p.y+height-c.originY)/c.depthY;
  return {x:p.x-depth*c.depthX,depth,height};
}
export function spaceBounds(level,kind,o) {
  if(o.space?.passage){const p=projectSpace(level,{...passagePosition(level,o.space.passage,o.space.progress),height:o.space.height}),w=o.width??28,h=o.height??36;
    return {x:p.x-w/2,y:p.y-h,width:w,height:h};}
  if(o.pose){const surface=spaceObjectSurface(o);return spaceBounds(level,'platform',{...surface,pose:undefined});}
  const p=projectSpace(level,position(o));
  if(isLayered(level)&&o.passage){
    const nodes=level.spatial.nodes,a=nodes.find(n=>n.id===o.passage.from),b=nodes.find(n=>n.id===o.passage.to);
    if(a&&b){const q=projectSpace(level,a),r=projectSpace(level,b);return {x:Math.min(q.x,r.x)-8,y:Math.min(q.y,r.y)-8,width:Math.abs(q.x-r.x)+16,height:Math.abs(q.y-r.y)+16};}
  }
  if(kind==='actor'||kind==='goal')return {x:p.x-(kind==='actor'?12:16),y:p.y-(kind==='actor'?32:40),width:kind==='actor'?24:32,height:kind==='actor'?32:40};
  const w=o.width??28,h=kind==='platform'?8:o.height??36,d=o.space?.depthSize??24;
  const points=[projectSpace(level,{...position(o),height:position(o).height+(kind==='platform'?0:h)}),
    projectSpace(level,{x:o.x+w,depth:position(o).depth+d,height:o.space?.heightEnd??position(o).height}),p,
    projectSpace(level,{x:o.x+w,depth:position(o).depth,height:o.space?.heightEnd??position(o).height})];
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(8,Math.max(...ys)-Math.min(...ys))};
}

export function spaceObjectSurface(o) {
  const h=o.space?.height??0,pivot=(o.width??28)*(o.pose?.pivot??0),r=(o.pose?.angle??0)*Math.PI/180;
  const x=o.x+pivot-pivot*Math.cos(r),height=h+pivot*Math.sin(r);
  return {...o,x,width:(o.width??28)*Math.cos(r),space:{...o.space,height:height+(o.collider?o.height??36:0),
    ...(o.pose?{heightEnd:height-(o.width??28)*Math.sin(r)}:{})}};
}
export function spaceSurfaces(level,entities,held=null) {
  return [...level.platforms.map((p,i)=>({...p,id:'platform:'+i})),...Object.values(entities).filter(e=>
    e.id!==held&&e.state==='active'&&(e.surface?.enabled||e.collider?.enabled)).map(spaceObjectSurface)];
}
function surfaceAt(s,x,depth) {
  const p=position(s);
  if(x<s.x-EPS||x>s.x+s.width+EPS||depth<p.depth-EPS||depth>p.depth+(s.space?.depthSize??24)+EPS)return null;
  return p.height+((s.space?.heightEnd??p.height)-p.height)*(x-s.x)/s.width;
}
export function spaceSupport(level,entities,actor,tolerance=EPS) {
  const p=position(actor);
  const matches=spaceSurfaces(level,entities,actor.holding).filter(s=>!isLayered(level)||s.space.plane===p.plane).map(s=>({id:s.id,height:surfaceAt(s,p.x,p.depth)}))
    .filter(s=>s.height!==null&&Math.abs(s.height-p.height)<=tolerance);
  return matches.sort((a,b)=>Math.abs(a.height-p.height)-Math.abs(b.height-p.height)||a.id.localeCompare(b.id))[0]??null;
}

export function validateSpatial(level,{draft=false}={}) {
  const s=level.spatial,errors=[],check=(ok,message)=>{if(!ok)errors.push((s?.mode==='layered'?'分层：':'空间：')+message);};
  if(s===undefined)return errors;
  if(!s||typeof s!=='object'||Array.isArray(s))return ['空间：配置必须是对象。'];
  if(!Array.isArray(level.platforms)||!Array.isArray(level.entities)||!Array.isArray(level.rules))return ['空间：路面、物体和规则必须是数组。'];
  check(s.mode===undefined||s.mode==='layered','未知创作模式。');
  const layered=isLayered(level),planes=Array.isArray(s.planes)?s.planes:[];
  if(layered){
    check(planes.length>0&&planes.length<=8,'分层地图需要 1～8 个行走层。');
    const ids=new Set();for(const p of planes){
      check(p&&typeof p.id==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(p.id)&&!ids.has(p.id)&&typeof p.label==='string'&&p.label.length>0&&p.label.length<=30&&finite(p.depth,0,400)&&Number.isInteger(p.order)&&finite(p.order,-8,8),'行走层需要唯一 ID、名称、画面位置和绘制顺序。');
      ids.add(p?.id);
    }
    check(s.projection?.depthX===0&&s.projection?.depthY===-1,'分层模式使用二维位置；不使用斜投影。');
  }
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
    if(target)check(Math.hypot(n.x-target.x,n.depth-target.depth)>EPS,'相连路线节点需要不同地面位置；垂直升降由物体的 move 动作承载。');
    if(layered&&target&&n.plane!==target.plane){
      const e=level.entities.find(e=>e?.id===n.via),p=e?.passage;
      check(p&&p.from===n.id&&p.to===target.id,'跨行走层的路线必须指定匹配的连接物体。');
    }else if(layered)check(n.via===undefined,'同一行走层的路线不使用跨层连接。');
  }
  check(ids.has(s.start),'起始节点不存在。');
  for(const [name,o] of [['主角',level.actor],['终点',level.goal],...(level.platforms??[]).map((o,i)=>['路面'+(i+1),o]),...(level.entities??[]).map(o=>[o?.label,o])]){
    const p=o?.space;
    check(p&&finite(p.depth,0,600)&&finite(p.height,0,360)&&(p.depthSize===undefined||finite(p.depthSize,1,600))&&
      (p.heightEnd===undefined||finite(p.heightEnd,0,360)),name+' 需要合法的纵深、离地高度及占地深度。');
    if(p?.passage)check(layered,'通路位置需要二维分层模式。');
    if(layered&&p?.passage){
      check(level.entities.includes(o)&&o.kind==='object'&&level.entities.some(e=>e?.id===p.passage&&e.passage)&&p.plane===undefined&&finite(p.progress,0,1)&&finite(p.length,8,160),name+' 的通路位置需要连接物体、进度与占用长度。');
      check(!o.passage&&!o.motion&&!o.surface&&!o.collider&&!o.pose,name+' 的通路位置不与承托、旋转或巡逻组合。');
    }else if(layered)check(planes.some(plane=>plane?.id===p?.plane&&plane?.depth===p?.depth),name+' 必须属于已定义行走层，并使用该层的画面位置。');
  }
  if(layered){
    for(const n of nodes)check(planes.some(p=>p?.id===n?.plane&&p?.depth===n?.depth),'路线节点必须属于已定义行走层。');
    for(const e of level.entities)if(e?.passage!==undefined){
      const p=e.passage,a=nodes.find(n=>n?.id===p?.from),b=nodes.find(n=>n?.id===p?.to);
      check(e.kind==='object'&&typeof p?.enabled==='boolean'&&finite(p?.distance,20,1200)&&a&&b&&a.plane!==b.plane&&a.height===b.height,'连接需要通行距离（20～1200）及相同实际高度、不同层的一对路线节点。');
      check(!e.motion&&!e.pose&&!e.collider&&!e.surface,'跨层连接不能同时作为旋转、巡逻或承托物体。');
    }
  }
  for(const e of level.entities??[])check(e&&['object','zone','switch','gate','plate'].includes(e.kind)&&
    !e.body&&!e.transport&&!e.supportProbe&&!e.carriedPhysics,'当前支持普通物体、旋转承托、受控位移与持有；动态刚体和旧高度通道尚未接入。');
  const actions=(list,depth=0)=>{if(!Array.isArray(list)||depth>4)return;for(const a of list){if(!a)continue;if(a.type==='after')actions(a.actions,depth+1);else{
    check(['set','hurt','invoke','enable','rotate','move','hold','drop','place'].includes(a.type),'动作 '+a.type+' 尚未接入空间模型。');
    if(layered&&a.type==='move'){
      const e=level.entities.find(e=>e?.id===a.target);
      if(a.passage!==undefined){
        check(typeof a.passage==='string'&&level.entities.some(p=>p?.id===a.passage&&p.passage)&&finite(a.progress,0,1)&&a.plane===undefined&&
          !e?.pose&&!e?.surface&&!e?.collider&&(e?.width??28)<=160,'move.passage 需要有效连接、进度及可进入通路的普通物体。');
      }else if(a.plane!==undefined){
        const paths=objectPassages(level,e?.id).map(p=>p.passage);
        const endpoints=nodes.filter(n=>paths.some(p=>n.id===p.from||n.id===p.to));
        check(typeof a.plane==='string'&&a.progress===undefined&&planes.some(p=>p.id===a.plane&&p.depth===a.depth)&&
          (a.plane===e?.space?.plane||endpoints.some(n=>n.plane===a.plane)),'move.plane 必须是物体当前层或通路两端的行走层。');
      }else check(e?.space?.passage?finite(a.progress,0,1):a.depth===e?.space?.depth,'分层物体在所属层中移动；通路物体使用进度。');
    }
  }}};
  for(const r of level.rules)actions(r?.actions);
  for(const e of level.entities)if(Array.isArray(e?.behaviors))for(const b of e.behaviors)actions(b?.actions);
  if(!draft&&errors.length===0){
    const n=nodes.find(n=>n.id===s.start),a=position(level.actor);
    check(Math.hypot(n.x-a.x,n.depth-a.depth,n.height-a.height)<EPS,'主角起点必须与起始节点一致。');
    if(layered)check(n.plane===a.plane,'主角必须与起始节点属于同一行走层。');
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
  let remaining=1/60,transitions=0;const trace=[],landings=[],crossings=[],nodes=level.spatial.nodes,allSurfaces=spaceSurfaces(level,entities,actor.holding),layered=isLayered(level);
  while(remaining>EPS&&transitions++<64){
    if(layered&&actor.passage){
      const p=actor.passage,a=nodes.find(n=>n.id===p.from),b=nodes.find(n=>n.id===p.to),distance=p.distance;
      const dt=Math.min(remaining,(distance-p.travelled)/level.actor.speed),from=position(actor);
      p.travelled=Math.min(distance,p.travelled+dt*level.actor.speed);const t=p.travelled/distance;
      actor.x=a.x+(b.x-a.x)*t;actor.space.depth=a.depth+(b.depth-a.depth)*t;
      actor.space.height=a.height;remaining-=dt;
      // A passage owns its traversal. Unrelated streets cannot contact it mid-way.
      trace.push({distance,from:{...from,plane:null,passage:p.id,progress:(p.travelled-dt*level.actor.speed)/distance},to:{...position(actor),plane:null,passage:p.id,progress:t}});
      if(p.travelled>=distance-EPS){
        actor.x=b.x;actor.space.depth=b.depth;actor.space.plane=b.plane;actor.routeNode=b.id;actor.targetNode=b.next??null;
        actor.mode='walking';actor.support=spaceSupport(level,entities,actor)?.id??null;
        crossings.push({type:'arrive',id:p.id});delete actor.passage;
        trace.push({from:position(actor),to:position(actor)});
      }
      continue;
    }
    const surfaces=allSurfaces.filter(s=>!layered||s.space.plane===actor.space.plane);
    const from=position(actor),target=nodes.find(n=>n.id===actor.targetNode);
    if(layered&&target&&target.plane!==actor.space.plane){
      const start=nodes.find(n=>n.id===actor.routeNode),e=entities[start?.via];
      if(start&&e?.state==='active'&&e.passage?.enabled&&actor.mode==='walking'&&spaceSupport(level,entities,actor)&&
        Math.abs(actor.x-start.x)<EPS&&Math.abs(actor.space.height-start.height)<EPS){
        actor.passage={id:e.id,from:start.id,to:target.id,travelled:0,distance:e.passage.distance};actor.mode='passing';actor.support=null;
        if(target.x!==start.x)actor.direction=target.x>start.x?1:-1;
        crossings.push({type:'board',id:e.id});continue;
      }
      // A disabled connection changes no route: keep walking on the current plane.
      actor.targetNode=null;continue;
    }
    const dx=target?target.x-actor.x:actor.heading.x,dd=target?target.depth-actor.space.depth:actor.heading.depth;
    const distance=Math.hypot(dx,dd);
    if(target&&distance<EPS){actor.targetNode=Math.abs(actor.space.height-target.height)<EPS?target.next??null:null;if(Math.abs(actor.space.height-target.height)<EPS)actor.routeNode=target.id;continue;}
    if(distance>EPS)actor.heading={x:dx/distance,depth:dd/distance};
    let dt=target?Math.min(remaining,distance/level.actor.speed):remaining;
    // Split at actual footprint edges so adjoining ramps meet exactly within a
    // tick, including a new surface whose slope differs from the previous one.
    for(const s of surfaces)for(const [key,edges] of [['x',[s.x,s.x+s.width]],['depth',[s.space.depth,s.space.depth+(s.space.depthSize??24)]]]){
      const speed=actor.heading[key]*level.actor.speed;if(Math.abs(speed)<EPS)continue;
      for(const edge of edges){const time=(edge-from[key])/speed;if(time>EPS&&time<dt)dt=time;}
    }
    const travel=dt*level.actor.speed;
    actor.x+=actor.heading.x*travel;actor.space.depth+=actor.heading.depth*travel;
    if(Math.abs(actor.heading.x)>EPS)actor.direction=actor.heading.x>0?1:-1;
    const support=surfaces.map(s=>({id:s.id,height:surfaceAt(s,actor.x,actor.space.depth),before:surfaceAt(s,from.x,from.depth)}))
      .filter(s=>s.height!==null&&s.before!==null&&Math.abs(s.before-from.height)<EPS).sort((a,b)=>b.height-a.height)[0];
    if(actor.mode==='walking'&&support){actor.space.height=support.height;actor.support=support.id;actor.vh=0;}
    else {
      if(actor.mode!=='falling'){actor.mode='falling';actor.vh=0;actor.support=null;}
      const g=level.world.physics.gravity,v=Math.max(-level.world.physics.maxFallSpeed,actor.vh-g*dt);
      const nextHeight=actor.space.height+(actor.vh+v)*dt/2;actor.vh=v;
      const hits=surfaces.map(s=>({id:s.id,height:surfaceAt(s,actor.x,actor.space.depth)}))
        .filter(s=>s.height!==null&&s.height<=from.height+EPS&&s.height>=nextHeight-EPS).sort((a,b)=>b.height-a.height);
      if(hits.length){actor.space.height=hits[0].height;actor.support=hits[0].id;actor.mode='walking';landings.push({support:actor.support,speed:-actor.vh});actor.vh=0;}
      else actor.space.height=nextHeight;
    }
    trace.push({from,to:position(actor)});remaining-=dt;
    if(target&&distance<=travel+EPS){actor.x=target.x;actor.space.depth=target.depth;actor.targetNode=null;
      if(Math.abs(actor.space.height-target.height)<EPS){actor.routeNode=target.id;actor.targetNode=target.next??null;}
    }
  }
  return {trace,landings,crossings};
}

// Slab intersection in relative world space catches both walkers and moving objects within a tick.
export function spaceTouches(trace,entity) {
  const e=position(entity),w=entity.width??28,d=entity.space?.depthSize??24,h=entity.height??36;
  return trace.some(segment=>{
    if(entity.space?.passage){
      if(segment.from.passage!==entity.space.passage||segment.to.passage!==entity.space.passage)return false;
      const distance=segment.distance,previous=entity.previousSpace??entity.space;
      const a=(segment.from.progress-previous.progress)*distance,b=(segment.to.progress-entity.space.progress)*distance,r=entity.space.length/2+10;
      return Math.min(a,b)<=r&&Math.max(a,b)>=-r&&Math.abs(segment.to.height-entity.space.height)<h;
    }
    if(entity.space?.plane!==undefined&&(segment.from.plane!==entity.space.plane||segment.to.plane!==entity.space.plane))return false;
    const previous=entity.previousSpace??entity.space;
    const from={x:segment.from.x-(entity.previousX??entity.x),depth:segment.from.depth-(previous?.depth??e.depth),height:segment.from.height-(previous?.height??e.height)},
      to={x:segment.to.x-entity.x,depth:segment.to.depth-e.depth,height:segment.to.height-e.height};
    const mins={x:-10,depth:-6,height:-32+EPS},maxs={x:w+10,depth:d+6,height:h-EPS};
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
    if(goal.space?.plane!==undefined&&(from.plane!==goal.space.plane||to.plane!==goal.space.plane))return false;
    const dx=to.x-from.x,dd=to.depth-from.depth,len=dx*dx+dd*dd;
    const t=len?Math.max(0,Math.min(1,((p.x-from.x)*dx+(p.depth-from.depth)*dd)/len)):0;
    return Math.hypot(from.x+dx*t-p.x,from.depth+dd*t-p.depth)<EPS&&Math.abs(from.height+(to.height-from.height)*t-p.height)<EPS;
  });
}
