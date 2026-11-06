import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {build} from 'esbuild';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Parse actual modules, so import text inside authoring examples stays ordinary text. */
async function bundleEntry(entry) {
  const result=await build({entryPoints:[resolve(ROOT,entry)],bundle:true,format:'iife',platform:'browser',target:'es2022',metafile:true,write:false});
  return {script:result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'),modules:Object.keys(result.metafile.inputs).length};
}

async function saveHTML(name,html) {
  const out=resolve(ROOT,'dist');await mkdir(out,{recursive:true});
  const target=resolve(out,name),temporary=target+'.tmp-'+process.pid+'-'+randomUUID();
  try {if(await readFile(target,'utf8')===html)return;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  await writeFile(temporary,html);
  for(let attempt=0;;attempt++){
    try {await rename(temporary,target);return;}
    catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=5)throw error;await delay(30*2**attempt);}
  }
}

export async function buildEditor() {
  await mkdir(resolve(ROOT,'src/vendor'),{recursive:true});
  const licenses=await readFile(resolve(ROOT,'src/vendor/THIRD-PARTY-LICENSES.txt'),'utf8');
  const vendor=await build({entryPoints:[resolve(ROOT,'scripts/code-editor-entry.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'inline',banner:{js:'/*!\n'+licenses.replace(/\*\//g,'* /')+'\n*/'},write:false});
  const codeEditor=vendor.outputFiles[0].text,target=resolve(ROOT,'src/vendor/code-editor.js');
  let existing='';try{existing=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing!==codeEditor){const temporary=target+'.tmp-'+process.pid+'-'+randomUUID();try{await writeFile(temporary,codeEditor);await rename(temporary,target);}finally{await rm(temporary,{force:true});}}
  const [bundle,template,css]=await Promise.all([bundleEntry('src/shell/editor.js'),
    readFile(resolve(ROOT,'editor.html'),'utf8'),readFile(resolve(ROOT,'src/editor/editor.css'),'utf8')]);
  const html=template.replace('<link rel="stylesheet" href="/src/editor/editor.css">','<style>\n'+css.replace(/^@charset[^;]+;\s*/, '')+'\n</style>')
    .replace('<script src="/src/vendor/code-editor.js"></script>',()=>'<script>\n'+codeEditor.replace(/<\/script/gi,'<\\/script')+'\n</script>')
    .replace('<script type="module" src="/src/shell/editor.js"></script>',()=>'<script id="standalone-editor" type="application/json">{}</script>\n<script type="module">\n'+bundle.script+'\n</script>');
  if(/<script[^>]+src=/i.test(html)||/<link[^>]+rel="stylesheet"/i.test(html))throw new Error('Editor packaging left external app assets.');
  await Promise.all([saveHTML('index.html',html),saveHTML('editor.html',html),saveHTML('gothere-editor.html',html)]);
  await rm(resolve(ROOT,'dist/gothere-play.html'),{force:true});
  return {path:resolve(ROOT,'dist/gothere-editor.html'),bytes:Buffer.byteLength(html),modules:bundle.modules};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const editor=await buildEditor();
  console.log('Standalone editor: ' + editor.path + ' (' + Math.round(editor.bytes/1024) + ' KiB, ' + editor.modules + ' modules)');
}
