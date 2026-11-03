// [island-rework] AREA 1: JUNGLE TRAIL & RUINS (north highlands). Plan: docs/island_rework/PLAN.md §1.1
//   - the jungle trail starts EXACTLY at JUNGLE_TRAILHEAD (js/island/digSpots.js, locked for Timothy's plaza path) and winds north-east
//   - a vine-covered temple cut into the hillside: collapsed arch, TRAP RUN (dart walls, swinging log, crumbling floor tiles), altar + Ruin Chest
//   - 3 hidden chests (moss curtain, toppled idol head, the high ledge above the altar), 7 IDOL SHARDS -> Golden Idol (cosmetic)
//   - Old Mossbeard (NPC) at the trailhead: "The Lost Expedition" (4 journal pages along the trail)
//   Everything cosmetic / local; chest gold waits on BANKSY (flags.js). Meshes lazy-built + culled by js/island/areas/index.js.
import * as THREE from 'three';
import { Kit, M, box, cyl, ball, hash, jitter, W, C, npc, openChest, store, today, instanced, sm } from './common.js';
import { PENDING } from './flags.js';
import { JUNGLE_TRAILHEAD as TH } from '../digSpots.js';
const TEMPLE = { x0: 25, x1: 65, z0: -472, z1: -436, y: 30 };              // pad (cut into the hill on the north side, ramped on the south)
const RUN = { x: 45, z0: -441, z1: -463, hw: 2.1 };                          // the trap corridor (north = -z)
const DARTS = { z: -446 }, LOG = { z: -452 }, TILES = [-457, -460];          // trap rows
const ALTAR = { x: 45, z: -467 };
const MOSS = [-30.5 + 2, 0];                                                 // (unused placeholder)
const PATH = [[TH.x, TH.z], [TH.x + TH.heading.dx * 6, TH.z + TH.heading.dz * 6], [16, -404], [17, -414], [24, -423], [33, -429], [41, -433], [45, -437]];
const MB = { x: TH.x + 2.5, z: TH.z + 5.5 };                              // Old Mossbeard: just off the trail (south side), his lean-to west of him
const SHARDS = [[24, -423.5], [58, -440], [30, -466], [52, -466.5], [95, -335], [140, -312], [62, -481]];
const PAGES = [[17, -413], [70, -455], [120, -342], [44, -482]];
const HIDDEN = [{ id: 'j_moss', x: 61.5, z: -469, label: 'BEHIND THE MOSS CURTAIN' }, { id: 'j_idol', x: 18, z: -436, label: 'UNDER THE TOPPLED IDOL' }, { id: 'j_ledge', x: 45, z: -479, label: 'THE HIGH LEDGE' }];
const IDOL_HEAD = { x: 16, z: -440 };
const trap = { start: [RUN.x, RUN.z0 + 1.2], last: -1, fake: [] };
const dayHash = () => { const d = today(); let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };

