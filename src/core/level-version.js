/** Preserve legacy 2D documents verbatim. Only the first spatial preview used
 * v1 with spatial fields; upgrade that known format without touching authored data. */
export function normalizeLevel(input) {
  const level=structuredClone(input);
  if(level?.schemaVersion===1&&level.spatial!==undefined)level.schemaVersion=2;
  return level;
}

export function levelVersionValid(level) {
  return level?.spatial===undefined?level?.schemaVersion===1:level?.schemaVersion===2;
}
