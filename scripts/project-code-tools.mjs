import {parse} from 'acorn';
import {zipSync, unzipSync, strToU8, strFromU8} from 'fflate';

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

export function zipProject(files, entry) {
  // The first source file in the archive is the entry point; no code execution.
  const ordered = [entry, ...Object.keys(files).filter(path => path !== entry)];
  return zipSync(Object.fromEntries(ordered.map(path => [path, strToU8(files[path])])), {level: 6});
}

export function unzipProject(bytes) {
  let count = 0, total = 0;
  const files = unzipSync(bytes, {filter(file) {
    if (file.name.endsWith('/')) return false;
    if (!/\.(ts|js)$/.test(file.name)) throw new Error('项目 ZIP 只能包含 .ts 或 .js 文件。');
    if (++count > 256 || (total += file.originalSize) > 2097152) throw new Error('项目最多256个文件，解压后的源码不能超过2 MiB。');
    return true;
  }});
  const entries = Object.entries(files).map(([path, data]) => [path, strFromU8(data)]);
  if (!entries.length) throw new Error('项目中没有 TypeScript / JavaScript 文件。');
  return {version: 1, entry: entries[0][0], active: entries[0][0], files: Object.fromEntries(entries)};
}
