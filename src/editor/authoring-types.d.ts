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
export interface DragOptions { enabled?: boolean; targets?: (string|Entity)[]; }
export interface DropOptions { enabled?: boolean; radius?: number; }
export interface EntityOptions {
  label?: string; at?: Position; size?: {width:number; height:number};
  x?: number; width?: number; height?: number; plane?: string; elevation?: number;
  state?: string; kind?: 'object' | 'zone' | 'switch' | 'gate' | 'plate' | 'bridge' | 'hazard' | 'ladder' | 'lift'; contact?: Contact;
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
  readonly scene:Scene;
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
export class LevelContext {
  constructor(level:Level);
  readonly level:Level; readonly scene:Scene; readonly resources:Resources;
}
export class LevelComponent<C extends LevelContext = LevelContext> {
  constructor(context:C|Level);
  readonly context:C; readonly level:Level; readonly scene:Scene; readonly resources:Resources;
}
export class Entity<C extends LevelContext = LevelContext> extends LevelComponent<C> {
  private readonly entityBrand;
  constructor(context:C|Level, definition:string|Record<string,any>);
  constructor(context:C|Level, id:string, options:EntityOptions);
  readonly id:string; readonly data:any; readonly level:Level;
  contact(options:Contact):this;
  hold():Action;
  carriedPhysics(options:{gravityScale:number;maxFallSpeed:number}):this;
  surface(options?:{enabled?:boolean}):this;
  draggable(options?:DragOptions):this;
  dropTarget(options?:DropOptions):this;
  connect(from:RoutePoint, to:RoutePoint, options?:{distance?:number;enabled?:boolean}):this;
  behavior(id:string, actions:Action[], label?:string):this;
  behaviorSlot(id:string, label?:string):BehaviorRef;
  on(event:EventName, actions:Action[], conditions?:Condition[], details?:{other?:string|Entity;behavior?:string|BehaviorRef}):this;
  move(destination:MoveOptions):Action;
  set(state:string):Action;
  invoke(behavior:string|BehaviorRef):Action;
  condition(state:string):Condition;
}
export class BehaviorRef {
  private readonly behaviorBrand;
  readonly entity:Entity; readonly id:string;
  actions(actions:Action[]):this;
  invoke():Action;
}
export class Actions {
  static after(seconds:number, actions:Action[]):Action;
  static set(target:string|Entity, state:string):Action;
  static invoke(target:string|Entity, behavior:string|BehaviorRef):Action;
  static move(target:string|Entity, destination:Omit<MoveOptions,'to'>):Action;
  static drop():Action;
  static enable(target:Entity,capability:Capability,enabled:boolean):Action;
  static rotate(target:Entity,angle:number,ticks:number):Action;
  static place(target:Entity,at:Entity,range:number):Action;
  static hurt(message?:string):Action;
  static holding(target:Entity|null):Condition;
}

export const States:Readonly<{Active:'active';Inactive:'inactive';Enabled:'enabled';Disabled:'disabled';Off:'off';On:'on';Folded:'folded';Extended:'extended';Closed:'closed';Open:'open';Running:'running';Stopped:'stopped';Idle:'idle';Pressed:'pressed';Lower:'lower';Upper:'upper'}>;
export const Events:Readonly<{Click:'click';Contact:'contact';Enter:'enter';Placed:'placed';Droprejected:'droprejected';Board:'board';Arrive:'arrive';Moved:'moved';Moveblocked:'moveblocked';Rotated:'rotated';Supportlost:'supportlost';Supportfound:'supportfound';Landed:'landed';Impact:'impact';Actorlanded:'actorlanded';Done:'done'}>;
export const Kinds:Readonly<{Object:'object';Zone:'zone';Switch:'switch';Gate:'gate';Plate:'plate';Bridge:'bridge';Hazard:'hazard';Ladder:'ladder';Lift:'lift'}>;
export const Effects:Readonly<{Lethal:'lethal'}>;
export const Capabilities:Readonly<{Surface:'surface';Collider:'collider';Passage:'passage';Draggable:'draggable';DropTarget:'dropTarget'}>;
export const VisualStates:Readonly<{Moving:'moving';Carried:'carried';Idle:'idle';Forward:'forward';Backward:'backward';Inward:'inward';Outward:'outward';Upward:'upward';Downward:'downward'}>;
export const Motions:Readonly<{None:'none';Squash:'squash';Shake:'shake';Hop:'hop';Recoil:'recoil';Sway:'sway';Pulse:'pulse';Emerge:'emerge';Fade:'fade';Fall:'fall'}>;
export const Particles:Readonly<{None:'none';Smoke:'smoke';Dust:'dust';Spark:'spark'}>;
export const Sounds:Readonly<{None:'none';Puff:'puff';Clack:'clack';Pop:'pop';Thud:'thud';Success:'success';Fail:'fail'}>;
export const FeedbackPolicies:Readonly<{Restart:'restart';Overlay:'overlay'}>;
export const FeedbackTriggers:Readonly<{Start:'start';Behavior:'behavior';State:'state';Event:'event';Lost:'lost';Won:'won'}>;
declare const imageBrand:unique symbol;
declare const soundBrand:unique symbol;
export interface ImageAsset { readonly [imageBrand]:true; readonly id:string; }
export interface SoundAsset { readonly [soundBrand]:true; readonly id:string; }
export interface ImageDefinition {label:string;src:string;width:number;height:number;[key:string]:unknown;}
export interface SoundDefinition {label:string;src:string;[key:string]:unknown;}
export interface Resources {
  /** Built-in image reference, or declare an imported image once. */
  image(id:string, definition?:ImageDefinition):ImageAsset;
  sound(id:string, definition?:SoundDefinition):SoundAsset;
}
export interface Animation {frames:ImageAsset[];fps:number;[key:string]:unknown;}
export interface VisualStyle {
  asset?:ImageAsset; animation?:Animation|null; width?:number;height?:number;x?:number;y?:number;
  rotation?:number;layer?:number;opacity?:number;flipX?:boolean;visible?:boolean;flipWithDirection?:boolean;
  [key:string]:unknown;
}
export interface SceneTarget {readonly type:'actor'|'goal';}
export interface Visual {
  readonly id:string;
  label(label:string,group?:string):this;at(x:number,y:number):this;size(width:number,height:number):this;
  order(order:number):this;bind(target:Entity|SceneTarget):this;platform(index:number):this;
  anchor(position:Position):this;properties(options:VisualStyle):this;variant(state:string,options:VisualStyle):this;
}
export interface VisualTemplate {place(id:string):Visual;}
export type FeedbackTrigger =
  {type:'behavior';behavior:BehaviorRef} |
  {type:'state';source:Entity;state:string} |
  {type:'event';source:Entity;event:EventName;behavior?:string|BehaviorRef} |
  {type:'start'|'lost'|'won';source?:string;reason?:string};
export interface FeedbackOptions {
  label?:string;motion?:typeof Motions[keyof typeof Motions];particles?:typeof Particles[keyof typeof Particles];
  sound?:typeof Sounds[keyof typeof Sounds]|SoundAsset;policy?:'restart'|'overlay';
  duration?:number;delay?:number;strength?:number;loop?:boolean;hold?:boolean;
  anchor?:{x:number;y:number};count?:number;color?:string;direction?:number;volume?:number;[key:string]:unknown;
}
export interface Scene {
  readonly resources:Resources; readonly actor:SceneTarget;readonly goal:SceneTarget;
  configure(options:Record<string,unknown>):this;
  image(id:string,image:ImageAsset):Visual;
  template(image:ImageAsset,defaults?:VisualStyle):VisualTemplate;
  arrange(visuals:Visual[]):this;
  feedbackTemplate(defaults:FeedbackOptions):{attach(id:string,target:Visual,trigger:FeedbackTrigger,options?:FeedbackOptions):unknown};
  compose(id:string,options:{label:string;origin:{x:number;y:number};nodes:Visual[];entities:Entity[];[key:string]:unknown}):unknown;
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
