# garment self-intersection (layer crossing) at bind: face pairs that intersect and share no welded vertex
import sys,numpy as np;sys.path.insert(0,'/workspace/v7f-gear-work');from glb_io import GLB
from mathutils.bvhtree import BVHTree
for f in sys.argv[sys.argv.index('--')+1:]:
  g=GLB(f);p=g.d['meshes'][0]['primitives'][0];P=g.array(p['attributes']['POSITION']).astype(float);I=g.array(p['indices']).reshape(-1,3)
  key=np.round(P*1e5).astype(np.int64);_,w=np.unique(key,axis=0,return_inverse=True);w=w.ravel();WI=w[I]
  T=BVHTree.FromPolygons(P.tolist(),I.tolist());pr=T.overlap(T)
  n=sum(1 for a,b in pr if a<b and not (set(WI[a])&set(WI[b])))
  print(f,'self-crossing face pairs',n)
