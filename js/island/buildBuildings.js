// [build-mode-buildings] t2456u: admin Build Mode tools to adjust Blender GLB buildings
// (village, plaza shops, Hill Street lots, casino, HQ/battery, cottages, D2, fountain plaza).
// Transforms reuse terrain PIECES overrides (dx/dy/dz/ry/rx/rz/sx/sy/sz/h) — same store as SELECT.
// Collider-follow shifts built-in CIRC/BOXES whose original centres sat in the building footprint.
export const BUILDING_UNIT = /^(plaza_(shop|dock)_|hill_(?!street|signs_merged|lod_)|battery_blender$|battery_pfp_flag$|lighthouse_|treasure_trader$|rb_fountain|fort_signs_|fort_walk_floor$|plaza_v2_signs$|casino_hall$|village_art$|d2_blender$|rb_plaza_glb$|area_cottages$)/;

/** fields persisted on a building override (server terrain_put sanitizer must allow these) */
export const BUILD_FIELDS = ['dx', 'dy', 'dz', 'ry', 'rx', 'rz', 'sx', 'sy', 'sz', 'h'];

export function cleanBuildOv(v) {
  if (!v || typeof v !== 'object') return null;
  if (v.h) return { h: 1 };
  const o = {};
  for (const k of ['dx', 'dy', 'dz']) { const n = Number(v[k]); if (Number.isFinite(n) && Math.abs(n) > 1e-6) o[k] = Math.max(-200, Math.min(200, Math.round(n * 100) / 100)); }
  for (const k of ['ry', 'rx', 'rz']) { const n = Number(v[k]); if (Number.isFinite(n) && Math.abs(n) > 1e-6) o[k] = Math.max(-7, Math.min(7, Math.round(n * 1000) / 1000)); }
  for (const k of ['sx', 'sy', 'sz']) { const n = Number(v[k]); if (Number.isFinite(n) && Math.abs(n - 1) > 1e-6) o[k] = Math.max(0.25, Math.min(4, Math.round(n * 1000) / 1000)); }
  return Object.keys(o).length ? o : null;
}

/** rotate (bx,bz) about (cx,cz) by yaw ry, then add (dx,dz) */
export function xformXZ(bx, bz, cx, cz, dx, dz, ry) {
  const lx = bx - cx, lz = bz - cz, cs = Math.cos(ry || 0), sn = Math.sin(ry || 0);
  return { x: cx + lx * cs + lz * sn + (dx || 0), z: cz - lx * sn + lz * cs + (dz || 0) };
}

/** obstacles whose ORIGINAL centre sits in box (uses ox/oz when present) */
export function obstaclesInBox(obs, box, pad = 0.3) {
  const out = [];
  for (const o of obs) {
    const x = o.ox ?? o.x, z = o.oz ?? o.z;
    if (x >= box.min.x - pad && x <= box.max.x + pad && z >= box.min.z - pad && z <= box.max.z + pad) out.push(o);
  }
  return out;
}

/** apply / restore collider follow for one building item; mutates obs in place */
export function followBuildingColliders(it, ov, obsList) {
  if (!it?.box) return 0;
  if (!it._colFollow) {
    const list = obstaclesInBox(obsList, it.box);
    it._colFollow = list.map((o) => ({ o, bx: o.ox ?? o.x, bz: o.oz ?? o.z, off: !!o.off }));
  }
  const c = { x: (it.box.min.x + it.box.max.x) / 2, z: (it.box.min.z + it.box.max.z) / 2 };
  let n = 0;
  for (const row of it._colFollow) {
    const { o, bx, bz, off } = row;
    if (!ov || ov.h) { o.x = bx; o.z = bz; o.off = true; n++; continue; }
    const p = xformXZ(bx, bz, c.x, c.z, ov.dx || 0, ov.dz || 0, ov.ry || 0);
    o.x = p.x; o.z = p.z; o.off = off; n++;
  }
  return n;
}

export function snapVal(v, step) {
  if (!step || step <= 0) return v;
  return Math.round(v / step) * step;
}

export function copyTransform(ov) {
  const c = cleanBuildOv(ov || {});
  return c ? { ...c } : { dx: 0, dy: 0, dz: 0, ry: 0, rx: 0, rz: 0, sx: 1, sy: 1, sz: 1 };
}
