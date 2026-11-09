import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

// Original CC0 companions to the cartoon commuter. Earlier assets stay intact.
const P={ink:'#333d49',teal:'#3f8d89',deep:'#356b73',cream:'#fff1ce',gold:'#edb954',coral:'#d87959',skin:'#f0c392',hair:'#3b3c48',pants:'#586b83',shoe:'#364355',paper:'#fff9e5'};
const path=(d,fill='none',stroke=P.ink,width=2)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const rect=(x,y,w,h,fill,r=3,stroke=P.ink,sw=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle=(x,y,r,fill,stroke=P.ink,sw=1.8)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const shadow=(x,y,rx)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="2" fill="${P.ink}" opacity=".14"/>`;
const limb=(points,color,w=5)=>path('M'+points.map(p=>p.join(' ')).join('L'),'none',P.ink,w+2)+path('M'+points.map(p=>p.join(' ')).join('L'),'none',color,w);
const manifestURL=new URL('../assets/library.json',import.meta.url),manifest=JSON.parse(await readFile(manifestURL,'utf8')),old=new Map(manifest.map(a=>[a.id,a])),assets=[];
function add(id,body,source=id,w=old.get(source).width,h=old.get(source).height){
  const original=old.get(source),key='toon'+id[0].toUpperCase()+id.slice(1);
  assets.push({...original,id:key,label:'漫画 · '+(id==='streetDogEating'?'低头吃早餐的狗':id.startsWith('commuterDrop')?'职员落地 '+id.slice(-1):original.label),file:'original/commute/'+key+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`});
}

function person(role,mode){
  const police=role==='officer',owner=role==='owner',caller=role==='caller',walk=mode.startsWith('walk')?Number(mode.at(-1)):mode==='run'?1:0;
  const color=police?P.cream:owner?P.gold:caller?P.coral:P.deep;
  let b=shadow(26,74,21);
  for(const [j,x] of [19,32].entries()){
    const foot=walk?x+(j?1:-1)*(walk===1?9:-7):x;
    b+=limb([[j?31:20,51],[x,62],[foot,70]],j?P.pants:P.deep,6)+rect(foot-5,69,13,5,P.shoe,2,'none');
  }
  b+=path('M14 34q12-7 24 0l3 20q-14 6-30-1Z',color)+path('m20 34 7 8 6-8',P.paper,'none')+rect(23,28,8,9,P.skin,2,'none');
  if(police)b+=rect(11,49,29,4,P.ink,1)+rect(23,49,7,4,P.gold,1,'none')+path('m26 41-2 7h5l-1-7',P.teal,'none');
  const hands=mode==='point'?[[8,44],[46,28]]:mode==='phone'?(caller?[[8,50],[42,23]]:[[23,44],[29,44]]):mode==='whistle'?[[17,26],[51,29]]:mode==='listen'?[[8,44],[41,14]]:walk?[[9,46+(walk===1?6:-4)],[44,46+(walk===1?-4:6)]]:[[10,54],[43,52]];
  for(const [i,hand] of hands.entries())b+=limb([[i?36:16,36],[i?43:9,43],hand],color)+circle(...hand,3.3,P.skin,P.ink,1.3);
  // Big heads and small shoes share the main character's proportions.
  b+=path('M11 16Q9 2 27 2q17-1 18 14l5 7-8 3-3 7q-16 9-26-4Z',P.skin);
  b+=path(owner?'M11 18Q6 2 23 1q19-3 23 13l-12-6-12 4-6 10Z':'M11 20Q4 5 20 1q21-5 26 15l-10-5-3-5-15 6-2 11Z',P.hair);
  b+=path('m33 19 5-1m-8 11q5 3 10-1','none',P.ink,1.6)+circle(36,23,1.5,P.ink,'none');
  if(caller)b+=path('m31 14 9 2m-12 13q7-5 13-1','none',P.ink,1.6);
  if(police)b+=path('M9 9 16 2h23l7 9-6 4H11Z',P.cream)+rect(10,10,29,4,P.deep,1)+path('M27 13h22l-6 5-16-1Z',P.deep)+circle(27,7,2,P.gold,'none');
  if(mode==='whistle')b+=path('m40 26 5 1','none',P.ink,2)+path('m48 19 4-4m0 8h4','none',P.gold,1.5);
  if(mode==='phone'){const x=caller?40:23,y=caller?19:36;b+=rect(x,y,9,16,P.ink,2)+rect(x+2,y+3,5,9,'#a7d2c5',1,'none');}
  if(owner)b+=rect(3,47,14,17,P.paper,3)+path('M6 47v-4h8v4')+circle(10,54,3,P.gold,'none');
  if(role==='walker')b+=rect(3,48,13,16,P.coral,3)+path('M6 48v-4h7v4');
  return b;
}
for(const [role,entries] of [
  ['caller',[['towCallerAngry','idle'],['towCallerPoint','point'],['towCallerPhone','phone']]],
  ['owner',[['towOwnerIdle','idle'],['towOwnerRun','run']]],
  ['officer',[['crossOfficerPhone','phone'],['crossOfficerWhistle','whistle'],['crossOfficerWalk1','walk1'],['crossOfficerWalk2','walk2']]],
  ['walker',[['crossWalkerPhone','phone'],['crossWalkerListen','listen'],['crossWalkerWalk1','walk1'],['crossWalkerWalk2','walk2']]],
])for(const [id,mode]of entries)add(id,person(role,mode));

