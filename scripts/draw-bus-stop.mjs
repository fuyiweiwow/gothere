import {writeFile,readFile} from 'node:fs/promises';

// Original CC0 vector set. One coordinate system, palette and light direction;
// large environment pieces and moving actors remain separate library assets.
const P={ink:'#354447',dark:'#3e5354',teal:'#547b77',light:'#a7b8a6',cream:'#e8d8b7',paper:'#f2e7ce',brick:'#b97c60',rust:'#a75740',sun:'#ebba65',road:'#6c7771',shadow:'#344b4c'};
const rect=(x,y,w,h,c,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const path=(d,c,stroke='',sw=1)=>`<path d="${d}" fill="${c}"${stroke?` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
const circle=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const line=(x,y,X,Y,c,w=1)=>`<path d="M${x} ${y}L${X} ${Y}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
function window(x,y,w=30,h=45,lit=false){return rect(x-3,y-3,w+6,h+7,'#bfb398')+rect(x,y,w,h,lit?'#d1bc87':'#74938b')+rect(x+3,y+3,w/2-4,h-6,'#a9bab0')+line(x+w/2,y,x+w/2,y+h,P.dark,2)+line(x,y+h*.55,x+w,y+h*.55,P.dark,2)+rect(x-5,y+h,w+10,4,P.cream);}
function bricks(x,y,w,h){let s='';for(let yy=y;yy<y+h;yy+=15)for(let xx=x+(yy%2?0:10);xx<x+w;xx+=36)s+=line(xx,yy,Math.min(xx+20,x+w),yy,'#9e8064',.7);return s;}
function tree(x,y,scale=1){return `<g transform="translate(${x} ${y}) scale(${scale})">`+path('M-4 0 0-103 5-108 6 0',P.dark)+line(2,-70,-24,-112,P.dark,4)+line(3,-89,26,-127,P.dark,3)+circle(-23,-116,26,'#657f68')+circle(18,-136,32,'#778d6b')+circle(-10,-148,29,'#879873')+circle(35,-106,27,'#798d6b')+circle(-39,-94,23,'#748b69')+path('M-44-103Q-10-89 50-112Q31-63-16-74Z','#607c64')+`</g>`;}
function people(color=P.teal,walk=0,bag=false){let s='';s+=`<ellipse cx="24" cy="73" rx="16" ry="3" fill="${P.ink}" opacity=".14"/>`;
  s+=path(walk?'M20 45 15 59 7 68 13 71 27 57 31 48':'M17 45 17 65 13 69 24 69 26 47',P.dark);
  s+=path(walk?'M26 46 30 57 41 66 35 71 21 57 21 47':'M27 46 29 65 25 70 36 70 33 46','#526367');
  s+=path('M15 27Q23 22 32 27L36 49Q23 54 12 48Z',color,P.ink,1.6);
  s+=path('M18 26 24 35 30 26',P.cream)+path('m24 34-2 11 4 0 0-10',P.rust);
  s+=path(walk?'M14 29 6 40 13 46 17 41 12 38 20 31':'M14 29 9 42 13 52 18 50 15 40 20 32',color,P.ink,1.2);
  s+=path(walk?'M31 28 41 38 37 48 32 46 35 39 27 33':'M31 29 38 43 34 53 29 50 32 41 26 33',color,P.ink,1.2);
  s+=circle(walk?14:16,49,3,'#d5a77e')+circle(32,51,3,'#d5a77e');
  s+=rect(19,21,9,8,'#c38d66',2)+path('M13 10Q14 1 25 3 35 4 35 15L31 24Q21 29 15 21Z','#dcb58b',P.ink,1.4);
  s+=path('M12 15Q9 1 23 0 38 0 36 14L30 10 30 6 18 9 17 17Z',P.ink)+line(26,16,31,16,P.ink,1.5)+line(24,22,29,22,'#a26f57',1);
  if(bag)s+=rect(3,49,15,16,P.rust,2)+path('M6 50v-5h8v5','none',P.ink,2);
  return svg(48,78,s);
}
const assets=[];
function add(id,label,w,h,body,category='街景构图'){assets.push({id,label,category,file:'original/commute/'+id+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:svg(w,h,body)});}

let s='<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#c3d0c0"/><stop offset="1" stop-color="#f1dfb9"/></linearGradient></defs>'+rect(0,0,1200,640,'url(#sky)');
s+=circle(911,118,58,'#f0d59e');
for(const [x,y,w,h]of [[-20,120,130,260],[120,70,76,310],[230,140,100,240],[345,95,66,285],[490,65,100,315],[620,125,90,255],[745,48,130,332],[907,80,66,300],[1000,18,145,362],[1145,110,100,270]]){
  s+=rect(x,y,w,h,'#94a99c')+rect(x+w*.72,y,w*.28,h,'#839f94');
  for(let yy=y+12;yy<y+h;yy+=19)for(let xx=x+9;xx<x+w-10;xx+=14)s+=rect(xx,yy,5,8,'#b7c3ab');
  s+=rect(x-3,y-4,w+6,4,'#b3bdab');
}
s+=path('M0 274Q300 236 580 268T1200 244V640H0Z','#d3d0b2')+`<path d="M0 188Q420 205 760 163T1200 149" fill="none" stroke="#eddfbf" stroke-width="15" opacity=".32"/>`;
add('stopAtmosphere','街景 · 晨雾与远城',1200,640,s);

s=rect(0,0,1200,222,'#d6c8a6')+rect(0,9,1200,66,'#ded1b2')+rect(0,73,1200,10,'#b6ad91')+rect(0,83,1200,139,P.road);
for(let x=-40;x<1200;x+=67){s+=path(`M${x} 0v68m0-31h65`,'none','#c3b696',1)+path(`M${x} 74h45l-5 7h-45Z`,'#e2d4af');}
s+=line(0,86,1200,86,'#4c625e',2)+line(0,154,1200,154,'#c1bc9a',2);
for(let x=0;x<1200;x+=125)s+=rect(x,139,65,3,'#d7cba4',1);
s+=path('M700 63h276v5H700Z',P.sun)+path('M700 66v-14m276 14V52','none',P.sun,3);
for(const x of [40,410,1090])s+=rect(x,79,45,4,'#4a605c')+Array.from({length:7},(_,i)=>line(x+3+i*6,79,x+3+i*6,83,'#8b9786',2)).join('');
s+=path('M0 215 190 211 320 222H0Z','#52665f');
add('stopGround','街景 · 连续人行道与车道',1200,222,s);

// Corner building: irregular silhouette, deep shop recesses, continuous cornices.
s=path('M0 28 288 16 350 43V344H0Z','#b9ad8c')+path('M288 16 350 43V344h-62Z','#8c937b')+rect(0,38,288,9,'#ded0aa')+rect(0,48,288,190,'#c3b28d');
s+=bricks(0,65,288,155)+rect(0,232,288,112,'#697e70')+rect(8,244,125,100,'#3e5853')+rect(150,244,126,100,'#3a5351');
for(const x of [22,102,182])for(const y of [72,146])s+=window(x,y,43,52);
s+=rect(0,219,288,16,'#e5d0a2')+rect(0,233,288,9,'#8b866b');
for(let x=0;x<288;x+=24)s+=path(`M${x} 252h24l6 20h-24Z`,x%48?'#b1674b':'#ddd0a4');
s+=rect(14,279,100,65,'#253f3e')+rect(160,280,96,64,'#536e63')+rect(169,291,77,6,'#b5b49a')+line(212,280,212,344,'#b5b49a',3);
s+=rect(284,48,9,296,'#a3a085')+path('M0 342h350v9H0Z','#747e6a');
s+=rect(273,94,40,29,'#a4aa8e')+rect(278,99,29,18,'#6b8278')+line(310,120,320,120,P.ink,2);
s+=path('M278 126v65h-5v145','none','#747e68',3)+path('M151 249h122v33H151Z','#455e53');
// Shop pictograms, counter and stools carry setting without written signs.
s+=`<ellipse cx="204" cy="265" rx="17" ry="7" fill="${P.cream}"/>`+path('M187 265q1 11 17 11t17-11Z','#c5b58e')+path('M198 253q-5-5 0-10m9 10q-5-5 0-10','none','#b5bd9e',1.5);
s+=rect(28,304,86,9,'#b49770')+rect(33,313,7,31,P.dark)+rect(100,313,7,31,P.dark);
for(const x of [51,85])s+=rect(x,324,21,5,'#9b7859')+line(x+3,329,x+1,342,P.dark,2)+line(x+18,329,x+21,342,P.dark,2);
s+=rect(23,292,13,12,'#d8c49b',3)+rect(43,293,10,10,'#bd9d73',2);
add('stopCorner','街景 · 转角早餐铺',350,351,s);

s=rect(0,16,344,281,'#c8c0a1')+rect(0,24,344,8,'#e7dab5')+rect(0,285,344,24,'#8e9479');
for(const x of [22,105,188,271])for(const y of [49,123,197])s+=window(x,y,43,48,(x+y)%3===0);
s+=path('M8 3h328v15H8Z','#989d81')+rect(15,0,7,10,P.dark)+rect(314,0,8,9,P.dark);
s+=rect(15,271,314,37,'#4c675b')+rect(26,278,294,6,'#aeb191');
for(const x of [45,120,195,270])s+=rect(x,285,45,23,'#809382');
s+=rect(63,99,50,20,'#b0b399')+circle(99,109,7,'#839688')+rect(294,168,31,20,'#a9af94');
s+=line(0,118,344,118,'#aba98c',2)+line(0,193,344,193,'#aba98c',2);
s+=path('M16 184Q120 194 254 180','none',P.dark,1.1);
for(const [x,c]of [[58,P.paper],[92,P.brick],[164,'#739b8a']])s+=path(`M${x} 188v18h18v-20Z`,c)+line(x+3,184,x+3,189,P.dark,1);
add('stopTenement','街景 · 旧公寓整栋',344,309,s);

s=path('M0 60 110 30 110 332H0Z','#9d9981')+rect(110,30,272,302,'#b0b19a')+rect(121,18,249,14,'#d8caab')+rect(138,0,215,18,'#929f8c');
for(const x of [128,187,246,305])for(let y=48;y<245;y+=48)s+=window(x,y,35,31);
s+=rect(110,245,272,12,'#ded2ae')+rect(110,257,272,75,'#617d71');
for(const x of [128,189,250,311])s+=rect(x,270,42,62,'#435f58')+rect(x+4,273,34,51,'#8eaa98');
s+=path('M0 323h382v9H0Z','#78866e')+rect(92,63,8,260,'#d2c39e');
s+=rect(28,135,42,82,'#6d867a')+rect(32,139,34,34,'#a6b7a2')+rect(30,180,42,37,'#7c9281');
add('stopOfficeBlock','街景 · 街角办公楼外立面',382,332,s);

s=path('M8 17 161 0 161 154 8 154Z','#485f57')+path('M20 29 153 13v129H20Z','#c5c3a0')+rect(25,35,121,99,'#849e8e');
s+=line(28,139,148,139,P.ink,3)+path('M18 22h136v10H18Z',P.cream)+rect(13,147,151,7,'#3e5850');
s+=rect(24,153,8,47,P.dark)+rect(143,153,8,47,P.dark)+path('M0 13 165 0 181 13 5 31Z',P.dark)+path('M5 31 181 13v7L5 38Z','#769380');
s+=line(20,201,160,201,'#adac89',3)+rect(37,160,90,6,'#a0a17c')+rect(42,166,6,25,P.ink)+rect(116,166,6,25,P.ink);
add('stopShelter','街景 · 透视候车亭',181,204,s);

s=tree(65,194,1.08)+path('M18 193h100l-5 12H22Z','#747f65')+path('M22 205h90v5H22Z','#a0a385');
add('stopTree','街景 · 树池与树影',132,210,s);

function bus(){let b='';b+=`<ellipse cx="182" cy="123" rx="168" ry="7" fill="${P.ink}" opacity=".22"/>`;
  b+=path('M7 20Q6 6 25 6h295q18 0 24 18l15 62v22q0 10-12 10H18Q3 118 3 103Z',P.dark,P.ink,2);
  b+=path('M10 17h312q12 0 16 16l9 49H10Z',P.cream)+rect(9,82,343,22,P.teal)+rect(9,104,343,8,'#a3b1a0');
  b+=rect(26,20,239,54,P.dark,4)+path('M295 21h25q10 0 13 12l6 37h-44Z','#698b80');
  for(let i=0;i<7;i++){const x=32+i*32;b+=rect(x,24,26,43,'#819f90',2)+path(`M${x} 28h23l-23 24Z`,'#adc1aa');if(i!==1)b+=circle(x+13,46,7,'#c2b69a')+path(`M${x+4} 66v-9q9-10 18 0v9Z`,i%2?'#657a6e':'#495e57');}
  b+=rect(75,18,43,94,P.ink,2)+rect(80,24,33,72,'#294d48')+rect(80,98,33,7,'#bdb394');
  b+=rect(134,13,94,4,'#b4b59a')+rect(274,16,7,62,'#c8c5a0')+path('M308 38q-9 2-8 13v13h21V49q0-9-8-10Z','#9caa93')+circle(310,36,8,'#cfa981')+path('M302 32q3-12 15-3l3 6h-18Z',P.dark)+path('m309 55 16 10 9-2','none',P.ink,4);
  b+=line(347,43,359,43,P.ink,3)+rect(355,35,7,17,P.dark,2)+rect(344,87,10,7,P.sun,2)+rect(4,86,5,10,P.rust,1);
  for(const x of [54,296])b+=circle(x,111,18,P.ink)+circle(x,111,10,'#a8b2a0')+circle(x,111,4,'#5f7770');
  b+=line(124,89,265,89,'#d5c79f',2)+rect(15,10,9,5,P.sun,1);return b;
}
add('stopBus','街景 · 公交车身',365,132,bus(),'街景角色');
s=rect(0,0,43,94,P.dark,1)+rect(4,7,14,59,'#90aa98')+rect(24,7,14,59,'#769d8b')+line(21,0,21,92,P.cream,1.5)+rect(7,70,8,2,P.cream)+rect(27,70,8,2,P.cream)+line(2,91,40,91,'#172f31',4);
add('stopBusDoor','街景 · 可开合公交门',43,94,s,'街景角色');
s=path('M0 16 17 22 24 17 24 4 28 3 29 12 32 1 36 2 35 13 39 4 43 5 41 17 46 11 49 14 39 30Q29 38 18 30L0 26Z','#d5ad82',P.ink,1.5)+path('M0 15h10v15H0Z',P.teal);
add('stopRefusal','街景 · 司机摆手',50,40,s,'街景角色');
for(const [id,label,color,bag]of [['stopWorker','赶路职员',P.teal,true],['stopPassengerA','排队乘客 · 赭色',P.brick,false],['stopPassengerB','排队乘客 · 深绿','#5c7261',true],['stopPassengerC','排队乘客 · 米色','#b4a47f',false]]){
  for(const frame of [0,1])assets.push({id:id+(frame?'Walk':'Idle'),label:label+(frame?'行走':'站立'),category:'街景角色',file:'original/commute/'+id+(frame?'Walk':'Idle')+'.svg',width:48,height:78,source:'gothere-original',license:'CC0-1.0',body:people(color,frame,bag)});
}
// Foreground framing leaves the playable strip unobstructed.
s=path('M0 0h10l3 155-2 25H0Z',P.dark)+path('M9 35 86 22v7L9 43Z',P.dark)+rect(70,21,33,9,'#607b6e',2)+line(3,50,110,71,'#455d53',1.5);
add('stopPole','街景 · 前景路灯',110,180,s);

for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const url=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(url,'utf8'));
const ids=new Set(assets.map(a=>a.id)),kept=manifest.filter(a=>!ids.has(a.id));
await writeFile(url,JSON.stringify([...kept,...assets.map(({body,...a})=>a)],null,2)+'\n');
console.log('Drew '+assets.length+' original CC0 street composition assets.');
