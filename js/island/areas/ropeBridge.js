// [island-rework] D3 ROPE BRIDGE approaches (BANKSY 3:49 PM "I liked that hanging bridge … but no way to get to it"; 5:33 PM "fix those 3 first").
// The bridge itself (foot.js ROPE_BRIDGE, trail A over the river gorge at foot (16, -82), deck y 35.2, 39 m, sag 1.95) is KEPT as is:
// its deck was already walkable (bridgeAt: the planks are the floor, the rope rails bound you). Why nobody got onto it:
//   - trail A's painted path never goes there: it dives 2.5:1 down the gorge wall, crosses the river UNDER the bridge and climbs out
//   - the only ways onto the deck were the two bare 5 m ramp slots foot.js v105 carved along the bridge axis (grade 0.5): unpainted,
//     unlit, walled in by the gorge, invisible from the trail (the south one also dead-ends in a cliff at z -160)
// Now: both slots are real APPROACHES: painted like a trail, STONE steps on timber stringers (concept D3_rope_bridge.jpg) (the tread you see is the height you stand on),
// rope handrails on posts, lamps, and a ROPE BRIDGE signpost where each approach meets trail A (south: (16, -148), north: (17, -58)).
// Cosmetic only. Nothing pays gold (flags.js).
import * as THREE from 'three';
import { Kit, M, box, cyl, hash, W, C } from './common.js';
export const RB = { x: 16, zS: -103, zN: -64, s0: -103.6, s1: -150, n0: -63.4, n1: -45, hw: 1.9 };
// the v105 slots left a 1.7-1.8 m LIP at both deck ends (deck y 35.24, slot ground 37.1-37.2 right past it: the walker's 1.25 grade limit
// can't climb that, which is why the bridge felt unreachable). Cut each slot to a straight grade from the deck end (y 35.24) to where it
// meets the old slot floor, and lay the steps on that line: deck end -> steps -> slot -> trail A with no lip.
const DECK_Y = 35.24, CUT_S = [RB.x, -104, DECK_Y + 0.06, RB.x, -114, 41.6], CUT_N = [RB.x, -63, DECK_Y + 0.06, RB.x, -53, 40.6]; // start >= the deck y: foot.js finds the deck ends where the ground reaches it, so they stay put
const cutY = (c, z) => { const t = (z - c[1]) / (c[4] - c[1]); return t < 0 || t > 1 ? null : c[2] + (c[5] - c[2]) * t + 0.06; };
let PS = [], PN = [];
const prof = (H, z0, z1) => { const n = Math.round(Math.abs(z1 - z0) / 0.5), p = []; for (let k = 0; k < n; k++) { const z = z0 + (z1 - z0) * (k + 0.5) / n;
  const y = H(RB.x, z), c = z > CUT_S[1] && z < RB.zS + 5 ? CUT_S[2] + 0.06 : z < CUT_N[1] && z > RB.zN - 5 ? CUT_N[2] + 0.06 : cutY(CUT_S, z) ?? cutY(CUT_N, z); p.push(c ?? y + 0.05); } return p; };
