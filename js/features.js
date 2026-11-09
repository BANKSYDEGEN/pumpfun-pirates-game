// Emergency safety pause (BANKSY, Nov 8 2026): Pilly stays off on ALL devices.
// No companion construction / GLB load, ownership tick, store or inventory entry.
// Free ownership and saved progression are untouched; restore only after crash QA.
export const pillyEnabledFor = (_env = globalThis) => false;
export const PILLY_ENABLED = pillyEnabledFor();

// AI-ship crew pirate SKIN (not the pet). Lazy-loads pet_pilly.glb as a near-LOD
// lookalike driven by existing crew stations. Player ships stay on canonical V7.
export const AI_PILLY_CREW = true;