export default {
  id: 'jungle_ruins', name: 'Jungle Trail & Ruins', rect: [0, 260, -490, -215],
  terrain: { pads: [[TEMPLE.x0, TEMPLE.x1, TEMPLE.z0, TEMPLE.z1, TEMPLE.y, 7]], paths: [{ id: 'jungle_trail', pts: PATH }] },
  register(h) {
    const { H } = h;
    h.poi('jungle_trailhead', 'Jungle trailhead', TH.x, TH.z, { clear: 9 });
    h.poi('jungle_temple', 'Jungle temple ruins', (TEMPLE.x0 + TEMPLE.x1) / 2, (TEMPLE.z0 + TEMPLE.z1) / 2, { clear: 30 });
    h.poi('jungle_ledge', 'High ledge', HIDDEN[2].x, HIDDEN[2].z, { clear: 8 });
    // temple walls (colliders): back wall (north, cut face), side walls, corridor walls with the dart holes, the arch pillars
    h.addBox(45, TEMPLE.z0 + 0.8, 40, 1.6, 0); for (const x of [TEMPLE.x0 + 0.8, TEMPLE.x1 - 0.8]) h.addBox(x, (TEMPLE.z0 + TEMPLE.z1) / 2, 1.6, TEMPLE.z1 - TEMPLE.z0, 0);
    for (const s of [-1, 1]) h.addBox(RUN.x + s * (RUN.hw + 0.6), (RUN.z0 + RUN.z1) / 2, 1.2, Math.abs(RUN.z1 - RUN.z0), 0);
    for (const s of [-1, 1]) h.addCirc(45 + s * 3.6, TEMPLE.z1 - 1, 0.9);
    h.addBox(ALTAR.x, ALTAR.z - 1.6, 4, 1.4, 0); h.addCirc(IDOL_HEAD.x, IDOL_HEAD.z, 2.2); h.addCirc(MB.x, MB.z, 0.6);
    h.INTERACT.push({ id: 'jungle_mossbeard', area: 'jungle_ruins', x: MB.x + 0.8, z: MB.z - 1.2, r: 2.6, label: 'E · OLD MOSSBEARD' });
    h.INTERACT.push({ id: 'jungle_ruin_chest', area: 'jungle_ruins', x: ALTAR.x, z: ALTAR.z + 0.4, r: 2.4, label: 'E · RUIN CHEST' });
    for (const c of HIDDEN) h.INTERACT.push({ id: c.id, area: 'jungle_ruins', x: c.x, z: c.z + 1.0, r: 2.2, label: 'E · ' + c.label });
    SHARDS.forEach(([x, z], i) => h.INTERACT.push({ id: 'jungle_shard_' + i, area: 'jungle_ruins', x, z, r: 1.8, label: 'E · IDOL SHARD' }));
    PAGES.forEach(([x, z], i) => h.INTERACT.push({ id: 'jungle_page_' + i, area: 'jungle_ruins', x, z, r: 1.8, label: 'E · JOURNAL PAGE' }));
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_jungle'; far.name = 'area_jungle_far';
    const y = TEMPLE.y, cx = (TEMPLE.x0 + TEMPLE.x1) / 2, St = (i) => (i % 3 === 0 ? 0xa9a294 : i % 3 === 1 ? C.STONE : 0x9e978a);
    const vine = (x, yy, z, len, yaw = 0) => { for (let i = 0; i < len; i += 0.6) W(k, box(0.28, 0.62, 0.12), i % 1.2 ? C.VINE : 0x3fa648, M(x + Math.sin(i * 3) * 0.12, yy - i, z, yaw), false); };
    // floor: big cracked flagstones
    for (let i = 0; i < 10; i++) for (let j = 0; j < 9; j++) { const x = TEMPLE.x0 + 2 + i * 3.9, z = TEMPLE.z0 + 2 + j * 3.9; if (Math.abs(x - RUN.x) < RUN.hw + 1.2 && z > RUN.z1 && z < RUN.z0) continue;
      W(k, box(3.7, 0.3, 3.7), (i + j) % 2 ? 0xc2b9a6 : 0xb3aa98, M(x + (hash(i, j) - 0.5) * 0.2, y - 0.1 + hash(j, i) * 0.06, z, (hash(i, j) - 0.5) * 0.04), false); }
    // back wall (cut into the hill) with stepped blocks + vines, side walls, broken tops
    for (let i = 0; i < 10; i++) { const x = TEMPLE.x0 + 2 + i * 4, hh = 6 + hash(i, 1) * 4; W(k, box(4.1, hh, 1.8), St(i), M(x, y + hh / 2, TEMPLE.z0 + 0.8)); if (i % 2) vine(x - 1, y + hh, TEMPLE.z0 + 1.8, 2 + hash(i, 2) * 3); }
    for (const sx of [TEMPLE.x0 + 0.8, TEMPLE.x1 - 0.8]) for (let j = 0; j < 9; j++) { const z = TEMPLE.z0 + 2 + j * 4, hh = 2.5 + hash(j, sx) * 3.5; W(k, box(1.7, hh, 4.1), St(j), M(sx, y + hh / 2, z)); if (j % 3 === 1) vine(sx + (sx < cx ? 0.95 : -0.95), y + hh, z, hh * 0.8, Math.PI / 2); }
    // the stepped pyramid shrine behind the altar
    for (let s = 0; s < 4; s++) W(k, box(14 - s * 3, 1.6, 6 - s * 1.2), St(s), M(cx, y + 0.8 + s * 1.6, TEMPLE.z0 + 4.5 - s * 0.3));
    W(k, box(3, 3, 2.4), 0x3a3631, M(cx, y + 6.8, TEMPLE.z0 + 5.4), false);                       // shrine doorway (dark)
    // collapsed arch at the entrance (one pillar whole, one broken, lintel fallen across the ground)
    W(k, box(1.8, 7, 1.8), C.STONE, M(cx - 3.6, y + 3.5, TEMPLE.z1 - 1)); W(k, box(1.8, 3.6, 1.8), 0xa9a294, M(cx + 3.6, y + 1.8, TEMPLE.z1 - 1));
    W(k, box(9, 1.4, 1.6), C.STONE_D, M(cx - 0.5, y + 7.6, TEMPLE.z1 - 1, 0, 0, -0.08)); W(k, box(4, 1.2, 1.5), C.STONE_D, M(cx + 6.5, H(cx + 6.5, TEMPLE.z1 + 1.5) + 0.5, TEMPLE.z1 + 1.5, 0.5, 0, 0.2));
    vine(cx - 3.6, y + 7, TEMPLE.z1 - 0.1, 5); vine(cx + 1.5, y + 7.2, TEMPLE.z1 - 0.1, 3.5);
    // trap corridor: low walls with dart holes, warning skulls, the log beam frame, the tiles
    for (const s of [-1, 1]) { const x = RUN.x + s * (RUN.hw + 0.6); W(k, box(1.2, 3.2, Math.abs(RUN.z1 - RUN.z0)), St(s + 2), M(x, y + 1.6, (RUN.z0 + RUN.z1) / 2));
      for (let i = 0; i < 4; i++) W(k, box(0.06, 0.18, 0.18), 0x1a1a1a, M(x - s * 0.62, y + 0.8 + i * 0.45, DARTS.z), false);
      W(k, ball(0.3, 7, 5), C.WHITE, M(x, y + 3.5, RUN.z0 - 0.5), false); }
    W(k, box(RUN.hw * 2 + 3, 0.5, 0.5), C.WOOD_D, M(RUN.x, y + 5.8, LOG.z)); for (const s of [-1, 1]) W(k, box(0.5, 2.8, 0.5), C.WOOD_D, M(RUN.x + s * (RUN.hw + 1.2), y + 4.4, LOG.z), false);
    // altar + idol pedestal
    W(k, box(4, 1.2, 1.8), 0x9e978a, M(ALTAR.x, y + 0.6, ALTAR.z - 1.6)); W(k, box(3.2, 0.3, 1.4), C.GOLD, M(ALTAR.x, y + 1.25, ALTAR.z - 1.6), false);
    W(k, cyl(0.5, 0.6, 1.4, 6), C.STONE, M(ALTAR.x - 3, y + 0.7, ALTAR.z - 1.6)); W(k, cyl(0.5, 0.6, 1.4, 6), C.STONE, M(ALTAR.x + 3, y + 0.7, ALTAR.z - 1.6));
    // broken columns + rubble round the courtyard
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = cx + Math.cos(a) * 14, z = (TEMPLE.z0 + TEMPLE.z1) / 2 + Math.sin(a) * 11; if (Math.abs(x - RUN.x) < 5) continue; const hh = 1.5 + hash(i, 7) * 4;
      W(k, cyl(0.7, 0.8, hh, 8), St(i), M(x, y + hh / 2, z)); if (i % 2) W(k, jitter(new THREE.IcosahedronGeometry(0.7, 0), 0.2, i), C.STONE_D, M(x + 1.4, y + 0.3, z + 0.8), false); }
    // the toppled idol head (hidden chest under its chin) + Mossbeard's camp at the trailhead + the signpost
    { const yy = H(IDOL_HEAD.x, IDOL_HEAD.z); k.at(M(IDOL_HEAD.x, yy + 1.2, IDOL_HEAD.z, 0.6, 0, 1.2), () => { W(k, box(2.8, 3.2, 2.6), 0xa39c8e, M(0, 0, 0)); W(k, box(2.9, 0.6, 0.8), 0x7d766e, M(0, 0.4, 1.3), false);
      for (const s of [-1, 1]) W(k, box(0.6, 0.4, 0.2), 0x3a3631, M(s * 0.7, 0.6, 1.35), false); W(k, box(1.4, 0.3, 0.3), 0x3a3631, M(0, -0.7, 1.35), false); vine(0.8, 1.6, 1.2, 2); }); }
    { const yy = H(MB.x, MB.z); k.at(M(MB.x, yy, MB.z, Math.PI * 0.7), () => npc(k, { shirt: 0x4a7a3a, pants: 0x5a4a32, beard: 0x8fae6a, hat: 'tricorn', hatC: 0x3a5a2a, prop: 'staff' }));
      const hx = MB.x - 3.5, hz = MB.z + 2.5, hy = H(hx, hz); W(k, box(0.2, 2.6, 0.2), C.WOOD_D, M(hx - 1.5, hy + 1.3, hz)); W(k, box(0.2, 2.6, 0.2), C.WOOD_D, M(hx + 1.5, hy + 1.3, hz));
      W(k, box(3.6, 0.15, 2.6), 0x6f9a3a, M(hx, hy + 2.0, hz + 0.9, 0, 0.5)); W(k, box(1.6, 0.8, 0.9), C.WOOD, M(hx, hy + 0.4, hz + 0.6)); W(k, box(1.2, 0.04, 0.7), C.CLOTH, M(hx, hy + 0.82, hz + 0.6), false); }
    { const sx = TH.x - 1, sz = TH.z - 3.2, sy = H(sx, sz); W(k, box(0.18, 2.4, 0.18), C.WOOD_D, M(sx, sy + 1.2, sz)); W(k, box(1.8, 0.45, 0.1), C.WOOD_L, M(sx + 0.6, sy + 2.0, sz, -Math.atan2(TH.heading.dz, TH.heading.dx)));
      W(k, cyl(0, 0.3, 0.5, 3), C.WOOD_L, M(sx + 1.6, sy + 2.0, sz, 0, 0, -Math.PI / 2), false); }
    // trail edging stones + jungle torches along the new trail
    for (let i = 1; i < PATH.length - 1; i++) { const [x, z] = PATH[i]; for (const s of [-1, 1]) { const ex = x + s * 3.2, ez = z + s * 1.2; W(k, jitter(new THREE.IcosahedronGeometry(0.45, 0), 0.25, i * s), C.STONE_D, M(ex, H(ex, ez) + 0.1, ez), false); } }
    // the high ledge: a ruined lookout plinth above the altar
    { const x = HIDDEN[2].x, z = HIDDEN[2].z - 2.5, yy = H(x, z); W(k, box(4, 1.2, 3), C.STONE, M(x, yy + 0.4, z)); vine(x + 1.6, yy + 1, z + 1.6, 1.5); }
    // moss curtain in the NE corner (walk through it)
    for (let i = 0; i < 7; i++) W(k, box(0.35, 3.6 - hash(i, 3), 0.1), i % 2 ? C.VINE : C.MOSS, M(HIDDEN[0].x - 1.8 + i * 0.6, y + 2.0, HIDDEN[0].z + 2.4), false);
    near.add(k.build(MATS, OUT));
    // animated bits: swinging log, darts, crumbling tiles (small separate meshes), chests, shards, pages
    const kl = new Kit(); W(kl, cyl(0.45, 0.45, RUN.hw * 2 - 0.4, 8), C.WOOD, M(0, -4.0, 0, 0, 0, Math.PI / 2)); for (const s of [-1, 1]) W(kl, cyl(0.05, 0.05, 4, 3), 0x8a6a3a, M(s * 0.9, -2.0, 0), false);
    const logG = new THREE.Group(); logG.add(kl.build(MATS, OUT)); logG.position.set(RUN.x, y + 5.8, LOG.z); near.add(logG);
    const kd = new Kit(); for (let i = 0; i < 4; i++) W(kd, box(0.6, 0.05, 0.05), 0x2b2f36, M(0, 0.8 + i * 0.45, 0), false); const dartG = new THREE.Group(); dartG.add(kd.build(MATS, OUT)); dartG.visible = false; near.add(dartG);
    const tiles = []; for (const tz of TILES) for (const s of [-1, 1]) { const kt = new Kit(); W(kt, box(RUN.hw - 0.1, 0.3, 2.8), 0xb7ad97, M(0, -0.15, 0)); const g = new THREE.Group(); g.add(kt.build(MATS, OUT)); g.position.set(RUN.x + s * RUN.hw / 2, y, tz); near.add(g); tiles.push({ g, z: tz, s, t: -1 }); }
    const chests = {}; const rc = openChest(MATS, OUT, { c: 0x8a6a3a, band: C.GOLD, s: 1.1 }); rc.grp.position.set(ALTAR.x, y + 1.4, ALTAR.z - 1.6); near.add(rc.grp); chests.jungle_ruin_chest = rc;
    for (const c of HIDDEN) { const ch = openChest(MATS, OUT, { c: 0x6b4527, band: 0xb0b0b0, s: 0.8 }); ch.grp.position.set(c.x, H(c.x, c.z) + (c.id === 'j_ledge' ? 0 : 0), c.z); near.add(ch.grp); chests[c.id] = ch; }
    const sv = store.get(); for (const [id, ch] of Object.entries(chests)) if ((sv.chests || {})[id] === today()) ch.open(-10);
    const shardM = SHARDS.map(([x, z]) => new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, z) + 1.1, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    const shards = instanced(MATS, OUT, (q) => { W(q, new THREE.OctahedronGeometry(0.35, 0), C.GOLD, M(0, 0, 0, 0, 0, 0, [1, 1.6, 1]), false); }, shardM, 'jungle_shards'); near.add(shards);
    const pageM = PAGES.map(([x, z], i) => new THREE.Matrix4().compose(new THREE.Vector3(x, H(x, z) + 0.05, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(1, 1, 1)));
    const pages = instanced(MATS, OUT, (q) => { W(q, box(0.5, 0.03, 0.65), C.CLOTH, M(0, 0.02, 0), false); W(q, box(0.4, 0.035, 0.05), 0x8a4a2a, M(0, 0.03, 0.15), false); W(q, cyl(0.06, 0.06, 0.6, 5), C.WOOD_D, M(0.3, 0.3, 0), false); }, pageM, 'jungle_pages'); near.add(pages);
    const hideInst = (grp, i, show, m) => grp.children.forEach(im => { const mm = m.clone(); if (!show) mm.scale(new THREE.Vector3(0, 0, 0)); im.setMatrixAt(i, mm); im.instanceMatrix.needsUpdate = true; });
    const refresh = () => { const s = store.get(); SHARDS.forEach((_, i) => hideInst(shards, i, !(s.shards || []).includes(i), shardM[i])); PAGES.forEach((_, i) => hideInst(pages, i, !(s.pages || []).includes(i), pageM[i])); };
    refresh();
    // far: temple massing only
    const kf = new Kit(); W(kf, box(40, 8, 2), C.STONE, M(cx, y + 4, TEMPLE.z0 + 0.8), false); for (let s = 0; s < 4; s++) W(kf, box(14 - s * 3, 1.6, 6 - s * 1.2), C.STONE, M(cx, y + 0.8 + s * 1.6, TEMPLE.z0 + 4.5), false);
    for (const sx of [TEMPLE.x0 + 0.8, TEMPLE.x1 - 0.8]) W(kf, box(1.7, 4, 36), C.STONE, M(sx, y + 2, (TEMPLE.z0 + TEMPLE.z1) / 2), false); W(kf, box(1.8, 7, 1.8), C.STONE, M(cx - 3.6, y + 3.5, TEMPLE.z1 - 1), false); far.add(kf.build(MATS, OUT));
    const B = { near, far, chests, refresh, logG, dartG, tiles,
      tick(t) { for (const c of Object.values(chests)) c.tick(t); logG.rotation.z = Math.sin(t * 1.6) * 1.05;
        const ph = (t % 3.2) / 3.2; dartG.visible = ph < 0.3; if (dartG.visible) dartG.position.set(RUN.x - RUN.hw + ph / 0.3 * RUN.hw * 2, y, DARTS.z);
        for (const q of tiles) { if (q.t >= 0) { const u = t - q.t; q.g.position.y = y - Math.max(0, u - 0.25) ** 2 * 6; if (u > 3) { q.t = -1; q.g.position.y = y; } } }
        const sh = shards.children[0]; if (sh) shards.children.forEach(im => { im.rotation.y = 0; }); } };
    trap.fake = TILES.map((_, i) => ((dayHash() >> i) & 1) ? 1 : -1);
    return B;
  },
  label(q) { const s = store.get();
    if (q.id === 'jungle_ruin_chest' || HIDDEN.some(c => c.id === q.id)) return (s.chests || {})[q.id] === today() ? 'OPENED TODAY' : null;
    if (q.id.startsWith('jungle_shard_')) return (s.shards || []).includes(+q.id.slice(13)) ? 'SHARD TAKEN' : null;
    if (q.id.startsWith('jungle_page_')) return (s.pages || []).includes(+q.id.slice(12)) ? 'PAGE READ' : null;
    return null; },
  activate(q, t, api, b) { const s = store.get();
    if (q.id === 'jungle_mossbeard') { const n = (s.pages || []).length, sh = (s.shards || []).length;
      if (!s.quest_exp) store.upd(o => { o.quest_exp = 'started'; });
      const line = n >= PAGES.length ? '"You found them all! The last page marks a dig site by the temple. A map will turn up when the jungle dig opens."' : n ? `"${n} of ${PAGES.length} pages. Keep going, they lost the rest deeper in."` : '"An expedition went up to the temple and never came back. Find their 4 journal pages!"';
      return `OLD MOSSBEARD · THE LOST EXPEDITION<br><small>${line}<br>journal pages ${n}/${PAGES.length} · idol shards ${sh}/${SHARDS.length}<br>the temple trap run is straight ahead · mind the floor</small>`; }
    if (q.id.startsWith('jungle_shard_')) { const i = +q.id.slice(13); if ((s.shards || []).includes(i)) return null; const o = store.upd(o => { (o.shards = o.shards || []).push(i); }); b?.refresh();
      return o.shards.length >= SHARDS.length ? 'THE GOLDEN IDOL IS WHOLE!<br><small>7/7 idol shards · the Golden Idol cosmetic is yours (it arrives in your gear with the next update)</small>' : `IDOL SHARD ${o.shards.length}/${SHARDS.length}<br><small>collect all 7 for the Golden Idol (cosmetic)</small>`; }
    if (q.id.startsWith('jungle_page_')) { const i = +q.id.slice(12); if ((s.pages || []).includes(i)) return null; const o = store.upd(o => { (o.pages = o.pages || []).push(i); }); b?.refresh();
      const T = ['"Day 3. The trail splits at the old hermit\'s camp. We go north-east."', '"Day 5. The floor bites! Only half the tiles hold. Watch which ones crack."', '"Day 6. We left the gallows hill behind. The temple is close."', '"Day 9. From the high ledge I can see the altar. The treasure is real…"'];
      return `JOURNAL PAGE ${o.pages.length}/${PAGES.length}<br><small>${T[i]}</small>`; }
    if (q.id === 'jungle_ruin_chest' || HIDDEN.some(c => c.id === q.id)) { if ((s.chests || {})[q.id] === today()) return 'THE CHEST IS EMPTY<br><small>it refills tomorrow</small>';
      b?.chests[q.id]?.open(t); store.upd(o => { (o.chests = o.chests || {})[q.id] = today(); o.found = (o.found || 0) + 1; });
      return `${q.id === 'jungle_ruin_chest' ? 'THE RUIN CHEST!' : 'HIDDEN CHEST!'}<br>${PENDING}`; }
    return null; },
  onPlayer(p, t, api, b) { const [x, z] = p; if (Math.abs(x - RUN.x) > RUN.hw + 0.4 || z > RUN.z0 || z < RUN.z1 || t - trap.last < 1.2) return;
    const back = (why) => { trap.last = t; api.teleport(trap.start[0], trap.start[1], Math.PI); api.toast(why + '<br><small>back to the start of the trap run</small>', 1800); };
    const ph = (t % 3.2) / 3.2; if (ph < 0.3 && Math.abs(z - DARTS.z) < 1.1) return back('THWACK! DARTS!');
    const lx = RUN.x + Math.sin(Math.sin(t * 1.6) * 1.05) * 4.0; if (Math.abs(z - LOG.z) < 0.9 && Math.abs(x - lx) < 0.9 && Math.abs(Math.sin(t * 1.6) * 1.05) < 0.6) return back('BONK! THE LOG GOT YOU');
    TILES.forEach((tz, i) => { if (Math.abs(z - tz) < 1.3 && Math.sign(x - RUN.x) === trap.fake[i]) { const q = b?.tiles.find(q => q.z === tz && q.s === trap.fake[i]); if (q && q.t < 0) q.t = t; back('THE FLOOR GAVE WAY!'); } }); },
};
