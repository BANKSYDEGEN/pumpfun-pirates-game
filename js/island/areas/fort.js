// [island-rework] HILLTOP FORT walk-in (BANKSY 2:46 PM "the inaccessible castle at top of hill"; 5:33 PM "fix those 3 first").
// [v252] BANKSY 8:28 PM "redo the castle": plaza-shop quality keep / gatehouse / walls / towers / courtyard (concept B3_fort.jpg);
//        fort spyglass = arena spectate (same as the mole spyglass). Plan: PLAN.md §1c
// Was: foot.js built CO.FORT (lx 46, lz -232 = foot (-408, -44), knoll top y 36) as one solid 27 x 27 collider: no door, no path, a 1.6:1 knoll.
// Now (this module replaces that block; foot.js skips it while FORT_WALKIN):
//   - THE FORT STAIR from the town gate: leg 1 north along x -434 (y 20 -> 31), a landing, leg 2 east (31 -> 36) through the
//     GATEHOUSE arch in the west wall (portcullis up), stone parapets both sides (colliders), masonry down to the ground
//   - the COURTYARD: a flat 22.8 x 22.8 yard at y 36 (terrain pad), the well, crates, the training dummy, the flag mast (RAISE THE COLOURS)
//   - the KEEP (roofless WAR ROOM, door on the west face): the map table (E: reads your treasure map / the fort chronicle)
//   - RAMPARTS: a stair up the inside of the north wall to the wall-walk (y 42) round all four walls + the four corner towers,
//     outer parapets (colliders), the 4 cannons on the south wall, the SPYGLASS on the NE tower
// Deck axes (foot.js areaDeckAt): yaw 0 = hw across x, hl along z; yaw PI/2 = hw across z, hl along x.
// Walls / towers / keep are WALK DECKS at their top height, not colliders: from the yard or the knoll they are > 0.6 m up, so the
// walker can't step into them (same rule as any deck), and the wall-walk on top is the same deck. Only the outer parapet strips
// + the stair parapets + props are colliders. Cosmetic only: nothing pays gold (flags.js).
import { COLISEUM_ON } from '../coliseum.js';
const ZIP_ON = !(typeof location !== 'undefined' && /[?&]zipline=0(&|$)/.test(location.search)); // [v309] castle zipline embrasure
const ZIP_A_NE = ZIP_ON ? Math.atan2((-232) - (-57), (-188) - (-395)) : 0; // toward Waterfall Hill summit stand
import * as THREE from 'three';
import { Kit, M, box, cyl, ball, hash, W, C, store, today } from './common.js';
import { AREA_GOLD_ON, PENDING } from './flags.js';
import { FLAG_DAILY, HOLDER_DAILY_GOLD } from '../../config.js';

export const FORT_WALKIN = true;
export const FORT = { x: -408, z: -44, y: 36, half: 13, wall: 1.6, wallTop: 42, gateHW: 2.0, keep: { x: -404.6, z: -44, half: 5, wall: 0.8, h: 9, doorHW: 1.3 } }; // [fort-upper] keep nudged west so east wall-walk clears SE turret
const F = FORT, X0 = F.x - F.half, X1 = F.x + F.half, Z0 = F.z - F.half, Z1 = F.z + F.half, WT = F.wallTop;
const LEG1 = { x: -434, z0: COLISEUM_ON ? -64 : -72, z1: -46.5, hw: 2.0, y1: 31 }, LAND = { x: -434, z: -44, hw: 2.5 }, LEG2 = { z: -44, x0: -431.5, x1: X0 + 2.5, hw: F.gateHW }; // runs on through the gate arch onto the yard (covers the cut edge)
const RAMP = 1.5;                                                              // [fort-upper] WW = wall+RAMP = 3.1 m generous walkway
const NSTAIR = { z: Z1 - (F.wall + RAMP) - 1.1 - 0.05, x0: -416, x1: -404, hw: 1.1 }; // [fort-upper] z=-35.25 alongside hz1=-34.1; top tread reaches WT
const SPY = { x: X1 + 0.3, z: Z1 + 0.3 }, TABLE = { x: F.keep.x, z: F.keep.z }, MAST = { x: F.x - 6, z: F.z - 6 }; // [fort-upper] spyglass centred on NE bastion
const GOLD_D = 0xd9a020, TRIM = 0xcfc8bb, ROOF = 0x9a3a2a, ROOF_D = 0x7a2a1a, RED_B = 0x9b2335, PARCH = 0xe8d6a8;
let P1 = [], P2 = [], Y20 = 20;
const stepProf = (H, ax, az, bx, bz, y0, y1, n) => { const p = []; for (let k = 0; k < n; k++) { const u = (k + 0.5) / n; p.push(Math.max(y0 + (y1 - y0) * (k + 1) / n, H(ax + (bx - ax) * u, az + (bz - az) * u) + 0.04)); }
  for (let k = 1; k < n; k++) p[k] = Math.max(p[k], p[k - 1]); return p; };
function fortSignTex(title, sub) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#3a1a10'); grd.addColorStop(1, '#1a0a08'); g.fillStyle = grd; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#ffc93c'; g.lineWidth = 14; g.strokeRect(10, 10, 1004, 236); g.strokeStyle = '#a8741a'; g.lineWidth = 4; g.strokeRect(28, 28, 968, 200);
  g.fillStyle = '#ffc93c'; for (const x of [70, 954]) { g.beginPath(); g.arc(x, 128, 22, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a0a08'; g.beginPath(); g.arc(x, 128, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffc93c'; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3a1f0a';
  let px = 118; g.font = `bold ${px}px "Just Another Hand", Georgia, serif`; while (px > 64 && g.measureText(title).width > 780) { px -= 6; g.font = `bold ${px}px "Just Another Hand", Georgia, serif`; }
  g.fillText(title, 516, sub ? 108 : 138); g.fillStyle = '#ffd75a'; g.fillText(title, 512, sub ? 103 : 133);
  if (sub) { g.font = '42px "Just Another Hand", Georgia, serif'; g.fillStyle = '#c9a36b'; g.fillText(sub, 512, 178); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// [hilltop] BANKSY 10:11 PM "Flag must be the PUMPFUN PIRATES flag": the project's Jolly Roger (assets/skull_transparent.png on black, the
// same art as the ships' flags), one shared material; a plain black cloth until the image loads (and in node tests)
let PFP_FLAG = null;
export function pfpFlagMaterial() { if (PFP_FLAG) return PFP_FLAG;
  PFP_FLAG = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 512; c.height = 340; const g = c.getContext('2d');
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 512, 340); const sc = Math.min(512 * 0.8 / img.width, 340 * 0.8 / img.height), w = img.width * sc, hh = img.height * sc; g.drawImage(img, (512 - w) / 2, (340 - hh) / 2, w, hh);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; PFP_FLAG.map = t; PFP_FLAG.color.set(0xffffff); PFP_FLAG.needsUpdate = true; }; img.src = 'assets/skull_transparent.png'; }
  return PFP_FLAG; }

// [castle-flag-daily] holder claim day = America/Indiana/Indianapolis (matches pvp_holder_claim / pvpSave.indyDay)
export const indyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Indiana/Indianapolis' }).format(new Date());
export function untilIndyMidnight(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Indiana/Indianapolis', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(now));
  const g = (t) => +parts.find(p => p.type === t).value;
  let h = g('hour'); if (h === 24) h = 0; // some engines report 24:00
  const leftMin = Math.max(0, (23 - h) * 60 + (59 - g('minute')));
  const hh = Math.floor(leftMin / 60), mm = leftMin % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}
