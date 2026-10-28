import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreview } from '../src/app/preview.js';
import { createSimulation } from '../src/core/engine.js';
import { validateLevel } from '../src/core/schema.js';
import { createEditorExample } from '../src/editor/starter.js';

test('art-free editor data: holding, condition, delay and completion chain reaches goal without changing document',()=>{
  const level=createEditorExample(),before=structuredClone(level);
  assert.equal(validateLevel(level).valid,true);assert.ok(level.entities.every(e=>!e.appearance));
  const preview=createPreview(level);preview.start();preview.advance(1000);
  const result=preview.snapshot();assert.equal(result.status,'won');assert.equal(result.actor.holding,'item');
  assert.equal(result.entities.door.state,'open');assert.equal(result.entities.signal.state,'on');
  assert.deepEqual(level,before);
  const snap=preview.snapshot();snap.entities.door.state='closed';assert.equal(preview.snapshot().entities.door.state,'open');
});
test('paused clicks wait for single step; delay queue and results match the game kernel',()=>{
  const level=createEditorExample(),preview=createPreview(level),kernel=createSimulation(level);
  assert.equal(preview.click('not-an-entity'),false);assert.equal(preview.snapshot().tick,0);
  assert.equal(preview.click('signal'),true);assert.equal(preview.snapshot().entities.door.state,'closed');
  preview.step();assert.equal(preview.snapshot().tick,1);assert.equal(preview.snapshot().status,'paused');
  assert.equal(preview.snapshot().timers.length,1);assert.equal(preview.snapshot().timers[0].due,31);
  for(let i=0;i<30;i++)preview.step();
  kernel.start();kernel.click('signal');kernel.step(31);kernel.pause();assert.deepEqual(preview.snapshot(),kernel.snapshot());
  preview.reset();assert.equal(preview.snapshot().tick,0);assert.equal(preview.snapshot().timers.length,0);
});
test('explicit multi-floor transport: missed lift fails, summoned lift reaches upper goal',()=>{
  const level=createEditorExample('floors');assert.equal(validateLevel(level).valid,true);
  const missed=createPreview(level);missed.start();missed.advance(1500);assert.equal(missed.snapshot().status,'lost');assert.equal(missed.snapshot().reason,'fall');
  const called=createPreview(level);assert.equal(called.click('call'),true);called.start();called.advance(1500);
  assert.equal(called.snapshot().status,'won');assert.equal(called.snapshot().actor.y,180);
  assert.equal(called.click('call'),false);
});
