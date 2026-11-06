/** Object-oriented authoring facade. Keep this factory self-contained for module Workers. */
export function createAuthoringLibrary(createAPI, blank) {
  const finite = (value, name) => { if (!Number.isFinite(value)) throw new Error(name + '必须是有限数值。'); return value; };
  const own = (level, value, Type) => {
    if (!(value instanceof Type) || value.level !== level) throw new Error('请使用同一关卡中的' + Type.name + '引用。');
    return value;
  };
  function createObject(level, id, options) {
    const {at, size, ...rest} = options;
    return level.api.object(id, {...rest, ...(size ?? {}), ...(at ? {x: own(level, at, Position).x, space: at.space()} : {})});
  }

  class Level {
    constructor(definition = blank, options = {}) {
      if (typeof definition === 'string') {
        const {id = 'authored-level', originY = 620, size, physics, ...metadata} = options;
        this.data = {schemaVersion: 3, id, name: definition, description: blank.description, ...structuredClone(metadata),
          world: {...structuredClone(blank.world), ...(size ?? {}), physics: {...blank.world.physics, ...physics}},
          spatial: {mode: 'layered', projection: {originY, depthX: 0, depthY: -1}, planes: [], nodes: []},
          actor: {}, goal: {}, platforms: [], entities: [], rules: []};
      } else this.data = structuredClone(definition);
      this.api = createAPI(this.data);
      this.serial = 0;
    }
    requireLayered() { if (this.data.schemaVersion !== 3) throw new Error('地图快捷 API 需要二维分层关卡，旧关卡仍可使用完整定义。'); }
    layer(id, options) {
      this.requireLayered();
      const found = this.data.spatial.planes.find(p => p.id === id);
      if (options === undefined) { if (!found) throw new Error('找不到行走层：' + id); return new Layer(this, found); }
      if (found) throw new Error('行走层标识重复：' + id);
      const {screenY, label = id, order = this.data.spatial.planes.length} = options;
      const data = {id, label, depth: this.data.spatial.projection.originY - finite(screenY, '路面画面 Y'), order};
      this.data.spatial.planes.push(data); return new Layer(this, data);
    }
    point(id, position, options = {}) {
      this.requireLayered();
      const existing = this.data.spatial.nodes.find(n => n.id === id);
      if (position === undefined) { if (!existing) throw new Error('找不到路线点：' + id); return new RoutePoint(this, existing); }
      if (existing) throw new Error('路线点标识重复：' + id);
      own(this, position, Position);
      const data = {id, x: position.x, ...position.space(), ...structuredClone(options)};
      this.data.spatial.nodes.push(data); return new RoutePoint(this, data);
    }
    through(target) { return new Passage(this, typeof target === 'string' ? target : own(this, target, Entity).id); }
    passage(id, from, to, options = {}) {
      own(this, from, RoutePoint); own(this, to, RoutePoint);
      const {distance = Math.hypot(to.x - from.x, to.data.depth - from.data.depth), enabled = true, ...objectOptions} = options;
      this.object(id, {at: from.position, ...objectOptions}).connect(from, to, {distance, enabled});
      return this.through(id);
    }
    route(...steps) {
      this.requireLayered();
      if (steps.length < 2) throw new Error('路线至少需要两个位置。');
      const nodes = [], edges = []; let via;
      for (const step of steps) {
        if (step instanceof Passage) {
          own(this, step, Passage);
          if (!nodes.length || via) throw new Error('通路必须放在两个路线点之间。');
          via = step.id; continue;
        }
        let point;
        if (step instanceof RoutePoint) point = own(this, step, RoutePoint);
        else {
          own(this, step, Position);
          const found = this.data.spatial.nodes.find(n => n.x === step.x && n.plane === step.layer.id && n.height === step.height);
          let id; do { id = 'route-' + (++this.serial); } while (this.data.spatial.nodes.some(n => n.id === id));
          point = found ? new RoutePoint(this, found) : this.point(id, step);
        }
        if (nodes.length) {
          const before = nodes.at(-1);
          if (before.id === point.id) throw new Error('路线不能直接连接到自身。');
          if (before.data.plane !== point.data.plane && !via) throw new Error('跨行走层必须指定通路。');
          if (before.data.next && (before.data.next !== point.id || before.data.via !== via)) throw new Error('路线点已有不同的出口：' + before.id);
          edges.push({from: before, to: point, via});
        }
        nodes.push(point); via = undefined;
      }
      if (via) throw new Error('通路后缺少出口位置。');
      for (const edge of edges) { edge.from.data.next = edge.to.id; if (edge.via) edge.from.data.via = edge.via; }
      this.data.spatial.start ??= nodes[0].id; return this;
    }
    startAt(point) { own(this, point, RoutePoint); this.data.spatial.start = point.id; return this; }
    traveler({start, speed = 70, ...options}) {
      const position = start instanceof RoutePoint ? own(this, start, RoutePoint).position : own(this, start, Position);
      this.data.actor = {x: position.x, speed: finite(speed, '行走速度'), space: position.space(), ...structuredClone(options)}; return this;
    }
    destination(position, options = {}) {
      const at = position instanceof RoutePoint ? own(this, position, RoutePoint).position : own(this, position, Position);
      this.data.goal = {x: at.x, space: at.space(), ...structuredClone(options)}; return this;
    }
    object(id, options = {}, Type = Entity) {
      const object = createObject(this, id, options);
      return new Type(this, object.id);
    }
    addObject(definition, Type = Entity) { return new Type(this, definition); }
    entity(id) { return new Entity(this, id); }
    rule(definition) { return this.api.addRule(definition); }
    art(definition) { return this.api.addArt(definition); }
    toJSON() { return this.data; }
  }

  class Layer {
    constructor(level, data) { this.level = level; this.data = data; }
    get id() { return this.data.id; }
    at(x, options = {}) { return new Position(this.level, this, x, options); }
    ground({from, to, height = 0, endHeight, ...options}) {
      finite(from, '路面起点'); finite(to, '路面终点');finite(height, '路面高度');
      if (to <= from) throw new Error('路面终点必须位于起点右侧。');
      const space=this.at(from, {height, depthSize: 20}).space();
      if(endHeight!==undefined)space.heightEnd=finite(endHeight,'路面终点高度');
      const data = {x: from, width: to - from, space, ...structuredClone(options)};
      this.level.data.platforms.push(data); return this;
    }
  }
  class Position {
    constructor(level, layer, x, {height = 0, ...options} = {}) {
      this.level = level; this.layer = own(level, layer, Layer); this.x = finite(x, '位置 X'); this.height = finite(height, '实际高度'); this.options = structuredClone(options);
    }
    space() { return {plane: this.layer.id, depth: this.layer.data.depth, height: this.height, ...this.options}; }
  }
  class RoutePoint {
    constructor(level, data) { this.level = level; this.data = data; }
    get id() { return this.data.id; }
    get x() { return this.data.x; }
    get position() {
      const {id, x, plane, depth, next, via, height, ...options} = this.data;
      return this.level.layer(plane).at(x, {height, ...options});
    }
  }
  class Passage { constructor(level, id) { this.level = level; this.id = id; } }

  class Entity {
    constructor(level, definition, options) {
      if (!(level instanceof Level)) throw new Error('Entity 需要所属的 Level。');
      this.level = level;
      this.data = options !== undefined ? createObject(level, definition, options) : typeof definition === 'string' ? level.api.entity(definition) : level.api.addObject(definition);
    }
    get id() { return this.data.id; }
    contact(options) { this.data.contact = structuredClone(options); return this; }
    hold() { return {type: 'hold', target: this.id}; }
    carriedPhysics(options) { this.data.carriedPhysics = structuredClone(options); return this; }
    surface(options = {}) { this.data.pose ??= {angle: 0, pivot: 0}; this.data.surface = {enabled: true, ...structuredClone(options)}; return this; }
    draggable(options = {}) { this.data.draggable = {enabled: true, targets: [], ...structuredClone(options)}; return this; }
    dropTarget(options = {}) { this.data.dropTarget = {enabled: true, radius: 32, ...structuredClone(options)}; return this; }
    connect(from, to, options = {}) {
      own(this.level, from, RoutePoint); own(this.level, to, RoutePoint);
      this.data.passage = {from: from.id, to: to.id, distance: Math.hypot(to.x - from.x, to.data.depth - from.data.depth), enabled: true, ...structuredClone(options)}; return this;
    }
    behavior(id, actions, label = id) { this.data.behavior(id, actions, label); return this; }
    on(event, actions, conditions = [], details = {}) { this.data.on(event, actions, conditions, details); return this; }
    move(destination) {
      const {to, ...options} = destination;
      if (to) { own(this.level, to, Position); return this.data.move({...options, x: to.x, plane: to.layer.id, depth: to.layer.data.depth, height: to.height}); }
      return this.data.move(options);
    }
    set(state) { return this.data.set(state); }
    invoke(behavior) { return this.data.invoke(behavior); }
    condition(state) { return this.data.condition(state); }
  }

  class Actions {
    static after(seconds, actions) {
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60) throw new Error('时长必须大于0且不超过60秒。');
      return {type: 'after', ticks: Math.max(1, Math.round(seconds * 60)), actions};
    }
    static set(target, state) { return {type: 'set', target: typeof target === 'string' ? target : target.id, state}; }
    static invoke(target, behavior) { return {type: 'invoke', target: typeof target === 'string' ? target : target.id, behavior}; }
    static move(target, {seconds = 1, ...destination}) {
      const ticks = Actions.after(seconds, []).ticks;
      return {type: 'move', target: typeof target === 'string' ? target : target.id, ...destination, ticks};
    }
    static drop() { return {type: 'drop'}; }
  }
  return {Level, Entity, Actions, Layer, Position, RoutePoint, Passage};
}
