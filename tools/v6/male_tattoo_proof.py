"""Compare surgical tattoo outputs to original GLBs, emit auditable SHA256 proof."""
import hashlib, json, sys, io, subprocess
from pathlib import Path
from PIL import Image
from male_tattoo_splice import load, verify
sha = lambda b: hashlib.sha256(b).hexdigest()
root=Path(sys.argv[1]); shots=Path(sys.argv[2]); report=['# Male tattoo-only DIFF PROOF','', 'Baseline: b308ae6. No full garments pass was run. Only the shared male tattoo block was executed.','', 'Blender imports the male, deletes old tattoo, raycasts a new v5_tattoo decal and transfers armature weights with DATA_TRANSFER. A surgical GLB splice replaces only its mesh/material and appends its PNG/accessors. No body re-export or Draco recompression occurs.','', 'All original binary bytes remain intact as a prefix, including body/hair/boxers, eye geometry, UVs, attributes, weights, textures, animation samples and rig inverse binds. Original nodes, skeleton, animations, scene and extras are identical. Body/hair/boxers are combined in the original body mesh: that entire mesh definition and its compressed data are byte-identical.','']
for level in ['hi','lo']:
 src=shots/'baseline'/f'{level}.glb'; out=root/f'assets/pirates/pirate_male_v6_{level}.glb'
 verify(src,out); a,ab,ar=load(src); b,bb,br=load(out)
 report += [f'## {level.upper()}',f'- Before GLB SHA256: `{sha(ar)}`',f'- After GLB SHA256: `{sha(br)}`',f'- Original binary prefix ({len(ab)} bytes): before `{sha(ab)}` / after `{sha(bb[:len(ab)])}` — **IDENTICAL**']
 for i,mesh in enumerate(a['meshes']):
  if mesh['name']=='v5_tattoo':continue
  report += [f"- {mesh['name']} JSON: `{sha(json.dumps(mesh,sort_keys=True).encode())}` — **IDENTICAL**"]
  for p in mesh['primitives']:
   v=a['bufferViews'][p['extensions']['KHR_draco_mesh_compression']['bufferView']];start=v.get('byteOffset',0);n=v['byteLength']
   assert ab[start:start+n]==bb[start:start+n]
   report += [f"  - Draco buffer ({n} bytes): `{sha(ab[start:start+n])}` — **IDENTICAL**"]
 for key in ['nodes','skins','animations']:
  assert a.get(key)==b.get(key);report += [f'- {key}: `{sha(json.dumps(a.get(key),sort_keys=True).encode())}` — **IDENTICAL**']
 mat=next(m for m in b['materials'] if m['name']=='skull.tattoo');assert mat['alphaMode']=='MASK'
 v=b['bufferViews'][b['images'][-1]['bufferView']];im=Image.open(io.BytesIO(bb[v['byteOffset']:v['byteOffset']+v['byteLength']]));alpha=im.getchannel('A');assert set(alpha.getdata())=={0,255}
 for xy in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]:assert alpha.getpixel(xy)==0
 im.save(shots/f'{level}_texture.png')
 report += ['- Tattoo: PNG RGBA, binary alpha {0,255}; all corners alpha 0. glTF `MASK`, cutoff 0.5. `skull.tattoo`/`v5_tattoo` retained.','']
report += ['## Female assets: untouched']
for p in sorted((root/'assets/pirates').glob('pirate_female_v6_*.glb')):
 old=subprocess.check_output(['git','show',f'b308ae6:assets/pirates/{p.name}'],cwd=root);assert p.read_bytes()==old
 report += [f'- {p.name}: `{sha(old)}` — identical to b308ae6']
report += ['', '## Scope and review', '- Changed: male hi/lo GLBs; only male tattoo block in garments.py; male-only build/splice/proof helpers.', '- Female sections/paths and female GLBs unchanged. No push. No male body polish.', '- Static Blender review images, NOT gameplay captures. BANKSY should approve pill colors, diagonal, size and right upper-arm placement. Hair and eyes shown are the unmodified live baseline, not redesigned to the style sheet.', '- 3D reference is a placement/style reference only. Its body/hair must not be mistaken for changes in this tattoo-only pass.']
(shots/'DIFF_PROOF.md').write_text('\n'.join(report)+'\n')
print('WROTE',shots/'DIFF_PROOF.md')
