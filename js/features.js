// Pilly uses its own companion slot alongside parrots; HQ minimap ashore fix is live.
// Mobile safety hotfix: purchase-triggered crash reported on touch devices.
// Do not create the companion, load its GLB, or expose purchase entry points
// until the mobile failure has been reproduced and resolved.
export const pillyEnabledFor = (env = globalThis) => !(
  (env.navigator?.maxTouchPoints || 0) > 0 ||
  env.matchMedia?.('(pointer: coarse)')?.matches ||
  (env.window && 'ontouchstart' in env.window)
);
export const PILLY_ENABLED = pillyEnabledFor();
