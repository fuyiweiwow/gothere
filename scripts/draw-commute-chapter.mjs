import {writeFile,readFile} from 'node:fs/promises';

// Original CC0 supplements. A shared footprint, palette and light direction
// connect three streets without baking any interaction into the background.
const ink='#354447',teal='#547b77',cream='#e8d8b7',paper='#f2e7ce',rust='#a75740';
const r=(x,y,w,h,c,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}"/>`;
const p=(d,c,s='',w=1)=>`<path d="${d}" fill="${c}"${s?` stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
const c=(x,y,rad,col)=>`<circle cx="${x}" cy="${y}" r="${rad}" fill="${col}"/>`;
const assets=[];
const add=(id,label,w,h,body)=>assets.push({id,label,category:'街景构图',file:'original/commute/'+id+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`});

let s=r(0,173,1200,467,'#b6b69a');
for(const y of [175,350,535]){
  s+=r(0,y,1200,50,'#d8ccad')+r(0,y+3,1200,44,'#e0d3b3')+r(0,y+49,1200,7,'#b4ad90')+r(0,y+56,1200,34,'#6c7771');
  for(let x=-35;x<1200;x+=58)s+=p(`M${x} ${y+5}v40m0-20h58`,'none','#c5b99b',.8)+p(`M${x} ${y+50}h43l-3 5h-43Z`,cream);
  s+=p(`M0 ${y+58}h1200`,'none','#4c625e',1.5);
  for(let x=8;x<1200;x+=100)s+=r(x,y+75,48,2,'#d7cba4');
  for(const x of [60,415,885,1160])s+=r(x,y+55,27,4,ink)+p(`M${x+4} ${y+55}v4m5-4v4m5-4v4m5-4v4`,'none','#a2aa92',1.4);
}
// Broad foundation shadows attach the shop modules to their own sidewalks.
for(const [x,y,w]of [[0,543,985],[1140,543,60],[0,363,111],[265,363,680],[1148,363,52]])s+=r(x,y,w,4,'#9da68d');
s+=r(0,625,1200,15,'#5a6b63');
add('chapterStreets','街区 · 三街与紧凑内外路口',1200,640,s);

// Endpoint-bound paving is separate from the block background: editing the
// passage updates its footprint through the editor's existing fitPassage data.
s=r(0,0,180,120,'#c3b697')+r(0,26,180,68,'#6c7771');
s+=p('M0 27h180M0 93h180','none',paper,1.5);
for(let x=12;x<170;x+=22)s+=r(x,28,10,64,paper);
s+=p('M5 26v68m170-68v68','none',paper,3);
add('chapterCrossing','街区 · 可沿连接铺设的斑马线',180,120,s);
s=r(0,0,180,120,'#c4bea0')+r(0,49,180,62,'#9da68e')+r(0,0,180,4,'#a1a58c')+r(0,116,180,4,'#a1a58c');
for(let x=19;x<180;x+=26)s+=p(`M${x} 6v42`,'none','#b1af94',1);
s+=p('M0 49h180','none','#b8b699',1);
add('chapterAlley','街区 · 可沿连接铺设的平面窄巷',180,120,s);

function shop(breakfast=false){
  let b=p('M0 9 133 2 158 13v89H0Z','#bcae8b')+p('M133 2 158 13v89h-25Z','#8d967c');
  b+=r(0,12,134,4,cream)+r(0,17,134,32,'#c8b996')+r(0,49,134,6,'#e4d3ac');
  for(const x of [11,45,79,113])b+=r(x,22,19,22,teal)+r(x+2,24,7,17,'#a8b8a7')+p(`M${x+10} 22v22M${x-2} 45h23`,'none',cream,1.8);
  b+=r(0,55,134,47,'#566f61')+r(8,66,50,36,'#314b46')+r(68,66,58,36,'#405a51');
  for(let x=0;x<134;x+=16)b+=p(`M${x} 59h16l5 12h-16Z`,x%32?cream:breakfast?rust:teal);
  b+=r(0,54,134,5,breakfast?rust:'#657e67')+r(4,100,154,5,'#87917b')+r(132,16,4,84,'#a0a085');
  b+=r(137,30,18,15,'#a7ae92')+c(147,38,5,'#7b9383')+p('M138 49v41h-3','none','#728b77',2);
  if(breakfast){
    b+=r(14,84,41,6,'#b8956e')+r(18,90,4,12,ink)+r(47,90,4,12,ink);
    b+=p('M81 61q1 6 10 6t10-6Z',paper)+p('M86 58q-3-3 0-6m8 6q-3-3 0-6','none',paper,1.2);
    for(const x of [18,31,44])b+=r(x,77,8,7,'#d5c097',2)+p(`M${x+2} 75q-2-4 0-6`,'none','#b7bea2');
    b+=r(78,80,39,3,'#adab8b')+p('M97 68v34','none','#b1b59b',2);
  }else b+=r(75,77,40,17,'#8fa28b')+p('M76 82h38m-24-5v17m11-17v17','none','#bec5a8',1.5)+r(12,74,37,2,'#b1b59b');
  return b;
}
add('chapterShop','街区 · 连续小店模组',158,105,shop());
add('chapterBreakfast','街区 · 早餐铺模组',158,105,shop(true));

s=p('M0 8h136l14 11v132H0Z','#b2b69f')+p('M136 8 150 19v132h-14Z','#849e92')+r(0,8,136,7,cream)+r(8,23,121,83,'#617f76');
for(const x of [13,43,73,103])for(const y of [28,55,82])s+=r(x,y,21,20,'#9fb7a6')+r(x,y,8,20,'#becbb2')+p(`M${x+10} ${y}v20`,'none','#718f82',1);
s+=r(0,109,136,7,cream)+r(9,117,119,31,'#4a655d')+r(43,117,51,31,'#718d7f')+p('M68 117v31','none','#c9d4bc',2)+r(7,148,130,3,ink)+r(37,112,64,5,teal);
s+=p('M44 135h48','none','#afc6b1',1)+c(48,133,1.8,cream)+c(88,133,1.8,cream);
add('chapterOffice','街区 · 公司外门与整栋楼',150,151,s);

s='';for(const [x,h]of [[4,30],[64,29],[141,32]])s+=`<ellipse cx="${x+3}" cy="36" rx="9" ry="2" fill="${ink}" opacity=".18"/>`+r(x,36-h,6,h,teal,2)+r(x,12,6,6,paper)+r(x-2,34,10,3,ink,1);
s+=p('M85 35h42m-37-3 4 6m11-6 4 6m11-6 4 6','none','#a99c7e',1.5);
add('chapterPosts','街区 · 人行留缝的巷口路桩',151,39,s);

for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const file=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(file,'utf8')),ids=new Set(assets.map(a=>a.id));
await writeFile(file,JSON.stringify([...manifest.filter(a=>!ids.has(a.id)),...assets.map(({body,...a})=>a)],null,2)+'\n');
console.log('Drew '+assets.length+' original CC0 chapter resources.');
