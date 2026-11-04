# build_peg.py -- who lod side [repo] : the standard v5 PEG LEG on Raul's peg fit (pegfit.py)
# /opt/blender/blender -b -P build_peg.py -- male hi l /workspace/raul-pegleg
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import pegfit as pf
A = sys.argv[sys.argv.index('--') + 1:]; who, lod, sd = A[:3]; WT = A[3] if len(A) > 3 else '/workspace/raul-pegleg'
b = pf.Body(who, lod, WT); HI = lod == 'hi'; RES = 1.0 if HI else 0.4
F = b.fit(sd); pf.save_fit(F, who, lod)
m, rigid = pf.build(b, F, pf.sleeve_parts(b, F, pf.PAL['peg'], RES), pf.shaft_parts(F, RES), 0.0035 if HI else 0.006)
if not HI: m = pf.lowlight(m)
W = b.weights(m.V, F, rigid)
ob = pf.to_blender(b, m, f'peg_{sd}_{who}_{lod}', W)
fn = f'{WT}/assets/pirates/items/v5/peg_{sd}_{who}_{lod}.glb'; pf.export(b, ob, fn)
print('BUILT', who, lod, sd, 'tris', len(m.F), 'verts', len(m.V), 'kb', os.path.getsize(fn) // 1024, json.dumps({k: (round(v, 4) if isinstance(v, float) else v) for k, v in F.items()}))