for(const eating of [false,true]){
  let b=shadow(27,37,24)+path('M11 23Q4 15 3 8q9 3 12 10',P.gold)+path('M15 20q13-10 24 0l1 13-7 2-2-7-10 1-2 7h-7Z',P.gold);
  b+=path('M17 30v6m18-8 4 7','none',P.ink,3);
  b+=eating?path('M35 19q10-3 15 6l3 8q-6 6-15 0l-5-8Z',P.coral)+path('M34 21q-7 6 1 10',P.deep)+path('M44 31h7m-6-5h1'):
    path('M32 13Q30 4 40 4l10 7 3 12-8 5-12-5Z',P.coral)+path('M34 7q-9 3-5 15l7-2Z',P.deep)+circle(45,14,2,P.paper)+circle(46,14,1,P.ink,'none')+path('m49 21 4 0m-15 2 5 2');
  b+=path('M21 20q4 3 6-1','none',P.cream,2);
  add(eating?'streetDogEating':'streetDog',b,'streetDog');
}

function scooter(phone=false){
  let b=shadow(77,105,72);
  for(const x of [25,122])b+=circle(x,87,16,P.ink)+circle(x,87,9,P.cream)+circle(x,87,3,P.teal);
  b+=path('M20 78h47l14-16h34l16 19-8 8H39Z',P.teal)+path('M22 80 29 53l-7-20h15l10 37h20v15H28Z',P.cream)+path('M25 34 15 28l-4-12','none',P.ink,3);
  b+=rect(85,53,48,9,P.ink,4)+rect(104,28,39,27,P.coral,4)+rect(109,8,29,19,P.gold,3)+path('M118 8v18m11-18v18m-20 9h27','none',P.cream,2);
  b+=limb([[77,48],[82,65],[57,68],[48,91]],P.pants,9)+rect(41,88,17,6,P.shoe,2,'none');
  b+=path('M61 30q14-7 26 4l1 22-29-3Z',P.coral)+limb([[64,34],[47,46],phone?[42,28]:[29,36]],P.coral,6)+limb([[82,36],[65,48],[35,40]],P.coral,6);
  b+=circle(69,20,13,P.skin)+path('M54 16Q53 1 70 1q18 0 17 17H54Z',P.cream)+rect(53,14,35,4,P.gold,2)+path('m59 24 5-1m-3 8h7','none',P.ink,1.5);
  if(phone)b+=rect(34,20,10,17,P.ink,2)+rect(36,23,6,9,'#a7d2c5',1,'none');
  return b;
}
add('scootRider',scooter());add('scootRiderPhone',scooter(true));
let rider=shadow(27,68,22)+circle(26,60,10,P.ink)+circle(26,60,5,P.cream)+path('M10 49q17-6 33 0l4 13H8Z',P.teal)+rect(8,30,38,21,P.coral,3)+rect(12,25,30,10,P.gold,2);
rider+=path('M16 31q10-9 23 0l-1 21H15Z',P.coral)+limb([[16,34],[11,44],[15,49]],P.coral)+limb([[38,34],[44,44],[38,49]],P.coral)+circle(27,18,13,P.skin)+path('M12 16Q11 2 27 2q17 0 17 15Z',P.cream)+rect(11,14,34,4,P.gold,2)+path('m19 22 4-1m8 0 4 1m-12 7h8','none',P.ink,1.5);
add('blockRider',rider);

