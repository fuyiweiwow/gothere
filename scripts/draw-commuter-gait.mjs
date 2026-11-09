import {readFile,writeFile} from 'node:fs/promises';

// Original CC0 gait revision. The v0.38 eight-frame artwork stays unchanged.
// The canvases and foot origins match the earlier set; silhouettes are redrawn.
const P={ink:'#333d49',teal:'#3f8d89',deep:'#356b73',cream:'#fff1ce',gold:'#edb954',coral:'#d87959',
  skin:'#f0c392',hair:'#3b3c48',pants:'#586b83',shoe:'#364355',paper:'#fff9e5',road:'#7f9290',wall:'#e6c78e'};
const path=(d,fill='none',stroke=P.ink,width=2.4)=>`<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
const rect=(x,y,w,h,fill,r=3,stroke='',sw=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}"`:''}/>`;
const circle=(x,y,r,fill,stroke='',sw=2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}"`:''}/>`;
const shadow=(x,y,rx)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="2.2" fill="${P.ink}" opacity=".14"/>`;
const limb=(points,color,width)=>path('M'+points.map(p=>p.join(' ')).join('L'),'none',P.ink,width+2.6)+path('M'+points.map(p=>p.join(' ')).join('L'),'none',color,width);
const assets=[],manifestURL=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(manifestURL,'utf8'));
const old=new Map(manifest.map(a=>[a.id,a]));
const toon=id=>'toon'+id[0].toUpperCase()+id.slice(1);
function add(id,body,w,h){const source=old.get(id)??old.get(id.replace(/Cycle\d+$/,'1'));w??=source.width;h??=source.height;
  const direction=id.includes('Walk')?'横走':id.includes('In')?'向里':'向外';
  assets.push({id:toon(id),label:'漫画 · 赶路职员 · '+direction+'循环 '+id.match(/\d+$/)[0],category:source.category,file:'original/commute/'+toon(id)+'.svg',width:w,height:h,
    source:'gothere-original',license:'CC0-1.0',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`});}

function heroHead(front=false,back=false){
  let b=path('M44 34 58 33l2 13-14 1Z',P.skin);
  b+=path(front||back?'M35 17Q34 3 55 3q23 0 24 17l-5 17Q58 47 40 34Z':'M40 19Q37 3 60 3q23 0 22 19l7 8-10 3-3 8q-19 6-33-6Z',P.skin);
  b+=path(front||back?'M35 23Q27 8 44 4L52 0l3 5Q76-2 81 19l-9 3-8-10-21 6-2 9Z':'M39 25Q27 7 48 4l8-4 1 6q24-6 29 13l-9 1-4-8-21 7-7 11Z',P.hair);
  if(back)return b+path('M37 17q20-12 42 0l-5 20q-18 9-34-3Z',P.hair,'');
  const x=front?36:47;
  b+=rect(x,19,18,17,P.paper,5,P.ink,2.5)+rect(x+21,19,18,17,P.paper,5,P.ink,2.5)+path(`M${x+18} 24h3m-21-1-7-2`);
  b+=circle(x+13,28,1.7,P.ink)+circle(x+34,28,1.7,P.ink)+path(`M${front?56:68} 39q5 3 9-1`,'none',P.ink,1.5);
  b+=path(`M${x+3} 23l5-1m16 1 5-1`,'none','#cddcdb',1.4);return b;
}
function heroTorso(){return path('M44 43q12-5 23 1l3 23q-13 6-29-1Z',P.teal)+path('m49 43 7 11 7-11',P.cream)+path('m56 52-4 12 7 1-1-12',P.coral,'',1)+path('m45 45 22 18','none','#e1c39a',2.3)+rect(43,55,10,13,P.paper,2,P.ink,1)+rect(45,57,6,4,P.gold,1)+path('M46 64h4','none',P.coral,1.5);}
// One half-cycle plants the foot at a constant ground speed; the other swings
// it forward with knee flex and toe clearance. The two feet alternate supports.
function step(phase,stride=72){
  const p=((phase%1)+1)%1,t=p<.5?p*2:(p-.5)*2;
  return {x:stride*(p<.5?.25-.5*t:-.25+.5*t*t*(3-2*t)),lift:p<.5?0:8*Math.sin(Math.PI*t)};
}
function heroSide(phase=0,alarm=false,rest=false){
  const wave=Math.cos(phase*Math.PI*2),bob=rest?0:Math.cos(phase*Math.PI*4)*.8;
  const foot=p=>{const s=step(p);return [56+s.x,90-s.lift];};
  const a=rest?[61,90]:foot(phase),b=rest?[51,90]:foot(phase+.5);
  const leg=(foot,rear)=>{
    const hip=[rear?55:57,65+bob],ankle=[foot[0],foot[1]-2],dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],d=Math.hypot(dx,dy);
    const bend=Math.sqrt(Math.max(0,17*17-d*d/4)),knee=[(hip[0]+ankle[0])/2+dy/d*bend,(hip[1]+ankle[1])/2-dx/d*bend];
    return limb([hip,knee,ankle],rear?'#486074':P.pants,6)+rect(foot[0]-5,foot[1]-4,16,4,P.shoe,2);
  };
  let body=leg(b,true)+leg(a,false)+`<g transform="translate(0 ${bob})">`+heroTorso();
  const hand=alarm?[82,39]:[66-wave*8,67],elbow=alarm?[78,52]:[70-wave*4,55];
  body+=limb([[65,46],elbow,hand],P.teal,6)+circle(...hand,4,P.skin,P.ink,1.3);
  const bagX=alarm?25:27+wave*3,bagY=alarm?48:64-Math.sin(phase*Math.PI*2)*1.3;
  body+=limb([[45,46],[35,55],[bagX+9,bagY+1]],P.deep,5)+rect(bagX,bagY,26,19,P.coral,4,P.ink,2)+path(`M${bagX+6} ${bagY}v-5h12v5`)+path(`M${bagX+3} ${bagY+6}h20`,'none','#f0a37a',2);
  return body+heroHead()+'</g>';
}
for(let i=0;i<12;i++){
  const phase=i/12,wave=Math.cos(phase*Math.PI*2),bob=Math.cos(phase*Math.PI*4)*.8;
  add('commuterWalkCycle'+(i+1),shadow(56,92,24)+heroSide(phase));
  for(const inward of [true,false]){
    let b=shadow(56,90,21);
    const legs=[0,1].map(j=>{const foot=step(phase+j*.5,38.4);return {j,x:j?65:48,y:84.5+(inward?-1:1)*foot.x-foot.lift*.55};});
    for(const {j,x,y}of legs.sort((a,b)=>a.y-b.y)){
      b+=limb([[j?63:49,64+bob],[x+(j?2:-2),70+(y-75)*.35],[x,y-2]],j?P.pants:'#486074',6)+
        rect(x-5,y-3,12,4,P.shoe,2)+path(`M${x-3} ${y-2}h7`,'none','#667587',1);
    }
    b+=`<g transform="translate(0 ${bob})">`+path('M41 44q14-7 29 0l3 24q-17 6-35-1Z',P.teal)+
      limb([[42,47],[35,59],[37,68-wave*3]],P.deep,6)+limb([[69,47],[77,59],[76,68+wave*3]],P.teal,6);
    const bagX=inward?25:67,bagY=65+(inward?-1:1)*wave*1.2;
    b+=rect(bagX,bagY,23,18,P.coral,4,P.ink,2)+path(`M${bagX+5} ${bagY}v-4h12v4`)+heroHead(true,inward);
    if(!inward)b+=path('m49 44 7 9 7-9',P.cream)+rect(44,56,10,12,P.paper,2,P.ink,1);
    add('commuter'+(inward?'In':'Out')+'Cycle'+(i+1),b+'</g>');
  }
}

for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const byId=new Map(assets.map(a=>[a.id,a]));
const next=manifest.map(entry=>{const a=byId.get(entry.id);if(!a)return entry;byId.delete(entry.id);const {body,...meta}=a;return meta;});
next.push(...[...byId.values()].map(({body,...meta})=>meta));await writeFile(manifestURL,JSON.stringify(next,null,2)+'\n');
console.log('Drew '+assets.length+' distance-driven walking frames; previous artwork preserved.');
