/** Small deterministic PRNG. Seeds are data, never executable code. */
export function seededRandom(seed) {
  let state=2166136261;
  for(const character of seed){state^=character.codePointAt(0);state=Math.imul(state,16777619);}
  return ()=>{
    state=(state+0x6d2b79f5)|0;
    let n=Math.imul(state^(state>>>15),1|state);
    n^=n+Math.imul(n^(n>>>7),61|n);
    return ((n^(n>>>14))>>>0)/4294967296;
  };
}

export function shuffled(values,random) {
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
