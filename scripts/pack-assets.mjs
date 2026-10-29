import {readFile,writeFile,mkdir} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../assets/library.json',import.meta.url),'utf8'));
const assets=[];
for(const entry of manifest){
  const bytes=await readFile(new URL('../assets/'+entry.file,import.meta.url));
  assets.push({...entry,src:'data:image/'+(entry.file.endsWith('.svg')?'svg+xml':'png')+';base64,'+bytes.toString('base64')});
}
await mkdir(new URL('../src/content/',import.meta.url),{recursive:true});
await writeFile(new URL('../src/content/library.js',import.meta.url),'// Bundled CC0 artwork; regenerate with node scripts/pack-assets.mjs. See assets/CREDITS.md.\nexport const ASSETS = '+JSON.stringify(assets)+';\n');
await writeFile(new URL('../src/content/asset-ids.js',import.meta.url),'// Resource identifiers only: the core never loads images.\nexport const ASSET_IDS = '+JSON.stringify(assets.map(a=>a.id))+';\n');
console.log('Packed '+assets.length+' locally bundled art resources.');
