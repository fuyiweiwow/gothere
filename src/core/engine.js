import { validateLevel, floorY, eventTypes } from './schema.js';
import { verticalTransport, transportEnabled, landingX } from './transport.js';
export { validateLevel } from './schema.js';
export const TICKS_PER_SECOND = 60;
const clone = (value) => structuredClone(value);
const MAX_TICKS = 36000;

/** Mutable simulation instance; all external data and snapshots are copied. No DOM or wall clock. */
export function createSimulation(input) {
  const validation = validateLevel(input);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  const level = clone(input);
  const stripLayout=list=>{for(const a of list){delete a.editor;if(a.type==='after')stripLayout(a.actions);}};
  for(const rule of level.rules)stripLayout(rule.actions);
  for(const entity of level.entities)for(const behavior of entity.behaviors??[])stripLayout(behavior.actions);
  let state, pending, inputs, serial, actionBudget, contacts, connectorLock, invokeDepth;
  const emit = (message, kind = 'action') => {
    state.events.push({ tick: state.tick, message, kind });
    if (state.events.length > 24) state.events.shift();
  };
  const reset = () => {
    state = { tick: 0, status: 'ready', reason: null,
      actor: { x: level.actor.x, y:floorY(level.actor), direction:level.actor.direction??1, holding:null, mode:'walking', connector:null },
      entities: Object.fromEntries(level.entities.map((e) => [e.id, { ...e, y:floorY(e), width: e.width ?? 28,
        ...(e.kind==='hazard'?{contact:{effect:'lethal'}}:{}),
        ...(e.kind==='lift'?{carY:e.state==='upper'?e.toY:floorY(e)}:{}), ...(e.motion?{motionDirection:1}:{}) }])),
      events: [], clicks: 0, timers: [] };
    pending = []; inputs = []; serial = 0; contacts=new Set();connectorLock=null;invokeDepth=0;
    return api;
  };
  const actions = (list, invocation=null) => {
    for (const action of list) {
      if (state.status !== 'running') return;
      if (--actionBudget < 0 || (action.type === 'after' && state.timers.length >= 256)) {
        lose('limit', '机关规则太忙了。请减少重复触发或延迟动作，再重新出发。');
        return;
      }
      if (action.type === 'set') {
        const entity = state.entities[action.target];
        if (entity.state !== action.state) {
          entity.state = action.state;
          emit(entity.label + ' → ' + stateLabel(entity.state));
        }
      } else if (action.type==='hold') {
        const e=state.entities[action.target], a=state.actor;
        if (a.holding===null && a.connector!==e.id && e.state==='active' && a.y===e.y && a.x+24>=e.x && a.x-24<=e.x+e.width) {
          a.holding=e.id;emit('拿上了'+e.label);
        }
      } else if (action.type==='drop') {
        const a=state.actor,e=a.holding===null?null:state.entities[a.holding];
        if(e){e.x=Math.max(25,Math.min(1200-e.width,a.x-a.direction*(e.width+24)));e.y=a.y;
          a.holding=null;emit('放下了'+e.label);}
      } else if (action.type==='hurt') {
        lose('hurt', action.message??'碰上了一个不太友好的东西。下次换个办法打招呼。');
      } else if (action.type==='turn') {
        state.actor.direction=action.direction;
      } else if (action.type==='invoke') {
        if(invokeDepth>=32 || (invocation?.depth??0)>=32){lose('limit','行为连线循环过深，请检查循环连接。');return;}
        const b=state.entities[action.target].behaviors.find(b=>b.id===action.behavior);
        if(invocation)invocation.remaining++;
        invokeDepth++;
        execute(b.actions,{source:action.target,behavior:b.id,remaining:1,parent:invocation,depth:(invocation?.depth??0)+1});
        invokeDepth--;
      } else {
        if(invocation)invocation.remaining++;
        state.timers.push({ due: state.tick + action.ticks, order: serial++, actions: clone(action.actions), ...(invocation?{invocation}:{}) });
      }
    }
  };
  const complete=invocation=>{
    if(invocation && --invocation.remaining===0 && state.status==='running'){
      trigger('done',invocation.source,invocation.behavior);
      complete(invocation.parent);
    }
  };
  const execute=(list,invocation=null)=>{
    actions(list,invocation);
    complete(invocation);
  };
  const trigger = (type, source, behavior) => {
    // Each rule observes the results of earlier rules in declaration order.
    for (const rule of level.rules) {
      if (state.status !== 'running') return;
      if (rule.on.type === type && rule.on.source === source && (type!=='done'||rule.on.behavior===behavior) &&
        (rule.if ?? []).every((condition) => Object.hasOwn(condition,'holding') ? state.actor.holding===condition.holding :
          state.entities[condition.entity].state === condition.state)) {
        actions(rule.actions);
      }
    }
  };
  const supported = (from, to) => {
    const spans = [...level.platforms.filter(p=>floorY(p)===state.actor.y).map((p) => [p.x, p.x + p.width]),
      ...Object.values(state.entities).filter((e) => e.y===state.actor.y && e.kind === 'bridge' && e.state === 'extended')
        .map((e) => [e.x, e.x + e.width]),
      ...Object.values(state.entities).filter((e) => e.kind==='lift' && e.carY===state.actor.y)
        .map((e) => [e.x, e.x + e.width])].sort((a, b) => a[0] - b[0]);
    let covered = from;
    for (const [left, right] of spans) {
      if (right < covered) continue;
      if (left > covered + 0.000001) return false;
      covered = Math.max(covered, right);
      if (covered >= to) return true;
    }
    return false;
  };
  const lose = (reason, message) => { state.status = 'lost'; state.reason = reason; emit(message, 'lost'); };
  const approach=(from,to,amount)=>from<to?Math.min(to,from+amount):Math.max(to,from-amount);
  const syncHeld=()=>{const a=state.actor,e=a.holding===null?null:state.entities[a.holding];if(e){e.x=a.x+a.direction*18-e.width/2;const t=verticalTransport(e);if(t)t.toY+=a.y-e.y;e.y=a.y;}};
  function updateMotion() {
    for(const e of Object.values(state.entities)) {
      e.previousX=e.x;
      if(e.kind==='lift')e.carY=approach(e.carY,e.state==='upper'?e.toY:e.y,e.speed/60);
      if(e.motion && e.state==='active' && state.actor.holding!==e.id) {
        const m=e.motion;let x=Math.max(m.minX,Math.min(m.maxX,e.x))+e.motionDirection*m.speed/60;
        if(x>m.maxX){x=2*m.maxX-x;e.motionDirection=-1;}
        if(x<m.minX){x=2*m.minX-x;e.motionDirection=1;}
        e.x=x;
      }
    }
  }
  function finishConnection(e) {
    const a=state.actor,t=verticalTransport(e)??e;
    if(verticalTransport(e))a.x=landingX(level,e,a.y,a.x)??a.x;
    a.direction=a.y===t.toY?(t.upperDirection??a.direction):(t.lowerDirection??a.direction);
    a.mode='walking';a.connector=null;connectorLock=e.id;emit('经过了'+e.label);trigger('arrive',e.id);
  }
  function moveActor() {
    const a=state.actor, from=a.x;
    if(a.connector) {
      const e=state.entities[a.connector];
      if(a.mode==='climbing') {
        a.y=approach(a.y,a.destinationY,verticalTransport(e).speed/60);
        if(a.y===a.destinationY){delete a.destinationY;finishConnection(e);}
      } else {
        a.y=e.carY;
        if(a.y!==a.boardY)a.departed=true;
        if((a.y===e.y || a.y===e.toY) && (a.departed || (e.state==='upper'?e.toY:e.y)===a.y)){
          delete a.boardY;delete a.departed;finishConnection(e);
        }
      }
      return [a.x,a.x,false];
    }
    if(connectorLock) {
      const e=state.entities[connectorLock];
      if(Math.abs(a.x-e.x-e.width/2)>e.width/2+12)connectorLock=null;
    }
    let to=Math.round((from+a.direction*level.actor.speed/60)*1e6)/1e6;
    if(a.y===floorY(level.goal) && (level.goal.x-from)*a.direction>=0 && (level.goal.x-to)*a.direction<=0)to=level.goal.x;
    const candidate=Object.values(state.entities).filter(e=>e.id!==connectorLock&&e.id!==a.holding&&
      (transportEnabled(e)||(e.kind==='lift'&&e.carY===a.y))&&(a.y===e.y||a.y===(verticalTransport(e)??e).toY))
      .map(e=>({entity:e,x:verticalTransport(e)?landingX(level,e,a.y,e.kind==='object'?from:e.x+e.width/2):e.x+e.width/2}))
      .filter(c=>c.x!==null&&(c.x-from)*a.direction>=0&&(c.x-to)*a.direction<=0)
      .sort((a,b)=>Math.abs(a.x-from)-Math.abs(b.x-from))[0];
    if(candidate) {
      const connector=candidate.entity,t=verticalTransport(connector);
      to=candidate.x;a.x=to;a.connector=connector.id;
      if(t){a.mode='climbing';a.destinationY=a.y===connector.y?t.toY:connector.y;}
      else {
        a.mode='riding';a.boardY=a.y;emit('搭上了'+connector.label);trigger('board',connector.id);
        if((connector.state==='upper'?connector.toY:connector.y)===a.y){
          a.mode='walking';a.connector=null;delete a.boardY;connectorLock=connector.id;
        }
      }
    }
    a.x=to;return [from,to,true];
  }
  const advance = () => {
    state.tick++;
    actionBudget = 1024;
    const due = state.timers.filter((timer) => timer.due <= state.tick)
      .sort((a, b) => a.due - b.due || a.order - b.order);
    state.timers = state.timers.filter((timer) => timer.due > state.tick);
    for (const timer of due) execute(timer.actions,timer.invocation);
    if (state.status !== 'running') { pending = []; return; }
    for (const source of pending) {
      if (state.status !== 'running') break;
      state.clicks++; inputs.push({ tick: state.tick, source }); trigger('click', source);
    }
    pending = [];
    if (state.status !== 'running') return;
    updateMotion();
    const [from,to,walked]=moveActor(), a=state.actor;
    if(state.status!=='running')return;
    syncHeld();
    const touching=new Set();
    for (const entity of Object.values(state.entities)) {
      const sameFloor=entity.y===a.y || ((verticalTransport(entity)||entity.kind==='lift')&&(verticalTransport(entity)??entity).toY===a.y) ||
        (entity.kind==='lift' && entity.carY===a.y);
      if(entity.id===a.holding || !sameFloor || (entity.kind==='object' && entity.state!=='active') || (entity.kind==='zone' && entity.state!=='enabled'))continue;
      const left=Math.min(from,to),right=Math.max(from,to);
      if(right+10<Math.min(entity.previousX,entity.x) || left-10>Math.max(entity.previousX,entity.x)+entity.width)continue;
      touching.add(entity.id);
      if(!contacts.has(entity.id) && entity.kind!=='zone')trigger('contact',entity.id);
      if(!contacts.has(entity.id) && entity.kind==='zone')trigger('enter',entity.id);
      if(state.status!=='running')return;
      if(entity.id!==a.holding && !['inactive','disabled','stopped'].includes(entity.state) && entity.contact?.effect==='lethal'){
        lose('hurt',entity.contact.message??'碰到了危险物。');return;
      }
      if(entity.kind==='zone'){
        continue;
      }
      if (entity.kind === 'plate' && entity.state === 'idle' && right >= entity.x && left <= entity.x + entity.width) {
        entity.state = 'pressed'; emit('踩下了' + entity.label); trigger('enter', entity.id);
      }
    }
    contacts=touching;
    if (state.status !== 'running') return;
    if (walked && !supported(Math.min(from,to),Math.max(from,to))) { lose('fall', '脚下的路临时请假了。试试先把桥放下来。'); return; }
    for (const entity of Object.values(state.entities)) {
      if (entity.y!==a.y || Math.max(from,to) + 10 < entity.x || Math.min(from,to) - 10 > entity.x + entity.width) continue;
      if (entity.kind === 'gate' && entity.state === 'closed') {
        lose('gate', '门：此路暂时不通。先找个办法打开它。'); return;
      }
    }
    syncHeld();
    if (a.mode==='walking' && a.y===floorY(level.goal) && Math.min(from,to)<=level.goal.x && Math.max(from,to)>=level.goal.x) {
      state.status = 'won'; emit('到了！就说一定能到这里。', 'won'); }
    else if(a.x<=20 || a.x>=1180 || a.y<=0 || a.y>=640)lose('boundary','走得太投入，碰到了地图边界。调整路线再试试。');
    else if (state.tick >= MAX_TICKS) lose('timeout', '这段路走成了长征。歇一下，重新出发吧。');
  };
  const api = {
    start() { if (['ready', 'paused'].includes(state.status)) state.status = 'running'; return api; },
    pause() { if (state.status === 'running') state.status = 'paused'; return api; },
    click(source) {
      if (state.status !== 'running' || pending.length >= 32) return false;
      const entity = state.entities[source];
      if (!entity || !eventTypes(entity).includes('click')) return false;
      pending.push(source); return true;
    },
    step(count = 1) {
      if (!Number.isInteger(count) || count < 0 || count > MAX_TICKS) throw new Error('步数必须为 0～36000 的整数。');
      for (let i = 0; i < count && state.status === 'running'; i++) advance();
      return api;
    },
    singleStep() {
      if (['ready', 'paused'].includes(state.status)) {
        state.status = 'running'; advance();
        if (state.status === 'running') state.status = 'paused';
      }
      return api;
    },
    reset,
    snapshot: () => clone(state),
    recording: () => ({ schemaVersion: 1, levelId: level.id, inputs: clone(inputs), untilTick: state.tick, status: state.status }),
  };
  return reset();
}

