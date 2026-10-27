import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Package this app's named ES modules into isolated scopes; reject unsupported module syntax. */
export async function buildPortable() {
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
  await moduleFor(resolve(ROOT, 'src/main.js'));
  const [template, css, icon] = await Promise.all([
    readFile(resolve(ROOT,'index.html'),'utf8'), readFile(resolve(ROOT,'src/style.css'),'utf8'),
    readFile(resolve(ROOT,'favicon.svg'),'utf8'),
  ]);
  const project = '# 一定要到达那里 · v0.5\n\n## 怎么玩\n点击「出发！」，操作编号机关。主角会持续走，不会自动等车，缺路或碰到未解除危险就失败。三个创作示例展示拿物过门、区域启动巡逻、梯子接电梯。\n\n## 关卡工坊\n选择物体添加多个命名行为，再用「连线」选择起点事件、目标物体和目标行为。可以一对多、多对一，行为完成后还能继续接线。规则支持持有条件、状态条件和延迟。\n\n## 物件与资源\n外观、巡逻、接触致命和持有关系分别定义。拿起后仍可调用行为；放下保留状态。可上传 PNG/JPEG/WebP 随关卡离线携带。Y 是脚底高度，越小越高；电梯必须到位才可登上。\n\n## 试玩与备份\n工坊支持撤销重做与多个草稿；试玩不改草稿。草稿保存在当前浏览器或桌面应用中，可用关卡数据导出 JSON 备份。本 HTML 包含全部逻辑、十关、三个示例和工坊。';

  const safeData = JSON.stringify({ project }).replace(/</g, '\\u003c');
  const script = chunks.join('\n\n').replace(/<\/script/gi, '<\\/script');
  const html = template
    .replace('<link rel="stylesheet" href="/src/style.css">', '<style>\n' + css.replace(/^@charset[^;]+;\s*/, '') + '\n</style>')
    .replace('href="/favicon.svg"', 'href="data:image/svg+xml,' + encodeURIComponent(icon) + '"')
    .replace('id="open-project">项目路线', 'id="open-project">试玩说明')
    .replace('id="project-title">项目路线', 'id="project-title">试玩说明')
    .replace('<script type="module" src="/src/main.js"></script>',
      '<script id="portable-data" type="application/json">' + safeData + '</script>\n<script type="module">\n' + script + '\n</script>');
  if (html === template || /<script[^>]+src=/i.test(html) || /<link[^>]+rel="stylesheet"/i.test(html)) throw new Error('Portable packaging left external app assets.');
  const out = resolve(ROOT,'dist'); await mkdir(out,{recursive:true});
  const save = async (name) => {
    const target = resolve(out,name), temporary = target + '.tmp-' + process.pid + '-' + randomUUID();
    try { if (await readFile(target,'utf8') === html) return; }
    catch (error) { if(error.code !== 'ENOENT') throw error; }
    await writeFile(temporary,html);
    for(let attempt=0;;attempt++) {
      try { await rename(temporary,target); return; }
      catch(error) {
        if(!['EPERM','EBUSY','EACCES'].includes(error.code) || attempt>=5) throw error;
        await delay(30 * 2 ** attempt);
      }
    }
  };
  await Promise.all([save('index.html'),save('gothere-play.html')]);
  return { path:resolve(out,'gothere-play.html'), bytes:Buffer.byteLength(html), modules:identifiers.size };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const built = await buildPortable();
  console.log('Portable game: ' + built.path + ' (' + Math.round(built.bytes/1024) + ' KiB, ' + built.modules + ' modules)');
}
