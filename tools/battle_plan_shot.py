# PUMPFUN PIRATES battle areas PLAN: top-down shot of the harbor town + proposed MUSKET RANGE / SWORD ARENA, labelled.
# Renders island.html (coast=1, plaza v2 from the timothy/plaza worktree, read-only) from 600 m up, projects town-local points in-page,
# then draws the overlay with PIL. usage: python3 tools/battle_plan_shot.py [site] [query]
import asyncio, json, sys; from playwright.async_api import async_playwright; from PIL import Image, ImageDraw, ImageFont
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
SITE = sys.argv[1] if len(sys.argv) > 1 else 'timothy-plaza'; Q = sys.argv[2] if len(sys.argv) > 2 else 'plaza=2'
OUT = '/workspace/timothy-battle/screens'; W, H = 1600, 1200; C = (-20, -60); ALT = 600
ZONES = json.load(open('/workspace/timothy-battle/tools/battle_zones.json'))
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); pg = await (await b.new_context(viewport={'width': W, 'height': H})).new_page()
    await pg.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}')); await pg.route('**/api.dexscreener.com/**', lambda r: r.fulfill(status=503, body='{}'))
    await pg.goto(f'http://127.0.0.1:18960/{SITE}/island.html?coast=1&shot&quality=high&{Q}'); await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=300000); await pg.wait_for_timeout(3000)
    js = """(async (a)=>{ const CO = await import('./js/island/coast.js'); const I = ISLAND, cam = I.camera; let PV = null; try { PV = await import('./js/island/plazaTown.js'); } catch {}
      const [cx, cz] = CO.t2w(a.C[0], a.C[1]); I.scene.fog = null; cam.far = 5000; cam.fov = 45; const put = () => { cam.position.set(cx - 0.5, a.ALT, cz); if (I.controls) { I.controls.target.set(cx, 0, cz); I.controls.update(); } cam.lookAt(cx, 0, cz); };
      put(); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); await new Promise(r => setTimeout(r, 6000)); put(); await new Promise(r => setTimeout(r, 800)); cam.updateMatrixWorld(); window.__camchk = [cam.position.x, cam.position.y, cam.position.z];
      const V = cam.position.constructor, pr = (lx, lz) => { const [x, z] = CO.t2w(lx, lz), v = new V(x, 0, z).project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      const o = { zones: a.Z.map(z => ({ ...z, poly: z.pts.map(q => pr(q[0], q[1])), at: pr(z.lab[0], z.lab[1]) })), berths: [], misc: [] };
      if (PV && PV.BERTHS) { o.berths = PV.BERTHS.map(b => ({ id: b.id, c: pr(b.lx, b.lz), poly: [[-5.2, -24], [5.2, -24], [5.2, 33.7], [-5.2, 33.7]].map(([dx, dz]) => pr(b.lx + dx, b.lz + dz)) }));
        o.approach = [[PV.APPROACH.lx0, PV.APPROACH.lz0], [PV.APPROACH.lx1, PV.APPROACH.lz0], [PV.APPROACH.lx1, PV.APPROACH.lz0 + 40], [PV.APPROACH.lx0, PV.APPROACH.lz0 + 40]].map(q => pr(...q)); }
      o.plaza = [[-55, -56], [100, -56], [100, 0], [-55, 0]].map(q => pr(...q)); o.scale = [pr(-280, -230), pr(-180, -230)];
      o.safe = CO.SAFE.map(q => pr(...q)); o.N = pr(C0[0], C0[1]); return o; })"""
    js = js.replace('C0[0], C0[1]', str(C[0]) + ',' + str(C[1] - 100))
    r = await pg.evaluate(js, {'C': C, 'ALT': ALT, 'Z': ZONES})
    await pg.screenshot(path=f'{OUT}/plan_topdown_raw.png', timeout=180000); json.dump(r, open(f'{OUT}/plan_topdown_labels.json', 'w')); await b.close()
  im = Image.open(f'{OUT}/plan_topdown_raw.png').convert('RGBA'); ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
  try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17); fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
  except Exception: f = fs = ImageFont.load_default()
  def tag(t, x, y, col=(255, 225, 90), font=f):
    bb = d.textbbox((0, 0), t, font=font); w, h = bb[2] - bb[0], bb[3] - bb[1]; d.rectangle([x - w / 2 - 5, y - h / 2 - 5, x + w / 2 + 5, y + h / 2 + 5], fill=(15, 15, 15, 225)); d.text((x - w / 2, y - h / 2 - 3), t, font=font, fill=col)
  d.polygon([tuple(q) for q in r['safe']], outline=(124, 255, 107, 255), width=2)
  d.polygon([tuple(q) for q in r['plaza']], outline=(255, 205, 119, 255), fill=(255, 205, 119, 40), width=3)
  if r.get('approach'): d.polygon([tuple(q) for q in r['approach']], outline=(0, 220, 255, 255), fill=(0, 220, 255, 40), width=2)
  for bt in r['berths']: d.polygon([tuple(q) for q in bt['poly']], outline=(255, 70, 70, 255), fill=(255, 70, 70, 70), width=2)
  for z in r['zones']:
    col = tuple(z['col']); d.polygon([tuple(q) for q in z['poly']], outline=col + (255,), fill=col + (z.get('a', 70),), width=4 if z.get('main') else 2)
  im = Image.alpha_composite(im, ov); d = ImageDraw.Draw(im)
  for bt in r['berths'][::3]: pass
  if r['berths']: xs = [bt['c'][0] for bt in r['berths']]; ys = [bt['c'][1] for bt in r['berths']]; tag('10 BERTHS B1-B10 (5 jetties)', sum(xs) / len(xs), max(ys) + 40, (255, 140, 140))
  if r.get('approach'): tag('SHIP APPROACH LANE', (r['approach'][0][0] + r['approach'][1][0]) / 2, (r['approach'][0][1] + r['approach'][2][1]) / 2, (120, 230, 255), fs)
  tag('PLAZA v2 (shops, token halls)', sum(q[0] for q in r['plaza']) / 4, sum(q[1] for q in r['plaza']) / 4)
  tag('SAFE HARBOR (no-fire)', r['safe'][1][0] + 90, r['safe'][1][1] - 14, (124, 255, 107), fs)
  for z in r['zones']: tag(z['name'], *z['at'], tuple(z.get('tc', z['col'])), f if z.get('main') else fs)
  (a, b2) = r['scale']; d.line([tuple(a), tuple(b2)], fill=(255, 255, 255), width=4); tag('100 m', (a[0] + b2[0]) / 2, a[1] + 18, (255, 255, 255), fs)
  d.rectangle([0, 0, W, 54], fill=(15, 15, 15))
  d.text((10, 6), 'PUMPFUN PIRATES battle areas PLAN (top-down, inland up, sea down, west left; plaza v2 = timothy/plaza 427698b)', font=f, fill=(255, 255, 255))
  d.text((10, 30), 'Proposed: MUSKET RANGE (west of Main Street) + SWORD ARENA (east, behind the Squad Hall). Kept clear of plaza, berths + lane, battery, beach/swim cove.', font=fs, fill=(255, 225, 90))
  im.convert('RGB').save(f'{OUT}/plan_topdown.png'); print('ok', r['zones'][0]['poly'][:2])
asyncio.run(main())
