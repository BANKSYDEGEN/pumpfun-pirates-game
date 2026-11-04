# refit_special.py -- item side who lod [src_repo] [out_repo] : re-seat a special peg (peg_gold / peg_kraken from raul/shop-items-2,
# or any later peg built on the old knee-cup seat) on Raul's v5 peg fit (pegfit.py): its old knee cup / rim / cushion / cup gem are
# dropped (loose parts above its old shaft top), the shaft + ornaments + tip are kept (moved onto the new knee centre, rigid on shin.X)
# and the fitted knee sleeve is added in the item's palette (pegfit.PAL[item]), pant-weighted like the standard peg.
# /opt/blender/blender -b -P refit_special.py -- peg_gold l male hi /workspace/raul-shop-items-2 /workspace/<merged repo>
import bpy, sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import pegfit as pf
from geo import Part, merge
A = sys.argv[sys.argv.index('--') + 1:]; item, sd, who, lod = A[:4]
SRC = A[4] if len(A) > 4 else '/workspace/raul-shop-items-2'; OUT = A[5] if len(A) > 5 else SRC
HI = lod == 'hi'; RES = 1.0 if HI else 0.4
src = f'{SRC}/assets/pirates/items/v5/{item}_{sd}_{who}_{lod}.glb'
b = pf.Body(who, lod, next(r for r in (OUT, SRC, '/workspace/raul-pegleg') if os.path.exists(f'{r}/assets/pirates/pirate_{who}_v5_{lod}.glb')))   # bodies + base outfit from the merged tree
F = b.fit(sd)
old = pf.imp(src); om = [o for o in old if o.type == 'MESH'][0]
mark = om.get('pegfit')   # already re-fitted by this script (glTF extras): re-seat from that record, never shift twice
mark = json.loads(mark) if isinstance(mark, str) else None
V = pf.world(om); me = om.data; me.calc_loop_triangles()
T = np.array([[t.vertices[0], t.vertices[1], t.vertices[2]] for t in me.loop_triangles])
ca = me.color_attributes[0]; C = np.array([d.color[:3] for d in ca.data]) if ca.domain == 'POINT' else None
if C is None:   # corner colours -> per vertex
  C = np.zeros((len(V), 3))
  for l, d in zip(me.loops, ca.data): C[l.vertex_index] = d.color[:3]
for o in old: bpy.data.objects.remove(o)
# loose parts (union-find over triangles)
par = np.arange(len(V))
def fd(x):
  while par[x] != x: par[x] = par[par[x]]; x = par[x]
  return x
for a, b_, c in T:
  for u, v in ((a, b_), (a, c)):
    ru, rv = fd(u), fd(v)
    if ru != rv: par[ru] = rv
root = np.array([fd(i) for i in range(len(V))])
fitj = f'/workspace/brand/v5_models/raul_shop_items_2/tools/peg_fit_{item}_{sd}_{who}_{lod}.json'
oldF = mark or (json.load(open(fitj)) if os.path.exists(fitj) else None)
st = oldF['shaft_top'] if oldF else F['knee'][2] - 0.05; ok = np.zeros(len(V), bool)
for r in np.unique(root):
  m = root == r
  if V[m, 2].mean() <= st + 0.015: ok[m] = True          # keep: below the old cup (shaft, ornaments, tip)
keep_t = T[ok[T].all(1)]; idx = np.where(ok)[0]; remap = -np.ones(len(V), int); remap[idx] = np.arange(len(idx))
okn = np.array(F['knee'][:2]) - (np.array(oldF['knee'][:2]) if oldF else np.array(F['knee'][:2]))
KV = V[idx] + np.array([okn[0], okn[1], 0]); rest = Part(KV, remap[keep_t], C[idx], False)
# the new sleeve (+ its ink), Low colours baked like the rest of the Low item
sl, _ = pf.build(b, F, pf.sleeve_parts(b, F, pf.PAL.get(item, pf.PAL['peg']), RES), [], 0.0035 if HI else 0.006)
if not HI: sl = pf.lowlight(sl)
m = merge([sl, rest]); rigid = np.r_[np.zeros(len(sl.V), bool), np.ones(len(KV), bool)]
W = b.weights(m.V, F, rigid)
ob = pf.to_blender(b, m, f'{item}_{sd}_{who}_{lod}', W); ob['pegfit'] = json.dumps(dict(knee=F['knee'], shaft_top=F['shaft_top']))
fn = f'{OUT}/assets/pirates/items/v5/{item}_{sd}_{who}_{lod}.glb'; pf.export(b, ob, fn, extras=True)
print('REFIT', item, sd, who, lod, 'kept', len(idx), 'of', len(V), 'verts; tris', len(m.F), 'kb', os.path.getsize(fn) // 1024, '->', fn)
