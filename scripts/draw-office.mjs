import {mkdir,readFile,writeFile} from 'node:fs/promises';

// Original CC0 graybox illustrations. Geometry, state and interaction live in
// the normal level/scene data; these vectors contain no gameplay or text.
const P={ink:'#333d49',teal:'#3f8d89',deep:'#356b73',cream:'#fff1ce',gold:'#edb954',coral:'#d87959',paper:'#fff9e5',skin:'#f0c392'};
const path=(d,fill='none',stroke=P.ink,w=2.4)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rect=(x,y,w,h,fill,r=3,stroke='none',sw=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle=(x,y,r,fill,stroke='none',w=2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const ellipse=(x,y,rx,ry,fill)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const assets=[];
const add=(id,label,width,height,body)=>assets.push({id,label,category:'公司门厅',file:'original/office/'+id+'.svg',width,height,
  source:'gothere-original',license:'CC0-1.0',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>\n`});

let body=rect(0,0,1200,640,'#e9dfc9',0)+rect(24,43,1152,535,P.paper,24,P.ink,3);
body+=rect(24,43,1152,208,'#d0dcd1',24)+rect(24,219,1152,38,'#b3c5b8',0)+path('M25 250h1150','none',P.deep,4);
// A single cutaway room: two parallel walking bands and a visible right return.
body+=rect(25,251,1150,325,'#e7d3ac',0)+rect(50,282,1090,58,'#f4e8ce',8)+rect(50,477,1090,65,'#f4e8ce',8)+rect(1004,291,95,241,'#f4e8ce',8);
body+=path('M50 341h951m99 0h40M50 545h1090','none','#c2ac8d',2);
for(let x=90;x<1150;x+=91)body+=path(`M${x} 284v55m0 140v63`,'none','#dfd1b6',1);
for(let y=360;y<470;y+=37)body+=path(`M1006 ${y}h91`,'none','#dfd1b6',1);
// Tall window bays use the same shallow parallel perspective as the floor.
for(const x of [430,620,810]){
  body+=rect(x,71,155,145,P.cream,8,P.deep,3)+rect(x+8,79,139,128,'#b4d2c9',4);
  body+=path(`M${x+77} 79v128M${x+8} 147h139`,'none',P.paper,4);
  body+=path(`M${x+18} 183v-44h20v44m20 0v-63h24v63m20 0v-34h23v34`,'none','#8fb1aa',8);
  body+=path(`M${x+15} 91l38-6m-37 18 60-9`,'none','#dce9d7',3);
}
body+=rect(90,89,170,126,'#83a9a4',9,P.deep,3)+rect(102,102,145,99,'#b9d5c9',4)+path('M174 103v98','none',P.paper,4);
body+=rect(993,67,137,172,P.cream,9,P.deep,3)+rect(1004,79,114,148,'#7d9d9a',4)+path('M1061 80v145','none','#adc3b7',3);
body+=rect(1041,53,39,11,P.ink,3)+circle(1061,58,3,P.gold);
// Reception island leaves both walk bands and the right connector open.
body+='<g transform="translate(0 27)">'+ellipse(700,447,250,12,'#cbb997')+rect(491,354,457,80,P.teal,14,P.ink,3)+path('M492 372q200-11 455 0','none','#82b6a6',4);
body+=rect(515,340,430,23,P.cream,8,P.ink,3)+rect(615,315,68,25,P.deep,5,P.ink,2)+path('M648 340v7m-15 1h30','none',P.ink,3);
body+=rect(762,333,63,7,P.paper,2)+rect(770,326,53,6,'#b8c8b5',2)+rect(781,319,43,6,P.paper,2);
body+=rect(915,344,14,6,P.coral,2)+path('M923 345v-16','none',P.ink,2)+'</g>';
// Ceiling lamps, baseboards and a foreground threshold frame the whole room.
for(const x of [353,710,1025])body+=path(`M${x} 44v19`,'none',P.deep,2)+ellipse(x,66,34,8,P.cream)+ellipse(x,66,20,4,P.gold);
body+=rect(25,567,1150,12,P.deep,1)+rect(25,581,1150,8,'#c0c7af',1)+path('M58 601h1084','none','#d0c3a7',3);
add('officeLobby','门厅 / 整体地面与建筑关系',1200,640,body);

body=path('M13 6h70v139H13Z','#e3ece0',P.ink,3)+rect(19,11,57,124,'#b8d4ca',2,P.deep,2)+path('M46 14v118','none',P.paper,3);
body+=rect(5,0,86,9,P.deep,3,P.ink,2)+rect(5,141,86,7,P.deep,2)+path('M19 65h57','none',P.paper,5)+circle(70,75,3,P.coral);
body+=path('M24 23 39 18m-15 16 29-9','none',P.paper,3);
add('officeDoorClosed','门厅 / 合拢的玻璃门',96,150,body);
body=rect(5,0,86,9,P.deep,3,P.ink,2)+rect(5,141,86,7,P.deep,2)+rect(7,7,13,134,'#a5cbc1',2,P.ink,2)+path('M13 20v106','none',P.paper,3)+circle(15,75,2,P.gold);
add('officeDoorOpen','门厅 / 被纸箱撑开的玻璃门',96,150,body);
add('officeThreshold','门厅 / 门缝与防撞胶条',62,12,rect(1,4,60,6,'#8d9990',2)+path('M13 4v5m13-5v5m13-5v5m13-5v5','none',P.cream,2));

body=ellipse(32,48,30,4,'#b6a788')+path('M5 19 29 12l28 9v25l-25 5L6 42Z','#d8a467',P.ink,2)+path('M31 26v24m-24-8 24 8 25-5','none','#a77847',2);
body+=path('m5 19-4-8 25-7 3 8 5-11 27 10-4 10-26 5Z',P.cream,P.ink,2)+path('m10 13 16 6m12-6 14 5','none','#d4b280',2)+path('M15 31h9m-9 5h7','none','#a16f43',2);
add('officeParcel','物品 / 能撑门的空纸箱',64,54,body);
body=ellipse(77,15,73,5,'#b8ad91')+path('M5 9 29 3l44 3 37-4 38 7-6 9-64-3-43 4Z','#cda36a',P.ink,2)+path('M28 6l7 10m42-10 2 9m34-9-7 9M13 11l21-2m57 1 17 2','none','#ac824d',1.6);
add('officeCardboard','物品 / 拆平吸水的纸板',154,22,body);
body=path('M5 14q12-14 34-8 29-12 52-2 28-5 45 6 21-3 30 10-15 14-47 7-26 7-52 0-37 9-62-3Z','#95c4c7','#6b9eab',2)+path('M23 15q23-5 43 0m26 3q23 4 47-2','none','#d6ece0',3);
add('officePuddle','危险 / 漫过通道的积水',174,36,body);

for(const pouring of [true,false]){
  body=ellipse(40,139,32,4,'#a9b3a2')+rect(14,40,55,96,P.paper,7,P.ink,2.5)+rect(21,65,40,39,'#86b1ae',5,P.ink,2)+rect(19,114,44,15,'#c1cdbb',3);
  body+=rect(24,2,35,42,'#a5d0cf',11,P.deep,2)+rect(23,36,37,9,P.deep,3)+path('M31 9v19','none','#e1f1dd',4);
  body+=rect(29,71,16,7,P.ink,2)+path(pouring?'M44 71l11-8':'M43 71l1-11','none',pouring?P.coral:P.teal,5)+rect(32,77,10,8,P.cream,2,P.ink,1.5);
  if(pouring)body+=path('M37 87v8m0 7v5m0 7v9m0 7v8','none','#68a5b5',3);
  else body+=path('m48 92 4 4 7-9','none',P.teal,2.5);
  body+=path('M24 120h33m-33 4h33','none','#94aaa2',1.5);
  add(pouring?'officeWaterOn':'officeWaterOff',pouring?'设备 / 未关紧的饮水机':'设备 / 已关紧的饮水机',80,144,body);
}

for(const green of [false,true]){
  body=ellipse(28,93,24,3,'#b6b5a1')+path('M27 52v35m-14 3h29','none',P.deep,7)+rect(6,4,45,54,P.deep,9,P.ink,2.5)+rect(11,12,35,31,green?'#afd9a5':'#b5d2d0',5);
  body+=circle(28,8,2,P.ink)+rect(17,48,23,3,P.gold,1);
  if(green)body+=path('M23 39V20m0 9q-13 1-11-9 11-1 11 9m1-5q0-13 11-10 3 9-11 10','none',P.deep,2.5)+path('m33 35 4 4 7-10','none',P.deep,2.5);
  else body+=path('M16 21v-4h5m14 0h5v4m0 12v4h-5m-14 0h-5v-4','none',P.paper,2);
  add(green?'officeReaderGreen':'officeReader',green?'考勤 / 盆栽识别成功':'考勤 / 等候识别的摄像头',58,98,body);
}

function delivery(step=0){
  let s=ellipse(65,108,59,3,'#b7b09b');
  s+=path(`M28 78  ${step?15:22} 101m19-23 ${step?43:34} 23`,'none',P.ink,8)+path(`M${step?12:18} 104h13m${step?38:31} 0h13`,'none',P.ink,5);
  s+=path('M22 48q12-6 23 2l-1 31-24 1Z',P.coral,P.ink,2)+path('M40 53 56 70l13-4','none',P.ink,9)+path('M40 53 56 70l13-4','none',P.coral,6);
  s+=path('M24 24Q20 6 38 6q19 0 19 18l6 7-8 3-3 11q-21 3-27-8Z',P.skin,P.ink,2)+path('M20 23Q15 9 29 5l3-4 7 3q21-1 22 18l-15-4-17 5Z',P.deep,P.ink,2)+circle(50,28,1.8,P.ink)+path('M45 37h8','none',P.ink,1.5);
  s+=path('M64 69V55m0 14 7 31h49','none',P.ink,4)+rect(69,92,51,8,P.teal,3,P.ink,2)+circle(77,104,5,P.ink)+circle(114,104,5,P.ink);
  s+=path('M80 62h31l-5 28H85Z',P.coral,P.ink,2)+path('M95 62V28','none',P.deep,4)+path('M96 42Q70 38 78 24q20-1 18 18M96 38q2-29 22-25 7 19-22 25M97 57q7-26 24-15-3 16-24 15M95 54Q72 59 72 43q15-9 23 11',P.teal,P.deep,2);
  return s;
}
add('officeCourier','送货 / 带盆栽的小推车',128,114,delivery());
add('officeCourierStep','送货 / 推车步态',128,114,delivery(1));

body=ellipse(29,88,23,3,'#b4b5a1')+path('M22 65 17 86m17-21 6 21','none',P.ink,8)+path('M15 87h12m9 0h12','none',P.ink,5);
body+=path('M16 39q14-9 28 2l-3 26H17Z',P.deep,P.ink,2)+path('M39 43 52 32l-12-9','none',P.ink,10)+path('M39 43 52 32l-12-9','none',P.deep,7)+circle(39,23,4,P.skin);
body+=path('M17 17q0-14 14-14 18 0 17 17l-3 13q-15 9-27-1Z',P.skin,P.ink,2)+path('M13 15 18 2h25l7 15Z',P.deep,P.ink,2)+path('M12 16h39','none',P.ink,4)+circle(34,5,3,P.gold)+circle(39,23,1.6,P.ink)+path('M30 32q6 4 10-1','none',P.ink,1.5)+rect(21,44,8,11,P.gold,2);
add('officeGuardWelcome','保安 / 起来欢迎盆栽',62,94,body);

body=rect(7,36,42,32,P.teal,4,P.ink,2)+path('M18 36V7m21 29V5','none',P.deep,3)+path('M18 23Q-2 26 5 8q17-4 13 15M38 18Q43-4 55 6q5 13-17 12',P.teal,P.deep,2);
add('officePlant','布景 / 盆栽',65,72,body);
add('officeMat','布景 / 入门地垫',136,40,path('M3 8 118 2l14 26L17 37Z',P.deep,P.ink,2)+path('m20 13 85-5m-80 14 85-5m-80 14 85-5','none','#76a39a',2));

await mkdir(new URL('../assets/original/office/',import.meta.url),{recursive:true});
for(const {body,file} of assets)await writeFile(new URL('../assets/'+file,import.meta.url),body);
const manifestURL=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(manifestURL,'utf8')),ids=new Set(assets.map(a=>a.id));
await writeFile(manifestURL,JSON.stringify([...manifest.filter(a=>!ids.has(a.id)),...assets.map(({body,...entry})=>entry)],null,2)+'\n');
console.log('Wrote '+assets.length+' original CC0 office graybox assets.');
