import { createSimulation } from '../core/engine.js';
import { eventTypes } from '../core/schema.js';

/** UI-independent preview controls. Paused input is queued for the next tick. */
export function createPreview(level) {
  const simulation = createSimulation(level);
  return {
    snapshot:simulation.snapshot,
    start:()=>simulation.start(),
    pause:()=>simulation.pause(),
    advance:count=>simulation.step(count),
    step:()=>{simulation.pause();simulation.singleStep();},
    reset:()=>simulation.reset(),
    click(source) {
      const state=simulation.snapshot(),status=state.status,entity=state.entities[source];
      if(!['ready','paused','running'].includes(status)||!entity||!eventTypes(entity).includes('click'))return false;
      simulation.start();const accepted=simulation.click(source);
      if(status!=='running')simulation.pause();
      return accepted;
    },
  };
}
