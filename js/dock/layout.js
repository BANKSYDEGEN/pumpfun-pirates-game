// [Emerly] PUMPFUN PIRATES docking + on-foot: the HARBOR LAYOUT CONFIG. Everything in js/dock/* and js/onfoot/* is driven by
// this data (no hard-wired piers), so a new waterfront only has to change the source data, not the mechanics.
//
// A layout (all positions in the GAME's harbor world frame, metres; yaw = ship/pirate heading, forward = (sin yaw, cos yaw)):
//   id            string
//   berths[]      { id, x, z, yaw, len, beam, ashore: { x, z }, out: { x, z } }   yaw = the parked ship's bow; out = unit
//                 vector to open water (SET SAIL eases forward and swings that way). ashore = where the pirate steps onto a deck.
//   safe          { kind: 'circle', x, z, r } | { kind: 'poly', pts: [[x, z], ...] } (+ exit: { x, z } = where AI heads to leave it)
//   graceS        seconds after leaving the zone before you may fire
//   decks[]       { id, x, z, yaw, hw, hl, y }   walkable oriented rectangles over water (piers, boardwalks, jetties): centre,
//                 yaw of the long axis, half-width (across), half-length (along), deck top. Steps on / off are implied (<= 2.4 m).
//   interact[]    { id, kind, x, z, r, label }   kinds: waves | arena | squadhall | spyglass | shop | stall | tavern | bounties |
//                 exchange | market | dig | cave   (foot.js INTERACT points are added by world.js)
//   shipCircles[] { x, z, r, h }   solid water-line circles for ships + cannonballs (pier stems / heads, quay, mole, land edge)
//   footToHarbor / harborToFoot   the frame between Raul's on-foot island (js/island/foot.js world) and the harbor
//   spawn         { x, z, yaw }   fallback stand point after GO ASHORE
//
// SOURCE: Raul's coast data js/island/coast.js (raul/harbor-coast aa0fd43, ?coast=1): the town + 8 berths are built into the
// harbor-facing (west) coast of the main island; harbor frame = foot world - HC (no rotation), spawn 0,0 = foot (-890, -150).
// Nothing here is a number of ours except the deck heights / margins marked RAUL below and the berth exit swing.
import * as CO from '../island/coast.js';

const DECK_Y = CO.BOARDWALK.y + 0.15;      // RAUL: plank top of the boardwalk / pier stems / T-heads (kit modules sit at PY)
const HEAD_ASHORE_LZ = 42.6;               // RAUL: where a pirate stands on the T-head next to his ship (heads span lz 40..44)
const L = (lx, lz) => CO.toHarbor(...CO.t2w(lx, lz));
const rect = (id, lx0, lx1, lz0, lz1, y = DECK_Y) => { const [x, z] = L((lx0 + lx1) / 2, (lz0 + lz1) / 2);
  return { id, x, z, yaw: CO.t2wYaw(0), hw: (lx1 - lx0) / 2, hl: (lz1 - lz0) / 2, y }; };   // long axis = town lz (out to sea)

// Main Street shop doors: the same lot walk as foot.js buildStreet (signs '-1:1' tavern, '-1:4' bounties; the SHOP door is
// foot.js SHOP_SPOTS.shop)
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function streetLots(S) { const lots = []; for (let z = S.z0 - 10, n = 0; z > S.z1 + 8; n++) { const w = 7 + hash(n, 3) * 4; lots.push([z - w / 2, w, n]); z -= w + 1.6; } return lots; }

