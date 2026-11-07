# emulate js/pirateItems.js coverMask (CLOTH r .024 in .016 back .004) on the V7 female body for a worn top; write body GLB minus hidden tris
import sys,numpy as np;sys.path.insert(0,'/workspace/v7f-gear-work');from glb_io import GLB
from scipy.spatial import cKDTree
body,cloth,out=sys.argv[1:4]
R,IN,BACK=0.024,0.016,0.004
b=GLB(body);pb=b.d['meshes'][0]['primitives'][0];P=b.array(pb['attributes']['POSITION']).astype(float);T=b.array(pb['attributes']['_TINT']).astype(float).reshape(len(P),-1)[:,0]
c=GLB(cloth);pc=c.d['meshes'][0]['primitives'][0];C=c.array(pc['attributes']['POSITION']).astype(float);CN=c.array(pc['attributes']['NORMAL']).astype(float)
H=c.array(pc['attributes']['_HEM']).astype(float).reshape(len(C),-1)[:,0] if '_HEM' in pc['attributes'] else None
d,j=cKDTree(C).query(P,distance_upper_bound=R)
ok=np.isfinite(d)&(np.round(T)!=1)
jj=np.where(ok,j,0)
if H is not None: hid=ok&(H[jj]>=IN)
else: hid=ok&(((C[jj]-P)*CN[jj]).sum(1)>-BACK)
I=b.array(pb['indices']).reshape(-1,3);keep=~hid[I].all(1)
print('hidden verts',hid.sum(),'/',len(P),'tris removed',(~keep).sum(),'/',len(I))
pb['indices']=b.add_array(I[keep].ravel().astype('<u4'),'SCALAR',5125)
np.save(out+'.hid.npy',hid);b.save(out)
