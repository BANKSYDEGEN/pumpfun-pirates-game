// [outfit-store] BANKSY 5:52 PM "Combine clothing and accessories stores, make it 2 different areas of store tho":
// the CLOTHES SHOP (lx -49) and the ACCESSORIES STORE (lx -38.5) are ONE 20 m wide, 18 m deep walk-in building now (town-local
// lx -54 .. -34, lz -30 .. -48; Blender model = the 'shop_clothes' node of plaza_shops.glb, tools/plaza_blender/plaza_shops_blender.py).
// Two areas behind two street arches: CLOTHING on the left (oak boards, crimson runner, parchment walls), ACCESSORIES on the right
// (marble checker floor, plum runner, lilac walls), split by a 1 m panelled wall with a 3.8 m archway between them. Each area keeps
// its own counter + shop prompt (STOREFRONTS shop_clothes / shop_crew = the two vendors, both mapHidden: one map pin for the building).
// Pure data + collider maths only (no three.js): plazaTown.js places it, js/island/clothesLook.js lights it.
export const OUTFIT_STORE = Object.freeze({
  id: 'outfit_store', name: 'CLOTHES & ACCESSORIES', lx: -44, w: 20, depth: 18, ceil: 5.2,
  facadeLz: -30, lz: -39,                               // centre of the 18 m footprint (map pin / building number)
  promptLz: -43.4,                                       // both prompts: in front of the area's counter (Blender y 9.2 = lz -45.2)
  door: 6.6, arches: Object.freeze([-5, 5]),             // arch width + arch centres (building frame x)
  divider: Object.freeze({ t: 1.0, arch: Object.freeze([0.8, 4.6]) }),   // Blender y range of the archway in the middle wall
  areas: Object.freeze([
    Object.freeze({ id: 'shop_clothes', name: 'CLOTHING', x: -5, lx: -49 }),
    Object.freeze({ id: 'shop_crew', name: 'ACCESSORIES', x: 5, lx: -38.5 }),
  ]),
});
// Blender building frame y (front face y = -6) -> town-local lz (building origin at lz -36)
const lzOf = (y) => -36 - y;
// wall colliders, town-local [lx, lz, w, d]: back, two sides, three front piers round the two arches, the middle wall either side of the archway
export function outfitWalls(S = OUTFIT_STORE) {
  const t = 0.5, hw = S.w / 2, hd = S.depth / 2, cz = S.facadeLz - hd, out = [];
  out.push([S.lx, cz - hd + t / 2, S.w + 0.6, t + 0.6]);
  for (const sx of [-1, 1]) out.push([S.lx + sx * (hw - t / 2), cz, t + 0.6, S.depth + 0.6]);
  const xs = [-hw, ...S.arches.flatMap(a => [a - S.door / 2, a + S.door / 2]), hw];
  for (let i = 0; i < xs.length; i += 2) { const a = xs[i], b = xs[i + 1]; out.push([S.lx + (a + b) / 2, S.facadeLz - t / 2, b - a + 0.3, t + 0.6]); }
  if (!S.divider) return out;   // [ship-aaa] the SHIP STORE hall reuses these walls (one room, no middle wall)
  const [y0, y1] = S.divider.arch, ya = -6 + t, yb = -6 + S.depth - t;
  for (const [a, b] of [[ya, y0], [y1, yb]]) out.push([S.lx, (lzOf(a) + lzOf(b)) / 2, S.divider.t + 0.2, b - a]);
  return out;
}
// the two areas' inner boxes (town-local), for the indoor camera
export function outfitRooms(S = OUTFIT_STORE) {
  const t = 0.5, d = S.divider.t / 2;
  return S.areas.map(a => ({ id: a.id, lx0: S.lx + (a.x < 0 ? -S.w / 2 + t : d), lx1: S.lx + (a.x < 0 ? -d : S.w / 2 - t), lz0: S.facadeLz - S.depth + t, lz1: S.facadeLz - t }));
}
// awning posts (town-local [lx, lz]): two per arch
export const outfitPosts = (S = OUTFIT_STORE) => S.arches.flatMap(a => [-1, 1].map(s => [S.lx + a + s * (S.w / S.arches.length) * 0.33, S.facadeLz + 2.5]));