export async function coastLayout() {
  const FM = await import('../island/foot.js'); // the on-foot island (heightmap built on import; coast mode follows ?coast=1)
  const footToHarbor = CO.toHarbor, harborToFoot = CO.fromHarbor;
  const sea = (() => { const [a, b] = L(0, 0), [c, d] = L(0, 1); return { x: c - a, z: d - b }; })(); // town +lz = out to sea
  // ---- berths ----
  const berths = CO.COAST_BERTHS.map(b => { const [ax, az] = L(b.lx, HEAD_ASHORE_LZ);
    return { id: b.id, x: b.hx, z: b.hz, yaw: b.yaw, len: b.len, beam: b.maxBeam, ashore: { x: ax, z: az }, out: sea }; });
  // ---- walkable decks over water (the quay, plaza and mole are terrain in foot.js coast mode) ----
  const B = CO.BOARDWALK, decks = [rect('boardwalk', B.lx0, B.lx1, B.lz0, B.lz1)];
  for (const p of CO.PIERS) {
    decks.push(rect('stem' + (p.k + 1), p.lx - 2.6, p.lx + 2.6, p.lz0 - 1, p.head0 + 0.5));
    decks.push(rect('head' + (p.k + 1), p.lx - p.half, p.lx + p.half, p.head0, p.head1));
    decks.push(rect('jetty' + (p.k + 1), p.lx - 32.6, p.lx - 27.4, 3, 22));
  }
  // ---- ship colliders: pier stems + T-heads, side jetties, quay face, mole, land edge ----
  const shipCircles = [], ring = (lx, lz, r, h = DECK_Y + 2) => { const [x, z] = L(lx, lz); shipCircles.push({ x, z, r, h, pier: true }); };
  for (const p of CO.PIERS) { for (let lz = p.lz0; lz <= p.head0; lz += 4) ring(p.lx, lz, 3.2);
    for (let lx = p.lx - p.half + 2; lx <= p.lx + p.half - 2; lx += 4) ring(lx, (p.head0 + p.head1) / 2, 2.6);
    for (let lz = 4; lz <= 22; lz += 4) ring(p.lx - 30, lz, 3); }
  { const m = CO.MOLE; for (let lz = m.lz0; lz <= m.lz1; lz += 5) ring(m.lx, lz, m.w / 2 + 0.5, m.y + 3); ring(m.lx, m.lz1, m.tipR, m.y + 3); }
  const SAMPLE = 8, land = (x, z) => FM.H(...harborToFoot(x, z)) > -0.8;
  for (let x = -480; x <= 560; x += SAMPLE) for (let z = -480; z <= 480; z += SAMPLE) {
    if (Math.hypot(x, z) > 560 || !land(x, z)) continue;
    if (land(x + SAMPLE, z) && land(x - SAMPLE, z) && land(x, z + SAMPLE) && land(x, z - SAMPLE)) continue; // interior
    shipCircles.push({ x, z, r: SAMPLE * 0.78, h: Math.max(4, FM.H(...harborToFoot(x, z)) + 6) });
  }
  // ---- interact points ----
  const interact = [], PP = Object.fromEntries(CO.PLAZA_POIS.map(q => [q.id, q]));
  const P = (id, kind, lx, lz, label, r = 3.2) => { const [x, z] = L(lx, lz); interact.push({ id, kind, x, z, r, label }); };
  P('waves', 'waves', PP.waves.lx, PP.waves.lz + 2.2, 'WAVES BOARD');
  P('arena', 'arena', PP.arena.lx, PP.arena.lz + 2.2, 'ARENA · SOLO / SQUADS');
  P('spyglass', 'spyglass', CO.SPYGLASS.lx, CO.SPYGLASS.lz, 'SPYGLASS · SPECTATE', CO.SPYGLASS.r); // Raul's spyglass prop (coast.js SPYGLASS, single source of truth)
  P('exchange', 'exchange', PP.exchange.lx, PP.exchange.lz + 4.2, 'TOKEN EXCHANGE');
  P('market', 'market', PP.market.lx, PP.market.lz + 3.2, 'HARBOR MARKET', 4);
  // Timothy's SHOP door + the red / blue stalls: foot.js fills SHOP_SPOTS while it builds the street (createFoot), so world.js
  // calls this right after
  const shopInteract = () => Object.values(FM.SHOP_SPOTS).map(s => { const [x, z] = footToHarbor(s.x, s.z);
    return { id: s.id, kind: s.id === 'shop' ? 'shop' : 'stall', x, z, r: s.r + 0.6, label: s.id === 'shop' ? 'SHOP · SKINS + GEAR' : s.label.replace(/^E · /, '') }; });
  { const S = FM.STREET, lots = streetLots(S), sign = { tavern: [-1, 1], bounties: [-1, 4] };
    for (const [kind, [side, n]] of Object.entries(sign)) { const lot = lots[n]; if (!lot) continue;
      const [x, z] = footToHarbor(...FM.townToWorld(S.x + side * (S.half - 0.5), lot[0])); interact.push({ id: kind, kind, x, z, r: 3.4, label: kind === 'tavern' ? 'TAVERN' : 'BOUNTY BOARD' }); } }
  // ---- SAFE HARBOR: Raul's town-local polygon (berths + 22 m, quay front, mole) ----
  const safe = { kind: 'poly', pts: CO.SAFE.map(([lx, lz]) => L(lx, lz)), exit: { x: 0, z: 0 } };
  const spawn = (() => { const [x, z] = L(PP.arrive.lx, PP.arrive.lz); return { x, z, yaw: CO.t2wYaw(Math.PI) }; })();
  return { id: 'raul-coast-aa0fd43', shopInteract, berths, decks, safe, graceS: 3, interact, shipCircles, spawn, footToHarbor, harborToFoot, FM, CO, deckY: DECK_Y };
}
