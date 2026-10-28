import { openPanel, choosePlacement } from './editor-controls.mjs';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { makeServer } from '../server.mjs';
import { levels } from '../src/levels.js';
import { solutions } from '../tests/solutions.mjs';
import { createSimulation } from '../src/core/engine.js';

const server=makeServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const errors=[],authored=[];page.on('pageerror',error=>errors.push(error.message));
const change=async(id,value)=>{if(id.startsWith('edit-'))await openPanel(page,'map');const input=page.locator('#'+id);await input.fill(String(value));await input.press('Tab');};
const draft=()=>page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('gothere.editor.v1'));return saved.documents.find(d=>d.key===saved.activeKey).level;});
async function place(kind) {
  await choosePlacement(page,kind);
  await page.locator('#editor-overlay').click({position:{x:150,y:140}});
}
async function actionsUI(parent,actions,ids) {
  for(const [index,action] of actions.entries()) {
    if(index>0 || action.type==='after') {
      await parent.locator(':scope > .text-button').filter({hasText:action.type==='after'?'＋ 延迟动作':'＋ 一个动作'}).click();
      if(index===0)await parent.locator(':scope > .action-row').first().getByRole('button',{name:'×',exact:true}).click();
    }
    // The last direct action/group is always the one being authored.
    if(action.type==='after') {
      const group=parent.locator(':scope > .delayed-actions').last();
      await group.locator(':scope > .action-row [data-action-delay]').fill(String(action.ticks/60));
      await group.locator(':scope > .action-row [data-action-delay]').press('Tab');
      await actionsUI(group,action.actions,ids);
    } else {
      const row=parent.locator(':scope > .action-row').last();
      await row.locator('[data-action-type]').selectOption('set');
      await row.locator('[data-action-target]').selectOption(ids[action.target]);
      await row.locator('[data-action-state]').selectOption(action.state);
    }
  }
}
try {
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#open-editor').click();
  for(const level of levels) {
    await page.locator('#editor-new').click();await change('edit-name',level.name);
    await change('edit-description',level.description);await change('edit-hint',level.hint);
    for(const [index,platform] of level.platforms.entries()) {
      if(index===0)await page.locator('[data-ref="platform:0"]').click();else await place('platform');
      await change('object-x',platform.x);await change('object-width',platform.width);
    }
    const ids={},counts={};
    for(const entity of level.entities) {
      ids[entity.id]=entity.kind+'-'+(counts[entity.kind]=(counts[entity.kind]??0)+1);
      await place(entity.kind);await change('object-x',entity.x);await change('object-width',entity.width);
      if(entity.contact)await page.locator('#object-contact').selectOption('lethal');
      await change('object-label',entity.label);await page.locator('#object-state').selectOption(entity.state);
    }
    for(const rule of level.rules) {
      await openPanel(page,'logic');await page.locator('#add-rule').click();const card=page.locator('.rule-card').last();
      await card.locator('[data-rule-source]').selectOption(ids[rule.on.source]);
      await card.locator('[data-rule-event]').selectOption(rule.on.type);
      for(const condition of rule.if??[]) {
        await card.getByRole('button',{name:'＋ 状态条件',exact:true}).click();
        await card.getByLabel('条件机关',{exact:true}).last().selectOption(ids[condition.entity]);
        await card.getByLabel('条件状态',{exact:true}).last().selectOption(condition.state);
      }
      await actionsUI(card,rule.actions,ids);
    }
    assert.equal(await page.locator('#editor-test').isDisabled(),false,level.id+' validates');
    await page.locator('#editor-save').click();const document=await draft();
    const game=createSimulation(document);game.start();
    for(const event of solutions[level.id]) {
      game.step(event.tick-1-game.snapshot().tick);game.click(ids[event.source]);game.step();
    }
    game.step(2000);assert.equal(game.snapshot().status,'won','UI authored solution: '+level.id);
    const idle=createSimulation(document);idle.start();idle.step(2000);assert.equal(idle.snapshot().status,'lost');
    authored.push({originalId:level.id,document,solution:solutions[level.id].map(e=>({...e,source:ids[e.source]}))});
    console.log('PASS authored through workshop controls, saved and solved: '+level.id);
  }
  assert.deepEqual(errors,[]);await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  await writeFile(new URL('../artifacts/editor-authored-levels.json',import.meta.url),JSON.stringify(authored,null,2));
} finally {await browser.close();await new Promise(done=>server.close(done));}
