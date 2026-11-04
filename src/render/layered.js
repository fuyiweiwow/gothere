import {projectSpace,spaceObjectSurface,passagePosition} from '../core/spatial.js';
import {boundObject,drawResources} from './resources.js';

/** Plane ownership controls occlusion; scene.layer only orders art within a plane.
 * Background layers remain ordinary editable 2D art. No per-pixel 3D projection. */
export function layeredArtOrder(level,snapshot){
  const planes=level.spatial.planes;
  const rank=n=>{
    const object=boundObject(n,level,snapshot),id=object?.space?.plane??n.anchor?.plane;
    const passage=object?.space?.passage?level.entities.find(e=>e.id===object.space.passage)?.passage:null;
    if(object?.passage&&n.fitPassage)return -5000+n.layer;
    if(passage){const a=level.spatial.nodes.find(n=>n.id===passage.from),b=level.spatial.nodes.find(n=>n.id===passage.to),from=planes.find(p=>p.id===a.plane),to=planes.find(p=>p.id===b.plane);
      return (from.order+(to.order-from.order)*object.space.progress)*300+n.layer;}
    if(!id)return -10000+n.layer;
    const plane=planes.find(p=>p.id===id);let order=plane?.order??0;
    const transit=object?.passage?.travelled!==undefined?object.passage:object?.id&&snapshot?.actor?.holding===object.id?snapshot.actor.passage:null;
    if(transit){
      const b=level.spatial.nodes.find(n=>n.id===transit.to),to=planes.find(p=>p.id===b.plane);
      order+=(to.order-order)*transit.travelled/transit.distance;
    }
    return order*300+n.layer;
  };
  return [...(level.scene?.nodes??[])].sort((a,b)=>rank(a)-rank(b));
}

export function drawLayered(ctx,level,snapshot,{logic=false,...options}={}){
  const actor=snapshot?.actor??{...level.actor,direction:level.actor.direction??1},entities=Object.values(snapshot?.entities??Object.fromEntries(level.entities.map(e=>[e.id,e])));
  if(!logic&&level.scene){
    const nodes=layeredArtOrder(level,snapshot).map((n,i)=>({...n,layer:i}));
    drawResources(ctx,{...level,scene:{...level.scene,nodes}},snapshot,options);
    return;
  }
  ctx.fillStyle='#e9ece4';ctx.fillRect(0,0,1200,640);
  const foot=o=>projectSpace(level,o.space.passage?{...passagePosition(level,o.space.passage,o.space.progress),height:o.space.height}:{x:o.x,...o.space}),nodes=level.spatial.nodes;
  for(const plane of [...level.spatial.planes].sort((a,b)=>a.order-b.order)){
    const base=level.spatial.projection.originY-plane.depth;
    ctx.fillStyle='#355158';ctx.font='13px Microsoft YaHei, sans-serif';ctx.fillText(plane.label,16,base+25);
    const surfaces=[...level.platforms,...entities.filter(e=>e.space.plane===plane.id&&e.state==='active'&&(e.surface?.enabled||e.collider?.enabled)).map(spaceObjectSurface)];
    for(const s of surfaces.filter(s=>s.space.plane===plane.id)){
      const a=foot(s),b=projectSpace(level,{x:s.x+s.width,depth:s.space.depth,height:s.space.heightEnd??s.space.height});
      ctx.strokeStyle=s.space.height>0?'#61788b':'#8a9a82';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(a.x,a.y+4);ctx.lineTo(b.x,b.y+4);ctx.stroke();
    }
    for(const e of entities.filter(e=>e.space.plane===plane.id)){
      if(e.passage){
        const a=projectSpace(level,nodes.find(n=>n.id===e.passage.from)),b=projectSpace(level,nodes.find(n=>n.id===e.passage.to));
        ctx.strokeStyle=e.state==='active'&&e.passage.enabled?'#83a698':'#b9bdb3';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();continue;
      }
      const p=foot(e);ctx.globalAlpha=['inactive','disabled','open'].includes(e.state)?.3:1;
      ctx.fillStyle=e.kind==='zone'?'#dbbe6d55':e.contact?'#be7966':'#799a9b';ctx.fillRect(p.x,p.y-(e.height??32),e.width??28,e.height??32);
      ctx.fillStyle='#344d53';ctx.font='11px Microsoft YaHei, sans-serif';ctx.fillText(e.label,p.x,p.y-(e.height??32)-7);ctx.globalAlpha=1;
    }
    for(const [o,kind] of [[level.goal,'goal'],[actor,'actor']])if(o.space.plane===plane.id){
      const p=foot(o);ctx.fillStyle=kind==='actor'?'#bf7a4f':'#6d987a';ctx.fillRect(p.x-10,p.y-(kind==='actor'?32:40),20,kind==='actor'?32:40);
    }
  }
  for(const e of entities.filter(e=>e.space.passage)){const p=foot(e);ctx.globalAlpha=e.state==='active'?1:.3;ctx.fillStyle=e.contact?'#be7966':'#799a9b';ctx.fillRect(p.x-e.width/2,p.y-e.height,e.width,e.height);ctx.globalAlpha=1;ctx.fillStyle='#344d53';ctx.font='11px Microsoft YaHei, sans-serif';ctx.fillText(e.label,p.x-e.width/2,p.y-e.height-7);}
  ctx.strokeStyle='#5f7c86';ctx.lineWidth=1.5;ctx.setLineDash([5,5]);
  for(const n of nodes){const target=nodes.find(t=>t.id===n.next);if(!target)continue;const a=projectSpace(level,n),b=projectSpace(level,target);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  ctx.setLineDash([]);
}
