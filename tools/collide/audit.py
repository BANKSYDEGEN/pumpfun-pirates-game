# [Timothy] PUMPFUN PIRATES plaza collision audit: python3 tools/collide/audit.py WT OUT_PREFIX [desktop|phone] [query]
# -> OUT_PREFIX.json (walk-throughs / invisible walls, clustered, with mesh names) + OUT_PREFIX_overlay.png (top-down map:
# grey = solid geometry at body height, red = collider (incl. body radius), magenta = walk-through, blue = invisible wall)
import asyncio, json, sys, os, base64, numpy as np
from playwright.async_api import async_playwright
from PIL import Image
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
WT, OUT = sys.argv[1], sys.argv[2]; DEV = sys.argv[3] if len(sys.argv) > 3 else 'desktop'; Q = sys.argv[4] if len(sys.argv) > 4 else ''
P = dict(lx0=-186, lx1=196, lz0=-80, lz1=64, step=0.25, lo=0.3, hi=1.7, deckColl=os.environ.get('DECKCOLL', '1') == '1')
JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audit.js')).read()
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS); mob = DEV == 'phone'
    kw = dict(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, user_agent=UA) if mob else dict(viewport={'width': 1280, 'height': 720})
    ctx = await b.new_context(**kw); await ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=503, body='{}'))
    pg = await ctx.new_page(); pg.set_default_timeout(600000)
    await pg.goto(f'http://127.0.0.1:18960/{WT}/island.html?coast=1&shot&quality={"low" if mob else "high"}&{Q}')
    await pg.wait_for_function('window.ISLAND && ISLAND.foot', timeout=600000); await pg.wait_for_timeout(6000)
    r = await pg.evaluate(JS, P); await b.close(); return r
r = asyncio.run(main())
NX, NZ = r['NX'], r['NZ']; dec = lambda s, t: np.frombuffer(base64.b64decode(s), t).reshape(NZ, NX)
M, B, G = dec(r['M'], np.uint16), dec(r['B'], np.uint8), dec(r['G'], np.float32); names = r['names']
from scipy import ndimage
solid = M > 0; prop = B == 1; free = B == 0
walk = solid & free                                      # geometry you can walk into
rad = int(round((0.45 + 0.35) / P['step'])); yy, xx = np.mgrid[-rad:rad + 1, -rad:rad + 1]; disk = xx * xx + yy * yy <= rad * rad
inv = prop & ~ndimage.binary_dilation(solid, disk)       # collider with no geometry near it
def clusters(mask, minc):
  lab, n = ndimage.label(mask); out = []
  for k, sl in enumerate(ndimage.find_objects(lab), 1):
    cnt = int((lab[sl] == k).sum())
    if cnt < minc: continue
    jj, ii = np.nonzero(lab[sl] == k); j0, i0 = sl[0].start, sl[1].start
    ids = M[sl][lab[sl] == k]; ids = ids[ids > 0]; nm = names[int(np.bincount(ids).argmax()) - 1] if len(ids) else None
    out.append(dict(lx=round(P['lx0'] + (i0 + ii.mean()) * P['step'], 2), lz=round(P['lz0'] + (j0 + jj.mean()) * P['step'], 2), area=round(cnt * P['step'] ** 2, 2),
                    w=round((sl[1].stop - sl[1].start) * P['step'], 2), d=round((sl[0].stop - sl[0].start) * P['step'], 2), mesh=nm))
  return sorted(out, key=lambda c: -c['area'])
WT_ = clusters(walk, 3); INV = clusters(inv, 6)
res = dict(list=r['list'], hidden=r['hidden'], dev=DEV, meshes=r['meshes'], used=r['used'], tris=r['tris'], walkthrough_n=len(WT_), invisible_n=len(INV), walkthrough=WT_, invisible=INV)
json.dump(res, open(OUT + '.json', 'w'), indent=1)
img = np.zeros((NZ, NX, 3), np.uint8); img[:] = (236, 226, 200); img[B >= 2] = (120, 170, 200); img[solid] = (90, 90, 90)
img[prop & ~solid] = (230, 70, 60); img[prop & solid] = (150, 40, 35); img[walk] = (255, 0, 255); img[inv] = (40, 90, 255)
im = Image.fromarray(img[::-1] if False else img).resize((NX * 2, NZ * 2), Image.NEAREST); im.save(OUT + '_overlay.png')
print(json.dumps(dict(dev=DEV, meshes=r['meshes'], used=r['used'], tris=r['tris'], walkthrough=len(WT_), invisible=len(INV), top_walk=WT_[:25], top_inv=INV[:12])))