export function replayRecording(level, recording) {
  if (!recording || recording.schemaVersion !== 1 || recording.levelId !== level.id ||
    !Number.isInteger(recording.untilTick) || recording.untilTick < 0 || recording.untilTick > MAX_TICKS ||
    !Array.isArray(recording.inputs) || recording.inputs.length > MAX_TICKS ||
    !['ready', 'running', 'paused', 'lost', 'won'].includes(recording.status)) throw new Error('回放格式或关卡不匹配。');
  let previous = 0;
  for (const input of recording.inputs) {
    if (!input || !Number.isInteger(input.tick) || input.tick < 1 || input.tick < previous ||
      input.tick > recording.untilTick || typeof input.source !== 'string') throw new Error('回放操作序列不合法。');
    previous = input.tick;
  }
  const game = createSimulation(level); game.start(); let index = 0;
  for (let tick = 1; tick <= recording.untilTick; tick++) {
    while (recording.inputs[index]?.tick === tick) {
      if (!game.click(recording.inputs[index++].source)) throw new Error('回放包含不可执行的机关操作。');
    }
    game.step();
    if (['won', 'lost'].includes(game.snapshot().status) && tick < recording.untilTick) throw new Error('回放在结束后仍包含时间或操作。');
  }
  if (recording.status === 'paused') game.pause();
  if (recording.status === 'ready' && recording.untilTick === 0) game.reset();
  if (game.snapshot().status !== recording.status) throw new Error('回放结果与记录不一致。');
  return game;
}

export function stateLabel(state) {
  return ({ off: '待触发', on: '已触发', folded: '收起', extended: '已铺好', closed: '关闭',
    open: '开启', running: '转动中', stopped: '已停下', idle: '等待踩下', pressed: '已踩下',
    active:'生效',inactive:'休息',enabled:'可通行',disabled:'停用',lower:'驶往下层',upper:'驶往上层' })[state] ?? state;
}
