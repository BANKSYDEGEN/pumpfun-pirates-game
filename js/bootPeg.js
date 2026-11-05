// [Raul items redo] PUMPFUN PIRATES shop boots x peg legs (pure, no three.js: tests/bootsPeg.test.mjs runs it in node).
// BANKSY (10:02 AM 2026-11-04) "boots don't work with peg leg": a boot renders ONLY on the real foot. The boots are built one closed
// shell per foot (tools/blender/boots/build_boots.py), so a triangle's side is its bind-space x sign (character left = +x = legL).
// - bootKeep: the boot's index without the peg side's triangles (the whole boot on that side goes: nothing over the peg / knee sleeve)
// - bootHides: the boot's hide rule (both legs of the body + base outfit below BOOT_CUT), skipped on a peg leg (PEG5 owns that leg)
// BOOT_CUT: 2.4 cm under each boot's top (v5 bind space, raw), so the pants end inside the shaft; always below the knee sleeve's PEG_CUT.
export const BOOT_CUT = { boots_buckle: { male: 0.1702, female: 0.1796 }, boots_cavalier: { male: 0.1662, female: 0.1756 }, boots_gold: { male: 0.1682, female: 0.1776 },
  // [V6 store] Clothing Store shoes (V6 bind space, built by tools/v6/shoes/build_shoes.py: 2.4 cm under each top; low shoe / sandal: under the collar / the footbed)
  boots_classic: { male: 0.1702, female: 0.1796 }, boots_sea: { male: 0.1742, female: 0.1836 }, shoes_buckle: { male: 0.092, female: 0.092 }, sandals: { male: 0.010, female: 0.010 } };
export const BOOT5 = (id) => [{ boot5: 1, y: BOOT_CUT[id].male, male: 1 }, { boot5: 1, y: BOOT_CUT[id].female, female: 1 }];
export const bootSide = (x) => (x > 0 ? 'L' : 'R');
export function bootKeep(P, I, L, R) {   // P: { getX(i) } (three BufferAttribute or a shim), I: triangle index array
  const out = [];
  for (let i = 0; i < I.length; i += 3) { const s = bootSide(P.getX(I[i]) + P.getX(I[i + 1]) + P.getX(I[i + 2])); if ((L && s === 'L') || (R && s === 'R')) continue; out.push(I[i], I[i + 1], I[i + 2]); }
  return out;
}
export function bootHides(r, rX, rY, female, legL, legR) {
  if ((r.female && !female) || (r.male && female)) return false;
  if (rX > 0 ? legL : legR) return false;
  return Math.abs(rX) > 0.002 && Math.abs(rX) < 0.3 && rY < r.y;
}
