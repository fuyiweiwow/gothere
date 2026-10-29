import { verticalTransport, landingX } from './transport.js';
import { surfaceHeight, collectSurfaces } from './surfaces.js';
import { poseInBounds } from './pose.js';
import {validateScene} from './scene-schema.js';

export const STATES = Object.freeze({
  switch: ['off', 'on'], bridge: ['folded', 'extended'], gate: ['closed', 'open'],
  hazard: ['running', 'stopped'], plate: ['idle', 'pressed'],
  object: ['active', 'inactive'], zone: ['enabled', 'disabled'], ladder: ['enabled', 'disabled'], lift: ['lower', 'upper'],
});
export const SKINS = Object.freeze({axe:'斧子',crate:'箱子',crocodile:'鳄鱼',orb:'小圆球'});
export const floorY = (value) => value?.y ?? 440;
export const eventTypes = (source) => {const kind=typeof source==='string'?source:source?.kind;return [...(kind==='object'?['contact','click']:['switch','hazard'].includes(kind)?['click']:[]),
  ...(kind==='plate'||kind==='zone'?['enter']:[]), ...(['zone','object'].includes(kind)?[]:['contact']),
  ...(kind==='lift'?['board','arrive']:[]), ...(kind==='ladder'||(kind==='object'&&verticalTransport(source))?['arrive']:[]),
  ...(typeof source==='object'&&source?.pose?['rotated']:[]),
  ...(source?.body||source?.supportProbe?['supportlost']:[]),...(source?.body?['landed']:[]),
  ...(source?.supportProbe?['supportfound']:[]),...(source?.collider||source?.surface?['impact','actorlanded']:[]), 'done'];};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const idPattern = /^[a-z][a-z0-9-]{0,47}$/;

