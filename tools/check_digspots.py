# [island-rework] IN-GAME dig-spot check (the static half is tests/digspots.test.mjs). Boots the harbor headless and, for every spot in
# js/island/digSpots.js, checks on the REAL terrain + colliders:
#   1 walkable   ground above the sea, slope <= WALK limit over a 2 m cross, not blocked (sea / lake / river / prop) at the spot
#   2 clear      no prop collider within 3 m (the DIG prompt radius) and outside every other owner's zone (EXCLUDE + pad)
#   3 reachable  a flood fill from the harbor spawn with the game's own walk rule (world.blocked, steps + slope + decks) reaches it
#   4 X == spot  the client's dig spot (foot.js DIGS / INTERACT -> world.footInteract -> treasure.spotAt) equals the registry coords, and
#                every id the server accepts (supabase/functions/pvp/digSpots.ts MAP_SPOTS_ALL) has its X on this island
# ACTIVE spots must pass all four; OFF spots are reported (walkable + clear must pass unless they are islets waiting on swim / row, or
# carry a build note). Exit 1 on failure. Writes a JSON report + the parchment chart with every spot drawn on it.
#   PFP_B=http://127.0.0.1:8994 python3 tools/check_digspots.py [out_dir]
import asyncio, json, os, sys, base64
from playwright.async_api import async_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
B = os.environ.get('PFP_B', 'http://127.0.0.1:8994'); OUT = sys.argv[1] if len(sys.argv) > 1 else 'dev/digcheck'
JS = r"""(async () => {
  const D = PFP.dock, L = D.layout, FM = L.FM, W = D.world, f = W.foot, T = D.treasure, R = await import('./js/island/digSpots.js');
  const tsSrc = await (await fetch('./supabase/functions/pvp/digSpots.ts', { cache: 'no-store' })).text();
  const arr = n => JSON.parse(tsSrc.match(new RegExp('export const ' + n + ': string\\[\\] = (\\[.*?\\]);'))[1]);
  const SERVER = { roll: arr('MAP_SPOTS'), valid: arr('MAP_SPOTS_ALL') };
  const toF = L.harborToFoot, toH = L.footToHarbor, H = FM.H;
  // 3: reachability flood fill in the harbor frame, 1 m cells (stepping stones), the game's walk rule
  const S = 1, fx0 = -820, fx1 = 640, fz0 = -800, fz1 = 780, nx = Math.round((fx1 - fx0) / S) + 1, nz = Math.round((fz1 - fz0) / S) + 1;
  const seen = new Uint8Array(nx * nz), q = new Int32Array(nx * nz); let qh = 0, qt = 0;
  const cellH = (i, j) => toH(fx0 + i * S, fz0 + j * S);
  const sp = L.spawn, [sfx, sfz] = toF(sp.x, sp.z), si = Math.round((sfx - fx0) / S), sj = Math.round((sfz - fz0) / S);
  seen[sj * nx + si] = 1; q[qt++] = sj * nx + si; const t0 = performance.now();
  while (qh < qt) { const c = q[qh++], i = c % nx, j = (c / nx) | 0, [px, pz] = cellH(i, j);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const k = b * nx + a; if (seen[k]) continue;
      const [x, z] = cellH(a, b); if (W.blocked(x, z, px, pz)) continue; seen[k] = 1; q[qt++] = k; } }
  const reachMs = Math.round(performance.now() - t0), reachCells = qt;
  const reached = (x, z, r) => { for (let j = Math.floor((z - r - fz0) / S); j <= Math.ceil((z + r - fz0) / S); j++) for (let i = Math.floor((x - r - fx0) / S); i <= Math.ceil((x + r - fx0) / S); i++)
    if (i >= 0 && j >= 0 && i < nx && j < nz && seen[j * nx + i] && Math.hypot(fx0 + i * S - x, fz0 + j * S - z) <= r) return true; return false; };
  const dRect = (x, z, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[1]), Math.max(r[2] - z, 0, z - r[3]));
  const out = [];
  for (const s of R.DIG_SPOTS) { const r = s.r || 3, h = H(s.x, s.z), why = f.whyBlocked(s.x, s.z);
    const slope = Math.max(...[[1, 0], [0, 1], [0.7071, 0.7071], [0.7071, -0.7071]].map(([a, b]) => Math.abs(H(s.x + a * 2, s.z + b * 2) - H(s.x - a * 2, s.z - b * 2)) / 4));
    let props = 0; for (let k = 0; k < 24; k++) for (const rr of [1, 2, 3]) { const a = k / 24 * 6.2832; if (f.whyBlocked(s.x + Math.cos(a) * rr, s.z + Math.sin(a) * rr) === 'prop') props++; }
    const zones = R.EXCLUDE.filter(e => e.id !== s.inside && !(s.id === 'cave' && e.id === 'cave_mouth')).map(e => [e.id, e.rect ? dRect(s.x, s.z, e.rect) : Math.hypot(s.x - e.circle[0], s.z - e.circle[1]) - e.circle[2]]).filter(([, d]) => d < R.EXCLUDE_PAD).map(([id]) => id);
    const reach = reached(s.x, s.z, r);
    const fd = FM.DIGS.find(d => d.id === s.id), fi = FM.INTERACT.find(d => d.id === s.id), wa = W.footInteract.find(d => d.id === s.id), ta = T.spotAt ? T.spotAt(s.id) : null;
    const err = (p) => p ? Math.hypot(p[0] - s.x, p[1] - s.z) : null;
    const xErr = { digs: fd ? err([fd.x, fd.z]) : null, interact: fi ? err([fi.x, fi.z]) : null, harbor: wa ? err(toF(wa.x, wa.z)) : null, treasure: ta ? err(toF(ta.x, ta.z)) : null };
    const R0 = { id: s.id, area: s.area, active: !!s.active, x: s.x, z: s.z, lx: s.z + 90, lz: -640 - s.x, h: +h.toFixed(2), slope: +slope.toFixed(3), why: why || 'ok', propsNear: props, zones, reach, xErr,
      server: { valid: SERVER.valid.includes(s.id), roll: SERVER.roll.includes(s.id) } };
    const fails = [];
    const walk = h >= 0.4 && slope <= 0.6 && (!why || (s.id === 'cave' && why === 'prop'));   // the cave mouth sits in the cave mesh's doorway
    if (!walk) fails.push('not walkable (' + (why || 'slope ' + slope.toFixed(2)) + ')');
    if (props && s.id !== 'cave') fails.push(props + ' prop hits within 3 m'); if (zones.length) fails.push('in zone ' + zones.join(','));
    if (s.active) { if (!reach) fails.push('unreachable from spawn');
      for (const [k, v] of Object.entries(xErr)) { if (s.id === 'cave' && k === 'digs') continue; if (v === null) fails.push('no client X in ' + k); else if (v > 0.05) fails.push('client X off by ' + v.toFixed(2) + ' m in ' + k); }
      if (!R0.server.valid) fails.push('server does not accept it'); if (s.roll !== R0.server.roll) fails.push('server roll mismatch'); }
    else { if (fi || wa) fails.push('OFF spot is interactable'); if (R0.server.valid || R0.server.roll) fails.push('OFF spot accepted by server');
      if (!reach) R0.note = s.needs ? 'unreachable on foot (needs ' + s.needs + '): stays OFF until it ships' : 'unreachable on foot today'; }
    const soft = !s.active && (s.needs || s.note); R0.fails = fails; R0.pass = !fails.length; R0.gate = soft ? 'warn' : 'hard'; out.push(R0); }
  // [island-rework] every area activity point (fishing dock end, NPCs, chests, shards ...) must be reachable on foot too
  const TH = R.JUNGLE_TRAILHEAD, thTrail = Math.min(...FM.TRAILS.A.map(([x, z]) => Math.hypot(x - TH.x, z - TH.z)));
  const trailhead = { x: TH.x, z: TH.z, y: TH.y, h: +H(TH.x, TH.z).toFixed(2), why: f.whyBlocked(TH.x, TH.z) || 'ok', reach: reached(TH.x, TH.z, 1.5), onTrailA: +thTrail.toFixed(2) };
  trailhead.pass = trailhead.why === 'ok' && trailhead.reach && thTrail < 1.5 && Math.abs(trailhead.h - TH.y) < 0.3;
  const areaPts = FM.INTERACT.filter(q => q.area).map(q => ({ id: q.id, area: q.area, x: +q.x.toFixed(1), z: +q.z.toFixed(1), reach: reached(q.x, q.z, (q.r || 3) * 0.9) }));
  const extra = SERVER.valid.filter(id => !T.spotIds().includes(id));
  // the chart with every spot on it
  const m = await import('./js/dock/treasureMap.js'); const tm = m.createTreasureMap({ FM, toF, decks: L.decks, spots: f.spots, low: false }); const sh = tm.sheet();
  const cv = document.createElement('canvas'); cv.width = sh.w; cv.height = sh.h; const g = cv.getContext('2d'); g.drawImage(sh.cv, 0, 0);
  const P = (x, z) => [(x - sh.x0) * sh.k, (z - sh.z0) * sh.k];
  g.fillStyle = 'rgba(40,160,70,0.10)'; for (let j = 0; j < nz; j += 6) for (let i = 0; i < nx; i += 6) if (seen[j * nx + i]) { const [a, b] = P(fx0 + i * S, fz0 + j * S); g.fillRect(a - 3, b - 3, 6, 6); }
  for (const e of R.EXCLUDE) { g.fillStyle = 'rgba(200,20,20,0.22)'; g.strokeStyle = 'rgba(150,0,0,0.9)'; g.lineWidth = 3;
    if (e.rect) { const [a, b] = P(e.rect[0], e.rect[2]), [c, d] = P(e.rect[1], e.rect[3]); g.fillRect(a, b, c - a, d - b); g.strokeRect(a, b, c - a, d - b); }
    else { const [a, b] = P(e.circle[0], e.circle[1]); g.beginPath(); g.arc(a, b, e.circle[2] * sh.k, 0, 7); g.fill(); g.stroke(); } }
  for (const s of out) { const [a, b] = P(s.x, s.z), col = !s.pass ? (s.gate === 'warn' ? '#e08a00' : '#e00000') : s.active ? '#0a8a2a' : '#1a50c8', k = 12;
    g.lineWidth = 6; g.strokeStyle = '#f5e8c8'; g.beginPath(); g.moveTo(a - k, b - k); g.lineTo(a + k, b + k); g.moveTo(a - k, b + k); g.lineTo(a + k, b - k); g.stroke();
    g.lineWidth = 4; g.strokeStyle = col; g.stroke(); g.font = 'bold 20px system-ui,sans-serif'; g.lineWidth = 4; g.strokeStyle = '#f5e8c8'; g.strokeText(s.id, a + 14, b - 10); g.fillStyle = col; g.fillText(s.id, a + 14, b - 10); }
  g.fillStyle = 'rgba(245,232,200,0.94)'; g.fillRect(12, 12, 560, 150); g.strokeStyle = '#3c2814'; g.lineWidth = 2; g.strokeRect(12, 12, 560, 150); g.font = 'bold 20px system-ui,sans-serif'; g.fillStyle = '#3c1e0a';
  g.fillText('DIG-SPOT CHECK (tools/check_digspots.py)', 24, 40); g.font = '16px system-ui,sans-serif';
  [['#0a8a2a', 'ACTIVE spot: walkable, clear, reachable, client X == server'], ['#1a50c8', 'OFF spot (registered, not rolled): walkable + clear'], ['#e08a00', 'OFF, waiting on swim/row or a build step'], ['#e00000', 'FAIL'], ['rgba(40,160,70,0.5)', 'green tint = reachable on foot from the harbor spawn']].forEach(([c, t], i) => { g.fillStyle = c; g.fillRect(24, 54 + i * 21, 16, 14); g.fillStyle = '#2a1a0a'; g.fillText(t, 48, 66 + i * 21); });
  return { trailhead, areaPts, decks: (FM.AREA_DECKS || []).length, loaded: f.areas ? f.areas.loaded : [], spots: out, server: SERVER, serverIdsWithoutX: extra, clientIds: T.spotIds(), reachCells, reachMs, spawnFoot: [sfx, sfz], png: cv.toDataURL('image/png') };
})()"""
async def main():
  os.makedirs(OUT, exist_ok=True)
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.route('**/*supabase.co/**', lambda r: r.abort())
    await ctx.add_init_script("try{localStorage.setItem('pfp_gfx_hint','1');localStorage.setItem('pfp_tut_seen','1')}catch(e){}")
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    await pg.goto(B + '/index.html?coast=1&quality=low'); await pg.wait_for_function('window.PFP && PFP.renderer', timeout=180000)
    await pg.evaluate("document.getElementById('btn-pvp').click()"); await pg.wait_for_function("PFP.dock && PFP.dock.on && PFP.dock.treasure", timeout=240000)
    r = await pg.evaluate(JS); png = r.pop('png'); open(f'{OUT}/digcheck_chart.png', 'wb').write(base64.b64decode(png.split(',')[1]))
    r['pageErrors'] = errs; json.dump(r, open(f'{OUT}/digcheck.json', 'w'), indent=1); await b.close()
  hard = [s for s in r['spots'] if not s['pass'] and s['gate'] == 'hard']; warn = [s for s in r['spots'] if not s['pass'] and s['gate'] == 'warn']
  for s in r['spots']:
    st = 'PASS' if s['pass'] else ('WARN' if s['gate'] == 'warn' else 'FAIL'); xe = max([v for v in s['xErr'].values() if v is not None] or [0])
    print(f"{st:4} {s['id']:6} {'ON ' if s['active'] else 'OFF'} {s['area']:16} foot ({s['x']:5},{s['z']:5}) lx {s['lx']:5} lz {s['lz']:6} h {s['h']:6} slope {s['slope']:.2f} reach {'Y' if s['reach'] else 'n'} Xerr {xe:.3f} {'; '.join(s['fails'])}{' ['+s['note']+']' if s.get('note') else ''}")
  print(f"server MAP_SPOTS {r['server']['roll']} MAP_SPOTS_ALL {r['server']['valid']}; ids without an X: {r['serverIdsWithoutX']}; reach {r['reachCells']} cells in {r['reachMs']} ms; page errors {len(r['pageErrors'])}")
  for q in r['areaPts']: print(f"{'PASS' if q['reach'] else 'FAIL'} area {q['area']:14} {q['id']:22} foot ({q['x']},{q['z']}) reachable {'Y' if q['reach'] else 'n'}")
  th = r['trailhead']; print(f"{'PASS' if th['pass'] else 'FAIL'} jungle_trailhead foot ({th['x']},{th['z']}) y {th['y']} terrain {th['h']} {th['why']} reachable {'Y' if th['reach'] else 'n'} off trail A {th['onTrailA']} m")
  if not th['pass']: hard.append('th')
  print(f"area decks {r['decks']}, areas built during the check {r['loaded']}")
  if r['serverIdsWithoutX'] or r['pageErrors'] or any(not q['reach'] for q in r['areaPts']): hard.append('x')
  for e in r['pageErrors'][:5]: print('PAGE ERROR', e)
  print('RESULT', 'FAIL' if hard else 'PASS', f"({len(warn)} warnings)"); sys.exit(1 if hard else 0)
asyncio.run(main())
