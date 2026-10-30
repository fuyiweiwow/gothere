import {createSimulation,validateLevel} from '../core/engine.js';

const MAX_TICKS=6000;
function run(level,inputs) {
  const simulation=createSimulation(level);simulation.start();let tick=0;
  for(const input of [...inputs].sort((a,b)=>a.tick-b.tick)){
    simulation.step(Math.max(0,input.tick-tick-1));
    if(!simulation.click(input.source))break;
    simulation.step(1);tick=input.tick;
  }
  simulation.step(MAX_TICKS-tick);
  const state=simulation.snapshot();
  return {status:state.status,tick:state.tick,reason:state.reason,recording:simulation.recording()};
}

/** Replay evidence and sampled counterfactuals, not an exhaustive solver or a fun score. */
export function verifyCandidate(candidate) {
  const errors=[],validation=validateLevel(candidate?.level);
  if(!validation.valid)return {passed:false,errors:validation.errors};
  const plan=candidate.plan;
  if(!Array.isArray(plan)||plan.length<3||plan.length>5||plan.some(p=>!p||!Number.isInteger(p.tick)||p.tick<1||p.tick>MAX_TICKS||
    !candidate.level.entities.some(e=>e.id===p.source)))return {passed:false,errors:['生成计划无效或超过验证预算。']};
  const baseline=run(candidate.level,plan),noInput=run(candidate.level,[]),early=run(candidate.level,plan.map(p=>({...p,tick:1})));
  const omissions=plan.map((p,i)=>({source:p.source,...run(candidate.level,plan.filter((_,j)=>j!==i))}));
  const timing=plan.flatMap((p,i)=>[-24,24].map(offset=>({source:p.source,offset,...run(candidate.level,plan.map((p,j)=>({...p,tick:j===i?Math.max(1,p.tick+offset):p.tick})))})));
  if(baseline.status!=='won')errors.push('参考操作未到达终点。');
  if(noInput.status==='won')errors.push('不操作也能通过，机关缺少必要性。');
  if(early.status==='won')errors.push('开场一次性触发即可通过，时序限制未成立。');
  if(omissions.some(r=>r.status==='won'))errors.push('存在可以完全省略的计划操作。');
  if(timing.some(r=>r.status!=='won'))errors.push('采样的操作容差不足（单次提前或延后 0.4 秒）。');
  return {passed:errors.length===0,errors,recording:baseline.recording,noInput,early,omissions,timing};
}
