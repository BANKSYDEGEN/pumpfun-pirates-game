// [Emerly v103] PUMPFUN PIRATES · ISLAND MINIMAP: while you walk the island the round radar (top right) turns into a map of the
// island + town, so you always know where you are and how to get back to your ship (BANKSY).
//   - baked ONCE from Raul's terrain (foot.js heights + walk colliders + the layout's piers), a few rows a frame, the first time
//     you step ashore: 640 px on desktop, 320 px on phones / low (one small canvas, nothing per frame but a drawImage)
//   - heading-up like the sea radar (the camera's facing is up), your pirate = the white arrow in the middle
//   - YOUR SHIP: gold ship marker at its berth; off the map it becomes a gold arrow on the rim pointing the way
//   - key points as small lettered dots: SHOP, the two stalls, Squad Hall, Waves / Arena boards, the spyglass, the tavern
// js/dock/index.js calls draw(ctx, W, walker, berth) from main.js's drawRadar while you're on foot.
const B = { x0: -330, x1: 690, z0: -510, z1: 510 }; // harbor frame metres: the whole main island + the harbor mouth
const RANGE = 95;                                    // metres from the centre to the rim on foot (the sea radar shows 260)
const POI = { shop: ['$', '#ffc93c', '#161616'], stall_red: ['T', '#d8322f', '#fff'], stall_blue: ['C', '#2a6df4', '#fff'], squadhall: ['S', '#9b5cff', '#fff'],
  waves: ['W', '#3fc6c9', '#161616'], arena: ['A', '#fa0d0d', '#fff'], spyglass: ['◎', '#e8e2d4', '#161616'], tavern: ['⚑', '#8a5a2b', '#fff'],
  shop_clothes: ['👕', '#d8322f', '#fff'], shop_ships: ['⛵', '#2a6df4', '#fff'], token_AHOY: ['$', '#22c55e', '#161616'] }; // [v103] plaza shops + the token billboards (one pin)

