import {writeFile,readFile} from 'node:fs/promises';

// Original CC0 vectors. Match the existing street's scale, outlines and palette.
const P={ink:'#354447',dark:'#3e5354',teal:'#547b77',cream:'#e8d8b7',paper:'#f2e7ce',rust:'#a75740',sun:'#ebba65',skin:'#dcb58b'};
const rect=(x,y,w,h,c,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const path=(d,c,stroke='',sw=1)=>`<path d="${d}" fill="${c}"${stroke?` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
const circle=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const line=(x,y,X,Y,c,w=1)=>path(`M${x} ${y}L${X} ${Y}`,'none',c,w);
const svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>\n`;
const assets=[];
function add(id,label,w,h,body,category='街景角色'){assets.push({id,label,category,file:'original/commute/'+id+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:svg(w,h,body)});}

let s=rect(0,0,1200,290,'#d6c8a6')+rect(0,7,1200,49,'#ded1b2')+rect(0,58,1200,106,'#6c7771')+rect(0,164,1200,8,'#b6ad91')+rect(0,172,1200,118,'#ded1b2');
for(let x=-30;x<1200;x+=65){s+=path(`M${x} 0v52m0-26h65M${x} 176v114m0-70h65m-32 35h65`,'none','#c3b696',1);s+=path(`M${x} 53h45l-5 5h-45Zm0 112h45l-5 5h-45Z`,'#e2d4af');}
s+=line(0,59,1200,59,'#4c625e',2)+line(0,163,1200,163,'#4c625e',2);
for(let x=-80;x<1200;x+=130)if(x<400||x>570)s+=rect(x,111,65,3,'#d7cba4',1);
// Near end is wider; the path remains a straight inward crossing at real height 0.
for(let y=64;y<160;y+=19){const t=(y-58)/106,w=74+32*t;s+=path(`M${520-w/2} ${y}h${w}l1 10H${519-w/2}Z`,P.paper);}
for(const y of [44,176]){s+=rect(471,y,98,7,'#c4b17f');for(let x=475;x<570;x+=8)s+=circle(x,y+3,1.2,'#a59265');}
for(const x of [45,375,1000]){s+=rect(x,54,43,4,'#4a605c');for(let i=0;i<7;i++)s+=line(x+3+i*6,54,x+3+i*6,58,'#8b9786',2);}
s+=path('M0 285 165 275 330 290H0Z','#adad91')+path('M1090 0h110v7h-110Z','#bab396');
add('crossGround','路口 · 连续路面与直向斑马线',1200,290,s,'街景构图');

s=`<ellipse cx="72" cy="175" rx="57" ry="7" fill="${P.ink}" opacity=".13"/>`+rect(69,26,5,144,'#7f836c')+path('M57 168h31l10 8H47Z','#a8a184');
s+=path('M4 39 50 5h45l46 34Z','#788875',P.ink,1.5)+path('M4 39 50 5 36 39Zm67-34 18 34h52L95 5Z','#b6b68f');
s+=path('M4 39v9q8 7 16 0 8 7 16 0 8 7 16 0 8 7 17 0 8 7 16 0 8 7 16 0 8 7 16 0 11 7 24 0v-9Z',P.teal,P.ink,1);
s+=rect(50,145,38,20,'#788875',2)+path('m50 152 38 0M57 145v20m23-20v20','none','#a1a88a',1);
add('crossUmbrella','路口 · 执勤遮阳伞',145,183,s,'街景构图');

for(const green of [false,true]){s=rect(13,32,5,65,P.dark)+path('M8 96h16l5 4H3Z','#65796d')+rect(3,0,25,51,P.ink,4)+rect(6,3,19,44,'#293d3d',2);
  s+=circle(15,14,8,green?'#4b5550':'#cf795b')+circle(15,35,8,green?'#a5c899':'#415c52');
  s+=circle(15,10,2,green?'#685f54':P.paper)+path('M13 15h4v7h-4Z',green?'#685f54':P.paper);
  s+=circle(16,30,2,green?P.paper:'#577267')+path('m16 33-4 4-3-1m7-3 3 5h3m-6-4-3 9m3-8 4 7','none',green?P.paper:'#577267',1.8);
  add(green?'crossSignalGreen':'crossSignalRed',green?'路口 · 行人绿灯':'路口 · 行人红灯',30,100,s,'街景构图');}

function legs(walk){return `<ellipse cx="26" cy="73" rx="17" ry="3" fill="${P.ink}" opacity=".13"/>`+
  path(walk===1?'M17 46 9 61 3 66 7 71l12-7 11-17':walk===2?'M17 46 24 62 35 69l4-5-10-9-3-10':'M17 46 16 66 10 69v3h15l3-25',P.dark)+
  path(walk===1?'M26 46 32 59 43 65l-3 6-17-10-5-14':walk===2?'M27 45 17 60 6 65l4 6 14-8 11-17':'M27 46 31 65 29 70h14l-4-5-4-19','#65766e');}
function head(police=false){let b=rect(22,22,8,8,'#c38d66',2)+path('M14 10q2-11 15-8 12 2 9 16l-5 7q-12 3-18-6Z',P.skin,P.ink,1.2);
  b+=path('M13 15Q9 0 25 0q15-1 15 13l-7-6-16 2Z',P.ink)+line(28,15,33,15,P.ink,1.4)+line(25,21,31,21,'#a26f57',1);
  if(police)b+=path('M11 5 17 0h18l6 7-6 5H12Z','#c4c2a1',P.ink,1.2)+rect(12,7,26,4,P.dark)+path('M28 9h18l-5 4H28Z',P.dark)+circle(27,5,2,P.sun);
  return b;}
function officer(mode){const walk=mode.startsWith('walk')?Number(mode.at(-1)):0;let b=legs(walk)+path('M14 28q13-8 23 0l4 24H10Z','#cfceb4',P.ink,1.3)+path('M20 27 26 34 32 26',P.paper)+rect(12,46,28,4,P.dark)+rect(22,46,6,4,P.sun);
  b+=path('m26 34-2 10h4V34',P.dark)+rect(10,30,6,3,P.dark)+rect(33,29,7,3,P.dark);
  if(mode==='phone')b+=path('M14 30 11 41 21 45 25 40 18 38 21 31M35 29 41 40 29 44 26 40 34 36 28 31','#cfceb4',P.ink,1)+rect(22,34,9,14,P.ink,1)+rect(23,36,7,8,'#9cb5a2');
  else if(mode==='whistle')b+=path('M14 29 7 38 13 45 21 33M35 28l10 4 8-12 4 4-7 17-17-7','#cfceb4',P.ink,1.1)+circle(52,23,3,P.skin)+path('m35 19 8 1','none',P.ink,2)+path('M30 32q11 6 11-9','none',P.dark,1.2);
  else b+=path(walk===1?'M14 30 5 42 14 48 19 42 12 39 22 31M35 30l9 14-8 9-5-5 6-7-10-9':'M14 30 9 45 16 51 20 46 16 41 22 31M35 30l13 9-3 10-6-1 1-7-13-8','#cfceb4',P.ink,1.1);
  return b+head(true);}
for(const [name,mode,label]of [['crossOfficerPhone','phone','交警低头看手机'],['crossOfficerWhistle','whistle','交警吹哨制止'],['crossOfficerWalk1','walk1','交警走路一'],['crossOfficerWalk2','walk2','交警走路二']])add(name,'路口 · '+label,58,78,officer(mode));

function walker(mode){const walk=mode.startsWith('walk')?Number(mode.at(-1)):0;let b=legs(walk)+path('M14 28q13-8 23 0l4 24H10Z','#b89570',P.ink,1.3)+path('M21 27 26 32 31 27',P.cream)+path('m29 31 4 19','none','#826a58',2);
  if(mode==='listen')b+=path('M14 29 5 38 9 48 15 46 12 39 22 31M34 28l8 6 5-7 4 3-7 13-17-10','#b89570',P.ink,1.1)+circle(48,29,3,P.skin);
  else b+=path('M14 29 8 41 20 46 25 41 16 37 22 31M35 29 44 39 31 44 26 41 36 35 29 31','#b89570',P.ink,1.1)+rect(23,33,10,16,P.ink,1)+rect(24,35,8,9,'#9cb5a2')+circle(28,46,1,P.cream);
  b+=rect(2,48,14,16,'#b16a4e',2)+path('M5 49v-5h8v5','none',P.ink,1.5);
  return b+head();}
for(const [name,mode,label]of [['crossWalkerPhone','phone','行人低头看手机'],['crossWalkerListen','listen','行人挠头听训'],['crossWalkerWalk1','walk1','行人走路一'],['crossWalkerWalk2','walk2','行人走路二']])add(name,'路口 · '+label,58,78,walker(mode));

for(const frame of [1,2]){let b=legs(frame)+path('M14 27q11-8 23 0l4 25H10Z',P.teal,P.ink,1.4)+path('M18 26h16v7H18Z',P.dark)+path('M15 31 8 46 14 50 20 34M35 31l9 15-5 5-10-18',P.teal,P.ink,1.1);
  b+=rect(3,49,15,16,P.rust,2)+path('M6 50v-5h8v5','none',P.ink,1.5)+rect(22,20,8,9,'#bd9473',2)+path('M14 8q2-10 15-7 12 2 9 15l-5 8H19l-4-7Z',P.ink)+path('M16 19q10 9 19 0v4l-5 5h-9l-5-5Z','#caa17f');
  add('crossHeroIn'+frame,'路口 · 主角向里走'+frame,58,78,b);}

for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const file=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(file,'utf8')),ids=new Set(assets.map(a=>a.id));
await writeFile(file,JSON.stringify([...manifest.filter(a=>!ids.has(a.id)),...assets.map(({body,...a})=>a)],null,2)+'\n');
console.log('Drew '+assets.length+' original CC0 crosswalk assets.');
