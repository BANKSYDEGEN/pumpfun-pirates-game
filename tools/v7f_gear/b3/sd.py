import sys,numpy as np;sys.path.insert(0,'/workspace/v7f-gear-work');from glb_io import GLB
from mathutils.bvhtree import BVHTree;from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:];body,cloth=a[:2]
b=GLB(body);pb=b.d['meshes'][0]['primitives'][0];P=b.array(pb['attributes']['POSITION']).astype(float);I=b.array(pb['indices']).reshape(-1,3)
c=GLB(cloth);pc=c.d['meshes'][0]['primitives'][0];C=c.array(pc['attributes']['POSITION']).astype(float)
T=BVHTree.FromPolygons(P.tolist(),I.tolist())
s=[];
for v in C:
  q,n,f,d=T.find_nearest(Vector(v)); s.append((Vector(v)-q).dot(n))
s=np.array(s);print(cloth.split('/')[-1],'n',len(C),'inside(s<0)',(s<0).sum(),'s<-3mm',(s<-0.003).sum(),'s<-1cm',(s<-0.01).sum(),'pct1/5/50',np.percentile(s,[1,5,50]).round(4))
np.save(cloth.split('/')[-1]+'.sd.npy',s)
