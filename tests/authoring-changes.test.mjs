import test from 'node:test';
import assert from 'node:assert/strict';
import {sameDocument,documentChanges,changeValue,searchProject} from '../src/editor/authoring-changes.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';

test('same-count source edits expose positions and nested action durations without mutating input',()=>{
  const before=createCommuteChapter(),after=structuredClone(before),original=structuredClone(before);
  after.entities.find(e=>e.id==='bus').x=520;
  after.entities.find(e=>e.id==='bus').behaviors.find(b=>b.id==='leave').actions.at(-1).ticks=240;
  const changes=documentChanges(before,after);
  assert.equal(changes.length,2);
  assert.ok(changes.some(c=>c.path==='entities[bus].x'&&c.before===500&&c.after===520));
  assert.ok(changes.some(c=>c.path.includes('behaviors[leave].actions')&&c.path.endsWith('.ticks')&&c.after===240));
  assert.equal(changeValue(240,'actions[1].ticks'),'4 秒（240 tick）');
  assert.deepEqual(before,original);
});

test('diff distinguishes added and removed values, ordering, unknown data and key-order-only changes',()=>{
  assert.equal(sameDocument({a:1,b:[2]},{b:[2],a:1}),true);
  assert.equal(sameDocument([1,2],[2,1]),false);
  const a={entities:[{id:'a',label:'原有',custom:{v:1}},{id:'b'}]},b={entities:[{id:'b'},{id:'a',label:'原有',custom:{v:2}}]};
  assert.equal(documentChanges(a,b).length,2);
  assert.ok(documentChanges(a,b).some(c=>c.path==='entities[a].custom.v'));
  const added=documentChanges(a,{entities:[{id:'b'},{id:'c'}]});
  assert.ok(added.some(c=>c.path==='entities[a]'&&c.after===undefined));
  assert.ok(added.some(c=>c.path==='entities[c]'&&c.before===undefined));
  assert.ok(documentChanges(a,{entities:[{id:'b'},{id:'c'},a.entities[0]]}).some(c=>c.path==='entities.order'));
  assert.equal(documentChanges({items:[null]},{items:[{}]}).length,1);
  assert.equal(changeValue('data:image/png;base64,AAAA'),'内嵌资源（26 字符）');
});

test('project search locates Chinese behavior names in any file and retains original line offsets',()=>{
  const files={'objects/a.ts':'// 公交\n  this.doOpen = slot("开门");\n','events.ts':'// 开门事件\n'};
  const result=searchProject({files},'开门',1);
  assert.equal(result.total,2);assert.equal(result.matches.length,1);
  const match=result.matches[0];assert.equal(match.line,2);assert.equal(files[match.path].slice(match.start,match.start+2),'开门');
  assert.equal(searchProject({files},'  ').total,0);
});
