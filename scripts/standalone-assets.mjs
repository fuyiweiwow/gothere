/** Keep every referenced built-in image, including variant/feedback frames.
 * Custom embedded assets stay in the level itself; the editor keeps its full library. */
export function standaloneAssets(level,library){
  const available=new Set(library.map(asset=>asset.id)),used=new Set();
  function visit(value){
    if(typeof value==='string'){if(available.has(value))used.add(value);return;}
    if(Array.isArray(value)){for(const item of value)visit(item);return;}
    if(value&&typeof value==='object')for(const item of Object.values(value))visit(item);
  }
  visit(level);return library.filter(asset=>used.has(asset.id));
}
