"""Refresh the lower classic-pants cover guard after previous hem tailoring.
Idempotent, _HEM-only change: never re-run polish_pants or move vertices.
python3 tools/v6/refresh_pants_cover.py classic_pants_{sex}_{hi,lo}.glb
"""
import sys
from pathlib import Path
import numpy as np
from polish_pants import load, accessor, save

def hem_distances(doc, blob):
    prim=doc['meshes'][0]['primitives'][0]
    pos=accessor(doc,blob,prim['attributes']['POSITION'])
    faces=accessor(doc,blob,prim['indices']).reshape(-1,3)
    _,inv=np.unique(np.round(pos/1e-5).astype(np.int64),axis=0,return_inverse=True)
    tri=inv[faces]
    edges=np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1)
    unique,counts=np.unique(edges,axis=0,return_counts=True)
    boundary=np.isin(inv,unique[counts==1].ravel())
    region=np.zeros(len(pos),bool); distance=np.full(len(pos),np.inf)
    for sign in (-1,1):
        side=np.sign(pos[:,0])==sign; bottom=pos[side,1].min()
        hem=pos[side & boundary & (pos[:,1]<bottom+.015)]
        assert len(hem)>=3, 'lower hem not found'
        mask=side & (pos[:,1]<bottom+.045);region |= mask
        distance[mask]=np.sqrt(((pos[mask,None,:]-hem[None,:,:])**2).sum(-1).min(-1))
    return region,distance

def refresh(path):
    assert Path(path).stem.startswith('classic_pants_'),path
    doc,blob=load(path);prim=doc['meshes'][0]['primitives'][0]
    hem=accessor(doc,blob,prim['attributes']['_HEM']).ravel()
    region,distance=hem_distances(doc,blob);old=hem.copy()
    # A cover sample cannot be farther inside the garment than its distance
    # from the actual moved opening. Keep all original interior coverage.
    hem[region]=np.minimum(hem[region],distance[region])
    save(path,doc,blob)
    print(Path(path).name,'guard samples corrected',int((old!=hem).sum()))

if __name__=='__main__':
    for path in sys.argv[1:]:refresh(path)
