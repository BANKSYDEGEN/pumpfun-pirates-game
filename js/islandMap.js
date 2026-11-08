// [Emerly v106] PUMPFUN PIRATES · ISLAND MAP (BANKSY: "add the full island map to mini map").
//   - ONE pre-rendered texture of the whole island, baked a few rows a frame the first time you enter the harbor (no hitch):
//     Raul's real terrain colours (beach, grass, jungle, rock), shallows + deep water, the lake + river, steep faces hatched
//     (the parts the walk limit blocks), tree areas from the actual foliage, trails A + B (red / gold), Main Street, the carved
//     ramp, the rope bridge, the quay / piers / boardwalk decks, town buildings. 1024 px desktop, 512 px phones / low.
//   - the round radar (top right) shows the WHOLE island, north up, in the harbor at sea AND on foot: you, your ship, other
//     harbor pirates (green), AI ships (red) + the boss (gold ring), gold drops, and the active treasure-map dig area.
//   - tap the radar or press M (rebindable 'map'): a full-screen island map with the same markers + labelled points of
//     interest; Esc / M / ✕ closes it (with &mapzoom=0: tap anywhere). Wheel / pinch / sticks zoom; drag / stick pans. Markers only redraw; the terrain is never rendered again.
// Harbor frame = foot frame - HC (no rotation), so headings are the same in both.
import * as THREE from 'three';
import { shopIcon, drawShopIcon, getMapStyle, THEMES, SHOP_ICONS } from './mapIcons.js'; // [v153] shop badges + MINIMAP STYLE // [minimap-themes] + NIGHT / GOLD / BLUEPRINT
import { mapBuildings, drawBuildingFootprints, drawBuildingEmblems } from './mapBuildings.js';
import { SAIL, SAIL_ALL } from './dock/canoe.js';
import { mapLandmarks, mapDocks } from './mapLandmarks.js'; // [minimap-themes] castle / fort / battle areas / shops / docks / D2 ruins from the island's own data
import { mapSafeZoneRings, SAFEZONES_ON, insideSafeZone, SAFE_POLY } from './island/safeZones.js'; // [backpack-pvp] t1727u unified polygon
import { GEO_LABELS, ISLAND_STREETS, locatePoint, streetLabelPose } from './islandGeography.js'; // [map-streets]
const BAKE_C = new THREE.Color(); // colour scratch for the bake
const B = { x0: -940, x1: 700, z0: -820, z1: 780 }; // foot frame: the whole on-foot grid (main island + islets)
const MMICONS_LEGACY = typeof location !== 'undefined' && /[?&]mmicons=0(?:&|$)/.test(location.search); // [minimap-icons] &mmicons=0 = old duplicated pets/crew (+ 10 dock) set
const POI = { shop: ['$', '#ffc93c', '#161616', 'SHOP'], squadhall: ['S', '#9b5cff', '#fff', 'SQUAD HALL'], waves: ['W', '#3fc6c9', '#161616', 'STORM HUNT BOARD'], arena: ['A', '#fa0d0d', '#fff', 'ARENA BOARD'],
  spyglass: ['◎', '#e8e2d4', '#161616', 'SPYGLASS'], tavern: ['⚑', '#8a5a2b', '#fff', 'TAVERN'], bounties: ['!', '#e8e2d4', '#161616', 'BOUNTIES'],
  shop_clothes: ['👕', '#d8322f', '#fff', 'CLOTHES SHOP'], shop_ships: ['⛵', '#2a6df4', '#fff', 'SHIP SKINS'], token_AHOY: ['$', '#22c55e', '#161616', 'TOKENS'],
  cave: ['☠', '#e8e2d4', '#161616', 'SKULL CAVE'],
  fort_flag: ['⚑', '#ffcd00', '#161616', 'DAILY FLAG'], fort_spyglass: ['◎', '#e8e2d4', '#161616', 'CASTLE SPYGLASS'], // [minimap-icons] castle flag + fort spyglass
  route_board: ['!', '#e8e2d4', '#161616', 'NOTICE BOARD'] }; // [hide-notice] only in interact when &noticeboard=1
const POI_HIDE = new Set(['wish_fountain', 'cottage_well']); // wishing fountain + cottage well stay off the map (hidden feature)
const LH_S = (t) => ['✦', '#ffe08a', '#7a3b00', t]; // lighthouses: map + radar
const FPOI = { skullpeak: 'SKULL PEAK', falls: 'WATERFALL', gallows: 'GALLOWS RIDGE', bridge: "HANGMAN'S BRIDGE", lighthouse: 'LIGHTHOUSE', sandbar_lh: 'SANDBAR LIGHT', gate: 'TOWN GATE', cove: "SMUGGLERS' COVE" };
const GEO_POI = new Set(['skullpeak','falls','gallows','bridge','gate','cove','fort_flag','fort_spyglass']); // [map-streets] typography only — never icon these

