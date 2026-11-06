// [Timothy] THE GOLDEN DOUBLOON CASINO: compress the Blender export for the web (same recipe as tools/hill_blender/pack_hill.mjs).
// Run from a dir with @gltf-transform/{core,extensions,functions} + meshoptimizer:
//   node pack_casino.mjs /tmp/casino_out/casino_hall_raw.glb GAME/assets/island  ->  casino_hall.glb (LOD0 + LOD1, desktop) + casino_hall_low.glb (LOD1, phones)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { statSync } from 'fs';
const [, , src, out, name = 'casino_hall'] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const low of [false, true]) {
  const doc = await io.read(src), root = doc.getRoot();
  if (low) for (const n of root.listNodes()) if (n.getName().endsWith('_LOD0')) n.dispose();
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {   // keep the baked 'Col' set as COLOR_0
    const c0 = p.getAttribute('COLOR_0'), c1 = p.getAttribute('COLOR_1');
    if (c0 && c1) { const e = []; let white = true; for (let i = 0; i < c0.getCount() && white; i++) { c0.getElement(i, e); white = e[0] > 0.999 && e[1] > 0.999 && e[2] > 0.999; } if (white) p.setAttribute('COLOR_0', c1); }
    for (const sem of p.listSemantics()) if (/^COLOR_[1-9]/.test(sem)) p.setAttribute(sem, null); }
  await doc.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }), reorder({ encoder: MeshoptEncoder }), quantize({ quantizeColor: 8, quantizeNormal: 8, quantizePosition: +(process.env.QBITS || 14), quantizeTexcoord: 8 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const f = `${out}/${name}${low ? '_low' : ''}.glb`; await io.write(f, doc);
  console.log(f, (statSync(f).size / 1024).toFixed(0) + ' KB');
}
