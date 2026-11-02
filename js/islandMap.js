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
const BAKE_C = new THREE.Color(); // colour scratch for the bake
const B = { x0: -940, x1: 700, z0: -820, z1: 780 }; // foot frame: the whole on-foot grid (main island + islets)
const POI = { shop: ['$', '#ffc93c', '#161616', 'SHOP'], squadhall: ['S', '#9b5cff', '#fff', 'SQUAD HALL'], waves: ['W', '#3fc6c9', '#161616', 'WAVES BOARD'], arena: ['A', '#fa0d0d', '#fff', 'ARENA BOARD'],
  spyglass: ['◎', '#e8e2d4', '#161616', 'SPYGLASS'], tavern: ['⚑', '#8a5a2b', '#fff', 'TAVERN'], bounties: ['!', '#e8e2d4', '#161616', 'BOUNTIES'],
  shop_clothes: ['👕', '#d8322f', '#fff', 'CLOTHES SHOP'], shop_ships: ['⛵', '#2a6df4', '#fff', 'SHIP SKINS'], token_AHOY: ['$', '#22c55e', '#161616', 'TOKENS'],
  cave: ['☠', '#e8e2d4', '#161616', 'SKULL CAVE'] };
const FPOI = { skullpeak: 'SKULL PEAK', falls: 'WATERFALL', gallows: 'GALLOWS HILL', bridge: 'ROPE BRIDGE', lighthouse: 'LIGHTHOUSE', gate: 'TOWN GATE', cove: "SMUGGLERS' COVE" };

