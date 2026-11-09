import {readFile,writeFile} from 'node:fs/promises';

// Original CC0 cartoon variants. Old resource IDs/files remain intact for drafts.
// The canvases and foot origins match the earlier set; silhouettes are redrawn.
const P={ink:'#333d49',teal:'#3f8d89',deep:'#356b73',cream:'#fff1ce',gold:'#edb954',coral:'#d87959',
  skin:'#f0c392',hair:'#3b3c48',pants:'#586b83',shoe:'#364355',paper:'#fff9e5',road:'#7f9290',wall:'#e6c78e'};
const path=(d,fill='none',stroke=P.ink,width=2.4)=>`<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
const rect=(x,y,w,h,fill,r=3,stroke='',sw=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}"`:''}/>`;
const circle=(x,y,r,fill,stroke='',sw=2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}"`:''}/>`;
const ellipse=(x,y,rx,ry,fill)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const shadow=(x,y,rx)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="2.2" fill="${P.ink}" opacity=".14"/>`;
const limb=(points,color,width)=>path('M'+points.map(p=>p.join(' ')).join('L'),'none',P.ink,width+2.6)+path('M'+points.map(p=>p.join(' ')).join('L'),'none',color,width);
const assets=[],manifestURL=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(manifestURL,'utf8'));
const old=new Map(manifest.map(a=>[a.id,a]));
const toon=id=>'toon'+id[0].toUpperCase()+id.slice(1);
function add(id,body,w=old.get(id).width,h=old.get(id).height){const source=old.get(id);
  assets.push({id:toon(id),label:'漫画 · '+source.label,category:source.category,file:'original/commute/'+toon(id)+'.svg',width:w,height:h,
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
function heroSide(phase=0,alarm=false){
  const wave=Math.sin(phase*Math.PI*2),lift=Math.cos(phase*Math.PI*2),a=[56+wave*21,90-Math.max(0,lift)*5],b=[56-wave*21,90-Math.max(0,-lift)*5];
  const leg=(foot,rear)=>limb([[rear?51:61,64],[foot[0]*.4+34,77],foot],rear?'#486074':P.pants,6)+rect(foot[0]-5,foot[1]-3,16,5,P.shoe,2.4);
  let body=leg(b,true)+heroTorso()+leg(a,false);
  const hand=alarm?[82,39]:[69-wave*8,67],elbow=alarm?[78,52]:[73-wave*4,55];
  body+=limb([[65,46],elbow,hand],P.teal,6)+circle(...hand,4,P.skin,P.ink,1.3);
  const bagX=alarm?25:29+wave*2,bagY=alarm?48:64-Math.max(0,wave)*2;
  body+=limb([[45,46],[35,55],[bagX+9,bagY+1]],P.deep,5)+rect(bagX,bagY,26,19,P.coral,4,P.ink,2)+path(`M${bagX+6} ${bagY}v-5h12v5`)+path(`M${bagX+3} ${bagY+6}h20`,'none','#f0a37a',2);
  return body+heroHead();
}
add('commuterIdle',shadow(56,92,23)+heroSide(.125));
for(let i=0;i<8;i++){
  add('commuterWalk'+(i+1),shadow(56,92,24)+heroSide(i/8));
  const wave=Math.sin(i/8*Math.PI*2);
  for(const inward of [true,false]){
    let b=shadow(56,92,23);
    for(const [j,x]of [48,65].entries()){const y=90-Math.max(0,(j?-1:1)*wave)*6;b+=limb([[j?63:49,64],[x,78],[x,y]],P.pants,7)+rect(x-5,y-3,14,5,P.shoe,2);}
    b+=path('M41 44q14-7 29 0l3 24q-17 6-35-1Z',P.teal)+limb([[42,47],[35,59],[37,69-wave*4]],P.deep,6)+limb([[69,47],[77,59],[76,69+wave*4]],P.teal,6);
    b+=rect(27,65-wave*2,23,18,P.coral,4,P.ink,2)+path(`M32 ${65-wave*2}v-4h12v4`)+heroHead(true,inward);
    if(!inward)b+=path('m49 44 7 9 7-9',P.cream)+rect(44,56,10,12,P.paper,2,P.ink,1);
    add('commuter'+(inward?'In':'Out')+(i+1),b);
  }
  const angles=[0,-6,-18,-33,-51,-69,-85,-85],drop=[0,0,2,6,13,21,27,27],shift=[0,0,0,1,3,6,9,9];
  let fall=shadow(50,92,24+i)+`<g transform="translate(${shift[i]} ${drop[i]}) rotate(${angles[i]} 56 58)">${heroSide(.125,i>0)}</g>`;
  if(i===7)fall+=path('M15 58q-4-5-8-1m5-6-2-4m11 6 4-3','none',P.gold,2);
  add('commuterFall'+(i+1),fall);
}

for(const [suffix,color,shape]of [['A',P.coral,0],['B',P.deep,1],['C','#d6b666',2]]){
  function passenger(reach=0,look=false,walk=false){
    let b=shadow(24,74,19),wide=shape===0?3:shape===1?-1:1;
    for(const [j,x]of [17,30].entries()){const foot=walk?x+(j?-8:9):x;
      b+=limb([[j?30:19,51],[x,63],[foot,71]],P.pants,6)+rect(foot-5,69,15,5,P.shoe,2);}
    b+=path(`M${14-wide} 34q11-7 ${19+wide*2} 0l${4+wide} 21q-14 6-${28+wide} 0Z`,color)+path('m18 34 7 8 6-8',P.cream,'');
    b+=limb([[15,37],[11-reach*3,44],[9-reach*5,45-reach*3]],color,5)+circle(9-reach*5,45-reach*3,3.5,P.skin,P.ink,1.3);
    b+=limb([[33,38],[39,48],[37,55]],color,5)+circle(37,55,3.2,P.skin,P.ink,1.1);
    b+=rect(20,26,9,10,P.skin,2);
    b+=`<g transform="translate(${look?-2:0} 0)">`+path(look?'M38 14Q38 2 23 2 8 2 9 18l-6 6 8 3 4 6q14 7 23-7Z':'M8 16Q7 2 23 2q17 0 17 17l5 6-8 3-3 6Q15 38 10 27Z',P.skin)+path('M8 19Q2 4 18 1q18-4 23 12l-9-2-3-5-13 5-2 11Z',P.hair);
    b+=look?path('m11 19 6-3m-3 12q5 3 9-1','none',P.ink,1.8):path('m30 18 5 1m-11 11q7 3 11-1','none',P.ink,1.8);
    if(shape===2)b+=path(look?'M10 25q5-7 11 0l-6 3Z':'M26 27q6-7 12-1l-6 3Z',P.hair,'');
    if(shape===1)b+=rect(look?10:27,11,12,11,P.paper,3,P.ink,1.4);
    b+='</g>';
    if(shape===1)b+=rect(31,53,15,17,P.coral,3,P.ink,1.4)+path('M34 53v-4h9v4');
    return b;
  }
  add('stopPassenger'+suffix+'Idle',passenger());add('stopPassenger'+suffix+'Walk',passenger(0,false,true));
  for(let i=0;i<4;i++)add('queue'+suffix+'Ready'+(i+1),passenger([0,.15,.3,.3][i],i>0));
  for(let i=0;i<6;i++)add('queue'+suffix+'Shove'+(i+1),passenger([.3,.65,1,1,.5,0][i],true));
}

function bus(door=true){
  let b=shadow(182,126,168)+path('M5 31Q2 8 30 7q142-11 285 1 20 0 27 24l18 53-3 25q-1 9-19 9H22Q2 118 3 103Z',P.teal,P.ink,3.5);
  b+=path('M10 32Q9 17 32 16q137-9 281 0 17 2 20 19l13 42Q174 84 9 77Z',P.cream,'',1);
  b+=path('M14 89q150 10 334-1','none',P.gold,8)+path('M13 102q142 10 330-1','none','#7fb4a0',3);
  for(let i=0;i<6;i++){const x=26+i*39;
    b+=rect(x,27,33,45,'#89bcb8',7,P.ink,2.2)+path(`M${x+4} 32q13-5 23 0l-22 22Z`,'#c9e0ca','');
    if(i!==1||!door){b+=path(`M${x+5} 69q0-15 12-15t13 15`,i%2?P.deep:P.coral,'',1)+ellipse(x+17,49,10,12,P.skin)+path(`M${x+7} 45q-1-12 11-11t10 12l-9-5Z`,P.hair,'')+path(`M${x+14} 50h3m5 0h2`,'none',P.ink,1.8);}
  }
  b+=path('M283 26q23-6 36 0l17 46-54-2Z','#8ebcb3',P.ink,2.8)+path('M287 30h22l-21 27Z','#d1e3c8','');
  b+=path('M297 65q2-19 19-12l9 15Z',P.deep,'')+ellipse(309,44,11,13,P.skin)+path('M298 41q-4-14 10-14t15 13l-7-5-13 4Z',P.hair,'')+path('m307 46 7-2m-5 9 8 1','none',P.ink,1.6);
  b+=path('m310 59 15 6 10-2','none',P.ink,3)+path('m344 41 15-3v14','none',P.ink,3)+rect(354,38,8,17,P.deep,3,P.ink,2);
  b+=path('M336 83q18-1 21 4l-4 10-18-4Z',P.gold,P.ink,1.8)+rect(3,87,7,11,P.coral,2,P.ink,1.3)+path('M341 102q11 7 19-1','none',P.ink,2);
  for(const x of [53,296])b+=circle(x,114,14,P.ink)+circle(x,114,8,P.cream)+circle(x,114,3,P.teal);
  if(door)b+=rect(75,18,43,94,P.ink,4)+rect(80,24,33,72,P.deep,3)+rect(80,98,33,7,P.cream,1);
  b+=rect(147,11,71,9,P.ink,4)+circle(158,15,2,P.gold)+circle(169,15,2,P.gold)+circle(180,15,2,P.gold);
  return b;
}
add('stopBus',bus());add('blockBusBack',bus(false));
add('stopBusDoor',rect(0,0,43,94,P.deep,3,P.ink,2)+rect(4,7,14,59,'#a2cbc0',4)+rect(24,7,14,59,'#92bdb4',4)+path('M21 1v90','none',P.cream,2)+path('M7 72h6m14 0h6','none',P.cream,2)+path('M3 91h37','none',P.ink,3));

function shelter(w,h){
  const scale=w/181,sy=h/204;
  return `<g transform="scale(${scale} ${sy})">`+shadow(91,200,87)+path('M14 34q-3 80 1 161m146-166q-3 87 0 166','none',P.ink,6)+
    path('M1 26 21 7q77-13 152-1l6 20Q92 17 1 35Z',P.teal,P.ink,3)+path('M4 33q94-13 172-6','none',P.gold,5)+
    path('M26 44q58-6 119 0l-3 97q-58 5-118 0Z','#bbd9c0',P.ink,2.6)+path('M33 51q54-5 105 0l-2 81H32Z','#e1e8c6','',1)+
    path('M83 49v85','none','#8eb7a6',2)+path('M38 155q51-5 99 0v9H38Z',P.coral,P.ink,2.5)+path('m49 165-1 27m77-27 2 27','none',P.ink,4)+
    path('M42 70h25v39H42Z',P.cream,P.deep,2)+circle(54,81,5,P.gold)+path('M48 94h13m-13 7h9','none',P.teal,2)+
    path('M100 106q-10-15 0-20 15 4 0 20Z',P.gold,P.deep,1.8)+path('M100 108q-12-4-12 9m12-9q12-4 12 9','none',P.deep,2)+'</g>';
}
add('stopShelter',shelter(181,204));add('blockShelter',shelter(158,108));

function window(x,y,w,h,lit=false){return path(`M${x-3} ${y+2}q${w*.5} -8 ${w+6} -2l-2 ${h+5}q-${w*.5} 4-${w+4} 0Z`,P.cream,P.ink,2.2)+
  rect(x+2,y+3,w-4,h-5,lit?'#f3cf79':'#9dc4b4',4)+path(`M${x+w*.5} ${y+4}v${h-6}m-${w*.5-2}-${h*.42}h${w-4}`,'none',P.deep,2)+
  path(`M${x-5} ${y+h+5}q${w*.55} 4 ${w+10} 0`,'none',P.deep,3);}
function building(w,h,kind='shop',floors=1,clock=true){
  const side=w*.1,front=w-side,roof=h*.12,base=h-6,shopH=floors===1?h*.57:h*.3,shopY=base-shopH,wall=kind==='food'?'#e4b983':kind==='office'?'#9dbba4':'#dfc899';
  let b=shadow(w*.5,h-2,w*.48)+path(`M0 ${roof} ${side} 3 ${w-2} 7 ${front} ${roof+3}Z`,'#86a391',P.ink,3)+
    path(`M${front} ${roof+3} ${w-2} 7 ${w-4} ${base-9} ${front-2} ${base}Z`,'#8b9d8c',P.ink,2.7)+path(`M1 ${roof}q${front*.5} 6 ${front-1} 3l-2 ${base-roof-3}H4Z`,wall,P.ink,3);
  b+=path(`M1 ${roof+2}q${front*.5} 5 ${front-1} 2`,'none',P.cream,5);
  if(floors>1){const rows=floors-1,span=shopY-roof-10,cols=w>250?3:2;
    for(let row=0;row<rows;row++)for(let i=0;i<cols;i++){const ww=front/(cols+1)*.61,hh=Math.min(span/rows*.6,ww*1.18),x=front*(i+.6)/(cols+.15),y=roof+11+row*span/rows+(i%2?3:-1);b+=window(x,y,ww,hh,(i+row)%3===1);}
    b+=path(`M${front*.76} ${roof+10}q14 3 11 18v${shopY-roof-19}q0 8 10 9`,'none',P.deep,3.5);
  }
  b+=path(`M8 ${shopY}q${front*.5} -4 ${front-16} 1v${shopH-2}H8Z`,P.deep,P.ink,2.3);
  const doorX=front*.57,doorW=front*.32;
  if(kind==='closed'){b+=rect(15,shopY+7,front*.38,shopH-9,'#a9bfaa',3,P.ink,2);for(let y=shopY+13;y<base-6;y+=8)b+=path(`M18 ${y}h${front*.38-6}`,'none','#7d9e91',1.5);}
  else b+=rect(15,shopY+8,front*.38,shopH-13,'#8eb8a4',5,P.ink,2)+path(`M26 ${shopY+13}l${front*.2} 2-${front*.2} ${shopH*.5}Z`,'#bed8b6','');
  b+=rect(doorX,shopY+6,doorW,shopH-8,'#95bbaa',4,P.ink,2)+path(`M${doorX+doorW*.48} ${shopY+9}v${shopH-13}`,'none',P.cream,2.3);
  b+=circle(doorX+doorW*.62,shopY+shopH*.65,2,P.gold);
  if(kind!=='closed'&&kind!=='office'){
    b+=path(`M1 ${shopY-7}q${front*.5} -2 ${front-1} 2l-2 12q-${front*.5} 12-${front-1} 0Z`,P.cream,P.ink,2.5);
    for(let x=4;x<front-5;x+=26)b+=path(`M${x} ${shopY-6}h13l1 13q-7 6-14 0Z`,kind==='food'?P.coral:P.teal,'');
    b+=path(`M2 ${shopY+6}q${front*.5} 10 ${front-2} 0`,'none',P.ink,2);
  }
  if(kind==='food'){
    const x=front*.73,y=shopY+shopH*.4,r=Math.min(17,front*.065);
    b+=path(`M${x-r} ${y}q${r} ${r} ${r*2} 0q-1 ${r} -${r} ${r}t-${r}-${r}Z`,P.cream,'',1)+path(`M${x-4} ${y-4}q-7-6 0-12m9 12q-7-6 0-12`,'none',P.cream,2);
    b+=rect(17,base-12,front*.35,5,P.coral,2,P.ink,1.5);
  }
  if(kind==='office'){b+=path(`M${front*.48} ${shopY-10}h${front*.48}`,'none',P.gold,7);if(clock)b+=circle(front*.72,roof+20,10,P.cream,P.ink,2)+path(`M${front*.72} ${roof+13}v7l5 2`);}
  b+=path(`M5 ${base}q${front*.5} 3 ${front-5} 0`,'none',P.ink,3);
  return b;
}
for(const [id,kind,floors]of [['stopCorner','food',3],['stopTenement','shop',3],['stopOfficeBlock','office',3],
  ['blockShop','shop',1],['blockBreakfast','food',1],['blockShutter','closed',1],['blockApartment','shop',3],['blockOffice','office',2]]){
  const {width:w,height:h}=old.get(id);add(id,building(w,h,kind,floors,id!=='blockOffice'));
}
add('stopTree',shadow(65,205,54)+path('M60 202q-8-61 8-133l13 3q-15 73-8 130Z','#b89372',P.ink,3)+path('M65 138q-26-15-28-37m36 9 28-24','none',P.ink,4)+
  path('M18 116Q-5 101 14 79 1 53 29 42 26 11 60 18 91-2 105 32q31 0 18 34 17 26-9 42-2 28-32 18-31 21-42-2Z','#81ad89',P.ink,3)+
  path('M22 90q16 13 29-2m8-51q-18 10-8 22m29 30q23 10 28-7M67 66q21-13 24 3','none','#517f74',3)+path('M17 195q48-6 100 0l-7 12H23Z',P.cream,P.ink,2.4));

let sky=rect(0,0,1200,640,'#cfe1cf',0)+circle(956,104,59,'#f9db8e');
for(const [x,y,w,h]of [[-35,130,170,260],[160,80,120,310],[350,137,130,253],[535,55,150,335],[745,99,130,291],[936,32,170,358],[1125,135,120,255]]){
  sky+=path(`M${x} ${y+12}l${w*.7}-9 ${w*.3} 15v${h-18}H${x}Z`,'#a7c3b2','');
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)sky+=rect(x+22+i*w*.23,y+35+j*40,w*.1,18,'#c2d5b9',4);
}
for(const [x,y,s]of [[45,54,1],[415,34,.7],[1090,72,.65]])sky+=`<g transform="translate(${x} ${y}) scale(${s})">`+path('M-38 21q-27-9-8-27 7-35 31-15 30-24 43 9 30-1 27 22-4 15-93 11Z',P.paper,'')+'</g>';
sky+=path('M0 322q290-45 589-13t611-21v352H0Z','#e1d6ac','');add('stopAtmosphere',sky);

// Keep the established ground topology/foot baselines; only redraw its palette.
for(const id of ['stopGround','blockStreets']){
  const source=await readFile(new URL('../assets/'+old.get(id).file,import.meta.url),'utf8');
  const colors={'#d6c8a6':'#e5d3a7','#ded1b2':'#f1e0b8','#6c7771':P.road,'#d9ceb0':'#efdfb5','#bcc1a5':'#b7c9ae','#738078':P.road,'#c7bda0':'#d7c598'};
  add(id,source.replace(/#[\da-fA-F]{6}/g,c=>colors[c.toLowerCase()]??c).replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,''));
}

for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const byId=new Map(assets.map(a=>[a.id,a]));
const next=manifest.map(entry=>{const a=byId.get(entry.id);if(!a)return entry;byId.delete(entry.id);const {body,...meta}=a;return meta;});
next.push(...[...byId.values()].map(({body,...meta})=>meta));await writeFile(manifestURL,JSON.stringify(next,null,2)+'\n');
console.log('Drew '+assets.length+' original cartoon variants; previous artwork preserved.');