function wheels(xs,y){return xs.map(x=>circle(x,y,16,P.ink)+circle(x,y,9,P.cream)+circle(x,y,3,P.deep)).join('');}
let car=shadow(127,94,119)+path('M9 62 28 48l28-31q10-11 34-11h73q19 0 30 16l21 30 29 8q8 1 8 12v11H4V71Z',P.coral,P.ink,3);
car+=path('m57 23-22 28h155l-17-27q-4-6-15-6H72q-9 0-15 5Z',P.cream)+path('M109 18v33m-73 1q76 7 155 0','none',P.ink,2.5)+path('M11 68q112 9 232-1','none',P.gold,4)+rect(7,69,16,8,P.paper,2)+rect(227,68,17,8,P.paper,2)+wheels([50,202],81)+path('M131 66h13','none',P.cream,3);
add('towCar',car);
for(const roll of [false,true]){
  let b=shadow(154,108,146)+path('M6 79h189l-12-39H15Z',P.teal,P.ink,3)+path('M194 41V17q0-9 12-9h53q11 0 17 14l24 43v31H192Z',P.gold,P.ink,3);
  b+=path('M206 20h45q8 0 12 10l16 28h-73Z',P.cream)+path('M237 20v38','none',P.ink,2)+rect(198,67,92,21,P.coral,2)+rect(277,74,22,8,P.paper,2)+wheels([49,170,257],96);
  b+=path('M49 75 98 20l55 57','none',P.ink,8)+path('M49 75 98 20l55 57','none',P.gold,4)+path('M98 20h69v46l-6 9-7-4','none',P.ink,3)+path('M11 85h174','none',P.cream,3)+rect(207,73,23,5,P.paper,1,'none');
  if(roll)b+=path('m20 100 7-3m126 3 7-3m81 3 7-3','none',P.paper,2);
  add(roll?'towTruckRoll':'towTruck',b);
}

// Recover full, unclipped body bounds on an expanded canvas, then ground every
// falling pose at the same foot origin used by the ordinary resource binding.
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage();
  for(let i=1;i<=8;i++){
    const original=await readFile(new URL('../assets/'+old.get('toonCommuterFall'+i).file,import.meta.url),'utf8');
    const body=original.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'').replace(/<ellipse[^>]*opacity="\.14"\s*\/>/,'');
    const bounds=await page.evaluate(async body=>{
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="336" height="288" viewBox="-112 -96 336 288">${body}</svg>`;
      const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(svg);await img.decode();
      const c=document.createElement('canvas');c.width=336;c.height=288;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
      const data=ctx.getImageData(0,0,336,288).data;let left=336,right=0,bottom=0;
      for(let y=0;y<288;y++)for(let x=0;x<336;x++)if(data[(y*336+x)*4+3]>200){left=Math.min(left,x-112);right=Math.max(right,x-112);bottom=Math.max(bottom,y-96);}
      return {left,right,bottom};
    },body);
    const dx=Math.max(2-bounds.left,Math.min(0,109-bounds.right)),dy=89-bounds.bottom;
    add('commuterDrop'+i,shadow(56,90,25)+`<g transform="translate(${dx} ${dy})">${body}</g>`,'commuterFall'+i);
  }
}finally{await browser.close();}
for(const a of assets)await writeFile(new URL('../assets/'+a.file,import.meta.url),a.body);
const pending=new Map(assets.map(a=>[a.id,a])),next=manifest.map(a=>{if(!pending.has(a.id))return a;const {body,...meta}=pending.get(a.id);pending.delete(a.id);return meta;});
next.push(...[...pending.values()].map(({body,...meta})=>meta));await writeFile(manifestURL,JSON.stringify(next,null,2)+'\n');
console.log('Drew '+assets.length+' cartoon actors, vehicles and grounded landing frames; earlier resources preserved.');