export default {
  id: 'rope_bridge', name: 'Rope Bridge approaches', rect: [6, 26, -152, -18],
  terrain: { pads: [], cuts: [[...CUT_S.slice(0, 3), ...CUT_S.slice(3), 2.6].map((v, i) => i === 2 || i === 5 ? v + 0.45 : v), [...CUT_N, 2.6].map((v, i) => i === 2 || i === 5 ? v + 0.45 : v)], paths: [{ id: 'rope_bridge_s', pts: [[RB.x, RB.s0], [RB.x, (RB.s0 + RB.s1) / 2], [RB.x, RB.s1]] }, { id: 'rope_bridge_n', pts: [[RB.x, RB.n0], [RB.x, (RB.n0 + RB.n1) / 2], [RB.x, RB.n1]] }] },
  register(h) {
    const { H } = h, BY = DECK_Y + 0.12; // = foot.js bridge deck end height (+ the 0.12 the walker stands on)
    // decks: z runs from the bridge end outwards; the deck's u = 0 end is its -z end (yaw 0), so the south profile is stored reversed
    PS = prof(H, RB.s1, RB.s0); PN = prof(H, RB.n0, RB.n1);
    h.addDeck({ id: 'rope_bridge_steps_s', x: RB.x, z: (RB.s0 + RB.s1) / 2, hw: RB.hw, hl: Math.abs(RB.s0 - RB.s1) / 2, yaw: 0, y: PS[0], prof: PS, ya: H(RB.x, RB.s1), yb: BY });
    h.addDeck({ id: 'rope_bridge_steps_n', x: RB.x, z: (RB.n0 + RB.n1) / 2, hw: RB.hw, hl: Math.abs(RB.n1 - RB.n0) / 2, yaw: 0, y: PN[0], prof: PN, ya: BY, yb: H(RB.x, RB.n1) });
    h.poi('rope_bridge_s', 'Rope bridge (south approach)', RB.x, RB.s1, { clear: 8 }); h.poi('rope_bridge_n', 'Rope bridge (north approach)', RB.x, -58, { clear: 8 });
    for (const [x, z] of [[RB.x - 3.4, RB.s1 + 1.5], [RB.x + 3.4, -57]]) h.addCirc(x, z, 0.35); // signposts
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_rope_bridge'; far.name = 'area_rope_bridge_far';
    const steps = (z0, z1, P) => { const n = P.length, d = (z1 - z0) / n;
      for (let i = 0; i < n; i++) { const z = z0 + (i + 0.5) * d, y = P[i]; W(k, box(RB.hw * 2 - 0.2, 0.14, Math.abs(d) - 0.06), i % 3 ? 0xc9c1b3 : C.STONE, M(RB.x + (hash(i, 3) - 0.5) * 0.06, y - 0.07, z, (hash(i, 5) - 0.5) * 0.04), i % 5 === 0);
        if (i % 2 === 0) for (const s of [-1, 1]) W(k, box(0.22, 0.35, Math.abs(d) * 2), C.WOOD_D, M(RB.x + s * (RB.hw - 0.05), y - 0.2, z), false); }
      // rope handrails on posts every 3 m (both sides), a lamp every 12 m
      const posts = []; for (let i = 0; i < n; i += 6) posts.push([z0 + (i + 0.5) * d, P[i]]); posts.push([z0 + (n - 0.5) * d, P[n - 1]]);
      for (const s of [-1, 1]) { const x = RB.x + s * (RB.hw + 0.15);
        posts.forEach(([z, y], j) => { W(k, cyl(0.1, 0.12, 1.3, 6), C.WOOD_D, M(x, y + 0.55, z)); if (j % 4 === 0 && s > 0) { W(k, cyl(0.07, 0.09, 2.8, 5), C.IRON, M(x + 0.35, y + 1.4, z), false); W(k, box(0.4, 0.5, 0.4), 0xffd27a, M(x + 0.35, y + 2.9, z), false); } });
        for (let j = 1; j < posts.length; j++) { const [za, ya] = posts[j - 1], [zb, yb] = posts[j], L = Math.hypot(zb - za, yb - ya);
          W(k, cyl(0.05, 0.05, L, 4), 0xc9a36b, M(x, (ya + yb) / 2 + 1.1, (za + zb) / 2, 0, Math.atan2(zb - za, yb - ya)), false); } } };
    steps(RB.s1, RB.s0, PS); steps(RB.n0, RB.n1, PN);
    // ROPE BRIDGE signposts where each approach meets trail A
    for (const [x, z, a] of [[RB.x - 3.4, RB.s1 + 1.5, 0.3], [RB.x + 3.4, -57, Math.PI + 0.3]]) { const y = H(x, z);
      W(k, box(0.2, 2.6, 0.2), C.WOOD_D, M(x, y + 1.3, z)); W(k, box(1.9, 0.5, 0.1), C.WOOD_L, M(x, y + 2.2, z, a)); W(k, box(0.9, 0.12, 0.12), 0xc9a36b, M(x, y + 2.2, z + 0.07, a), false); }
    near.add(k.build(MATS, OUT));
    const kf = new Kit(); for (const [z0, z1, P] of [[RB.s1, RB.s0, PS], [RB.n0, RB.n1, PN]]) for (let i = 0; i < P.length; i += 8) W(kf, box(RB.hw * 2, 0.2, Math.abs(z1 - z0) / P.length * 8), C.WOOD, M(RB.x, P[i] - 0.1, z0 + (z1 - z0) * (i + 4) / P.length), false);
    far.add(kf.build(MATS, OUT));
    return { near, far };
  },
};