/** Validate the supported DSL, including every reference, before simulation. */
export function validateLevel(input) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  if (!object(input)) return { valid: false, errors: ['关卡必须是一个 JSON 对象。'] };
  errors.push(...validateScene(input));
  check(input.schemaVersion === 1, 'schemaVersion 必须为 1。');
  check(text(input.id, 48) && idPattern.test(input.id), 'id 必须是小写英文、数字或短横线，以字母开头。');
  check(text(input.name, 60), 'name 必须是 1～60 字的关卡名称。');
  check(text(input.description, 300), 'description 必须是 1～300 字的玩法说明。');
  check(input.hint === undefined || text(input.hint, 500), 'hint 必须是 1～500 字的提示。');
  const world = input.world;
  check(object(world) && world.width === 1200 && world.height === 640 && world.groundY === 440,
    '当前版本 world 必须为 {width:1200,height:640,groundY:440}。');
  if (world?.physics !== undefined) check(object(world.physics) && number(world.physics.gravity,60,3600) &&
    number(world.physics.maxFallSpeed,60,1800), 'world.physics 需要 gravity（60～3600）和 maxFallSpeed（60～1800）。');
  check(object(input.actor) && number(input.actor.x, 20, 1150) && number(input.actor.speed, 15, 180),
    'actor 需要合法的 x（20～1150）和 speed（15～180，单位/秒）。');
  check(object(input.goal) && number(input.goal.x, 40, 1180), 'goal.x 必须为 40～1180。');
  for (const [name, value] of [['actor',input.actor],['goal',input.goal]]) {
    check(object(value) && (value.y===undefined || number(value.y,160,560)), name + '.y 必须为 160～560 的脚底高度（默认 440）。');
  }
  check(input.actor?.direction === undefined || [-1,1].includes(input.actor.direction), 'actor.direction 必须为 -1 或 1。');
  check(input.actor?.maxLandingSpeed===undefined || (Boolean(world?.physics)&&number(input.actor.maxLandingSpeed,60,1800)),
    '安全落地速度需要重力模式及 60～1800 的数值。');
  const platforms = input.platforms;
  check(Array.isArray(platforms) && platforms.length > 0 && platforms.length <= 64, 'platforms 必须包含 1～64 段地面。');
  if (Array.isArray(platforms)) {
    platforms.slice(0, 65).forEach((p, index) => check(object(p) && number(p.x, 0, 1200) &&
      number(p.width, 1, 1200) && p.x + p.width <= 1200 && (p.y===undefined || number(p.y,160,560)) &&
      (p.yEnd===undefined || (Boolean(world?.physics) && number(p.yEnd,160,560))),
      'platforms[' + index + '] 的范围不合法；斜面右端 yEnd 需在 160～560，并启用重力模式。'));
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
      check(entity.height===undefined||number(entity.height,8,240),'实体 height 必须为 8～240：'+entity.id);
      if(entity.presentation!==undefined){const p=entity.presentation;check(object(p)&&['block','cloud','beam','umbrella','pot','creature','support'].includes(p.symbol)&&
        typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)&&['none','bob','pulse'].includes(p.animation),'表现需要合法图形、六位颜色和动画类型：'+entity.id);}
      if(entity.supportProbe!==undefined)check(entity.kind==='object'&&object(entity.supportProbe)&&number(entity.supportProbe.at,0,1)&&
        entity.body===undefined&&Boolean(world?.physics),'支撑检测需要 at（0～1），不与动态重力组合，并需要重力模式：'+entity.id);
      if(entity.carriedPhysics!==undefined)check(entity.kind==='object'&&object(entity.carriedPhysics)&&number(entity.carriedPhysics.gravityScale,0.05,1)&&
        number(entity.carriedPhysics.maxFallSpeed,60,1800)&&Boolean(world?.physics),'持有时下落需要 gravityScale（0.05～1）、maxFallSpeed（60～1800）及重力模式：'+entity.id);
      if(entity.collider!==undefined){
        check(entity.kind==='object'&&object(entity.collider)&&typeof entity.collider.enabled==='boolean','矩形碰撞体需要 collider.enabled 布尔值：'+entity.id);
        check(entity.pose===undefined&&entity.transport===undefined,'矩形碰撞体暂不与姿态或高度通道组合：'+entity.id);
        check(Boolean(world?.physics),'矩形碰撞体需要启用重力模式。');
      }
      if(entity.body!==undefined){
        check(entity.kind==='object'&&object(entity.body)&&entity.body.type==='dynamic'&&object(entity.collider),'动态物体需要 body.type=dynamic 和矩形碰撞体：'+entity.id);
        check(entity.motion===undefined,'动态物体暂不支持左右巡逻：'+entity.id);
      }
      if(entity.pose!==undefined){
        check(entity.kind==='object'&&object(entity.pose)&&number(entity.pose.angle,-75,75)&&number(entity.pose.pivot,0,1),
          'pose 需要 angle（-75～75 度）和 pivot（0～1 的支点位置）：'+entity.id);
        check(poseInBounds(entity),'物体姿态端点必须在地图范围内，Y 为 160～560：'+entity.id);
        check(entity.transport===undefined,'姿态与高度通道暂不组合：'+entity.id);
      }
      if(entity.surface!==undefined){
        check(entity.kind==='object'&&object(entity.surface)&&typeof entity.surface.enabled==='boolean'&&object(entity.pose),
          '承托面需要通用物体的 pose 和 surface.enabled 布尔值：'+entity.id);
        check(Boolean(world?.physics),'承托面需要启用重力模式。');
      }
      if(entity.transport!==undefined){
        const t=entity.transport;
        check(entity.kind==='object'&&object(t)&&t.type==='vertical','transport 只能是通用物体的 vertical 高度移动能力：'+entity.id);
        check(object(t)&&number(t.toY,160,520)&&t.toY<=floorY(entity)-40,'高度通道的上端 Y 必须比下端至少高 40：'+entity.id);
        check(object(t)&&number(t.speed,15,180),'高度通道 speed 必须为 15～180：'+entity.id);
        for(const key of ['upperDirection','lowerDirection'])check(object(t)&&(t[key]===undefined||[-1,1].includes(t[key])),'高度通道 '+key+' 必须为 -1 或 1。');
        check(entity.motion===undefined,'高度通道不能同时左右巡逻；先关闭巡逻再启用高度移动。');
      }
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
      } else if (action.type === 'rotate') {
        const entity=byId.get(action.target);
        check(Boolean(entity?.kind==='object'&&object(entity.pose)),'rotate 目标需要姿态能力。');
        check(number(action.angle,-75,75)&&Number.isInteger(action.ticks)&&number(action.ticks,1,3600),
          'rotate 需要 angle（-75～75 度）和 ticks（1～3600 整数）。');
        check(!entity||poseInBounds(entity,action.angle),'rotate 的目标端点超出地图高度范围：'+String(action.target));
      } else if (action.type === 'enable') {
        check(['collider','surface'].includes(action.capability)&&object(byId.get(action.target)?.[action.capability])&&typeof action.enabled==='boolean',
          'enable 需要已定义的 collider/surface 能力和 enabled 布尔值。');
      } else errors.push('未知动作类型：' + String(action.type));
    }
  };
  check(Array.isArray(input.rules) && input.rules.length <= 128, 'rules 必须为最多 128 项的数组。');
  if (Array.isArray(input.rules)) {
    input.rules.slice(0, 129).forEach((rule, index) => {
      if (!object(rule)) { errors.push('rules[' + index + '] 必须是对象。'); return; }
      const source = object(rule.on) ? byId.get(rule.on.source) : null;
      check(Boolean(source && eventTypes(source).includes(rule.on.type)), 'rules[' + index + '] 的事件源或事件类型无效。');
      if(rule.on?.type==='done')check(Array.isArray(source?.behaviors) && source.behaviors.some(b=>b?.id===rule.on.behavior),'done 需要指定已定义的行为。');
      if(rule.on?.other!==undefined)check(rule.on.type==='impact'&&Boolean(byId.get(rule.on.other)?.body),'impact.other 需要引用动态物体。');
      if (rule.if !== undefined) conditionsValid(rule.if, 'rules[' + index + ']');
      actionsValid(rule.actions);
    });
  }
  for(const e of byId.values())if(Array.isArray(e.behaviors))for(const b of e.behaviors.slice(0,17))if(object(b))actionsValid(b.actions);
  if (errors.length === 0) {
    const surfaces=collectSurfaces(input,Object.fromEntries(entities.map(e=>[e.id,{...e,...(e.kind==='lift'?{carY:e.state==='upper'?e.toY:floorY(e)}:{})}])));
    const supported = (x,y) => surfaces.some(p => {const height=surfaceHeight(p,x);return height!==null&&Math.abs(height-y)<1e-7;});
    check(supported(input.actor.x,floorY(input.actor)), '角色起点需要位于对应高度的地面上。');
    check(supported(input.goal.x,floorY(input.goal)), '终点需要位于对应高度的地面上。');
    for (const e of entities.filter(e=>verticalTransport(e)||e.kind==='lift')) {
      const t=verticalTransport(e)??e;
      for(const [end,y] of [['下端',floorY(e)],['上端',t.toY]])check(landingX(input,e,y)!==null,e.label+'（'+e.id+'）'+end+' Y='+y+' 未连接路面；移动端点吸附路面，或延长该层路面至通道范围内。');
    }
  }
  return { valid: errors.length === 0, errors };
}
