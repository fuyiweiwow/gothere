import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Package named ES modules into isolated scopes; reject unsupported module syntax. */
async function bundleEntry(entry) {
  const identifiers = new Map(), visiting = new Set(), chunks = [];
  async function moduleFor(file) {
    const filename = resolve(file);
    const local = relative(resolve(ROOT, 'src'), filename);
    if (local.startsWith('..' + sep) || local === '..' || !filename.endsWith('.js')) throw new Error('Only local source modules may be packaged.');
    if (visiting.has(filename)) throw new Error('Circular module dependency: ' + local);
    if (identifiers.has(filename)) return identifiers.get(filename);
    const identifier = '__module' + identifiers.size;
    identifiers.set(filename, identifier); visiting.add(filename);
    let source = await readFile(filename, 'utf8');
    const exported = new Set();
    for (const match of source.matchAll(/^export\s+(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)) exported.add(match[1]);
    const imported = new Set();
    for (const match of [...source.matchAll(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm)]) {
      const names = match[1].split(',').map(name => name.trim());
      if (names.some(name => !/^[A-Za-z_$][\w$]*$/.test(name)) || !match[2].startsWith('.')) throw new Error('Unsupported import: ' + match[0]);
      names.forEach(name => imported.add(name));
      const dependency = await moduleFor(resolve(dirname(filename), match[2]));
      source = source.replace(match[0], 'const { ' + names.join(', ') + ' } = ' + dependency + ';\n');
    }
    source = source.replace(/^export\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];?\s*$/gm, (_, list) => {
      for (const name of list.split(',').map(item=>item.trim())) {
        if (!imported.has(name)) throw new Error('Re-export must refer to an imported binding: ' + name);
        exported.add(name);
      }
      return '';
    });
    source = source.replace(/^export\s+(?=(?:const|let|function)\b)/gm, '');
    if (/^(?:import|export)\s/m.test(source)) throw new Error('Unsupported module syntax in ' + local);
    chunks.push('const ' + identifier + ' = (() => {\n' + source +
      '\nreturn Object.freeze({ ' + [...exported].join(', ') + ' });\n})();');
    visiting.delete(filename);
    return identifier;
  }
  await moduleFor(resolve(ROOT, entry));
  return { script:chunks.join('\n\n').replace(/<\/script/gi, '<\\/script'), modules:identifiers.size };
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
  const [bundle,template,css]=await Promise.all([bundleEntry('src/shell/editor.js'),
    readFile(resolve(ROOT,'editor.html'),'utf8'),readFile(resolve(ROOT,'src/editor/editor.css'),'utf8')]);
  const html=template.replace('<link rel="stylesheet" href="/src/editor/editor.css">','<style>\n'+css.replace(/^@charset[^;]+;\s*/, '')+'\n</style>')
    .replace('<script type="module" src="/src/shell/editor.js"></script>','<script id="standalone-editor" type="application/json">{}</script>\n<script type="module">\n'+bundle.script+'\n</script>');
  if(/<script[^>]+src=/i.test(html)||/<link[^>]+rel="stylesheet"/i.test(html))throw new Error('Editor packaging left external app assets.');
  await Promise.all([saveHTML('index.html',html),saveHTML('editor.html',html),saveHTML('gothere-editor.html',html)]);
  await rm(resolve(ROOT,'dist/gothere-play.html'),{force:true});
  return {path:resolve(ROOT,'dist/gothere-editor.html'),bytes:Buffer.byteLength(html),modules:bundle.modules};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const editor=await buildEditor();
  console.log('Standalone editor: ' + editor.path + ' (' + Math.round(editor.bytes/1024) + ' KiB, ' + editor.modules + ' modules)');
}
