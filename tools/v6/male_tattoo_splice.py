"""Surgical GLB splice: replace ONLY v5_tattoo geometry/material, append PNG data.
Original compressed body, eyes, rig, animations, textures and all bufferViews
remain byte-identical. Blender must generate the tattoo-only input first.
"""
import copy, hashlib, json, struct, sys
from pathlib import Path

def load(path):
    data = Path(path).read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+length])
    return doc, data[28+length:], data

def save(path, doc, binary):
    doc['buffers'][0]['byteLength'] = len(binary)
    text = json.dumps(doc, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    binary += b'\0' * (-len(binary) % 4)
    Path(path).write_bytes(struct.pack('<III', 0x46546c67, 2, 28+len(text)+len(binary)) + struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary)

def splice(src, decal, out):
    old, binary, _ = load(src)
    doc = copy.deepcopy(old)
    new, data, _ = load(decal)
    oldnode = next(n for n in doc['nodes'] if n.get('name') == 'v5_tattoo')
    newnode = next(n for n in new['nodes'] if n.get('name') == 'v5_tattoo')
    oldskin, newskin = doc['skins'][oldnode['skin']], new['skins'][newnode['skin']]
    assert [doc['nodes'][i]['name'] for i in oldskin['joints']] == [new['nodes'][i]['name'] for i in newskin['joints']]
    oldmat = doc['meshes'][oldnode['mesh']]['primitives'][0]['material']
    maps = {}
    for i, view in enumerate(new['bufferViews']):
        start = view.get('byteOffset',0)
        binary += b'\0' * (-len(binary) % 4)
        view = copy.deepcopy(view)
        view['byteOffset'] = len(binary)
        binary += data[start:start+view['byteLength']]
        maps[i] = len(doc['bufferViews'])
        doc['bufferViews'].append(view)
    amap = {}
    for i, acc in enumerate(new['accessors']):
        acc = copy.deepcopy(acc)
        if 'bufferView' in acc: acc['bufferView'] = maps[acc['bufferView']]
        amap[i] = len(doc['accessors']); doc['accessors'].append(acc)
    image = copy.deepcopy(new['images'][0]); image['bufferView'] = maps[image['bufferView']]
    assert image['mimeType'] == 'image/png'
    imageid = len(doc['images']); doc['images'].append(image)
    samplerid = len(doc.setdefault('samplers',[]))
    doc['samplers'].append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071})
    texid = len(doc['textures']); doc['textures'].append({'sampler':samplerid,'source':imageid})
    mat = copy.deepcopy(new['materials'][0]); mat['name'] = 'skull.tattoo'
    mat['alphaMode'] = 'MASK'; mat['alphaCutoff'] = 0.5
    mat['pbrMetallicRoughness']['baseColorTexture']['index'] = texid
    doc['materials'][oldmat] = mat
    mesh = copy.deepcopy(new['meshes'][newnode['mesh']]); mesh['name'] = 'v5_tattoo'
    for p in mesh['primitives']:
        p['attributes'] = {k:amap[v] for k,v in p['attributes'].items()}
        p['indices'] = amap[p['indices']]; p['material'] = oldmat
    doc['meshes'][oldnode['mesh']] = mesh
    save(out,doc,binary)
    verify(src,out)

def verify(src,out):
    old, ob, raw = load(src); new, nb, result = load(out)
    tmesh = next(n['mesh'] for n in old['nodes'] if n.get('name')=='v5_tattoo')
    tmat = old['meshes'][tmesh]['primitives'][0]['material']
    assert nb[:len(ob)] == ob, 'Original binary prefix changed'
    for k in old:
        if k in ['buffers','meshes','materials']: continue
        assert new[k][:len(old[k])] == old[k] if isinstance(old[k],list) else new[k] == old[k], k
    for i,m in enumerate(old['meshes']):
        if i != tmesh: assert new['meshes'][i] == m
    for i,m in enumerate(old['materials']):
        if i != tmat: assert new['materials'][i] == m
    print('PASS original binary prefix, all original views, body/eyes meshes, materials, nodes, skin, animations unchanged',out)

if __name__ == '__main__': splice(*sys.argv[1:4])
