// [Timothy] PUMPFUN PIRATES headland battery (BANKSY: "clear the trees around the cannons, add a way up there, and allow players
// to shoot the cannons"). Pure data + art for the cliff-top fort battery on Raul's coast headland (coast.js HEADLAND), town-local
// frame (lx along the waterfront, +lz out to sea). js/island/foot.js calls four hooks (terrain, paint, foliage clear, art) and
// createGuns(); the firing (prompt, aim, FX, cosmetic balls, peers) lives in js/dock/battery.js.
//   gun deck: a flat paved disc on the headland top (y 21) with a parapet arc and 6 guns facing the open sea
//   way up: a stone ramp (grade ~1:3, 8 m wide) along the headland's landward foot from the quay's east end, then a flat landing
// Every walkable surface is the terrain itself (stamped into foot.js Hg), so feet sit on the drawn ground; walls are colliders.
import * as THREE from 'three';
import { Kit, M } from './kit.js';
import * as CO from './coast.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const BATTERY = { lx: 160, lz: 42, ring: 15, y: 21, deckR: 22, paveR: 20 };
// edges sit on foot.js's 4 m terrain grid lines (town lx = 2 mod 4, lz = 0 mod 4), so every walkable cell is planar: the drawn
// triangles and the bilinear walk height H() agree to the millimetre (feet never sink at a ramp edge or the ramp -> landing kink)
export const RAMP = { lx0: 122, lx1: 174, lz0: -4, lz1: 4, y0: 2.6, y1: 21 };   // rises along +lx (west -> east), grade 0.35
export const FOOT = { lx0: 110, lx1: 122, lz0: -4, lz1: 4 };                    // flat paved apron at the ramp foot (RAMP.y0), off the quay's east end
export const LANDING = { lx0: 174, lx1: 186, lz0: -4, lz1: 20 };                // flat at BATTERY.y, joins the gun deck
export const GUNS = Array.from({ length: 6 }, (_, i) => { const a = -0.75 + i * 0.3, B = BATTERY;
  return { i, a, lx: B.lx + Math.sin(a) * B.ring, lz: B.lz + Math.cos(a) * B.ring, slx: B.lx + Math.sin(a) * (B.ring - 3.1), slz: B.lz + Math.cos(a) * (B.ring - 3.1) }; });
export const AIM = { yaw: 0.5, pitch: [0.03, 0.34], rest: 0.1, reload: 4 };    // radians either side of the embrasure; elevation range

const rectD = (lx, lz, R) => Math.hypot(Math.max(R.lx0 - lx, 0, lx - R.lx1), Math.max(R.lz0 - lz, 0, lz - R.lz1));
export const rampY = (lx) => RAMP.y0 + (RAMP.y1 - RAMP.y0) * Math.min(1, Math.max(0, (lx - RAMP.lx0) / (RAMP.lx1 - RAMP.lx0)));
const near = (lx, lz) => lx > 96 && lx < 214 && lz > -24 && lz < 80;
// terrain stamp (foot.js coastH): gun deck + landing flat at BATTERY.y, the ramp a straight grade; 4.5-5 m feathers into the hill
export function ground(lx, lz, h) {
  if (!near(lx, lz)) return h;
  const B = BATTERY, d = Math.min(Math.max(0, Math.hypot(lx - B.lx, lz - B.lz) - B.deckR), rectD(lx, lz, LANDING));
  if (d < 5) { const w = 1 - sm(0, 5, d); h = h * (1 - w) + B.y * w; }
  const df = rectD(lx, lz, FOOT); if (df < 4.5) { const w = 1 - sm(0, 4.5, df); h = h * (1 - w) + RAMP.y0 * w; }
  const dr = rectD(lx, lz, RAMP); if (dr < 4.5) { const w = 1 - sm(0, 4.5, dr); h = h * (1 - w) + rampY(lx) * w; }
  return h;
}
// cobble paint weight (foot.js colorAt / splatAt): ramp, landing, gun deck
export function pave(lx, lz) {
  if (!near(lx, lz)) return 0;
  const d = Math.min(rectD(lx, lz, RAMP), rectD(lx, lz, FOOT), rectD(lx, lz, LANDING), Math.max(0, Math.hypot(lx - BATTERY.lx, lz - BATTERY.lz) - BATTERY.paveR));
  return 1 - sm(0.5, 2.5, d);
}
// foliage (foot.js foliageSpots): 2 = nothing at all (path + deck), 1 = no trees / palms / ferns (cliff rocks on the faces stay)
export function clearAt(lx, lz) {
  if (!near(lx, lz)) return 0;
  const r = Math.hypot(lx - BATTERY.lx, lz - BATTERY.lz);
  if (r < BATTERY.deckR + 2 || rectD(lx, lz, RAMP) < 7 || rectD(lx, lz, FOOT) < 5 || rectD(lx, lz, LANDING) < 7) return 2;
  return r < 40 || rectD(lx, lz, RAMP) < 14 || rectD(lx, lz, LANDING) < 14 ? 1 : 0;   // no trees / palms anywhere round the guns or over the ramp
}

