import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { makeServer } from '../server.mjs';
import { examples } from '../src/examples.js';
import { buildPortable } from './build.mjs';
import { pathToFileURL } from 'node:url';

const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.clock.install({time:new Date('2026-10-27T00:00:00Z')});
await page.clock.pauseAt(new Date('2026-10-27T00:00:01Z'));
const change=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Tab');};
const status=()=>page.locator('#status-text').textContent();
async function place(kind,x,y=440) {
  await change('placement-y',y);await page.locator('[data-tool="'+kind+'"]').click();
  const box=await page.locator('#editor-overlay').boundingBox();
  await page.locator('#editor-overlay').click({position:{x:box.width*x/1200,y:box.height*580/640}});
  await change('object-x',x);
}
async function newRule(source,event,type='set') {
  await page.locator('#add-rule').click();const card=page.locator('.rule-card').last();
  await card.locator('[data-rule-source]').selectOption(source);
  await card.locator('[data-rule-event]').selectOption(event);
  await card.locator('[data-action-type]').selectOption(type);return card;
}
async function win(intervention) {
  await page.locator('#play').click();if(intervention)await intervention();await page.clock.runFor(16000);
  assert.equal(await status(),'终于到了');
  assert.equal(await page.locator('#progress-label').textContent(),'100%');
}
try {
  await page.goto('http://127.0.0.1:'+server.address().port);await page.clock.runFor(100);
  await page.locator('#speed').click();await page.locator('#speed').click();
  for(const demo of examples) {
    await page.locator('[data-example="'+demo.id+'"]').click();
    if(demo.id==='example-creature') {
      await page.locator('#play').click();await page.clock.runFor(2500);assert.equal(await status(),'暂时没到');
      await page.locator('#reset').click();
    }
    if(demo.id==='example-floors') {
      await page.locator('#play').click();await page.clock.runFor(4500);
      assert.equal(await status(),'赶路中');assert.match(await page.locator('#stage-note').textContent(),/等电梯/);
      await page.locator('[data-action="call"]').click();await page.clock.runFor(2500);assert.equal(await status(),'终于到了');
    } else await win(demo.id==='example-creature'?()=>page.locator('[data-action="croco"]').click():null);
    await page.locator('#replay').click();await page.clock.runFor(9000);assert.equal(await status(),'终于到了');
    await page.locator('#reset').click();assert.equal(await status(),'准备出发');
  }

  // Author the combined route entirely through controls, including uploaded art.
  await page.locator('#open-editor').click();await page.locator('#editor-new').click();
  await change('edit-name','上下楼，也要带东西');await change('edit-speed',120);
  await page.locator('[data-ref="platform:0"]').click();await change('object-y',520);
  await place('platform',200,350);await change('object-width',700);
  await place('platform',730,180);await change('object-width',470);
  await page.locator('[data-ref="actor"]').click();await change('object-y',520);
  await page.locator('#object-direction').selectOption('-1');await page.locator('#object-direction').selectOption('1');
  await page.locator('[data-ref="goal"]').click();await change('object-y',180);
  await place('object',150,520);await page.locator('#object-skin').selectOption('crate');
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=40;const x=c.getContext('2d');x.fillStyle='#e6b240';x.fillRect(0,0,40,40);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#object-image').setInputFiles({name:'box.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('gothere.editor.v1'));return s.documents.find(d=>d.key===s.activeKey).level.entities[0].appearance?.image?.startsWith('data:image/png;');});
  await newRule('object-1','contact','hold');
  await place('ladder',260,520);await change('object-to-y',350);await change('object-speed',120);
  await place('gate',450,350);
  let card=await newRule('gate-1','contact');
  await card.locator('[data-action-target]').selectOption('gate-1');await card.locator('[data-action-state]').selectOption('open');
  await card.getByRole('button',{name:'＋ 持有条件',exact:true}).click();
  await place('lift',760,350);await change('object-to-y',180);await change('object-speed',120);
  card=await newRule('lift-1','board');await card.locator('[data-action-target]').selectOption('lift-1');
  await card.locator('[data-action-state]').selectOption('upper');
  assert.equal(await page.locator('#editor-test').isDisabled(),false);
  await page.locator('#open-data').click();const authored=JSON.parse(await page.locator('#level-json').inputValue());
  assert.ok(authored.entities[0].appearance.image);assert.equal(authored.entities[0].appearance.skin,'crate');
  await page.locator('#close-data').click();
  await page.locator('#editor-test').click();await win();
  assert.match(await page.locator('#stage-note').textContent(),/手持/);
  await page.locator('#replay').click();await page.clock.runFor(16000);assert.equal(await status(),'终于到了');
  await page.locator('#editor-return').click();
  await page.reload();await page.locator('#open-editor').click();
  assert.equal(await page.locator('#edit-name').inputValue(),authored.name);
  await page.locator('#open-data').click();assert.deepEqual(JSON.parse(await page.locator('#level-json').inputValue()),authored);
  await page.locator('#close-data').click();
  await page.locator('[data-ref="entity:object-1"]').click();await page.locator('#object-skin').selectOption('crocodile');
  await page.getByRole('checkbox',{name:'启用巡逻',exact:true}).check();
  await page.getByRole('checkbox',{name:'启用巡逻',exact:true}).uncheck();
  await page.locator('.rule-card').first().locator('[data-action-type]').selectOption('hurt');
  await page.locator('#editor-test').click();await page.locator('#play').click();await page.clock.runFor(800);
  assert.equal(await status(),'暂时没到');
  await page.locator('#editor-return').click();
  await page.locator('.rule-card').first().locator('[data-action-type]').selectOption('hold');
  await page.locator('#editor-test').click();await win();
  await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../artifacts/content-floors.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});

  // The same code and embedded image also work from the standalone offline file.
  const built=await buildPortable();const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));
  await offline.clock.install();await offline.clock.pauseAt(new Date(Date.now()+1000));
  await offline.goto(pathToFileURL(built.path).href);
  await offline.locator('#open-data').click();await offline.locator('#level-json').fill(JSON.stringify(authored));
  await offline.locator('#apply-level').click();await offline.locator('#speed').click();await offline.locator('#speed').click();
  await offline.locator('#play').click();await offline.clock.runFor(6000);
  assert.equal(await offline.locator('#status-text').textContent(),'终于到了');
  assert.equal(await offline.locator('[data-example]').count(),3);
  assert.deepEqual(errors,[]);
  console.log('PASS content: examples, creature failure/click, lift waiting/call, UI multi-floor authoring, upload, pickup/hurt swap, drafts, replay, offline');
} finally {await browser.close();await new Promise(r=>server.close(r));}
