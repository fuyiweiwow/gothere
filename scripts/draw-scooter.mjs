import {writeFile,readFile} from 'node:fs/promises';

// Original CC0 vectors in the shared street palette; every piece remains editable.
const ink='#354447',teal='#547b77',paper='#f2e7ce',cream='#d9c7a5',rust='#a75740';
const r=(x,y,w,h,c,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}"/>`;
const p=(d,c,s='',w=1.5)=>`<path d="${d}" fill="${c}"${s?` stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`:''}/>`;
const c=(x,y,rad,col)=>`<circle cx="${x}" cy="${y}" r="${rad}" fill="${col}"/>`;
const assets=[];
const add=(id,label,w,h,body,category='街景构图')=>assets.push({id,label,category,file:'original/commute/'+id+'.svg',width:w,height:h,source:'gothere-original',license:'CC0-1.0',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`});
let s=r(0,16,485,373,'#a8ad91')+r(8,24,468,351,cream)+r(0,10,485,12,ink)+r(12,0,459,10,'#d6c9ab');
for(const x of [26,112,198])for(const y of [45,120,195]){s+=r(x,y,60,49,teal)+r(x+4,y+4,52,41,'#87998b')+p(`M${x+30} ${y}v49M${x} ${y+25}h60`,'none',cream,3)+r(x-4,y+49,68,5,'#c6ae86');}
s+=r(287,51,178,338,'#938e74')+p('M292 389V195q0-89 85-89t85 89v194Z',ink)+p('M306 389V198q0-73 71-73t71 73v191Z','#5b6960');
s+=p('M306 389V198q0-73 71-73v264Z','#78816c')+p('M377 195 448 389H306Z','#90917a');
s+=r(278,192,16,197,'#d6c6a5')+r(460,192,16,197,'#d6c6a5')+r(0,363,282,26,'#a6a68c');
for(let y=260;y<360;y+=25)s+=p(`M0 ${y}h282`,'none','#c4b594',1);
s+=p('M5 324h251m-241 20h213','none','#958f77',2)+r(250,288,18,60,'#6b7c6b')+r(246,285,26,6,teal);
add('scootAlley','街巷 · 公寓院门与通道',485,389,s);
s='';for(const x of [14,122])s+=`<ellipse cx="${x+4}" cy="52" rx="14" ry="4" fill="${ink}" opacity=".16"/>`+r(x,5,9,44,teal,3)+r(x,12,9,8,paper)+r(x-4,47,17,5,ink,2)+c(x+4,6,5,'#718b7a');
s+=p('M33 49h76m-72-5 8 9m15-9 8 9m15-9 8 9m15-9 4 4','none','#b3a788',2);
add('scootPosts','街巷 · 留有缺口的路桩',149,56,s);
s=`<ellipse cx="48" cy="54" rx="46" ry="4" fill="${ink}" opacity=".16"/>`+p('M14 12 8 51m72-39 8 39','none',ink,6)+p('M14 12 8 51m72-39 8 39','none',teal,3)+r(1,8,94,25,rust,3)+r(1,5,94,4,'#d69c70',2);
for(let x=7;x<86;x+=23)s+=p(`M${x} 8h12l-12 25H${x-12}Z`,paper);
s+=r(1,32,94,3,ink,1)+p('M8 51h-5m85 0h5','none',ink,3);
add('scootBarrier','街巷 · 活动路障',96,58,s,'街景物件');
const bike=(x)=>c(x+16,49,15,ink)+c(x+16,49,12,'#bbc0a3')+c(x+70,49,15,ink)+c(x+70,49,12,'#bbc0a3')+p(`M${x+16} 49l19-30 12 30h-31l22-19h17l15 19m-32-19-6-14m24 15-7-24h11`,'none',teal,3)+p(`M${x+27} 14h13`,'none',ink,4);
add('scootBikes','街巷 · 墙边的两辆自行车',140,73,bike(0)+bike(44),'街景物件');
add('scootBins','街巷 · 路边垃圾桶',70,61,r(3,12,29,44,teal,3)+r(1,7,34,8,ink,2)+r(37,12,29,44,'#8c8a6b',3)+r(35,7,34,8,ink,2)+p('M10 19h13m21 0h13','none',paper,3)+c(10,58,3,ink)+c(27,58,3,ink)+c(44,58,3,ink)+c(60,58,3,ink),'街景物件');
for(const phone of [false,true]){
  s=`<ellipse cx="77" cy="104" rx="73" ry="5" fill="${ink}" opacity=".16"/>`;
  s+=c(25,87,17,ink)+c(25,87,10,'#bac5b1')+c(122,87,17,ink)+c(122,87,10,'#bac5b1');
  s+=p('M21 77h47l12-15h37l13 20-6 7H41Z',teal,ink,2)+p('M22 82 31 55l-7-21h15l7 36h21v15H27Z','#83998c',ink,2)+p('M28 35 16 30m2 0-6-13','none',ink,3)+c(10,15,5,'#a6b7a4');
  s+=r(86,54,48,9,ink,4)+r(105,28,39,28,rust,3)+r(109,30,31,5,paper)+r(109,7,30,20,'#d5b484',2)+p('M118 7v20m9-20v20M117 40h14','none',cream,2);
  s+=p('M70 48 84 66 58 70l-7 22h-9l3-32 23-15Z',ink,ink,2)+p('M69 28q13-2 20 9l-2 21-25-4-6-18Z',rust,ink,1.5);
  s+=p(phone?'M61 34 48 45l-7-14m41 11L60 48':'M60 35 47 47 32 37m47 2L56 51 34 41','none',rust,7);
  if(phone)s+=r(35,22,10,16,ink,2)+r(37,25,6,8,'#b8d5bb');
  s+=r(66,19,9,11,'#c38d66',2)+p('M59 7q5-9 16-3l7 11-6 12-12-1-7-10Z','#dcb58b',ink,1)+p('M54 11q0-13 16-11 13 1 14 14H56Z',paper,ink,1.5)+p('M62 19h4','none',ink,1.3);
  if(phone)s+=p('M54 1q-6-10-7 0m43 2q8-7 7 4','none','#8a9c8c',2);
  add(phone?'scootRiderPhone':'scootRider',phone?'街巷 · 骑手停下看手机':'街巷 · 满载电瓶车与骑手',154,110,s,'街景角色');
}
for(const a of assets)await writeFile('assets/'+a.file,a.body);
const library=JSON.parse(await readFile('assets/library.json','utf8')),ids=new Set(assets.map(a=>a.id));
await writeFile('assets/library.json',JSON.stringify([...library.filter(a=>!ids.has(a.id)),...assets.map(({body,...a})=>a)],null,2)+'\n');
console.log('Wrote '+assets.length+' original CC0 scooter assets.');