const MAPZOOM_ON = typeof location === 'undefined' || !/[?&]mapzoom=0(?:&|$)/.test(location.search); // [map-zoom] BANKSY 2:43 PM; &mapzoom=0 = old tap-anywhere-to-close, no zoom/pan
// Overlay panels float above the full-bleed canvas. Fit/zoom/pan use the unobstructed area.
export function mapOverlayViewport(width, height, left = 0, right = 0) {
  const x0 = Math.min(Math.max(0,left),width*0.48), x1 = Math.max(x0+1,width-Math.max(0,right));
  return { x:(x0+x1)/2, y:height/2, width:Math.max(1,x1-x0), height:Math.max(1,height) };
}
export function createIslandMap({ world, layout, low, islands = null, paperSheet = null }) { // paperSheet() = the MAPS parchment chart (js/dock/treasureMap.js sheet())
  const FM = layout.FM, toF = layout.harborToFoot, toH = layout.footToHarbor;
  // [backpack-pvp] t1727u: ONE smooth vector Safe Zone polygon (BANKSY pink+blue outline). Drawn ONLY on
  // Full Island Map (M) + on-foot drawLocal — NEVER on the at-sea ship radar `draw()` / dock.radarZones.
  function drawSafeOverlay(ctx, T, o = {}) {
    if (!SAFEZONES_ON || !SAFE_POLY?.length) return false;
    const paper = !!o.paper;
    ctx.save();
    ctx.beginPath();
    SAFE_POLY.forEach(([fx, fz], i) => { const [a, b] = T(...toH(fx, fz)); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.closePath();
    ctx.fillStyle = paper ? 'rgba(28, 185, 105, 0.18)' : 'rgba(46, 232, 138, 0.16)';
    ctx.fill();
    // crisp double-stroke emerald border (dark outer halo + bright inner)
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(6, 40, 24, 0.85)'; ctx.lineWidth = Math.max(3.5, (o.lw || 2.4) * 1.7); ctx.stroke();
    ctx.strokeStyle = '#2ee88a'; ctx.lineWidth = o.lw || 2.4; ctx.stroke();
    ctx.restore();
    return true;
  }
  function drawSafeZoneRings(ctx, T, k, dpr = 1, o = {}) {
    if (!SAFEZONES_ON) return;
    drawSafeOverlay(ctx, T, { paper: !!o.paper, lw: (o.small ? 1.8 : 2.6) * dpr });
    if (o.labels === false) return;
    // at most ONE clean 🛡️ SAFE ZONE badge (Harbor Plaza) — never 3 stamps, never a Coliseum PvP-on stamp
    ctx.save(); ctx.font = `bold ${Math.round((o.small ? 9 : 11) * dpr)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3 * dpr;
    const plaza = mapSafeZoneRings().find((z) => z.id === 'harbor_plaza') || { x: -620, z: -130 };
    const [a, b] = T(...toH(plaza.x, plaza.z));
    ctx.strokeStyle = '#06140d'; ctx.strokeText('🛡️ SAFE ZONE', a, b); ctx.fillStyle = '#b7ffd8'; ctx.fillText('🛡️ SAFE ZONE', a, b);
    ctx.restore();
  }
  function safeCanvas() { return null; } // legacy no-op (vector path replaced the grid bake)
  const N = low ? 512 : 1024, mpp = (B.x1 - B.x0) / N, NZ = Math.round((B.z1 - B.z0) / mpp);
  let cv = null, g = null, img = null, row = 0, done = false, P = null, LB = null; // LB: land bounds (foot frame) + fit circle
  let buildings = [], zoomPOIs = [], FB = null, buildingStamp = '';
  const footProject = T => (x, z) => T(...toH(x, z));
  const buildingLayer = (ctx, T, th, dpr = 1) => drawBuildingFootprints(ctx, buildings, footProject(T), { theme: th, dpr });
  const buildingBadges = (ctx, T, th, dpr = 1) => drawBuildingEmblems(ctx, buildings.filter(b => !(P || []).some(p => p.id === b.id && p.icon)), footProject(T), { theme: th, maxRadius: 9*dpr, minRadius: 3*dpr });
  let lx0 = 1e9, lx1 = -1e9, lz0 = 1e9, lz1 = -1e9;
  const pois = () => { // [minimap-icons] one icon per id; interact/foot first (real walk-up spots), then FOOT_POIS / landmarks / docks. &mmicons=0 skips the id dedupe.
    const raw = [...layout.interact, ...(world.footInteract || [])].filter(q => !q.mapHidden && !POI_HIDE.has(q.id) && (POI[q.id] || POI[q.kind] || shopIcon(q))).map(q => { const [fx, fz] = toF(q.x, q.z), ic = shopIcon(q); // [v153] shops: a badge per shop id
      return { id: q.id, x: fx, z: fz, s: ic ? ['', ic[1], ic[2], ic[4]] : (POI[q.id] || POI[q.kind]), icon: ic }; })
      .concat((FM.FOOT_POIS || []).filter(p => FPOI[p.id]).map(p => ({ id: p.id, x: p.x, z: p.z, s: /lighthouse|_lh$/.test(p.id) ? LH_S(FPOI[p.id]) : ['▲', '#fde68a', '#161616', FPOI[p.id]], far: true, lh: /lighthouse|_lh$/.test(p.id), geo: GEO_POI.has(p.id) || !/lighthouse|_lh$/.test(p.id) })))
      .concat(rockLights())
      .concat([...mapLandmarks(FM), ...mapDocks(layout)].map(l => { const ic = SHOP_ICONS[l.icon] || SHOP_ICONS.shop; return { id: l.id, x: l.x, z: l.z, s: ['', ic[1], ic[2], l.label], icon: ic, far: l.far, mark: true, geo: !!l.geo }; }));
    zoomPOIs = raw.filter(p => p.icon && !p.mark).map(p => ({...p})); // retain the original radar proximity/zoom inputs
    if (MMICONS_LEGACY) return raw;
    const seen = new Set(), out = [];
    for (const p of raw) {
      const building = buildings.find(b=>b.id===p.id || b.aliases.includes(p.id));
      if (building) { p.id=building.id; p.x=building.x; p.z=building.z; p.icon=building.icon; p.s=['',building.icon[1],building.icon[2],building.name]; p.geo=false; }
      const k = p.id || (p.s && p.s[3]) || `${p.x|0},${p.z|0}`; if (seen.has(k)) continue; seen.add(k); out.push(p); }
    return out; };
  function refreshBuildings(force = false) {
    // Money-maker shop names arrive asynchronously after the terrain bake. Refresh metadata, not terrain.
    const stamp = [layout.interact.length, world.footInteract?.length || 0, FM.LOTS_MAP?.length || 0, FM.LIGHTHOUSES?.length || 0].join(':');
    if (!force && stamp === buildingStamp) return;
    buildingStamp = stamp;
    const interactions = [...layout.interact, ...(world.footInteract || [])].map(q => { const [fx,fz] = toF(q.x,q.z), [lx,lz] = FM.worldToTown(fx,fz); return {...q,lx,lz}; });
    buildings = mapBuildings(FM, interactions); P = pois(); updateBuildingKey();
  }
  // [v108] the offshore rock lighthouse(s) (props.js grid rocks) inside the mapped box
  const rockLights = () => { if (!islands?.lighthousesIn) return []; const [hx0, hz0] = toH(B.x0, B.z0), [hx1, hz1] = toH(B.x1, B.z1);
    return islands.lighthousesIn(Math.min(hx0, hx1), Math.max(hx0, hx1), Math.min(hz0, hz1), Math.max(hz0, hz1)).map((c, i) => { const [x, z] = toF(c.x, c.z); return { id: 'rock_lh_' + i, x, z, s: LH_S('ROCK LIGHT'), far: true, lh: true }; }); };
  // [minimap-themes] build mode: the map re-bakes in the background when the ground is edited (TERRAIN.rev), the old one stays up meanwhile
  let rev = FM.TERRAIN?.rev || 0, again = false; const themed = new Map();
  function checkRev() { refreshBuildings(); const r = FM.TERRAIN?.rev || 0; if (r !== rev && done && !again) { rev = r; again = true; row = 0; lx0 = lz0 = 1e9; lx1 = lz1 = -1e9; } }
  function bakeRows(n) {
    if (done && !again) return true;
    if (!cv) { cv = document.createElement('canvas'); cv.width = N; cv.height = NZ; g = cv.getContext('2d'); }
    if (!img) img = g.createImageData(N, NZ);
    const d = img.data, c = BAKE_C;
    for (let k = 0; k < n && row < NZ; k++, row++) {
      const z = B.z0 + (row + 0.5) * mpp;
      for (let i = 0; i < N; i++) {
        const x = B.x0 + (i + 0.5) * mpp, o = (row * N + i) * 4, code = FM.mapPixel(x, z, c);
        c.convertLinearToSRGB(); let r = c.r * 255, gg = c.g * 255, b = c.b * 255; // THREE.Color is linear: back to sRGB for the canvas
        if (code !== 2) { const h = FM.H(x, z), sh = 1 + (FM.H(x - mpp, z - mpp) - h) * 0.035; r *= sh; gg *= sh; b *= sh; // hill shade (light from the north-west)
          if (x < lx0) lx0 = x; if (x > lx1) lx1 = x; if (z < lz0) lz0 = z; if (z > lz1) lz1 = z;
          if (code === 1) { const hatch = ((i + row) & 3) === 0; const m = hatch ? 0.55 : 0.82; r = r * m + 40 * (1 - m); gg = gg * m + 34 * (1 - m); b = b * m + 30 * (1 - m); } } // steep face
        d[o] = Math.min(255, r); d[o + 1] = Math.min(255, gg); d[o + 2] = Math.min(255, b); d[o + 3] = 255;
      }
    }
    if (row >= NZ) { g.putImageData(img, 0, 0); img = null; overlay(); done = true; again = false; themed.clear(); refreshBuildings(true); }
    return done;
  }
  // [minimap-themes] the baked map recoloured once per theme (NIGHT / GOLD / BLUEPRINT); COLORED = the bake itself
  function base(th) { if (!th.paint) return cv; let t = themed.get(th); if (t) return t;
    t = document.createElement('canvas'); t.width = N; t.height = NZ; const tg = t.getContext('2d'); tg.drawImage(cv, 0, 0); const im = tg.getImageData(0, 0, N, NZ), d = im.data;
    for (let o = 0; o < d.length; o += 4) { const [r, gg, b] = th.paint(d[o], d[o + 1], d[o + 2]); d[o] = r; d[o + 1] = gg; d[o + 2] = b; }
    tg.putImageData(im, 0, 0); if (th === THEMES.blueprint) { tg.globalAlpha = 0.18; tg.strokeStyle = '#cfe4ff'; tg.lineWidth = 1; const st = 100 / mpp;
      for (let x = 0; x < N; x += st) { tg.beginPath(); tg.moveTo(x, 0); tg.lineTo(x, NZ); tg.stroke(); } for (let y = 0; y < NZ; y += st) { tg.beginPath(); tg.moveTo(0, y); tg.lineTo(N, y); tg.stroke(); } tg.globalAlpha = 1; }
    themed.set(th, t); return t; }
  const theme = () => THEMES[getMapStyle()] || THEMES.colored;
  const px = (x, z) => [(x - B.x0) / mpp, (z - B.z0) / mpp];
  function line(pts, w, c, dash) { g.setLineDash(dash || []); g.lineWidth = w; g.strokeStyle = c; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => { const [a, b] = px(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.setLineDash([]); }
  function overlay() { // vectors over the baked terrain (once)
    const s = N / 1024;
    // tree areas: the real foliage spots as dark canopy dots
    const sp = world.foot.spots; if (sp) { g.fillStyle = 'rgba(16,70,30,0.55)'; for (const t of sp.trees) { const [a, b] = px(t[0], t[2]); g.fillRect(a - 0.9 * s, b - 0.9 * s, 1.8 * s + 0.4, 1.8 * s + 0.4); }
      g.fillStyle = 'rgba(40,110,40,0.5)'; for (const t of sp.palms) { const [a, b] = px(t[0], t[2]); g.fillRect(a - 0.7, b - 0.7, 1.4, 1.4); } }
    // decks: piers, boardwalk, jetties
    g.fillStyle = '#b98352'; g.strokeStyle = '#5a3a1e'; g.lineWidth = 1;
    for (const dk of layout.decks || []) { const [cx, cz] = toF(dk.x, dk.z), [a, b] = px(cx, cz); g.save(); g.translate(a, b); g.rotate(-(dk.yaw || 0)); g.fillRect(-dk.hw / mpp, -dk.hl / mpp, 2 * dk.hw / mpp, 2 * dk.hl / mpp); g.strokeRect(-dk.hw / mpp, -dk.hl / mpp, 2 * dk.hw / mpp, 2 * dk.hl / mpp); g.restore(); }
    const MP = FM.MAP_PATHS ? FM.MAP_PATHS() : null;
    if (MP) { line(MP.street, 7 * s + 2, '#161616'); line(MP.street, 5 * s + 1, '#e7d7b8');
      for (const r of MP.ramps) { line(r, 5 * s + 2, '#161616'); line(r, 3 * s + 1, '#c99a5e'); }
      // [minimap-themes] the red / yellow loop is paved now (Main Street cobbles + kerbs): a cobble band with the trail colour down the middle
      for (const [pts, col] of [[MP.A, '#fa0d0d'], [MP.B, '#ffc93c']]) { line(pts, 5.5 * s + 2, '#161616'); line(pts, 4 * s + 1, '#cbbd9f'); line(pts, 1.8 * s + 0.6, col, [8 * s + 2, 4 * s + 1]); }
      for (const a of MP.areas || []) { if (a.pts.length < 2) continue; line(a.pts, (a.pave ? 4.5 : 3.6) * s + 1.5, '#161616'); line(a.pts, (a.pave ? 3 : 2.2) * s + 0.8, a.pave ? '#cbbd9f' : '#d9b77a'); } }
    const BR = FM.BRIDGE; if (BR && BR.L) { line([[BR.ax, BR.az], [BR.bx, BR.bz]], 6 * s + 2, '#161616'); line([[BR.ax, BR.az], [BR.bx, BR.bz]], 4 * s + 1, '#c48a50'); }
    // fit circle for the radar: the land's bounding box, padded
    const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2; LB = { cx, cz, r: Math.max(lx1 - lx0, lz1 - lz0) / 2 * 1.04 + 20 };
    // Full-map ocean framing follows the playable sailing disc, not the terrain raster's crop.
    // Radar/local zoom still uses LB and zr exactly as before.
    const [sx,sz] = toF(SAIL.cx,SAIL.cz), sr = SAIL.r + 60;
    const x0 = SAIL_ALL ? Math.min(lx0,sx-sr) : lx0-180, x1 = SAIL_ALL ? Math.max(lx1,sx+sr) : lx1+180;
    const z0 = SAIL_ALL ? Math.min(lz0,sz-sr) : lz0-80, z1 = SAIL_ALL ? Math.max(lz1,sz+sr) : lz1+80;
    FB = {cx:(x0+x1)/2,cz:(z0+z1)/2,rx:(x1-x0)/2,rz:(z1-z0)/2};
  }
  // ---------- markers (shared by the radar and the full map) ----------
  // st: { me: {x, z, yaw, foot}, ship: {x, z, yaw} | null, peers: [{x, z, foot}], ai: [{x, z, boss}], loot: [{x, z}], dig: {x, z, r} | null } (harbor frame)
  function markers(ctx, T, k, st, sz, clip, th = THEMES.colored) { // T(xh, zh) -> screen; k = px per metre; th = the MINIMAP theme (ink + X colours)
    if (th === true) th = THEMES.paper; else if (!th) th = THEMES.colored; const paper = th.badge === 'paper';
    const out = (a, b) => clip && Math.hypot(a - clip[0], b - clip[1]) > clip[2];
    if (st.dig) { const [a, b] = T(st.dig.x, st.dig.z), r = Math.max(sz * 1.3, st.dig.r * k), ph = (performance.now() / 600) % 1;
      ctx.strokeStyle = paper ? 'rgba(181,21,13,0.6)' : '#ff3b3b'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(a, b, r * (1 + ph * 0.25), 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineCap = 'round'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a - sz * 0.6, b - sz * 0.6); ctx.lineTo(a + sz * 0.6, b + sz * 0.6); ctx.moveTo(a + sz * 0.6, b - sz * 0.6); ctx.lineTo(a - sz * 0.6, b + sz * 0.6); ctx.stroke(); // [v153] dark edge: the X reads on sand + parchment
      ctx.strokeStyle = th.x; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a - sz * 0.6, b - sz * 0.6); ctx.lineTo(a + sz * 0.6, b + sz * 0.6); ctx.moveTo(a + sz * 0.6, b - sz * 0.6); ctx.lineTo(a - sz * 0.6, b + sz * 0.6); ctx.stroke(); ctx.lineCap = 'butt'; }
    for (const l of st.loot || []) { const [a, b] = T(l.x, l.z); if (out(a, b)) continue; ctx.fillStyle = '#ffcd77'; ctx.beginPath(); ctx.arc(a, b, sz * 0.32, 0, 7); ctx.fill(); }
    // [minimap-themes] AI ships: red with a dark edge; the Commodore: a gold crown badge (reads on every theme)
    for (const e of st.ai || []) { const [a, b] = T(e.x, e.z); if (out(a, b)) continue; if (e.boss) { drawShopIcon(ctx, SHOP_ICONS.commodore, a, b, Math.max(7, sz * 0.72)); continue; }
      ctx.fillStyle = '#fa0d0d'; ctx.strokeStyle = th.ink === '#e6f2ff' ? '#06264f' : '#161616'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(a, b, sz * 0.4, 0, 7); ctx.fill(); ctx.stroke(); }
    for (const c2 of st.crew || []) { const [a, b] = T(c2.x, c2.z); if (out(a, b)) continue; const r = Math.max(3.2, sz * 0.32); // [v340] BANKSY t1802u: crew = GREEN diamonds (was cyan)
      ctx.fillStyle = '#2fd866'; ctx.strokeStyle = '#082412'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a, b - r); ctx.lineTo(a + r, b); ctx.lineTo(a, b + r); ctx.lineTo(a - r, b); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    for (const p of st.peers || []) { const [a, b] = T(p.x, p.z); if (out(a, b)) continue; const r = Math.max(4, sz * 0.46); // [v340] squad GREEN, other players BLACK + cream rim
      const sq = !!p.squad; // squadmate: dark edge + white ring + GREEN · other player: dark hairline + light rim + BLACK (reads on water AND sand / parchment)
      ctx.fillStyle = '#161616'; ctx.beginPath(); ctx.arc(a, b, r + (sq ? 1.2 : 1.3), 0, 7); ctx.fill();
      ctx.fillStyle = sq ? '#ffffff' : '#f5efe0'; ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill();
      ctx.fillStyle = sq ? '#2fd866' : '#0d0d10'; ctx.beginPath(); ctx.arc(a, b, r * 0.68, 0, 7); ctx.fill(); }
    if (st.ship) { const [a, b] = T(st.ship.x, st.ship.z), L = Math.max(sz * 0.9, 18 * k), W = L * 0.36; ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI - st.ship.yaw);
      ctx.fillStyle = '#ffcd77'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -L); ctx.quadraticCurveTo(W, -L * 0.3, W * 0.8, L * 0.7); ctx.lineTo(-W * 0.8, L * 0.7); ctx.quadraticCurveTo(-W, -L * 0.3, 0, -L); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (st.me) { const [a, b] = T(st.me.x, st.me.z), s = sz * (st.me.foot ? 0.85 : 1); ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI - st.me.yaw);
      ctx.fillStyle = th.me; ctx.strokeStyle = th.ink === '#e6f2ff' ? '#06264f' : th.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.75); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.7, s * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  // headings: yaw 0 = +z (south on the map, north = -z up), so a screen rotation of (PI - yaw) points the arrow along the heading
  function draw(ctx, W, st) { // the round radar: whole island, north up
    if (!done) { bakeRows(low ? 14 : 18); return false; } // until it's mapped the sea radar stays
    checkRev(); if (again) bakeRows(low ? 6 : 10); const th = theme(), SH = th.sheet && paperSheet ? paperSheet(true) : null; // [map-streets] bare
    const R = W / 2, k = (R - 2) / LB.r, ox = R - (LB.cx - B.x0) * k, oz = R - (LB.cz - B.z0) * k;
    const T = (xh, zh) => { const [fx, fz] = toF(xh, zh); return [ox + (fx - B.x0) * k, oz + (fz - B.z0) * k]; };
    ctx.clearRect(0, 0, W, W); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.clip();
    ctx.fillStyle = th.sea; ctx.fillRect(0, 0, W, W); ctx.imageSmoothingEnabled = true;
    if (SH) ctx.drawImage(SH.cv, ox + (SH.x0 - B.x0) * k, oz + (SH.z0 - B.z0) * k, SH.w / SH.k * k, SH.h / SH.k * k); else ctx.drawImage(base(th), ox, oz, N * mpp * k, NZ * mpp * k);
    buildingLayer(ctx, T, th); buildingBadges(ctx, T, th);
    const sz = Math.max(4.5, W / 22);
    for (const p of P || []) { if (p.far && !p.lh && !p.icon) continue; const [a, b] = T(...toH(p.x, p.z)); if (p.lh) { const ph = 0.6 + 0.4 * Math.sin(performance.now() / 420); ctx.fillStyle = `rgba(255,224,138,${ph})`; ctx.strokeStyle = '#3a1d00'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(a, b, sz * 0.4, 0, 7); ctx.fill(); ctx.stroke(); continue; } if (p.icon) { if (p.far) drawShopIcon(ctx, p.icon, a, b, sz * 0.62, th.badge); continue; } ctx.fillStyle = p.s[1]; ctx.beginPath(); ctx.arc(a, b, sz * 0.42, 0, 7); ctx.fill(); }
    // [t1726u] NO Safe Zone rings on the ship/island radar (draw) — only drawLocal + Full Map M
    markers(ctx, T, k, st, sz, [R, R, R - 3], th);
    ctx.restore();
    ctx.strokeStyle = th.ring; ctx.lineWidth = th.ringW; ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.stroke();
    ctx.fillStyle = th.nFg; ctx.font = `bold ${Math.round(W / 11)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('N', R, 3);
    return true;
  }
  // [v108] ON FOOT: GTA-style local radar built from the island map: centred on you, zoomed in, turning with the camera
  // heading (up = where the camera looks), your arrow fixed in the middle, N marker on the rim. At sea the harbor keeps
  // the original radar (main.js); M / tap = the full-screen island map.
  // [v153] range: 95 m out on the island, eases in to 52 m round the plaza shops so their badges sit apart (shops are ~10 m apart)
  let zr = 95;
  const SEA_P = '#cfc79d'; // the parchment's sea (ead6a4 + the chart's sea wash)
  function drawLocal(ctx, W, st, heading, range = 95) {
    if (!done) { bakeRows(low ? 14 : 18); return false; }
    if (!st.me) return false;
    checkRev(); if (again) bakeRows(low ? 6 : 10);
    const th = theme(), SH = th.sheet && paperSheet ? paperSheet(true) : null, [mx, mz] = toF(st.me.x, st.me.z);
    { let dn = 1e9; for (const p of zoomPOIs) dn = Math.min(dn, Math.hypot(p.x - mx, p.z - mz)); const want = dn < 45 ? 52 : dn > 90 ? range : 52 + (range - 52) * (dn - 45) / 45; zr += (want - zr) * 0.08; if (Math.abs(want - zr) < 0.05) zr = want; }
    const R = W / 2, k = (R - 2) / zr, rot = heading - Math.PI, c = Math.cos(rot), s = Math.sin(rot);
    const T = (xh, zh) => { const [fx, fz] = toF(xh, zh), dx = fx - mx, dz = fz - mz; return [R + k * (dx * c - dz * s), R + k * (dx * s + dz * c)]; };
    ctx.clearRect(0, 0, W, W); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.clip();
    ctx.fillStyle = SH ? SEA_P : th.sea; ctx.fillRect(0, 0, W, W);
    ctx.save(); ctx.translate(R, R); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-mx, -mz); ctx.imageSmoothingEnabled = true;
    if (SH) ctx.drawImage(SH.cv, SH.x0, SH.z0, SH.w / SH.k, SH.h / SH.k); else ctx.drawImage(base(th), B.x0, B.z0, N * mpp, NZ * mpp); ctx.restore();
    buildingLayer(ctx, T, th); buildingBadges(ctx, T, th);
    const szHere = SAFEZONES_ON && insideSafeZone(mx, mz); drawSafeZoneRings(ctx, T, k, 1, { labels: false }); // [backpack-pvp] t1710u the glowing Safe Zone border, turning with you
    if (th.burn) { const gr = ctx.createRadialGradient(R, R, R * 0.55, R, R, R); gr.addColorStop(0, 'rgba(90,45,12,0)'); gr.addColorStop(0.75, 'rgba(110,60,20,.28)'); gr.addColorStop(1, 'rgba(60,28,8,.75)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, W); } // [minimap-themes] TREASURE MAP: burnt parchment edge
    const sz = Math.max(6, W / 13), ir = Math.max(7, W / 15);
    const icons = [];
    for (const p of P || []) { const [a, b] = T(...toH(p.x, p.z)); if (Math.hypot(a - R, b - R) > R - 4) continue; if (p.icon) { icons.push([p.icon, a, b]); continue; }
      { const d = sz * 0.36, lite = th.badge === 'line' ? '#0b3772' : '#fff7e3'; ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI / 4); ctx.fillStyle = lite; ctx.strokeStyle = th.badge === 'line' ? '#e6f2ff' : '#161616'; ctx.lineWidth = 1.4; ctx.fillRect(-d, -d, 2 * d, 2 * d); ctx.strokeRect(-d, -d, 2 * d, 2 * d); ctx.fillStyle = p.s[1]; ctx.fillRect(-d * 0.45, -d * 0.45, d * 0.9, d * 0.9); ctx.restore(); } } // [minimap-themes] BANKSY 11:57: no plain colour dots: a small outlined landmark diamond
    icons.sort((u, v) => u[2] - v[2]); for (const [ic, a, b] of icons) drawShopIcon(ctx, ic, a, b, ir, th.badge); // lower on screen drawn last (on top)
    if (st.dig) digPointer(ctx, T, R, st, W, th); // trail from you + an edge pin when the X is off the radar
    const fix = (o) => o && { ...o, yaw: Math.PI - (Math.PI - o.yaw + rot) }; // markers() turns arrows by (PI - yaw) in screen space: add the map rotation
    markers(ctx, T, k, { ...st, me: fix(st.me), ship: fix(st.ship) }, sz, [R, R, R - 3], th);
    ctx.restore();
    ctx.strokeStyle = th.ring; ctx.lineWidth = th.ringW; ctx.beginPath(); ctx.arc(R, R, R - th.ringW / 2, 0, 7); ctx.stroke();
    { const r = R - W / 14, ax = R + r * s, ay = R - r * c; // north (-z) after the rotation
      ctx.fillStyle = th.nBg; ctx.beginPath(); ctx.arc(ax, ay, W / 15, 0, 7); ctx.fill();
      ctx.fillStyle = th.nFg; ctx.font = `bold ${Math.round(W / 11)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', ax, ay + 1); }
    if (SAFEZONES_ON) { const t = szHere ? '🛡️ SAFE' : '⚔️ PVP', fs = Math.max(9, Math.round(W / 13)); // [backpack-pvp] t1710u rim pill
      ctx.font = `bold ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const tw = ctx.measureText(t).width + fs, py = W - fs * 0.95;
      ctx.fillStyle = szHere ? 'rgba(6,40,24,.92)' : 'rgba(60,10,10,.92)'; ctx.strokeStyle = szHere ? '#2ee88a' : '#ff5a4a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(R - tw / 2, py - fs * 0.7, tw, fs * 1.4, fs * 0.7) : ctx.rect(R - tw / 2, py - fs * 0.7, tw, fs * 1.4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = szHere ? '#b7ffd8' : '#ffd0c8'; ctx.fillText(t, R, py + 1); }
    return true;
  }
  // [v153] the dig X on the radar: a dotted trail from you (the centre) to the X; off the radar = a red pin on the rim pointing at it
  function digPointer(ctx, T, R, st, W, th) { const paper = th === true || th?.badge === 'paper';
    const [a, b] = T(st.dig.x, st.dig.z), dx = a - R, dy = b - R, L = Math.hypot(dx, dy); if (L < W / 12) return;
    const inside = L < R - W / 12, ex = inside ? a : R + dx / L * (R - W / 12), ey = inside ? b : R + dy / L * (R - W / 12);
    ctx.save(); ctx.fillStyle = paper ? 'rgba(150,18,10,0.9)' : th.x || '#ff3b3b'; const step = W / 22, r0 = W / 70, off = (performance.now() / 1000 * step * 1.6) % step;
    for (let d = W / 14 + off; d < Math.hypot(ex - R, ey - R) - W / 22; d += step) { ctx.beginPath(); ctx.arc(R + dx / L * d, R + dy / L * d, r0, 0, 7); ctx.fill(); }
    if (!inside) { const ang = Math.atan2(dy, dx), s2 = W / 16; ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = paper ? '#b5150d' : '#ff3b3b'; ctx.strokeStyle = paper ? '#3b2410' : '#161616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s2 * 1.1, 0); ctx.lineTo(-s2 * 0.7, -s2 * 0.75); ctx.lineTo(-s2 * 0.7, s2 * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.rotate(-ang); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-s2 * 0.3, -s2 * 0.3); ctx.lineTo(s2 * 0.3, s2 * 0.3); ctx.moveTo(s2 * 0.3, -s2 * 0.3); ctx.lineTo(-s2 * 0.3, s2 * 0.3); ctx.stroke(); }
    ctx.restore();
  }
  // ---------- full-screen map ----------
  // [map-zoom] BANKSY 2:43-2:44 PM: wheel / pinch / stick zoom + drag / stick pan on the ISLAND MAP (fit → ~4×), icons stay screen-sized.
  let el = null, fc = null, open = false, getSt = null, raf = 0;
  let z = 1, panX = 0, panZ = 0; // z = zoom (1 = fit whole map), pan = foot-metre offset of the view centre from FB
  let curFX = null, curFZ = null, locEl = null, curEl = null; // [map-streets] cursor + you callouts
  let vx = 0, vz = 0; // pan velocity (foot m / s) for inertia
  let view = {x:0,y:0,width:1,height:1};
  let fitK = 1; // px-per-metre at z=1 for the current canvas (set each frame)
  const ZMIN = 1, ZMAX = 12; // expanded sailing chart still zooms close enough to read individual shop footprints
  const clampZ = (v) => Math.max(ZMIN, Math.min(ZMAX, v));
  function clampPan() { // pan across the whole sailing chart, not just the old land crop
    if (!FB || fitK <= 0) return;
    const k = fitK * z;
    const maxX = Math.max(0, FB.rx - (view.width / 2) / k + 8), maxZ = Math.max(0, FB.rz - (view.height / 2) / k + 8);
    panX = Math.max(-maxX, Math.min(maxX, panX)); panZ = Math.max(-maxZ, Math.min(maxZ, panZ));
  }
  function resetView() { z = 1; panX = panZ = 0; vx = vz = 0; }
  function zoomAt(factor, sx, sy) { // sx,sy = canvas CSS px relative to canvas top-left (centre of zoom); keep that world point under the cursor
    if (!MAPZOOM_ON || !FB || !fc) { z = clampZ(z * factor); return; }
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cx = sx == null ? view.x : sx*dpr, cy = sy == null ? view.y : sy*dpr;
    const k0 = fitK * z, nz = clampZ(z * factor), k1 = fitK * nz;
    // world foot under cursor before zoom: viewCentre + (screen - safeViewportCentre) / k
    const fx = FB.cx + panX + (cx - view.x) / k0, fz = FB.cz + panZ + (cy - view.y) / k0;
    z = nz; panX = fx - FB.cx - (cx - view.x) / k1; panZ = fz - FB.cz - (cy - view.y) / k1; clampPan(); vx = vz = 0;
  }
  function panByPx(dx, dy) { // canvas CSS delta → foot metres (north-up: +y screen = +z foot)
    if (!MAPZOOM_ON || !fitK) return;
    const dpr = Math.min(2, devicePixelRatio || 1), k = fitK * z;
    panX -= dx * dpr / k; panZ -= dy * dpr / k; clampPan();
  }
  function build() {
    el = document.createElement('div'); el.id = 'isle-map'; el.hidden = true;
    const hint = MAPZOOM_ON
      ? 'scroll / pinch zoom · drag to pan · dbl-click reset · M · Esc'
      : 'tap anywhere · M · Esc to close';
    el.innerHTML = `<div class="im-head"><div class="im-title"><small>EXPLORE THE HARBOR</small><b>ISLAND MAP</b></div><div class="im-status"><span class="im-loc" id="im-you-loc"></span><span class="im-cur" id="im-cur-loc"></span></div><span class="im-hint">${hint}</span>` +
      (MAPZOOM_ON ? '<div class="im-zoom" role="group" aria-label="Map zoom"><button type="button" class="im-zbtn" data-z="out" aria-label="Zoom out">−</button><button type="button" class="im-zbtn" data-z="in" aria-label="Zoom in">+</button><button type="button" class="im-zbtn" data-z="reset" aria-label="Recentre"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="display:block;margin:auto" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button></div>' : '') +
      `<button class="im-x" aria-label="Close">✕</button></div><details class="im-building-key" open><summary aria-label="Toggle building key"><span class="im-key-toggle" aria-hidden="true">≡</span><span class="im-key-heading"><small>PLACES & LANDMARKS</small><strong>Buildings</strong></span><span class="im-building-count"></span></summary><div class="im-buildings" aria-label="Building key"></div></details><canvas role="img" aria-label="Island chart. Drag to pan; scroll or pinch to zoom."></canvas>` +
      '<div class="im-key"><span class="im-legend-item"><i style="background:#fff"></i>you </span><span class="im-legend-item"><i style="background:#ffcd77"></i>your ship </span><span class="im-legend-item"><i class="im-k-other" style="background:#0d0d10;box-shadow:0 0 0 2px #f5efe0,0 0 0 3px #161616"></i>other pirates </span><span class="im-legend-item"><i class="im-k-squad" style="background:#2fd866;box-shadow:0 0 0 2px #fff,0 0 0 3px #161616"></i>squad </span><span class="im-legend-item"><i class="im-k-crew" style="background:#2fd866;transform:rotate(45deg);border-radius:1px;box-shadow:0 0 0 1px #082412"></i>crew </span><span class="im-legend-item"><i style="background:#ffcd00"></i>Commodore </span><span class="im-legend-item"><i class="im-k-ai" style="background:#fa0d0d;box-shadow:0 0 0 1px #161616"></i>AI ships </span><span class="im-legend-item"><b style="color:#ff3b3b">✕</b> treasure </span><span class="im-legend-item"><i class="im-tr" style="background:#fa0d0d"></i>crimson trail </span><span class="im-legend-item"><i class="im-tr" style="background:#ffc93c"></i>doubloon trail </span><span class="im-legend-item"><i class="im-st"></i>steep (no way up) </span><span class="im-legend-item"><i style="background:rgba(46,232,138,.45);border:1.5px solid #2ee88a"></i>safe zone</span>' +
      (MAPZOOM_ON ? '<span class="im-padhint" hidden>L-stick pan · LT/RT zoom · Y recentre · B close</span>' : '') + '</div>';
    document.body.appendChild(el); fc = el.querySelector('canvas'); locEl = el.querySelector('#im-you-loc'); curEl = el.querySelector('#im-cur-loc'); if (innerWidth <= 900) el.querySelector('.im-building-key').open = false; updateBuildingKey();
    el.querySelector('.im-x').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); close(); });
    if (!MAPZOOM_ON) {
      el.addEventListener('pointerdown', (e) => { if(e.target.closest('.im-building-key')) return; e.preventDefault(); e.stopPropagation(); setTimeout(close, 0); });
    } else wireZoom(el, fc);
  }
  function updateBuildingKey() {
    const key = el?.querySelector('.im-buildings'); if (!key) return;
    const closed = new Set([...key.querySelectorAll('details:not([open])')].map(g=>g.dataset.group));
    key.replaceChildren();
    const groups = new Map();
    for (const b of buildings) {
      const group = /^(rent_|musket_shop|sword_shop|squad_hall)/.test(b.id) ? 'Hill Street' : /^casino/.test(b.id) ? 'The Golden Doubloon' : /^(castle|coliseum)/.test(b.id) ? 'Citadel & Colosseum' : /^cottage_/.test(b.id) ? 'Cottage Village' : /magazine|lighthouse|sandbar|keeper/.test(b.id) ? 'Coast & Headland' : 'Harbor Waterfront';
      if (!groups.has(group)) groups.set(group,[]); groups.get(group).push(b);
    }
    for (const [name, places] of groups) {
      const group = document.createElement('details'), heading = document.createElement('summary'), list = document.createElement('div');
      group.className='im-key-group'; group.dataset.group=name; group.open=!closed.has(name);
      heading.textContent=name; list.className='im-key-places'; group.append(heading,list);
      for (const b of places) {
        const item = document.createElement('span'), badge = document.createElement('canvas'), label = document.createElement('span');
        item.className = 'im-building'; badge.width = badge.height = 48; badge.setAttribute('aria-hidden','true');
        drawShopIcon(badge.getContext('2d'),b.icon,24,24,19,theme().badge);
        label.textContent = b.name; item.append(badge,label); list.append(item);
      }
      key.append(group);
    }
    const count=el.querySelector('.im-building-count'); if(count) count.textContent=String(buildings.length);

  }
  function wireZoom(root, canvas) {
    root.querySelector('.im-zoom')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]'); if (!b) return; e.preventDefault(); e.stopPropagation();
      if (b.dataset.z === 'in') zoomAt(1.25); else if (b.dataset.z === 'out') zoomAt(1 / 1.25); else resetView();
    });
    // swallow page scroll / browser pinch-zoom while the map is up (canvas handles real zoom)
    const swallow = (e) => { if (e.target.closest('.im-building-key, .im-key')) { e.stopPropagation(); return; } e.preventDefault(); e.stopPropagation(); };
    root.addEventListener('wheel', swallow, { passive: false });
    root.addEventListener('gesturestart', swallow, { passive: false });
    root.addEventListener('gesturechange', swallow, { passive: false });
    // ----- desktop wheel (cursor-centred) -----
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = canvas.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * 0.0015); zoomAt(f, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    const syncCur = (e) => {
      if (!FB || !fc || !fitK) return;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      const sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr, kk = fitK * z;
      const cx = FB.cx + panX, cz = FB.cz + panZ;
      curFX = cx + (sx - view.x) / kk; curFZ = cz + (sy - view.y) / kk;
    };
    canvas.addEventListener('pointermove', syncCur);
    canvas.addEventListener('pointerleave', () => { curFX = curFZ = null; });
    // ----- pointer drag pan + double-click/tap reset -----
    let dragging = false, pid = null, lastX = 0, lastY = 0, lastT = 0, moved = 0, lastTap = 0;
    const pts = new Map(); // pointerId -> {x,y} for pinch
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      canvas.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        dragging = true; pid = e.pointerId; lastX = e.clientX; lastY = e.clientY; lastT = performance.now(); moved = 0; vx = vz = 0;
        const now = performance.now();
        if (now - lastTap < 320) { resetView(); lastTap = 0; } else lastTap = now;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      e.preventDefault();
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) { // pinch
        const [a, b] = [...pts.values()];
        if (!canvas._pinch) { canvas._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; dragging = false; return; }
        const d = Math.hypot(a.x - b.x, a.y - b.y), p = canvas._pinch;
        if (p.d > 4 && d > 4) {
          const r = canvas.getBoundingClientRect();
          zoomAt(d / p.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        }
        canvas._pinch = { d, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        // pan by midpoint motion
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (p.cx != null) panByPx(mx - p.cx, my - p.cy);
        return;
      }
      if (!dragging || e.pointerId !== pid) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY, now = performance.now(), dt = Math.max(1, now - lastT) / 1000;
      panByPx(dx, dy); moved += Math.abs(dx) + Math.abs(dy);
      // velocity in foot m/s
      const dpr = Math.min(2, devicePixelRatio || 1), k = fitK * z || 1;
      vx = -(dx * dpr / k) / dt; vz = -(dy * dpr / k) / dt;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      if (moved > 8) lastTap = 0; // don't treat a drag as a double-tap
    });
    const endPtr = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) canvas._pinch = null;
      if (e.pointerId === pid) { dragging = false; pid = null; }
      // cancel tiny residual velocity
      if (Math.hypot(vx, vz) < 2) vx = vz = 0;
    };
    canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr); // no pointerleave — capture keeps the drag even if the cursor slips off the canvas
    // +/- keys while open (desktop)
    addEventListener('keydown', (e) => {
      if (!open || !MAPZOOM_ON) return;
      if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+') { e.preventDefault(); zoomAt(1.2); }
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-') { e.preventDefault(); zoomAt(1 / 1.2); }
      else if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); resetView(); }
    });
    // show pad hints when a pad is connected
    const hint = root.querySelector('.im-padhint');
    if (hint) { const sync = () => { hint.hidden = !document.documentElement.classList.contains('pfp-padc'); }; sync();
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); }
  }
  function frame() {
    if (!open) return; raf = requestAnimationFrame(frame); if (!done) bakeRows(40);
    const dpr = Math.min(2, devicePixelRatio || 1), Wc = Math.max(1, Math.floor(fc.clientWidth * dpr)), Hc = Math.max(1, Math.floor(fc.clientHeight * dpr));
    if (fc.width !== Wc || fc.height !== Hc) { fc.width = Wc; fc.height = Hc; }
    const canvasRect = fc.getBoundingClientRect(), keyRect = el.querySelector('.im-building-key').getBoundingClientRect();
    const panel = document.getElementById('soc-panel'), socialRect = panel && !panel.hidden ? panel.getBoundingClientRect() : null;
    const left = Math.max(0,keyRect.right-canvasRect.left+16)*dpr;
    const right = socialRect ? Math.max(0,canvasRect.right-socialRect.left+16)*dpr : 16*dpr;
    view = mapOverlayViewport(Wc,Hc,left,right);
    const c = fc.getContext('2d'); c.clearRect(0, 0, Wc, Hc); if (!done) { c.fillStyle = '#ffcd77'; c.font = `${30 * dpr}px "Just Another Hand", cursive`; c.textAlign = 'center'; c.fillText('mapping the island…', Wc / 2, Hc / 2); return; }
    checkRev(); if (again) bakeRows(40);
    // inertia
    if (MAPZOOM_ON && (vx || vz)) { const dt = 1 / 60; panX += vx * dt; panZ += vz * dt; vx *= 0.92; vz *= 0.92; if (Math.hypot(vx, vz) < 0.4) vx = vz = 0; clampPan(); }
    fitK = Math.min(view.width / (2 * FB.rx), view.height / (2 * FB.rz));
    const k = MAPZOOM_ON ? fitK * z : fitK;
    if (MAPZOOM_ON) clampPan();
    const cx = MAPZOOM_ON ? FB.cx + panX : FB.cx, cz = MAPZOOM_ON ? FB.cz + panZ : FB.cz;
    const ox = view.x - (cx - B.x0) * k, oz = view.y - (cz - B.z0) * k;
    const T = (xh, zh) => { const [fx, fz] = toF(xh, zh); return [ox + (fx - B.x0) * k, oz + (fz - B.z0) * k]; };
    const th = theme(), SH = th.sheet && paperSheet ? paperSheet('island') : null; // [map-streets] bare parchment — NEVER stack treasureMap text under islandMap labels
    const baseAt = (ox2, oz2, kk) => SH ? c.drawImage(SH.cv, ox2 + (SH.x0 - B.x0) * kk, oz2 + (SH.z0 - B.z0) * kk, SH.w / SH.k * kk, SH.h / SH.k * kk) : c.drawImage(base(th), ox2, oz2, N * mpp * kk, NZ * mpp * kk);
    c.fillStyle = SH ? SEA_P : th.sea; c.fillRect(0, 0, Wc, Hc); c.imageSmoothingEnabled = true; baseAt(ox, oz, k);
    buildingLayer(c, T, th, dpr); buildingBadges(c, T, th, dpr);
    // [map-streets] shop/dock icons only; geographic names = clean typography (no ▲ pins). Collision boxes prevent overlap.
    const sz = 9 * dpr; c.textBaseline = 'middle';
    const boxes = [];
    const hit = (r) => boxes.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
    const pushBox = (r) => { boxes.push(r); };
    const inkLabel = (txt, a, b, px, col = '#f7e7c2', align = 'center', ang = 0) => {
      c.save(); c.translate(a, b); c.rotate(ang);
      c.font = `bold ${Math.round(px)}px "Just Another Hand", system-ui, sans-serif`;
      c.textAlign = align; c.textBaseline = 'middle';
      const tw = c.measureText(txt).width, thh = px * 0.9, pad = 3 * dpr;
      const local = align === 'left' ? [0, -thh / 2, tw, thh / 2] : align === 'right' ? [-tw, -thh / 2, 0, thh / 2] : [-tw / 2, -thh / 2, tw / 2, thh / 2];
      // AABB in screen space (ignore rotation for collision — good enough + cheap)
      const rr = [a + local[0] - pad, b + local[1] - pad, a + local[2] + pad, b + local[3] + pad];
      if (hit(rr) || a < 8 || b < 8 || a > Wc - 8 || b > Hc - 8) { c.restore(); return false; }
      pushBox(rr);
      c.lineWidth = Math.max(2.5 * dpr, px * 0.14); c.strokeStyle = 'rgba(12,8,4,0.85)'; c.strokeText(txt, 0, 0);
      c.fillStyle = col; c.fillText(txt, 0, 0); c.restore(); return true;
    };
    // town shops / boards / docks: compact icons; hide text when zoomed out so town never piles up
    const showShopText = z >= 1.6;
    for (const p of P || []) {
      if (p.geo || p.id === 'fort_flag' || p.id === 'fort_spyglass') continue; // geography layer owns geo names
      const [a, b] = T(...toH(p.x, p.z)); if (a < -40 || b < -40 || a > Wc + 40 || b > Hc + 40) continue;
      if (p.lh) { // lighthouse — tiny mark, no duplicate text from FPOI
        const ph = 0.75; c.fillStyle = `rgba(255,224,138,${ph})`; c.strokeStyle = '#3a1d00'; c.lineWidth = 1.2 * dpr; c.beginPath(); c.arc(a, b, sz * 0.45, 0, 7); c.fill(); c.stroke();
        if (z >= 1.25) inkLabel(p.s[3], a + sz * 1.2, b, 11 * dpr, '#ffe08a', 'left');
        continue;
      }
      if (p.icon) {
        drawShopIcon(c, p.icon, a, b, sz * 1.05, th.badge);
        pushBox([a - sz, b - sz, a + sz, b + sz]);
        if (showShopText) inkLabel(p.s[3], a + sz * 1.15, b, 11 * dpr, '#fff', 'left');
        continue;
      }
      // non-geo leftover POIs (boards etc.): small badge, text only when zoomed
      c.fillStyle = p.s[1]; c.strokeStyle = '#161616'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(a, b, sz * 0.85, 0, 7); c.fill(); c.stroke();
      c.font = `bold ${Math.round(sz)}px system-ui, sans-serif`; c.textAlign = 'center'; c.fillStyle = p.s[2]; c.fillText(p.s[0], a, b + 0.5);
      pushBox([a - sz, b - sz, a + sz, b + sz]);
      if (showShopText) inkLabel(p.s[3], a + sz + 3, b, 11 * dpr, '#fff', 'left');
    }
    // District names (overview + zoomed)
    for (const gl of GEO_LABELS.filter(g => g.kind === 'district')) {
      const [a, b] = T(...toH(gl.x, gl.z));
      const px = Math.max(11, (gl.size || 12) * dpr * (z < 1.2 ? 1.05 : z < 2 ? 0.95 : 0.85));
      inkLabel(gl.name, a, b, px, 'rgba(255, 220, 150, 0.88)');
    }
    // Spot labels (waterfall / town gate) — zoomed only
    if (z >= 1.25) for (const gl of GEO_LABELS.filter(g => g.kind === 'spot' || g.kind === 'street')) {
      const [a, b] = T(...toH(gl.x, gl.z)); inkLabel(gl.name, a, b, Math.max(10, (gl.size || 11) * dpr * 0.9), 'rgba(247, 231, 194, 0.9)');
    }
    // Street / trail names angled along roads
    const primaryIds = new Set(['market_row','gunpowder_row','lantern_lane','crimson_trail','doubloon_trail','boardwalk']);
    const secondaryIds = new Set(['highgate_road','gladiator_way','citadel_ramp','anglers_path','idol_trail','hangmans_bridge','battery_trail','pier_1','pier_2','pier_3','pier_4','pier_5']);
    const streetList = ISLAND_STREETS.filter(st => (z < 1.25 ? primaryIds.has(st.id) : (primaryIds.has(st.id) || secondaryIds.has(st.id))));
    for (const st of streetList) {
      const pose = streetLabelPose(st); const [a, b] = T(...toH(pose.x, pose.z));
      let ang = pose.ang - Math.PI / 2; // screen: +z down
      if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      const col = st.color || 'rgba(255, 236, 190, 0.92)';
      const px = Math.max(10, (st.primary ? 12 : 10.5) * dpr);
      inkLabel(st.name, a, b, px, col, 'center', ang);
    }
    drawSafeZoneRings(c, T, k, dpr, { paper: th === THEMES.paper || th?.badge === 'paper' }); // [backpack-pvp] t1727u vector sanctuary
    const st = getSt ? getSt() : {}; markers(c, T, k, st, 11 * dpr, null, th);
    // scale bar (metres): length tracks zoom
    const barM = z >= 2.5 ? 25 : z >= 1.5 ? 50 : 100;
    c.strokeStyle = '#fff'; c.lineWidth = 3 * dpr; c.beginPath(); c.moveTo(14 * dpr, Hc - 14 * dpr); c.lineTo(14 * dpr + barM * k, Hc - 14 * dpr); c.stroke();
    c.fillStyle = '#fff'; c.font = `bold ${Math.round(11 * dpr)}px system-ui`; c.textAlign = 'left'; c.fillText(barM + ' m', 14 * dpr, Hc - 24 * dpr);
    if (MAPZOOM_ON && z > 1.02) { c.fillStyle = 'rgba(255,205,119,.85)'; c.font = `bold ${Math.round(12 * dpr)}px system-ui`; c.textAlign = 'right'; c.fillText(z.toFixed(1) + '×', Wc - 14 * dpr, Hc - 14 * dpr); }
    // [map-streets] YOU + CURSOR district · street callouts
    { const me = st.me ? toF(st.me.x, st.me.z) : null;
      const you = me ? locatePoint(me[0], me[1], { onFoot: !!st.me?.foot }) : null;
      if (locEl) { const t = you ? ('📍 YOUR LOCATION: ' + you.callout) : ''; if (locEl.textContent !== t) locEl.textContent = t; }
      if (curEl) { const cur = (curFX != null) ? locatePoint(curFX, curFZ, { onFoot: true }) : null; const t = cur ? ('CURSOR: ' + cur.callout) : ''; if (curEl.textContent !== t) curEl.textContent = t; } }
  }
  // controller: left stick pan (foot m/s), LT/RT or right-stick Y zoom, Y recentre, B close — called from gamepad.js map mode
  function padTick(s) {
    if (!open || !MAPZOOM_ON || !s) return;
    const dt = 1 / 60, speed = (LB?.r || 400) * 0.55 / Math.max(z, 1); // ~half the fit radius per second at 1×
    if (Math.abs(s.lx) > 0.18 || Math.abs(s.ly) > 0.18) { panX += s.lx * speed * dt; panZ += s.ly * speed * dt; clampPan(); vx = vz = 0; }
    const zoomIn = (s.rt || 0) > 0.15 || s.ry < -0.35, zoomOut = (s.lt || 0) > 0.15 || s.ry > 0.35;
    if (zoomIn || zoomOut) zoomAt(Math.exp((zoomIn ? 1 : -1) * 1.2 * dt));
    if (s.recenter) resetView();
    if (s.close) close();
  }
  function openMap(fn) { if (!el) build(); getSt = fn || getSt; open = true; resetView(); el.hidden = false; document.documentElement.classList.add('isle-map-open'); cancelAnimationFrame(raf); frame(); }
  function close() { if (!open) return; open = false; cancelAnimationFrame(raf); if (el) el.hidden = true; document.documentElement.classList.remove('isle-map-open'); vx = vz = 0; }
  // Owner portal reuses this exact terrain bake and harbor->foot transform, not a second map asset.
  function drawAdminChart(canvas, players = []) {
    checkRev(); if (!done || again) bakeRows(24);
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height, dpr = W / Math.max(1, canvas.clientWidth || W);
    c.fillStyle = '#123541'; c.fillRect(0, 0, W, H);
    if (!done) { c.fillStyle = '#ffe0a0'; c.font = '16px system-ui'; c.fillText('Mapping the island…', 20, 35); return false; }
    const dots = players.filter(p => /^Harbor/.test(p.room || '') && !['hull', 'cottage'].includes(p.mode) && Number.isFinite(p.x) && Number.isFinite(p.z)).map(p => ({ ...p, f: toF(p.x, p.z) }));
    // Expand the chart for sailors beyond the island; arena/interior frames must never be projected here.
    const xs = [B.x0, B.x1, ...dots.map(p => p.f[0])], zs = [B.z0, B.z1, ...dots.map(p => p.f[1])];
    const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, z0 = Math.min(...zs) - 30, z1 = Math.max(...zs) + 30;
    const k = Math.min(W / (x1 - x0), H / (z1 - z0));
    const T = (x, z) => [W / 2 + (x - (x0 + x1) / 2) * k, H / 2 + (z - (z0 + z1) / 2) * k];
    const [ox, oz] = T(B.x0, B.z0); c.drawImage(base(THEMES.colored), ox, oz, N * mpp * k, NZ * mpp * k);
    c.font = `${12*dpr}px system-ui`; c.textAlign = 'center'; c.fillStyle = '#ebd7a3';
    for (const gl of GEO_LABELS.filter(g => g.kind === 'district')) { const [a,b] = T(gl.x,gl.z); c.strokeStyle='#102027'; c.lineWidth=3; c.strokeText(gl.name,a,b); c.fillText(gl.name,a,b); }
    dots.forEach((p, i) => { const [a,b] = T(...p.f); c.beginPath(); c.arc(a,b,6*dpr,0,Math.PI*2); c.fillStyle='#68f0cb'; c.fill(); c.strokeStyle='#071d25'; c.lineWidth=2; c.stroke(); c.fillStyle='#fff4d3'; c.textAlign='left'; c.fillText(`${p.label || i+1} ${String(p.name || 'PIRATE').slice(0,20)}`,a+9*dpr,b-8*dpr); });
    c.textAlign='left'; c.fillStyle='#ffe0a0'; c.fillText('N ↑ · island & sea · harbor coordinates',14*dpr,22*dpr);
    return true;
  }
  return { drawAdminChart, draw, drawLocal, drawSafeOverlay, safeCanvas, zoomAt: (f, x, y) => zoomAt(f, x, y), bakeRows, open: openMap, close, toggle: (fn) => open ? close() : openMap(fn), padTick, resetView, zoomIn: () => zoomAt(1.25), zoomOut: () => zoomAt(1 / 1.25), locate: locatePoint, get isOpen() { return open; }, get ready() { return done; }, get pois() { return P || []; }, get zoom() { return z; } };
}
