import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
export async function typeScriptLibraries(){
  const root=dirname(createRequire(import.meta.url).resolve('typescript')),files={};
  async function add(name){if(Object.hasOwn(files,name))return;const source=await readFile(resolve(root,name),'utf8');files[name]=source;
    for(const match of source.matchAll(/<reference lib="([^"]+)"/g))await add('lib.'+match[1]+'.d.ts');}
  await add('lib.es2022.d.ts');return files;
}
