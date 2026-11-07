import sys,numpy as np;sys.path.insert(0,'/workspace/v7f-gear-work');from glb_io import GLB
d=sys.argv[1]
for it in ['cloth_coat','cloth_suit','cloth_shirt','cloth_tank','cloth_tshirt']:
 for l in ['hi','lo']:
  a=GLB(f'/workspace/v7f-gear-work/dec/{it}_female_{l}.glb');b=GLB(f'{d}/{it}_female_{l}.glb');pa=b.d['meshes'][0]['primitives'][0]['attributes']
  P=a.array(a.d['meshes'][0]['primitives'][0]['attributes']['POSITION']).astype(float);Q=b.array(pa['POSITION']).astype(float)
  J=b.array(pa['JOINTS_0']).astype(int);w=b.array(pa['WEIGHTS_0']).astype(float);w=w/255 if w.max()>1.5 else w
  M=np.zeros((len(J),64))
  for k in range(4): np.add.at(M,(np.arange(len(J)),J[:,k]),w[:,k])
  key=np.round(P*1e5).astype(np.int64);_,inv=np.unique(key,axis=0,return_inverse=True);inv=inv.ravel();cnt=np.bincount(inv)
  def spread(X):
    c=np.zeros((len(cnt),X.shape[1]));np.add.at(c,inv,X);c/=cnt[:,None];return np.abs(X-c[inv]).sum(1)
  print(it,l,'pos crack>0.1mm',(spread(Q)>1e-4).sum(),'weight mismatch>0.02',(spread(M)>0.02).sum())
