// [Timothy] hill street pack = tools/plaza_blender/pack_shops.mjs with prune keepLeaves (the door empties are leaf nodes).
// [Timothy] PUMPFUN PIRATES plaza shops: compress the Blender export for the web (run from a dir with @gltf-transform/{core,extensions,
// functions} + meshoptimizer).  node pack_shops.mjs RAW.glb OUT_DIR [NAME]  ->  plaza_shops.glb (LOD0-2, desktop) + plaza_shops_low.glb (LOD1-2, phones)
// weld + dedup + quantize + EXT_meshopt_compression (js/island/townkit.js already ships the MeshoptDecoder); no textures (vertex colour only).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { statSync, writeFileSync } from 'fs';
const [, , src, out, name = 'plaza_shops'] = process.argv;   // also: battery_raw.glb OUT battery
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const report = {};
for (const low of [false, true]) {
  const doc = await io.read(src), root = doc.getRoot();
  if (low) for (const n of root.listNodes()) if (/_LOD0$/.test(n.getName())) n.dispose();
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {   // the exporter can put a constant-white set first (docks): keep the baked 'Col' set as COLOR_0
    const c0 = p.getAttribute('COLOR_0'), c1 = p.getAttribute('COLOR_1');
    if (c0 && c1) { const e = []; let white = true; for (let i = 0; i < c0.getCount() && white; i++) { c0.getElement(i, e); white = e[0] > 0.999 && e[1] > 0.999 && e[2] > 0.999; } if (white) p.setAttribute('COLOR_0', c1); }
    for (const sem of p.listSemantics()) if (/^COLOR_[1-9]/.test(sem)) p.setAttribute(sem, null); }   // only COLOR_0 is drawn
  await doc.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }), reorder({ encoder: MeshoptEncoder }), quantize({ quantizeColor: 8, quantizeNormal: 8, quantizePosition: +(process.env.QBITS || 14), quantizeTexcoord: 8 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const f = `${out}/${name}${low ? '_low' : ''}.glb`; await io.write(f, doc);
  const tris = {}; for (const n of root.listNodes()) { const m = n.getMesh(); if (!m) continue; tris[n.getName()] = m.listPrimitives().reduce((s, p) => s + (p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute('POSITION').getCount() / 3), 0); }
  report[low ? 'low' : 'high'] = { file: f, bytes: statSync(f).size, tris };
  console.log(f, (statSync(f).size / 1024).toFixed(0) + ' KB');
}
writeFileSync(`/tmp/${name}_pack_report.json`, JSON.stringify(report, null, 1));
