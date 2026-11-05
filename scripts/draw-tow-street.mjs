import {writeFile,readFile} from 'node:fs/promises';

// Original CC0 additions, sharing the existing street palette and side view.
const P={ink:'#354447',dark:'#3e5354',teal:'#547b77',cream:'#e8d8b7',paper:'#f2e7ce',rust:'#a75740',sun:'#ebba65'};
const rect=(x,y,w,h,c,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const path=(d,c,stroke='',sw=1)=>`<path d="${d}" fill="${c}"${stroke?` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
const circle=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const line=(x,y,X,Y,c,w=1)=>path(`M${x} ${y}L${X} ${Y}`,'none',c,w);
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
const assets=[];
function add(id,label,w,h,body,category='街景角色'){assets.push({id,label,category,file:'original/commute/'+id+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:svg(w,h,body)});}

let s=`<ellipse cx="128" cy="94" rx="119" ry="6" fill="${P.ink}" opacity=".17"/>`;
s+=path('M7 53 25 41 66 35 91 9q5-6 17-6h65q15 0 25 14l22 26 25 9 5 25q0 9-13 9H18Q3 86 3 74Z','#af7359',P.ink,2);
s+=path('M74 36 96 12h34v25Zm64 1V12h31q10 0 15 8l15 18Z','#678b84',P.ink,2);
s+=path('m98 14 28 0-39 22H77Zm44 1h19l-19 21Z','#a5bbb0');
s+=path('M6 60h238v14H6Z','#bd8969')+path('M70 40v39m64-37v37m65-37 9 35','none','#8a594a',1.5);
s+=line(84,48,99,48,P.cream,2)+line(155,48,170,48,P.cream,2)+rect(3,57,12,9,P.paper,2)+rect(236,58,11,8,P.rust,1);
s+=path('M20 82q1-23 22-23 21 0 22 23m133 0q0-23 21-23 21 0 22 23',P.ink);
for(const x of [42,219])s+=circle(x,82,15,P.ink)+circle(x,82,8,'#bac0a7')+circle(x,82,3,'#6c7f77');
s+=rect(18,76,11,4,P.cream)+rect(242,73,10,5,P.dark)+path('M35 36 45 31 60 34','none',P.ink,2)+line(108,4,108,0,P.ink,1);
add('towCar','清障 · 占道私家车',255,101,s);

function truck(rolling){let b=`<ellipse cx="145" cy="110" rx="137" ry="5" fill="${P.ink}" opacity=".18"/>`;
  b+=path('M7 69 13 29q2-13 16-13h57q15 0 20 18l13 42h150v21H10Z',P.dark,P.ink,2);
  b+=path('M14 54 20 29h58v35H12Z',P.cream)+path('M29 29h45v26H18Z','#7d9b8c');
  b+=path('m29 31 26 0-33 22H20Z','#b3c4ac')+rect(83,32,14,31,'#698d83')+rect(18,71,88,20,P.teal);
  b+=rect(113,74,151,19,'#a29572')+rect(118,82,128,6,P.sun)+path('M143 73 170 19h16l-17 54Z',P.rust,P.ink,2);
  b+=path('M180 26 256 68 281 78','none','#b8ad8a',7)+path('M181 25 254 63','none',P.ink,2)+line(254,63,286,48,P.ink,3);
  b+=path('M285 47v10q0 9 9 7l5-4','none',P.ink,3)+path('M246 91h54l7-13','none',P.dark,7);
  b+=rect(38,10,32,7,P.dark,2)+rect(43,3,20,9,P.sun,3)+rect(20,70,9,5,P.paper,1)+rect(8,81,8,8,P.sun,1);
  for(const x of [49,219]){b+=circle(x,98,16,P.ink)+circle(x,98,9,'#a4b29d')+circle(x,98,3,P.dark);
    for(const a of [0,120,240]){const angle=(a+(rolling?55:0))*Math.PI/180;b+=line(x,98,x+7*Math.cos(angle),98+7*Math.sin(angle),P.dark,2);}}
  b+=circle(54,43,7,'#c9a17a')+path('M47 37q7-10 15 1Z',P.dark)+path('M48 52h15v12H44Z','#7d8f78')+line(62,57,68,62,P.ink,2);
  b+=line(9,53,1,53,P.ink,3)+rect(0,44,6,15,P.dark,2);return b;}
add('towTruck','清障 · 拖车',310,116,truck(false));add('towTruckRoll','清障 · 拖车行驶帧',310,116,truck(true));

function caller(mode){let b=`<ellipse cx="23" cy="73" rx="15" ry="3" fill="${P.ink}" opacity=".14"/>`;
  b+=path('M17 46 14 67 9 71h14l4-24 4 20-2 4h13l-6-26Z',P.dark);
  b+=path('M14 27q12-7 22 0l4 25-30-1Z','#b1a17c',P.ink,1.3)+path('M18 27 25 33 30 26',P.cream);
  b+=path('M13 30 5 43 12 51 17 47 12 42 21 32','#b1a17c',P.ink,1.2);
  b+=mode==='phone'?path('m32 29 7 4 2-17-6-1-4 19Z','#b1a17c',P.ink,1.2)+rect(33,11,7,15,P.ink,1)+circle(36,25,3,'#d3ac83'):
    path(mode==='point'?'M32 29 39 34 46 26 49 30 42 42 28 35Z':'M32 29 41 35 49 34v6L39 43 27 35Z','#b1a17c',P.ink,1.2)+circle(48,mode==='point'?28:37,3,'#d3ac83');
  b+=rect(21,21,8,9,'#bc8967',2)+path('M13 12q0-12 14-10 12 2 10 15l-4 8q-12 5-18-4Z','#d8b18a',P.ink,1.3);
  b+=path('M12 14Q9-1 25 0q15-1 14 13L27 7l-11 4-1 8Z',P.ink)+line(26,14,33,12,P.ink,1.7)+line(25,21,32,21,'#95664d',1.3);
  return b;}
add('towCallerAngry','清障 · 被挡路的路人',52,78,caller('angry'));add('towCallerPoint','清障 · 指着挡路车',52,78,caller('point'));add('towCallerPhone','清障 · 路人打电话',52,78,caller('phone'));

function owner(run){let b=`<ellipse cx="24" cy="74" rx="17" ry="3" fill="${P.ink}" opacity=".12"/>`;
  b+=path(run?'M17 43 7 60 1 65 5 70 17 64 29 48':'M17 43 16 64 9 68l3 4h14l2-26',P.dark)+path(run?'M26 45 34 60 45 65l-2 6-16-7-8-17':'M27 44 31 64 29 69h14l-2-5-7-21','#6c7771');
  b+=path('M14 26q13-7 22 1l3 24-30-1Z',P.paper,P.ink,1.4)+path('M14 28 3 41 8 52 13 49 9 41 22 32',P.paper,P.ink,1.1);
  b+=path('M33 29 42 36 45 31 49 34 45 44 32 38Z',P.paper,P.ink,1.1)+rect(43,21,9,15,'#b68c62',1)+path('m43 21 9 0 2 3H42Z',P.cream)+path('m46 21 2-8','none',P.ink,1.3);
  b+=rect(21,20,8,9,'#c49370',2)+path('M13 9q2-9 16-6 10 3 7 15l-5 8q-12 3-17-7Z','#ddb28c',P.ink,1.2);
  b+=path('M12 14Q10-1 27 1q13 1 12 14l-8-7-16 2Z',P.ink)+circle(28,15,2,P.ink)+path('m25 22 6-1','none','#a06b50',1.2);
  return b;}
add('towOwnerIdle','清障 · 拿着早饭的车主',54,78,owner(false));add('towOwnerRun','清障 · 车主追车',54,78,owner(true));

// Continuous pavement uses the same scale as the bus-stop scene, without its bay marking.
s=rect(0,0,1200,222,'#d6c8a6')+rect(0,9,1200,66,'#ded1b2')+rect(0,73,1200,10,'#b6ad91')+rect(0,83,1200,139,'#6c7771');
for(let x=-40;x<1200;x+=67)s+=path(`M${x} 0v68m0-31h65`,'none','#c3b696',1)+path(`M${x} 74h45l-5 7h-45Z`,'#e2d4af');
s+=line(0,86,1200,86,'#4c625e',2)+line(0,154,1200,154,'#c1bc9a',2);
for(let x=0;x<1200;x+=125)s+=rect(x,139,65,3,'#d7cba4',1);
for(const x of [40,410,1090]){s+=rect(x,79,45,4,'#4a605c');for(let i=0;i<7;i++)s+=line(x+3+i*6,79,x+3+i*6,83,'#8b9786',2);}
s+=path('M728 81h301l-6-8H733Z','#d6c8a6')+path('M736 73h278','none','#c1b18f',2)+path('M0 215 190 211 320 222H0Z','#52665f');
add('towGround','清障 · 沿街连续铺面',1200,222,s,'街景构图');
for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const manifestURL=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(manifestURL,'utf8')),ids=new Set(assets.map(a=>a.id));
await writeFile(manifestURL,JSON.stringify([...manifest.filter(a=>!ids.has(a.id)),...assets.map(({body,...a})=>a)],null,2)+'\n');
console.log('Drew '+assets.length+' original CC0 towing-street assets.');