export function markFortFlagRaised() { store.upd(o => { o.fortFlag = indyDay(); }); }
export function fortFlagIsUp() { return store.get().fortFlag === indyDay() || store.get().fortFlag === today(); }
export default {
  id: 'hilltop_fort', name: 'Hilltop Fort', rect: [-437, X1, -73, Z1],
  terrain: { pads: [[X0, X1, Z0, Z1, F.y]], paths: [], cuts: [...(COLISEUM_ON ? [[-434,-77,20.1,-434,-64,20.1,4],[-434,-64,20.1,-434,-46.5,31,2.4]] : []), [LEG2.x0 - 1, LEG2.z, LEG1.y1, -427, LEG2.z, LEG1.y1 + (F.y - LEG1.y1) * 4.5 / (LEG2.x1 - LEG2.x0), LEG2.hw]] }, // leg 2 cut into the knoll: one even grade (0.45), no steep last metres
  register(h) {
    const { H } = h; Y20 = COLISEUM_ON ? 20.1 : H(LEG1.x, LEG1.z0);
    // the fort stair (2 legs + landing): treads of ~0.2 m
    const L1 = LEG1.z1 - LEG1.z0; P1 = stepProf(H, LEG1.x, LEG1.z0, LEG1.x, LEG1.z1, Y20, LEG1.y1, Math.ceil((LEG1.y1 - Y20) / 0.21));
    h.addDeck({ id: 'fort_stair_1', x: LEG1.x, z: (LEG1.z0 + LEG1.z1) / 2, hw: LEG1.hw, hl: L1 / 2, yaw: 0, y: P1[0], prof: P1, ya: Y20, yb: LEG1.y1 });
    h.addDeck({ id: 'fort_landing', x: LAND.x, z: LAND.z, hw: LAND.hw, hl: LAND.hw, yaw: 0, y: LEG1.y1 });
    const L2 = LEG2.x1 - LEG2.x0; P2 = stepProf(H, LEG2.x0, LEG2.z, LEG2.x1, LEG2.z, LEG1.y1, LEG1.y1 + (F.y - LEG1.y1) * (LEG2.x1 - LEG2.x0) / (X0 - LEG2.x0), Math.ceil((F.y - LEG1.y1) / 0.21 * (LEG2.x1 - LEG2.x0) / (X0 - LEG2.x0))).map(y => Math.min(y, F.y)); // reaches the yard level AT the gate line, flat through the arch
    h.addDeck({ id: 'fort_stair_2', x: (LEG2.x0 + LEG2.x1) / 2, z: LEG2.z, hw: LEG2.hw, hl: L2 / 2, yaw: Math.PI / 2, y: P2[0], prof: P2, ya: LEG1.y1, yb: F.y });
    // stair parapets (colliders): leg 1 both sides, the landing's west + north edges, leg 2 both sides
    h.addBox(LEG1.x - LEG1.hw - 0.3, (LEG1.z0 + 3 + LEG1.z1) / 2, 0.5, L1 - 3, 0); h.addBox(LEG1.x + LEG1.hw + 0.3, (LEG1.z0 + 3 + LEG1.z1) / 2, 0.5, L1 - 3, 0);
    h.addBox(LAND.x - LAND.hw - 0.3, LAND.z, 0.5, LAND.hw * 2 + 0.6, 0); h.addBox(LAND.x, LAND.z + LAND.hw + 0.3, LAND.hw * 2 + 0.6, 0.5, 0);
    for (const s of [-1, 1]) h.addBox((LEG2.x0 + X0) / 2, LEG2.z + s * (LEG2.hw + 0.3), X0 - LEG2.x0, 0.5, 0);
    // [fort-upper/v304] N/E/S wall-walk decks at WT; WEST split around the gate so y=36 LEG2 entry stays open.
    // Gate span uses HIGH_BRIDGES (setLayer) so y≈42 walkers get a continuous bridge while y=36 walkers see the yard floor.
    const wd = F.wall + RAMP, wc = F.half - wd / 2, TOWER_CLEAR = 5.0, paraSpan = F.half * 2 - 2 * TOWER_CLEAR;
    const gs = (F.half * 2 - F.gateHW * 2) / 2; // west curtain length each side of the gate
    h.addDeck({ id: 'fort_wall_n', x: F.x, z: F.z + wc, hw: F.half, hl: wd / 2, yaw: 0, y: WT });
    h.addDeck({ id: 'fort_wall_s', x: F.x, z: F.z - wc, hw: F.half, hl: wd / 2, yaw: 0, y: WT });
    h.addDeck({ id: 'fort_wall_e', x: F.x + wc, z: F.z, hw: wd / 2, hl: F.half, yaw: 0, y: WT });
    for (const s of [-1, 1]) h.addDeck({ id: 'fort_wall_w' + (s < 0 ? 's' : 'n'), x: F.x - wc, z: F.z + s * (F.gateHW + gs / 2), hw: wd / 2, hl: gs / 2, yaw: 0, y: WT });
    { const wx = F.x - wc, gz0 = F.z - F.gateHW, gz1 = F.z + F.gateHW;
      h.addHighBridge?.({ id: 'fort_gate_bridge', ax: wx, az: gz0, bx: wx, bz: gz1, L: F.gateHW * 2, yaw: 0, half: wd / 2 - 0.15, yAt: () => WT }); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) h.addDeck({ id: 'fort_tower_' + sx + sz, x: F.x + sx * F.half, z: F.z + sz * F.half, r: 3.6, y: WT });
    // [v309] cantilevered zipline balcony deck + side guards on NE in-game turret [+1,-1]
    if (ZIP_ON) {
      const tx = F.x + F.half, tz = F.z - F.half, yaw = ZIP_A_NE;
      const ox = Math.cos(yaw), oz = Math.sin(yaw), sx = -oz, sz = ox; // side unit
      h.addDeck({ id: 'fort_zip_balc', x: tx + ox * 3.2, z: tz + oz * 3.2, yaw, hw: 1.5, hl: 1.7, y: WT });
      for (const s of [-1, 1]) h.addBox(tx + ox * 3.2 + sx * s * 1.5, tz + oz * 3.2 + sz * s * 1.5, 0.35, 2.8, -yaw);
    }
    // outer parapet colliders: N/S/E stop short of corner towers; WEST split around the gate (arch open at y=36)
    h.addBox(F.x, Z1 - 0.25, paraSpan, 0.5, 0);
    h.addBox(F.x, Z0 + 0.25, paraSpan, 0.5, 0);
    h.addBox(X1 - 0.25, F.z, 0.5, paraSpan, 0);
    for (const s of [-1, 1]) h.addBox(X0 + 0.25, F.z + s * (F.gateHW + gs / 2), 0.5, gs, 0);
    // all 4 corner towers: outer ~210° rim colliders only; inner ~150° into the two wall-walks stays open
    // [v309] NE in-game turret [+1,-1]=(-395,-57): open ±0.42 rad embrasure toward Waterfall Hill zipline
    const zipA_NE = ZIP_A_NE;
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = F.x + sx * F.half, tz = F.z + sz * F.half, inward = Math.atan2(-sz, -sx);
      const isZipTurret = ZIP_ON && sx === 1 && sz === -1;
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2; let d = a - inward; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < Math.PI * 75 / 180) continue; // open mouth into the wall-walks
        if (isZipTurret && Math.abs(angDiff(a, zipA_NE)) < 0.55) continue; // zipline embrasure
        h.addBox(tx + Math.cos(a) * 3.15, tz + Math.sin(a) * 3.15, 0.85, 0.55, -a);
      }
    }
    // the north-wall stair (yard -> wall-walk)
    h.addDeck({ id: 'fort_rampart_stair', x: (NSTAIR.x0 + NSTAIR.x1) / 2, z: NSTAIR.z, hw: NSTAIR.hw, hl: (NSTAIR.x1 - NSTAIR.x0) / 2, yaw: Math.PI / 2, y: F.y, prof: Array.from({ length: 28 }, (_, k) => F.y + (WT - F.y) * (k + 1) / 28), ya: F.y, yb: WT });
    // [hilltop] BANKSY 10:11 PM "steps up to the spyglass must connect": the rampart stair ended in mid-air at x -404 (a 6 m drop to the yard
    // beyond the top tread, the wall-walk only reachable by a sideways step through the cheek wall); a level landing runs on at the top into the
    // north wall-walk, which leads east to the NE tower (the spyglass): one continuous walk
    // [v267] BANKSY 10:47 AM falls through at top of stairs: hw/hl were SWAPPED under yaw π/2 (hl along x was only 1.45 m, so a ~1 m VOID
    // sat between the top tread at x -404 and the landing). Overlap the stair by 0.5 m for jump spam.
    // [v267b] BANKSY 10:55/10:56 AM stone upper level: landing fills the L into the north wall-walk (no yard visible through the junction).
    h.addDeck({ id: 'fort_rampart_land', x: -401.6, z: ((NSTAIR.z - NSTAIR.hw - 0.1) + Z1) / 2, hw: (Z1 - (NSTAIR.z - NSTAIR.hw - 0.1)) / 2, hl: 2.6, yaw: Math.PI / 2, y: WT }); // [fort-upper] overlap NSTAIR.x1 by 0.20 m only
    // [v267] rampart stair cheek colliders (visual cheeks had no footprint — jump sideways = 6 m drop to the yard)
    // [v276] BANKSY 12:02 PM "can't climb up to spy glass at all": full-span cheeks sealed the yard→stair mouth (south)
    // and pinched the top north step onto the landing. Leave ~4.5 m open at the bottom (entry) and ~2.0 m at the top
    // (stair → landing / wall-walk); cheeks only cover the fall-off mid-run.
    { const openBot = 4.5, openTop = 2.0, len = (NSTAIR.x1 - NSTAIR.x0) - openBot - openTop;
      const cx = NSTAIR.x0 + openBot + len / 2;
      // [v304] SOUTH cheek only (yard fall-off). North cheek removed: it sat at z≈-33.8 and with r=0.45
      // blocked the north-hug lane (z≈-34.4) — Attachment 1 stuck ~2-3 treads from the top when hugging the north wall.
      // NSTAIR sits fully in the courtyard south of fort_wall_n; no north fall-off collider needed.
      h.addBox(cx, NSTAIR.z - (NSTAIR.hw + 0.35), len, 0.4, 0); }
    // the keep: its walls are decks at the keep top (door gap on the west face); roofless war room inside
    const K = F.keep, kw = K.wall, kt = F.y + K.h;
    h.addDeck({ id: 'fort_keep_n', x: K.x, z: K.z + K.half - kw / 2, hw: K.half, hl: kw / 2, yaw: 0, y: kt });
    h.addDeck({ id: 'fort_keep_s', x: K.x, z: K.z - K.half + kw / 2, hw: K.half, hl: kw / 2, yaw: 0, y: kt });
    h.addDeck({ id: 'fort_keep_e', x: K.x + K.half - kw / 2, z: K.z, hw: kw / 2, hl: K.half, yaw: 0, y: kt });
    const kg = (K.half * 2 - K.doorHW * 2) / 2; for (const s of [-1, 1]) h.addDeck({ id: 'fort_keep_w' + s, x: K.x - K.half + kw / 2, z: K.z + s * (K.doorHW + kg / 2), hw: kw / 2, hl: kg / 2, yaw: 0, y: kt });
    // props: well, table, mast, dummy, crates, cannons (on the south wall-walk, outer side)
    h.addCirc(F.x - 4, F.z + 6, 1.5); h.addCirc(TABLE.x, TABLE.z, 1.4); h.addCirc(MAST.x, MAST.z, 0.4); h.addCirc(F.x - 9, F.z - 8, 0.5);
    for (let i = 0; i < 4; i++) h.addCirc(F.x - 6 + i * 4, Z0 + 0.55, 0.45); // [fort-upper] outer south rim; clear walk on inner half of WW
    h.addBox(F.x + 2.3, F.z - 8.7, 4.0, 2.6, 0);                                               // crates
    // [fort-upper] gatehouse flanking towers proud WEST of the curtain (clear of wall-walk + LEG2)
    for (const s of [-1, 1]) { const gx = X0 - 1.9, gz = F.z + s * (F.gateHW + 1.55);
      h.addBox(gx, gz, 3.0, 2.8, 0);
      h.addDeck({ id: 'fort_gatetower_' + s, x: gx, z: gz, hw: 1.5, hl: 1.4, yaw: 0, y: WT + 4.45 }); }
    h.poi('fort', 'Hilltop Fort', F.x, F.z, { clear: 22 }); h.poi('fort_stair', 'Fort stair', LEG1.x, (LEG1.z0 + LEG1.z1) / 2, { clear: 6 });
    h.INTERACT.push({ id: 'fort_table', area: 'hilltop_fort', x: TABLE.x - 2.2, z: TABLE.z, r: 2.4, label: 'E · WAR-ROOM MAP TABLE' });
    h.INTERACT.push({ id: 'fort_flag', area: 'hilltop_fort', x: MAST.x + 1.2, z: MAST.z, r: 2.4, label: 'E · RAISE THE COLOURS' });
    // [fort-upper] spacious NE spectate bastion — spyglass centred, large pad + interact
    h.addDeck({ id: 'fort_spy_pad', x: SPY.x, z: SPY.z, r: 2.6, y: WT });
    h.INTERACT.push({ id: 'fort_spyglass', area: 'hilltop_fort', x: SPY.x, z: SPY.z, r: 2.6, label: 'E · SPYGLASS · SPECTATE' });
  },
  build({ MATS, OUT, low, H }) {
    const k = new Kit(), near = new THREE.Group(), far = new THREE.Group(); near.name = 'area_fort'; far.name = 'area_fort_far';
    const Y = F.y, wh = WT - Y + 1.2, base = Y - 6, signs = [];
    const hi = !low; // desktop gets the full dress; phones skip half the trim
    // stair legs: one masonry block per tread (top = the tread you stand on, down to the lowest ground under it) + parapets
    const tread = (x, z, w, d, top, yaw = 0) => { const lo = Math.min(H(x - w / 2, z - d / 2), H(x + w / 2, z + d / 2), H(x, z)) - 0.6; W(k, box(w, top - lo, d), C.STONE, M(x, (top + lo) / 2, z, yaw), false); W(k, box(w + 0.1, 0.12, d + 0.04), TRIM, M(x, top - 0.06, z, yaw), false); };
    { const L = LEG1.z1 - LEG1.z0, n = P1.length; for (let i = 0; i < n; i++) tread(LEG1.x, LEG1.z0 + (i + 0.5) * L / n, LEG1.hw * 2, L / n + 0.02, P1[i]);
      for (const s of [-1, 1]) for (let i = 3; i < n; i += 2) { const z = LEG1.z0 + (i + 0.5) * L / n, y = P1[i]; W(k, box(0.5, 1.0, L / n * 2 + 0.05), C.STONE_D, M(LEG1.x + s * (LEG1.hw + 0.3), y + 0.5, z), i % 6 === 3); } }
    { const y = P1[P1.length - 1]; tread(LAND.x, LAND.z, LAND.hw * 2, LAND.hw * 2, y); W(k, box(0.5, 1.0, LAND.hw * 2 + 0.6), C.STONE_D, M(LAND.x - LAND.hw - 0.3, y + 0.5, LAND.z)); W(k, box(LAND.hw * 2 + 0.6, 1.0, 0.5), C.STONE_D, M(LAND.x, y + 0.5, LAND.z + LAND.hw + 0.3));
      // a lamp on the landing + a TO THE FORT fingerboard
      if(!COLISEUM_ON) { W(k, cyl(0.1, 0.13, 3.2, 6), C.IRON, M(LAND.x - LAND.hw - 0.3, y + 2.6, LAND.z + LAND.hw + 0.3)); W(k, box(0.5, 0.6, 0.5), 0xffd27a, M(LAND.x - LAND.hw - 0.3, y + 4.3, LAND.z + LAND.hw + 0.3), false); }
      W(k, cyl(0.08, 0.1, 2.4, 5), C.WOOD_D, M(LAND.x + 1.6, y + 1.2, LAND.z - 1.6)); W(k, box(1.6, 0.5, 0.08), C.WOOD, M(LAND.x + 2.3, y + 2.2, LAND.z - 1.6), false);
      if (hi) signs.push([1.45, 0.38, new THREE.Matrix4().compose(new THREE.Vector3(LAND.x + 2.3, y + 2.2, LAND.z - 1.55), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))]); }
    { const L = LEG2.x1 - LEG2.x0, n = P2.length; for (let i = 0; i < n; i++) tread(LEG2.x0 + (i + 0.5) * L / n, LEG2.z, L / n + 0.02, LEG2.hw * 2, P2[i]);
      for (const s of [-1, 1]) for (let i = 0; i < n; i += 2) { const x = LEG2.x0 + (i + 0.5) * L / n, y = P2[i]; W(k, box(L / n * 2 + 0.05, 1.0, 0.5), C.STONE_D, M(x, y + 0.5, LEG2.z + s * (LEG2.hw + 0.3)), i % 6 === 0); } }
    // curtain walls: body tops at WT - walkH so the monolithic walk floor sits flush (no z-fight). [fort-upper]
    const walkH = 0.36, WW = F.wall + RAMP, TOWER_CLEAR = 5.0, paraSpan = F.half * 2 - 2 * TOWER_CLEAR;
    const wall = (x, z, w, d) => { W(k, box(w, ((WT - walkH) - base), d), C.STONE, M(x, ((WT - walkH) + base) / 2, z)); };
    const wd = F.wall, gs = (F.half * 2 - F.gateHW * 2) / 2;
    wall(F.x, Z1 - wd / 2, F.half * 2, wd); wall(F.x, Z0 + wd / 2, F.half * 2, wd); wall(X1 - wd / 2, F.z, wd, F.half * 2);
    for (const s of [-1, 1]) wall(X0 + wd / 2, F.z + s * (F.gateHW + gs / 2), wd, gs);
    // bridging slab across the west gate at walk height (arch below stays open; soffit ~40.7)
    W(k, box(wd, walkH + 0.55, F.gateHW * 2 + 0.5), C.STONE, M(X0 + wd / 2, WT - walkH / 2 - 0.1, F.z), false);
    // outer parapet + merlons stop short of all 4 corner towers
    const para = (x, z, w, d) => { W(k, box(w, 1.25, d), C.STONE_D, M(x, WT + 0.62, z)); };
    para(F.x, Z1 - 0.28, paraSpan, 0.55); para(F.x, Z0 + 0.28, paraSpan, 0.55);
    para(X1 - 0.28, F.z, 0.55, paraSpan);
    // [v304] west outer parapet + TRIM + arrow slits SPLIT around the gate — never float bars across the arch (Attachment 2)
    for (const s of [-1, 1]) para(X0 + 0.28, F.z + s * (F.gateHW + gs / 2), 0.55, gs);
    // horizontal banding + arrow slots (outer faces); west uses gs strips either side of the gate
    for (const yy of [Y + 1.6, Y + 3.8]) {
      W(k, box(paraSpan + 0.08, 0.22, 0.18), TRIM, M(F.x, yy, Z1 + 0.05), false); W(k, box(paraSpan + 0.08, 0.22, 0.18), TRIM, M(F.x, yy, Z0 - 0.05), false);
      W(k, box(0.18, 0.22, paraSpan + 0.08), TRIM, M(X1 + 0.05, yy, F.z), false);
      for (const s of [-1, 1]) W(k, box(0.18, 0.22, gs + 0.08), TRIM, M(X0 - 0.05, yy, F.z + s * (F.gateHW + gs / 2)), false);
    }
    if (hi) {
      for (let i = 0; i < 5; i++) { const u = -paraSpan / 2 + 1.2 + i * (paraSpan - 2.4) / 4; W(k, box(0.45, 1.1, 0.18), 0x1b1d22, M(F.x + u, Y + 2.7, Z1 + 0.08), false); W(k, box(0.45, 1.1, 0.18), 0x1b1d22, M(F.x + u, Y + 2.7, Z0 - 0.08), false); W(k, box(0.18, 1.1, 0.45), 0x1b1d22, M(X1 + 0.08, Y + 2.7, F.z + u), false); }
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) W(k, box(0.18, 1.1, 0.45), 0x1b1d22, M(X0 - 0.08, Y + 2.7, F.z + s * (F.gateHW + 2.2 + i * 3.2)), false);
    }
    // merlons with coping caps — stop short of corner towers; west stops at the gate mouth
    const cren = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 1.55); for (let i = 0; i < n; i += 2) { const u = (i + 0.5) / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
      W(k, box(0.85, 1.05, 0.85), C.STONE_D, M(x, WT + 1.7, z), false); W(k, box(0.95, 0.16, 0.95), TRIM, M(x, WT + 2.28, z), false); } };
    cren(X0 + TOWER_CLEAR, Z1 - 0.25, X1 - TOWER_CLEAR, Z1 - 0.25); cren(X0 + TOWER_CLEAR, Z0 + 0.25, X1 - TOWER_CLEAR, Z0 + 0.25);
    cren(X1 - 0.25, Z0 + TOWER_CLEAR, X1 - 0.25, Z1 - TOWER_CLEAR);
    for (const s of [-1, 1]) cren(X0 + 0.25, F.z + s * F.gateHW, X0 + 0.25, F.z + s * (F.half - TOWER_CLEAR));
    // [fort-upper] BANKSY: ENTIRE upper level = ONE seamless castle STONE ShapeGeometry (added AFTER Kit merge — Kit merge NaNs Shape/Extrude).
    // Outer contour = 26×26 curtain with r=3.7 arcs at all 4 corner towers; inner hole = courtyard notched south around NSTAIR landing.
    // Support slabs (outline OFF, non-overlapping) sit under the seamless top so phones/low still read thickness.
    const walkSpan = F.half * 2 - 2 * TOWER_CLEAR;
    const sf = (x, z, w, d) => { W(k, box(w, walkH, d), C.STONE, M(x, WT - walkH / 2, z), false); };
    sf(F.x, F.z + (F.half - WW / 2), walkSpan, WW); // N
    sf(F.x, F.z - (F.half - WW / 2), walkSpan, WW); // S
    sf(F.x + (F.half - WW / 2), F.z, WW, walkSpan); // E
    sf(F.x - (F.half - WW / 2), F.z, WW, walkSpan); // W continuous over gate
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) W(k, cyl(3.55, 3.55, walkH, 20), C.STONE, M(F.x + sx * F.half, WT - walkH / 2, F.z + sz * F.half), false);
    // [fort-upper] landing notch ONLY (NSTAIR x=-416..-404 stays open to sky — no stone ceiling over the stair)
    const hx0 = X0 + WW, hx1 = X1 - WW, hz0 = Z0 + WW, hz1 = Z1 - WW;
    const sx0 = -404.05, sx1 = -399.1, szS = NSTAIR.z - NSTAIR.hw - 0.25;
    sf((sx0 + sx1) / 2, (szS + hz1) / 2, sx1 - sx0, hz1 - szS); // landing support under the notch only
    let walkTopGeo = null;
    { const TR = 3.7, sh = new THREE.Shape();
      sh.moveTo(X0 + TR, Z1); sh.lineTo(X1 - TR, Z1); sh.absarc(X1, Z1, TR, Math.PI / 2, 0, true);
      sh.lineTo(X1, Z0 + TR); sh.absarc(X1, Z0, TR, 0, -Math.PI / 2, true);
      sh.lineTo(X0 + TR, Z0); sh.absarc(X0, Z0, TR, -Math.PI / 2, Math.PI, true);
      sh.lineTo(X0, Z1 - TR); sh.absarc(X0, Z1, TR, Math.PI, Math.PI / 2, true);
      const hole = new THREE.Path();
      hole.moveTo(hx0, hz0); hole.lineTo(hx0, hz1); hole.lineTo(sx0, hz1); hole.lineTo(sx0, szS);
      hole.lineTo(sx1, szS); hole.lineTo(sx1, hz1); hole.lineTo(hx1, hz1); hole.lineTo(hx1, hz0); hole.lineTo(hx0, hz0);
      sh.holes.push(hole);
      walkTopGeo = new THREE.ShapeGeometry(sh, 48);
      walkTopGeo.rotateX(Math.PI / 2); walkTopGeo.translate(0, WT + 0.02, 0);
    }
    // inner stone kerb (0.42 m) along courtyard edge of all 4 walls + landing drop-off — NEVER across wall-walk / towers / NSTAIR
    const kerb = (x, z, w, d) => { W(k, box(w, 0.42, d), C.STONE_D, M(x, WT + 0.16, z), false); W(k, box(w + 0.04, 0.07, d + 0.04), TRIM, M(x, WT + 0.40, z), false); };
    const ki = F.half - WW, kx0 = X0 + WW + 0.15, kx1 = X1 - WW - 0.15, kz0 = Z0 + WW + 0.15, kz1 = Z1 - WW - 0.15;
    // north kerb split around landing mouth (stair itself stays clear)
    { const g0 = sx0 - 0.1, g1 = sx1 + 0.1;
      kerb((kx0 + g0) / 2, kz1, Math.max(0.5, g0 - kx0), 0.32);
      kerb((g1 + kx1) / 2, kz1, Math.max(0.5, kx1 - g1), 0.32);
      kerb((sx0 + sx1) / 2, szS + 0.16, sx1 - sx0, 0.32); // south edge of landing drop-off
      kerb(sx1 - 0.16, (szS + kz1) / 2, 0.32, Math.max(0.5, kz1 - szS)); // east edge of landing
    }
    kerb(F.x, kz0, kx1 - kx0, 0.32); // south
    kerb(kx1, F.z, 0.32, kz1 - kz0); // east
    kerb(kx0, F.z, 0.32, kz1 - kz0); // west (continuous over gate — inner face)
    // corner towers: round body + outer-arc crenels/canopy posts only (inner ~150° into wall-walks stays open). [fort-upper]
    // [v309] NE in-game [+1,-1] opens merlon embrasure toward waterfall zipline; nudge canopy posts clear of the gap
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = F.x + sx * F.half, z = F.z + sz * F.half, inward = Math.atan2(-sz, -sx);
      const open = (a) => { let d = a - inward; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d) < Math.PI * 75 / 180; };
      const isZipTurret = ZIP_ON && sx === 1 && sz === -1;
      const zipGap = (a) => { if (!isZipTurret) return false; let d = a - ZIP_A_NE; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d) < 0.55; };
      W(k, cyl(3.4, 3.8, (WT - walkH) - base, 12), C.STONE, M(x, ((WT - walkH) + base) / 2, z));
      for (const yy of [Y + 1.8, Y + 4.2]) W(k, cyl(3.55, 3.55, 0.22, 12), C.STONE_D, M(x, yy, z), false);
      if (hi) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; if (open(a) || zipGap(a)) continue; W(k, box(0.5, 1.15, 0.18), 0x1b1d22, M(x + Math.cos(a) * 3.45, Y + 2.9, z + Math.sin(a) * 3.45, -a), false); }
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (open(a) || zipGap(a)) continue; W(k, box(0.95, 1.05, 0.65), C.STONE_D, M(x + Math.cos(a) * 3.2, WT + 0.55, z + Math.sin(a) * 3.2, -a), false); W(k, box(1.05, 0.14, 0.75), TRIM, M(x + Math.cos(a) * 3.2, WT + 1.12, z + Math.sin(a) * 3.2, -a), false); }
      // canopy posts on outer arc at r=3.15 — never inside wall-walk mouths; [v309] keep ≥0.50 rad clear of zip embrasure
      for (let a of [inward + Math.PI * 0.55, inward + Math.PI * 0.9, inward + Math.PI * 1.1, inward + Math.PI * 1.45]) {
        if (isZipTurret) {
          let d = a - ZIP_A_NE; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) < 0.58) a = ZIP_A_NE + (d >= 0 ? 0.58 : -0.58);
        }
        W(k, cyl(0.16, 0.18, 3.6, 6), C.STONE_D, M(x + Math.cos(a) * 3.15, WT + 1.8, z + Math.sin(a) * 3.15), false);
      }
      W(k, new THREE.ConeGeometry(3.95, 3.4, 12), ROOF, M(x, WT + 5.3, z)); W(k, new THREE.ConeGeometry(3.6, 0.5, 12), ROOF_D, M(x, WT + 3.7, z), false);
      W(k, ball(0.28, 8, 6), C.GOLD, M(x, WT + 7.15, z), false); W(k, cyl(0.04, 0.04, 0.9, 4), C.IRON, M(x, WT + 7.6, z), false); W(k, box(0.04, 0.45, 0.7), RED_B, M(x, WT + 7.9, z + 0.3), false); }
    // gatehouse: two taller square towers proud west of curtain (clear of wall-walk). [fort-upper]
    for (const s of [-1, 1]) { const z = F.z + s * (F.gateHW + 1.55), gx = X0 - 1.9;
      W(k, box(3.0, WT + 5.2 - base, 2.8), C.STONE_D, M(gx, (WT + 5.2 + base) / 2, z));
      // stepped corbel collar + crenellated cap
      W(k, box(3.7, 0.28, 3.1), TRIM, M(gx, WT + 4.55, z), false); W(k, box(3.9, 0.22, 3.3), C.STONE, M(gx, WT + 4.85, z), false);
      for (let i = 0; i < 3; i++) for (const side of [-1, 1]) W(k, box(0.7, 0.9, 0.55), C.STONE_D, M(gx + side * (1.1 - i * 0.05), WT + 5.4, z - 1.1 + i * 1.1), false);
      W(k, box(3.6, 0.18, 3.0), TRIM, M(gx, WT + 5.95, z), false);
      // quoin edges + banding
      for (const qx of [-1.55, 1.55]) for (const qz of [-1.25, 1.25]) W(k, box(0.35, WT + 5 - base, 0.35), TRIM, M(gx + qx, (WT + 5 + base) / 2, z + qz), false);
      for (const yy of [Y + 2.0, Y + 4.5, WT + 1.5]) W(k, box(3.55, 0.2, 2.95), yy > WT ? GOLD_D : C.STONE, M(gx, yy, z), false);
      if (hi) for (const yy of [Y + 3.0, WT + 0.5]) W(k, box(0.55, 1.2, 0.18), 0x1b1d22, M(gx - 1.75, yy, z), false);
      // banners (red south, black north) with gold fringe
      W(k, box(0.08, 3.4, 1.5), s < 0 ? C.RED : 0x1a1a1a, M(X0 - 1.2, WT - 1.4, z), false); W(k, box(0.1, 0.12, 1.55), C.GOLD, M(X0 - 1.2, WT + 0.35, z), false);
      for (let i = 0; i < 5; i++) W(k, box(0.06, 0.25, 0.12), C.GOLD, M(X0 - 1.2, WT - 3.2, z - 0.6 + i * 0.3), false);
      // wall lantern
      W(k, box(0.08, 0.08, 0.55), C.IRON, M(X0 - 0.9, WT - 0.2, z + s * 0.2), false); W(k, box(0.32, 0.42, 0.32), 0xffd27a, M(X0 - 1.15, WT - 0.5, z + s * 0.2), false); W(k, box(0.4, 0.08, 0.4), C.IRON, M(X0 - 1.15, WT - 0.25, z + s * 0.2), false); }
    // arch lintel + voussoirs + raised portcullis
    W(k, box(1.6, 1.14, F.gateHW * 2 + 0.4), C.STONE_D, M(X0 + 0.8, 41.07, F.z)); W(k, box(0.7, 0.7, F.gateHW * 2 + 0.2), TRIM, M(X0 - 1.05, 40.7 - 0.35, F.z), false); // lintel top = WT-walkH=41.64; soffit ~40.5; flush inside curtain
    if (hi) for (let i = -2; i <= 2; i++) W(k, box(0.55, 0.55, 0.45), TRIM, M(X0 - 0.55, WT - 0.55, F.z + i * 0.75), false); // voussoir row
    for (let i = 0; i < 6; i++) W(k, box(0.12, 1.7, 0.12), C.IRON, M(X0 - 0.2, WT - 2.2, F.z - F.gateHW + 0.3 + i * (F.gateHW * 2 - 0.6) / 5), false);
    W(k, box(0.12, 0.12, F.gateHW * 2 - 0.4), C.IRON, M(X0 - 0.2, WT - 3.0, F.z), false);
    // chains holding the portcullis
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) W(k, cyl(0.04, 0.04, 0.22, 5), C.IRON, M(X0 - 0.55, WT - 0.4 - i * 0.28, F.z + s * (F.gateHW - 0.3)), false);
    // HILLTOP FORT board on outer west face (flush under parapet — never onto the wall-walk)
    W(k, box(0.14, 1.1, 4.4), C.WOOD_D, M(X0 - 0.35, WT - 0.55, F.z)); W(k, box(0.16, 0.12, 4.55), C.GOLD, M(X0 - 0.33, WT + 0.05, F.z), false); W(k, box(0.16, 0.12, 4.55), C.GOLD, M(X0 - 0.33, WT - 1.15, F.z), false);
    signs.push([4.15, 0.85, new THREE.Matrix4().compose(new THREE.Vector3(X0 - 0.42, WT - 0.55, F.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1))]);
    // wooden gate leaves (concept B3): plank doors with iron straps + studs, swung open into the yard
    for (const s of [-1, 1]) { const z = F.z + s * (F.gateHW + 0.08);
      W(k, box(2.15, 4.6, 0.2), C.WOOD_D, M(X0 + 2.85, Y + 2.3, z)); for (const yy of [0.7, 2.3, 3.9]) W(k, box(2.2, 0.18, 0.26), C.IRON, M(X0 + 2.85, Y + yy, z), false);
      if (hi) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) W(k, ball(0.06, 6, 4), C.IRON, M(X0 + 2.4 + c * 0.35, Y + 1.1 + r * 1.2, z + s * 0.12), false);
      W(k, box(0.32, 5.1, 0.32), C.WOOD, M(X0 + 1.75, Y + 2.55, z), false); W(k, box(0.18, 0.5, 0.18), C.IRON, M(X0 + 3.7, Y + 2.3, z + s * 0.05), false); }
    // yard floor: packed earth + ring of flagstones + inner cobble ring around the mast
    W(k, box(F.half * 2 - 2 * wd, 0.1, F.half * 2 - 2 * wd), 0xb3a58c, M(F.x, Y + 0.03, F.z), false);
    const nFlag = hi ? 48 : 24; for (let i = 0; i < nFlag; i++) { const a = hash(i, 3) * 20 - 10, b = hash(i, 4) * 20 - 10; if (Math.hypot(a, b) < 3.2) continue;
      W(k, box(1.15 + hash(i, 5) * 0.4, 0.06, 0.85 + hash(i, 6) * 0.35), i % 3 ? 0xa89c86 : 0xc4b9a4, M(F.x + a, Y + 0.09, F.z + b, hash(i, 7)), false); }
    // raised circular flag base (concept: centre of courtyard)
    W(k, cyl(2.2, 2.4, 0.35, 16), C.STONE_D, M(MAST.x, Y + 0.18, MAST.z)); W(k, cyl(1.7, 1.7, 0.12, 16), TRIM, M(MAST.x, Y + 0.4, MAST.z), false);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; W(k, box(0.35, 0.28, 0.5), C.STONE, M(MAST.x + Math.cos(a) * 2.15, Y + 0.2, MAST.z + Math.sin(a) * 2.15, -a), false); }
    // the north-wall stair (with cheek walls + lamp at the top)
    { const n = 28, L = NSTAIR.x1 - NSTAIR.x0; for (let i = 0; i < n; i++) { const top = Y + (WT - Y) * (i + 1) / n; W(k, box(L / n + 0.02, top - Y + 0.1, NSTAIR.hw * 2), C.STONE, M(NSTAIR.x0 + (i + 0.5) * L / n, (top + Y - 0.1) / 2, NSTAIR.z), false); }
      for (const s of [-1, 1]) for (let i = 0; i < n; i += (hi ? 2 : 3)) { if (s > 0 && i > n - 9) continue; const top = Y + (WT - Y) * (i + 1) / n; W(k, box(L / n * 2 + 0.04, 0.85, 0.35), C.STONE_D, M(NSTAIR.x0 + (i + 0.5) * L / n, top + 0.4, NSTAIR.z + s * (NSTAIR.hw + 0.2)), false); }
      W(k, cyl(0.08, 0.1, 2.6, 5), C.IRON, M(NSTAIR.x0 + 0.4, Y + 1.3, NSTAIR.z - NSTAIR.hw - 0.4)); W(k, box(0.4, 0.5, 0.4), 0xffd27a, M(NSTAIR.x0 + 0.4, Y + 2.7, NSTAIR.z - NSTAIR.hw - 0.4), false);
      // [fort-upper] landing under-masonry: south face + east face only (NO west wall — stairs come up at sx0)
      { const z0 = szS + 0.25, z1 = hz1, lx = (sx0 + sx1) / 2, lw = sx1 - sx0, lz = (z0 + z1) / 2, ld = Math.max(0.8, z1 - z0);
        W(k, box(lw, WT - Y - 0.15, 0.7), C.STONE_D, M(lx, (WT + Y) / 2 - 0.05, z0), false); // south face
        W(k, box(0.7, WT - Y - 0.15, ld), C.STONE_D, M(sx1 - 0.25, (WT + Y) / 2 - 0.05, lz), false); } // east face
    }
    // the keep: taller dress, quoins, windows, WAR ROOM door, beams, map table, corner lookout turret (concept round tower)
    { const K = F.keep, kw = K.wall, kt = Y + K.h, kg = (K.half * 2 - K.doorHW * 2) / 2;
      W(k, box(K.half * 2, K.h + 1.4, kw), C.STONE_D, M(K.x, Y + (K.h - 0.6) / 2, K.z + K.half - kw / 2)); W(k, box(K.half * 2, K.h + 1.4, kw), C.STONE_D, M(K.x, Y + (K.h - 0.6) / 2, K.z - K.half + kw / 2));
      W(k, box(kw, K.h + 1.4, K.half * 2), C.STONE_D, M(K.x + K.half - kw / 2, Y + (K.h - 0.6) / 2, K.z));
      for (const s of [-1, 1]) W(k, box(kw, K.h + 1.4, kg), C.STONE_D, M(K.x - K.half + kw / 2, Y + (K.h - 0.6) / 2, K.z + s * (K.doorHW + kg / 2)));
      // [v276] raise door clear to ~4.0 m (was 2.6) so war-room camera / headroom at the table isn't soffit-clipped
      W(k, box(kw + 0.15, K.h - 4.0, K.doorHW * 2 + 0.4), C.STONE_D, M(K.x - K.half + kw / 2, Y + 4.0 + (K.h - 4.0) / 2, K.z)); // over the door
      // quoins + cornice + banding
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) W(k, box(0.4, K.h + 1.4, 0.4), TRIM, M(K.x + sx * (K.half - 0.15), Y + (K.h - 0.6) / 2, K.z + sz * (K.half - 0.15)), false);
      // [v276] BANKSY 12:03 PM "war room table … low ceiling": banding was a SOLID full-footprint slab
      // (Y+2.2 / Y+5.0 / kt-0.4) so the war room read as a low ceiling over the map table. Exterior face strips only;
      // west face leaves the door gap open (a full-span west strip sat at Y+2.2 across the doorway = the low lintel).
      for (const yy of [Y + 5.0, kt - 0.4]) { // [v276] drop Y+2.2 belt (sat at door-head height)
        const col = yy > kt - 1 ? GOLD_D : C.STONE, t = 0.22;
        W(k, box(K.half * 2 + 0.2, 0.2, t), col, M(K.x, yy, K.z + K.half + 0.02), false);
        W(k, box(K.half * 2 + 0.2, 0.2, t), col, M(K.x, yy, K.z - K.half - 0.02), false);
        W(k, box(t, 0.2, K.half * 2 + 0.2), col, M(K.x + K.half + 0.02, yy, K.z), false);
        for (const s of [-1, 1]) W(k, box(t, 0.2, kg), col, M(K.x - K.half - 0.02, yy, K.z + s * (K.doorHW + kg / 2)), false); }
      // windows (N/S/E)
      if (hi) for (const [dx, dz, yaw] of [[0, K.half + 0.05, 0], [0, -K.half - 0.05, 0], [K.half + 0.05, 0, Math.PI / 2]]) for (const yy of [Y + 3.4, Y + 6.2]) {
        W(k, box(dx ? 0.18 : 0.7, 1.15, dz ? 0.18 : 0.7), 0x1b1d22, M(K.x + dx, yy, K.z + dz, yaw), false); W(k, box(dx ? 0.22 : 0.85, 0.12, dz ? 0.22 : 0.85), TRIM, M(K.x + dx, yy + 0.65, K.z + dz, yaw), false); }
      // door frame (open) + studded leaves parked inside
      // [hilltop] BANKSY 10:11 PM "the door has been closed": the frame was one solid 3.3 m board across the doorway; now two jambs + a lintel, the doorway open
      for (const s of [-1, 1]) W(k, box(0.3, 4.0, 0.32), C.WOOD_D, M(K.x - K.half - 0.08, Y + 2.0, K.z + s * (K.doorHW + 0.12)), false);
      W(k, box(0.3, 0.34, K.doorHW * 2 + 0.7), C.WOOD_D, M(K.x - K.half - 0.08, Y + 4.05, K.z), false);
      for (const s of [-1, 1]) { W(k, box(0.16, 2.9, 1.15), C.WOOD, M(K.x - K.half + 0.55, Y + 1.45, K.z + s * 1.35), false); for (const yy of [0.6, 1.45, 2.3]) W(k, box(0.2, 0.12, 1.2), C.IRON, M(K.x - K.half + 0.55, Y + yy, K.z + s * 1.35), false); }
      // WAR ROOM board over the raised door
      W(k, box(0.12, 0.7, 2.6), C.WOOD_D, M(K.x - K.half - 0.2, Y + 5.0, K.z)); W(k, box(0.14, 0.1, 2.7), C.GOLD, M(K.x - K.half - 0.18, Y + 5.4, K.z), false);
      signs.push([2.4, 0.5, new THREE.Matrix4().compose(new THREE.Vector3(K.x - K.half - 0.28, Y + 5.0, K.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1)), 'war']);
      // roof beams + merlons on the keep top
      for (let i = 0; i < 4; i++) W(k, box(K.half * 2 - 1, 0.35, 0.35), C.WOOD_D, M(K.x, kt - 0.6, K.z - K.half + 1.6 + i * 2.3), false);
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { W(k, box(0.85, 0.95, 0.85), C.STONE, M(K.x + s * (K.half - 0.4), kt + 1.0, K.z - K.half + 0.8 + i * 2.8), false); W(k, box(0.95, 0.14, 0.95), TRIM, M(K.x + s * (K.half - 0.4), kt + 1.55, K.z - K.half + 0.8 + i * 2.8), false); }
      // floor planks inside the war room
      W(k, box(K.half * 2 - 1.6, 0.08, K.half * 2 - 1.6), C.WOOD, M(K.x, Y + 0.06, K.z), false);
      // map table: chunky trestles, the chart, a dagger + compass + ink + candle
      W(k, box(2.8, 0.2, 1.85), C.WOOD, M(TABLE.x, Y + 1.02, TABLE.z)); for (const s of [-1, 1]) W(k, box(0.22, 0.98, 1.5), C.WOOD_D, M(TABLE.x + s * 1.05, Y + 0.5, TABLE.z), false);
      W(k, box(2.35, 0.03, 1.5), PARCH, M(TABLE.x, Y + 1.14, TABLE.z), false); W(k, box(0.45, 0.04, 0.07), C.RED, M(TABLE.x + 0.45, Y + 1.17, TABLE.z + 0.25, 0.7), false); W(k, box(0.07, 0.04, 0.45), C.RED, M(TABLE.x + 0.45, Y + 1.17, TABLE.z + 0.25, 0.7), false);
      W(k, cyl(0.16, 0.16, 0.05, 10), C.GOLD, M(TABLE.x - 0.7, Y + 1.16, TABLE.z - 0.35), false); W(k, cyl(0.06, 0.08, 0.12, 8), C.IRON, M(TABLE.x + 0.9, Y + 1.18, TABLE.z - 0.45), false); W(k, cyl(0.03, 0.03, 0.18, 5), C.WHITE, M(TABLE.x + 0.9, Y + 1.32, TABLE.z - 0.45), false); W(k, ball(0.05, 6, 4), 0xffd27a, M(TABLE.x + 0.9, Y + 1.42, TABLE.z - 0.45), false);
      W(k, box(0.55, 1.25, 0.45), C.WOOD_D, M(K.x + 2.8, Y + 0.62, K.z + 3.2)); W(k, box(0.75, 0.08, 0.55), PARCH, M(K.x + 2.8, Y + 1.3, K.z + 3.2, 0, 0.3), false);
      // wall banners inside + lanterns
      for (const [dx, dz] of [[-3.6, 3.4], [-3.6, -3.4], [3.4, 3.4], [3.4, -3.4]]) { W(k, cyl(0.05, 0.05, 1.5, 4), C.IRON, M(K.x + dx, Y + 2.5, K.z + dz), false); W(k, box(0.32, 0.42, 0.32), 0xffd27a, M(K.x + dx, Y + 3.35, K.z + dz), false); }
      if (hi) { W(k, box(0.06, 2.2, 1.1), C.RED, M(K.x + 0.2, Y + 4.5, K.z + K.half - 0.5), false); W(k, box(0.06, 2.2, 1.1), 0x1a1a1a, M(K.x + 0.2, Y + 4.5, K.z - K.half + 0.5), false); }
      // corner lookout turret on the SE keep corner (reads as the concept's round keep)
      { const tx = K.x + K.half - 0.2, tz = K.z - K.half + 0.2, r = 1.55;
        W(k, cyl(r, r + 0.1, 6.5, 12), C.STONE, M(tx, kt + 2.0, tz)); for (const yy of [kt + 0.3, kt + 3.2, kt + 5.0]) W(k, cyl(r + 0.12, r + 0.12, 0.22, 12), yy > kt + 4 ? TRIM : GOLD_D, M(tx, yy, tz), false);
        if (hi) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.5; W(k, box(0.4, 0.9, 0.14), 0x1b1d22, M(tx + Math.cos(a) * (r + 0.02), kt + 2.4, tz + Math.sin(a) * (r + 0.02), -a), false); }
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; W(k, box(0.55, 0.75, 0.4), C.STONE_D, M(tx + Math.cos(a) * (r - 0.05), kt + 5.55, tz + Math.sin(a) * (r - 0.05), -a), false); }
        W(k, new THREE.ConeGeometry(r + 0.35, 2.4, 12), ROOF, M(tx, kt + 7.0, tz)); W(k, ball(0.2, 8, 6), C.GOLD, M(tx, kt + 8.3, tz), false); } }
    // yard props: the well, crates + barrels, the training dummy + weapon rack, torch posts
    { const x = F.x - 4, z = F.z + 6; W(k, cyl(1.35, 1.45, 1.0, 12), C.STONE, M(x, Y + 0.5, z)); W(k, cyl(1.05, 1.05, 0.12, 12), 0x2b5d6a, M(x, Y + 0.92, z), false);
      for (const s of [-1, 1]) W(k, box(0.18, 2.3, 0.18), C.WOOD_D, M(x + s * 1.15, Y + 1.65, z), false); W(k, box(2.7, 0.18, 0.22), C.WOOD_D, M(x, Y + 2.8, z), false);
      W(k, cyl(0.16, 0.2, 0.35, 8), C.WOOD, M(x, Y + 2.55, z + 0.9), false); W(k, cyl(0.04, 0.04, 1.1, 5), C.IRON, M(x, Y + 2.1, z + 0.5, 0.6), false); } // bucket on a rope
    for (let i = 0; i < (hi ? 8 : 5); i++) { const x = F.x + 0.6 + (i % 4) * 1.25, z = F.z - 9.4 + Math.floor(i / 4) * 1.2; W(k, box(1.1, 1.1, 1.1), i % 2 ? C.WOOD : C.WOOD_L, M(x, Y + 0.55, z, hash(i, 2) * 0.4)); }
    for (let i = 0; i < (hi ? 4 : 2); i++) W(k, cyl(0.45, 0.5, 0.85, 10), C.WOOD_D, M(F.x + 5.5 + (i % 2) * 1.1, Y + 0.42, F.z - 8.5 + Math.floor(i / 2) * 1.1), false);
    { const x = F.x - 9, z = F.z - 8; W(k, cyl(0.12, 0.12, 1.9, 5), C.WOOD_D, M(x, Y + 0.95, z)); W(k, box(1.45, 0.18, 0.18), C.WOOD_D, M(x, Y + 1.55, z), false); W(k, cyl(0.4, 0.34, 0.85, 8), 0xd9c08a, M(x, Y + 1.3, z)); W(k, ball(0.32, 8, 6), 0xd9c08a, M(x, Y + 2.0, z));
      W(k, box(0.22, 1.7, 2.4), C.WOOD_D, M(X0 + wd + 0.35, Y + 0.85, F.z - 8), false); for (let i = 0; i < 5; i++) W(k, box(0.06, 1.55, 0.06), 0xc0c4cc, M(X0 + wd + 0.55, Y + 0.95, F.z - 8.9 + i * 0.45), false); }
    // torch posts flanking the keep door + gate inside
    for (const [x, z] of [[KDoorX(), F.z - 3.2], [KDoorX(), F.z + 3.2], [X0 + 4.5, F.z - 3.5], [X0 + 4.5, F.z + 3.5]]) {
      W(k, cyl(0.1, 0.12, 2.8, 5), C.WOOD_D, M(x, Y + 1.4, z)); W(k, box(0.35, 0.45, 0.35), 0xffd27a, M(x, Y + 2.95, z), false); W(k, box(0.42, 0.08, 0.42), C.IRON, M(x, Y + 3.2, z), false); }
    function KDoorX() { return F.keep.x - F.keep.half - 1.6; }
    // the 4 cannons on the south wall-walk, pointing out over the bay (carriages + iron barrels + balls)
    for (let i = 0; i < 4; i++) { const x = F.x - 6 + i * 4, z = Z0 + 0.55; // [fort-upper] outer rim; walk clear inward
      W(k, box(1.15, 0.55, 1.55), C.WOOD_D, M(x, WT + 0.28, z)); for (const s of [-1, 1]) W(k, cyl(0.22, 0.22, 0.18, 8), C.WOOD, M(x + s * 0.55, WT + 0.22, z + 0.35, 0, Math.PI / 2), false);
      W(k, cyl(0.28, 0.36, 2.35, 10), C.IRON, M(x, WT + 0.78, z - 0.55, 0, Math.PI / 2 - 0.08)); W(k, ball(0.14, 6, 4), C.IRON, M(x + 0.55, WT + 0.35, z + 0.5), false); }
    // the spyglass on its tripod (NE tower top) — brass tube aimed at the bay; [v267b] iron legs (no timber on the stone upper deck)
    { const x = SPY.x, z = SPY.z;
      for (const a of [0, 2.1, 4.2]) W(k, cyl(0.05, 0.05, 1.35, 5), C.IRON, M(x + Math.cos(a) * 0.45, WT + 0.55, z + Math.sin(a) * 0.45, 0, 0.55), false);
      W(k, cyl(0.08, 0.08, 0.25, 6), C.IRON, M(x, WT + 1.15, z), false); W(k, cyl(0.09, 0.14, 1.35, 8), C.GOLD, M(x, WT + 1.45, z - 0.35, 0, Math.PI / 2 - 0.28), false);
      W(k, cyl(0.16, 0.16, 0.12, 8), GOLD_D, M(x, WT + 1.55, z - 0.95, 0, Math.PI / 2 - 0.28), false); }
    near.add(k.build(MATS, OUT));
    if (walkTopGeo) { // seamless top — separate mesh so Kit merge cannot NaN the ShapeGeometry
      const m = new THREE.MeshLambertMaterial({ color: C.STONE });
      const mesh = new THREE.Mesh(walkTopGeo, m); mesh.name = 'fort_walk_floor'; near.add(mesh);
    }
    // sign boards (shared HILLTOP FORT / WAR ROOM canvas) — 0 on phones for the landing fingerboard already gated by hi
    if (typeof document !== 'undefined' && signs.length) {
      const groups = { fort: [], war: [] };
      for (const s of signs) (s[3] === 'war' ? groups.war : groups.fort).push(s);
      for (const [key, title, sub] of [['fort', 'HILLTOP FORT', 'WAR ROOM · RAMPARTS'], ['war', 'WAR ROOM', 'MAP TABLE · COLOURS']]) {
        const list = groups[key]; if (!list.length) continue;
        const pos = [], uv = [], idx = []; let baseI = 0;
        for (const [w, h, m] of list) { const pg = new THREE.PlaneGeometry(w, h); pg.applyMatrix4(m);
          pos.push(...pg.attributes.position.array); uv.push(...pg.attributes.uv.array); idx.push(...Array.from(pg.index.array, v => v + baseI)); baseI += pg.attributes.position.count; pg.dispose(); }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx);
        const tex = fortSignTex(title, sub); const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); sm.name = 'fort_signs_' + key; near.add(sm);
        document.fonts?.load?.('120px "Just Another Hand"').then(() => { const t2 = fortSignTex(title, sub); sm.material.map = t2; sm.material.needsUpdate = true; tex.dispose(); }).catch(() => {}); } }
    // the flag mast: the pirate flag goes up when you RAISE THE COLOURS (today, local)
    const mast = new Kit(); W(mast, cyl(0.14, 0.18, 13, 6), C.WOOD_D, M(MAST.x, Y + 6.5, MAST.z)); W(mast, ball(0.28, 6, 4), C.GOLD, M(MAST.x, Y + 13.2, MAST.z), false); near.add(mast.build(MATS, OUT));
    const flag = new THREE.Group(); { const fm = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.85), pfpFlagMaterial()); fm.position.set(1.45, 0, 0); fm.name = 'fort_pfp_flag'; flag.add(fm); }   // [hilltop] the Pumpfun Pirates flag
    flag.name = 'fort_flag_live'; flag.userData.live = true; /* [flagfix] opt.js freezeStatic froze this group's matrix (v304), so the raise never showed */ flag.position.set(MAST.x, Y + 3.4, MAST.z); near.add(flag);
    const up = () => fortFlagIsUp(); let fy = up() ? 11.5 : 3.4, fyT = fy; flag.position.y = Y + fy;
    // far impostor: walls with a west gate notch, towers + cones, keep + turret, the stair — still reads as a fort
    const kf = new Kit();
    W(kf, box(F.half * 2, wh + 6, F.half * 2 - 1.5), C.STONE, M(F.x + 0.4, (WT + 1.2 + base) / 2, F.z), false); // slight east bias so the gate face reads open from the west
    for (const s of [-1, 1]) W(kf, box(3.0, wh + 8, 2.6), C.STONE_D, M(X0 - 1.9, (WT + 3 + base) / 2, F.z + s * (F.gateHW + 1.55)), false);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { W(kf, cyl(3.4, 3.8, WT - base, 8), C.STONE, M(F.x + sx * F.half, (WT + base) / 2, F.z + sz * F.half), false); W(kf, new THREE.ConeGeometry(3.9, 3.4, 8), ROOF, M(F.x + sx * F.half, WT + 5.3, F.z + sz * F.half), false); }
    W(kf, box(F.keep.half * 2, F.keep.h + 1.4, F.keep.half * 2), C.STONE_D, M(F.keep.x, Y + (F.keep.h - 0.6) / 2, F.keep.z), false);
    W(kf, cyl(1.6, 1.7, 6.5, 8), C.STONE, M(F.keep.x + F.keep.half, Y + F.keep.h + 2.0, F.keep.z - F.keep.half), false); W(kf, new THREE.ConeGeometry(1.9, 2.4, 8), ROOF, M(F.keep.x + F.keep.half, Y + F.keep.h + 7.0, F.keep.z - F.keep.half), false);
    W(kf, box(LEG1.hw * 2, 6, LEG1.z1 - LEG1.z0), C.STONE, M(LEG1.x, (Y20 + LEG1.y1) / 2 - 2, (LEG1.z0 + LEG1.z1) / 2), false); far.add(kf.build(MATS, OUT));
    return { near, far, flag, raise() { fyT = 11.5; }, lower() { fy = fyT = 3.4; flag.position.y = Y + fy; }, snapUp() { fy = fyT = 11.5; flag.position.y = Y + fy; }, tick(t) { if (fortFlagIsUp()) fyT = 11.5; /* [castle-flag-daily] claimed today → climb / stay up */ const dt = 1 / 60; if (Math.abs(fyT - fy) > 0.01) { fy += Math.sign(fyT - fy) * Math.min(Math.abs(fyT - fy), 3 * dt); flag.position.y = Y + fy; } flag.rotation.y = Math.sin(t * 1.3) * 0.15; } };
  },
  label(q) {
    if (q.id !== 'fort_flag') return null;
    if (!FLAG_DAILY) return fortFlagIsUp() ? 'THE COLOURS ARE FLYING' : 'RAISE THE COLOURS';
    // [castle-flag-daily] holder status comes from dock areaApi.holder() (set each frame / on interact)
    const h = (typeof globalThis !== 'undefined' && globalThis.__pfpFlagDailyHolder) || null;
    if (h && h.on && h.claimed) return `COME BACK TOMORROW · ${untilIndyMidnight()}`;
    if (h && h.on && !h.claimed) return `RAISE THE COLOURS · +${HOLDER_DAILY_GOLD} GOLD`;
    return fortFlagIsUp() ? 'THE COLOURS ARE FLYING' : 'RAISE THE COLOURS';
  },
  activate(q, t, api, b) {
    if (q.id === 'fort_flag') {
      if (FLAG_DAILY) return flagDailyActivate(api, b);
      const first = !fortFlagIsUp(); store.upd(o => { o.fortFlag = indyDay(); o.fortFlags = (o.fortFlags || 0) + (first ? 1 : 0); }); b?.raise();
      return first ? `THE JOLLY ROGER FLIES OVER THE FORT!<br><small>raised ${store.get().fortFlags} day${store.get().fortFlags > 1 ? 's' : ''} · come back tomorrow</small>` : 'THE COLOURS ARE ALREADY FLYING<br><small>come back tomorrow</small>';
    }
    if (q.id === 'fort_table') { const m = api?.mapSpot?.() || null;
      return `THE WAR-ROOM TABLE<br><small>${m ? 'your treasure map: X marks ' + m : 'an old chart of the island: the cove, the lagoon falls, the jungle temple…'}<br>"Held by the Brethren since the Siege of the Skull: the guns face the bay, the stair faces the town."${AREA_GOLD_ON ? '' : ''}</small>`; }
    if (q.id === 'fort_spyglass') return null; // [v252] handled in dock/index.js interact() (arena spectate)
    return null;
  },
};
export const _fortPending = PENDING;

