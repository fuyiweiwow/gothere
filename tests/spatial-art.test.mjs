import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialLevel} from '../src/editor/spatial-level.js';
import {createCommuteLevel,COMMUTE_PLAN} from '../src/editor/commute-level.js';
import {artBounds,artCorners,artTransform} from '../src/render/resources.js';
import {moveArt,resizeArt,bindArt} from '../src/editor/resources.js';
import {projectSpace} from '../src/core/spatial.js';
import {validateLevel} from '../src/core/schema.js';
import {createSimulation} from '../src/core/engine.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const fixture=()=>{const l=createSpatialLevel();l.scene={background:'#161e2b',assets:[],nodes:[
  {id:'road-art',label:'地面纹理',asset:'commuteAsphalt',x:0,y:0,width:240,height:80,layer:0,ground:{x:300,depth:80,height:0,width:240,depthSize:80}},
  {id:'tree-art',label:'空间布景',asset:'commuteTree',x:-30,y:-90,width:60,height:90,layer:0,anchor:{x:500,depth:180,height:0}}
]};return l;};

test('ground art corners project the real depth plane under either projection direction',()=>{
  for(const depthX of [.3,-.3]){const l=fixture();l.spatial.projection.depthX=depthX;
    const n=l.scene.nodes[0],g=n.ground,c=artCorners(n,l),b=artBounds(n,l),t=artTransform(n,l);
    assert.deepEqual(c.nw,projectSpace(l,{x:g.x,depth:g.depth,height:0}));
    assert.deepEqual(c.se,projectSpace(l,{x:g.x+g.width,depth:g.depth+g.depthSize,height:0}));
    close(b.x,t.x);close(b.y,t.y);close(b.width,t.width);close(b.height,t.height);
  }
});

test('ground and upright art drag on a fixed height plane; resize preserves the opposite corner',()=>{
  const l=fixture(),logic=structuredClone(l.platforms),n=l.scene.nodes[0],g=n.ground;
  const delta=projectSpace(l,{x:30,depth:20,height:0}),dy=delta.y-l.spatial.projection.originY;
  moveArt(l,n.id,delta.x,dy);close(g.x,330);close(g.depth,100);
  const opposite=artCorners(n,l).se;resizeArt(l,n.id,'nw',delta.x,dy);assert.deepEqual(artCorners(n,l).se,opposite);
  const tree=l.scene.nodes[1],p=artTransform(tree,l);moveArt(l,tree.id,delta.x,dy);const after=artTransform(tree,l);
  close(after.x-p.x,delta.x);close(after.y-p.y,dy);assert.deepEqual(l.platforms,logic);
  const bounds=artBounds(n,l);bindArt(l,n.id,{type:'actor'});assert.equal(n.ground,undefined);
  const bound=artBounds(n,l);for(const k of ['x','y','width','height'])close(bound[k],bounds[k]);
  assert.equal(validateLevel(l).valid,true);
});

test('spatial art rejects mixed bindings, out of world planes and legacy depth decoration',()=>{
  assert.equal(validateLevel(fixture()).valid,true);
  for(const mutate of [n=>n.ground.width=1200,n=>n.ground.depthSize=600,n=>n.ground.height=-1,n=>n.bind={type:'actor'},n=>n.anchor={x:1,depth:1,height:0}]){
    const l=fixture();mutate(l.scene.nodes[0]);assert.equal(validateLevel(l).valid,false);
  }
  const l=fixture();delete l.spatial;assert.equal(validateLevel(l).valid,false);
});

test('an adjoining slope and level platform keep exact walking support at sub-tick seams',()=>{
  const l=createCommuteLevel(),s=createSimulation(l).start();let saw=false;
  for(let t=0;t<250;t++){for(const a of COMMUTE_PLAN)if(a.tick===t)s.click(a.source);s.step();const a=s.snapshot().actor;
    if(t>=100&&a.x>=150&&a.x<=301){saw=true;assert.equal(a.mode,'walking');close(a.space.height,Math.min(240,140+(a.x-150)*2/3));}
  }
  assert.equal(saw,true);
});
