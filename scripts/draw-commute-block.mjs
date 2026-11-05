import {writeFile,readFile} from 'node:fs/promises';

// Original CC0 resources for the elevated, parallel-view block. Ground markings
// and buildings are separate images; none of these images implements gameplay.
const ink='#354447',teal='#547b77',cream='#e8d8b7',paper='#f2e7ce',rust='#a75740';
const paving='#d9ceb0',joint='#c7bda0',road='#738078',curb='#ede0bd';
const r=(x,y,w,h,color,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}"/>`;
const p=(d,color,stroke='',width=1)=>`<path d="${d}" fill="${color}"${stroke?` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
const c=(x,y,rad,color)=>`<circle cx="${x}" cy="${y}" r="${rad}" fill="${color}"/>`;
const shadow=(x,y,rx,ry)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}" opacity=".13"/>`;
const assets=[];
function add(id,label,w,h,body){assets.push({id,label,category:'街景构图',file:'original/commute/'+id+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`});}

// All three sidewalks share a 56 px ground band and a 48 px carriageway.
// Roofs may occlude the next road's near edge, but never the walking baseline.
let s=r(0,0,1200,640,'#bcc1a5');
for(const y of [175,350,535]){
  s+=r(0,y,1200,56,paving)+r(0,y,1200,4,'#c6bea0');
  for(let x=-32;x<1200;x+=52)s+=p(`M${x} ${y+4}v16m26 0v18m-26 0v15`,'none',joint,.8);
  s+=p(`M0 ${y+20}h1200m-1200 18h1200`,'none',joint,.8);
  s+=r(0,y+53,1200,3,curb)+r(0,y+56,1200,48,road)+r(0,y+56,1200,3,'#a0a78d');
  for(let x=-30;x<1200;x+=82)s+=r(x,y+79,36,2,'#d9d3ae');
  for(let x=0;x<1200;x+=52)s+=p(`M${x} ${y+54}v4`,'none','#b8b69c',1);
  for(const x of [65,424,885,1168])s+=r(x,y+57,22,4,ink)+p(`M${x+4} ${y+57}v4m5-4v4m5-4v4`,'none','#9ea98f',1);
}
add('blockStreets','街区 · 同一地面上的三条街',1200,640,s);

// Local u runs along the passage, local v across it. The protagonist uses the
// west sidewalk. Only u=126..174 crosses the horizontal carriageway; stripes
// therefore occupy 48 px of the connection rather than its entire length.
s=r(0,0,185,114,paving)+r(0,39,185,50,road)+r(0,35,126,4,curb)+r(0,89,126,4,curb);
for(let u=8;u<126;u+=20)s+=p(`M${u} 0v35m-10 0v-17`,'none',joint,.8);
s+=p('M0 18h126M0 105h126','none',joint,.8);
s+=r(126,0,48,114,road)+r(123,0,3,35,curb)+r(174,0,3,35,curb);
for(let u=129;u<174;u+=11)s+=r(u,3,6,29,paper);
s+=p('M126 3v29m48-29v29','none',paper,1.2);
for(const u of [20,70,110])s+=r(u,63,20,1.5,'#d9d3ae');
s+=r(119,3,3,29,'#d6bb79')+r(180,3,3,29,'#d6bb79');
add('blockCrossing','街区 · 街角步道与局部斑马线',185,114,s);

// The side street continues past the near endpoint into the foreground road.
// This small editable apron is bound to the same passage entrance.
s=r(0,0,114,60,road)+r(0,0,35,11,paving)+r(0,11,35,3,curb)+r(89,0,25,11,paving)+r(89,11,25,3,curb);
s+=p('M0 3h35m54 0h25','none',joint,.8)+r(39,0,50,60,road);
for(const y of [12,46])s+=r(63,y,1.5,14,'#d9d3ae');
add('blockJunction','街区 · 街角车道延伸',114,60,s);

// A second, narrower ground connection. Its upper end crosses the far street;
// paving joints stop at that road, so the alley reads as a gap between blocks.
s=r(0,0,175,96,'#cec8ab')+r(0,43,116,44,'#b3b69c')+r(0,40,116,3,'#b9b497')+r(0,89,116,4,'#a1aa91');
for(let u=12;u<116;u+=20)s+=p(`M${u} 1v39m-10-20h20`,'none','#bdb79d',.8);
s+=p('M0 20h116M0 4h116','none','#c1bba0',1);
s+=r(116,0,48,96,road)+r(113,0,3,40,curb)+r(164,0,3,40,curb);
for(const v of [6,30])s+=r(120,v,40,2,'#c5c4a3');
s+=p('M7 88h88m-65-4v8m16-8v8m16-8v8','none','#8c9a84',1);
add('blockAlley','街区 · 两侧建筑间的窄巷',175,96,s);

function shop(style){
  const food=style==='food',closed=style==='closed',wall=food?'#c6b38c':closed?'#adb69d':'#c8bea0';
  // A horizontal facade with a shallow roof and one consistent receding side.
  let b=shadow(101,117,98,3)+p('M176 32 198 8v82l-22 24Z','#8f9c86');
  b+=r(0,32,176,82,wall)+p('M0 32 22 8h176l-22 24Z','#a8af94');
  b+=p('M7 29 25 12h166l-18 17Z','#bac0a3')+p('M0 32h176l22-24','none',cream,2);
  b+=p('M12 28h152m-127-5h134','none','#9ca88d',.8);
  // A single shop floor, not two miniature stories. Doors clear a 50 px adult.
  b+=r(9,38,61,10,'#496c64')+r(83,38,29,10,'#647f70')+r(126,38,36,10,'#547b72');
  for(const [x,w]of [[9,61],[83,29],[126,36]])b+=r(x+2,40,w/3,6,'#9eb6a3')+p(`M${x+w/2} 39v9`,'none',cream,1.2);
  b+=r(0,54,176,60,'#506e61')+r(8,55,66,59,'#354e46')+r(88,55,78,59,'#3e584d');
  if(closed){
    b+=r(8,55,66,59,'#97a18a');for(let y=59;y<112;y+=5)b+=p(`M8 ${y}h66`,'none','#788f7c',1);
    b+=r(93,65,63,38,'#91a58a')+p('M93 85h63m-41-20v38m20-38v38','none','#bcc6a4',1.5);
  }else{
    for(let x=0;x<176;x+=16)b+=p(`M${x} 52h16l-3 10h-16Z`,x%32?cream:food?rust:teal);
    b+=p('M-3 62h176','none',ink,1.1)+p('M43 64v48m84-48v48','none','#a8b99c',1.4);
  }
  b+=r(0,49,176,4,food?rust:teal)+r(0,113,177,4,'#7f9079');
  b+=p('M184 28v60h-4','none','#6e8676',1.5)+r(180,38,14,12,'#b4bda0')+c(187,44,4,'#819a87');
  if(food){
    b+=r(12,99,52,5,'#b8956e')+r(17,104,4,10,ink)+r(56,104,4,10,ink);
    for(const x of [19,32,45])b+=r(x,91,9,8,'#dbc9a2',2)+p(`M${x+4} 89q-2-4 0-7`,'none',paper,1);
    b+=p('M113 77q3 8 14 8t14-8Z',paper)+p('M121 75q-3-4 0-7m9 7q-3-4 0-7','none',paper,1.1);
  }else b+=r(18,100,48,2,'#acbca0')+r(143,102,13,11,'#9d9871')+p('M149 103q-10-14-12-8m13 8q12-19 14-15','none','#688567',3);
  b+=p('M29 9v-5h25v6l-5 6H24Z','#7c9180')+p('M31 5h20','none','#c0c7a8',1.5);
  return b;
}
add('blockShop','街区 · 露出屋顶的沿街小店',200,120,shop('shop'));
add('blockBreakfast','街区 · 带侧墙的早餐铺',200,120,shop('food'));
add('blockShutter','街区 · 卷帘门与小窗店面',200,120,shop('closed'));

s=shadow(113,177,106,3)+p('M196 32 219 8v142l-23 24Z','#8a9b86')+r(0,32,196,142,'#c3b99a');
s+=p('M0 32 23 8h196l-23 24Z','#9aa78e')+p('M7 29 27 12h183l-18 17Z','#b5bba0');
s+=p('M0 33h196l23-25','none',cream,3)+r(0,36,196,5,'#d7c9a7');
for(const [y,h]of [[53,39],[116,39]])for(const x of [12,53,94,145]){
  s+=r(x,y,27,h,teal)+r(x+2,y+2,10,h-4,'#a7baa4')+p(`M${x+14} ${y}v${h}m-16 1h31`,'none',cream,1.5);
}
s+=r(0,170,196,4,'#6a8270')+r(73,111,43,63,'#426459')+r(77,115,15,55,'#8fa993')+p('M95 113v61','none','#b4c3a6',1.5);
s+=r(160,2,30,18,'#7c9380')+p('M162 2v-2h26v2','none','#526e61',2)+p('M30 8V0m0 3H17m13 0h17','none','#6c8071',1.5);
s+=p('M18 98q55 10 123 0','none','#6a7f6c',1);
for(const [x,color]of [[35,cream],[61,'#8fa58e'],[112,rust]])s+=p(`M${x} 100v13h10v-12Z`,color);
add('blockApartment','街区 · 同视角的沿街公寓',222,180,s);

s=shadow(88,187,84,3)+p('M152 30 176 6v152l-24 26Z','#7e9b8d')+r(0,30,152,154,'#b6c0a8')+p('M0 30 24 6h152l-24 24Z','#8da594');
s+=p('M0 31h152l24-25','none',cream,3)+r(8,43,136,66,'#5b7d71');
for(const x of [15,48,81,114])s+=r(x,50,23,52,'#9fb7a4')+r(x,50,8,52,'#c2ceb2')+p(`M${x+12} 50v52m-12-26h23`,'none','#728e7c',1.2);
s+=r(0,113,152,7,cream)+r(10,122,131,62,'#4a675a')+r(54,122,45,62,'#789886')+p('M77 123v60','none','#c4d0b6',2)+r(8,182,136,4,ink)+r(47,118,59,4,teal);
s+=p('M59 170h35','none','#adc5ad',1.5);
add('blockOffice','街区 · 同视角的公司外门',178,190,s);

// A light canopy, human-height back panel and bench replace the tall billboard.
s=shadow(78,102,73,4)+p('M7 17 28 1h127l-17 16Z','#6f8b7b')+p('M7 17h131v7H7Z',teal)+p('M138 17 155 1v7l-17 16Z','#45675e');
s+=r(15,25,4,74,ink)+r(129,25,4,74,ink)+r(20,29,107,45,'#a9baa1')+r(24,33,99,37,'#c4c9ac');
s+=p('M50 30v44m49-44v44','none','#7c9885',2)+r(29,80,92,4,'#9ca786')+r(36,84,3,15,ink)+r(112,84,3,15,ink);
s+=r(25,44,20,22,'#7e9986')+r(28,47,14,3,cream)+r(28,54,14,1.5,cream)+r(28,60,9,1.5,cream);
add('blockShelter','街区 · 低矮轻薄的候车亭',158,108,s);

// Adult head/body proportions match the other performers; the seated rider and
// scooter together are about one standing adult high at the chapter scale.
s=shadow(27,69,21,2)+r(23,53,8,16,ink,3)+r(25,56,4,12,'#7f9385',1);
s+=p('M14 33h26l5 25H9Z','#a89c68',ink,1.5)+r(18,40,18,12,'#e3d6a7',3)+r(20,42,14,5,paper,1);
s+=p('M18 25 14 42m22-17 4 17','none',ink,4)+p('M17 23q10-6 20 0l-2 16H19Z',rust,ink,1);
s+=p('M17 26 10 34m27-8 7 8','none',rust,6)+p('M5 33h44m-36 0 6 5m21-5-5 5','none',ink,2);
s+=r(9,31,6,4,'#dcb58b',1)+r(38,31,6,4,'#dcb58b',1)+r(23,18,8,6,'#c38d66',2);
s+=p('M18 9q0-7 10-7t10 8l-3 10q-8 6-14-1Z','#dcb58b',ink,1.3)+p('M16 11q0-12 12-12 13 1 13 13H16Z',paper,ink,1.5);
s+=p('M24 15h3m6 0h3','none',ink,1.2)+r(40,21,10,13,'#be8d64',1)+r(41,22,8,3,cream);
add('blockRider','街区 · 校准成人比例的正面骑手',54,72,s);

for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const file=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(file,'utf8')),ids=new Set(assets.map(a=>a.id));
await writeFile(file,JSON.stringify([...manifest.filter(a=>!ids.has(a.id)),...assets.map(({body,...a})=>a)],null,2)+'\n');
console.log('Drew '+assets.length+' original CC0 parallel-view block resources.');
