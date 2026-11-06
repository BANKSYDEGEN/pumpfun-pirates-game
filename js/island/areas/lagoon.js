// [island-rework] AREA 4: FRESHWATER LAGOON (central lake under the falls). Plan: docs/island_rework/PLAN.md §1.4
//   - fishing dock on the south shore: cast, wait for the bite, REEL IN in the window; 8 species -> fish journal (cosmetic, local)
//   - Grandpa Gill (NPC) at the dock: your journal + biggest catch; the fish market (gold) waits on BANKSY (flags.js)
//   - stepping stones round the west rim, through the waterfall into a hidden grotto: once-a-day chest + the first River Pearl
//   - River Pearls (6): one in the grotto, five rare catches. Reeds + lily pads instanced; dock / grotto / NPC lazy-built (index.js)
import * as THREE from 'three';
import { Kit, M, box, cyl, ball, hash, jitter, W, C, npc, openChest, store, today, instanced, sm } from './common.js';
import { AREA_GOLD_ON, PENDING } from './flags.js';
import { FISH2, createFishing2 } from './fishing2.js'; // [fish2] the new cast / bite / reel fight / catch show (&fish2=0 = the old prompt)
const LAKE = { x: -205, z: -130, r: 58, y: 20 };                          // = foot.js LAKE (the area reads it, never edits it)
const DOCK = { x: -205, z0: -63, z1: -97, hw: 1.6 };                       // south shore, out over the water (north = -z)
const GILL = { x: -199.5, z: -61.5 };
const GROTTO = { x0: -214, x1: -198, z0: -199, z1: -188, y: 21.0 };        // a notch cut into the falls cliff, behind the water sheet
const ENTRY = [-258, -158];                                                // west shore, where the stones start
export const FISH = [ // [id, name, weight, cm range, colour]
  ['minnow', 'Lagoon Minnow', 30, [6, 14], 0xc9d6df], ['perch', 'Mossy Perch', 24, [15, 32], 0x6f9a3a], ['snapper', 'Rainbow Snapper', 16, [20, 45], 0xff6b6b],
  ['eel', 'Spotted Eel', 12, [40, 110], 0x5a5a3a], ['pike', 'Pirate Pike', 9, [45, 95], 0x3a7a6a], ['carp', 'Golden Carp', 5, [30, 70], 0xffc93c],
  ['koi', 'Ghost Koi', 3, [35, 80], 0xf4f4ff], ['leviathan', 'Lagoon Leviathan', 1, [150, 260], 0x2a3a8a]];
const PEARLS = ['p_grotto', 'p1', 'p2', 'p3', 'p4', 'p5'];
let STONES = [], DOCK_Y = 21.6, GROTTO_STONE_Y = 20.7;
const st = { mode: 'idle', t0: 0, tb: 0, bob: null };                       // fishing state (one rod: yours)
let fs2 = null, _t2 = 0;                                                     // [fish2] the round-2 fishing (fishing2.js) while FISH2