export function createIslandMap({ world, layout, low }) {
  const N = low ? 320 : 640, mpp = (B.x1 - B.x0) / N, NZ = Math.round((B.z1 - B.z0) / mpp);
  let cv = null, g = null, img = null, row = 0, done = false;
  const pois = () => [...layout.interact, ...(world.footInteract || [])].filter(q => POI[q.id] || POI[q.kind]).map(q => ({ x: q.x, z: q.z, s: POI[q.id] || POI[q.kind] }));
  let P = null;
  const H = (x, z) => world.foot.H(...layout.harborToFoot(x, z));
  function bakeRows(n) { // a few rows per call (spread over frames: no hitch when you step ashore)
    if (done) return true;
    if (!cv) { cv = document.createElement('canvas'); cv.width = N; cv.height = NZ; g = cv.getContext('2d'); img = g.createImageData(N, NZ); }
    const d = img.data;
    for (let k = 0; k < n && row < NZ; k++, row++) {
      const z = B.z0 + (row + 0.5) * mpp;
      for (let i = 0; i < N; i++) {
        const x = B.x0 + (i + 0.5) * mpp, h = H(x, z), o = (row * N + i) * 4; let r, gg, b;
        const deck = world.deckAt(x, z);
        if (deck !== null) { r = 168; gg = 116; b = 63; }
        else if (h < 0.3) { const t = Math.min(1, Math.max(0, (-h - 0.5) / 12)); r = 63 - 40 * t; gg = 198 - 120 * t; b = 201 - 80 * t; }
        else if (world.foot.blocked(...layout.harborToFoot(x, z))) { r = 92; gg = 64; b = 44; }       // buildings / walls / rocks
        else if (h < 2.2) { r = 232; gg = 214; b = 160; }                                           // beach
        else if (h > 30) { r = 150; gg = 146; b = 132; }                                            // high rock
        else { const t = Math.min(1, h / 30); r = 96 - 30 * t; gg = 168 - 40 * t; b = 74 - 20 * t; } // grass -> jungle
        if (h >= 0.3 && deck === null) { const sh = 1 + (H(x - mpp, z - mpp) - h) * 0.03; r *= sh; gg *= sh; b *= sh; } // hill shade
        d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    if (row >= NZ) { g.putImageData(img, 0, 0); img = null; done = true; P = pois(); }
    return done;
  }
  function draw(ctx, W, w, berth) {
    const R = W / 2, k = R / RANGE;
    if (!done) bakeRows(low ? 12 : 16);
    const c = w.camYaw, fx = Math.sin(c), fz = Math.cos(c), rx = -fz, rz = fx; // heading-up: camera forward = up, its right = right
    const toS = (x, z) => { const dx = x - w.x, dz = z - w.z; return [R + (dx * rx + dz * rz) * k, R - (dx * fx + dz * fz) * k]; };
    ctx.clearRect(0, 0, W, W);
    ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.clip();
    ctx.fillStyle = '#1f6e94'; ctx.fillRect(0, 0, W, W);
    if (done) { ctx.save(); const px0 = B.x0 - w.x, pz0 = B.z0 - w.z;
      ctx.setTransform(k * rx * mpp, -k * fx * mpp, k * rz * mpp, -k * fz * mpp, R + k * (rx * px0 + rz * pz0), R - k * (fx * px0 + fz * pz0));
      ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, 0, 0); ctx.restore(); }
    else { ctx.fillStyle = 'rgba(255,205,119,.8)'; ctx.font = `${Math.round(W / 9)}px "Just Another Hand", cursive`; ctx.textAlign = 'center'; ctx.fillText('mapping…', R, R + W / 5); }
    ctx.fillStyle = 'rgba(10,20,26,.18)'; ctx.fillRect(0, 0, W, W);
    // key points (upright letters)
    const pr = Math.max(5.5, W / 22);
    ctx.font = `bold ${Math.round(pr * 1.25)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of P || []) { const [a, b] = toS(p.x, p.z); if (Math.hypot(a - R, b - R) > R - pr) continue;
      ctx.fillStyle = p.s[1]; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(a, b, pr, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.s[2]; ctx.fillText(p.s[0], a, b + 0.5); }
    // your ship
    if (berth) { let [a, b] = toS(berth.x, berth.z); const dx = a - R, dy = b - R, m = Math.hypot(dx, dy), edge = R - pr - 3;
      if (m > edge) { const ux = dx / m, uy = dy / m, ex = R + ux * edge, ey = R + uy * edge; // rim arrow toward the ship
        ctx.fillStyle = '#ffcd77'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ex + ux * 7, ey + uy * 7); ctx.lineTo(ex - uy * 6 - ux * 4, ey + ux * 6 - uy * 4); ctx.lineTo(ex + uy * 6 - ux * 4, ey - ux * 6 - uy * 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.font = `bold ${Math.round(pr * 1.05)}px system-ui, sans-serif`; ctx.fillStyle = '#ffcd77'; ctx.lineWidth = 3; ctx.strokeText('⚓', ex - ux * 11, ey - uy * 11); ctx.fillText('⚓', ex - ux * 11, ey - uy * 11); }
      else { const sy = berth.yaw, hx = Math.sin(sy), hz = Math.cos(sy), ang = Math.atan2(hx * rx + hz * rz, hx * fx + hz * fz); // ship heading on screen
        ctx.save(); ctx.translate(a, b); ctx.rotate(ang); const L = Math.max(9, (berth.len || 18) * k * 0.6), Wd = Math.max(4, L * 0.32);
        ctx.fillStyle = '#ffcd77'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -L); ctx.quadraticCurveTo(Wd, -L * 0.3, Wd * 0.8, L * 0.7); ctx.lineTo(-Wd * 0.8, L * 0.7); ctx.quadraticCurveTo(-Wd, -L * 0.3, 0, -L); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.font = `bold ${Math.round(pr * 1.05)}px system-ui, sans-serif`; ctx.fillStyle = '#ffcd77'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 3; ctx.strokeText('YOUR SHIP', a, b - L - 7); ctx.fillText('YOUR SHIP', a, b - L - 7); } }
    ctx.restore();
    // rim + your pirate (arrow = where you face, relative to the camera)
    ctx.strokeStyle = 'rgba(255,205,119,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(R, R, R - 1, 0, 7); ctx.stroke();
    const a = Math.atan2(Math.sin(w.yaw) * rx + Math.cos(w.yaw) * rz, Math.sin(w.yaw) * fx + Math.cos(w.yaw) * fz), s = Math.max(6, W / 18);
    ctx.save(); ctx.translate(R, R); ctx.rotate(a); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.75); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.7, s * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    return true;
  }
  return { draw, bakeRows, get ready() { return done; } };
}