// [castle-flag-daily] raise the mast + call the existing holder_claim (server unchanged). Returns a toast string or a Promise of one.
function flagDailyActivate(api, b) {
  const h = api?.holder?.() || (typeof globalThis !== 'undefined' && globalThis.__pfpFlagDailyHolder) || null;
  const left = untilIndyMidnight();
  // already claimed today → flag stays / goes up, no second payout
  if (h && h.on && h.claimed) { markFortFlagRaised(); b?.raise(); return `COME BACK TOMORROW<br><small>daily gold already claimed · resets in ${left}</small>`; }
  // holder, not claimed → raise + server claim
  if (h && h.on && !h.claimed && api?.claimDaily) {
    b?.raise(); markFortFlagRaised();
    const pending = api.claimDaily();
    return Promise.resolve(pending).then((r) => {
      const g = (r && r.gold) | 0;
      store.upd(o => { o.fortFlags = (o.fortFlags || 0) + 1; });
      return `THE JOLLY ROGER FLIES · +${g || HOLDER_DAILY_GOLD} DAILY GOLD!<br><small>come back tomorrow · resets in ${untilIndyMidnight()}</small>`;
    }).catch((e) => {
      if (e?.status === 409) { markFortFlagRaised(); b?.raise(); return `COME BACK TOMORROW<br><small>already claimed · resets in ${untilIndyMidnight()}</small>`; }
      if (e?.status === 403) return 'HOLDER YOUR WALLET<br><small>hold $SUNK or $AHOY to claim daily gold</small>';
      return `COULD NOT CLAIM<br><small>${String(e?.message || e).slice(0, 80)}</small>`;
    });
  }
  // not a holder (or holder status not ready): cosmetic raise only, point them at the perk
  const first = !fortFlagIsUp(); markFortFlagRaised(); if (first) store.upd(o => { o.fortFlags = (o.fortFlags || 0) + 1; }); b?.raise();
  if (!h || !h.on) return `THE JOLLY ROGER FLIES OVER THE FORT!<br><small>holders of $SUNK / $AHOY claim +${HOLDER_DAILY_GOLD} gold here once a day</small>`;
  return first ? `THE JOLLY ROGER FLIES OVER THE FORT!<br><small>come back tomorrow</small>` : `COME BACK TOMORROW<br><small>resets in ${left}</small>`;
}

