// [Emerly v106] PUMPFUN PIRATES · ISLAND MAP (BANKSY: "add the full island map to mini map").
//   - ONE pre-rendered texture of the whole island, baked a few rows a frame the first time you enter the harbor (no hitch):
//     Raul's real terrain colours (beach, grass, jungle, rock), shallows + deep water, the lake + river, steep faces hatched
//     (the parts the walk limit blocks), tree areas from the actual foliage, trails A + B (red / gold), Main Street, the carved
//     ramp, the rope bridge, the quay / piers / boardwalk decks, town buildings. 1024 px desktop, 512 px phones / low.
//   - the round radar (top right) shows the WHOLE island, north up, in the harbor at sea AND on foot: you, your ship, other
//     harbor pirates (green), AI ships (red) + the boss (gold ring), gold drops, and the active treasure-map dig area.
//   - tap the radar or press M (rebindable 'map'): a full-screen island map with the same markers + labelled points of
//     interest; tap anywhere / Esc / M closes it. Markers only redraw; the terrain is never rendered again.
// Harbor frame = foot frame - HC (no rotation), so headings are the same in both.
import * as THREE from 'three';
import { shopIcon, drawShopIcon, getMapStyle, THEMES, SHOP_ICONS } from './mapIcons.js'; // [v153] shop badges + MINIMAP STYLE // [minimap-themes] + NIGHT / GOLD / BLUEPRINT
import { mapLandmarks, mapDocks } from './mapLandmarks.js'; // [minimap-themes] castle / fort / battle areas / shops / docks / D2 ruins from the island's own data
const BAKE_C = new THREE.Color(); // colour scratch for the bake
const B = { x0: -940, x1: 700, z0: -820, z1: 780 }; // foot frame: the whole on-foot grid (main island + islets)
const POI = { shop: ['$', '#ffc93c', '#161616', 'SHOP'], squadhall: ['S', '#9b5cff', '#fff', 'SQUAD HALL'], waves: ['W', '#3fc6c9', '#161616', 'STORM HUNT BOARD'], arena: ['A', '#fa0d0d', '#fff', 'ARENA BOARD'],
  spyglass: ['◎', '#e8e2d4', '#161616', 'SPYGLASS'], tavern: ['⚑', '#8a5a2b', '#fff', 'TAVERN'], bounties: ['!', '#e8e2d4', '#161616', 'BOUNTIES'],
  shop_clothes: ['👕', '#d8322f', '#fff', 'CLOTHES SHOP'], shop_ships: ['⛵', '#2a6df4', '#fff', 'SHIP SKINS'], token_AHOY: ['$', '#22c55e', '#161616', 'TOKENS'],
  cave: ['☠', '#e8e2d4', '#161616', 'SKULL CAVE'] };
const LH_S = (t) => ['✦', '#ffe08a', '#7a3b00', t]; // lighthouses: map + radar
const FPOI = { skullpeak: 'SKULL PEAK', falls: 'WATERFALL', gallows: 'GALLOWS HILL', bridge: 'ROPE BRIDGE', lighthouse: 'LIGHTHOUSE', sandbar_lh: 'SANDBAR LIGHT', gate: 'TOWN GATE', cove: "SMUGGLERS' COVE" };

