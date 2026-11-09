import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {artBounds} from '../src/render/resources.js';

test('the queue waits under its shelter and boards within one adult step of the canopy',()=>{
  for(const level of [createBusStopLevel(),createCommuteChapter()]){
    const shelter=level.scene.nodes.find(n=>['stop-shelter','chapter-shelter'].includes(n.id));
    const bounds=artBounds(shelter,level),hero=level.scene.nodes.find(n=>n.bind?.type==='actor');
    for(const person of level.entities.filter(e=>e.id.startsWith('passenger-'))){
      assert.ok(person.x>=bounds.x&&person.x<=bounds.x+bounds.width,'the waiting queue belongs under the canopy');
      const destination=person.behaviors.find(b=>b.id==='board').actions[0].x;
      assert.ok(destination>bounds.x&&destination-bounds.x-bounds.width<=hero.height*.75,'boarding must be next to the shelter');
    }
  }
});