// static art + colliders, merged into the coast kit (0 extra draw calls). o = foot.js buildCoast helpers
export function buildArt(o) {
  const { k, W, box, cyl, T, H, addBox, addCirc, torchPost, F, C } = o, yaw0 = CO.t2wYaw(0), B = BATTERY;
  // a wall piece centred on (lx, lz), long axis along town lx (len) or lz (alongZ), top at y, 7 m deep into the ground
  const wall = (lx, lz, len, top, alongZ = false, th = 0.8, col = C.STONE) => { const [x, z] = T(lx, lz), hgt = 8;
    W(k, box(alongZ ? th : len, hgt, alongZ ? len : th), col, 11, M(x, top - hgt / 2, z, yaw0));
    W(k, box(alongZ ? th + 0.2 : len + 0.04, 0.22, alongZ ? len + 0.04 : th + 0.2), C.STONE_D, 11, M(x, top + 0.08, z, yaw0), false);   // coping
    addBox(x, z, alongZ ? th : len, alongZ ? len : th, yaw0); };
  // ramp: parapet walls both sides (stepped 3 m pieces following the grade), lamps at the foot, halfway and the top
  for (let lx = RAMP.lx0 + 1.5; lx < RAMP.lx1; lx += 3) { const y = rampY(lx) + 1.0; wall(lx, RAMP.lz0 - 0.4, 3.02, y); wall(lx, RAMP.lz1 + 0.4, 3.02, y); }
  // landing: parapet on the open south + east sides
  for (let lx = LANDING.lx0 + 1.5; lx < LANDING.lx1 + 0.8; lx += 3) wall(lx, LANDING.lz0 - 0.4, 3.02, B.y + 1.0);
  for (let lz = LANDING.lz0 + 1.5; lz < LANDING.lz1 - 4; lz += 3) wall(LANDING.lx1 + 0.4, lz, 3.02, B.y + 1.0, true);
  // gun deck: parapet arc round the seaward rim, low in front of each gun (embrasure), a little higher between them
  for (let a = -1.05; a <= 1.051; a += 0.15) { const g = GUNS.some(q => Math.abs(q.a - a) < 0.08), r = B.ring + 4.4, [x, z] = T(B.lx + Math.sin(a) * r, B.lz + Math.cos(a) * r), top = B.y + (g ? 0.75 : 1.35);
    W(k, box(3.2, 8, 1.2), C.STONE, 11, M(x, top - 4, z, CO.t2wYaw(a))); W(k, box(3.3, 0.22, 1.4), C.STONE_D, 11, M(x, top + 0.08, z, CO.t2wYaw(a)), false);
    addBox(x, z, 3.2, 1.2, CO.t2wYaw(a)); }
  // shot piles + powder kegs beside each gun; the guns' own carriages are solid (createGuns draws them)
  for (const q of GUNS) { const side = q.a < 0 ? -1 : 1, px = Math.cos(q.a) * side, pz = -Math.sin(q.a) * side;
    const [bx, bz] = T(q.lx + px * 2.4 - Math.sin(q.a) * 1.2, q.lz + pz * 2.4 - Math.cos(q.a) * 1.2), y = B.y;
    for (const [dx, dy, dz] of [[-0.3, 0.2, -0.3], [0.3, 0.2, -0.3], [-0.3, 0.2, 0.3], [0.3, 0.2, 0.3], [0, 0.62, 0]]) W(k, new THREE.SphereGeometry(0.24, 8, 6), C.IRON, 0, M(bx + dx, y + dy, bz + dz), false);
    const [kx, kz] = T(q.lx + px * 2.4 - Math.sin(q.a) * 3.2, q.lz + pz * 2.4 - Math.cos(q.a) * 3.2);
    W(k, cyl(0.42, 0.42, 0.95, 10), C.WOOD, 2, M(kx, y + 0.47, kz)); W(k, cyl(0.44, 0.44, 0.08, 10), C.IRON, 0, M(kx, y + 0.75, kz), false);
    addCirc(bx, bz, 0.55); addCirc(kx, kz, 0.5);
    const [gx, gz] = T(q.lx, q.lz); addCirc(gx, gz, 1.45); }
  // lamps
  for (const [lx, lz, y] of [[RAMP.lx0 - 0.6, RAMP.lz0 - 0.4, RAMP.y0], [RAMP.lx0 - 0.6, RAMP.lz1 + 0.4, RAMP.y0], [(RAMP.lx0 + RAMP.lx1) / 2, RAMP.lz0 - 0.4, rampY((RAMP.lx0 + RAMP.lx1) / 2) + 1.1],
    [LANDING.lx0 + 1, LANDING.lz0 - 0.4, B.y + 1.1], [B.lx, B.lz - 14, B.y]]) { const [x, z] = T(lx, lz); torchPost(k, F, x, y === null ? H(x, z) : y, z); }
}

