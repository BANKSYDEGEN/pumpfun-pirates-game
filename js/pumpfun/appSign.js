// HQ "Get the pump.fun app" plaque placements (face art = assets/pumpfun/referral_sign.webp).
// Size is ~60% of the original 4.2 x 1.575, original aspect, fitted into the facade recesses.
export const APP_SIGN = Object.freeze({
  w: 2.52,
  h: 0.945,
  // town-local: front = dock-gate west recess, just above head height; hill = east-wall recess south of the door
  front: Object.freeze({ lx: -25.35, yOff: 2.75, lz: -29.18, yaw: 0 }),
  hill: Object.freeze({ lxOff: 0.72, yOff: 2.75, lzOff: -6.8, yaw: Math.PI / 2 }),
  promptR: 3.2,
  label: 'GET THE PUMP.FUN APP',
});
