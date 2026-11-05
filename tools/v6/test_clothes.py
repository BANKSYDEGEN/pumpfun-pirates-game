"""Offline V6 clothes regression checks against the source-tree assets.
python3 tools/v6/test_clothes.py [base-ref] (defaults to v276 dd6fff6)
"""
import io, json, struct, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
from polish_pants import load, accessor, IDS
BASE=sys.argv[1] if len(sys.argv)>1 else 'dd6fff6'

def parse(raw):
    size=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+size]),bytearray(raw[28+size:])

def views(j,b):
    return [bytes(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]) for v in j['bufferViews']]

changed=subprocess.check_output(['git','diff',BASE,'--name-only'],text=True).splitlines()
assets=[Path(p) for p in changed if p.endswith('.glb')]
expected={f'{item}_{sex}_{lod}.glb' for item in (*IDS, 'cloth_shirt', 'cloth_tshirt', 'cloth_coat', 'cloth_suit', 'cloth_tank', 'cloth_singlet', 'cloth_base') for sex in ('male','female') for lod in ('hi','lo')}
assert assets and {p.name for p in assets} <= expected, (len(assets),assets)
if BASE=='dd6fff6': assert {p.name for p in assets}==expected
assert not any('pirate_' in p.name or any(k in p.name for k in ('boots','shoes','sandals')) for p in assets)
for path in assets:
    oldj,oldb=parse(subprocess.check_output(['git','show',f'{BASE}:{path}']))
    j,b=load(path); oldv=views(oldj,oldb); newv=views(j,b)
    assert oldj['nodes']==j['nodes'] and oldj.get('skins')==j.get('skins')
    assert oldj['meshes']==j['meshes'] and oldj.get('animations')==j.get('animations')
    assert oldj.get('materials')==j.get('materials')
    assert len(oldv)==len(newv)
    item,sex,lod=path.stem.rsplit('_',2); prim=j['meshes'][0]['primitives'][0]
    images={im['bufferView']:im for im in j.get('images',[])}
    modified=0
    if item in IDS:
        allowed={j['accessors'][prim['attributes'][k]]['bufferView'] for k in ('POSITION','NORMAL')}
        if item=='classic_pants':
            allowed.add(j['accessors'][prim['attributes']['_HEM']]['bufferView'])
            from refresh_pants_cover import hem_distances
            region,distance=hem_distances(j,b)
            hem=accessor(j,b,prim['attributes']['_HEM']).ravel()
            assert np.all(hem[region] <= distance[region]+1e-7),path
        if BASE=='5666ec9':
            for key in ('POSITION','NORMAL'):
                view=j['accessors'][prim['attributes'][key]]['bufferView']
                assert oldv[view]==newv[view], (path,key,'pass3 must not re-tailor')
        allowed |= {i for i,im in images.items() if not im.get('name','').endswith('_n')}
        assert all(a==c for i,(a,c) in enumerate(zip(oldv,newv)) if i not in allowed),path
        p=accessor(j,b,prim['attributes']['POSITION']); f=accessor(j,b,prim['indices']).reshape(-1,3)
        assert np.isfinite(p).all()
        area=np.linalg.norm(np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]]),axis=1)
        assert (area>1e-10).all(),path
        normal=accessor(j,b,prim['attributes']['NORMAL']);assert np.allclose(np.linalg.norm(normal,axis=1),1,atol=.003)
        if item=='leather_breeches':
            cuff=.1982 if sex=='male' else .2082
            for side in (-1,1): assert abs(p[np.sign(p[:,0])==side,1].min()-(cuff-.012))<1e-5
    for i,(a,c) in enumerate(zip(oldv,newv)):
        if a==c or (item in IDS and i not in images): continue
        assert i in images and not images[i].get('name','').endswith('_n'),path
        before=Image.open(io.BytesIO(a));after=Image.open(io.BytesIO(c))
        assert before.size==after.size,path
        if 'A' in before.getbands():
            assert 'A' in after.getbands() and np.array_equal(np.asarray(before.getchannel('A')),np.asarray(after.getchannel('A'))),path
        else: assert 'A' not in after.getbands(),path
        modified+=1
    assert modified==1,path
    print('PASS',path.name)
assert subprocess.check_output(['git','show',f'{BASE}:sw.js'])==Path('sw.js').read_bytes()
assert subprocess.check_output(['git','show',f'{BASE}:js/shopCatalog.js'])==Path('js/shopCatalog.js').read_bytes()
# The new fine-detail filter must preserve exact masks, constants and size.
from sharpen_cloth import sharpen, trim_uv_mask
sample=Image.new('RGBA',(8,8),(110,120,130,43))
out=sharpen(sample,True,True,True,trim_uv_mask(sample.size,[[[0,0],[1,0],[1,1]]]))
assert np.array_equal(np.asarray(sample),np.asarray(out))
print(f'PASS {len(assets)} item GLBs; untouched rigs/weights/UVs/tints/normal maps/alpha masks/catalog/SW; classic hem guard capped at actual opening; breeches overlap both sea cuffs by 12mm')
