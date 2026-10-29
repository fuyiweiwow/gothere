import { posedSurface } from './pose.js';

const EPSILON = 1e-7;
const STEP = 1 / 60;

export function surfaceEndY(surface) {
  return surface.yEnd ?? surface.y ?? 440;
}

function lineHeight(surface, x) {
  const y = surface.y ?? 440;
  return y + (surfaceEndY(surface) - y) * (x - surface.x) / surface.width;
}

/** A road is a one-way foot support, not a solid volume. */
export function surfaceHeight(surface, x) {
  if (x < surface.x - EPSILON || x > surface.x + surface.width + EPSILON) return null;
  return lineHeight(surface, x);
}

export function collectSurfaces(level, entities, held = null) {
  return [
    ...level.platforms.map((p, index) => ({ ...p, id:'platform:' + index })),
    ...Object.values(entities).filter(e => e.kind === 'bridge' && e.state === 'extended')
      .map(e => ({ x:e.x, width:e.width, y:e.y, id:e.id })),
    ...Object.values(entities).filter(e => e.kind === 'lift')
      .map(e => ({ x:e.x, width:e.width, y:e.carY, id:e.id })),
    ...Object.values(entities).filter(e => e.surface?.enabled && e.id !== held).map(e=>posedSurface(e)),
    ...Object.values(entities).filter(e => e.collider?.enabled && e.id !== held)
      .map(e=>({id:e.id,x:e.x,width:e.width??28,y:(e.y??440)-(e.height??36)})),
  ];
}

export function supportAt(surfaces, x, y, preferred, direction = 0) {
  const matches = surfaces.filter(s => {
    const height = surfaceHeight(s, x);
    return height !== null && Math.abs(height - y) < EPSILON &&
      (!direction || (direction > 0 ? s.x + s.width > x + EPSILON : s.x < x - EPSILON));
  });
  return matches.find(s => s.id === preferred) ?? matches[0] ?? null;
}

function roots(a, b, c) {
  if (Math.abs(a) < EPSILON) return Math.abs(b) < EPSILON ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
  return Math.abs(q) < EPSILON ? [0] : [q / a, c / q].sort((x, y) => x - y);
}

/** Earliest top-side intersection of the ballistic foot path and any support segment. */
function firstLanding(surfaces, actor, vx, gravity, duration) {
  let hit = null;
  for (const surface of surfaces) {
    const slope = (surfaceEndY(surface) - (surface.y ?? 440)) / surface.width;
    const relativeVelocity = actor.vy - slope * vx;
    for (const time of roots(gravity / 2, relativeVelocity, actor.y - lineHeight(surface, actor.x))) {
      if (time < -EPSILON || time > duration + EPSILON || relativeVelocity + gravity * time <= EPSILON) continue;
      const t = Math.max(0, Math.min(duration, time)), x = actor.x + vx * t;
      if (surfaceHeight(surface, x) === null) continue;
      if (t < EPSILON && !supportAt([surface], x, actor.y, null, Math.sign(vx))) continue;
      if (!hit || t < hit.time - EPSILON) hit = { surface, time:t };
      break;
    }
  }
  return hit;
}

