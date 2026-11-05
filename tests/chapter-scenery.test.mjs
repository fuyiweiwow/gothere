import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {layeredArtOrder} from '../src/render/layered.js';
import {artBounds} from '../src/render/resources.js';
import {setPlaneBaseline} from '../src/editor/layered-editing.js';
import {validateLevel} from '../src/core/schema.js';

test('shelter and independent street props belong to their street and draw over its facades',()=>{
  const l=createCommuteChapter(),byId=id=>l.scene.nodes.find(n=>n.id===id);
  const expected=[['chapter-shelter','front',301,486],['chapter-umbrella','middle',1137,301],
    ['chapter-tree-a','middle',52,277],['chapter-tree-c','front',875,462],['chapter-tree-d','far',271,102],
    ['chapter-bikes-a','middle',270,359],['chapter-bikes-b','front',785,544],['chapter-bikes-c','far',548,184],
    ['chapter-bin-a','front',15,542],['chapter-bin-b','middle',949,357],['chapter-bin-c','far',372,182]];
  for(const [id,plane,x,y]of expected){
    const n=byId(id),bounds=artBounds(n,l);assert.equal(n.anchor.plane,plane,id);assert.equal(bounds.x,x,id);assert.equal(bounds.y,y,id);
  }
  const shelter=byId('chapter-shelter'),shop=byId('chapter-shop-near-1'),order=layeredArtOrder(l);
  assert.ok(order.indexOf(shop)<order.indexOf(shelter));assert.ok(order.indexOf(shelter)<order.findIndex(n=>n.bind?.type==='actor'));
  shop.layer=shelter.layer+1;const changed=layeredArtOrder(l);assert.ok(changed.indexOf(shelter)<changed.indexOf(shop),'the layer control still changes ordering within the street');
  setPlaneBaseline(l,'front',560);assert.equal(artBounds(shelter,l).y,466);
  assert.equal(validateLevel(l).valid,true,validateLevel(l).errors.join('\n'));
  assert.deepEqual(JSON.parse(JSON.stringify(l)),l);
});