export function createIslandMap({ world, layout, low }) {
  const FM = layout.FM, toF = layout.harborToFoot, toH = layout.footToHarbor;
  const N = low ? 512 : 1024, mpp = (B.x1 - B.x0) / N, NZ = Math.round((B.z1 - B.z0) / mpp);
  let cv = null, g = null, img = null, row = 0, done = false, P = null, LB = null; // LB: land bounds (foot frame) + fit circle
  let lx0 = 1e9, lx1 = -1e9, lz0 = 1e9, lz1 = -1e9;
  const pois = () => [...layout.interact, ...(world.footInteract || [])].filter(q => POI[q.id] || POI[q.kind]).map(q => { const [fx, fz] = toF(q.x, q.z); return { x: fx, z: fz, s: POI[q.id] || POI[q.kind] }; })
    .concat((FM.FOOT_POIS || []).filter(p => FPOI[p.id]).map(p => ({ x: p.x, z: p.z, s: ['▲', '#fde68a', '#161616', FPOI[p.id]], far: true })));
  function bakeRows(n) {
    if (done) return true;
    if (!cv) { cv = document.createElement('canvas'); cv.width = N; cv.height = NZ; g = cv.getContext('2d'); img = g.createImageData(N, NZ); }
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
    if (row >= NZ) { g.putImageData(img, 0, 0); img = null; overlay(); done = true; P = pois(); }
    return done;
  }
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
      line(MP.A, 4 * s + 2, '#161616'); line(MP.A, 2.4 * s + 1, '#fa0d0d', [8 * s + 2, 5 * s + 1]); line(MP.B, 4 * s + 2, '#161616'); line(MP.B, 2.4 * s + 1, '#ffc93c', [8 * s + 2, 5 * s + 1]); }
    const BR = FM.BRIDGE; if (BR && BR.L) { line([[BR.ax, BR.az], [BR.bx, BR.bz]], 6 * s + 2, '#161616'); line([[BR.ax, BR.az], [BR.bx, BR.bz]], 4 * s + 1, '#c48a50'); }
    // fit circle for the radar: the land's bounding box, padded
    const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2; LB = { cx, cz, r: Math.max(lx1 - lx0, lz1 - lz0) / 2 * 1.04 + 20 };
  }
  // ---------- markers (shared by the radar and the full map) ----------
  // st: { me: {x, z, yaw, foot}, ship: {x, z, yaw} | null, peers: [{x, z, foot}], ai: [{x, z, boss}], loot: [{x, z}], dig: {x, z, r} | null } (harbor frame)
  function markers(ctx, T, k, st, sz, clip) { // T(xh, zh) -> screen; k = px per metre
    const out = (a, b) => clip && Math.hypot(a - clip[0], b - clip[1]) > clip[2];
    if (st.dig) { const [a, b] = T(st.dig.x, st.dig.z), r = Math.max(sz * 1.3, st.dig.r * k), ph = (performance.now() / 600) % 1;
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(a, b, r * (1 + ph * 0.25), 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a - sz * 0.6, b - sz * 0.6); ctx.lineTo(a + sz * 0.6, b + sz * 0.6); ctx.moveTo(a + sz * 0.6, b - sz * 0.6); ctx.lineTo(a - sz * 0.6, b + sz * 0.6); ctx.stroke(); }
    for (const l of st.loot || []) { const [a, b] = T(l.x, l.z); if (out(a, b)) continue; ctx.fillStyle = '#ffcd77'; ctx.beginPath(); ctx.arc(a, b, sz * 0.32, 0, 7); ctx.fill(); }
    for (const e of st.ai || []) { const [a, b] = T(e.x, e.z); if (out(a, b)) continue; if (e.boss) { ctx.fillStyle = '#ffcd00'; ctx.beginPath(); ctx.arc(a, b, sz * 0.7, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fa0d0d'; ctx.beginPath(); ctx.arc(a, b, sz * (e.boss ? 0.5 : 0.38), 0, 7); ctx.fill(); }
    for (const p of st.peers || []) { const [a, b] = T(p.x, p.z); if (out(a, b)) continue; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a, b, sz * 0.48, 0, 7); ctx.fill(); ctx.fillStyle = '#4ee37a'; ctx.beginPath(); ctx.arc(a, b, sz * 0.34, 0, 7); ctx.fill(); }
    if (st.ship) { const [a, b] = T(st.ship.x, st.ship.z), L = Math.max(sz * 0.9, 18 * k), W = L * 0.36; ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI - st.ship.yaw);
      ctx.fillStyle = '#ffcd77'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -L); ctx.quadraticCurveTo(W, -L * 0.3, W * 0.8, L * 0.7); ctx.lineTo(-W * 0.8, L * 0.7); ctx.quadraticCurveTo(-W, -L * 0.3, 0, -L); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (st.me) { const [a, b] = T(st.me.x, st.me.z), s = sz * (st.me.foot ? 0.85 : 1); ctx.save(); ctx.translate(a, b); ctx.rotate(Math.PI - st.me.yaw);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.75); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.7, s * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  // headings: yaw 0 = +z (south on the map, north = -z up), so a screen rotation of (PI - yaw) points the arrow along the heading
  function draw(ctx, W, st) { // the round radar: whole island, north up
    if (!done) { bakeRows(low ? 14 : 18); return false; } // until it's mapped the sea radar stays
    const R = W / 2, k = (R - 2) / LB.r, ox = R - (LB.cx - B.x0) * k, oz = R - (LB.cz - B.z0) * k;
    const T = (xh, zh) => { const [fx, fz] = toF(xh, zh); return [ox + (fx - B.x0) * k, oz + (fz - B.z0) * k]; };
    ctx.clearRect(0, 0, W, W); ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.clip();
    ctx.fillStyle = '#174f70'; ctx.fillRect(0, 0, W, W); ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, ox, oz, N * mpp * k, NZ * mpp * k);
    const sz = Math.max(4.5, W / 22);
    for (const p of P || []) { if (p.far) continue; const [a, b] = T(...toH(p.x, p.z)); ctx.fillStyle = p.s[1]; ctx.beginPath(); ctx.arc(a, b, sz * 0.42, 0, 7); ctx.fill(); }
    markers(ctx, T, k, st, sz, [R, R, R - 3]);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,205,119,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffcd77'; ctx.font = `bold ${Math.round(W / 11)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('N', R, 3);
    return true;
  }
  // ---------- full-screen map ----------
  let el = null, fc = null, open = false, getSt = null, raf = 0;
  function build() {
    el = document.createElement('div'); el.id = 'isle-map'; el.hidden = true;
    el.innerHTML = '<div class="im-head"><b>ISLAND MAP</b><span>tap anywhere · M · Esc to close</span><button class="im-x" aria-label="Close">✕</button></div><canvas></canvas>' +
      '<div class="im-key"><i style="background:#fff"></i>you <i style="background:#ffcd77"></i>your ship <i style="background:#4ee37a"></i>pirates <i style="background:#fa0d0d"></i>AI ships <i class="im-tr" style="background:#fa0d0d"></i>trail A <i class="im-tr" style="background:#ffc93c"></i>trail B <i class="im-st"></i>steep (no way up)</div>';
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
    c.fillStyle = '#174f70'; c.fillRect(0, 0, Wc, Hc); c.imageSmoothingEnabled = true; c.drawImage(cv, ox, oz, N * mpp * k, NZ * mpp * k);
    const sz = 9 * dpr; c.textBaseline = 'middle';
    for (const p of P || []) { const [a, b] = T(...toH(p.x, p.z)); if (p.town) continue; // town POIs: in the HARBOR TOWN inset
      c.fillStyle = p.s[1]; c.strokeStyle = '#161616'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(a, b, sz, 0, 7); c.fill(); c.stroke();
      c.font = `bold ${Math.round(sz * 1.15)}px system-ui, sans-serif`; c.textAlign = 'center'; c.fillStyle = p.s[2]; c.fillText(p.s[0], a, b + 0.5);
      if (!p.town || k > 0.9 * dpr) { c.font = `bold ${Math.round(11 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.lineWidth = 3 * dpr; c.strokeStyle = '#111'; c.strokeText(p.s[3], a + sz + 3, b); c.fillStyle = '#fff'; c.fillText(p.s[3], a + sz + 3, b); } }
    { const tc = T(...toH(...(FM.TRAILS.A[Math.floor(FM.TRAILS.A.length * 0.3)])))
      c.font = `bold ${Math.round(12 * dpr)}px system-ui, sans-serif`; c.lineWidth = 3 * dpr; c.strokeStyle = '#111'; c.fillStyle = '#fa0d0d'; c.strokeText('TRAIL A', tc[0] + 6, tc[1]); c.fillText('TRAIL A', tc[0] + 6, tc[1]);
      const tb = T(...toH(...(FM.TRAILS.B[Math.floor(FM.TRAILS.B.length * 0.55)]))); c.fillStyle = '#ffc93c'; c.strokeText('TRAIL B', tb[0] + 6, tb[1]); c.fillText('TRAIL B', tb[0] + 6, tb[1]); }
    const st = getSt ? getSt() : {}; markers(c, T, k, st, 11 * dpr, null);
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
      c.save(); c.fillStyle = '#174f70'; c.fillRect(bx, by, bw, bh); c.beginPath(); c.rect(bx, by, bw, bh); c.clip();
      c.drawImage(cv, bx + bw / 2 - (cx - B.x0) * kk, by + bh / 2 - (cz - B.z0) * kk, N * mpp * kk, NZ * mpp * kk);
      markers(c, T2, kk, st, 10 * dpr, null);
      const s2 = 9 * dpr; c.textBaseline = 'middle';
      for (const p of near) { const [a, b] = T2(...toH(p.x, p.z)); c.fillStyle = p.s[1]; c.strokeStyle = '#161616'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(a, b, s2, 0, 7); c.fill(); c.stroke();
        c.font = `bold ${Math.round(s2 * 1.1)}px system-ui, sans-serif`; c.textAlign = 'center'; c.fillStyle = p.s[2]; c.fillText(p.s[0], a, b + 0.5);
        c.font = `bold ${Math.round(9.5 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.lineWidth = 3 * dpr; c.strokeStyle = '#111'; c.strokeText(p.s[3], a + s2 + 2, b); c.fillStyle = '#fff'; c.fillText(p.s[3], a + s2 + 2, b); }
      c.restore(); c.strokeStyle = '#ffcd77'; c.lineWidth = 2 * dpr; c.strokeRect(bx, by, bw, bh);
      c.font = `bold ${Math.round(11 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.fillStyle = '#ffcd77'; c.fillText('HARBOR TOWN', bx + 6 * dpr, by + 10 * dpr);
      // box on the main map
      const [ta, tb] = T(...toH(cx, cz)); c.strokeStyle = 'rgba(255,205,119,.8)'; c.lineWidth = 1.5 * dpr; c.strokeRect(ta - R * k, tb - R * k, 2 * R * k, 2 * R * k); } }
    // 100 m scale
    c.strokeStyle = '#fff'; c.lineWidth = 3 * dpr; c.beginPath(); c.moveTo(14 * dpr, Hc - 14 * dpr); c.lineTo(14 * dpr + 100 * k, Hc - 14 * dpr); c.stroke(); c.fillStyle = '#fff'; c.font = `bold ${Math.round(11 * dpr)}px system-ui`; c.textAlign = 'left'; c.fillText('100 m', 14 * dpr, Hc - 24 * dpr);
  }
  function openMap(fn) { if (!el) build(); getSt = fn || getSt; open = true; el.hidden = false; document.documentElement.classList.add('isle-map-open'); cancelAnimationFrame(raf); frame(); }
  function close() { if (!open) return; open = false; cancelAnimationFrame(raf); if (el) el.hidden = true; document.documentElement.classList.remove('isle-map-open'); }
  return { draw, bakeRows, open: openMap, close, toggle: (fn) => open ? close() : openMap(fn), get isOpen() { return open; }, get ready() { return done; } };
}
