import { floorY } from './schema.js';
import { verticalTransport } from './transport.js';
import { surfaceEndY } from './surfaces.js';
import { posePolygon } from './pose.js';

/** Logical diagram bounds, shared by the editor hit areas and the art-free renderer. */
export function diagramBounds(kind, object) {
  const y = floorY(object), width = object.width ?? 28;
  if (kind === 'platform') return { x:object.x, y:Math.min(y,surfaceEndY(object))+2, width, height:Math.abs(y-surfaceEndY(object))+12 };
  if (kind === 'actor') return { x:object.x-12, y:y-32, width:24, height:32 };
  if (kind === 'goal') return { x:object.x-16, y:y-40, width:32, height:40 };
  if(object.pose){
    const points=posePolygon(object),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  }
  const t=verticalTransport(object);
  if (t || kind === 'lift') {const toY=(t??object).toY;return { x:object.x, y:toY-12, width, height:y-toY+24 };}
  const height = object.height??({ bridge:12, switch:28, plate:8, gate:64, object:36, zone:60, hazard:40 }[kind] ?? 28);
  return { x:object.x, y:y-height, width, height };
}
