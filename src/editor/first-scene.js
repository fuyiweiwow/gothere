/** An authored resource scene. The renderer knows none of these building or puzzle names. */
export function createFirstScene(level) {
  const scene={background:'#1b204b',assets:[],nodes:[]};let serial=0;
  const add=(asset,label,x,y,width,height,layer=0,extra={})=>{const n={id:'scene-'+(++serial),label,asset,x,y,width,height,layer,...extra};scene.nodes.push(n);return n;};
  const detail=(asset,label,x,y,w,h,extra={})=>add(asset,label,x,y,w,h,6,extra);
  const wall=(asset,label,x,y,w,h)=>add(asset,label,x,y,w,h,-10,{tile:{width:76,height:76}});
  const ledge=(x,y,w,label='石檐口',layer=5)=>add('cornice',label,x,y,w,12,layer);
  const window=(x,y,w=32,h=64,shutters=false,label='窗')=>{
    detail('windowNight',label,x,y,w,h);
    if(shutters){detail('shutter','左百叶窗',x-w*.36,y,w*.3,h);detail('shutter','右百叶窗',x+w*1.06,y,w*.3,h);}
    ledge(x-5,y+h,w+10,'窗沿',7);
  };
  add('moon_full','月亮',290,39,62,62,-70,{opacity:.78});
  for(let i=0;i<34;i++)add('star','星点 '+(i+1),(i*137+21)%1180,20+(i*41)%142,i%3?3:5,i%3?3:5,-69,{opacity:.4+(i%3)*.2});
  add('eiffel','远处的铁塔',128,278,110,200,-60,{opacity:.55});
  for(const [x,y,w,h] of [[-30,348,110,270],[85,310,95,320],[285,355,100,300],[550,333,105,300],[648,261,90,350],[1155,290,100,330]])
    add('house_grey_front','远景小楼',x,y,w,h,-55,{opacity:.22});
  // Left clock tower and the low restaurant, kept separate from the actual support lines.
  wall('wallTeal','左侧餐馆墙面',0,360,190,280);ledge(0,360,193,'餐馆屋顶');
  window(92,398,34,73,true,'餐馆高窗');window(142,500,22,52,false,'餐馆小窗');
  detail('restSign','餐馆招牌',14,563,118,34);detail('drainpipe','左楼雨水管',172,382,8,245);
  wall('wallIndigo','尖塔基座',190,180,134,460);ledge(185,177,145,'钟塔檐口');
  add('spireRoof','钟塔尖顶',209,62,96,116,-8,{rotation:-3});detail('flag','塔顶小旗',244,8,43,80);
  detail('clock','钟塔钟面',235,216,48,48);ledge(213,272,88,'钟塔横沿');
  window(243,300,30,67,false,'钟塔窗');window(243,419,30,70,true,'钟塔下窗');
  detail('drainpipe','钟塔雨水管',314,199,8,421);detail('ivy','钟塔藤蔓',187,309,29,103);
  // Narrow flower building and a lower green residence between it and the hotel.
  wall('wallLavender','花盆楼立面',380,320,143,320);ledge(376,319,151,'花盆楼屋顶');
  detail('flowerPot','布景花盆左',378,267,29,49);detail('flowerPot','布景花盆右',472,267,29,49);
  window(426,349,39,86,true,'阳台拱窗');detail('balcony','生物所在阳台栏杆',351,477,179,45);
  window(401,532,25,66,true,'花盆楼一层左窗');window(469,532,25,66,true,'花盆楼一层右窗');
  detail('drainpipe','花盆楼雨水管',512,340,7,280);detail('ivy','阳台垂藤',374,487,25,98);
  wall('wallTeal','中间绿楼',529,330,231,310);ledge(526,329,238,'绿楼屋顶');
  add('dormerRoof','绿楼老虎窗屋顶',603,301,73,34,-2);
  window(622,330,30,40,true,'屋顶老虎窗');window(562,401,31,75,false,'绿楼左窗');window(693,388,33,85,true,'绿楼右窗');
  detail('chimneyThin','绿楼烟囱',551,298,19,34);detail('drainpipe','绿楼雨水管',743,353,8,273);
  // Right-hand hotel is deliberately dense: mansard roof, cornices, shutters and shopfront.
  wall('wallLavender','旅店主立面',775,200,268,440);ledge(769,197,280,'旅店屋顶檐口');
  add('mansardRoof','旅店蓝瓦屋顶',783,107,252,91,-5);detail('chimney','旅店烟囱',995,130,25,64);
  for(let i=0;i<3;i++){window(802+i*80,228,34,55,false,'旅店顶层窗 '+(i+1));detail('flowerPot','旅店窗台花 '+(i+1),807+i*80,271,24,34);}
  ledge(772,310,274,'旅店腰线');
  window(833,351,78,147,true,'旅店大窗');ledge(772,512,274,'旅店下层檐口');
  detail('hotelSign','旅店招牌',806,574,194,48);detail('drainpipe','旅店左排水管',778,325,8,240);
  detail('ivy','旅店藤蔓',1017,311,27,104);
  wall('wallTeal','亮窗所在楼面',1045,200,155,440);ledge(1040,197,160,'亮窗楼屋顶');
  add('dormerRoof','右楼老虎窗屋顶',1081,229,84,36,2);window(1109,262,30,45,true,'右楼顶窗');
  ledge(1042,329,158,'亮窗楼腰线');detail('drainpipe','右楼排水管',1181,221,8,402);
  window(1070,592,24,37,false,'街边小窗');window(1136,592,24,37,false,'街边小窗');
  // Lower café and doorway add a street layer without creating any physical surfaces.
  wall('wallRose','咖啡店立面',529,530,242,110);ledge(525,529,250,'咖啡店屋顶');
  detail('cafeSign','咖啡店招牌',546,547,199,42);detail('awningRed','咖啡店条纹遮阳篷',530,590,239,27);
  detail('doorKnob','咖啡店门',620,608,35,46);detail('signHangingCup','街边咖啡吊牌',521,556,40,35);
  // Individually editable fragments align with the real path rather than add hidden road.
  for(let i=0;i<level.platforms.length;i++){
    const p=level.platforms[i],angle=Math.atan2((p.yEnd??p.y??440)-(p.y??440),p.width)*180/Math.PI;
    add('cornice','路面石沿 '+(i+1),0,0,Math.hypot(p.width,(p.yEnd??p.y??440)-(p.y??440)),10,12,{bind:{type:'platform',index:i},rotation:angle});
  }
  const bind=(id,asset,label,x,y,w,h,extra={})=>level.entities.some(e=>e.id===id)&&add(asset,label,x,y,w,h,25,{bind:{type:'entity',id},...extra});
  bind('cloud','cloud2','临时云桥资源',-10,-20,200,37,{opacity:.95,variants:{inactive:{opacity:.2}}});
  bind('antenna','antenna','天线桥资源',0,-13,level.entities.find(e=>e.id==='antenna')?.width??175,25);
  bind('umbrella','umbrellaClosed','缓降物资源',3,-48,24,48,{variants:{active:{asset:'umbrellaOpen',x:-18,y:-73,width:67,height:73}}});
  bind('sill','cornice','可倾斜窗台资源',-4,-3,248,14);
  bind('prop','bracket','可抽去支撑资源',-2,-23,36,27,{variants:{inactive:{opacity:.1}}});
  bind('pot-shelf','cornice','落物承托窗沿资源',-5,-20,66,13,{variants:{inactive:{opacity:.25}}});
  bind('pot','flowerPot','可落下花盆资源',-5,-55,40,55);
  bind('creature','catAwake','生物资源',-3,-63,87,68,{variants:{inactive:{asset:'catRest',y:-39,height:43}}});
  add('windowGlow','目的地亮窗资源',-34,-149,68,149,20,{bind:{type:'goal'}});
  add('travelerIdle','主角资源',-15,-46,30,46,30,{bind:{type:'actor'},flipWithDirection:true,
    animation:{frames:['travelerWalk1','travelerWalk2','travelerWalk3','travelerWalk2'],fps:8}});
  return scene;
}
