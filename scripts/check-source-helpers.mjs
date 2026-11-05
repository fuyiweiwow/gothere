import {runInNewContext} from 'node:vm';
import {createAuthoringAPI} from '../src/editor/authoring-api.js';
import {createBlankLevel} from '../src/editor/model.js';

export async function readSourceLevel(page){
  await page.locator('#open-script').click();await page.locator('#script-base').click();
  const source=await page.locator('#script-source').inputValue(),blank=createBlankLevel('check',{layered:true});
  const createAPI=level=>createAuthoringAPI(level,blank);
  const result=runInNewContext('(function(level,api,createAPI){'+source+';return createLevel(level,api,createAPI)})(level,api,createAPI)',{level:blank,api:createAPI(blank),createAPI,structuredClone});
  await page.locator('#close-script').click();return JSON.parse(JSON.stringify(result));
}
export async function importLevel(page,level){
  await page.locator('#open-script').click();
  await page.locator('#script-file').setInputFiles({name:'level.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(level))});
  await page.locator('#script-generate').click();await page.waitForFunction(()=>!document.getElementById('script-generate').disabled);
  const status=await page.locator('#script-status').getAttribute('data-error');if(status==='true')throw new Error(await page.locator('#script-status').innerText());
  await page.locator('#script-import').click();
}
