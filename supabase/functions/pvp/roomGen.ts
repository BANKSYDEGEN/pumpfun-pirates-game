// @ts-nocheck
// [sims-build] COPY of js/island/roomGen.js (keep in sync; tests/roomGen.test.mjs checks both). Used by the admin_room_gen action.
// [sims-build t2071u-t2075u] PUMPFUN PIRATES owner build: pure layout math for the 2 m pirate kit (foot.js PROP_CAT 'twall' ...).
// Everything returns plain piece records { t, x, y, z, ry } (foot frame) that terrainEdit.js stores as PIECES '+id' (server terrain_put).
//  - lineOf(id, a, b): wall / path segments along a drag (2 m grid; walls turn to the drag axis)
//  - areaOf(id, a, b): floor / roof tiles over a dragged rectangle
//  - room(preset, a, b, y, door): walls + door + windows + floor + roof + furniture for a preset ('tavern', 'shop', 'bedroom', 'vault', 'cabin', 'store')
//  - describe(text): a preset + size + extra furniture from words ("small rum cellar with barrels and a lantern"); shared with the pvp action
//  - roomAt / growRoom: find the room a wall belongs to (its floor tiles) and push one side out / in (walls move, floor + roof + side walls re-tile)
export const G = 2, WALL_H = 3;
export const snap = (v) => Math.round(v / G) * G;
const r2 = (v) => Math.round(v * 100) / 100;
export function catIndex(cat) { const m = {}; cat.forEach((p, i) => { m[p.id] = i; }); return m; }

