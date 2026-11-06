export function sourceLiteral(value) {
  return JSON.stringify(value, null, 2).replace(/^(\s*)"__proto__":/gm, '$1["__proto__"]:');
}
const compact = value => JSON.stringify(value).replace(/"__proto__":/g, '["__proto__"]:');
export function sourceName(id, prefix, used) {
  let name = String(id).replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase()).replace(/[^\w$]/g, '_');
  name = prefix + (name ? name[0].toUpperCase() + name.slice(1) : 'Item');
  while (used.has(name)) name += '_';
  used.add(name); return name;
}

/** Only export the structured facade when every field can be preserved exactly. */
export function semanticMapSource(level) {
  if (level.schemaVersion !== 3 || level.spatial?.mode !== 'layered') return null;
  const {spatial, world} = level;
  const keys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
  if (!keys(level, ['schemaVersion','id','name','description','hint','world','spatial','actor','goal','platforms','entities','rules','scene']) ||
      !keys(spatial,['mode','projection','planes','nodes','start']) || !keys(world,['width','height','groundY','physics']) ||
      !keys(spatial.projection,['originY','depthX','depthY']) || spatial.projection.depthX !== 0 || spatial.projection.depthY !== -1 ||
      !world.physics || !Object.hasOwn(level,'description') || !Object.hasOwn(level.actor,'speed') || !spatial.nodes.some(n=>n.id===spatial.start) ||
      !keys(level.actor,['x','speed','space','direction','maxLandingSpeed']) ||
      !keys(level.actor.space??{},['plane','depth','height','depthSize']) || !keys(level.goal.space??{},['plane','depth','height','depthSize']) ||
      spatial.planes.some(p => !keys(p,['id','label','depth','order']) || !['label','order'].every(k=>Object.hasOwn(p,k)) || spatial.projection.originY-(spatial.projection.originY-p.depth)!==p.depth) ||
      level.platforms.some(p => !p.space?.plane || p.space.depthSize !== 20 || p.x+p.width-p.x!==p.width) ||
      !level.actor.space?.plane || !level.goal.space?.plane) return null;
  const positioned=[...level.platforms.map(p=>p.space),...spatial.nodes,level.actor.space,level.goal.space];
  if(positioned.some(s=>!Object.hasOwn(s,'height')||s.depth!==spatial.planes.find(p=>p.id===s.plane)?.depth))return null;
  const used = new Set(), layers = new Map(), points = new Map(), lines = ["import { Level } from '@gothere/core';", '', 'export function createMap(): Level {'];
  const options = {id: level.id};
  for (const key of ['description','hint']) if (Object.hasOwn(level,key)) options[key] = level[key];
  if (spatial.projection.originY !== 620) options.originY = spatial.projection.originY;
  if (world.width !== 1200 || world.height !== 640) options.size = {width: world.width, height: world.height};
  if (JSON.stringify(world.physics) !== JSON.stringify({gravity:900,maxFallSpeed:480})) options.physics = world.physics;
  lines.push(`  const level = new Level(${compact(level.name)}, ${compact(options)});`);
  if (world.groundY !== 440) lines.push(`  level.data.world.groundY = ${world.groundY};`);
  for (const layer of spatial.planes) {
    const name = sourceName(layer.id, 'street', used); layers.set(layer.id,name);
    lines.push(`  const ${name} = level.layer(${compact(layer.id)}, ${compact({label:layer.label,screenY:spatial.projection.originY-layer.depth,order:layer.order})});`);
  }
  lines.push('', '  // 实际承托路面；屏幕位置和离地高度分别定义。');
  for (const platform of level.platforms) {
    const {x,width,space,...extra} = platform;
    if (!keys(space,['plane','depth','height','heightEnd','depthSize']) || ['endHeight','height','from','to'].some(key=>Object.hasOwn(extra,key))) return null;
    lines.push(`  ${layers.get(space.plane)}.ground(${compact({from:x,to:x+width,...(space.height?{height:space.height}:{}),...(space.heightEnd!==undefined?{endHeight:space.heightEnd}:{}),...extra})});`);
  }
  lines.push('', '  // 命名路线点也能被物体的通路能力引用。');
  for (const node of spatial.nodes) {
    const {id,x,plane,depth,height,next,via,...extra} = node;
    const name = sourceName(id, 'point', used); points.set(id,name);
    lines.push(`  const ${name} = level.point(${compact(id)}, ${layers.get(plane)}.at(${x}${height?', { height: '+height+' }':''})${Object.keys(extra).length?', '+compact(extra):''});`);
  }
  const pending = new Set(spatial.nodes.filter(n=>n.next).map(n=>n.id));
  lines.push('', '  // 跨层必须经过显式通路；普通路段只连接同层位置。');
  function chain(id) {
    const steps = [points.get(id)];
    while (pending.has(id)) {
      const node = spatial.nodes.find(n=>n.id===id); pending.delete(id);
      if (node.via) steps.push('level.through('+compact(node.via)+')');
      steps.push(points.get(node.next)); id = node.next;
    }
    if (steps.length>1) lines.push('  level.route('+steps.join(', ')+');');
  }
  chain(spatial.start);for (const id of [...pending]) chain(id);
  lines.push(`  level.startAt(${points.get(spatial.start)});`, '');
  function position(object) {
    const {plane,depth,height,...extra} = object.space;
    const options = {...(height?{height}:{}),...extra};
    return `${layers.get(plane)}.at(${object.x}${Object.keys(options).length?', '+compact(options):''})`;
  }
  const {x:actorX,space:actorSpace,...actor} = level.actor, {x:goalX,space:goalSpace,...goal} = level.goal;
  lines.push(`  level.traveler({ start: ${position(level.actor)}, ${Object.entries(actor).map(([k,v])=>k+': '+compact(v)).join(', ')} });`);
  lines.push(`  level.destination(${position(level.goal)}${Object.keys(goal).length?', '+compact(goal):''});`);
  lines.push('  return level;', '}');
  return lines.join('\n')+'\n';
}

/** Named constructors keep action timing and registration order unchanged. */
export function actionSource(action) {
  const keys = Object.keys(action);
  if (action.type==='set' && keys.every(k=>['type','target','state'].includes(k))) return `Actions.set(${compact(action.target)}, ${compact(action.state)})`;
  if (action.type==='invoke' && keys.every(k=>['type','target','behavior'].includes(k))) return `Actions.invoke(${compact(action.target)}, ${compact(action.behavior)})`;
  if (action.type==='after' && keys.every(k=>['type','ticks','actions'].includes(k))) return `Actions.after(${action.ticks/60}, ${actionsSource(action.actions)})`;
  if (action.type==='move') { const {type,target,ticks,...destination}=action; return `Actions.move(${compact(target)}, ${compact({...destination,seconds:ticks/60})})`; }
  return compact(action);
}
export function actionsSource(actions) { return '['+actions.map(actionSource).join(', ')+']'; }
