// [Emerly sword-hand] BANKSY 1:26 PM: "if they have right hand hook and carry sword left hand they swing left hand".
// Pure rules (no three.js, unit-tested in tests/swordHand.test.mjs): the SWORD PIT blade goes in the hand WITHOUT the hook, the same
// hand as Raul's carried sword (js/carryRules.js carryHand): hook on the right -> LEFT hand, hook on the left / no hook -> right hand.
import { carryHand } from '../carryRules.js';
export const swordHand = (gear) => carryHand(gear);
// the swing poses are authored for the right arm in pirate space (x = the pirate's side, y up, +z front): the left arm mirrors x
export const mirrorX = (v, hand) => (hand === 'L' ? { x: -v.x, y: v.y, z: v.z } : { x: v.x, y: v.y, z: v.z });
// the spine twist mirrors too (the swing winds up and slashes across the other way)
export const mirrorTwist = (a, hand) => (hand === 'L' ? -a : a);
// the forearm bones point at the hand along -X (right) / +X (left), see assets/pirates/*_v5 (forearm.L sits at +x of upperarm.L)
export const handAxis = (hand) => (hand === 'L' ? 1 : -1);