// the 6 guns: carriage + barrel, each ONE instanced mesh + its outline (4 draw calls in all), aim + recoil per gun.
// Built by foot.js createFoot into the foot-world root; positions / yaws are foot-world (= harbor world + HC, no rotation).
export function createGuns(root, MATS, OUT, low, H) {
  const geo = (fn) => { const k = new Kit(); fn(k); const g = k.build({ toon: MATS.toon }, OUT); const m = g.children.find(c => c.name === 'island_toon'), o = g.children.find(c => c.userData.outline);
    return [m.geometry, o ? o.geometry : null]; };
  const WOOD_D = 0x6b4527, WOOD = 0xa86a3a, IRON = 0x2b2f36, GOLD = 0xffc93c;
  const [cG, cO] = geo(k => { k.add(new THREE.BoxGeometry(1.5, 0.55, 2.4), WOOD_D, { m: M(0, 0.55, -0.1), mat: 2 });
    for (const s of [-1, 1]) { k.add(new THREE.BoxGeometry(0.22, 0.75, 2.0), WOOD, { m: M(s * 0.62, 1.0, 0.0), mat: 2 });                     // cheeks
      for (const zz of [-0.85, 0.75]) k.add(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 10), WOOD, { m: M(s * 0.86, 0.4, zz, 0, 0, Math.PI / 2), mat: 2 }); }
    k.add(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6), IRON, { m: M(0, 0.4, 0.75, 0, 0, Math.PI / 2), mat: 0, outline: false }); });
  const [bG, bO] = geo(k => { k.add(new THREE.CylinderGeometry(0.3, 0.44, 3.0, 12), IRON, { m: M(0, 0, 0.85, 0, Math.PI / 2), mat: 0 });   // tube (pivot = trunnions)
    k.add(new THREE.CylinderGeometry(0.4, 0.4, 0.22, 12), IRON, { m: M(0, 0, 2.3, 0, Math.PI / 2), mat: 0 });                                    // muzzle swell
    k.add(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 12), GOLD, { m: M(0, 0, -0.25, 0, Math.PI / 2), mat: 0, outline: false });              // brass band
    k.add(new THREE.SphereGeometry(0.2, 8, 6), IRON, { m: M(0, 0, -0.75), mat: 0 }); });
  const mk = (g, mat, name, sh) => { const m = new THREE.InstancedMesh(g, mat, GUNS.length); m.name = name; m.frustumCulled = false; m.castShadow = sh && !low; m.receiveShadow = !low; root.add(m); return m; };
  const meshes = [[mk(cG, MATS.toon, 'battery_carriage', true), 'c'], [mk(bG, MATS.toon, 'battery_barrel', true), 'b']];
  if (cO) { const o = mk(cO, OUT.plain, 'battery_carriage_outline', false); o.userData.outline = true; meshes.push([o, 'c']); }
  if (bO) { const o = mk(bO, OUT.plain, 'battery_barrel_outline', false); o.userData.outline = true; meshes.push([o, 'b']); }
  const PIV = new THREE.Vector3(0, 1.2, 0.15), TIP = 2.45;
  const guns = GUNS.map(q => { const [x, z] = CO.t2w(q.lx, q.lz), [sx, sz] = CO.t2w(q.slx, q.slz), rest = CO.t2wYaw(q.a);
    return { ...q, x, y: BATTERY.y, z, sx, sz, rest, yaw: rest, pitch: AIM.rest, recoil: 0, ty: rest, tp: AIM.rest, cool: 0 }; });
  const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _p = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function pose(g) { // carriage: slides back with the shot; barrel: pivots on the trunnions (yaw, then elevation)
    const back = g.recoil * 0.9, sy = Math.sin(g.yaw), cy = Math.cos(g.yaw);
    _m.makeRotationY(g.yaw).setPosition(g.x - sy * back, g.y, g.z - cy * back);
    _e.set(-g.pitch, g.yaw, 0, 'YXZ'); _q.setFromEuler(_e); _v.copy(PIV).applyAxisAngle(_up, g.yaw); _p.compose(_v.set(g.x + _v.x - sy * back, g.y + _v.y, g.z + _v.z - cy * back), _q, _one);
    for (const [m, w] of meshes) { m.setMatrixAt(g.i, w === 'c' ? _m : _p); m.instanceMatrix.needsUpdate = true; } }
  const _up = new THREE.Vector3(0, 1, 0), _one = new THREE.Vector3(1, 1, 1);
  guns.forEach(pose);
  // muzzle tip + forward direction in foot-world coords
  function muzzle(g, outP, outD) { const cp = Math.cos(g.pitch); outD.set(Math.sin(g.yaw) * cp, Math.sin(g.pitch), Math.cos(g.yaw) * cp);
    _v.copy(PIV).applyAxisAngle(_up, g.yaw); outP.set(g.x + _v.x, g.y + _v.y, g.z + _v.z).addScaledVector(outD, TIP); return outP; }
  function update(dt) { for (const g of guns) { const r0 = g.recoil; g.recoil = Math.max(0, g.recoil - dt * 1.6);
    let dy = g.ty - g.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const k = Math.min(1, dt * 4), oy = g.yaw, op = g.pitch;
    g.yaw += dy * k; g.pitch += (g.tp - g.pitch) * k; g.cool = Math.max(0, g.cool - dt);
    if (r0 !== g.recoil || Math.abs(oy - g.yaw) > 1e-5 || Math.abs(op - g.pitch) > 1e-5) pose(g); } }
  return { guns, meshes: meshes.map(m => m[0]), update, muzzle, pose };
}
