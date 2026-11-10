import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {build} from 'esbuild';
import {typeScriptLibraries} from './typescript-libraries.mjs';
import {ASSETS} from '../src/content/library.js';
import {createCommuteChapter} from '../src/editor/commute-chapter.js';
import {createPaintedBusStopLevel} from '../src/editor/painted-bus-stop.js';
import {standaloneAssets} from './standalone-assets.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Parse actual modules, so import text inside authoring examples stays ordinary text. */
async function bundleEntry(entry,assets) {
  const plugins=assets?[{name:'standalone-level-artwork',setup(b){b.onLoad({filter:/library[.]js$/},args=>{
    if(args.path!==resolve(ROOT,'src/content/library.js'))return;
    return {contents:'export const ASSETS = '+JSON.stringify(assets)+';',loader:'js'};
  });}}]:[];
  const result=await build({entryPoints:[resolve(ROOT,entry)],bundle:true,format:'iife',platform:'browser',target:'es2022',metafile:true,write:false,plugins});
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
  const typeScriptWorker=await build({entryPoints:[resolve(ROOT,'scripts/typescript-worker-entry.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,write:false,
    define:{__TS_LIBRARIES__:JSON.stringify(await typeScriptLibraries()),__SDK_TYPES__:JSON.stringify(await readFile(resolve(ROOT,'src/editor/authoring-types.d.ts'),'utf8'))}});
  const typeScriptSource='/*! TypeScript: Copyright Microsoft Corporation. Apache-2.0; see THIRD-PARTY-LICENSES.txt. */\nglobalThis.gothereAuthoringTypes='+JSON.stringify(await readFile(resolve(ROOT,'src/editor/authoring-types.d.ts'),'utf8'))+';\nglobalThis.gothereTypeScriptWorkerSource='+JSON.stringify(typeScriptWorker.outputFiles[0].text)+';\n';
  const typeScriptPath=resolve(ROOT,'src/vendor/typescript-service.js');
  let oldTypes='';try{oldTypes=await readFile(typeScriptPath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(oldTypes!==typeScriptSource)await writeFile(typeScriptPath,typeScriptSource);
  const [bundle,template,css]=await Promise.all([bundleEntry('src/shell/entry.js'),
    readFile(resolve(ROOT,'editor.html'),'utf8'),readFile(resolve(ROOT,'src/editor/editor.css'),'utf8')]);
  const html=template.replace('<link rel="stylesheet" href="/src/editor/editor.css">','<style>\n'+css.replace(/^@charset[^;]+;\s*/, '')+'\n</style>')
    .replace('<script src="/src/vendor/code-editor.js"></script>',()=>'<script>\n'+codeEditor.replace(/<\/script/gi,'<\\/script')+'\n</script>')
    .replace('<script src="/src/vendor/typescript-service.js"></script>',()=>'<script>\n'+typeScriptSource.replace(/<\/script/gi,'<\\/script')+'\n</script>')
    .replace('<script type="module" src="/src/shell/entry.js"></script>',()=>'<script id="standalone-editor" type="application/json">{}</script>\n<script type="module">\n'+bundle.script+'\n</script>');
  if(/<script[^>]+src=/i.test(html)||/<link[^>]+rel="stylesheet"/i.test(html))throw new Error('Editor packaging left external app assets.');
  await Promise.all([saveHTML('index.html',html),saveHTML('editor.html',html),saveHTML('gothere-editor.html',html)]);
  const playBundle=await bundleEntry('src/shell/play-entry.js',standaloneAssets(createCommuteChapter(),ASSETS));
  const playHTML='<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ece3c9"><title>一定要到达那里 · 试玩</title></head><body><script id="standalone-play" type="application/json">{}</script><script type="module">\n'+playBundle.script+'\n</script></body></html>\n';
  await Promise.all([saveHTML('play.html',playHTML),saveHTML('gothere-play.html',playHTML)]);
  const paintedBundle=await bundleEntry('src/shell/play-entry.js',standaloneAssets(createPaintedBusStopLevel(),ASSETS));
  const paintedHTML=playHTML.replace(playBundle.script,()=>paintedBundle.script).replace('<script id="standalone-play" type="application/json">{}</script>','<script id="standalone-play" type="application/json">{"sample":"painted-bus-stop"}</script>');
  await saveHTML('gothere-painted-bus.html',paintedHTML);
  return {path:resolve(ROOT,'dist/gothere-editor.html'),bytes:Buffer.byteLength(html),modules:bundle.modules};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const editor=await buildEditor();
  console.log('Standalone editor: ' + editor.path + ' (' + Math.round(editor.bytes/1024) + ' KiB, ' + editor.modules + ' modules)');
}
