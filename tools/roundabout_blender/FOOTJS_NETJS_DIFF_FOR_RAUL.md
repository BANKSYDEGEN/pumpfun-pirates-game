# foot.js + net.js changes for Raul (branch timothy/roundabout-bridge, vs origin/main 9975c9c v207)

All guarded: with &roundabout=0 (or no HIGH_BRIDGES registered) every hook is a no-op and the old behaviour is exact.
- foot.js: Emerly's HIGH_BRIDGES / setLayer / highBridgeAt + the one-line hooks at the top of groundAt / blocked / whyBlocked; Timothy's collidersOff(test) (marks matching CIRC/BOXES .off, hitCollider already skips .off) and three extra fields on the registerAreas h (addHighBridge, AREA_DECKS, collidersOff).
- net.js: a remote peer is placed with placeBody(..., world.layer ? 1e4 : null) so a peer first seen on the bridge strip lands on the deck, not in the valley (the mid-bridge snap).

```diff
diff --git a/js/island/foot.js b/js/island/foot.js
index d19e549..84afed2 100644
--- a/js/island/foot.js
+++ b/js/island/foot.js
@@ -591,6 +591,7 @@ const CIRC = [], BOXES = [], CELL = 16, HASH = new Map();
 function hashAdd(o, x, z, r) { for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) { const k = i * 4096 + j; if (!HASH.has(k)) HASH.set(k, []); HASH.get(k).push(o); } }
 function addCirc(x, z, r) { const o = { t: 0, x, z, r }; CIRC.push(o); hashAdd(o, x, z, r); }
 function addBox(x, z, w, d, yaw) { const o = { t: 1, x, z, hx: w / 2, hz: d / 2, c: Math.cos(yaw), s: Math.sin(yaw) }; BOXES.push(o); hashAdd(o, x, z, Math.hypot(w, d) / 2); }
+export function collidersOff(test) { let n = 0; for (const o of [...CIRC, ...BOXES]) if (!o.off && test(o)) { o.off = true; n++; } return n; } // [roundabout-bridge] a piece another area replaced: its old colliders off (o.t 0 = circle { x, z, r }, 1 = box { x, z, hx, hz })
 // [island-rework] walkable area decks (fishing dock, stepping stones, temple floors ...): rect { x, z, hw, hl, yaw, y } or disc { x, z, r, y }
 export const AREA_DECKS = [];
 // decks: { x, z, r } disc or { x, z, hw, hl, yaw } box at y; a box deck can also be a STAIR / RAMP along its length (local +l = yaw
@@ -1033,6 +1034,15 @@ export const FOOT_POIS = [];
 export const LIGHTHOUSES = []; // [v108] { id, x, y, z, opts } built with the shared lighthouse kit (createFoot adds them to the root)
 function poi(id, label, x, z, extra = {}) { const p = { id, label, x, z, y: H(x, z), action: null, ...extra }; FOOT_POIS.push(p); return p; }
 export const BRIDGE = {};
+// [path-fix2] HIGH bridges (areas/hillRound.js): walkable only for whoever is up at deck height. The caller says how high the body is
+// (setLayer(feet y) around its ground / blocked queries: physics, walker, followers); null = not up there = the ground below (the valley
+// trail runs on under it). { ax, az, bx, bz, L, yaw, half, yAt(u) }. D3's BRIDGE (bridgeAt) is unchanged: always the floor.
+export const HIGH_BRIDGES = []; let LAYER = null;
+export function setLayer(y) { LAYER = y === undefined || y === null || !isFinite(y) ? null : y; }
+export function highBridgeAt(x, z, ly = LAYER) { if (ly === null || !HIGH_BRIDGES.length) return null;
+  for (const B of HIGH_BRIDGES) { const dx = x - B.ax, dz = z - B.az, sn = Math.sin(B.yaw), cs = Math.cos(B.yaw), along = dx * sn + dz * cs, across = dx * cs - dz * sn;
+    if (along < -0.6 || along > B.L + 0.6 || Math.abs(across) > B.half + 0.6) continue; const y = B.yAt(along / B.L); if (ly < y - 2) continue;
+    return { y, inside: Math.abs(across) <= B.half }; } return null; }
 export const DIGS = [];
 const jagCone = (r, h, seg, seed) => { const g = new THREE.ConeGeometry(r, h, seg, 5), P = g.attributes.position;
   for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = 0.5 - y / h, k = 1 + 0.3 * t * Math.sin(x * 0.9 + seed) * Math.sin(z * 1.1 + seed * 2) + 0.12 * t * Math.sin(y * 0.8 + seed); P.setXYZ(i, x * k, y, z * k); }
@@ -1169,7 +1179,7 @@ export function buildInland(A, low, F) {
   for (const path of Object.values(TRAILS)) { let acc = 0; for (let i = 1; i < path.length; i++) { acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); if (acc > 45) { acc = 0;
     const [x, z] = path[i], dx = path[i][0] - path[i - 1][0], dz = path[i][1] - path[i - 1][1], n = Math.hypot(dx, dz) || 1, tx = x + dz / n * 3.2, tz = z - dx / n * 3.2; if (H(tx, tz) > 1 && !(Math.abs(tx - ROPE_BRIDGE.c[0]) < 5 && tz > -106 && tz < -61)) torchPost(k, F, tx, H(tx, tz), tz); } } } // (no torch pole down in the gorge under the bridge)
   poi('gate', 'Town gate (trailhead A + B)', GATE[0], GATE[1]);
-  registerAreas({ H, poi, addCirc, addBox, addDeck, INTERACT, TRAILS, GATE, STREET, townToWorld }); // [island-rework] eager part of each area (POIs keep the foliage clear)
+  registerAreas({ H, poi, addCirc, addBox, addDeck, addHighBridge: (b) => HIGH_BRIDGES.push(b), AREA_DECKS, collidersOff, INTERACT, TRAILS, GATE, STREET, townToWorld }); // [island-rework] eager part of each area (POIs keep the foliage clear)
   for (const [id, ty, up, d0, d1] of [['skullpeak', 14, 2.2, 45, 120], ['gallows', 4, 1.7, 45, 120], ['falls', LAKE.y + 12 - H(-206, -186), 1.7, 60, 150]]) { const q = FOOT_POIS.find(p => p.id === id); q.view = vantage(q, q.y + ty, up, d0, d1); q.ty = q.y + ty; }
   return k;
 }
@@ -1324,14 +1334,14 @@ export function createFoot({ scene, isle, MATS, OUT, low, atlas, uTime, uWaves,
     if (along < -1 || along > B.L + 1 || Math.abs(across) > B.half + 0.6) return null; return { y: B.deckY - Math.sin(Math.min(1, Math.max(0, along / B.L)) * Math.PI) * B.sag, inside: Math.abs(across) <= B.half }; }
   // [Raul] dig mounds are walked ON (the beach one outside the plaza sank your feet 0.7 m into it): the mound's dome (r 1.9, 0.855 tall at d.y - 0.1, shrinks as it's dug)
   function moundAt(x, z, h) { for (const d of digs) { if (!d.mound.visible) continue; const s = d.mound.scale.x, r = Math.hypot(x - d.x, z - d.z) / (1.9 * s); if (r < 1) h = Math.max(h, d.y - 0.1 + 0.855 * s * Math.sqrt(1 - r * r)); } return h; }
-  function groundAt(x, z) { const b = bridgeAt(x, z); if (b) return b.y + 0.12; const ad = AREA_DECKS.length ? areaDeckAt(x, z) : null; if (ad !== null) return ad; // [island-rework] area decks (docks, stairs, ramps, ramparts) ARE the floor
+  function groundAt(x, z) { const hb = highBridgeAt(x, z); if (hb) return hb.y + 0.12; const b = bridgeAt(x, z); if (b) return b.y + 0.12; const ad = AREA_DECKS.length ? areaDeckAt(x, z) : null; if (ad !== null) return ad; // [island-rework] area decks (docks, stairs, ramps, ramparts) ARE the floor
     const h0 = H(x, z), w = COASTM ? BA.onPath(...CO.w2t(x, z)) : 0; // [Emerly] battle-area paths: walk on the drawn triangles
     const h = moundAt(x, z, w > 0 ? h0 + (Htri(x, z) - h0) * w : h0), c = coveDeckAt(x, z); return c !== null && c > h ? c : h; }
   const DECK_STEP = 0.6; // [island-rework] the biggest step up onto / along an area deck (stair treads are <= 0.25)
   // [Raul] foot physics (BANKSY "fall off cliffs" + "float / swim"): you may now walk OFF any ledge (js/onfoot/physics.js drops you
   // with gravity) and into water (deeper than chest height = swim at the surface). Uphill keeps the v105 grade limit; out of the
   // water you can pull yourself up onto anything up to FOOT_SWIM.climb above the surface (shore rocks, the lake rim, low jetties).
-  function blocked(x, z, fx, fz) { const b = bridgeAt(x, z); if (b) return !b.inside;          // on the deck: rails bound you
+  function blocked(x, z, fx, fz) { const hb = highBridgeAt(x, z); if (hb) return !hb.inside; const b = bridgeAt(x, z); if (b) return !b.inside;          // on the deck: rails bound you
     if (hitCollider(x, z)) return true; const h = H(x, z);
     const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G); if (i < 1 || j < 1 || i >= NX || j >= NZ) return true;
     const surf = waterAt(x, z); if (surf !== null && seaLimit(x, z, h, surf)) return true;       // open sea / the berths stay off limits
@@ -1348,7 +1358,7 @@ export function createFoot({ scene, isle, MATS, OUT, low, atlas, uTime, uWaves,
     if (coveDeckAt(fx, fz) !== null && rise <= FOOT_SWIM.step) return false;                       // jetty -> sand
     const ux = (x - fx) / d, uz = (z - fz) / d, e = Math.max(d, 0.1), g = (h - H(x - ux * e, z - uz * e)) / e;   // [v105] uphill grade of the step you just took
     return g > WALK_RULES.slope; }
-  function whyBlocked(x, z, fx, fz) { const b = bridgeAt(x, z); if (b) return b.inside ? '' : 'rail';  // [v105] dev: reachability report
+  function whyBlocked(x, z, fx, fz) { const hb = highBridgeAt(x, z); if (hb) return hb.inside ? '' : 'rail'; const b = bridgeAt(x, z); if (b) return b.inside ? '' : 'rail';  // [v105] dev: reachability report
     if (hitCollider(x, z)) return 'prop'; const h = H(x, z);
     if (AREA_DECKS.length && areaDeckAt(x, z) !== null) return blocked(x, z, fx, fz) ? 'deck step' : '';
     const i = Math.round((x - X0) / G), j = Math.round((z - Z0) / G); if (i < 1 || j < 1 || i >= NX || j >= NZ) return 'edge';
@@ -1358,7 +1368,7 @@ export function createFoot({ scene, isle, MATS, OUT, low, atlas, uTime, uWaves,
     const q = INTERACT.find(q => q.id === id); if (q) q.used = false; } // [v122] a dug site fills back in: another map can point here
   function activate(q, t) { if (q.id.startsWith('dig')) { const d = digs.find(d => d.id === q.id); if (d && d.t < 0) { d.t = t; q.used = true; } return 'dig'; } return q.id; }
   const stats = { buildMs: BUILD_MS, chunks: chunks.length, trees: spots.trees.length, palms: spots.palms.length, ferns: spots.ferns.length, rocks: spots.rocks.length, torches: F.length, kitPieces: kitN, kitTris, kitTexBytes: kit ? kit.texBytes : 0, kitKtx2: kit ? kit.ktx2 : false, natPieces: natN, natTris, natTexBytes: nat ? nat.texBytes : 0, natKtx2: nat ? nat.ktx2 : false, cliffs: spots.cliffs.length, groups: groups.map(g => g.name), trailA: Math.round(pathLen(TRAILS.A)), trailB: Math.round(pathLen(TRAILS.B)), street: Math.round(Math.abs(STREET.z1 - STREET.z0)), texBytes: hTex.image.data.length };
-  return { areas, root, update, battery, lighthouses: lhs, H, groundAt, waterAt, blocked, whyBlocked, spots, nearInteract, activate, rearm, stats, pois: FOOT_POIS, digs, street, inland, IM, flames, lights, groups };
+  return { areas, root, update, battery, lighthouses: lhs, H, groundAt, waterAt, blocked, whyBlocked, setLayer, spots, nearInteract, activate, rearm, stats, pois: FOOT_POIS, digs, street, inland, IM, flames, lights, groups };
 }
 // ---------- 2D review map (canvas) ----------
 export function drawMap(cv, extraPois = []) {
diff --git a/js/onfoot/net.js b/js/onfoot/net.js
index 8449372..abb5184 100644
--- a/js/onfoot/net.js
+++ b/js/onfoot/net.js
@@ -56,7 +56,7 @@ export function createFootNet({ scene, low, world, docking, maxPeers = 3 }) {
       if (now - p.heard > 6000) { drop(id); docking.dropPeer(id); continue; }
       const k = Math.min(1, dt * 8); p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k; let d = p.tyaw - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * k;
       p.speed += ((p.tspeed || 0) - p.speed) * k;
-      if (!p.body) { p.body = newBody(); placeBody(p.body, world, p.x, p.z); } stepBody(p.body, world, p.x, p.z, dt, p.speed); bodyFX(fx, p.body, p.x, p.z, p.speed, dt); fx?.update();
+      if (!p.body) { p.body = newBody(); placeBody(p.body, world, p.x, p.z, world.layer ? 1e4 : null); } /* [roundabout-bridge] first seen on a high bridge's deck strip = up on the deck (the wire has no height; one under it drops down as they walk off the strip) */ stepBody(p.body, world, p.x, p.z, dt, p.speed); bodyFX(fx, p.body, p.x, p.z, p.speed, dt); fx?.update();
       if (p.jt && p.jt !== p.jtH) { p.jtH = p.jt; if (p.body.swim) jumpBody(p.body, 0); }   // [Raul swim-anim] they jumped in deep water: the surface kick here too
       const jh = p.jt && !p.body.swim && !p.body.hop ? jumpArc((now - p.jt) / 1000) : 0; if (p.jt && now - p.jt > 900) p.jt = 0;
       const st = poseBody(p.pirate.object, p.body, p.x, p.z, p.yaw, p.speed, now / 1000, jh); p.pirate.update(dt, p.speed, st);
```
