import {readFile} from 'node:fs/promises';
import {unzipProject} from './project-code-tools.mjs';
import {executeProject} from '../tests/helpers/project.mjs';

export async function readSourceLevel(page){
  await page.locator('#open-script').click();await page.locator('#script-base').click();
  const pending=page.waitForEvent('download');await page.locator('#script-export').click();const file=await pending;
  const result=await executeProject(unzipProject(new Uint8Array(await readFile(await file.path()))));
  await page.locator('#close-script').click();return result;
}
export async function importLevel(page,level){
  await page.locator('#open-script').click();
  await page.locator('#script-file').setInputFiles({name:'level.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(level))});
  await page.locator('#script-generate').click();await page.waitForFunction(()=>!document.getElementById('script-generate').disabled);
  const status=await page.locator('#script-status').getAttribute('data-error');if(status==='true')throw new Error(await page.locator('#script-status').innerText());
  await page.locator('#script-import').click();
}
