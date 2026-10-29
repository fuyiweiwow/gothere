/** Small procedural cues plus optional embedded audio. All sources share explicit pause/reset/mute. */
export function createSoundPlayer({notify=()=>{},onPlay=()=>{},contextFactory=()=>new (globalThis.AudioContext??globalThis.webkitAudioContext)()}={}) {
  let context=null,muted=false,paused=false,generation=0,sounds=[],warned=false;const playing=new Set(),buffers=new Map();
  function stop(){generation++;for(const node of playing){node.onended=null;try{node.stop();}catch{/* Already ended. */}}playing.clear();}
  async function unlock(){try{context??=contextFactory();if(!paused&&context.state==='suspended')await context.resume();return true;}catch{if(!warned){warned=true;notify('此浏览器暂时无法播放声音，仍可继续编辑与试玩。');}return false;}}
  async function setPaused(value){paused=value;if(!context)return;try{if(value&&context.state==='running')await context.suspend();else if(!value&&context.state==='suspended')await context.resume();}catch{notify('声音未能恢复，请再次点击运行。');}}
  async function play({sound,volume=.25}){
    if(muted||paused||sound==='none'||!context)return;
    const token=generation,custom=sounds.find(s=>s.id===sound);let buffer;
    if(custom){
      try{if(!buffers.has(custom.src)){const raw=atob(custom.src.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));buffers.set(custom.src,context.decodeAudioData(bytes.buffer));}buffer=await buffers.get(custom.src);if(buffer.duration>8)throw new Error('声音时长不能超过8秒。');}
      catch{buffers.delete(custom.src);notify('声音无法解码或超过8秒，请使用较短的 WAV、MP3 或 OGG。');return;}
    }
    if(token!==generation||muted||paused||context.state!=='running')return;
    if(playing.size>=24){const oldest=playing.values().next().value;oldest.stop();playing.delete(oldest);}
    const start=context.currentTime,duration=buffer?buffer.duration:sound==='success'?.6:sound==='puff'?.28:.2,gain=context.createGain();
    gain.gain.setValueAtTime(Math.max(.0001,volume*.5),start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);gain.connect(context.destination);
    let node;
    if(buffer||sound==='puff'||sound==='thud'){
      node=context.createBufferSource();if(!buffer){buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);const data=buffer.getChannelData(0);let filtered=0;for(let i=0;i<data.length;i++){const noise=Math.sin(i*12.9898+78.233)*43758.5453%1;filtered=filtered*.8+noise*.2;data[i]=filtered;}}node.buffer=buffer;
    }else{node=context.createOscillator();node.type=sound==='clack'?'triangle':'sine';const from={clack:440,pop:700,success:523,fail:240}[sound]??330,to={clack:180,pop:240,success:1046,fail:70}[sound]??150;node.frequency.setValueAtTime(from,start);node.frequency.exponentialRampToValueAtTime(to,start+duration);}
    node.connect(gain);node.onended=()=>playing.delete(node);playing.add(node);node.start(start);if(!buffer)node.stop(start+duration);onPlay(sound);
  }
  return {unlock,play,stop,setPaused,setLevel(level){stop();sounds=level.scene?.sounds??[];buffers.clear();},setMuted(value){muted=value;if(value)stop();}};
}
