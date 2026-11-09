import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createSimulation,validateLevel} from '../src/core/engine.js';
import {ASSETS} from '../src/content/library.js';

test('all chapter actors, their state frames and accompanying vehicles use the shared cartoon set',()=>{
  const l=createCommuteChapter(),ids=['caller','owner','officer','jaywalker','scooter','dog','car','tow'];
  for(const id of ids){
    const nodes=l.scene.nodes.filter(n=>n.bind?.id===id);assert.ok(nodes.length,id);
    for(const node of nodes)for(const style of [node,...Object.values(node.variants??{})]){
      for(const asset of [style.asset,...style.animation?.frames??[]].filter(Boolean)){
        assert.match(asset,/^toon/,id+' still uses '+asset);assert.ok(ASSETS.some(a=>a.id===asset));
      }
    }
  }
  const dog=l.scene.nodes.find(n=>n.bind?.id==='dog');assert.notEqual(dog.variants.inactive.asset,dog.asset,'feeding gets a real head-down pose');
  assert.equal(validateLevel(l).valid,true);
  const bare=structuredClone(l);delete bare.scene;
  assert.deepEqual(createSimulation(l).start().step(500).snapshot(),createSimulation(bare).start().step(500).snapshot());
});
