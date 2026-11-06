/** Typed authoring facade. Runtime constraints and reference existence are also validated at generation. */
export interface Space { plane?: string; depth: number; height: number; depthSize?: number; passage?: string; progress?: number; length?: number; }
export interface World { width: number; height: number; groundY: number; physics?: {gravity: number; maxFallSpeed: number}; }
export interface LevelData {
  [extension:string]:unknown;
  schemaVersion: number; id: string; name: string; description?: string; hint?: string;
  world: World; spatial?: any; actor: any; goal: any; platforms: any[]; entities: any[]; rules: any[]; scene?: any;
}
export interface LevelOptions { id?: string; description?: string; hint?: string; originY?: number; size?: {width:number; height:number}; physics?: {gravity:number; maxFallSpeed:number}; }
export interface LayerOptions { label?: string; screenY: number; order?: number; }
export interface PositionOptions { height?: number; depthSize?: number; }
export interface GroundOptions { from: number; to: number; height?: number; endHeight?: number; }
export interface Contact { effect: 'lethal'; message?: string; }
export interface DragOptions { enabled?: boolean; targets?: string[]; }
export interface DropOptions { enabled?: boolean; radius?: number; }
export interface EntityOptions {
  label?: string; at?: Position; size?: {width:number; height:number};
  x?: number; width?: number; height?: number; plane?: string; elevation?: number;
  state?: string; kind?: 'object' | 'zone'; contact?: Contact;
}
export interface MoveOptions { x?:number; seconds?:number; plane?:string; passage?:string; progress?:number; depth?:number; height?:number; to?:Position; editor?:{waypoints?:{x:number;y:number}[];keepWorldX?:boolean}; }
export type EventName = 'click' | 'contact' | 'enter' | 'placed' | 'droprejected' | 'board' | 'arrive' | 'moved' | 'moveblocked' | 'rotated' | 'supportlost' | 'supportfound' | 'landed' | 'impact' | 'actorlanded' | 'done';
export type Capability = 'surface' | 'collider' | 'passage' | 'draggable' | 'dropTarget';
export type Action = (
  {type:'set'; target:string; state:string} | {type:'invoke'; target:string; behavior:string} |
  {type:'after'; ticks:number; actions:Action[]} | {type:'move'; target:string; ticks:number; x?:number; depth?:number; height?:number; plane?:string; passage?:string; progress?:number} |
  {type:'hold'; target:string} | {type:'drop'} | {type:'place'; target:string; at:string; range:number} |
  {type:'enable'; target:string; capability:Capability; enabled:boolean} | {type:'rotate'; target:string; angle:number; ticks:number} |
  {type:'hurt'; message?:string} | {type:'turn'; direction:1|-1}
) & {editor?:{waypoints?:{x:number;y:number}[];keepWorldX?:boolean}};
export type Condition = {entity:string; state:string} | {holding:string|null};
export type EntityClass<T extends Entity = Entity> = new (level:Level, definition:any) => T;

export class Level {
  constructor();
  constructor(name:string, options?:LevelOptions);
  constructor(definition:LevelData);
  /** Generated runtime document. Advanced compatibility escape hatch, not the default authoring interface. */
  readonly data:LevelData;
  readonly api:AuthoringAPI;
  /** Add a layer with screen placement, independent of real elevation. */
  layer(id:string, options:LayerOptions):Layer;
  /** Find an existing layer. Throws if it does not exist. */
  layer(id:string):Layer;
  point(id:string, position:Position, options?:Record<string,unknown>):RoutePoint;
  point(id:string):RoutePoint;
  through(target:string|Entity):Passage;
  passage(id:string, from:RoutePoint, to:RoutePoint, options?:EntityOptions & {distance?:number;enabled?:boolean}):Passage;
  /** Same-layer points connect directly; a layer change requires an explicit Passage. */
  route(...steps:(Position|RoutePoint|Passage)[]):this;
  startAt(point:RoutePoint):this;
  traveler(options:{start:Position|RoutePoint;speed?:number;direction?:1|-1;maxLandingSpeed?:number}):this;
  destination(position:Position|RoutePoint, options?:Record<string,unknown>):this;
  object<T extends Entity = Entity>(id:string, options?:EntityOptions, Type?:EntityClass<T>):T;
  addObject<T extends Entity = Entity>(definition:any, Type?:EntityClass<T>):T;
  entity(id:string):Entity;
  rule(definition:any):any;
  art(definition:any):any;
  toJSON():LevelData;
}
export class Layer {
  private readonly layerBrand;
  readonly id:string; readonly data:any;
  at(x:number, options?:PositionOptions):Position;
  ground(options:GroundOptions):this;
}
export class Position {
  private readonly positionBrand;
  readonly x:number; readonly height:number; readonly layer:Layer;
  space():Space;
}
export class RoutePoint {
  private readonly pointBrand;
  readonly id:string; readonly x:number; readonly position:Position;
}
export class Passage {
  private readonly passageBrand;
  readonly id:string;
}
export class Entity {
  private readonly entityBrand;
  constructor(level:Level, definition:string|Record<string,any>);
  constructor(level:Level, id:string, options:EntityOptions);
  readonly id:string; readonly data:any; readonly level:Level;
  contact(options:Contact):this;
  hold():Action;
  carriedPhysics(options:{gravityScale:number;maxFallSpeed:number}):this;
  surface(options?:{enabled?:boolean}):this;
  draggable(options?:DragOptions):this;
  dropTarget(options?:DropOptions):this;
  connect(from:RoutePoint, to:RoutePoint, options?:{distance?:number;enabled?:boolean}):this;
  behavior(id:string, actions:Action[], label?:string):this;
  on(event:EventName, actions:Action[], conditions?:Condition[], details?:{other?:string;behavior?:string}):this;
  move(destination:MoveOptions):Action;
  set(state:string):Action;
  invoke(behavior:string):Action;
  condition(state:string):Condition;
}
export class Actions {
  static after(seconds:number, actions:Action[]):Action;
  static set(target:string|Entity, state:string):Action;
  static invoke(target:string|Entity, behavior:string):Action;
  static move(target:string|Entity, destination:Omit<MoveOptions,'to'>):Action;
  static drop():Action;
}
export interface AuthoringAPI {
  entity(id:string|{id:string}):any;
  object(id:string, options?:Record<string,any>):any;
  addObject(data:any):any; addRule(data:any):any; addArt(data:any):any; empty():LevelData;
  behavior(target:any, id:string, actions:Action[], label?:string):any;
  on(target:any, event:string, actions:Action[], conditions?:Condition[], details?:any):any;
  move(target:any, options:MoveOptions):Action; set(target:any,state:string):Action;
  invoke(target:any, behavior:string):Action; after(seconds:number,actions:Action[]):Action;
  condition(target:any,state:string):Condition;
}
export function createAPI(level:LevelData):AuthoringAPI;
