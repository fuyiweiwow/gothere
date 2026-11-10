import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneAssets} from '../scripts/standalone-assets.mjs';
test('a standalone level keeps variant and feedback frames without unrelated editor artwork',()=>{
  const library=['base','walk1','walk2','fall1','fall2','unused'].map(id=>({id,src:'data:image/png;base64,'+id}));
  const level={scene:{assets:[{id:'custom',src:'data:image/png;base64,custom'}],nodes:[{asset:'base',variants:{moving:{animation:{frames:['walk2','walk1','walk2']}}}}],feedback:[{frames:['fall1','fall2']}]}};
  const before=structuredClone({level,library}),selected=standaloneAssets(level,library);
  assert.deepEqual(selected.map(a=>a.id),['base','walk1','walk2','fall1','fall2']);
  assert.deepEqual({level,library},before);assert.equal(selected[0],library[0]);
  assert.deepEqual(standaloneAssets({},library),[]);
});
