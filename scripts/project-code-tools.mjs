import {parse} from 'acorn';
import {zipSync, unzipSync, strToU8, strFromU8} from 'fflate';
import {ASSETS_MANIFEST,assetPath} from '../src/editor/project-assets.js';
import {validateProject} from '../src/editor/javascript-project.js';

export function isModule(source) {
  // Legacy scripts can return from their surrounding generation function.
  const tree = parse(source, {ecmaVersion: 'latest', sourceType: 'module', allowReturnOutsideFunction: true});
  return tree.body.some(node => node.type.startsWith('Import') || node.type.startsWith('Export'));
}

/** Parse syntax, never text-match imports inside comments, strings or regular expressions. */
export function analyzeModule(source, filename) {
  let tree;
  try { tree = parse(source, {ecmaVersion: 'latest', sourceType: 'module', locations: true}); }
  catch (error) { throw new Error(`${filename}:${error.loc?.line ?? 1}:${(error.loc?.column ?? 0) + 1} · ${error.message}`); }
  const imports = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportExpression') throw new Error(`${filename}:${node.loc.start.line} · 请使用静态 import，暂不支持动态 import()。`);
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
      imports.push({specifier: node.source.value, start: node.source.start, end: node.source.end});
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === 'loc') continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  }
  visit(tree);
  return imports;
}

export function zipProject(files, entry, assets) {
  validateProject({version:assets===undefined?1:2,files,entry,...(assets===undefined?{}:{assets})});
  // The first source file in the archive is the entry point; no code execution.
  const ordered = [entry, ...Object.keys(files).filter(path => path !== entry)];
  const archive=Object.fromEntries(ordered.map(path => [path, strToU8(files[path])]));
  if(assets!==undefined){
    const metadata=structuredClone(assets);
    for(const [path,asset]of Object.entries(metadata))if(asset.definition){
      const src=asset.definition.src,comma=src.indexOf(',');
      asset.encoding=src.slice(0,comma+1);delete asset.definition.src;
      archive[path]=Uint8Array.from(atob(src.slice(comma+1)),c=>c.charCodeAt(0));
    }
    archive[ASSETS_MANIFEST]=strToU8(JSON.stringify({version:2,entry,assets:metadata}));
  }
  return zipSync(archive, {level: 6});
}

export function unzipProject(bytes) {
  let count = 0, total = 0;
  const names=new Set();
  const archive = unzipSync(bytes, {filter(file) {
    if (file.name.endsWith('/')) return false;
    if(names.has(file.name))throw new Error('ZIP 中存在重复路径：'+file.name);names.add(file.name);
    if(!Number.isSafeInteger(file.originalSize)||file.originalSize<0)throw new Error('ZIP 文件大小无效。');
    if(file.name!==ASSETS_MANIFEST&&!/\.(ts|js)$/.test(file.name))assetPath(file.name);
    if (++count > 513 || (total += file.originalSize) > 4194304) throw new Error('项目 ZIP 最多513个文件，解压后不能超过4 MiB。');
    return true;
  }});
  const entries = Object.entries(archive).filter(([path])=>/\.(ts|js)$/.test(path)).map(([path, data]) => [path, strFromU8(data)]);
  if (!entries.length) throw new Error('项目中没有 TypeScript / JavaScript 文件。');
  let project={version:1,entry:entries[0][0],active:entries[0][0],files:Object.fromEntries(entries)};
  if(Object.hasOwn(archive,ASSETS_MANIFEST)){
    const manifest=JSON.parse(strFromU8(archive[ASSETS_MANIFEST]));
    if(manifest.version!==2||!manifest.assets||typeof manifest.assets!=='object'||Array.isArray(manifest.assets))throw new Error('资源项目元数据无效。');
    const assets=structuredClone(manifest.assets),expected=new Set([...entries.map(([p])=>p),ASSETS_MANIFEST]);
    for(const [path,asset]of Object.entries(assets))if(asset.definition){
      if(!Object.hasOwn(archive,path)||typeof asset.encoding!=='string')throw new Error('ZIP 缺少资源：'+path);
      let binary='';for(const byte of archive[path])binary+=String.fromCharCode(byte);
      asset.definition.src=asset.encoding+btoa(binary);delete asset.encoding;expected.add(path);
    }
    if(Object.keys(archive).some(p=>!expected.has(p)))throw new Error('ZIP 含有未登记的资源文件。');
    project={version:2,entry:manifest.entry,active:manifest.entry,files:project.files,assets};
  }else if(Object.keys(archive).length!==entries.length)throw new Error('带资源的项目缺少编辑器元数据，请从项目 ZIP 导入。');
  return validateProject(project);
}
