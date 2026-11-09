// Sample art direction only. The output remains ordinary editable scene data.
const images=['stopAtmosphere','stopGround','stopCorner','stopTenement','stopOfficeBlock','stopShelter','stopTree','stopBus','stopBusDoor',
  'towCallerAngry','towCallerPoint','towCallerPhone','towOwnerIdle','towOwnerRun','towCar','towTruck','towTruckRoll',
  'crossOfficerPhone','crossOfficerWhistle','crossOfficerWalk1','crossOfficerWalk2',
  'crossWalkerPhone','crossWalkerListen','crossWalkerWalk1','crossWalkerWalk2',
  'scootRider','scootRiderPhone','blockRider','streetDog',
  'blockBusBack','blockShelter','blockShop','blockBreakfast','blockShutter','blockApartment','blockOffice','blockStreets','commuterIdle',
  ...['Walk','In','Out','Fall'].flatMap(p=>Array.from({length:8},(_,i)=>'commuter'+p+(i+1))),
  ...['A','B','C'].flatMap(s=>['stopPassenger'+s+'Idle','stopPassenger'+s+'Walk',
    ...Array.from({length:4},(_,i)=>'queue'+s+'Ready'+(i+1)),...Array.from({length:6},(_,i)=>'queue'+s+'Shove'+(i+1))])];
export const CARTOON_ART=Object.freeze(Object.fromEntries(images.map(id=>[id,'toon'+id[0].toUpperCase()+id.slice(1)])));
export function cartoonArt(scene){
  const image=id=>CARTOON_ART[id]??id;
  for(const node of scene.nodes)for(const style of [node,...Object.values(node.variants??{})]){
    if(style.asset)style.asset=image(style.asset);if(style.animation)style.animation.frames=style.animation.frames.map(image);
  }
  for(const feedback of scene.feedback??[])if(feedback.animation)feedback.animation.frames=feedback.animation.frames.map(image);
  return scene;
}
