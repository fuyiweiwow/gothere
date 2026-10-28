export const STATES = Object.freeze({
  switch: ['off', 'on'], bridge: ['folded', 'extended'], gate: ['closed', 'open'],
  hazard: ['running', 'stopped'], plate: ['idle', 'pressed'],
  object: ['active', 'inactive'], zone: ['enabled', 'disabled'], ladder: ['enabled', 'disabled'], lift: ['lower', 'upper'],
});
export const SKINS = Object.freeze({axe:'斧子',crate:'箱子',crocodile:'鳄鱼',orb:'小圆球'});
export const floorY = (value) => value?.y ?? 440;
export const eventTypes = (kind) => [...(kind==='object'?['contact','click']:['switch','hazard'].includes(kind)?['click']:[]),
  ...(kind==='plate'||kind==='zone'?['enter']:[]), ...(['zone','object'].includes(kind)?[]:['contact']),
  ...(kind==='lift'?['board','arrive']:[]), ...(kind==='ladder'?['arrive']:[]), 'done'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const idPattern = /^[a-z][a-z0-9-]{0,47}$/;

/** Validate the supported DSL, including every reference, before simulation. */
export function validateLevel(input) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  if (!object(input)) return { valid: false, errors: ['关卡必须是一个 JSON 对象。'] };
  check(input.schemaVersion === 1, 'schemaVersion 必须为 1。');
  check(text(input.id, 48) && idPattern.test(input.id), 'id 必须是小写英文、数字或短横线，以字母开头。');
  check(text(input.name, 60), 'name 必须是 1～60 字的关卡名称。');
  check(text(input.description, 300), 'description 必须是 1～300 字的玩法说明。');
  check(input.hint === undefined || text(input.hint, 500), 'hint 必须是 1～500 字的提示。');
  const world = input.world;
  check(object(world) && world.width === 1200 && world.height === 640 && world.groundY === 440,
    '当前版本 world 必须为 {width:1200,height:640,groundY:440}。');
  check(object(input.actor) && number(input.actor.x, 20, 1150) && number(input.actor.speed, 15, 180),
    'actor 需要合法的 x（20～1150）和 speed（15～180，单位/秒）。');
  check(object(input.goal) && number(input.goal.x, 40, 1180), 'goal.x 必须为 40～1180。');
  for (const [name, value] of [['actor',input.actor],['goal',input.goal]]) {
    check(object(value) && (value.y===undefined || number(value.y,160,560)), name + '.y 必须为 160～560 的脚底高度（默认 440）。');
  }
  check(input.actor?.direction === undefined || [-1,1].includes(input.actor.direction), 'actor.direction 必须为 -1 或 1。');
  const platforms = input.platforms;
  check(Array.isArray(platforms) && platforms.length > 0 && platforms.length <= 64, 'platforms 必须包含 1～64 段地面。');
  if (Array.isArray(platforms)) {
    platforms.slice(0, 65).forEach((p, index) => check(object(p) && number(p.x, 0, 1200) &&
      number(p.width, 1, 1200) && p.x + p.width <= 1200 && (p.y===undefined || number(p.y,160,560)), 'platforms[' + index + '] 的范围不合法。'));
  }
  const entities = input.entities;
  check(Array.isArray(entities) && entities.length <= 64, 'entities 必须为最多 64 项的数组。');
  const byId = new Map();
  let imageBytes=0;
  if (Array.isArray(entities)) {
    entities.slice(0, 65).forEach((entity, index) => {
      if (!object(entity)) { errors.push('entities[' + index + '] 必须是对象。'); return; }
      check(text(entity.id, 48) && idPattern.test(entity.id) && !byId.has(entity.id), '实体 id 无效或重复：' + String(entity.id));
      check(Object.hasOwn(STATES, entity.kind), '未知实体类型：' + String(entity.kind));
      check(Object.hasOwn(STATES, entity.kind) && STATES[entity.kind].includes(entity.state), '实体初始状态无效：' + String(entity.id));
      check(number(entity.x, 25, 1175) && (entity.width === undefined || number(entity.width, 8, 600)) &&
        entity.x + (entity.width ?? 28) <= 1200, '实体位置或宽度无效：' + String(entity.id));
      check(text(entity.label, 30), '实体需要 1～30 字的 label：' + String(entity.id));
      check(entity.y===undefined || number(entity.y,160,560), '实体 y 必须为 160～560：' + String(entity.id));
      if(entity.contact!==undefined){
        check(object(entity.contact) && entity.contact.effect==='lethal', '实体 contact.effect 只能为 lethal：' + entity.id);
        check(object(entity.contact) && (entity.contact.message===undefined || text(entity.contact.message,120)), '实体 contact.message 最多 120 字：' + entity.id);
      }
      if(entity.behaviors!==undefined){
        check(Array.isArray(entity.behaviors) && entity.behaviors.length<=16,'每个物体最多定义 16 个行为。');
        const ids=new Set();
        if(Array.isArray(entity.behaviors))for(const b of entity.behaviors.slice(0,17)){
          check(object(b) && text(b.id,48) && idPattern.test(b.id) && !ids.has(b.id) && text(b.label,30),'行为需要唯一 id 和名称。');
          if(object(b))ids.add(b.id);
        }
      }
      if (['ladder','lift'].includes(entity.kind)) {
        check(number(entity.toY,160,540) && entity.toY <= floorY(entity)-40, '连接设施的 toY 必须比 y 至少高 40：' + entity.id);
        check(number(entity.speed,15,180), '连接设施 speed 必须为 15～180：' + entity.id);
        for (const key of ['upperDirection','lowerDirection']) check(entity[key] === undefined || [-1,1].includes(entity[key]), key + ' 必须为 -1 或 1。');
      }
      if (entity.appearance !== undefined) {
        const a=entity.appearance;
        if(typeof a?.image==='string')imageBytes+=a.image.length;
        check(object(a) && Object.hasOwn(SKINS,a.skin), '未知外观：' + entity.id);
        if (object(a) && a.image !== undefined) check(typeof a.image==='string' && a.image.length<=32768 &&
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.image), '自定义贴图只接受最多 32 KiB 的内嵌 PNG/JPEG/WebP。');
      }
      if (entity.motion !== undefined) {
        const m=entity.motion;
        check(entity.kind==='object' && object(m) && m.type==='patrol' && number(m.minX,25,1175) &&
          number(m.maxX,m.minX+10,1200-(entity.width??28)) && number(entity.x,m.minX,m.maxX) &&
          number(m.speed,15,180), '巡逻范围、速度或物件位置无效：' + entity.id);
      }
      byId.set(entity.id, entity);
    });
  }
  check(imageBytes<=98304, '一张地图的内嵌贴图总计不能超过 96 KiB。');
  const conditionsValid = (conditions, where) => {
    check(Array.isArray(conditions) && conditions.length <= 16, where + ' 的 if 必须是最多 16 项的数组。');
    if (!Array.isArray(conditions)) return;
    for (const condition of conditions.slice(0, 17)) {
      const entity = object(condition) ? byId.get(condition.entity) : null;
      const held=object(condition) && Object.hasOwn(condition,'holding');
      check(Boolean(held ? (condition.holding===null || byId.get(condition.holding)?.kind==='object') :
        entity && Object.hasOwn(STATES, entity.kind) && STATES[entity.kind].includes(condition.state)),
        where + ' 的条件引用或状态无效。');
    }
  };
  let actionCount = 0;
  const actionsValid = (actions, depth = 0) => {
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > 32 || depth > 4) {
      errors.push('actions 需要 1～32 项，after 嵌套最多 4 层。'); return;
    }
    for (const action of actions.slice(0, 33)) {
      actionCount++;
      if (actionCount > 512) { errors.push('关卡动作总数不能超过 512。'); return; }
      if (!object(action)) { errors.push('动作必须是对象。'); continue; }
      if(action.editor!==undefined)check(object(action.editor) && Array.isArray(action.editor.waypoints) &&
        action.editor.waypoints.length<=16 && action.editor.waypoints.every(p=>object(p)&&number(p.x,0,1200)&&number(p.y,20,620)),
        '连线转接点需要合法坐标，每条最多 16 个。');
      if (action.type === 'set') {
        const entity = byId.get(action.target);
        check(Boolean(entity && Object.hasOwn(STATES, entity.kind) && STATES[entity.kind].includes(action.state)),
          'set 动作的目标或状态无效：' + String(action.target));
      } else if (action.type === 'after') {
        check(Number.isInteger(action.ticks) && number(action.ticks, 1, 3600), 'after.ticks 必须是 1～3600 的整数。');
        actionsValid(action.actions, depth + 1);
      } else if (action.type === 'hold') {
        check(byId.get(action.target)?.kind==='object', 'hold 目标必须是物件。');
      } else if (action.type === 'drop') {
        // One hand slot. Dropping an empty slot is harmless.
      } else if (action.type === 'hurt') {
        check(action.message===undefined || text(action.message,120), 'hurt.message 最多 120 字。');
      } else if (action.type === 'turn') {
        check([-1,1].includes(action.direction),'turn.direction 必须为 -1 或 1。');
      } else if (action.type === 'invoke') {
        check(Array.isArray(byId.get(action.target)?.behaviors) && byId.get(action.target).behaviors.some(b=>b?.id===action.behavior),'invoke 的目标行为不存在。');
      } else errors.push('未知动作类型：' + String(action.type));
    }
  };
  check(Array.isArray(input.rules) && input.rules.length <= 128, 'rules 必须为最多 128 项的数组。');
  if (Array.isArray(input.rules)) {
    input.rules.slice(0, 129).forEach((rule, index) => {
      if (!object(rule)) { errors.push('rules[' + index + '] 必须是对象。'); return; }
      const source = object(rule.on) ? byId.get(rule.on.source) : null;
      check(Boolean(source && eventTypes(source.kind).includes(rule.on.type)), 'rules[' + index + '] 的事件源或事件类型无效。');
      if(rule.on?.type==='done')check(Array.isArray(source?.behaviors) && source.behaviors.some(b=>b?.id===rule.on.behavior),'done 需要指定已定义的行为。');
      if (rule.if !== undefined) conditionsValid(rule.if, 'rules[' + index + ']');
      actionsValid(rule.actions);
    });
  }
  for(const e of byId.values())if(Array.isArray(e.behaviors))for(const b of e.behaviors.slice(0,17))if(object(b))actionsValid(b.actions);
  if (errors.length === 0) {
    const supported = (x,y) => platforms.some((p) => floorY(p)===y && x >= p.x && x <= p.x + p.width);
    check(supported(input.actor.x,floorY(input.actor)), '角色起点需要位于对应高度的地面上。');
    check(supported(input.goal.x,floorY(input.goal)), '终点需要位于对应高度的地面上。');
    for (const e of entities.filter(e=>['ladder','lift'].includes(e.kind))) {
      const x=e.x+(e.width??28)/2;
      const landing=(y)=>platforms.some(p=>floorY(p)===y && p.x<=e.x+(e.width??28) && p.x+p.width>=e.x);
      check(e.kind==='lift'?(landing(floorY(e)) && landing(e.toY)):(supported(x,floorY(e)) && supported(x,e.toY)), '梯子/电梯的上下出口都需要地面：' + e.id);
    }
  }
  return { valid: errors.length === 0, errors };
}
