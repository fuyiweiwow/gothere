import {readFile,writeFile} from 'node:fs/promises';

// Original CC0 vectors. Every hero frame has the same 112x96 canvas and foot
// origin (56,90); poses can change without rescaling or moving the bound entity.
const P={ink:'#354447',coat:'#506f76',shade:'#3d555e',shirt:'#ece2c7',skin:'#dcb58b',hair:'#3b4143',bag:'#ac674c',sole:'#2d3f43'};
const path=(d,fill,stroke='',width=1.5)=>`<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`:''}/>`;
const rect=(x,y,w,h,fill,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const limb=(points,color,width)=>path('M'+points.map(p=>p.join(' ')).join('L'),'none',P.ink,width+2)+path('M'+points.map(p=>p.join(' ')).join('L'),'none',color,width);
const shadow=(cx,cy,rx)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="2.1" fill="${P.ink}" opacity=".14"/>`;
const assets=[];
function add(id,label,w,h,body){assets.push({id,label,category:'街景角色',file:'original/commute/'+id+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`});}
function head(){return rect(51,27,8,9,P.skin,2)+path('M46 13q0-11 15-9 13 2 11 16l5 4-6 2-2 5q-8 6-18 0Z',P.skin,P.ink)+
  path('M45 19Q39 5 51 2l5-2 1 4q15-6 17 8l-5 3-13-4-5 11Z',P.hair)+
  rect(52,16,10,9,P.shirt,2)+rect(64,16,10,9,P.shirt,2)+path('M52 16h10v9H52Zm12 0h10v9H64Zm-2 3h2m-13 0-5-1','none',P.ink,2)+
  circle(59,20,1.25,P.ink)+circle(71,20,1.25,P.ink)+path('m65 29 5-1','none','#9d6854',1);}
function torso(){return path('M46 35 55 31 66 35 68 60q-12 5-25-1Z',P.coat,P.ink)+path('M51 33 56 43 62 33',P.shirt)+path('m56 42-2 12 5 0-1-12',P.bag)+
  path('m47 38 18 16','none','#c3b29a',2)+rect(43,51,9,11,P.shirt,1)+rect(45,53,5,4,'#9faaa2')+rect(44,59,7,1.5,P.bag);}
function side(phase=0,pose=0){
  const swing=Math.sin(phase*Math.PI*2),lift=Math.max(0,Math.cos(phase*Math.PI*2))*7;
  const footA=[56+swing*22,90-lift],footB=[56-swing*22,90-Math.max(0,-Math.cos(phase*Math.PI*2))*7];
  const leg=(foot,back)=>limb([[back?53:59,58],[(foot[0]+56)/2+3,73],foot],back?P.shade:'#607274',7)+rect(foot[0]-4,foot[1]-3,12,4,P.sole,1.8);
  let b=leg(footB,true)+torso()+leg(footA,false);
  const hand=pose?[76,30]:[65-swing*10,58],elbow=pose?[73,45]:[68-swing*5,46];
  b+=limb([[63,36],elbow,hand],P.coat,7)+circle(hand[0],hand[1],3.4,P.skin);
  const bagX=pose?31:35+swing*2,bagY=pose?35:54-Math.max(0,swing)*2;
  b+=limb([[47,37],[40,46],[bagX+6,bagY]],P.shade,6)+rect(bagX,bagY,19,17,P.bag,2)+path(`M${bagX+5} ${bagY}v-4h9v4`,'none',P.ink,2)+rect(bagX+2,bagY+3,15,2,'#c78c68');
  return b+head();
}
for(let i=0;i<8;i++)add('commuterWalk'+(i+1),'赶路职员 · 横走 '+(i+1),112,96,shadow(56,92,24)+side(i/8));
add('commuterIdle','赶路职员 · 厚镜片与工牌',112,96,shadow(56,92,20)+side(.125));
for(const inward of [true,false])for(let i=0;i<8;i++){
  const s=Math.sin(i/8*Math.PI*2),y=54,feet=[[48,90-Math.max(0,s)*7],[64,90-Math.max(0,-s)*7]];
  let b=shadow(56,92,19)+feet.map((p,j)=>limb([[j?61:51,y+4],[j?63:49,75],p],j?'#607274':P.shade,7)+rect(p[0]-4,p[1]-3,10,4,P.sole,1)).join('');
  b+=path('M43 34q13-7 26 0l3 27H40Z',P.coat,P.ink)+limb([[44,36],[38,48],[39,59-s*4]],P.shade,6)+limb([[68,36],[74,48],[73,59+s*4]],P.coat,6);
  b+=rect(33,58-s*3,17,17,P.bag,2)+path(`M37 ${58-s*3}v-4h9v4`,'none',P.ink,2)+rect(52,27,9,8,P.skin,2);
  b+=path('M43 15q0-13 13-13 15 0 15 15l-3 11q-10 9-22-1Z',P.skin,P.ink);
  if(inward)b+=path('M43 20Q37 5 51 2l5-2 1 4q17-6 16 14l-7 10H48Z',P.hair)+path('M46 40h20','none','#77918e',1.5);
  else b+=path('M42 16Q39 3 52 2l4-2 1 4q16-4 17 13l-10-5-14 2-2 6Z',P.hair)+rect(43,17,12,9,P.shirt,2)+rect(58,17,12,9,P.shirt,2)+path('M43 17h12v9H43Zm15 0h12v9H58Zm-3 3h3','none',P.ink,2)+circle(50,21,1.2,P.ink)+circle(64,21,1.2,P.ink)+path('m52 34 4 8 5-8',P.shirt)+rect(48,49,8,10,P.shirt,1);
  add('commuter'+(inward?'In':'Out')+(i+1),'赶路职员 · '+(inward?'向里':'向外')+' '+(i+1),112,96,b);
}
// Stagger, reach for balance, fold knees, then land on the hip. This sequence
// has a drawn end pose; no whole-image rotation is needed to fake the fall.
for(let i=0;i<8;i++){
  const angles=[0,-7,-19,-35,-54,-72,-86,-86],drop=[0,0,2,6,13,21,27,27];
  let b=shadow(50,92,22+i*1.8)+`<g transform="translate(0 ${drop[i]}) rotate(${angles[i]} 56 58)">${side(.125,i>0)}</g>`;
  if(i===7)b+=path('M17 58q-5-4-8 0m5-5-2-4m10 4 3-3','none','#9caa96',1.1);
  add('commuterFall'+(i+1),'赶路职员 · 失衡倒地 '+(i+1),112,96,b);
}
for(const [suffix,color,bag]of [['A','#b97c60',false],['B','#5c7261',true],['C','#b4a47f',false]]){
  function passenger(reach,look){
    let b=shadow(24,73,16)+path('M17 45 17 65 13 69 24 69 26 47',P.shade)+path('M27 46 29 65 25 70 36 70 33 46','#526367');
    b+=path('M15 27Q23 22 32 27L36 49Q23 54 12 48Z',color,P.ink)+path('M18 26 24 35 30 26',P.shirt);
    b+=limb([[16,30],[13-reach*5,37],[11-reach*10,39-reach*3]],color,5)+circle(11-reach*10,39-reach*3,3,P.skin);
    b+=limb([[30,30],[36,42],[33,51]],color,5)+circle(33,51,3,P.skin)+rect(19,21,9,8,P.skin,2);
    b+=`<g transform="translate(${look?-2:0} 0)">`+path(look?'M34 10Q32 1 22 3 12 4 12 15L8 18l5 3 3 3q10 4 16-3Z':'M13 10Q14 1 25 3 35 4 35 15L31 24Q21 29 15 21Z',P.skin,P.ink)+path('M12 15Q9 1 23 0 38 0 36 14L30 10 30 6 18 9 17 17Z',P.hair)+path(look?'m15 16 4-1m-2 7 5 1':'m26 16h5','none',P.ink,1.4)+'</g>';
    if(bag)b+=rect(30,49,15,16,P.bag,2)+path('M33 50v-5h8v5','none',P.ink,2);
    return b;
  }
  for(let i=0;i<4;i++)add('queue'+suffix+'Ready'+(i+1),'候车乘客 '+suffix+' · 留意队尾 '+(i+1),48,78,passenger([0,.15,.3,.3][i],i>0));
  for(let i=0;i<6;i++)add('queue'+suffix+'Shove'+(i+1),'候车乘客 '+suffix+' · 挤开赶路者 '+(i+1),48,78,passenger([.3,.65,1,1,.5,0][i],true));
}
for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const manifestURL=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(manifestURL,'utf8')),byId=new Map(assets.map(a=>[a.id,a]));
const entries=manifest.map(a=>{const next=byId.get(a.id);byId.delete(a.id);return next?(({body,...meta})=>meta)(next):a;});
entries.push(...[...byId.values()].map(({body,...meta})=>meta));
await writeFile(manifestURL,JSON.stringify(entries,null,2)+'\n');
console.log('Drew '+assets.length+' original CC0 commuter and queue frames.');
