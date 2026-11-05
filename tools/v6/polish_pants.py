"""Item-only V6 hem tailoring. No body/shoe writes, rig or UV changes.
python3 tools/v6/polish_pants.py assets/pirates/items/v5/*pants*.glb ...
Source files must be the original v276 assets (not already tailored).
The GLB buffers are edited in place: every unrelated byte stays identical.
"""
import json, struct, sys
from pathlib import Path
import numpy as np
IDS = {'classic_pants', 'canvas_pants', 'sailor_trousers', 'leather_breeches'}
TYPES = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
SIZES = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def load(path):
    raw = Path(path).read_bytes()
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 8)[0] == len(raw)
    size = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+size]), bytearray(raw[28+size:])

def accessor(doc, blob, idx):
    a = doc['accessors'][idx]; v = doc['bufferViews'][a['bufferView']]
    dt = np.dtype(TYPES[a['componentType']]); width = SIZES[a['type']]
    return np.ndarray((a['count'], width), dtype=dt, buffer=blob,
        offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
        strides=(v.get('byteStride', dt.itemsize*width), dt.itemsize))

def save(path, doc, blob):
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    Path(path).write_bytes(b'glTF'+struct.pack('<II',2,28+len(data)+len(blob))+
        struct.pack('<I',len(data))+b'JSON'+data+struct.pack('<I',len(blob))+b'BIN\0'+blob)

def polish(path):
    path = Path(path); item, sex, lod = path.stem.rsplit('_', 2)
    assert item in IDS and sex in ('male','female') and lod in ('hi','lo'), path
    doc, blob = load(path); prim = doc['meshes'][0]['primitives'][0]
    posid = prim['attributes']['POSITION']; pos = accessor(doc,blob,posid)
    original = pos.copy(); faces = accessor(doc,blob,prim['indices']).reshape(-1,3)
    # Weld only for topology measurements, never change indices/UV splits.
    _, inv = np.unique(np.round(pos/1e-5).astype(np.int64),axis=0,return_inverse=True)
    tri = inv[faces]; edges = np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1)
    unique, counts = np.unique(edges,axis=0,return_counts=True)
    boundary = set(unique[counts==1].ravel().tolist()); on_edge = np.isin(inv,list(boundary))
    hems = []
    for side in (-1,1):
        side_mask = np.sign(original[:,0]) == side
        low = original[side_mask,1].min()
        # Distinguish leg openings from the upper waistband and sash.
        edge_mask = side_mask & on_edge & (original[:,1] < low+0.065)
        assert edge_mask.sum() >= 3, (path,side,'missing hem')
        h = float(np.median(original[edge_mask,1])); hems.append(h)
        distance = original[:,1]-h
        weight = np.clip(1-np.maximum(distance,0)/0.045,0,1)
        # Hem edge itself becomes level; near rows fade back to original shape.
        target = original[:,1].copy(); target[edge_mask] = h
        for idx in np.where(side_mask & ~edge_mask & (np.abs(distance)<0.025))[0]:
            # Raise only spikes below the new clean edge, not the cloth above it.
            if target[idx] < h: target[idx] = h
        pos[side_mask,1] += (target[side_mask]-original[side_mask,1])*weight[side_mask]
        pos[edge_mask,1] = h
        # Both legs/LODs share a clean, level finished length.
        finished = {'classic_pants': (0.1822,0.295), 'canvas_pants': (0.1822,0.295),
                    'sailor_trousers': (0.148,0.160), 'leather_breeches': (h,h)}[item][sex=='female']
        w = np.clip((h+0.045-pos[:,1])/0.045,0,1)
        pos[side_mask,1] += (finished-h)*w[side_mask]
        pos[edge_mask,1] = finished
        h = finished
        if item == 'leather_breeches':
            # Sea cuff TOP = shin head - .016: male .1982, female .2082.
            # Extend 12 mm inside it. Prior male knee-cut/female short hem left skin.
            cuff = 0.1982 if sex=='male' else 0.2082
            bottom = cuff-0.012
            blend_top = max(h+0.095, 0.36 if sex=='male' else 0.44)
            w = np.clip((blend_top-pos[:,1])/(blend_top-h),0,1)
            pos[side_mask,1] -= (h-bottom)*w[side_mask]
    # De-spike the open waistband, keeping its folds and limiting travel to 6 mm.
    wp = np.zeros((inv.max()+1,3)); wp[inv] = pos
    adj = {}
    for a,b in unique[counts==1]:
        adj.setdefault(a,[]).append(b); adj.setdefault(b,[]).append(a)
    upper = [i for i in boundary if wp[i,1] > original[:,1].max()-0.055 and len(adj.get(i,[]))==2]
    start = wp.copy()
    for _ in range(3):
        prev = wp.copy()
        for i in upper: wp[i] = prev[i]*0.65+prev[adj[i]].mean(axis=0)*0.35
    delta = wp-start; length = np.linalg.norm(delta,axis=1)
    delta *= np.minimum(1,0.006/np.maximum(length,1e-12))[:,None]
    pos[:] += delta[inv]
    changed = np.linalg.norm(pos-original,axis=1)>1e-7
    # Recalculate normals only in the changed lower-hem region, across UV seams.
    if 'NORMAL' in prim['attributes']:
        normal = accessor(doc,blob,prim['attributes']['NORMAL'])
        cross = np.cross(pos[faces[:,1]]-pos[faces[:,0]],pos[faces[:,2]]-pos[faces[:,0]])
        sums = np.zeros((inv.max()+1,3),np.float64)
        for corner in range(3): np.add.at(sums,inv[faces[:,corner]],cross)
        norm = sums[inv]; length = np.linalg.norm(norm,axis=1); norm /= np.maximum(length[:,None],1e-12)
        valid = changed & (length>1e-12)
        # Match original surface winding (do not flip a legacy mirrored shell).
        flip = np.einsum('ij,ij->i',norm,normal)<0; norm[flip]*=-1
        normal[valid] = norm[valid]
    a = doc['accessors'][posid]; a['min'] = pos.min(axis=0).tolist(); a['max'] = pos.max(axis=0).tolist()
    assert np.isfinite(pos).all() and changed.any()
    save(path,doc,blob)
    print(path.name,'verts',int(changed.sum()),'old hems',','.join(f'{x:.4f}' for x in hems),'new min',f'{pos[:,1].min():.4f}')
    return int(changed.sum())

if __name__ == '__main__':
    for filename in sys.argv[1:]: polish(filename)
