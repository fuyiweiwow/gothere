import {buildCandidate} from './generator.js';
import {verifyCandidateAsync,checkCancelled} from './verify.js';

async function generate({seed,steps=3,count=3,signal,onProgress=()=>{}}={}) {
  if(!Number.isInteger(count)||count<1||count>3)throw new Error('每批只生成 1～3 个候选。');
  buildCandidate({seed,steps});checkCancelled(signal);
  const candidates=[],signatures=new Set(),rejections=[];let attempts=0;
  const started=performance.now();
  while(candidates.length<count&&attempts<8){
    checkCancelled(signal);const candidate=buildCandidate({seed,steps,variant:++attempts});
    if(!signatures.has(candidate.signature)){
      const report=await verifyCandidateAsync(candidate,{signal});checkCancelled(signal);
      if(report.passed){candidates.push({candidate,report});signatures.add(candidate.signature);}
      else rejections.push({seed:candidate.seed,errors:report.errors});
    }
    onProgress({attempts,accepted:candidates.length,total:count});
  }
  return {candidates,attempts,rejections,elapsedMs:Math.round(performance.now()-started)};
}

/** Bounded search: up to eight compositions, three distinct verified candidates. */
export function generateCandidates(options) {return generate(options);}
