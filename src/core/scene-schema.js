import {ASSET_IDS} from '../content/asset-ids.js';

const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const num=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const id=v=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(v);
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);

/** Artwork is bounded authoring data. It defines no collision, event or executable code. */
export function validateScene(level) {
  const s=level.scene,errors=[],check=(ok,m)=>{if(!ok)errors.push(m);};
  if(s===undefined)return errors;
  if(!obj(s))return ['资源场景必须是对象。'];
  check(color(s.background),'场景底色需要六位十六进制颜色。');
  check(Array.isArray(s.assets)&&s.assets.length<=24,'最多导入24张资源。');
  check(Array.isArray(s.nodes)&&s.nodes.length<=600,'场景最多600个资源图层。');
  const assets=new Set(ASSET_IDS);let bytes=0;
  if(Array.isArray(s.assets))for(const a of s.assets.slice(0,25)){
    if(!obj(a)){check(false,'自定义资源格式无效。');continue;}
    check(id(a.id)&&!assets.has(a.id),'资源标识无效或重复。');assets.add(a.id);
    check(typeof a.label==='string'&&a.label.length>0&&a.label.length<=60,'资源名称最多60字。');
    check(typeof a.src==='string'&&a.src.length<=350000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.src),'图片只接受内嵌 PNG、JPEG 或 WebP，单张最多256 KiB。');
    if(typeof a.src==='string')bytes+=a.src.length;
    check(num(a.width,1,2048)&&num(a.height,1,2048),'导入图片尺寸不能超过2048。');
  }
  check(bytes<=700000,'自定义图片总计不能超过512 KiB。');
  const animation=a=>obj(a)&&Array.isArray(a.frames)&&a.frames.length>=1&&a.frames.length<=24&&a.frames.every(f=>assets.has(f))&&num(a.fps,1,30);
  const transform=(n,partial=false)=>{
    if(!obj(n))return false;
    return (partial&&n.asset===undefined||assets.has(n.asset))&&
      ['x','y','width','height','rotation','layer','opacity'].every(k=>n[k]===undefined?(partial||!['x','y','width','height','layer'].includes(k)):
        num(n[k],{x:-2400,y:-1280,width:1,height:1,rotation:-180,layer:-100,opacity:0}[k],{x:3600,y:1920,width:2400,height:1920,rotation:180,layer:100,opacity:1}[k]))&&
      (n.flipX===undefined||typeof n.flipX==='boolean')&&(n.flipWithDirection===undefined||typeof n.flipWithDirection==='boolean')&&
      (n.visible===undefined||typeof n.visible==='boolean')&&
      (n.animation===undefined||partial&&n.animation===null||animation(n.animation));
  };
  const ids=new Set();
  if(Array.isArray(s.nodes))for(const n of s.nodes.slice(0,601)){
    if(!obj(n)){check(false,'资源图层格式无效。');continue;}
    check(id(n.id)&&!ids.has(n.id),'资源图层标识无效或重复。');ids.add(n.id);
    check(typeof n.label==='string'&&n.label.length>0&&n.label.length<=60,'图层名称最多60字。');
    check(transform(n),'资源图层的图片或变换范围无效：'+n.id);
    if(n.tile!==undefined)check(obj(n.tile)&&num(n.tile.width,8,512)&&num(n.tile.height,8,512),'资源平铺尺寸需要8～512：'+n.id);
    if(n.bind!==undefined){const b=n.bind;
      check(obj(b)&&(['actor','goal'].includes(b.type)||(b.type==='entity'&&(level.entities??[]).some(e=>e.id===b.id))||
        (b.type==='platform'&&Number.isInteger(b.index)&&b.index>=0&&b.index<(level.platforms??[]).length)),'资源绑定的实体不存在：'+n.id);
    }
    if(n.variants!==undefined)check(obj(n.variants)&&Object.keys(n.variants).length<=16&&Object.entries(n.variants).every(([key,v])=>id(key)&&transform(v,true)),'资源状态变体无效：'+n.id);
  }
  return errors;
}