export function createIslandMap({ world, layout, low, islands = null, paperSheet = null }) { // paperSheet() = the MAPS parchment chart (js/dock/treasureMap.js sheet())
  const FM = layout.FM, toF = layout.harborToFoot, toH = layout.footToHarbor;
  const N = low ? 512 : 1024, mpp = (B.x1 - B.x0) / N, NZ = Math.round((B.z1 - B.z0) / mpp);
  let cv = null, g = null, img = null, row = 0, done = false, P = null, LB = null; // LB: land bounds (foot frame) + fit circle
  let lx0 = 1e9, lx1 = -1e9, lz0 = 1e9, lz1 = -1e9;
  const pois = () => [...layout.interact, ...(world.footInteract || [])].filter(q => POI[q.id] || POI[q.kind] || shopIcon(q)).map(q => { const [fx, fz] = toF(q.x, q.z), ic = shopIcon(q); // [v153] shops: a badge per shop id
    return { x: fx, z: fz, s: ic ? ['', ic[1], ic[2], ic[4]] : (POI[q.id] || POI[q.kind]), icon: ic }; })
    .concat((FM.FOOT_POIS || []).filter(p => FPOI[p.id]).map(p => ({ x: p.x, z: p.z, s: /lighthouse|_lh$/.test(p.id) ? LH_S(FPOI[p.id]) : ['▲', '#fde68a', '#161616', FPOI[p.id]], far: true, lh: /lighthouse|_lh$/.test(p.id) })))
    .concat(rockLights())
    .concat([...mapLandmarks(FM), ...mapDocks(layout)].map(l => { const ic = SHOP_ICONS[l.icon]; return { x: l.x, z: l.z, s: ['', ic[1], ic[2], l.label], icon: ic, far: l.far, mark: true }; }));
  // [v108] the offshore rock lighthouse(s) (props.js grid rocks) inside the mapped box
  const rockLights = () => { if (!islands?.lighthousesIn) return []; const [hx0, hz0] = toH(B.x0, B.z0), [hx1, hz1] = toH(B.x1, B.z1);
    return islands.lighthousesIn(Math.min(hx0, hx1), Math.max(hx0, hx1), Math.min(hz0, hz1), Math.max(hz0, hz1)).map(c => { const [x, z] = toF(c.x, c.z); return { x, z, s: LH_S('ROCK LIGHT'), far: true, lh: true }; }); };
  // [minimap-themes] build mode: the map re-bakes in the background when the ground is edited (TERRAIN.rev), the old one stays up meanwhile
  let rev = FM.TERRAIN?.rev || 0, again = false; const themed = new Map();
  function checkRev() { const r = FM.TERRAIN?.rev || 0; if (r !== rev && done && !again) { rev = r; again = true; row = 0; lx0 = lz0 = 1e9; lx1 = lz1 = -1e9; } }
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
    if (row >= NZ) { g.putImageData(img, 0, 0); img = null; overlay(); done = true; again = false; themed.clear(); P = pois(); }
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
    // town buildings + walls (the collision boxes near the town / plaza), drawn as roofs
    for (const o of FM.MAP_BOXES ? FM.MAP_BOXES() : []) { if (o.hx * o.hz < 3) continue; const [a, b] = px(o.x, o.z); g.save(); g.translate(a, b); g.rotate(-Math.atan2(o.s, o.c));
      g.fillStyle = 'rgba(176,74,40,0.95)'; g.fillRect(-o.hx / mpp, -o.hz / mpp, Math.max(1, 2 * o.hx / mpp), Math.max(1, 2 * o.hz / mpp)); g.restore(); }
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
  }
  // ---------- markers (shared by the radar and the full map) ----------
  // st: { me: {x, z, yaw, foot}, ship: {x, z, yaw} | null, peers: [{x, z, foot}], ai: [{x, z, boss}], loot: [{x, z}], dig: {x, z, r} | null } (harbor frame)
  function markers(ctx, T, k, st, sz, clip, th = THEMES.colored) { // T(xh, zh) -> screen; k = px per metre; th = the MINIMAP theme (ink + X colours)
    if (th === true) th = THEMES.paper; else if (!th) th = THEMES.colored; const paper = th === THEMES.paper;
    const out = (a, b) => clip && Math.hypot(a - clip[0], b - clip[1]) > clip[2];
    if (st.dig) { const [a, b] = T(st.dig.x, st.dig.z), r = Math.max(sz * 1.3, st.dig.r * k), ph = (performance.now() / 600) % 1;
      ctx.strokeStyle = paper ? 'rgba(181,21,13,0.6)' : '#ff3b3b'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(a, b, r * (1 + ph * 0.25), 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineCap = 'round'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a - sz * 0.6, b - sz * 0.6); ctx.lineTo(a + sz * 0.6, b + sz * 0.6); ctx.moveTo(a + sz * 0.6, b - sz * 0.6); ctx.lineTo(a - sz * 0.6, b + sz * 0.6); ctx.stroke(); // [v153] dark edge: the X reads on sand + parchment
      ctx.strokeStyle = th.x; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a - sz * 0.6, b - sz * 0.6); ctx.lineTo(a + sz * 0.6, b + sz * 0.6); ctx.moveTo(a + sz * 0.6, b - sz * 0.6); ctx.lineTo(a - sz * 0.6, b + sz * 0.6); ctx.stroke(); ctx.lineCap = 'butt'; }
    for (const l of st.loot || []) { const [a, b] = T(l.x, l.z); if (out(a, b)) continue; ctx.fillStyle = '#ffcd77'; ctx.beginPath(); ctx.arc(a, b, sz * 0.32, 0, 7); ctx.fill(); }
    // [minimap-themes] AI ships: red with a dark edge; the Commodore: a gold crown badge (reads on every theme)
    for (const e of st.ai || []) { const [a, b] = T(e.x, e.z); if (out(a, b)) continue; if (e.boss) { drawShopIcon(ctx, SHOP_ICONS.commodore, a, b, Math.max(7, sz * 0.72)); continue; }
      ctx.fillStyle = '#fa0d0d'; ctx.strokeStyle = th.ink === '#e6f2ff' ? '#06264f' : '#161616'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(a, b, sz * 0.4, 0, 7); ctx.fill(); ctx.stroke(); }
    for (const c2 of st.crew || []) { const [a, b] = T(c2.x, c2.z); if (out(a, b)) continue; const r = Math.max(3.2, sz * 0.32); // your crew: small cyan diamonds
      ctx.fillStyle = '#33d6ff'; ctx.strokeStyle = '#08222c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a, b - r); ctx.lineTo(a + r, b); ctx.lineTo(a, b + r); ctx.lineTo(a - r, b); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    for (const p of st.peers || []) { const [a, b] = T(p.x, p.z); if (out(a, b)) continue; const r = Math.max(4, sz * 0.46); // other pirates: green, white ring, dark edge (phone-readable)
      ctx.fillStyle = '#161616'; ctx.beginPath(); ctx.arc(a, b, r + 1.2, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); ctx.fillStyle = '#2fd866'; ctx.beginPath(); ctx.arc(a, b, r * 0.68, 0, 7); ctx.fill(); }
    if (st.ship) { const [a, b] = T(st.ship.x, st.ship.z), L = Math.max(sz * 0.9, 18 * k), W = L * 0.36; ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI - st.ship.yaw);
      ctx.fillStyle = '#ffcd77'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -L); ctx.quadraticCurveTo(W, -L * 0.3, W * 0.8, L * 0.7); ctx.lineTo(-W * 0.8, L * 0.7); ctx.quadraticCurveTo(-W, -L * 0.3, 0, -L); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (st.me) { const [a, b] = T(st.me.x, st.me.z), s = sz * (st.me.foot ? 0.85 : 1); ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI - st.me.yaw);
      ctx.fillStyle = th.me; ctx.strokeStyle = th.ink === '#e6f2ff' ? '#06264f' : th.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.75); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.7, s * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  // headings: yaw 0 = +z (south on the map, north = -z up), so a screen rotation of (PI - yaw) points the arrow along the heading
  function draw(ctx, W, st) { // the round radar: whole island, north up
    if (!done) { bakeRows(low ? 14 : 18); return false; } // until it's mapped the sea radar stays
    checkRev(); if (again) bakeRows(low ? 6 : 10); const th = theme(), SH = th.sheet && paperSheet ? paperSheet() : null;
    const R = W / 2, k = (R - 2) / LB.r, ox = R - (LB.cx - B.x0) * k, oz = R - (LB.cz - B.z0) * k;
    const T = (xh, zh) => { const [fx, fz] = toF(xh, zh); return [ox + (fx - B.x0) * k, oz + (fz - B.z0) * k]; };
    ctx.clearRect(0, 0, W, W); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.clip();
    ctx.fillStyle = th.sea; ctx.fillRect(0, 0, W, W); ctx.imageSmoothingEnabled = true;
    if (SH) ctx.drawImage(SH.cv, ox + (SH.x0 - B.x0) * k, oz + (SH.z0 - B.z0) * k, SH.w / SH.k * k, SH.h / SH.k * k); else ctx.drawImage(base(th), ox, oz, N * mpp * k, NZ * mpp * k);
    const sz = Math.max(4.5, W / 22);
    for (const p of P || []) { if (p.far && !p.lh && !p.icon) continue; const [a, b] = T(...toH(p.x, p.z)); if (p.lh) { const ph = 0.6 + 0.4 * Math.sin(performance.now() / 420); ctx.fillStyle = `rgba(255,224,138,${ph})`; ctx.strokeStyle = '#3a1d00'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(a, b, sz * 0.4, 0, 7); ctx.fill(); ctx.stroke(); continue; } if (p.icon) { if (p.far) drawShopIcon(ctx, p.icon, a, b, sz * 0.62, th.badge); continue; } ctx.fillStyle = p.s[1]; ctx.beginPath(); ctx.arc(a, b, sz * 0.42, 0, 7); ctx.fill(); }
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
    const th = theme(), SH = th.sheet && paperSheet ? paperSheet() : null, [mx, mz] = toF(st.me.x, st.me.z);
    { let dn = 1e9; for (const p of P || []) if (p.icon && !p.mark) dn = Math.min(dn, Math.hypot(p.x - mx, p.z - mz)); const want = dn < 45 ? 52 : dn > 90 ? range : 52 + (range - 52) * (dn - 45) / 45; zr += (want - zr) * 0.08; if (Math.abs(want - zr) < 0.05) zr = want; }
    const R = W / 2, k = (R - 2) / zr, rot = heading - Math.PI, c = Math.cos(rot), s = Math.sin(rot);
    const T = (xh, zh) => { const [fx, fz] = toF(xh, zh), dx = fx - mx, dz = fz - mz; return [R + k * (dx * c - dz * s), R + k * (dx * s + dz * c)]; };
    ctx.clearRect(0, 0, W, W); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.clip();
    ctx.fillStyle = SH ? SEA_P : th.sea; ctx.fillRect(0, 0, W, W);
    ctx.save(); ctx.translate(R, R); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-mx, -mz); ctx.imageSmoothingEnabled = true;
    if (SH) ctx.drawImage(SH.cv, SH.x0, SH.z0, SH.w / SH.k, SH.h / SH.k); else ctx.drawImage(base(th), B.x0, B.z0, N * mpp, NZ * mpp); ctx.restore();
    const sz = Math.max(6, W / 13), ir = Math.max(7, W / 15);
    const icons = [];
    for (const p of P || []) { const [a, b] = T(...toH(p.x, p.z)); if (Math.hypot(a - R, b - R) > R - 4) continue; if (p.icon) { icons.push([p.icon, a, b]); continue; }
      ctx.fillStyle = SH ? '#f3e3b5' : p.s[1]; ctx.strokeStyle = th.ink === '#e6f2ff' ? '#e6f2ff' : th.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a, b, sz * 0.42, 0, 7); ctx.fill(); ctx.stroke(); if (SH) { ctx.fillStyle = p.s[1]; ctx.beginPath(); ctx.arc(a, b, sz * 0.22, 0, 7); ctx.fill(); } }
    icons.sort((u, v) => u[2] - v[2]); for (const [ic, a, b] of icons) drawShopIcon(ctx, ic, a, b, ir, th.badge); // lower on screen drawn last (on top)
    if (st.dig) digPointer(ctx, T, R, st, W, th); // trail from you + an edge pin when the X is off the radar
    const fix = (o) => o && { ...o, yaw: Math.PI - (Math.PI - o.yaw + rot) }; // markers() turns arrows by (PI - yaw) in screen space: add the map rotation
    markers(ctx, T, k, { ...st, me: fix(st.me), ship: fix(st.ship) }, sz, [R, R, R - 3], th);
    ctx.restore();
    ctx.strokeStyle = th.ring; ctx.lineWidth = th.ringW; ctx.beginPath(); ctx.arc(R, R, R - th.ringW / 2, 0, 7); ctx.stroke();
    { const r = R - W / 14, ax = R + r * s, ay = R - r * c; // north (-z) after the rotation
      ctx.fillStyle = th.nBg; ctx.beginPath(); ctx.arc(ax, ay, W / 15, 0, 7); ctx.fill();
      ctx.fillStyle = th.nFg; ctx.font = `bold ${Math.round(W / 11)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', ax, ay + 1); }
    return true;
  }
  // [v153] the dig X on the radar: a dotted trail from you (the centre) to the X; off the radar = a red pin on the rim pointing at it
  function digPointer(ctx, T, R, st, W, th) { const paper = th === THEMES.paper || th === true;
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
  let el = null, fc = null, open = false, getSt = null, raf = 0;
  function build() {
    el = document.createElement('div'); el.id = 'isle-map'; el.hidden = true;
    el.innerHTML = '<div class="im-head"><b>ISLAND MAP</b><span>tap anywhere · M · Esc to close</span><button class="im-x" aria-label="Close">✕</button></div><canvas></canvas>' +
      '<div class="im-key"><i style="background:#fff"></i>you <i style="background:#ffcd77"></i>your ship <i style="background:#2fd866;box-shadow:0 0 0 2px #fff"></i>pirates <i style="background:#33d6ff;transform:rotate(45deg);border-radius:1px"></i>crew <i style="background:#ffcd00"></i>Commodore <i style="background:#fa0d0d"></i>AI ships <b style="color:#ff3b3b">✕</b> treasure <i class="im-tr" style="background:#fa0d0d"></i>red trail <i class="im-tr" style="background:#ffc93c"></i>yellow trail <i class="im-st"></i>steep (no way up)</div>';
    document.body.appendChild(el); fc = el.querySelector('canvas');
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setTimeout(close, 0); });
  }
  function frame() {
    if (!open) return; raf = requestAnimationFrame(frame); if (!done) bakeRows(40);
    const dpr = Math.min(2, devicePixelRatio || 1), Wc = Math.floor(el.clientWidth * dpr), Hc = Math.floor((el.clientHeight - el.querySelector('.im-head').offsetHeight - el.querySelector('.im-key').offsetHeight) * dpr);
    if (fc.width !== Wc || fc.height !== Hc) { fc.width = Wc; fc.height = Hc; fc.style.height = `${Hc / dpr}px`; }
    const c = fc.getContext('2d'); c.clearRect(0, 0, Wc, Hc); if (!done) { c.fillStyle = '#ffcd77'; c.font = `${30 * dpr}px "Just Another Hand", cursive`; c.textAlign = 'center'; c.fillText('mapping the island…', Wc / 2, Hc / 2); return; }
    const k = Math.min(Wc / (2 * LB.r), Hc / (2 * LB.r)), ox = Wc / 2 - (LB.cx - B.x0) * k, oz = Hc / 2 - (LB.cz - B.z0) * k;
    const T = (xh, zh) => { const [fx, fz] = toF(xh, zh); return [ox + (fx - B.x0) * k, oz + (fz - B.z0) * k]; };
    checkRev(); if (again) bakeRows(40); const th = theme(), SH = th.sheet && paperSheet ? paperSheet() : null; // [minimap-themes] the full map follows the MINIMAP theme
    const baseAt = (ox2, oz2, kk) => SH ? c.drawImage(SH.cv, ox2 + (SH.x0 - B.x0) * kk, oz2 + (SH.z0 - B.z0) * kk, SH.w / SH.k * kk, SH.h / SH.k * kk) : c.drawImage(base(th), ox2, oz2, N * mpp * kk, NZ * mpp * kk);
    c.fillStyle = SH ? SEA_P : th.sea; c.fillRect(0, 0, Wc, Hc); c.imageSmoothingEnabled = true; baseAt(ox, oz, k);
    const sz = 9 * dpr; c.textBaseline = 'middle';
    for (const p of P || []) { const [a, b] = T(...toH(p.x, p.z)); if (p.town) continue; // town POIs: in the HARBOR TOWN inset
      if (p.icon) { drawShopIcon(c, p.icon, a, b, sz * 1.1, th.badge); c.font = `bold ${Math.round(11 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.lineWidth = 3 * dpr; c.strokeStyle = '#111'; c.strokeText(p.s[3], a + sz * 1.1 + 3, b); c.fillStyle = '#fff'; c.fillText(p.s[3], a + sz * 1.1 + 3, b); continue; }
      c.fillStyle = p.s[1]; c.strokeStyle = '#161616'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(a, b, sz, 0, 7); c.fill(); c.stroke();
      c.font = `bold ${Math.round(sz * 1.15)}px system-ui, sans-serif`; c.textAlign = 'center'; c.fillStyle = p.s[2]; c.fillText(p.s[0], a, b + 0.5);
      if (!p.town || k > 0.9 * dpr) { c.font = `bold ${Math.round(11 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.lineWidth = 3 * dpr; c.strokeStyle = '#111'; c.strokeText(p.s[3], a + sz + 3, b); c.fillStyle = '#fff'; c.fillText(p.s[3], a + sz + 3, b); } }
    { const tc = T(...toH(...(FM.TRAILS.A[Math.floor(FM.TRAILS.A.length * 0.3)])))
      c.font = `bold ${Math.round(12 * dpr)}px system-ui, sans-serif`; c.lineWidth = 3 * dpr; c.strokeStyle = '#111'; c.fillStyle = '#fa0d0d'; c.strokeText('RED TRAIL', tc[0] + 6, tc[1]); c.fillText('RED TRAIL', tc[0] + 6, tc[1]);
      const tb = T(...toH(...(FM.TRAILS.B[Math.floor(FM.TRAILS.B.length * 0.55)]))); c.fillStyle = '#ffc93c'; c.strokeText('YELLOW TRAIL', tb[0] + 6, tb[1]); c.fillText('YELLOW TRAIL', tb[0] + 6, tb[1]); }
    const st = getSt ? getSt() : {}; markers(c, T, k, st, 11 * dpr, null, th);
    // HARBOR TOWN inset (the plaza shops + boards are a few metres apart): zoomed box, labelled, same markers
    { const all = (P || []).filter(p => !p.far), med = (a) => a.sort((x, y) => x - y)[a.length >> 1] || 0;
      const mx = med(all.map(p => p.x)), mz = med(all.map(p => p.z)), near = all.filter(p => (p.town = Math.hypot(p.x - mx, p.z - mz) < 90)); // the plaza cluster (not the far cave)
      if (near.length) {
      let cx = 0, cz = 0; near.forEach(p => { cx += p.x; cz += p.z; }); cx /= near.length; cz /= near.length;
      let R = 30; near.forEach(p => { R = Math.max(R, Math.abs(p.x - cx) + 14, Math.abs(p.z - cz) + 10); });
      const margin = (Wc - 2 * LB.r * k) / 2, side = margin > 150 * dpr; // wide screens (phones in landscape): the inset sits in the empty sea on the left
      const bw = side ? Math.min(margin - 16 * dpr, 330 * dpr) : Math.min(Wc * 0.34, 300 * dpr), bh = side ? Math.min(Hc * 0.62, bw * 0.85) : Math.min(Hc * 0.4, 220 * dpr),
        bx = side ? 8 * dpr : Wc - bw - 10 * dpr, by = side ? Hc - bh - 34 * dpr : Hc - bh - 10 * dpr, kk = Math.min(bw / (2 * R), bh / (2 * R));
      const T2 = (xh, zh) => { const [fx, fz] = toF(xh, zh); return [bx + bw / 2 + (fx - cx) * kk, by + bh / 2 + (fz - cz) * kk]; };
      c.save(); c.fillStyle = SH ? SEA_P : th.sea; c.fillRect(bx, by, bw, bh); c.beginPath(); c.rect(bx, by, bw, bh); c.clip();
      baseAt(bx + bw / 2 - (cx - B.x0) * kk, by + bh / 2 - (cz - B.z0) * kk, kk);
      const s2 = 9 * dpr; c.textBaseline = 'middle';
      // [v153] icons first (shrunk when the town is crowded), then labels placed where they don't hit an icon or another label (right, left, below, above; else none)
      const pts = near.map(p => { const [a, b] = T2(...toH(p.x, p.z)); return { p, a, b }; }); let gap = 1e9;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) gap = Math.min(gap, Math.hypot(pts[i].a - pts[j].a, pts[i].b - pts[j].b));
      const si = Math.max(5 * dpr, Math.min(s2 * 1.25, gap * 0.55)), boxes = pts.map(q => [q.a - si, q.b - si, q.a + si, q.b + si]);
      for (const { p, a, b } of pts) { if (p.icon) { drawShopIcon(c, p.icon, a, b, si, th.badge); continue; }
        c.fillStyle = p.s[1]; c.strokeStyle = '#161616'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(a, b, si * 0.85, 0, 7); c.fill(); c.stroke();
        c.font = `bold ${Math.round(si * 0.95)}px system-ui, sans-serif`; c.textAlign = 'center'; c.fillStyle = p.s[2]; c.fillText(p.s[0], a, b + 0.5); }
      c.font = `bold ${Math.round(9.5 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.lineWidth = 3 * dpr; c.strokeStyle = '#111';
      const hit = (r) => boxes.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) || r[0] < bx || r[2] > bx + bw || r[1] < by + 16 * dpr || r[3] > by + bh;
      for (const { p, a, b } of pts) { const tw = c.measureText(p.s[3]).width, th = 11 * dpr, g2 = si + 3 * dpr;
        for (const [x0, y0] of [[a + g2, b - th / 2], [a - g2 - tw, b - th / 2], [a - tw / 2, b + g2], [a - tw / 2, b - g2 - th]]) { const r = [x0, y0, x0 + tw, y0 + th]; if (hit(r)) continue;
          boxes.push(r); c.strokeText(p.s[3], x0, y0 + th / 2); c.fillStyle = '#fff'; c.fillText(p.s[3], x0, y0 + th / 2); break; } }
      markers(c, T2, kk, st, 10 * dpr, null, th); // you / your ship / the X on top of the badges
      c.restore(); c.strokeStyle = '#ffcd77'; c.lineWidth = 2 * dpr; c.strokeRect(bx, by, bw, bh);
      c.font = `bold ${Math.round(11 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.fillStyle = '#ffcd77'; c.fillText('HARBOR TOWN', bx + 6 * dpr, by + 10 * dpr);
      // box on the main map
      const [ta, tb] = T(...toH(cx, cz)); c.strokeStyle = 'rgba(255,205,119,.8)'; c.lineWidth = 1.5 * dpr; c.strokeRect(ta - R * k, tb - R * k, 2 * R * k, 2 * R * k); } }
    // 100 m scale
    c.strokeStyle = '#fff'; c.lineWidth = 3 * dpr; c.beginPath(); c.moveTo(14 * dpr, Hc - 14 * dpr); c.lineTo(14 * dpr + 100 * k, Hc - 14 * dpr); c.stroke(); c.fillStyle = '#fff'; c.font = `bold ${Math.round(11 * dpr)}px system-ui`; c.textAlign = 'left'; c.fillText('100 m', 14 * dpr, Hc - 24 * dpr);
  }
  function openMap(fn) { if (!el) build(); getSt = fn || getSt; open = true; el.hidden = false; document.documentElement.classList.add('isle-map-open'); cancelAnimationFrame(raf); frame(); }
  function close() { if (!open) return; open = false; cancelAnimationFrame(raf); if (el) el.hidden = true; document.documentElement.classList.remove('isle-map-open'); }
  return { draw, drawLocal, bakeRows, open: openMap, close, toggle: (fn) => open ? close() : openMap(fn), get isOpen() { return open; }, get ready() { return done; } };
}
