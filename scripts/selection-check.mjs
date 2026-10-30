import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
await mkdir('artifacts',{recursive:true});const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1600,height:1150}}),errors=[];
try{
  const p=await context.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.locator('#scene[data-assets=ready]').waitFor();
  await p.locator('#display-mode').selectOption('logic');
  // Put a real saved connection directly over the small item, then click the visible item.
  await p.locator('#open-data').click();const level=JSON.parse(await p.locator('#level-json').inputValue());
  const rule=level.rules.find(r=>r.on.source==='umbrella');rule.actions[0].editor={waypoints:[{x:235,y:165},{x:265,y:165}]};
  await p.locator('#level-json').fill(JSON.stringify(level));await p.locator('#apply-level').click();
  async function chooseAtZoom(){const object=await p.locator('[data-ref="entity:umbrella"]').boundingBox();await p.mouse.click(object.x+object.width/2,object.y+object.height/2);
    assert.equal(await p.locator('#editor-tab-object').getAttribute('aria-selected'),'true');assert.match(await p.locator('#object-title').textContent(),/缓降物/);}
  await chooseAtZoom();await p.locator('#zoom-in').click();await chooseAtZoom();
  await p.locator('#editor-overlay').focus();await p.keyboard.press('Escape');
  const line=p.locator('.event-wire-hit').first(),sample=await line.evaluate(el=>{const q=el.getPointAtLength(el.getTotalLength()/2),m=el.getScreenCTM();return {x:q.x*m.a+q.y*m.c+m.e,y:q.x*m.b+q.y*m.d+m.f};});
  await p.mouse.click(sample.x,sample.y);assert.equal(await p.locator('#wire-selection').isVisible(),true);
  await p.screenshot({path:'artifacts/milestone-selection.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS selection: small object wins over crossing wire at multiple zooms; bare wire remains selectable.');
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
