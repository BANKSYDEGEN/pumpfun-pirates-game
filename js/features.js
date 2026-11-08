// Emergency safety pause (BANKSY, Nov 8 2026): Pilly stays off on ALL devices.
// No companion construction / GLB load, ownership tick, store or inventory entry.
// Free ownership and saved progression are untouched; restore only after crash QA.
export const pillyEnabledFor = (_env = globalThis) => false;
export const PILLY_ENABLED = pillyEnabledFor();
