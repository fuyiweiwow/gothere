import test from 'node:test';
import assert from 'node:assert/strict';
import {shortcutCommand,nudgeDelta} from '../src/editor/shortcuts.js';

test('Windows editor keys preserve native text editing, browser shortcuts, IME and AltGr',()=>{
  for(const key of ['c','x','v','z','y','a','f','n','o','d'])assert.equal(shortcutCommand({key,ctrlKey:true},{typing:true}),null);
  assert.equal(shortcutCommand({key:'s',ctrlKey:true},{typing:true}),'save');
  assert.equal(shortcutCommand({key:'s',ctrlKey:true,isComposing:true}),null);
  assert.equal(shortcutCommand({key:'c',ctrlKey:true,altKey:true}),null);
  assert.equal(shortcutCommand({key:'l',ctrlKey:true}),null);
  assert.equal(shortcutCommand({key:'F5',ctrlKey:true}),null);
});
test('editing and simulation keys have distinct scopes and conventional movement precision',()=>{
  for(const [event,result] of [[{key:'z',ctrlKey:true},'undo'],[{key:'y',ctrlKey:true},'redo'],[{key:'z',ctrlKey:true,shiftKey:true},'redo'],[{key:'Delete'},'delete'],[{key:'F2'},'rename'],[{key:'v'},'select'],[{key:'w'},'wire']])assert.equal(shortcutCommand(event),result);
  assert.equal(shortcutCommand({key:'Delete'},{testing:true}),null);
  assert.equal(shortcutCommand({key:' '},{testing:true}),'toggle');
  assert.equal(shortcutCommand({key:'F5',shiftKey:true},{testing:true}),'stop');
  assert.equal(shortcutCommand({key:'F10'},{diagram:false}),null);
  assert.deepEqual(nudgeDelta({key:'ArrowLeft'}),{x:-1,y:0});
  assert.deepEqual(nudgeDelta({key:'ArrowDown',shiftKey:true}),{x:0,y:10});
});
