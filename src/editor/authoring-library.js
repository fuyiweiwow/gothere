/** Object-oriented authoring facade. Keep this factory self-contained for module Workers. */
export function createAuthoringLibrary(createAPI, blank) {
  class Level {
    constructor(definition = blank) {
      this.data = structuredClone(definition);
      this.api = createAPI(this.data);
    }
    object(id, options = {}, Type = Entity) {
      const object = this.api.object(id, options);
      return new Type(this, object.id);
    }
    addObject(definition, Type = Entity) { return new Type(this, definition); }
    entity(id) { return new Entity(this, id); }
    rule(definition) { return this.api.addRule(definition); }
    art(definition) { return this.api.addArt(definition); }
    toJSON() { return this.data; }
  }

  class Entity {
    constructor(level, definition) {
      if (!(level instanceof Level)) throw new Error('Entity 需要所属的 Level。');
      this.level = level;
      this.data = typeof definition === 'string' ? level.api.entity(definition) : level.api.addObject(definition);
    }
    get id() { return this.data.id; }
    behavior(id, actions, label = id) { this.data.behavior(id, actions, label); return this; }
    on(event, actions, conditions = [], details = {}) { this.data.on(event, actions, conditions, details); return this; }
    move(destination) { return this.data.move(destination); }
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
  }
  return {Level, Entity, Actions};
}
