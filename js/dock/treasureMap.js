// [v145] PUMPFUN PIRATES · THE TREASURE MAP (BANKSY: "make it more of a moment when they get a treasure map, also when they open it
// a treasure map needs to pop up with island map on it with the treasure hunt").
//   - sheet(): ONE hand-drawn parchment chart of the REAL island + harbor, baked once from the on-foot terrain (js/island/foot.js
//     H(), the same heightmap you walk on): ink coastline + offshore ripple lines (marching squares on the heights), hill contours,
//     the lagoon + river, forests from the actual tree spots, peaks, the town roofs, the piers / boardwalk (js/dock/layout.js decks),
//     trails A + B, the rope bridge, labelled landmarks, a compass rose, a scale bar, aged / burnt torn edges and fold creases.
//   - the MAPS screen (open / close): full screen, the sheet fitted to any phone or desktop (portrait + landscape, safe areas),
//     a dotted trail from YOU to a red X on the exact dig spot, your other maps as small marks, chips to pick a map.
//     Tap anywhere (but a chip) / ✕ / Esc closes it.
//   - reveal(): the drop moment: a scroll unrolls with this chart on it, gold light rays, sparkles, fanfare (audio.js
//     sfx.treasureMap). It never takes input from the game (pointer-events: none except the scroll / VIEW MAP).
// Everything is in the FOOT frame (north = -z up, like js/islandMap.js); the spots + you come in harbor coords (toF converts).
import { mapLandmarks, mapDocks } from '../mapLandmarks.js'; // [minimap-themes] the chart's new landmarks (fort, battery, battle areas, shops, D2 ruins, docks)
import { SHOP_ICONS, drawShopIcon } from '../mapIcons.js';
const B = { x0: -940, x1: 700, z0: -820, z1: 780 }; // the on-foot grid (same box as js/islandMap.js)
const INK = '#3b2410', INK_S = 'rgba(59,36,16,', RED = '#b5150d';
const LABELS = { skullpeak: 'Skull Peak', falls: 'Waterfall', gallows: 'Gallows Hill', bridge: 'Rope Bridge', lighthouse: 'Lighthouse', sandbar_lh: 'Sandbar Light', cove: "Smugglers' Cove", gate: 'Town Gate' };
const FONT = "'Just Another Hand', cursive";
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const CSS = `
#tm-map{position:fixed;inset:0;z-index:61;display:none;background:radial-gradient(ellipse at 50% 40%,#3a2614 0%,#1a0f07 70%,#0c0703 100%);touch-action:none;user-select:none;-webkit-user-select:none}
#tm-map.on{display:block}
#tm-map canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#tm-map .tm-x{position:absolute;top:calc(var(--safe-t,0px) + 10px);right:calc(var(--safe-r,0px) + 10px);width:46px;height:46px;border-radius:50%;border:2px solid #ffcd77;background:rgba(22,14,6,.85);color:#ffcd77;font:26px/1 system-ui,sans-serif;cursor:pointer;z-index:2}
#tm-map .tm-bar{position:absolute;left:0;right:0;bottom:0;padding:6px calc(var(--safe-r,0px) + 10px) calc(var(--safe-b,0px) + 8px) calc(var(--safe-l,0px) + 10px);display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:none;z-index:2}
#tm-map .tm-chips{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;max-width:100%;pointer-events:auto;padding-bottom:2px;scrollbar-width:none}
#tm-map .tm-chip{flex:0 0 auto;font:20px/1.02 ${FONT};padding:5px 11px 3px;border-radius:11px;border:2px solid rgba(255,205,119,.45);background:rgba(22,14,6,.86);color:#f4e2bb;cursor:pointer;text-align:left}
#tm-map .tm-chip small{display:block;font-size:15px;color:#cdb68c}
#tm-map .tm-chip.sel{border-color:#ffcd77;background:rgba(80,44,10,.92);color:#fff}
#tm-map .tm-hint{font:21px ${FONT};color:#f7e7c2;text-shadow:0 2px 3px #000;text-align:center;letter-spacing:.03em}
#tm-map .tm-hint b{color:#ffcd3c;font-weight:normal}
#tm-reveal{position:fixed;inset:0;z-index:40;pointer-events:none;display:none;align-items:center;justify-content:center;flex-direction:column}
#tm-reveal.on{display:flex}
#tm-reveal canvas.tm-fx{position:absolute;inset:0;width:100%;height:100%}
#tm-reveal .tm-rays{position:absolute;left:50%;top:46%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;background:repeating-conic-gradient(from 0deg,rgba(255,214,110,.16) 0deg 7deg,rgba(255,214,110,0) 7deg 20deg);-webkit-mask:radial-gradient(circle,#000 0,rgba(0,0,0,.6) 18%,transparent 46%);mask:radial-gradient(circle,#000 0,rgba(0,0,0,.6) 18%,transparent 46%);animation:tmSpin 14s linear infinite,tmFade .6s ease-out both}
#tm-reveal .tm-head{position:relative;font:clamp(40px,9vw,74px)/1 ${FONT};color:#ffd76a;letter-spacing:.05em;text-shadow:0 3px 0 #5a2d00,0 0 18px rgba(255,190,60,.8),0 4px 12px #000;animation:tmPop .55s cubic-bezier(.2,1.6,.4,1) both;margin-bottom:6px;text-align:center}
#tm-reveal .tm-scroll{position:relative;width:min(84vw,480px);pointer-events:auto;cursor:pointer;animation:tmPop .5s cubic-bezier(.2,1.5,.4,1) .05s both}
#tm-reveal .tm-sheet{position:relative;width:92%;margin:0 auto;aspect-ratio:1.5;background:#e9d4a2;box-shadow:inset 0 0 26px rgba(90,50,15,.55),0 8px 24px rgba(0,0,0,.6);overflow:hidden;animation:tmUnroll .95s cubic-bezier(.25,.9,.3,1) .35s both}
#tm-reveal .tm-sheet canvas{position:absolute;inset:0;width:100%;height:100%}
#tm-reveal .tm-roll{position:absolute;left:0;right:0;height:22px;margin-top:-11px;border-radius:11px;background:linear-gradient(#5a3214,#c98d4f 35%,#8a5527 60%,#3a1f0a);box-shadow:0 3px 8px rgba(0,0,0,.6);z-index:2}
#tm-reveal .tm-roll:before,#tm-reveal .tm-roll:after{content:'';position:absolute;top:-4px;width:18px;height:30px;border-radius:7px;background:linear-gradient(#3a1f0a,#a06a35 45%,#2a1606)}
#tm-reveal .tm-roll:before{left:-8px} #tm-reveal .tm-roll:after{right:-8px}
#tm-reveal .tm-roll.a{animation:tmRollA .95s cubic-bezier(.25,.9,.3,1) .35s both} #tm-reveal .tm-roll.b{animation:tmRollB .95s cubic-bezier(.25,.9,.3,1) .35s both}
#tm-reveal .tm-sub{position:relative;margin-top:10px;text-align:center;font:clamp(24px,5.6vw,34px)/1.02 ${FONT};color:#fff;text-shadow:0 2px 4px #000;animation:tmFade .5s ease-out 1.1s both}
#tm-reveal .tm-sub small{display:block;font-size:.72em;color:#f1dfb5}
#tm-reveal .tm-view{position:relative;margin-top:10px;pointer-events:auto;font:24px ${FONT};letter-spacing:.05em;padding:7px 20px 4px;border-radius:13px;border:3px solid #ffcd77;background:#fa0d0d;color:#fff;cursor:pointer;animation:tmFade .5s ease-out 1.3s both}
#tm-reveal.out{animation:tmOut .45s ease-in both}
@keyframes tmSpin{to{transform:rotate(360deg)}}
@keyframes tmFade{from{opacity:0}to{opacity:1}}
@keyframes tmOut{to{opacity:0;transform:scale(.94)}}
@keyframes tmPop{from{opacity:0;transform:scale(.3) rotate(-7deg)}to{opacity:1;transform:none}}
@keyframes tmUnroll{from{clip-path:inset(50% 0 50% 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes tmRollA{from{top:50%}to{top:0}} @keyframes tmRollB{from{top:50%}to{top:100%}}
@media (max-height:480px){#tm-reveal .tm-scroll{width:min(58vh*1.5,60vw)} #tm-reveal .tm-head{font-size:40px;margin-bottom:2px} #tm-reveal .tm-sub{margin-top:4px;font-size:22px} #tm-reveal .tm-view{margin-top:4px;padding:4px 14px 2px;font-size:20px}}
`;

