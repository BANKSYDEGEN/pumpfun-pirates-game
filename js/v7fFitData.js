// [v7f gear] BANKSY t436u "Fix all v7 girl clothes and accessories": the V7 female (raw Meshy body, rigged) wore the v5-female gear
// GLBs as authored for the v5 body. Her legs are longer (knee 0.304 vs 0.224, hip 0.534 vs 0.42 bind y) and her feet / calves differ,
// so boots floated round the ankles (feet through the soles) and the peg-leg knee cup sat mid-shin. These are her own refits
// (tools/v7f_gear/fit.py: anatomical height map + per-slice girth profiles of both bodies, clearance push, skin weights from her body for
// footwear), hi + lo, Meshopt-packed (lossless floats). Female V7 only; male (V7M_FITS) and v5 / v6 bodies keep their own files.
// hide: her own bind-space cut heights (the v5 BOOT_CUT / PEG_CUT mapped through the same height map), replacing the v5 cut rules.
const F = (id) => ({
  "cloth_singlet": { "hi": "assets/pirates/items/v7f_fit/cloth_singlet_female_hi.glb", "lo": "assets/pirates/items/v7f_fit/cloth_singlet_female_lo.glb" },
 hi: `assets/pirates/items/v7f_fit/${id}_female_hi.glb`, lo: `assets/pirates/items/v7f_fit/${id}_female_lo.glb` });
// v5 female bind y -> V7 female bind y (floor, knee, hip joint, waist, armpit, neck, crown)
export const V7F_YMAP = { v5: [0, 0.224, 0.42, 0.54, 0.69, 0.84, 1.397], v7: [0, 0.304, 0.534, 0.60, 0.72, 0.85, 1.397] };
export function v7fY(y) { const A = V7F_YMAP.v5, B = V7F_YMAP.v7; if (y <= A[0]) return B[0]; for (let i = 1; i < A.length; i++) if (y <= A[i]) return B[i - 1] + (y - A[i - 1]) * (B[i] - B[i - 1]) / (A[i] - A[i - 1]); return y; }
const BOOT_CUT_F = { boots_buckle: 0.1796, boots_cavalier: 0.1756, boots_gold: 0.1776, boots_classic: 0.1796, boots_sea: 0.1836, shoes_buckle: 0.092, sandals: 0.010 };   // = js/bootPeg.js BOOT_CUT[id].female
const PEG_CUT_F = 0.2122;   // = PEG_CUT.female
const r4 = (v) => Math.round(v * 1e4) / 1e4;
export const V7F_FITS = {
  // [v7f gear b3] BANKSY t442u / t445u: her tank refit on her torso (tools/v7f_gear/fit.py cloth, seam copies welded, shells smoothed
  // together, BUST band clearance; tools/v7f_gear/b3/README.md). Only the tank passed review; the other tops stay on the raw v5 files.
  cloth_tank: F('cloth_tank'),
  ...Object.fromEntries(Object.entries(BOOT_CUT_F).map(([id, y]) => [id, { ...F(id), hide: [{ boot5: 1, y: r4(v7fY(y)), female: 1 }] }])),
  // [v7f hooks b10] BANKSY t449u / t450u hooks first: the raw v5-female hook cuff sat 3 cm low / 4 cm forward of her forearm, so after
  // the runtime hand hide her ragged wrist stub showed below / behind the cuff. RIGID re-seat only (one translation per file onto her
  // forearm axis; mesh, UVs, colours, _TINT, skin untouched); the v5hide arm cut (female s) stays, now inside the cuff. Iron + gold (same files).
  hook_l: F('hook_l'), hook_r: F('hook_r'),
  ...Object.fromEntries(['peg', 'peg_gold', 'peg_kraken', 'peg_ghost'].flatMap((b) => ['l', 'r'].map((s) => [`${b}_${s}`, { ...F(`${b}_${s}`), hide: [{ leg5: s.toUpperCase(), y: r4(v7fY(PEG_CUT_F)), female: 1 }] }]))),
};
// [v7f gear] her (unrefit) v5 pants run to y 0.673; the shared pants dye stops at 0.565-0.595 (male V7 waist), so the hip / waistband
// fabric never took the chosen pants colour on her. V7 female only: the dye runs to the top of her pants (red sash / gold / accent kept).
export const V7F_PANTS_DYE_Y = [0.70, 0.72];
