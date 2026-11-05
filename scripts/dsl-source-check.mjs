import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {makeServer} from '../server.mjs';
import {buildEditor} from './build.mjs';

await mkdir('artifacts',{recursive:true});
const server=makeServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(!existsSync(chromium.executablePath())?{channel:'msedge'}:{})});
const errors=[],workspace=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gothere.studio.layered.v1')));
const current=s=>s.documents.find(d=>d.key===s.activeKey).level;
try{
  const offline=pathToFileURL((await buildEditor()).path).href;
  for(const [index,url]of ['http://127.0.0.1:'+server.address().port+'/?sample=chapter',offline+'?sample=chapter'].entries()){
    const context=await browser.newContext({viewport:{width:1600,height:1100}}),p=await context.newPage(),requests=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(index&&/^https?:/.test(r.url()))requests.push(r.url());});
    await p.goto(url);await p.locator('#scene[data-assets=ready]').waitFor();
    const before=await workspace(p),original=current(before),source=p.locator('#level-json');
    await p.locator('#open-data').click();assert.deepEqual(JSON.parse(await source.inputValue()),original);
    for(const invalid of ['{',JSON.stringify({...original,actor:{...original.actor,speed:-1}})]){
      await source.fill(invalid);await p.locator('#apply-current').click();
      assert.equal(await p.locator('#data-dialog').isVisible(),true);
      assert.equal(await p.locator('#data-error').getAttribute('data-valid'),'false');
      assert.deepEqual(await workspace(p),before);
    }
    const edited=structuredClone(original);edited.name='DSL 编辑后的街区';edited.actor.speed=58;
    await source.fill(JSON.stringify(edited));await source.press('Control+Enter');
    assert.equal(await p.locator('#data-error').getAttribute('data-valid'),'true');assert.deepEqual(await workspace(p),before);
    await p.locator('#format-dsl').click();assert.ok((await source.inputValue()).includes('\n  "schemaVersion"'));
    assert.deepEqual(await workspace(p),before);
    // Source editing keys must not move/delete map objects or invoke a browser save dialog.
    await source.press('Control+End');await source.press('Enter');await source.press('Tab');
    assert.match(await source.inputValue(),/\n  $/);assert.match(await p.locator('#dsl-position').innerText(),/列 3/);
    await p.locator('#data-dialog').screenshot({path:'artifacts/dsl-source-'+index+'.png'});
    await source.press('Control+s');assert.equal(await p.locator('#data-dialog').isVisible(),false);
    let saved=await workspace(p);assert.equal(saved.activeKey,before.activeKey);assert.equal(saved.documents.length,before.documents.length);
    assert.deepEqual(current(saved),edited);
    await p.locator('#display-mode').selectOption('logic');await p.locator('#editor-overlay').focus();await p.keyboard.press('Control+z');
    assert.deepEqual(current(await workspace(p)),original);await p.keyboard.press('Control+y');assert.deepEqual(current(await workspace(p)),edited);
    await p.reload();await p.locator('#scene[data-assets=ready]').waitFor();assert.deepEqual(current(await workspace(p)),edited);
    // Entry/exit is configurable in the ordinary behavior inspector.
    await p.locator('#display-mode').selectOption('logic');await p.getByRole('tab',{name:'仓库',exact:true}).click();
    await p.locator('#scene-items button').filter({hasText:'想从窄巷借道的电瓶车'}).click();
    assert.equal(await p.locator('[data-behavior="enter"] [data-move-passage]').inputValue(),'alley');
    assert.equal(await p.locator('[data-behavior="exit"] [data-move-plane]').inputValue(),'far');
    await p.locator('[data-behavior="enter"] [data-move-passage]').selectOption('');
    let action=current(await workspace(p)).entities.find(e=>e.id==='scooter').behaviors.find(b=>b.id==='enter').actions.find(a=>a.type==='move');
    assert.equal(action.passage,undefined);assert.equal(action.x,-110);
    await p.locator('#editor-undo').click();assert.deepEqual(current(await workspace(p)),edited);
    await p.locator('#preview-toggle').click();await p.locator('#open-data').click();
    assert.equal(await p.locator('#apply-current').isDisabled(),true);assert.equal(await p.locator('#apply-level').isDisabled(),true);
    await source.press('Control+s');assert.deepEqual(current(await workspace(p)),edited);
    await p.locator('#close-data').click();await p.locator('#editor-return').click();
    await p.locator('#open-data').click();await source.fill(JSON.stringify({...edited,name:'独立导入稿'}));await p.locator('#apply-level').click();
    saved=await workspace(p);assert.equal(saved.documents.length,before.documents.length+1);assert.notEqual(saved.activeKey,before.activeKey);
    assert.equal(current(saved).name,'独立导入稿');assert.deepEqual(saved.documents.find(d=>d.key===before.activeKey).level,edited);
    assert.deepEqual(requests,[]);await context.close();
    console.log('PASS DSL '+(index?'offline':'online')+': invalid input isolation, validation, formatting, source keys, same-slot apply, undo/redo, reload, passage inspector and separate import.');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