export default {
  id: 'lagoon', name: 'Freshwater Lagoon', rect: [-295, -115, -265, -55],
  terrain: { pads: [[GROTTO.x0, GROTTO.x1, GROTTO.z0, GROTTO.z1, GROTTO.y]],
    paths: [{ id: 'fish_approach', pave: true, maxGrade: 0.32, hw: 3.4, pts: [
      [-260, -58.6], [-245, -59.5], [-230, -60.8], [-216, -62.0], [-205, -62.5],
    ]}] },
  register(h) {
    const { H } = h; DOCK_Y = Math.max(H(DOCK.x, DOCK.z0), LAKE.y + 1.3);
    h.addDeck({ id: 'lagoon_dock', x: DOCK.x, z: (DOCK.z0 + DOCK.z1) / 2, hw: DOCK.hw, hl: Math.abs(DOCK.z1 - DOCK.z0) / 2 + 0.5, yaw: 0, y: DOCK_Y });
    // stepping stones: shore -> radius 50 arc round the west / north rim -> through the falls -> the grotto
    const a0 = Math.atan2(ENTRY[1] - LAKE.z, ENTRY[0] - LAKE.x), a1 = Math.atan2(GROTTO.z1 - 1 - LAKE.z, (GROTTO.x0 + GROTTO.x1) / 2 - LAKE.x), R = 51.5, pts = [];
    const p0 = [LAKE.x + Math.cos(a0) * R, LAKE.z + Math.sin(a0) * R]; for (let d = 0; d < Math.hypot(p0[0] - ENTRY[0], p0[1] - ENTRY[1]); d += 2.2) { const u = d / Math.hypot(p0[0] - ENTRY[0], p0[1] - ENTRY[1]); pts.push([ENTRY[0] + (p0[0] - ENTRY[0]) * u, ENTRY[1] + (p0[1] - ENTRY[1]) * u]); }
    const n = Math.ceil(Math.abs(a1 - a0) * R / 2.2); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([LAKE.x + Math.cos(a) * R, LAKE.z + Math.sin(a) * R]); }
    const last = pts[pts.length - 1], gz = GROTTO.z1 - 1; for (let z = last[1] - 2.2; z > gz; z -= 2.2) pts.push([last[0], z]);
    const y0 = H(ENTRY[0], ENTRY[1]); STONES = pts.map(([x, z], i) => ({ x, z, r: 1.35, y: Math.max(GROTTO_STONE_Y, y0 - i * 0.3) }));
    for (let i = STONES.length - 4; i < STONES.length; i++) STONES[i].y = Math.min(GROTTO.y, STONES[i].y + (GROTTO.y - GROTTO_STONE_Y) * (i - STONES.length + 4) / 3);
    STONES.forEach((s, i) => h.addDeck({ id: 'lagoon_stone_' + i, x: s.x, z: s.z, r: s.r, y: s.y }));
    h.poi('lagoon_dock', "Grandpa Gill's fishing dock", DOCK.x, DOCK.z0, { clear: 14 });
    h.poi('lagoon_grotto', 'Grotto behind the falls', (GROTTO.x0 + GROTTO.x1) / 2, GROTTO.z0 + 4, { clear: 12 });
    h.poi('lagoon_stones', 'Stepping stones', ENTRY[0], ENTRY[1], { clear: 10 });
    h.addCirc(GILL.x, GILL.z, 0.6); h.addCirc(DOCK.x + 3.2, DOCK.z0 + 2.2, 0.7); // Gill + his barrels
    h.addCirc(-206, GROTTO.z0 + 2.2, 0.75);                                    // the grotto chest
    h.INTERACT.push({ id: 'lagoon_fish', area: 'lagoon', x: DOCK.x, z: DOCK.z1 + 1.2, r: 2.6, label: 'E · CAST' });
    h.INTERACT.push({ id: 'lagoon_gill', area: 'lagoon', x: GILL.x, z: GILL.z + 1.4, r: 2.6, label: 'E · GRANDPA GILL' });
    h.INTERACT.push({ id: 'lagoon_grotto', area: 'lagoon', x: -206, z: GROTTO.z0 + 4, r: 2.6, label: 'E · OPEN THE CHEST' });
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_lagoon'; far.name = 'area_lagoon_far';
    // dock: planks on posts, rails on one side, a ladder, barrels + rod rack at the root
    const L = Math.abs(DOCK.z1 - DOCK.z0), zc = (DOCK.z0 + DOCK.z1) / 2;
    for (let i = 0; i < Math.round(L / 0.9); i++) W(k, box(DOCK.hw * 2 + 0.2, 0.16, 0.82), i % 3 ? C.WOOD_L : C.WOOD, M(DOCK.x + (hash(i, 3) - 0.5) * 0.08, DOCK_Y - 0.08, DOCK.z0 - 0.45 - i * 0.9, (hash(i, 5) - 0.5) * 0.03), i % 4 === 0);
    for (let z = DOCK.z0 - 2; z >= DOCK.z1; z -= 4) for (const s of [-1, 1]) W(k, cyl(0.16, 0.18, DOCK_Y - LAKE.y + 3.5, 6), C.WOOD_D, M(DOCK.x + s * (DOCK.hw + 0.05), LAKE.y - 1.6 + (DOCK_Y - LAKE.y + 3.5) / 2 - 0.1, z));
    for (const s of [-1, 1]) W(k, box(0.12, 0.12, L - 3), C.WOOD_D, M(DOCK.x + s * (DOCK.hw + 0.05), DOCK_Y + 0.85, zc - 1.5)); // rails
    for (let z = DOCK.z0 - 2; z >= DOCK.z1 + 3; z -= 4) for (const s of [-1, 1]) W(k, box(0.14, 0.9, 0.14), C.WOOD_D, M(DOCK.x + s * (DOCK.hw + 0.05), DOCK_Y + 0.4, z));
    for (let i = 0; i < 4; i++) W(k, box(0.7, 0.08, 0.1), C.WOOD_D, M(DOCK.x + DOCK.hw + 0.4, DOCK_Y - 0.4 - i * 0.45, DOCK.z1 + 0.6), false);
    for (const [dx, dz, s] of [[3.2, 2.2, 1], [3.9, 1.0, 0.85], [-3.0, 1.6, 0.9]]) { const x = DOCK.x + dx, z = DOCK.z0 + dz, y = H(x, z); W(k, cyl(0.55 * s, 0.5 * s, 1.2 * s, 10), C.WOOD_L, M(x, y + 0.6 * s, z)); for (const yy of [0.25, 0.95]) W(k, cyl(0.57 * s, 0.57 * s, 0.08, 10), C.IRON, M(x, y + yy * s, z), false); }
    { const x = DOCK.x - 3.4, z = DOCK.z0 - 0.6, y = H(x, z); W(k, box(0.14, 2.2, 0.14), C.WOOD_D, M(x - 0.8, y + 1.1, z)); W(k, box(0.14, 2.2, 0.14), C.WOOD_D, M(x + 0.8, y + 1.1, z)); W(k, box(1.9, 0.12, 0.14), C.WOOD_D, M(x, y + 1.9, z));
      for (let i = 0; i < 3; i++) W(k, cyl(0.025, 0.035, 2.6, 4), C.WOOD_L, M(x - 0.5 + i * 0.5, y + 1.3, z + 0.15, 0, 0.15), false); }
    { const x = DOCK.x + 2.8, z = DOCK.z0 - 0.4, y = H(x, z); W(k, box(0.16, 2.6, 0.16), C.WOOD_D, M(x, y + 1.3, z)); W(k, box(1.7, 0.9, 0.12), C.WOOD_L, M(x, y + 2.3, z));            // FISHING sign: a fish on a board
      W(k, ball(0.32, 8, 5), 0x2a8ac0, M(x - 0.1, y + 2.3, z + 0.1, 0, 0, 0, [1.4, 0.7, 0.4]), false); W(k, cyl(0.0, 0.26, 0.4, 3), 0x2a8ac0, M(x + 0.48, y + 2.3, z + 0.1, 0, 0, Math.PI / 2), false); }
    // a little rowboat tied to the dock
    { const x = DOCK.x - 3.4, z = DOCK.z1 + 6, y = LAKE.y; W(k, box(1.4, 0.5, 3.6), C.WOOD, M(x, y + 0.1, z)); W(k, box(1.1, 0.1, 3.2), C.WOOD_D, M(x, y + 0.32, z), false); W(k, box(1.4, 0.12, 0.3), C.WOOD_L, M(x, y + 0.45, z), false);
      W(k, cyl(0.22, 0.7, 0.5, 4), C.WOOD, M(x, y + 0.1, z - 2.0, Math.PI / 4, -Math.PI / 2), false); }
    // Grandpa Gill: straw hat, white beard, rod
    k.at(M(GILL.x, H(GILL.x, GILL.z), GILL.z, Math.PI * 0.15), () => { npc(k, { shirt: 0x3a7ab8, pants: 0x4a3a2a, beard: C.WHITE, hat: 'straw', prop: 'rod' }); W(k, box(0.6, 0.45, 0.6), C.WOOD, M(-0.9, 0.22, -0.4)); });
    // stepping stones (flat-topped chunky rocks)
    STONES.forEach((s, i) => { const g = jitter(cyl(s.r, s.r * 1.15, 1, 7), 0.12, i); W(k, g, i % 2 ? C.STONE : 0xa8a196, M(s.x, s.y - 0.5, s.z, hash(i, 2) * 6), true);
      W(k, cyl(s.r * 1.2, s.r * 1.35, s.y - LAKE.y + 2.0, 7), C.STONE_D, M(s.x, LAKE.y - 2 + (s.y - LAKE.y + 2) / 2 - 1, s.z), false); if (i % 3 === 0) W(k, box(s.r * 0.9, 0.06, s.r * 0.7), C.MOSS, M(s.x + 0.2, s.y + 0.02, s.z, i), false); });
    // grotto: dark back wall + roof lip, crystals, a lantern, glow mushrooms, the pearl clam
    { const gx = (GROTTO.x0 + GROTTO.x1) / 2, y = GROTTO.y;
      W(k, box(GROTTO.x1 - GROTTO.x0 + 1, 7, 1.2), 0x3a3631, M(gx, y + 3.4, GROTTO.z0 - 0.4)); W(k, box(GROTTO.x1 - GROTTO.x0 + 2, 1.4, GROTTO.z1 - GROTTO.z0 + 1), 0x6d665c, M(gx, y + 6.6, (GROTTO.z0 + GROTTO.z1) / 2 - 0.5));
      for (const s of [-1, 1]) W(k, box(1.2, 7, GROTTO.z1 - GROTTO.z0 + 1), 0x57514a, M(s < 0 ? GROTTO.x0 - 0.2 : GROTTO.x1 + 0.2, y + 3.4, (GROTTO.z0 + GROTTO.z1) / 2));
      for (let i = 0; i < 7; i++) { const x = GROTTO.x0 + 1.5 + hash(i, 9) * (GROTTO.x1 - GROTTO.x0 - 3), z = GROTTO.z0 + 0.6 + hash(i, 4) * 1.5; W(k, cyl(0, 0.28 + hash(i, 1) * 0.2, 0.9 + hash(i, 2) * 0.9, 5), i % 2 ? 0x7ee0ff : 0xb98cff, M(x, y + 0.4, z, i, (hash(i, 3) - 0.5) * 0.5), false); }
      W(k, cyl(0.05, 0.05, 1.2, 4), C.IRON, M(gx + 3.6, y + 1.8, GROTTO.z0 + 0.4), false); W(k, box(0.36, 0.5, 0.36), 0xffd27a, M(gx + 3.6, y + 1.05, GROTTO.z0 + 0.5), false);
      for (let i = 0; i < 5; i++) { const x = gx - 5 + i * 1.1, z = GROTTO.z0 + 1.2 + hash(i, 6); W(k, cyl(0.04, 0.05, 0.25, 4), C.WHITE, M(x, y + 0.12, z), false); W(k, ball(0.16, 6, 3), 0x9bffb0, M(x, y + 0.28, z, 0, 0, 0, [1, 0.5, 1]), false); }
      W(k, ball(0.5, 8, 4), 0xd9c2a8, M(gx - 3.2, y + 0.2, GROTTO.z0 + 1.6, 0, 0, 0, [1, 0.45, 0.8])); }
    const g = k.build(MATS, OUT); near.add(g);
    // chest (animated lid) in the grotto; opened today -> open
    const ch = openChest(MATS, OUT, { c: 0x3a6a8a, band: C.GOLD }); ch.grp.position.set(-206, GROTTO.y, GROTTO.z0 + 2.2); near.add(ch.grp); if ((store.get().chests || {}).lagoon_grotto === today()) ch.open(-10);
    // reeds round the rim + lily pads on the water (instanced, near set only)
    const reeds = [], pads = []; const avoid = (x, z) => Math.hypot(x - DOCK.x, z - DOCK.z0) < 7 || Math.hypot(x - ENTRY[0], z - ENTRY[1]) < 6 || STONES.some(s => Math.hypot(x - s.x, z - s.z) < 2.6);
    for (let i = 0; i < (low ? 110 : 260); i++) { const a = hash(i, 11) * Math.PI * 2, r = LAKE.r - 4 + hash(i, 12) * 7, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r, y = H(x, z);
      if (y > LAKE.y + 3.5 || y < LAKE.y - 1.35 || Math.hypot(x - (LAKE.x + 53), z - (LAKE.z + 21)) < 25 || avoid(x, z)) continue; const s = 0.7 + hash(i, 13) * 0.8; reeds.push(new THREE.Matrix4().compose(new THREE.Vector3(x, Math.max(y, LAKE.y - 0.3), z), new THREE.Quaternion().setFromEuler(new THREE.Euler((hash(i, 14) - 0.5) * 0.3, a, (hash(i, 15) - 0.5) * 0.3)), new THREE.Vector3(s, s, s))); }
    for (let i = 0; i < (low ? 24 : 48); i++) { const a = hash(i, 21) * Math.PI * 2, r = 12 + hash(i, 22) * 34, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r; if (avoid(x, z) || (Math.abs(x - DOCK.x) < 5 && z > DOCK.z1 - 10)) continue;
      const s = 0.7 + hash(i, 23) * 0.7; pads.push(new THREE.Matrix4().compose(new THREE.Vector3(x, LAKE.y + 0.06, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a * 3), new THREE.Vector3(s, 1, s))); }
    near.add(instanced(MATS, OUT, (q) => { for (let j = 0; j < 4; j++) W(q, cyl(0.03, 0.06, 1.8 + j * 0.25, 4), j % 2 ? C.REED : C.REED_D, M((j - 1.5) * 0.15, 0.9 + j * 0.12, (j % 2) * 0.1, 0, (j - 1.5) * 0.1), false); W(q, cyl(0.07, 0.07, 0.35, 5), 0x6b4527, M(0.15, 2.2, 0), false); }, reeds, 'lagoon_reeds'));
    near.add(instanced(MATS, OUT, (q) => { W(q, cyl(0.6, 0.6, 0.04, 8, 1), 0x3f9a3a, M(0, 0, 0), false); W(q, cyl(0.12, 0.12, 0.06, 6), 0xff9ad0, M(0.25, 0.04, 0.1), false); }, pads, 'lagoon_pads'));
    // the bobber (shown while fishing)
    const bob = new THREE.Group(); { const kb = new Kit(); W(kb, ball(0.16, 8, 5), C.RED, M(0, 0.1, 0), false); W(kb, ball(0.15, 8, 5), C.WHITE, M(0, -0.04, 0), false); W(kb, cyl(0.02, 0.02, 0.3, 3), C.IRON, M(0, 0.32, 0), false); bob.add(kb.build(MATS, OUT)); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false })); ring.rotation.x = -Math.PI / 2; bob.add(ring);
    bob.visible = false; near.add(bob); st.bob = bob; st.ring = ring;
    if (FISH2) fs2 = createFishing2({ MATS, OUT, near, lakeY: LAKE.y, dockY: DOCK_Y, dock: DOCK, journal: JOURNAL }); // [fish2]
    // far impostor: dock deck strip + Gill box + the stones row (one small merged mesh)
    const kf = new Kit(); W(kf, box(DOCK.hw * 2, 0.3, L), C.WOOD, M(DOCK.x, DOCK_Y - 0.15, zc), false); STONES.forEach((s, i) => { if (i % 2 === 0) W(kf, cyl(s.r, s.r, 0.8, 5), C.STONE, M(s.x, s.y - 0.4, s.z), false); });
    W(kf, box(GROTTO.x1 - GROTTO.x0, 7, 1.2), 0x3a3631, M((GROTTO.x0 + GROTTO.x1) / 2, GROTTO.y + 3.4, GROTTO.z0 - 0.4), false); far.add(kf.build(MATS, OUT));
    return { near, far, chest: ch, tick(t) { ch.tick(t); if (fs2) { fs2.tick(t, Math.min(0.1, Math.max(0, t - _t2))); _t2 = t; } else fishTick(t); } };
  },
  label(q) { if (q.id === 'lagoon_fish' && fs2) return fs2.label(); if (q.id === 'lagoon_fish') return st.mode === 'bite' ? 'REEL IN!' : st.mode === 'wait' ? 'WAIT FOR THE BITE…' : 'CAST YOUR LINE'; if (q.id === 'lagoon_grotto') return (store.get().chests || {}).lagoon_grotto === today() ? 'GROTTO CHEST · OPENED TODAY' : 'OPEN THE GROTTO CHEST'; return null; },
  activate(q, t, api, b) {
    if (q.id === 'lagoon_fish') return fs2 ? fs2.press(t) : fish(t);
    if (q.id === 'lagoon_gill') { const s = store.get(), j = s.fish || {}, n = Object.keys(j).length, big = Object.entries(j).sort((a, b) => b[1].cm - a[1].cm)[0], pearls = (s.pearls || []).length;
      return `GRANDPA GILL<br><small>"${n ? 'Not bad, young pirate!' : 'Grab the rod at the end of my dock, cast, and REEL IN when the float dips!'}"<br>FISH JOURNAL ${n}/${FISH.length} · RIVER PEARLS ${pearls}/${PEARLS.length}${big ? `<br>biggest: ${FISH.find(f => f[0] === big[0])[1]} ${big[1].cm} cm` : ''}<br>${AREA_GOLD_ON ? '' : 'the fish market opens soon'}</small>`; }
    if (q.id === 'lagoon_grotto') { const s = store.get(); if ((s.chests || {}).lagoon_grotto === today()) return 'THE CHEST IS EMPTY<br><small>it refills tomorrow</small>';
      b?.chest.open(t); let pearl = false; store.upd(o => { (o.chests = o.chests || {}).lagoon_grotto = today(); o.pearls = o.pearls || []; if (!o.pearls.includes('p_grotto')) { o.pearls.push('p_grotto'); pearl = true; } }); if (pearl) window.dispatchEvent?.(new CustomEvent('pfp-find', { detail: { item: 'val:river_pearl', spot: 'lagoon_p_grotto' } })); // [inventory]
      return `HIDDEN GROTTO CHEST!<br>${pearl ? '<small>you found a RIVER PEARL · ' + store.get().pearls.length + '/' + PEARLS.length + '</small><br>' : ''}${PENDING}`; }
    return null;
  },
  onPlayer(p, t, api) { if (fs2) { const me = api?.me?.(); fs2.player(me ? { x: p[0], z: p[1], y: me.y, yaw: me.yaw } : { x: p[0], z: p[1], y: DOCK_Y, yaw: Math.PI }, api); if (Math.hypot(p[0] - DOCK.x, p[1] - DOCK.z1) > 6) fs2.leave(); return; }
    if (st.mode !== 'idle' && Math.hypot(p[0] - DOCK.x, p[1] - DOCK.z1) > 6) { st.mode = 'idle'; if (st.bob) st.bob.visible = false; } },
};
let _now = 0;
function fishTick(t) { _now = t; const b = st.bob; if (!b) return;
  if (st.mode === 'idle') { b.visible = false; return; }
  b.visible = true; const u = t - st.t0, x = DOCK.x + Math.sin(st.t0 * 3.1) * 2.5, z = DOCK.z1 - 7 - Math.cos(st.t0 * 1.7) * 2, fly = Math.min(1, u / 0.7);
  b.position.set(DOCK.x + (x - DOCK.x) * fly, LAKE.y + 0.05 + Math.sin(fly * Math.PI) * 3 + (st.mode === 'bite' ? -0.18 - 0.1 * Math.sin(t * 30) : 0.04 * Math.sin(t * 2.4)), DOCK.z1 + (z - DOCK.z1) * fly);
  if (st.mode === 'wait' && t >= st.tb) st.mode = 'bite';
  if (st.mode === 'bite' && t > st.tb + 1.9) { st.mode = 'wait'; st.tb = t + 2 + hash(t, 4) * 4; st.miss = (st.miss || 0) + 1; }
  st.ring.material.opacity = st.mode === 'bite' ? 0.8 * (1 - ((t * 2) % 1)) : 0; st.ring.scale.setScalar(st.mode === 'bite' ? 1 + ((t * 2) % 1) * 2.5 : 1); }