export function lineOf(cat, id, a, b, y = null, ground = null) {
  const T = catIndex(cat), t = T[id]; if (t == null) return [];
  const ax = snap(a.x), az = snap(a.z), dx = b.x - a.x, dz = b.z - a.z, alongX = Math.abs(dx) >= Math.abs(dz);
  const n = Math.max(1, Math.round((alongX ? Math.abs(dx) : Math.abs(dz)) / G)), sg = (alongX ? dx : dz) < 0 ? -1 : 1, out = [];
  const wall = cat[t].shell === 'wall';
  for (let i = 0; i < n; i++) { const off = (i + 0.5) * G * sg;
    // walls sit ON the grid lines (between tiles), paths fill the tiles
    const x = alongX ? ax + off : (wall ? ax : ax + G / 2), z = alongX ? (wall ? az : az + G / 2) : az + off;
    out.push({ t, x: r2(x), y: r2(y ?? ground?.(x, z) ?? 0), z: r2(z), ry: alongX ? 0 : r2(Math.PI / 2) }); }
  return out;
}
export function rectOf(a, b) { const x0 = snap(Math.min(a.x, b.x)), x1 = Math.max(x0 + G, snap(Math.max(a.x, b.x))), z0 = snap(Math.min(a.z, b.z)), z1 = Math.max(z0 + G, snap(Math.max(a.z, b.z))); return { x0, x1, z0, z1 }; }
export function areaOf(cat, id, a, b, y = null, ground = null) {
  const T = catIndex(cat), t = T[id]; if (t == null) return []; const R = rectOf(a, b), out = [];
  for (let x = R.x0 + G / 2; x < R.x1; x += G) for (let z = R.z0 + G / 2; z < R.z1; z += G) out.push({ t, x: r2(x), y: r2(y ?? ground?.(x, z) ?? 0), z: r2(z), ry: 0 });
  return out;
}
// ----- presets: furniture laid out from the room rectangle (back wall = the side opposite the door) -----
export const PRESETS = {
  tavern: { label: 'TAVERN', ico: '🍺', wall: 'twall', min: [8, 8], items: [['counter', 'back', 0], ['rack', 'back', 1], ['table', 'mid', 0], ['bench', 'mid', 1], ['table', 'mid', 2], ['bench', 'mid', 3], ['barrel', 'corner', 0], ['barrel', 'corner', 1], ['lantern', 'corner', 2], ['lantern', 'corner', 3]] },
  shop: { label: 'SHOP', ico: '🏪', wall: 'twall', min: [6, 6], items: [['counter', 'mid', 0], ['shelf', 'back', 0], ['shelf', 'back', 1], ['crate', 'corner', 0], ['crate', 'corner', 1], ['lantern', 'corner', 2], ['chest', 'corner', 3]] },
  bedroom: { label: 'BEDROOM', ico: '🛏️', wall: 'twall', min: [6, 6], items: [['bed', 'back', 0], ['bed', 'back', 1], ['chest', 'corner', 0], ['rug', 'mid', 0], ['lantern', 'corner', 2], ['shelf', 'side', 0]] },
  vault: { label: 'VAULT', ico: '🏦', wall: 'swall', min: [6, 6], items: [['chest', 'back', 0], ['chest', 'back', 1], ['gold', 'mid', 0], ['gold', 'corner', 0], ['gold', 'corner', 1], ['chest', 'corner', 2], ['lantern', 'corner', 3]] },
  cabin: { label: "CAPTAIN'S CABIN", ico: '🧭', wall: 'twall', min: [6, 6], items: [['table', 'mid', 0], ['bench', 'mid', 1], ['bed', 'back', 0], ['chest', 'corner', 0], ['rug', 'mid', 2], ['shelf', 'side', 0], ['lantern', 'corner', 2]] },
  store: { label: 'STOREROOM', ico: '📦', wall: 'twall', min: [6, 6], items: [['crate', 'corner', 0], ['crate', 'corner', 1], ['barrel', 'corner', 2], ['barrel', 'corner', 3], ['rack', 'back', 0], ['crate', 'mid', 0], ['barrel', 'side', 0], ['lantern', 'side', 1]] },
  armory: { label: 'ARMORY', ico: '⚔️', wall: 'swall', min: [6, 6], items: [['cannon', 'mid', 0], ['rack', 'back', 0], ['shelf', 'back', 1], ['chest', 'corner', 0], ['barrel', 'corner', 1], ['lantern', 'corner', 2]] },
};
const SIDES = ['s', 'n', 'w', 'e']; // door side: s = min z, n = max z, w = min x, e = max x
function frameOf(R, door) { // u = along the door wall, v = depth (0 at the door, 1 at the back); returns (u, v) -> {x, z, ry}
  const W = R.x1 - R.x0, D = R.z1 - R.z0;
  if (door === 's') return { w: W, d: D, at: (u, v) => ({ x: R.x0 + u * W, z: R.z0 + v * D, ry: 0 }) };
  if (door === 'n') return { w: W, d: D, at: (u, v) => ({ x: R.x1 - u * W, z: R.z1 - v * D, ry: Math.PI }) };
  if (door === 'w') return { w: D, d: W, at: (u, v) => ({ x: R.x0 + v * W, z: R.z1 - u * D, ry: Math.PI / 2 }) };
  return { w: D, d: W, at: (u, v) => ({ x: R.x1 - v * W, z: R.z0 + u * D, ry: -Math.PI / 2 }) };
}
export function shell(cat, R, y, door = 's', wallId = 'twall', { roof = true, floor = true } = {}) {
  const T = catIndex(cat), out = [], add = (id, x, z, ry) => { if (T[id] != null) out.push({ t: T[id], x: r2(x), y: r2(y), z: r2(z), ry: r2(ry) }); };
  const nx = (R.x1 - R.x0) / G, nz = (R.z1 - R.z0) / G, dmid = (n) => Math.floor((n - 1) / 2);
  const seg = (side, i, n) => { const isDoor = side === door && i === dmid(n), isWin = !isDoor && wallId === 'twall' && n >= 3 && i % 2 === 1 && side !== door;
    return isDoor ? 'tdoor' : isWin ? 'twin' : wallId; };
  for (let i = 0; i < nx; i++) { add(seg('s', i, nx), R.x0 + (i + 0.5) * G, R.z0, 0); add(seg('n', i, nx), R.x0 + (i + 0.5) * G, R.z1, Math.PI); }
  for (let j = 0; j < nz; j++) { add(seg('w', j, nz), R.x0, R.z0 + (j + 0.5) * G, Math.PI / 2); add(seg('e', j, nz), R.x1, R.z0 + (j + 0.5) * G, -Math.PI / 2); }
  for (let x = R.x0 + G / 2; x < R.x1; x += G) for (let z = R.z0 + G / 2; z < R.z1; z += G) { if (floor) add('tfloor', x, z, 0); if (roof) add('troof', x, z, 0); }
  return out;
}
export function furnish(cat, R, y, door, items) {
  const T = catIndex(cat), F = frameOf(R, door), out = [], used = new Set();
  const pad = (m) => Math.min(0.45, m / Math.max(F.w, 0.1)), padD = (m) => Math.min(0.45, m / Math.max(F.d, 0.1));
  const slots = { back: (k) => [0.3 + 0.4 * ((k % 2) ? 0.85 : 0.15), 1 - padD(0.9)], mid: (k) => [0.3 + 0.4 * ((k % 2) ? 1 : 0) * 0.9 + 0.05, 0.4 + 0.25 * Math.floor(k / 2)],
    corner: (k) => [[pad(0.9), 1 - pad(0.9)][k & 1], [1 - padD(0.9), 0.25 + padD(0.6)][(k >> 1) & 1]], side: (k) => [pad(0.6), 0.45 + 0.2 * k] };
  for (const [id, where, k] of items) { if (T[id] == null) continue; const [u, v] = (slots[where] || slots.mid)(k), key = where + k + id; if (used.has(key)) continue; used.add(key);
    const p = F.at(Math.max(0.08, Math.min(0.92, u)), Math.max(0.12, Math.min(0.92, v)));
    // back + side items face into the room; side items turn to face across
    const ry = where === 'side' ? p.ry + Math.PI / 2 : p.ry; out.push({ t: T[id], x: r2(p.x), y: r2(y), z: r2(p.z), ry: r2(ry) }); }
  return out;
}
export function room(cat, preset, a, b, y, door = 's', extra = []) {
  const P = PRESETS[preset] || PRESETS.tavern; let R = rectOf(a, b);
  if (R.x1 - R.x0 < P.min[0]) R = { ...R, x1: R.x0 + P.min[0] }; if (R.z1 - R.z0 < P.min[1]) R = { ...R, z1: R.z0 + P.min[1] };
  if (!SIDES.includes(door)) door = 's';
  return { rect: R, pieces: [...shell(cat, R, y, door, P.wall), ...furnish(cat, R, y, door, [...P.items, ...extra])] };
}
// ----- "describe a room": words -> preset, size, wall, extra pieces (no AI; deterministic so the server and client agree) -----
const WORDS = [
  ['tavern', /tavern|bar\b|pub|inn|grog|saloon/], ['shop', /shop|store\b|market|trader|merchant/], ['bedroom', /bed|bunk|sleep|quarters|dorm/],
  ['vault', /vault|treasur|bank|gold room|hoard/], ['cabin', /captain|cabin|office|study|map room/], ['store', /cellar|storage|storeroom|hold\b|warehouse|pantry/], ['armory', /armou?ry|weapon|gun|cannon room|arsenal/]];
