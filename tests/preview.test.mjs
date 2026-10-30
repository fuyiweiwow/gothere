import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreview } from '../src/app/preview.js';
import { createSimulation } from '../src/core/engine.js';
import {buildCandidate} from '../src/generation/generator.js';
import { validateLevel } from '../src/core/schema.js';
import { createEditorExample } from './fixtures/editor-examples.js';

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
test('enemy is a generic object: contact invokes a named behavior containing a hurt action',()=>{
  const level=createEditorExample('creature'),enemy=level.entities.find(e=>e.id==='creature');
  assert.equal(validateLevel(level).valid,true);assert.equal(enemy.kind,'object');assert.equal(enemy.contact,undefined);assert.equal(enemy.appearance,undefined);
  assert.deepEqual(level.rules.find(r=>r.on.source==='creature').actions,[{type:'invoke',target:'creature',behavior:'attack'}]);
  assert.equal(enemy.behaviors.find(b=>b.id==='attack').actions[0].type,'hurt');
  const dangerous=createPreview(level);dangerous.start();dangerous.advance(2000);
  assert.equal(dangerous.snapshot().status,'lost');assert.equal(dangerous.snapshot().reason,'hurt');
  assert.match(dangerous.snapshot().events.at(-1).message,/巡逻生物执行了攻击行为/);
  const safe=createPreview(level);safe.click('stop');safe.start();safe.advance(2000);assert.equal(safe.snapshot().status,'won');assert.equal(safe.snapshot().actor.y,300);
  assert.equal(safe.snapshot().entities.creature.state,'inactive');
  const harmless=structuredClone(level);harmless.entities.find(e=>e.id==='creature').behaviors.find(b=>b.id==='attack').actions=[{type:'set',target:'creature',state:'inactive'}];
  const changed=createPreview(harmless);changed.start();changed.advance(2000);assert.equal(changed.snapshot().status,'won','editing the behavior alone removes danger');
});
test('an active enemy on an upper road does not hurt an actor walking underneath',()=>{
  const level=createEditorExample('creature');level.platforms[0].width=1200;level.goal={x:1100,y:520};
  level.entities=level.entities.filter(e=>e.id!=='ladder');level.entities.find(e=>e.id==='creature').state='active';
  const preview=createPreview(level);preview.start();preview.advance(2000);assert.equal(preview.snapshot().status,'won');
});

test('recorded demonstration respects pause, single step, reset and chunked advance',()=>{
  const {level,plan}=buildCandidate({seed:'playback',steps:3}),kernel=createSimulation(level);kernel.start();let tick=0;
  for(const p of plan){kernel.step(p.tick-tick-1);kernel.click(p.source);kernel.step();tick=p.tick;}
  kernel.step(6000);const recording=kernel.recording();assert.equal(recording.status,'won');
  const before=structuredClone(recording),preview=createPreview(level,{recording});assert.equal(preview.playback,true);
  assert.equal(preview.click(plan[0].source),false,'manual clicks cannot contaminate a solution replay');
  preview.advance(100);assert.equal(preview.snapshot().tick,0);
  for(let i=0;i<plan[0].tick;i++)preview.step();assert.equal(preview.snapshot().status,'paused');
  assert.equal(preview.snapshot().clicks,1);preview.advance(100);assert.equal(preview.snapshot().tick,plan[0].tick);
  preview.start();preview.advance(6000);assert.deepEqual(preview.snapshot(),kernel.snapshot());
  preview.reset();assert.equal(preview.snapshot().tick,0);preview.start();
  for(let i=0;i<600;i++)preview.advance(10);assert.deepEqual(preview.snapshot(),kernel.snapshot());assert.deepEqual(recording,before);
  assert.throws(()=>preview.advance(-1));assert.throws(()=>preview.advance(0.5));
});

test('recorded demonstrations reject malformed, incompatible and unbounded inputs',()=>{
  const level=createEditorExample(),base={schemaVersion:1,levelId:level.id,untilTick:100,status:'won',inputs:[{tick:1,source:'signal'}]};
  for(const change of [{levelId:'elsewhere'},{untilTick:40000},{inputs:[{tick:0,source:'signal'}]},
    {inputs:[{tick:2,source:'signal'},{tick:1,source:'signal'}]},{inputs:[{tick:1,source:'missing'}]},
    {inputs:[{tick:101,source:'signal'}]},{status:'fake'},{inputs:Array.from({length:33},()=>({tick:1,source:'signal'}))}])assert.throws(()=>createPreview(level,{recording:{...base,...change}}));
  assert.throws(()=>createPreview(level,{recording:null}));
});
