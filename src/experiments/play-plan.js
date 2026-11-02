import {createSimulation} from '../core/engine.js';

/** Bounded, deterministic plan runner. Trace samples are evidence, never instructions to the engine. */
export function runPlan(level,plan,{untilTick=3600}={}){
  if(!Number.isInteger(untilTick)||untilTick<1||untilTick>3600)throw new Error('模拟预算需要 1～3600 个 tick。');
  if(!Array.isArray(plan)||plan.length>32)throw new Error('操作计划最多 32 项。');
  let previous=0;
  for(const input of plan){
    if(!input||!Number.isInteger(input.tick)||input.tick<1||input.tick>untilTick||input.tick<previous||
      !level?.rules?.some(r=>r.on.type==='click'&&r.on.source===input.source))throw new Error('操作计划的时间或点击源无效。');
    previous=input.tick;
  }
  const sim=createSimulation(level);sim.start();
  let state=sim.snapshot(),index=0;
  const trace=[{tick:state.tick,actor:state.actor}];
  while(state.status==='running'&&state.tick<untilTick){
    const nextTick=plan[index]?.tick;
    if(nextTick===state.tick+1){
      while(plan[index]?.tick===nextTick)sim.click(plan[index++].source);
      sim.step(1);
    }else sim.step(Math.min(30,untilTick-state.tick,nextTick===undefined?30:nextTick-state.tick-1));
    state=sim.snapshot();trace.push({tick:state.tick,actor:state.actor});
  }
  return {status:state.status,reason:state.reason,recording:sim.recording(),trace};
}
