const neutral=()=>({dx:0,dy:0,rotation:0,scaleX:1,scaleY:1,opacity:1});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=(seed,index)=>{let n=(seed+Math.imul(index+1,374761393))|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const hash=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};

export function motionAt(preset,phase,strength=1) {
  const p=clamp(phase,0,1),m=neutral(),wave=Math.sin(p*Math.PI),decay=1-p;
  if(strength===0)return m;
  if(preset==='squash'){m.scaleX+=wave*.2*strength;m.scaleY-=wave*.18*strength;}
  if(preset==='shake'){m.dx=Math.sin(p*38)*decay*.08*strength;m.rotation=Math.sin(p*31)*decay*5*strength;}
  if(preset==='hop')m.dy=-wave*.35*strength;
  if(preset==='recoil'){m.rotation=-wave*12*strength;m.dx=-wave*.1*strength;}
  if(preset==='sway')m.rotation=Math.sin(p*Math.PI*2)*4*strength;
  if(preset==='pulse')m.scaleX=m.scaleY=1+wave*.08*strength;
  if(preset==='fade')m.opacity=clamp(1-p*strength,0,1);
  if(preset==='fall'){const ease=(1-(1-p)**3)*strength;m.rotation=85*ease;m.dy=.12*ease;m.opacity=clamp(1-Math.max(0,(p-.65)/.35)*.65*strength,0,1);}
  return m;
}

/** Samples independent presentation instances; never advances or mutates the simulation. */
export function createFeedbackPlayer(level,{onSound=()=>{}}={}) {
  let instances=[],seen=0,lastTick=-1,lastTime=-1,previewSerial=0,terminalEnd=null;
  const slots=level.scene?.feedback??[];
  const reset=()=>{instances=[];seen=0;lastTick=-1;lastTime=-1;terminalEnd=null;};
  const add=(f,signal)=>{
    if(f.policy==='restart')instances=instances.filter(i=>i.slot.id!==f.id);
    if(instances.length>=256)instances.shift();
    instances.push({slot:f,start:signal.tick+f.delay,key:f.id+':'+signal.sequence,heard:-1,seed:hash(f.id+':'+signal.sequence)});
  };
  const matches=(t,s)=>t.type===s.type&&(!t.source||t.source===s.source)&&(!t.behavior||t.behavior===s.behavior)&&
    (!t.state||t.state===s.state)&&(!t.event||t.event===s.event)&&(!t.reason||t.reason===s.reason);
  function sample(snapshot,{endingTicks=0,enabled=true,audible=true}={}) {
    if(snapshot.tick<lastTick)reset();lastTick=snapshot.tick;
    for(const signal of snapshot.signals??[])if(signal.sequence>seen){for(const f of slots)if(matches(f.trigger,signal))add(f,signal);seen=signal.sequence;}
    const terminal=['lost','won'].includes(snapshot.status);
    if(terminal)terminalEnd??=Math.min(snapshot.tick+960,Math.max(snapshot.tick,...instances.filter(i=>!i.slot.loop).map(i=>i.start+i.slot.duration)));
    else terminalEnd=null;
    const time=snapshot.tick+(terminal?clamp(endingTicks,0,terminalEnd-snapshot.tick):0),motions={},particles=[];
    let active=0,tailFinished=true;
    for(const i of instances){
      const f=i.slot,raw=time-i.start;if(raw<0){active++;if(terminal&&!f.loop)tailFinished=false;continue;}
      const ended=!f.loop&&raw>=f.duration,age=f.loop?raw%f.duration:Math.min(raw,f.duration),phase=age/f.duration,cycle=f.loop?Math.floor(raw/f.duration):0;
      if(!ended){active++;if(terminal&&!f.loop)tailFinished=false;}
      if(i.heard<cycle){i.heard=cycle;if(audible&&snapshot.status!=='paused'&&!ended&&(age<=12||lastTime>=0&&i.start+cycle*f.duration>lastTime)&&f.sound!=='none')onSound({sound:f.sound,volume:f.volume,key:i.key+':'+cycle});}
      if(!enabled||ended&&!f.hold)continue;
      const m=motionAt(f.motion,phase,f.strength),target=motions[f.target]??=neutral();
      target.dx+=m.dx;target.dy+=m.dy;target.rotation+=m.rotation;target.scaleX*=m.scaleX;target.scaleY*=m.scaleY;target.opacity*=m.opacity;
      if(!ended&&f.particles!=='none')for(let n=0;n<f.count&&particles.length<512;n++){
        const stagger=f.particles==='smoke'?n/f.count*.5:0,p=(phase-stagger)/(1-stagger);if(p<0||p>=1)continue;
        const r=random(i.seed,n),r2=random(i.seed,n+70),angle=(f.direction+(r-.5)*(f.particles==='spark'?110:50))*Math.PI/180;
        const speed=(.4+r2*.6)*f.strength,travel=p*speed;
        particles.push({target:f.target,kind:f.particles,x:f.anchor.x+Math.cos(angle)*travel+(f.particles==='smoke'?Math.sin(p*5+r*6)*.12:0),
          y:f.anchor.y+Math.sin(angle)*travel+(f.particles==='spark'?p*p*.5:0),size:(f.particles==='smoke'?.18+p*.35:.06*(1-p))*(.7+r*.6),alpha:(1-p)*(f.particles==='smoke'?.5:.85),color:f.color});
      }
    }
    instances=instances.filter(i=>i.slot.loop||i.slot.hold||time<i.start+i.slot.duration);
    lastTime=time;
    return {motions,particles,active,tailFinished};
  }
  return {sample,reset,preview(slot,tick=0){add({...slot,loop:false},{tick,sequence:'preview-'+(++previewSerial)});}};
}

/** Compose visual offsets around the image's bottom-center, preserving actual world geometry. */
export function applyMotion(n,m) {
  if(!m)return n;
  const r=n.rotation*Math.PI/180,next=(n.rotation+m.rotation)*Math.PI/180,w=n.width,h=n.height;
  const sx=clamp(m.scaleX,.1,3),sy=clamp(m.scaleY,.1,3),px=w*.5,py=h;
  return {...n,x:n.x+Math.cos(r)*(px+w*m.dx)-Math.sin(r)*(py+h*m.dy)-Math.cos(next)*px*sx+Math.sin(next)*py*sy,
    y:n.y+Math.sin(r)*(px+w*m.dx)+Math.cos(r)*(py+h*m.dy)-Math.sin(next)*px*sx-Math.cos(next)*py*sy,
    width:w*sx,height:h*sy,rotation:n.rotation+m.rotation,opacity:(n.opacity??1)*m.opacity};
}
