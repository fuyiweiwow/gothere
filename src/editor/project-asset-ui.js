import {ASSETS} from '../content/library.js';
import {assetKeys,withProjectAsset} from './project-assets.js';

export function projectAssetDefinition(project,path) {
  const asset=project.assets?.[path];
  return asset?.builtin?ASSETS.find(a=>a.id===asset.id):asset?.definition;
}

/** Inspection never starts audio; importing decodes in memory without playback. */
export function showProjectAsset(root,project,path) {
  root.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.removeAttribute('src');audio.load();});
  root.replaceChildren();
  const asset=project.assets?.[path],definition=projectAssetDefinition(project,path);
  if(!asset||!definition)return;
  const title=document.createElement('h3');title.textContent=definition.label;root.append(title);
  const media=document.createElement(path.startsWith('assets/images/')?'img':'audio');
  media.src=definition.src;
  if(media instanceof HTMLImageElement)media.alt=definition.label;
  else {media.controls=true;media.preload='none';}
  root.append(media);
  const info=document.createElement('p');
  info.textContent=asset.id+(asset.builtin?' · 内置资源':'')+(definition.width?` · ${definition.width} × ${definition.height}`:'');root.append(info);
  const ref=document.createElement('code');ref.textContent='context.assets.'+assetKeys(path).join('.');root.append(ref);
  const note=document.createElement('p');note.textContent='通过 createAssets(level) 取得目录资源；资源登记不会自动创建物体、添加行为或播放声音。';root.append(note);
}

export async function importProjectAssets(project,files,{folder=false,destination=''}={}) {
  if(files.length>32)throw new Error('一次最多导入32个资源。');
  let next=project,last;
  for(const file of files){
    const ext=file.name.split('.').at(-1).toLowerCase();
    const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg'}[ext];
    if(!mime||file.size>262144)throw new Error('每个资源须为256 KiB以内的 PNG/JPEG/WebP/WAV/MP3/OGG：'+file.name);
    const kind=mime.startsWith('image/')?'images':'sounds';
    let relative=folder?file.webkitRelativePath:file.name;
    if(folder){
      const parts=relative.split('/'),start=parts.indexOf('assets');
      relative=start>=0?parts.slice(start).join('/'):['images','sounds'].includes(parts[0])?'assets/'+relative:`assets/${kind}/`+destination+relative;
    }else relative=`assets/${kind}/`+destination+relative;
    assetKeys(relative);
    const buffer=await file.arrayBuffer();
    const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve('data:'+mime+';base64,'+reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('无法读取资源：'+file.name));reader.readAsDataURL(file);});
    const definition={label:file.name.slice(0,60),src};
    if(kind==='images'){
      const image=new Image();image.src=src;await image.decode();
      if(image.naturalWidth>2048||image.naturalHeight>2048)throw new Error('图片最长边不能超过2048：'+file.name);
      Object.assign(definition,{width:image.naturalWidth,height:image.naturalHeight});
    }else{
      const context=new OfflineAudioContext(1,1,44100),audio=await context.decodeAudioData(buffer);
      if(audio.duration>8)throw new Error('音效不能超过8秒：'+file.name);
    }
    next=withProjectAsset(next,relative,definition);last=relative;
  }
  return {project:next,path:last};
}