export function createTreasureMap({ FM, toF, decks = [], spots = null, low = false, sfx = null, layout = null }) { // layout: docks (berths) for the chart
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  // ---------------- the chart (baked once) ----------------
  let SH = null; // { cv, x0, z0, k, w, h }
  function sheet() {
    if (SH && SH.rev === (FM.TERRAIN?.rev || 0)) return SH; // [minimap-themes] build-mode edits re-ink the chart (next time it's shown)
    const t0 = performance.now(), S = 5, nx = Math.floor((B.x1 - B.x0) / S) + 1, nz = Math.floor((B.z1 - B.z0) / S) + 1, G = new Float32Array(nx * nz);
    let lx0 = 1e9, lx1 = -1e9, lz0 = 1e9, lz1 = -1e9;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = B.x0 + i * S, z = B.z0 + j * S, h = FM.H(x, z); G[j * nx + i] = h;
      if (h > 0.3) { if (x < lx0) lx0 = x; if (x > lx1) lx1 = x; if (z < lz0) lz0 = z; if (z > lz1) lz1 = z; } }
    for (const d of decks) { const [fx, fz] = toF(d.x, d.z); lx0 = Math.min(lx0, fx - 30); lx1 = Math.max(lx1, fx + 30); lz0 = Math.min(lz0, fz - 30); lz1 = Math.max(lz1, fz + 30); }
    const pad = 70, x0 = Math.max(B.x0, lx0 - pad), x1 = Math.min(B.x1, lx1 + pad), z0 = Math.max(B.z0, lz0 - pad - 40), z1 = Math.min(B.z1, lz1 + pad);
    const LONG = low ? 1150 : 1700, k = LONG / Math.max(x1 - x0, z1 - z0), w = Math.round((x1 - x0) * k), h = Math.round((z1 - z0) * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    const P = (x, z) => [(x - x0) * k, (z - z0) * k], u = k / 1.0; // px per metre
    const lw = (px) => px * LONG / 1700; // line widths scale with the sheet
    const wob = (x, z, a) => [(hash2(x * 0.05, z * 0.05) - 0.5) * a, (hash2(z * 0.05 + 7, x * 0.05) - 0.5) * a]; // hand wobble, continuous in world space
    // parchment
    g.fillStyle = '#ead6a4'; g.fillRect(0, 0, w, h);
    { const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.hypot(w, h) * 0.55); r.addColorStop(0, 'rgba(255,246,214,0.35)'); r.addColorStop(1, 'rgba(255,246,214,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }
    g.fillStyle = 'rgba(64,118,122,0.16)'; g.fillRect(0, 0, w, h); // sea wash
    // land: one pixel per grid cell, coloured by height, scaled up smooth (the ink coastline covers the soft edge)
    { const lm = document.createElement('canvas'); lm.width = nx; lm.height = nz; const lg = lm.getContext('2d'), im = lg.createImageData(nx, nz), d = im.data;
      for (let q = 0; q < nx * nz; q++) { const hh = G[q]; if (hh <= 0.3) continue; const f = Math.min(1, hh / 110), o = q * 4;
        d[o] = 236 - 40 * f; d[o + 1] = 214 - 48 * f; d[o + 2] = 160 - 50 * f; d[o + 3] = 255; }
      lg.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(lm, (B.x0 - x0) * k - S * k / 2, (B.z0 - z0) * k - S * k / 2, nx * S * k, nz * S * k); }
    // marching squares -> segments (world), drawn with a hand wobble
    function contour(L, width, color, dash, wobA = 2.2) {
      g.beginPath();
      const pt = (fi, fj) => { const x = B.x0 + fi * S, z = B.z0 + fj * S, [ax, az] = wob(x, z, wobA); return P(x + ax, z + az); };
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = G[j * nx + i], b = G[j * nx + i + 1], c = G[(j + 1) * nx + i + 1], d = G[(j + 1) * nx + i];
        const code = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0); if (code === 0 || code === 15) continue;
        const T = () => pt(i + (L - a) / (b - a), j), R = () => pt(i + 1, j + (L - b) / (c - b)), Bo = () => pt(i + (L - d) / (c - d), j + 1), Le = () => pt(i, j + (L - a) / (d - a));
        const seg = (p, q) => { const A = p(), Bq = q(); g.moveTo(A[0], A[1]); g.lineTo(Bq[0], Bq[1]); };
        switch (code) { case 1: case 14: seg(Le, Bo); break; case 2: case 13: seg(Bo, R); break; case 3: case 12: seg(Le, R); break; case 4: case 11: seg(T, R); break;
          case 6: case 9: seg(T, Bo); break; case 7: case 8: seg(Le, T); break; case 5: seg(Le, T); seg(Bo, R); break; case 10: seg(T, R); seg(Le, Bo); break; }
      }
      g.setLineDash(dash || []); g.lineWidth = width; g.strokeStyle = color; g.lineCap = 'round'; g.stroke(); g.setLineDash([]);
    }
    // offshore ripple lines (classic chart hachure), faint hill contours
    [[-1.6, 1.5, 0.55], [-4.5, 1.2, 0.4], [-9, 1.0, 0.28], [-15, 0.9, 0.18]].forEach(([L, wd, a], n) => contour(L, lw(wd), `rgba(40,70,74,${a})`, n > 1 ? [lw(9), lw(6)] : null, 3));
    for (const L of [14, 32, 55, 82, 115]) contour(L, lw(0.9), INK_S + '0.28)', null, 1.6);
    // lagoon + river
    const MP = FM.MAP_PATHS ? FM.MAP_PATHS() : null;
    if (MP?.lake) { const [a, b] = P(MP.lake.x, MP.lake.z); g.fillStyle = 'rgba(70,128,138,0.55)'; g.strokeStyle = INK; g.lineWidth = lw(1.8); g.beginPath(); g.ellipse(a, b, MP.lake.r * k, MP.lake.r * k * 0.96, 0.3, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(235,245,240,0.6)'; g.lineWidth = lw(1); for (let i = 0; i < 4; i++) { const yy = b - MP.lake.r * k * 0.4 + i * MP.lake.r * k * 0.27; g.beginPath(); g.moveTo(a - MP.lake.r * k * 0.35, yy); g.quadraticCurveTo(a, yy - 4, a + MP.lake.r * k * 0.35, yy); g.stroke(); } }
    const poly = (pts, width, color, dash) => { if (!pts || pts.length < 2) return; g.setLineDash(dash || []); g.lineWidth = width; g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
      pts.forEach((p, i) => { const [a, b] = P(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.setLineDash([]); };
    if (MP?.river) { poly(MP.river, lw(5), 'rgba(70,128,138,0.6)'); poly(MP.river, lw(1.2), INK_S + '0.7)'); }
    // coastline: a heavy ink line + a thin second pass (hand inked)
    contour(0.3, lw(3.2), INK, null, 2.4); contour(0.3, lw(1), INK_S + '0.5)', null, 5);
    // forests (the real tree spots, one glyph per 15 m cell) + palms
    const sp = spots; const cell = new Set(), glyphs = [];
    for (const [list, kind, C] of [[sp?.trees, 0, 15], [sp?.palms, 1, 20]]) for (const t of list || []) { const key = kind + ':' + Math.floor(t[0] / C) + ':' + Math.floor(t[2] / C); if (cell.has(key)) continue; cell.add(key); glyphs.push([t[0], t[2], kind]); }
    glyphs.sort((a, b) => a[1] - b[1]);
    const tr = Math.max(2.2, 4.2 * k);
    for (const [x, z, kind] of glyphs) { const [a, b] = P(x, z);
      if (kind === 0) { g.fillStyle = 'rgba(92,110,52,0.75)'; g.strokeStyle = INK_S + '0.8)'; g.lineWidth = lw(0.9); g.beginPath(); g.arc(a, b - tr * 0.4, tr, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(a, b + tr * 0.55); g.lineTo(a, b + tr * 1.15); g.stroke(); }
      else { g.strokeStyle = INK_S + '0.75)'; g.lineWidth = lw(1); g.beginPath(); g.moveTo(a, b + tr); g.quadraticCurveTo(a + tr * 0.2, b, a, b - tr * 0.6); for (const s of [-1, 1]) { g.moveTo(a, b - tr * 0.6); g.quadraticCurveTo(a + s * tr * 0.6, b - tr * 1.1, a + s * tr, b - tr * 0.3); } g.stroke(); } }
    // peaks: local highs above 45 m on a 30 m grid, drawn as inked mountains
    { const pk = []; for (let z = z0; z < z1; z += 30) for (let x = x0; x < x1; x += 30) { const hh = FM.H(x, z); if (hh < 45) continue; let top = true;
        for (const [dx, dz] of [[30, 0], [-30, 0], [0, 30], [0, -30], [21, 21], [-21, -21], [21, -21], [-21, 21]]) if (FM.H(x + dx, z + dz) > hh) { top = false; break; } if (top || hh > 80) pk.push([x, z, hh]); }
      pk.sort((a, b) => a[1] - b[1]);
      for (const [x, z, hh] of pk) { const [a, b] = P(x, z), s = Math.max(7, (10 + hh * 0.12) * k * 1.4);
        g.fillStyle = 'rgba(214,186,128,0.95)'; g.strokeStyle = INK; g.lineWidth = lw(1.4); g.beginPath(); g.moveTo(a - s, b + s * 0.45); g.lineTo(a - s * 0.1, b - s * 0.75); g.lineTo(a + s, b + s * 0.45); g.fill(); g.stroke();
        g.lineWidth = lw(0.8); g.beginPath(); for (let i = 1; i <= 3; i++) { const f = i / 4; g.moveTo(a - s * 0.1 + f * s * 0.55, b - s * 0.75 + f * s * 1.2); g.lineTo(a - s * 0.1 + f * s * 0.55 - s * 0.18, b - s * 0.75 + f * s * 1.2); } g.stroke(); } }
    // town: roofs, street, piers + boardwalk
    if (MP?.street) { poly(MP.street, lw(5), INK_S + '0.55)'); poly(MP.street, lw(3), 'rgba(236,220,180,0.9)'); }
    for (const o of FM.MAP_BOXES ? FM.MAP_BOXES() : []) { if (o.hx * o.hz < 3) continue; const [a, b] = P(o.x, o.z); g.save(); g.translate(a, b); g.rotate(-Math.atan2(o.s, o.c));
      g.fillStyle = 'rgba(150,72,40,0.85)'; g.strokeStyle = INK; g.lineWidth = lw(0.8); const W2 = Math.max(1.2, o.hx * k), H2 = Math.max(1.2, o.hz * k); g.fillRect(-W2, -H2, 2 * W2, 2 * H2); g.strokeRect(-W2, -H2, 2 * W2, 2 * H2); g.restore(); }
    for (const dk of decks) { const [fx, fz] = toF(dk.x, dk.z), [a, b] = P(fx, fz); g.save(); g.translate(a, b); g.rotate(-(dk.yaw || 0));
      g.fillStyle = '#b07a46'; g.strokeStyle = INK; g.lineWidth = lw(1.1); g.fillRect(-dk.hw * k, -dk.hl * k, 2 * dk.hw * k, 2 * dk.hl * k); g.strokeRect(-dk.hw * k, -dk.hl * k, 2 * dk.hw * k, 2 * dk.hl * k); g.restore(); }
    // trails + bridge
    // [minimap-themes] the red / yellow loop is a paved road now (cobbles + kerbs): inked double line, the trail colour between
    if (MP) { for (const [pts, col] of [[MP.A, 'rgba(160,32,18,0.85)'], [MP.B, 'rgba(176,120,18,0.9)']]) { poly(pts, lw(5.2), INK_S + '0.8)'); poly(pts, lw(3.4), 'rgba(226,206,160,0.95)'); poly(pts, lw(1.4), col, [lw(7), lw(4)]); }
      for (const r of MP.ramps || []) poly(r, lw(3), INK_S + '0.6)');
      for (const a of MP.areas || []) { poly(a.pts, lw(a.pave ? 4.4 : 2.6), INK_S + (a.pave ? '0.8)' : '0.6)')); if (a.pave) poly(a.pts, lw(2.6), 'rgba(226,206,160,0.95)'); else poly(a.pts, lw(1.2), 'rgba(236,220,180,0.9)', [lw(4), lw(3)]); } }
    const BR = FM.BRIDGE; if (BR && BR.L) { poly([[BR.ax, BR.az], [BR.bx, BR.bz]], lw(4), INK); poly([[BR.ax, BR.az], [BR.bx, BR.bz]], lw(1.6), '#c48a50'); }
    // labels
    const label = (txt, x, z, size, color = INK, align = 'center', rot = 0) => { const [a, b] = P(x, z); g.save(); g.translate(a, b); g.rotate(rot); g.font = `${Math.round(lw(size))}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle';
      g.lineWidth = lw(size) * 0.16; g.strokeStyle = 'rgba(240,224,182,0.85)'; g.strokeText(txt, 0, 0); g.fillStyle = color; g.fillText(txt, 0, 0); g.restore(); };
    for (const p of FM.FOOT_POIS || []) { const t = LABELS[p.id]; if (!t) continue;
      if (p.id === 'skullpeak') { const [a, b] = P(p.x, p.z); g.font = `${Math.round(lw(42))}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText('☠', a, b); label(t, p.x, p.z + 30 / k * lw(1), 42); continue; }
      if (/lighthouse|_lh$/.test(p.id)) { const [a, b] = P(p.x, p.z); g.fillStyle = '#f3e3b5'; g.strokeStyle = INK; g.lineWidth = lw(1.3); g.beginPath(); g.moveTo(a - lw(4), b + lw(6)); g.lineTo(a - lw(2.4), b - lw(7)); g.lineTo(a + lw(2.4), b - lw(7)); g.lineTo(a + lw(4), b + lw(6)); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,190,60,.9)'; g.beginPath(); g.arc(a, b - lw(9), lw(2.6), 0, 7); g.fill(); label(t, p.x + 14 / k * lw(1), p.z, 34, INK, 'left'); continue; }
      label(t, p.x, p.z, 38); }
    // [minimap-themes] landmarks: ink-and-parchment badges + hand labels (same list as the island map)
    { const L = [...mapLandmarks(FM), ...(layout ? mapDocks(layout).slice(0, 1).map(d => ({ ...d, label: 'Docks' })) : [])];
      const sq = (FM.INTERACT || []).find(q => q.id === 'squadhall'); if (sq) L.push({ id: 'squadhall', icon: 'squadhall', label: 'Big Shop', x: sq.x, z: sq.z });
      const nice = (t) => t.toLowerCase().replace(/(^|[\s·'])([a-z])/g, (m, a, b) => a + b.toUpperCase());
      for (const l of L) { const ic = SHOP_ICONS[l.icon]; if (!ic) continue; const [a, b] = P(l.x, l.z), r = lw(15);
        drawShopIcon(g, ic, a, b, r, 'paper'); label(nice(l.label), l.x + (r * 1.25) / k, l.z, 30, INK, 'left'); } }
    { const near = decks.map(d => toF(d.x, d.z)); if (near.length) { const cx = near.reduce((s, p) => s + p[0], 0) / near.length, cz = near.reduce((s, p) => s + p[1], 0) / near.length;
        label('Harbor Town', cx + 85, cz - 60, 50, '#5a1a0c'); label('THE HARBOR', cx - 95, cz + 150, 44, 'rgba(30,62,66,.9)', 'center', -Math.PI / 2); } }
    // compass rose (top-left corner of the sea) + title cartouche + scale bar
    { const R = Math.min(w, h) * 0.08, cx = R * 1.7, cy = h - R * 2.0; g.save(); g.translate(cx, cy);
      g.strokeStyle = INK; g.lineWidth = lw(1); g.beginPath(); g.arc(0, 0, R * 1.08, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, R * 0.98, 0, 7); g.stroke();
      for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(i * Math.PI / 8) * R * 1.08, -Math.cos(i * Math.PI / 8) * R * 1.08); g.strokeStyle = INK_S + '0.35)'; g.stroke(); }
      const star = (n, r0, r1, rot, fa, fb) => { for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n, a1 = a - Math.PI / n, a2 = a + Math.PI / n;
        for (const [side, col] of [[a1, fa], [a2, fb]]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(side) * r1, -Math.cos(side) * r1); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = INK; g.lineWidth = lw(0.8); g.stroke(); } } };
      star(4, R * 0.62, R * 0.16, Math.PI / 4, '#d9bf86', INK); star(4, R * 0.95, R * 0.2, 0, '#f0dfb0', '#8e2a14');
      g.fillStyle = '#8e2a14'; g.beginPath(); g.arc(0, 0, R * 0.07, 0, 7); g.fill();
      g.font = `${Math.round(R * 0.55)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#8e2a14'; g.fillText('N', 0, -R * 1.34);
      g.fillStyle = INK; g.font = `${Math.round(R * 0.36)}px ${FONT}`; g.fillText('S', 0, R * 1.3); g.fillText('E', R * 1.3, 0); g.fillText('W', -R * 1.3, 0); g.restore(); }
    { const tw = Math.min(w * 0.7, lw(760)), th = lw(112), tx = w / 2, ty = lw(54) + th / 2; g.save(); g.translate(tx, ty);
      g.fillStyle = 'rgba(236,216,168,0.96)'; g.strokeStyle = INK; g.lineWidth = lw(2); g.beginPath(); g.moveTo(-tw / 2, -th / 2); g.lineTo(tw / 2, -th / 2); g.lineTo(tw / 2 + th * 0.35, 0); g.lineTo(tw / 2, th / 2); g.lineTo(-tw / 2, th / 2); g.lineTo(-tw / 2 - th * 0.35, 0); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = lw(0.8); g.strokeRect(-tw / 2 + lw(6), -th / 2 + lw(6), tw - lw(12), th - lw(12));
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#8e2a14'; g.font = `${Math.round(th * 0.62)}px ${FONT}`; g.fillText('PUMPFUN PIRATES', 0, -th * 0.08);
      g.fillStyle = INK; g.font = `${Math.round(th * 0.3)}px ${FONT}`; g.fillText('~ chart of the isle & harbor · X marks the spot ~', 0, th * 0.32); g.restore(); }
    { const L = 100 * k, bx = w - L - lw(60), by = h - lw(56); g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = lw(1.2);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f0dfb0' : INK; g.fillRect(bx + i * L / 4, by, L / 4, lw(6)); } g.strokeRect(bx, by, L, lw(6));
      g.fillStyle = INK; g.font = `${Math.round(lw(30))}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('100 m', bx + L / 2, by - lw(3)); }
    // age: speckle, stains, folds, burnt torn edge
    { const n = Math.round(w * h / 900); for (let i = 0; i < n; i++) { const x = hash2(i, 1.3) * w, y = hash2(i, 7.9) * h; g.fillStyle = `rgba(90,58,24,${0.05 + hash2(i, 3.1) * 0.12})`; g.fillRect(x, y, 1 + hash2(i, 5) * 1.6, 1 + hash2(i, 6) * 1.6); }
      for (let i = 0; i < 7; i++) { const x = hash2(i, 11) * w, y = hash2(i, 13) * h, r = (0.06 + hash2(i, 17) * 0.12) * Math.max(w, h), gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
        gr.addColorStop(0, 'rgba(140,92,36,0.10)'); gr.addColorStop(0.8, 'rgba(140,92,36,0.05)'); gr.addColorStop(1, 'rgba(140,92,36,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      for (const f of [1 / 3, 2 / 3]) { g.fillStyle = 'rgba(90,55,20,0.10)'; g.fillRect(w * f - 1, 0, 2, h); g.fillStyle = 'rgba(255,250,230,0.18)'; g.fillRect(w * f + 1, 0, 2, h); }
      g.fillStyle = 'rgba(90,55,20,0.10)'; g.fillRect(0, h / 2 - 1, w, 2); g.fillStyle = 'rgba(255,250,230,0.18)'; g.fillRect(0, h / 2 + 1, w, 2);
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) * 0.56); vg.addColorStop(0, 'rgba(110,66,22,0)'); vg.addColorStop(1, 'rgba(110,66,22,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
      // torn edge: keep the inside of a jagged outline, then burn it
      const edge = []; const step = lw(14), m = lw(10), jag = (i, s) => m + (hash2(i, s) * 0.8 + hash2(i * 0.37, s + 2) * 0.6) * lw(9);
      for (let x = 0; x <= w; x += step) edge.push([x, jag(x, 1)]); for (let y = 0; y <= h; y += step) edge.push([w - jag(y, 2), y]);
      for (let x = w; x >= 0; x -= step) edge.push([x, h - jag(x, 3)]); for (let y = h; y >= 0; y -= step) edge.push([jag(y, 4), y]);
      const path = () => { g.beginPath(); edge.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); };
      g.save(); g.globalCompositeOperation = 'destination-in'; path(); g.fillStyle = '#000'; g.fill(); g.restore();
      g.save(); path(); g.clip(); g.shadowColor = 'rgba(70,32,6,0.9)'; g.shadowBlur = lw(18); g.lineWidth = lw(7); g.strokeStyle = 'rgba(70,32,6,0.85)'; path(); g.stroke(); g.restore();
      g.lineWidth = lw(1.4); g.strokeStyle = 'rgba(50,22,4,0.9)'; path(); g.stroke(); }
    SH = { cv, x0, z0, k, w, h, ms: Math.round(performance.now() - t0), rev: FM.TERRAIN?.rev || 0 };
    return SH;
  }

  // ---------------- dynamic layer: dotted trail, red X, you ----------------
  // T(fx, fz) -> screen px; kk = screen px per metre; dpr for line widths
  function bez(p0, p1, p2, p3, t) { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }
  function drawX(c, a, b, s, dpr, main = true, pulse = 0) {
    c.save(); c.lineCap = 'round';
    if (main) { c.strokeStyle = 'rgba(181,21,13,0.5)'; c.lineWidth = 2 * dpr; c.setLineDash([5 * dpr, 4 * dpr]); c.beginPath(); c.arc(a, b, s * (1.7 + pulse * 0.5), 0, 7); c.stroke(); c.setLineDash([]); }
    for (const [o, w, col] of [[0, (main ? 7.5 : 4) * dpr, 'rgba(60,10,4,0.55)'], [0, (main ? 5.5 : 3) * dpr, main ? RED : 'rgba(150,40,20,0.75)'], [1.2 * dpr, 1.4 * dpr, 'rgba(255,160,140,0.5)']]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a - s + o, b - s * 0.92); c.quadraticCurveTo(a + o * 0.5, b + s * 0.05, a + s * 1.02, b + s); c.moveTo(a + s * 0.95 - o, b - s); c.quadraticCurveTo(a - o * 0.5, b - s * 0.04, a - s, b + s * 0.95); c.stroke(); }
    c.restore();
  }
  function drawLayer(c, T, kk, dpr, o) { // o: { me: {x, z, yaw} foot frame | null, target: {x, z, id} foot | null, others: [{x, z}], t }
    const now = (o.t ?? performance.now()) / 1000;
    for (const p of o.others || []) { const [a, b] = T(p.x, p.z); drawX(c, a, b, 7 * dpr, dpr, false); }
    if (o.target && o.me) { // the dotted trail (a seeded wiggle per map, the dots march toward the X)
      const A = T(o.me.x, o.me.z), Z = T(o.target.x, o.target.z), dx = Z[0] - A[0], dy = Z[1] - A[1], L = Math.hypot(dx, dy);
      if (L > 18 * dpr) { const nxp = -dy / L, nyp = dx / L, h = hash2(String(o.target.id || '').length, (o.target.x | 0) * 0.01), w1 = (h - 0.5) * 0.7 * L, w2 = (0.5 - hash2(h * 9, 3)) * 0.55 * L;
        const p1 = [A[0] + dx * 0.33 + nxp * w1, A[1] + dy * 0.33 + nyp * w1], p2 = [A[0] + dx * 0.68 + nxp * w2, A[1] + dy * 0.68 + nyp * w2];
        const pts = []; let prev = A, acc = 0; const sp = 11 * dpr, off = (now * 18 * dpr) % sp; pts.push([A, 0]);
        for (let i = 1; i <= 200; i++) { const q = bez(A, p1, p2, Z, i / 200); acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; pts.push([q, acc]); }
        c.fillStyle = 'rgba(150,18,10,0.9)'; let next = off, k = 0;
        while (next < acc - 14 * dpr) { while (k < pts.length - 1 && pts[k + 1][1] < next) k++; const [q] = pts[k]; c.beginPath(); c.arc(q[0], q[1], 2.4 * dpr, 0, 7); c.fill(); next += sp; } } }
    if (o.target) { const [a, b] = T(o.target.x, o.target.z), pulse = (Math.sin(now * 3.2) + 1) / 2; drawX(c, a, b, 13 * dpr, dpr, true, pulse);
      if (o.label) { c.font = `${Math.round(22 * dpr)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 4 * dpr; c.strokeStyle = 'rgba(240,224,182,0.95)'; c.strokeText(o.label, a, b + 20 * dpr); c.fillStyle = RED; c.fillText(o.label, a, b + 20 * dpr); } }
    if (o.me) { const [a, b] = T(o.me.x, o.me.z), s = (o.me.foot ? 11 : 13) * dpr; c.save(); c.translate(a, b);
      c.fillStyle = 'rgba(255,235,170,0.35)'; c.beginPath(); c.arc(0, 0, s * (1.6 + 0.25 * Math.sin(now * 4)), 0, 7); c.fill();
      c.rotate(Math.PI - (o.me.yaw || 0)); c.fillStyle = '#fff8e6'; c.strokeStyle = INK; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.72, s * 0.78); c.lineTo(0, s * 0.36); c.lineTo(-s * 0.72, s * 0.78); c.closePath(); c.fill(); c.stroke(); c.restore();
      c.font = `${Math.round(21 * dpr)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 4 * dpr; c.strokeStyle = 'rgba(240,224,182,0.95)'; c.strokeText('YOU', a, b - s - 4 * dpr); c.fillStyle = INK; c.fillText('YOU', a, b - s - 4 * dpr); }
  }

  // ---------------- the MAPS screen ----------------
  let el = null, cv = null, chips = null, hint = null, isOpen = false, raf = 0, getState = null, onPick = null, onClose = null;
  function build() {
    el = document.createElement('div'); el.id = 'tm-map';
    el.innerHTML = '<canvas></canvas><button class="tm-x" type="button" aria-label="Close map">✕</button><div class="tm-bar"><div class="tm-hint"></div><div class="tm-chips"></div></div>';
    document.body.appendChild(el); cv = el.querySelector('canvas'); chips = el.querySelector('.tm-chips'); hint = el.querySelector('.tm-hint');
    for (const ev of ['touchstart', 'mousedown', 'wheel', 'contextmenu']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); const chip = e.target.closest('[data-id]'); if (chip) { onPick?.(chip.dataset.id); return; }
      if (e.target.closest('.tm-chips')) return; e.preventDefault(); setTimeout(close, 0); });
    addEventListener('keydown', (e) => { if (isOpen && (e.code === 'Escape' || e.code === 'KeyM')) { e.stopImmediatePropagation(); e.preventDefault(); close(); } }, true);
  }
  function frame() {
    if (!isOpen) return; raf = requestAnimationFrame(frame);
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.floor(el.clientWidth * dpr), H = Math.floor(el.clientHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'), s = sheet(), S = getState ? getState() : {};
    c.clearRect(0, 0, W, H);
    const cs = getComputedStyle(el), sv = (n) => (parseFloat(cs.getPropertyValue(n)) || 0) * dpr;
    const top = sv('--safe-t') + 8 * dpr, bottom = (el.querySelector('.tm-bar').offsetHeight + 6) * dpr, side = Math.max(sv('--safe-l'), sv('--safe-r')) + 8 * dpr;
    const aw = W - 2 * side, ah = H - top - bottom, sc = Math.min(aw / s.w, ah / s.h), dw = s.w * sc, dh = s.h * sc, ox = (W - dw) / 2, oy = top + (ah - dh) / 2;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 24 * dpr; c.shadowOffsetY = 6 * dpr; c.drawImage(s.cv, ox, oy, dw, dh); c.restore();
    const kk = s.k * sc, T = (fx, fz) => [ox + (fx - s.x0) * kk, oy + (fz - s.z0) * kk];
    c.save(); c.beginPath(); c.rect(ox, oy, dw, dh); c.clip(); drawLayer(c, T, kk, dpr, S); c.restore();
  }
  function open(fn, pick, closed) { if (!el) build(); getState = fn || getState; onPick = pick || onPick; onClose = closed || onClose; isOpen = true; el.classList.add('on'); document.documentElement.classList.add('tm-map-open'); cancelAnimationFrame(raf); frame(); }
  function close() { if (!isOpen) return; isOpen = false; cancelAnimationFrame(raf); el.classList.remove('on'); document.documentElement.classList.remove('tm-map-open'); onClose?.(); }
  function setUi(chipHtml, hintHtml) { if (!el) build(); chips.innerHTML = chipHtml; chips.style.display = chipHtml ? 'flex' : 'none'; hint.innerHTML = hintHtml; }

  // ---------------- the drop reveal ----------------
  let rv = null, rvT = 0, fxRaf = 0;
  function reveal({ title = 'TREASURE MAP!', tier = 'COMMON MAP', color = '#e8cf95', sub = '', target = null, others = [], onView = null, ms = 5600 } = {}) {
    if (!rv) { rv = document.createElement('div'); rv.id = 'tm-reveal'; document.body.appendChild(rv); }
    clearTimeout(rvT); cancelAnimationFrame(fxRaf);
    rv.className = ''; void rv.offsetWidth;
    rv.innerHTML = `<div class="tm-rays"></div><canvas class="tm-fx"></canvas><div class="tm-head">${title}</div><div class="tm-scroll"><div class="tm-roll a"></div><div class="tm-sheet"><canvas></canvas></div><div class="tm-roll b"></div></div>` +
      `<div class="tm-sub"><span style="color:${color}">${tier}</span><small>${sub}</small></div><button class="tm-view" type="button">VIEW MAP</button>`;
    rv.classList.add('on');
    const go = (e) => { e.preventDefault(); e.stopPropagation(); dismiss(true); onView?.(); };
    for (const q of rv.querySelectorAll('.tm-scroll,.tm-view')) { q.addEventListener('pointerdown', go); for (const ev of ['touchstart', 'mousedown']) q.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); }
    // the scroll shows the chart around the X
    requestAnimationFrame(() => { const pc = rv.querySelector('.tm-sheet canvas'); if (!pc) return; const dpr = Math.min(2, devicePixelRatio || 1), r = pc.getBoundingClientRect();
      pc.width = Math.max(2, Math.round(r.width * dpr)); pc.height = Math.max(2, Math.round(r.height * dpr)); const c = pc.getContext('2d'), s = sheet();
      const cx = target ? target.x : s.x0 + s.w / s.k / 2, cz = target ? target.z : s.z0 + s.h / s.k / 2, spanM = 640, kk = pc.width / spanM;
      const T = (fx, fz) => [pc.width / 2 + (fx - cx) * kk, pc.height / 2 + (fz - cz) * kk];
      c.fillStyle = '#e9d4a2'; c.fillRect(0, 0, pc.width, pc.height); const [sx, sy] = T(s.x0, s.z0); c.drawImage(s.cv, sx, sy, s.w / s.k * kk, s.h / s.k * kk);
      drawLayer(c, T, kk, dpr, { target, others, t: 0 });
      const vg = c.createRadialGradient(pc.width / 2, pc.height / 2, pc.height * 0.3, pc.width / 2, pc.height / 2, pc.width * 0.65); vg.addColorStop(0, 'rgba(110,66,22,0)'); vg.addColorStop(1, 'rgba(110,66,22,0.5)'); c.fillStyle = vg; c.fillRect(0, 0, pc.width, pc.height); });
    sparkle(rv.querySelector('canvas.tm-fx'));
    try { sfx?.treasureMap?.(); } catch { /* audio off */ }
    rvT = setTimeout(() => dismiss(), ms);
  }
  function dismiss(now = false) { if (!rv || !rv.classList.contains('on')) return; clearTimeout(rvT);
    const fin = () => { rv.classList.remove('on', 'out'); rv.innerHTML = ''; cancelAnimationFrame(fxRaf); };
    if (now) fin(); else { rv.classList.add('out'); rvT = setTimeout(fin, 460); } }
  function sparkle(fc) {
    const dpr = Math.min(2, devicePixelRatio || 1), W = fc.width = Math.round(innerWidth * dpr), H = fc.height = Math.round(innerHeight * dpr), c = fc.getContext('2d');
    const sc = rv.querySelector('.tm-scroll').getBoundingClientRect(), cx = (sc.left + sc.width / 2) * dpr, cy = (sc.top + sc.height / 2) * dpr, ps = [], N = low ? 70 : 130, t0 = performance.now();
    const COL = ['#fff3b0', '#ffd76a', '#ffcd3c', '#ffffff', '#ffb347'];
    const spawn = (burst) => { const a = Math.random() * Math.PI * 2, v = (burst ? 260 + Math.random() * 520 : 30 + Math.random() * 60) * dpr;
      ps.push({ x: cx + (burst ? 0 : (Math.random() - 0.5) * sc.width * dpr * 1.1), y: cy + (burst ? 0 : (Math.random() - 0.5) * sc.height * dpr * 1.3), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (burst ? 120 * dpr : 20 * dpr), life: 0, max: burst ? 1.1 + Math.random() * 0.9 : 0.8 + Math.random() * 0.8, s: (burst ? 2 + Math.random() * 3.5 : 1.5 + Math.random() * 3) * dpr, col: COL[(Math.random() * COL.length) | 0], star: !burst || Math.random() < 0.35 }); };
    let last = t0, burstDone = false;
    const step = (now) => { const dt = Math.min(0.05, (now - last) / 1000), el2 = (now - t0) / 1000; last = now; c.clearRect(0, 0, W, H);
      if (!burstDone && el2 > 0.45) { burstDone = true; for (let i = 0; i < N; i++) spawn(true); }
      if (el2 < 4.2 && Math.random() < (low ? 0.35 : 0.7)) spawn(false);
      for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.life += dt; if (p.life > p.max) { ps.splice(i, 1); continue; }
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 260 * dpr * dt * 0.6; p.x += p.vx * dt; p.y += p.vy * dt; const f = 1 - p.life / p.max, tw = 0.6 + 0.4 * Math.sin(p.life * 22 + i);
        c.globalAlpha = Math.max(0, f * tw); c.fillStyle = p.col;
        if (p.star) { const s = p.s * 2.2; c.beginPath(); c.moveTo(p.x, p.y - s); c.lineTo(p.x + s * 0.22, p.y - s * 0.22); c.lineTo(p.x + s, p.y); c.lineTo(p.x + s * 0.22, p.y + s * 0.22); c.lineTo(p.x, p.y + s); c.lineTo(p.x - s * 0.22, p.y + s * 0.22); c.lineTo(p.x - s, p.y); c.lineTo(p.x - s * 0.22, p.y - s * 0.22); c.closePath(); c.fill(); }
        else { c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); } }
      c.globalAlpha = 1; if (el2 < 6 && rv.classList.contains('on')) fxRaf = requestAnimationFrame(step); else c.clearRect(0, 0, W, H); };
    fxRaf = requestAnimationFrame(step);
  }
  return { sheet, open, close, setUi, reveal, dismiss, get isOpen() { return isOpen; }, get revealing() { return !!rv && rv.classList.contains('on'); } };
}