/** Pure fixed-step motion. Traces include seams, edge departure and landing within one tick. */
export function advanceWalker(actor, surfaces, speed, physics, goal) {
  const next = { ...actor, vy:actor.vy ?? 0 }, segments = [], landings = [];
  const vx = next.direction * speed;
  let elapsed = 0, goalReached = false;
  const append = (from, duration, mode, gravity = 0, vy = 0) => {
    segments.push({ from, to:{x:next.x,y:next.y}, start:elapsed, end:elapsed+duration, mode, gravity, vy });
    elapsed += duration;
  };
  // Each transition consumes a surface interval or switches walking/falling mode.
  for (let transitions = 0; elapsed < STEP - EPSILON && transitions < surfaces.length * 2 + 8; transitions++) {
    const remaining = STEP - elapsed;
    if (next.mode === 'walking') {
      if(goal&&Math.abs(next.x-goal.x)<EPSILON&&Math.abs(next.y-(goal.y??440))<EPSILON&&supportAt(surfaces,next.x,next.y,next.support)){
        next.x=goal.x;goalReached=true;break;
      }
      const surface = supportAt(surfaces, next.x, next.y, next.support, next.direction);
      if (!surface) { next.mode='falling';next.support=null;next.vy=0;continue; }
      next.support=surface.id;
      const edge = next.direction > 0 ? surface.x + surface.width : surface.x;
      let duration = Math.min(remaining, (edge - next.x) / vx);
      if (goal && (goal.x-next.x)*next.direction >= -EPSILON && (goal.x-next.x)*next.direction <= speed*duration+EPSILON &&
        Math.abs(lineHeight(surface, goal.x)-(goal.y??440)) < EPSILON) {
        duration = Math.max(0,(goal.x-next.x)/vx);goalReached=true;
      }
      const from = { x:next.x, y:next.y };
      next.x=goalReached?goal.x:next.x+vx*duration;
      next.y=lineHeight(surface,next.x);next.vy=0;
      append(from,duration,'walking');
      if (goalReached) break;
    } else {
      const gravity = next.vy < physics.maxFallSpeed - EPSILON ? physics.gravity : 0;
      const duration = gravity ? Math.min(remaining,(physics.maxFallSpeed-next.vy)/gravity) : remaining;
      const hit = firstLanding(surfaces,next,vx,gravity,duration), time = hit?.time ?? duration;
      const from = { x:next.x,y:next.y }, vy=next.vy;
      next.x+=vx*time;next.y+=vy*time+gravity*time*time/2;
      next.vy=Math.min(physics.maxFallSpeed,vy+gravity*time);
      append(from,time,'falling',gravity,vy);
      if (hit) {
        next.y=lineHeight(hit.surface,next.x);segments.at(-1).to.y=next.y;
        next.mode='walking';next.support=hit.surface.id;next.vy=0;
        landings.push({time:elapsed,x:next.x,y:next.y,support:next.support});
        if(goal&&Math.abs(next.x-goal.x)<EPSILON&&Math.abs(next.y-(goal.y??440))<EPSILON){next.x=goal.x;goalReached=true;break;}
      }
    }
  }
  // Remove horizontal accumulation drift without quantising the sampled slope height.
  if (!goalReached) next.x=Math.round(next.x*1e6)/1e6;
  if (next.mode==='walking') {
    const support=surfaces.find(s=>s.id===next.support);
    if(support)next.y=lineHeight(support,next.x);
  }
  if(segments.length)segments.at(-1).to={x:next.x,y:next.y};
  return { actor:next, segments, landings, goalReached };
}

/** Logical contacts keep the existing foot-height convention, now swept in both axes. */
export function touchesFootPath(segments, left, right, y) {
  return segments.some(segment => {
    const {from,to}=segment, duration=segment.end-segment.start;
    if(!duration)return Math.abs(from.y-y)<EPSILON&&from.x>=left&&from.x<=right;
    if(segment.mode!=='falling') {
      if(Math.abs(to.y-from.y)<EPSILON)return Math.abs(from.y-y)<EPSILON&&Math.max(from.x,to.x)>=left&&Math.min(from.x,to.x)<=right;
      const fraction=(y-from.y)/(to.y-from.y),x=from.x+(to.x-from.x)*fraction;
      return fraction>=-EPSILON&&fraction<=1+EPSILON&&x>=left-EPSILON&&x<=right+EPSILON;
    }
    return roots(segment.gravity/2,segment.vy,from.y-y).some(time => {
      const x=from.x+(to.x-from.x)*time/duration;
      return time>=-EPSILON&&time<=duration+EPSILON&&x>=left-EPSILON&&x<=right+EPSILON;
    });
  });
}

/** Express the same foot path relative to a transformed object's baseline. */
export function touchesSurfacePath(segments, surface, padding=10) {
  const slope=(surfaceEndY(surface)-surface.y)/surface.width;
  const relative=segments.map(segment=>{
    const {from,to}=segment,duration=segment.end-segment.start;
    const height=p=>({x:p.x,y:p.y-slope*(p.x-surface.x)});
    return {...segment,from:height(from),to:height(to),vy:segment.vy-slope*(duration?(to.x-from.x)/duration:0)};
  });
  return touchesFootPath(relative,surface.x-padding,surface.x+surface.width+padding,surface.y);
}
