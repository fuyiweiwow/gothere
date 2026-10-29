import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstLevel} from '../src/editor/first-level.js';
import {createEditorStore} from '../src/editor/model.js';
import {validateLevel} from '../src/core/schema.js';
import {createSimulation} from '../src/core/engine.js';

const fixture=()=>{const l=createFirstLevel();l.scene={background:'#151b45',assets:[],nodes:[
  {id:'art-pot',label:'可缩放落物',asset:'window',x:-10,y:-62,width:50,height:62,layer:10,bind:{type:'entity',id:'pot'}}]};return l;};

test('resource documents validate bindings, image sources and bounded visual transforms',()=>{
  assert.equal(validateLevel(fixture()).valid,true);
  for(const mutate of [l=>l.scene.nodes[0].width=NaN,l=>l.scene.nodes[0].height=0,l=>l.scene.nodes[0].bind.id='missing',
    l=>l.scene.nodes[0].asset='missing',l=>l.scene.nodes.push({...l.scene.nodes[0]}),l=>l.scene.nodes[0].layer=999,
    l=>l.scene.assets.push({id:'custom',label:'bad',src:'https://evil.example/a.png',width:16,height:16}),
    l=>l.scene.nodes[0].variants={inactive:{asset:'missing'}},l=>l.scene.nodes[0].animation={frames:['window'],fps:0}]){
    const l=fixture();mutate(l);assert.equal(validateLevel(l).valid,false,'malformed artwork must be rejected');
  }
});

test('art placement and resize change only artwork, persist and undo with the same document',async()=>{
  const {moveArt,resizeArt}=await import('../src/editor/resources.js');
  const l=fixture(),physics=structuredClone(l.entities),store=createEditorStore();store.open('art',l);
  store.change(d=>{moveArt(d,'art-pot',23,-15);resizeArt(d,'art-pot','se',40,30);});
  assert.deepEqual(store.document().entities,physics);assert.equal(store.document().scene.nodes[0].width,90);
  assert.deepEqual(createEditorStore(store.serialize()).document(),store.document());store.undo();assert.deepEqual(store.document(),l);store.redo();
  const a=createSimulation(l),b=createSimulation(store.document());a.start().step(100);b.start().step(100);assert.deepEqual(a.snapshot(),b.snapshot());
});

test('bound art uses actual pose and motion while its size and click bounds remain independent',async()=>{
  const {artTransform,artBounds,entityArtBounds}=await import('../src/render/resources.js');
  const l=fixture(),n=l.scene.nodes[0],e=l.entities.find(e=>e.id==='pot'),before=structuredClone(e);
  assert.equal(artTransform(n,l).x,e.x-10);assert.equal(artBounds(n,l).width,50);assert.equal(entityArtBounds(l,undefined,'pot').height,62);
  const s=createSimulation(l);s.start();s.click('pot');s.step(20);const state=s.snapshot();
  assert.equal(artTransform(n,l,state).y,state.entities.pot.y-62);assert.deepEqual(e,before);
  const beam=l.entities.find(e=>e.id==='antenna');beam.pose.angle=30;n.bind.id=beam.id;n.x=0;n.y=0;n.width=beam.width;n.height=10;
  assert.ok(Math.abs(artTransform(n,l).rotation-30)<1e-8);assert.ok(artBounds(n,l).height>10);
});

test('resource animations sample fixed ticks, pause exactly and state variants override only the art',async()=>{
  const {artTransform}=await import('../src/render/resources.js');const l=fixture(),n=l.scene.nodes[0];
  n.animation={frames:['window','windowOpen'],fps:6};n.variants={inactive:{asset:'windowOpen',height:20}};
  assert.equal(artTransform(n,l,undefined,{tick:0}).asset,'window');assert.equal(artTransform(n,l,undefined,{tick:10}).asset,'windowOpen');
  assert.equal(artTransform(n,l,undefined,{tick:10,animate:false}).asset,'window');
  l.entities.find(e=>e.id==='pot').state='inactive';assert.equal(artTransform(n,l).height,20);
});

test('the authored first level uses a reusable asset library and editable decoration layers',()=>{
  const l=createFirstLevel();assert.ok(l.scene?.nodes.length>=100,'the scene is authored as editable artwork, not hardcoded renderer scenery');
  assert.ok(l.scene.nodes.some(n=>n.bind?.type==='actor'));assert.ok(l.scene.nodes.some(n=>n.bind?.id==='pot'));
  assert.ok(l.scene.nodes.some(n=>n.label.includes('窗')));assert.ok(l.scene.nodes.some(n=>n.label.includes('屋顶')));
});
