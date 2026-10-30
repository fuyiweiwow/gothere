import {createSimulation,validateLevel} from '../core/engine.js';

const MAX_TICKS=6000;
function* run(level,inputs) {
  const simulation=createSimulation(level);simulation.start();let tick=0;
  function* advanceTo(target) {
    while(tick<target){
      const count=Math.min(120,target-tick);simulation.step(count);tick+=count;yield;
      if(simulation.recording().status!=='running')return;
    }
  }
  for(const input of [...inputs].sort((a,b)=>a.tick-b.tick)){
    yield* advanceTo(input.tick-1);
    if(!simulation.click(input.source))break;
    simulation.step(1);tick=input.tick;
  }
  yield* advanceTo(MAX_TICKS);
  const state=simulation.snapshot();
  return {status:state.status,tick:state.tick,reason:state.reason,recording:simulation.recording()};
}

/** Replay evidence and sampled counterfactuals, not an exhaustive solver or a fun score. */
function* verification(candidate) {
  const errors=[],validation=validateLevel(candidate?.level);
  if(!validation.valid)return {passed:false,errors:validation.errors};
  const plan=candidate.plan;
  if(!Array.isArray(plan)||plan.length<3||plan.length>5||plan.some(p=>!p||!Number.isInteger(p.tick)||p.tick<1||p.tick>MAX_TICKS||
    !candidate.level.entities.some(e=>e.id===p.source)))return {passed:false,errors:['生成计划无效或超过验证预算。']};
  const baseline=yield* run(candidate.level,plan),noInput=yield* run(candidate.level,[]),early=yield* run(candidate.level,plan.map(p=>({...p,tick:1})));
  const omissions=[],timing=[];
  for(let i=0;i<plan.length;i++){
    omissions.push({source:plan[i].source,...yield* run(candidate.level,plan.filter((_,j)=>j!==i))});
    for(const offset of [-24,24])timing.push({source:plan[i].source,offset,...yield* run(candidate.level,plan.map((p,j)=>({...p,tick:j===i?Math.max(1,p.tick+offset):p.tick})))});
  }
  if(baseline.status!=='won')errors.push('参考操作未到达终点。');
  if(noInput.status==='won')errors.push('不操作也能通过，机关缺少必要性。');
  if(early.status==='won')errors.push('开场一次性触发即可通过，时序限制未成立。');
  if(omissions.some(r=>r.status==='won'))errors.push('存在可以完全省略的计划操作。');
  if(timing.some(r=>r.status!=='won'))errors.push('采样的操作容差不足（单次提前或延后 0.4 秒）。');
  return {passed:errors.length===0,errors,recording:baseline.recording,noInput,early,omissions,timing};
}

export function verifyCandidate(candidate) {
  const job=verification(candidate);let result;
  do{result=job.next();}while(!result.done);
  return result.value;
}

export function checkCancelled(signal) {
  if(signal?.aborted)throw new DOMException('生成已取消。','AbortError');
}

async function cooperative(candidate,{signal,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}) {
  checkCancelled(signal);await yieldTask();checkCancelled(signal);
  const job=verification(candidate);let yieldedAt=performance.now();
  for(;;){
    checkCancelled(signal);const result=job.next();if(result.done)return result.value;
    if(performance.now()-yieldedAt>=8){await yieldTask();yieldedAt=performance.now();}
  }
}

/** Cooperatively scheduled form of the same verifier; no worker/server required offline. */
export function verifyCandidateAsync(candidate,options) {return cooperative(candidate,options);}
