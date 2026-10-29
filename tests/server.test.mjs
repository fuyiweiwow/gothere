import test from 'node:test';
import assert from 'node:assert/strict';
import { makeServer } from '../server.mjs';
const server = makeServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = 'http://127.0.0.1:' + server.address().port;
test.after(()=>new Promise(resolve=>server.close(resolve)));
test('serves the editor, its modules, project document and correct MIME types', async () => {
  for(const [path,mime] of [['/','text/html'],['/index.html','text/html'],['/editor.html','text/html'],['/src/shell/editor.js','text/javascript'],['/src/editor/editor.css','text/css'],['/favicon.svg','image/svg+xml'],['/project.md','text/plain']]) {
    const response=await fetch(base+path);
    assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith(mime));
    assert.ok((await response.text()).length>50);
  }
});
test('does not expose arbitrary workspace files or traversal paths', async () => {
  for(const path of ['/play.html','/gothere-play.html','/src/main.js','/src/style.css','/package.json','/server.mjs','/.git/config','/src/%2e%2e/package.json','/src/%2e%2e%5cpackage.json','/src/%00','/src/%ZZ','/src/does-not-exist.js']) {
    assert.equal((await fetch(base+path)).status,404,path);
  }
});
test('supports HEAD and rejects write requests', async () => {
  const response=await fetch(base+'/',{method:'HEAD'});assert.equal(response.status,200);assert.equal(await response.text(),'');
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
});

test('public preview serves only the self-contained editor and its download', async () => {
  const { buildEditor } = await import('../scripts/build.mjs');await buildEditor();
  const preview = makeServer({ portableOnly: true });
  await new Promise(resolve=>preview.listen(0,'127.0.0.1',resolve));
  const publicBase='http://127.0.0.1:'+preview.address().port;
  try {
    const page=await fetch(publicBase+'/');
    assert.equal(page.status,200);assert.ok((await page.text()).includes('id="standalone-editor"'));
    assert.ok(page.headers.get('content-security-policy').includes("connect-src 'none'"));
    const editor=await fetch(publicBase+'/editor.html');assert.equal(editor.status,200);assert.ok((await editor.text()).includes('id="standalone-editor"'));
    const editorDownload=await fetch(publicBase+'/gothere-editor.html');assert.equal(editorDownload.status,200);assert.ok(editorDownload.headers.get('content-disposition').includes('gothere-editor.html'));
    for(const path of ['/play.html','/gothere-play.html','/project.md','/src/main.js','/package.json','/artifacts/share.json']) {
      assert.equal((await fetch(publicBase+path)).status,404,path);
    }
  } finally { await new Promise(resolve=>preview.close(resolve)); }
});