const ITEMS = [['barrel', /barrel|rum|keg|cask/], ['crate', /crate|box/], ['lantern', /lantern|lamp|light|candle|torch/], ['table', /table/], ['bench', /bench|seat|chair|stool/],
  ['bed', /\bbeds?\b|bunks?/], ['chest', /chest|loot/], ['counter', /counter|bar top|desk/], ['shelf', /shel(f|ves)|book/], ['rack', /rack|bottle/], ['rug', /rug|carpet/], ['cannon', /cannon/], ['gold', /gold|coin|doubloon/]];
const NUM = { a: 1, an: 1, one: 1, two: 2, pair: 2, couple: 2, three: 3, few: 3, four: 4, five: 5, six: 6, some: 2, many: 4, lots: 5 };
export function describe(text) {
  const s = String(text || '').toLowerCase().slice(0, 200); let preset = 'tavern';
  for (const [id, re] of WORDS) if (re.test(s)) { preset = id; break; }
  let w = 8, d = 8; if (/tiny|little|small|cosy|cozy|narrow/.test(s)) { w = 6; d = 6; } if (/big|large|huge|grand|great|long/.test(s)) { w = 12; d = 10; }
  const m = s.match(/(\d{1,2})\s*(m|x|by)\s*(\d{1,2})/); if (m) { w = Math.max(4, Math.min(24, +m[1])); d = Math.max(4, Math.min(24, +m[3])); }
  w = Math.max(4, Math.round(w / G) * G); d = Math.max(4, Math.round(d / G) * G);
  const wall = /stone|brick|rock/.test(s) ? 'swall' : /wood|timber|plank/.test(s) ? 'twall' : null, roofless = /no roof|open air|roofless|courtyard/.test(s);
  const extra = []; for (const [id, re] of ITEMS) { const mm = s.match(new RegExp('(\\d+|' + Object.keys(NUM).join('|') + ')?\\s*(?:\\w+\\s)?' + re.source)); if (!mm) continue;
    const n = Math.min(6, mm[1] ? (+mm[1] || NUM[mm[1]] || 1) : 1); for (let k = 0; k < n; k++) extra.push([id, k % 2 ? 'side' : 'corner', 4 + extra.length]); }
  return { preset, w, d, wall, roofless, extra: extra.slice(0, 12) };
}
export function describedRoom(cat, text, at, y, door = 's') {
  const D = describe(text), P = PRESETS[D.preset], a = { x: at.x - D.w / 2, z: at.z - D.d / 2 }, b = { x: at.x + D.w / 2, z: at.z + D.d / 2 };
  const R = rectOf(a, b); const wallId = D.wall || P.wall;
  return { ...D, rect: R, pieces: [...shell(cat, R, y, door, wallId, { roof: !D.roofless }), ...furnish(cat, R, y, door, [...P.items, ...D.extra])] };
}
// ----- grow: a wall + its room's floor tiles -> push that side out / in by whole tiles -----
const key = (x, z) => Math.round(x * 10) + ':' + Math.round(z * 10);
export function roomAt(cat, pieces, wallRec) { // pieces: [[id, rec]]; returns { rect, side } or null
  const shellOf = (r) => cat[r.t]?.shell; if (shellOf(wallRec) !== 'wall') return null;
  const floors = new Map(); for (const [, r] of pieces) if (shellOf(r) === 'floor' || shellOf(r) === 'roof') floors.set(key(r.x, r.z), r);
  const horiz = Math.abs(Math.sin(wallRec.ry || 0)) < 0.5; // runs along X: neighbours at z +- 1
  const seeds = horiz ? [[wallRec.x, wallRec.z + G / 2, 'z0'], [wallRec.x, wallRec.z - G / 2, 'z1']] : [[wallRec.x + G / 2, wallRec.z, 'x0'], [wallRec.x - G / 2, wallRec.z, 'x1']];
  for (const [sx, sz, side] of seeds) { if (!floors.has(key(sx, sz))) continue;
    const seen = new Set([key(sx, sz)]), q = [[sx, sz]]; let x0 = sx, x1 = sx, z0 = sz, z1 = sz;
    while (q.length && seen.size < 900) { const [x, z] = q.pop(); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      for (const [ddx, ddz] of [[G, 0], [-G, 0], [0, G], [0, -G]]) { const k = key(x + ddx, z + ddz); if (!seen.has(k) && floors.has(k)) { seen.add(k); q.push([x + ddx, z + ddz]); } } }
    return { rect: { x0: x0 - G / 2, x1: x1 + G / 2, z0: z0 - G / 2, z1: z1 + G / 2 }, side }; }
  return null;
}
// change set for pushing `side` of rect by n tiles (n < 0 = in). pieces: [[id, rec]]. Returns { del: [ids], move: [[id, rec]], add: [recs], rect }
export function growRoom(cat, pieces, rect, side, n) {
  const R = { ...rect }, d = n * G; R[side] += side.endsWith('0') ? -d : d;
  if (R.x1 - R.x0 < G * 2 || R.z1 - R.z0 < G * 2 || n === 0) return null;
  const T = catIndex(cat), shellOf = (r) => cat[r.t]?.shell, eps = 0.3, inR = (r, Q) => r.x > Q.x0 - eps && r.x < Q.x1 + eps && r.z > Q.z0 - eps && r.z < Q.z1 + eps;
  const onEdge = (r, s, Q) => s === 'x0' ? Math.abs(r.x - Q.x0) < eps : s === 'x1' ? Math.abs(r.x - Q.x1) < eps : s === 'z0' ? Math.abs(r.z - Q.z0) < eps : Math.abs(r.z - Q.z1) < eps;
  const axis = side[0], sgn = side.endsWith('0') ? -1 : 1, del = [], move = [], add = [];
  let y = 0, roofY = null, wallId = 'twall'; const sides = side[0] === 'x' ? ['z0', 'z1'] : ['x0', 'x1'];
  for (const [id, r] of pieces) { if (!inR(r, rect)) continue; const sh = shellOf(r);
    if (sh === 'floor') y = r.y; if (sh === 'roof') roofY = r.y;
    if (sh === 'wall' && onEdge(r, side, rect)) { const m = { ...r }; m[axis] = r2(r[axis] + sgn * d); move.push([id, m]); continue; }
    if (sh === 'wall' && sides.some((s) => onEdge(r, s, rect))) { if (cat[r.t].id !== 'tdoor' && cat[r.t].id !== 'twin') wallId = cat[r.t].id;
      if (n < 0 && !inR(r, { ...R, [side]: R[side] - sgn * 0.01 })) del.push(id); continue; }
    if ((sh === 'floor' || sh === 'roof') && n < 0 && !inR(r, R)) del.push(id);
    else if (!sh && n < 0 && !inR(r, R)) { const m = { ...r }; m[axis] = r2(axis === 'x' ? Math.max(R.x0 + 0.8, Math.min(R.x1 - 0.8, r.x)) : r.x); if (axis === 'z') m.z = r2(Math.max(R.z0 + 0.8, Math.min(R.z1 - 0.8, r.z))); move.push([id, m]); } }
  if (n > 0) { const strip = side === 'x0' ? { x0: R.x0, x1: rect.x0 } : side === 'x1' ? { x0: rect.x1, x1: R.x1 } : side === 'z0' ? { z0: R.z0, z1: rect.z0 } : { z0: rect.z1, z1: R.z1 };
    const S = { x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1, ...strip };
    for (let x = S.x0 + G / 2; x < S.x1; x += G) for (let z = S.z0 + G / 2; z < S.z1; z += G) { add.push({ t: T.tfloor, x: r2(x), y: r2(y), z: r2(z), ry: 0 }); if (roofY != null) add.push({ t: T.troof, x: r2(x), y: r2(roofY), z: r2(z), ry: 0 }); }
    for (const s of sides) { const fixed = s === 'x0' ? S.x0 : s === 'x1' ? S.x1 : s === 'z0' ? S.z0 : S.z1, ry = s === 'z0' ? 0 : s === 'z1' ? Math.PI : s === 'x0' ? Math.PI / 2 : -Math.PI / 2;
      if (axis === 'x') for (let x = S.x0 + G / 2; x < S.x1; x += G) add.push({ t: T[wallId], x: r2(x), y: r2(y), z: r2(fixed), ry: r2(ry) });
      else for (let z = S.z0 + G / 2; z < S.z1; z += G) add.push({ t: T[wallId], x: r2(fixed), y: r2(y), z: r2(z), ry: r2(ry) }); } }
  return { del, move, add, rect: R };
}
