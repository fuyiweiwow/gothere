import { createSimulation } from '../core/engine.js';
import { eventTypes } from '../core/schema.js';

/** UI-independent preview controls. Paused input is queued for the next tick. */
export function createPreview(level,{recording}={}) {
  const simulation = createSimulation(level);
  let cursor=0;
  if(recording!==undefined){
    if(!recording||recording.schemaVersion!==1||recording.levelId!==level.id||!Number.isInteger(recording.untilTick)||recording.untilTick<1||recording.untilTick>36000||
      !['won','lost'].includes(recording.status)||!Array.isArray(recording.inputs)||recording.inputs.length>36000)throw new Error('演示回放格式或关卡不匹配。');
    let previous=0,sameTick=0;
    for(const input of recording.inputs){
      if(!input||!Number.isInteger(input.tick)||input.tick<1||input.tick<previous||input.tick>recording.untilTick||
        !level.entities.some(e=>e.id===input.source&&eventTypes(e).includes('click')))throw new Error('演示操作序列不合法。');
      sameTick=input.tick===previous?sameTick+1:1;if(sameTick>32)throw new Error('同一帧的演示操作过多。');previous=input.tick;
    }
    recording=structuredClone(recording);
  }
  const advance=count=>{
    if(!Number.isInteger(count)||count<0||count>36000)throw new Error('步数必须为 0～36000 的整数。');
    if(!recording){simulation.step(count);return;}
    let state=simulation.recording();const until=Math.min(state.untilTick+count,recording.untilTick);
    while(state.status==='running'&&state.untilTick<until){
      const next=recording.inputs[cursor];
      if(next?.tick===state.untilTick+1){
        while(recording.inputs[cursor]?.tick===next.tick)simulation.click(recording.inputs[cursor++].source);
        simulation.step();
      }else simulation.step(Math.min(until,next?next.tick-1:until)-state.untilTick);
      state=simulation.recording();
    }
    if(state.untilTick>=recording.untilTick)simulation.pause();
  };
  return {
    playback:recording!==undefined,
    snapshot:simulation.snapshot,
    start:()=>simulation.start(),
    pause:()=>simulation.pause(),
    advance,
    step:()=>{simulation.pause();simulation.start();advance(1);simulation.pause();},
    reset:()=>{cursor=0;return simulation.reset();},
    click(source) {
      if(recording)return false;
      const state=simulation.snapshot(),status=state.status,entity=state.entities[source];
      if(!['ready','paused','running'].includes(status)||!entity||!eventTypes(entity).includes('click'))return false;
      simulation.start();const accepted=simulation.click(source);
      if(status!=='running')simulation.pause();
      return accepted;
    },
  };
}
