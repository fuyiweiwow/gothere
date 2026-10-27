import { cp, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPortable } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build on Windows x64 with the Windows Electron runtime.');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const runtime = join(root, 'node_modules/electron/dist');
await stat(join(runtime, 'electron.exe')).catch(() => { throw new Error('Electron runtime missing. Run npx install-electron, then retry.'); });
await buildPortable();
// A fresh directory for every build avoids deleting or overwriting an open application.
const buildRoot = join(root, 'dist/windows/build-' + randomUUID());
const appRoot = join(buildRoot, 'Gothere');
await mkdir(appRoot, {recursive: true});
await cp(runtime, appRoot, {recursive: true});
await rename(join(appRoot, 'electron.exe'), join(appRoot, 'Gothere.exe'));
const resources = join(appRoot, 'resources/app');
await mkdir(resources, {recursive: true});
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const html = (await readFile(join(root, 'dist/index.html'), 'utf8')).replace('<head>', '<head>\n  <meta http-equiv="Content-Security-Policy" content="' + csp + '">');
await writeFile(join(resources, 'index.html'), html);
await cp(join(root, 'desktop/main.cjs'), join(resources, 'main.cjs'));
await writeFile(join(resources, 'package.json'), JSON.stringify({name:'gothere',version:manifest.version,main:'main.cjs'}));
await writeFile(join(appRoot, 'START-HERE.txt'), '\uFEFF一定要到达那里 · v' + manifest.version + '\r\n\r\n请先解压整个 Gothere 文件夹，再双击 Gothere.exe。无需安装 Node.js，无需联网。\r\nF11 切换全屏。草稿自动保存在 %APPDATA%\\Gothere。使用「关卡数据」导出 JSON 备份。\r\n这是 Windows x64 开发测试包，尚未签名。\r\n');
async function sizeOf(directory) {
  let bytes=0;
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=join(directory,entry.name);
    bytes+=entry.isDirectory()?await sizeOf(path):(await stat(path)).size;
  }
  return bytes;
}
const zip = resolve(root, 'dist/windows/Gothere-v' + manifest.version + '-win-x64.zip');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const script = 'Compress-Archive -LiteralPath ' + quote(appRoot) + ' -DestinationPath ' + quote(zip) + ' -Force';
await new Promise((done, reject) => {
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:'inherit'});
  child.once('error',reject);child.once('exit',code=>code===0?done():reject(new Error('ZIP failed: '+code)));
});
const hash = createHash('sha256');for await(const chunk of createReadStream(zip))hash.update(chunk);
const result={version:manifest.version,electron:manifest.devDependencies.electron,executable:join(appRoot,'Gothere.exe'),
  zip,unpackedBytes:await sizeOf(appRoot),zipBytes:(await stat(zip)).size,sha256:hash.digest('hex')};
await writeFile(join(root,'dist/windows/latest.json'),JSON.stringify(result,null,2));
await writeFile(zip+'.sha256',result.sha256+'  '+zip.split(/[\\/]/).at(-1)+'\n');
console.log(JSON.stringify(result,null,2));