function fish(t) {
  if (st.mode === 'idle') { st.mode = 'wait'; st.t0 = t; st.tb = t + 2.5 + Math.random() * 3.5; st.miss = 0; return 'SPLASH!<br><small>watch the float · REEL IN when it dips</small>'; }
  if (st.mode === 'wait') { if (t - st.t0 < 0.8) return null; st.mode = 'idle'; return (st.miss ? 'IT GOT AWAY' : 'TOO EARLY') + '<br><small>wait for the float to dip, then reel in</small>'; }
  // a bite: roll the catch (cosmetic: the fish journal)
  st.mode = 'idle'; let r = Math.random() * FISH.reduce((a, f) => a + f[2], 0), f = FISH[0]; for (const x of FISH) { r -= x[2]; if (r <= 0) { f = x; break; } }
  const cm = Math.round(f[3][0] + Math.random() ** 1.6 * (f[3][1] - f[3][0])); let isNew = false, rec = false, pearl = null;
  store.upd(o => { o.fish = o.fish || {}; const e = o.fish[f[0]]; isNew = !e; rec = !!e && cm > e.cm; if (!e || cm > e.cm) o.fish[f[0]] = { cm, at: today() }; o.caught = (o.caught || 0) + 1;
    o.pearls = o.pearls || []; if (Math.random() < 0.04) { const p = PEARLS.slice(1).find(id => !o.pearls.includes(id)); if (p) { o.pearls.push(p); pearl = p; } } }); window.dispatchEvent?.(new CustomEvent('pfp-catch')); if (pearl) window.dispatchEvent?.(new CustomEvent('pfp-find', { detail: { item: 'val:river_pearl', spot: 'lagoon_' + pearl } })); // [inventory] the SERVER rolls the fish that goes in your bag
  const s = store.get(); return `${f[2] <= 3 ? 'WHOA! ' : ''}${f[1].toUpperCase()} · ${cm} cm<br><small>${isNew ? 'NEW in your fish journal · ' : rec ? 'a new record! · ' : ''}journal ${Object.keys(s.fish).length}/${FISH.length}${pearl ? '<br>…and a RIVER PEARL! ' + s.pearls.length + '/' + PEARLS.length : ''}</small>`;
}
// [fish2] the fish journal (local, cosmetic) for a SERVER-rolled catch, + the old 4 % river pearl; localRoll = offline only (not in the bag)
const JOURNAL = {
  add(c) { let isNew = false, rec = false, pearl = null; store.upd(o => { o.fish = o.fish || {}; const e = o.fish[c.id]; isNew = !e; rec = !!e && c.cm > e.cm; if (!e || c.cm > e.cm) o.fish[c.id] = { cm: c.cm, at: today() }; o.caught = (o.caught || 0) + 1;
      o.pearls = o.pearls || []; if (Math.random() < 0.04) { const p = PEARLS.slice(1).find(id => !o.pearls.includes(id)); if (p) { o.pearls.push(p); pearl = p; } } });
    if (pearl) window.dispatchEvent?.(new CustomEvent('pfp-find', { detail: { item: 'val:river_pearl', spot: 'lagoon_' + pearl } }));
    const s = store.get(); return { isNew, rec, pearl, n: Object.keys(s.fish || {}).length, of: FISH.length }; },
  localRoll() { let r = Math.random() * FISH.reduce((a, f) => a + f[2], 0), f = FISH[0]; for (const x of FISH) { r -= x[2]; if (r <= 0) { f = x; break; } }
    return { id: f[0], cm: Math.round(f[3][0] + Math.random() ** 1.6 * (f[3][1] - f[3][0])) }; },
};
export const _fishState = st; // tests
export const _fish2 = () => fs2; // tests / shots
// [dock-ladders] Grandpa Gill's dock + its swim ladder for js/dock/ladders.js (DOCK_Y is set when the area registers: the dock top)
export const LAGOON_DOCK = DOCK; export const lagoonDockY = () => DOCK_Y;
export const LAGOON_LADDER = { x: DOCK.x + DOCK.hw + 0.4, z: DOCK.z1 + 0.6, out: [1, 0] }; // = the rungs drawn in build() (x DOCK.x + hw + 0.4, z DOCK.z1 + 0.6)
