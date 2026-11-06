/** A data authoring scene. References are resolved here; no renderer or gameplay callbacks. */
export function createSceneLibrary(level) {
  const data=()=>level.data.scene??=( {assets:[],nodes:[]} );
  const own=(ref,Type)=>{if(!(ref instanceof Type)||ref.level!==level)throw new Error('资源引用必须属于同一关卡。');return ref;};
  const entity=ref=>{if(ref?.level!==level||typeof ref.id!=='string'||!level.data.entities.some(e=>e.id===ref.id))throw new Error('绑定需要同一关卡中的物体引用。');return ref.id;};
  class ImageAsset {constructor(id){this.id=id;this.level=level;} }
  class SoundAsset {constructor(id){this.id=id;this.level=level;} }
  const images=new Map(),sounds=new Map();
  const resources={
    image(id,definition){
      if(definition){if(images.has(id)||data().assets.some(a=>a.id===id))throw new Error('图片资源重复：'+id);data().assets.push({id,...structuredClone(definition)});}
      if(!images.has(id))images.set(id,new ImageAsset(id));return images.get(id);
    },
    sound(id,definition){
      if(definition){data().sounds??=[];if(sounds.has(id)||data().sounds.some(a=>a.id===id))throw new Error('声音资源重复：'+id);data().sounds.push({id,...structuredClone(definition)});}
      if(!sounds.has(id))sounds.set(id,new SoundAsset(id));return sounds.get(id);
    },
  };
  function animation(value){if(value===null)return null;const {frames,...rest}=value;return {...structuredClone(rest),frames:frames.map(frame=>own(frame,ImageAsset).id)};}
  function style(value){
    const {asset,animation:frames,...rest}=value;
    return {...structuredClone(rest),...(asset!==undefined?{asset:own(asset,ImageAsset).id}:{}),...(frames!==undefined?{animation:animation(frames)}:{})};
  }
  class Visual {
    constructor(definition){this.level=level;this.data=definition;}
    get id(){return this.data.id;}
    label(label,group){this.data.label=label;if(group!==undefined)this.data.group=group;return this;}
    at(x,y){Object.assign(this.data,{x,y});return this;}
    size(width,height){Object.assign(this.data,{width,height});return this;}
    order(layer){this.data.layer=layer;return this;}
    bind(target){if(target?.type==='actor'||target?.type==='goal'){if(target.level!==level)throw new Error('绑定需要同一关卡中的主角或终点。');this.data.bind={type:target.type};}else this.data.bind={type:'entity',id:entity(target)};return this;}
    platform(index){this.data.bind={type:'platform',index};return this;}
    anchor(position){if(position?.level!==level||typeof position.space!=='function')throw new Error('锚点需要同一关卡的位置。');this.data.anchor={x:position.x,...position.space()};return this;}
    properties(options){Object.assign(this.data,style(options));return this;}
    variant(state,options){this.data.variants??={};Object.defineProperty(this.data.variants,state,{value:style(options),enumerable:true,writable:true,configurable:true});return this;}
  }
  class VisualTemplate {
    constructor(asset,defaults){this.asset=own(asset,ImageAsset);this.defaults=style(defaults);}
    place(id){
      if(data().nodes.some(n=>n.id===id))throw new Error('资源图层重复：'+id);
      const node={id,asset:this.asset.id,...structuredClone(this.defaults)};data().nodes.push(node);return new Visual(node);
    }
  }
  function trigger(value){
    if(value.behavior?.entity){
      const {behavior,source,...rest}=value,id=entity(behavior.entity);
      if(source!==undefined&&(typeof source==='string'?source:entity(source))!==id)throw new Error('反馈事件必须引用来源物体的行为。');
      return {...structuredClone(rest),source:id,behavior:behavior.id};
    }
    if(value.source&&typeof value.source!=='string')return {...structuredClone({...value,source:undefined}),source:entity(value.source)};
    return structuredClone(value);
  }
  const scene={
    resources,
    configure(options){Object.assign(data(),structuredClone(options));return scene;},
    image(id,asset){return new VisualTemplate(asset,{}).place(id);},
    template(asset,defaults={}){return new VisualTemplate(asset,defaults);},
    actor:Object.freeze({type:'actor',level}),goal:Object.freeze({type:'goal',level}),
    arrange(visuals){const nodes=visuals.map(v=>own(v,Visual).data);if(nodes.length!==data().nodes.length||new Set(nodes).size!==nodes.length)throw new Error('图层顺序必须包含每个图层一次。');data().nodes=nodes;return scene;},
    feedbackTemplate(defaults){return {attach(id,target,event,options={}){
      const {sound,...rest}={...defaults,...options};
      const cue={id,target:own(target,Visual).id,trigger:trigger(event),...structuredClone(rest),...(sound!==undefined?{sound:typeof sound==='string'?sound:own(sound,SoundAsset).id}:{})};
      data().feedback??=[];if(data().feedback.some(f=>f.id===id))throw new Error('反馈标识重复：'+id);data().feedback.push(cue);return cue;
    }};},
    compose(id,{nodes,entities,...options}){data().compositions??=[];if(data().compositions.some(c=>c.id===id))throw new Error('组合标识重复：'+id);const group={id,...structuredClone(options),nodes:nodes.map(n=>own(n,Visual).id),entities:entities.map(entity)};data().compositions.push(group);return group;},
  };
  return scene;
}
