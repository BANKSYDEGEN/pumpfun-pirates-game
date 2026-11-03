# foot.js hooks for the battle areas: FOR RAUL (you own foot.js)

Branch `emerly/battle-areas`, rebased onto origin/main v155 (your foot physics included). All the hooks are guarded and tagged `[Timothy]` or `[Emerly]`.
Everything else lives in js/island/battleAreas.js.
- `BA.stamp` only changes h / TRg inside the two pads and the paths.
- `BA.clearAt` and `BA.onPath` only act near them (`near()`: town-local lx -150..100, lz -190..-38).
- `Htri` is new: the walk height on the battle paths now follows the drawn LOD-1 terrain triangles instead of the bilinear H(), blended over 3.5-5.5 m from each path. It is used only there.
- `groundAt` keeps your `moundAt` and `coveDeckAt`. The path blend is applied to H() before them.
- The Main Street SWORD SHOP + MUSKET SHOP don't touch foot.js. They are door points + signs in js/onfoot/battle.js.

```diff
diff --git a/js/island/foot.js b/js/island/foot.js
index e8ed01f..3611536 100644
--- a/js/island/foot.js
+++ b/js/island/foot.js
@@ -12,6 +12,7 @@ import { kitMesh, pickHouse, HOUSE_VARIANTS } from './townkit.js';
 import * as CO from './coast.js';
 import * as PV from './plazaTown.js'; // [Timothy] ?plaza=2 harbor town blockout (off by default)
 import * as BT from './battery.js'; // [Timothy] headland battery: ramp, gun deck, playable guns
+import * as BA from './battleAreas.js'; // [Timothy] battle areas: MUSKET RANGE + SWORD PIT (pads, paths, art)
 const PV2 = COAST_ON_PV2();
 function COAST_ON_PV2() { return PV.PLAZA_V2 && CO.COAST_ON; }
 const COASTM = CO.COAST_ON;
@@ -152,6 +153,7 @@ for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
     const hd = Math.hypot(lx - CO.HEADLAND.lx, lz - CO.HEADLAND.lz); if (sd < 0) h = Math.max(h, CO.HEADLAND.top * (1 - sm(CO.HEADLAND.r * 0.6, CO.HEADLAND.r * 1.5, hd)) * sm(-2, 6, -sd));
     const fd = Math.hypot(lx - CO.FORT.lx, lz - CO.FORT.lz); if (fd < CO.FORT.r * 2.8) h = Math.max(h, CO.FORT.top * (1 - sm(CO.FORT.r, CO.FORT.r * 2.8, fd)));
     h = BT.ground(lx, lz, h); // [Timothy] battery ramp + gun deck
+    { const ba = BA.stamp(lx, lz, h); h = ba.h; if (ba.d < TRg[q]) TRg[q] = ba.d; } // [Timothy] battle areas: level pads + dirt floors / paths
   }
   const sk = Math.hypot(x - SKULL.x, z - (SKULL.z + 8)); if (sk < 32) h = h + (SKULL.y - h) * (1 - sm(19, 32, sk));
   Hg[q] = h;
@@ -204,6 +206,13 @@ export function coveDeckAt(x, z) { if (!COASTM) return null; const [lx, lz] = wo
   if (a >= aT0) return J.tower.y;
   if (dz > J.hw) return null; return a < aS ? J.y : J.steps[Math.min(J.steps.length - 1, Math.floor(a - aS))]; }
 const coveTower = (x, z) => coveDeckAt(x, z) === CO.SWIM_COVE.jetty.tower.y;   // the tower deck itself (not the board)
+// [Emerly] battle areas: the walk height on the SWORD PIT / MUSKET RANGE dirt paths = the drawn LOD-1 terrain triangles (chunkGeo splits each
+// 4 m cell on the (i+1, j)-(i, j+1) diagonal), not the bilinear H(), so feet sit on the slope there to the mm (tools/battle/feet_battle.py)
+export function Htri(x, z) {
+  const fx = Math.min(NX - 1e-3, Math.max(0, (x - X0) / G)), fz = Math.min(NZ - 1e-3, Math.max(0, (z - Z0) / G)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
+  const h00 = Hg[IDX(i, j)], h10 = Hg[IDX(i + 1, j)], h01 = Hg[IDX(i, j + 1)], h11 = Hg[IDX(i + 1, j + 1)];
+  return u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
+}
 const gridAt = (A, x, z) => A[IDX(Math.round(Math.min(NX, Math.max(0, (x - X0) / G))), Math.round(Math.min(NZ, Math.max(0, (z - Z0) / G))))];
 export const trailDist = (x, z) => gridAt(TRg, x, z);
 
@@ -459,6 +468,7 @@ function foliageSpots() {
     const sl = slopeAt(i, j);
     if (FOOT_POIS.some(p => Math.hypot(p.x - x, p.z - z) < (p.clear || 22))) continue;
     const clr = COASTM ? BT.clearAt(lx, lz) : 0; if (clr > 1) continue; // [Timothy] battery: ramp + gun deck clear, no trees round the guns
+    if (COASTM && BA.clearAt(lx, lz)) continue; // [Timothy] battle areas: no trees / rocks on or round the pads + paths
     if (sl > 0.95 && TRg[q] > 9) { if (r < 0.2 && !inView(x, z)) cliffs.push([x, h, z, r]); else if (r < 0.3) rocks.push([x, h, z, r]); continue; }
     if (clr) continue;
     if (inView(x, z)) { if (r < 0.1 && TRg[q] > 6) ferns.push([x, h, z, r]); continue; }
@@ -754,6 +764,7 @@ export function buildCoast(A, low, F, decorHulls = true) { // [Emerly] decorHull
   // battery on the cliff headland: [Timothy] js/island/battery.js (ramp up from the quay, parapets, shot piles, lamps, colliders; the 6 guns are createGuns)
   BT.buildArt({ k, W, box, cyl, T, H, addBox, addCirc, torchPost, F, C: { STONE, STONE_D, WOOD, WOOD_D, IRON } });
   buildSwimCove(k, at, low);                                                                       // [Raul] SWIM COVE (BANKSY)
+  BA.buildArt({ k, W, box, cyl, T, H, addBox, addCirc, torchPost, barrel, crate, F, C: { STONE, STONE_D, WOOD, WOOD_D, IRON } }); // [Timothy] battle areas: range + pit (static art, colliders)
   return k;
 }
 // [Raul] SWIM COVE art (merged into the coast kit: 0 extra draw calls): jetty on posts + 4 steps up to a diving tower with rails and
@@ -1181,7 +1192,8 @@ export function createFoot({ scene, isle, MATS, OUT, low, atlas, uTime, uWaves,
     if (along < -1 || along > B.L + 1 || Math.abs(across) > B.half + 0.6) return null; return { y: B.deckY - Math.sin(Math.min(1, Math.max(0, along / B.L)) * Math.PI) * B.sag, inside: Math.abs(across) <= B.half }; }
   // [Raul] dig mounds are walked ON (the beach one outside the plaza sank your feet 0.7 m into it): the mound's dome (r 1.9, 0.855 tall at d.y - 0.1, shrinks as it's dug)
   function moundAt(x, z, h) { for (const d of digs) { if (!d.mound.visible) continue; const s = d.mound.scale.x, r = Math.hypot(x - d.x, z - d.z) / (1.9 * s); if (r < 1) h = Math.max(h, d.y - 0.1 + 0.855 * s * Math.sqrt(1 - r * r)); } return h; }
-  function groundAt(x, z) { const b = bridgeAt(x, z); if (b) return b.y + 0.12; const h = moundAt(x, z, H(x, z)), c = coveDeckAt(x, z); return c !== null && c > h ? c : h; }
+  function groundAt(x, z) { const b = bridgeAt(x, z); if (b) return b.y + 0.12; const h0 = H(x, z), w = COASTM ? BA.onPath(...CO.w2t(x, z)) : 0; // [Emerly] battle-area paths: walk on the drawn triangles
+    const h = moundAt(x, z, w > 0 ? h0 + (Htri(x, z) - h0) * w : h0), c = coveDeckAt(x, z); return c !== null && c > h ? c : h; }
   // [Raul] foot physics (BANKSY "fall off cliffs" + "float / swim"): you may now walk OFF any ledge (js/onfoot/physics.js drops you
   // with gravity) and into water (deeper than chest height = swim at the surface). Uphill keeps the v105 grade limit; out of the
   // water you can pull yourself up onto anything up to FOOT_SWIM.climb above the surface (shore rocks, the lake rim, low jetties).
```
