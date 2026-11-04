// [Timothy] hill street probe (runs in island.html via hill_probe.py): feet on the shop floors (ray down onto the Blender floor vs the
// walk height foot.groundAt), doorways open, walls / counters solid, the street lanes clear, the door empties + sign plates present.
(async () => { const THREE = await import('three'), CO = await import('./js/island/coast.js'), HS = await import('./js/island/hillShops.js');
  const F = ISLAND.foot, scn = ISLAND.scene, rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0);
  const why = (lx, lz) => { const [x, z] = CO.t2w(lx, lz); return F.whyBlocked(x, z); }, solid = (lx, lz) => why(lx, lz) === 'prop';
  const gnd = (lx, lz) => { const [x, z] = CO.t2w(lx, lz); return F.groundAt(x, z); };
  const R = { feet: [], doors: [], walls: [], street: [], names: [] };
  for (const s of [...HS.RENTABLE_SHOPS, ...HS.MAIN_ST_SHOPS]) {
    const I = s.interior, side = s.ly > 0 ? -1 : 1, g = scn.getObjectByName('hill_' + s.lot); let lod0 = null; g?.traverse(o => { if (!lod0 && /_LOD0$/.test(o.name)) lod0 = o; });
    if (!lod0) lod0 = scn.getObjectByName('hill_street_merged_solid');   // phones: all LOD1 buildings merged
    R.names.push([s.lot, !!scn.getObjectByName(s.empty), !!scn.getObjectByName(s.sign)]);
    // feet: 9 points on the room floor (clear of the counter) + the threshold
    const pts = []; for (const fx of [0.15, 0.5, 0.85]) for (const fz of [0.2, 0.45, 0.6]) { const lzz = I.lz0 + (I.lz1 - I.lz0) * fx, lxx = side < 0 ? I.lx1 - (I.lx1 - I.lx0) * fz : I.lx0 + (I.lx1 - I.lx0) * fz; pts.push([lxx, lzz]); }
    pts.push([s.door.lx + (side < 0 ? -0.2 : 0.2), s.door.lz]);
    let worst = 0, miss = 0; for (const [lx, lz] of pts) { const [x, z] = CO.t2w(lx, lz), y = gnd(lx, lz); rc.set(new THREE.Vector3(x, y + 0.6, z), dn); rc.far = 1.5;
      const hit = lod0 ? rc.intersectObject(lod0, true)[0] : null; if (!hit) { miss++; continue; } const dlt = hit.point.y - y; if (Math.abs(dlt) > Math.abs(worst)) worst = dlt; }
    R.feet.push([s.lot, +(worst * 100).toFixed(1), miss]);
    // doorway: some lane across the opening walks from the street (1.6 m out) into the room centre unblocked
    const fx = s.door.lx, inX = (I.lx0 + I.lx1) / 2; let open = 0;
    for (let o = -s.doorW / 2 + 0.5; o <= s.doorW / 2 - 0.5 + 1e-6; o += 0.2) { let ok = true; const lz = s.door.lz + o;
      for (let t = 0; t <= 1; t += 0.02) { const lx = fx - side * 1.6 + (inX - fx + side * 1.6) * t; if (solid(lx, lz)) { ok = false; break; } } if (ok) open++; }
    R.doors.push([s.lot, open]);
    // walls / counter solid: wall midpoints (inside face + 0.1) and the facade beside the door
    const wl = [[side < 0 ? I.lx0 - 0.1 : I.lx1 + 0.1, (I.lz0 + I.lz1) / 2], [(I.lx0 + I.lx1) / 2, I.lz0 - 0.1], [(I.lx0 + I.lx1) / 2, I.lz1 + 0.1], [fx, I.lz0 + 0.3], [fx, I.lz1 - 0.3]];
    R.walls.push([s.lot, wl.map(p => solid(...p) ? 1 : 0).join('')]);
  }
  // street lanes: from the plaza to the gate, 4 lanes (sx -4.5, -2, 2, 4.5): blocked samples (props expected only at the dressing lanes)
  for (const sx of [-4.5, -2, 0, 2, 4.5]) { let bad = 0, n = 0; for (let lz = -60; lz > -200; lz -= 0.25) { n++; if (solid(6 + sx, lz)) bad++; } R.street.push([sx, bad, n]); }
  return R; })()
