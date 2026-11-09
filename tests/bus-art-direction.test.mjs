import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusStopLevel} from '../src/editor/bus-stop-level.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {artBounds} from '../src/render/resources.js';
import {ASSETS} from '../src/content/library.js';
import {createSimulation,validateLevel} from '../src/core/engine.js';
import {CARTOON_ART} from '../src/editor/cartoon-art.js';

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

test('cartoon artwork is replaceable scene data and keeps old assets and frame geometry available',()=>{
  const library=new Map(ASSETS.map(a=>[a.id,a]));
  for(const [oldId,newId]of Object.entries(CARTOON_ART)){
    assert.ok(library.has(newId),newId);
    assert.equal(library.get(newId).width,library.get(oldId).width);assert.equal(library.get(newId).height,library.get(oldId).height);
  }
  for(const level of [createBusStopLevel(),createCommuteChapter()]){
    const actor=level.scene.nodes.find(n=>n.bind?.type==='actor');
    assert.equal(actor.asset,'toonCommuterIdle');
    for(const frame of [...actor.animation.frames,...Object.values(actor.variants).flatMap(v=>v.animation?.frames??[]),
      ...level.scene.feedback.filter(f=>f.target===actor.id).flatMap(f=>f.animation?.frames??[])]){
      assert.equal(library.get(frame)?.width,112);assert.equal(library.get(frame)?.height,96);
    }
    assert.equal(level.scene.nodes.find(n=>n.id==='stop-person-a').asset,'toonStopPassengerAIdle');
    assert.equal(validateLevel(level).valid,true);
    const bare=structuredClone(level);delete bare.scene;
    assert.deepEqual(createSimulation(level).start().step(1000).snapshot(),createSimulation(bare).start().step(1000).snapshot());
  }
  for(const id of ['commuterIdle','stopPassengerAIdle','stopBus','blockShelter'])assert.ok(library.has(id),'saved drafts retain '+id);
});
