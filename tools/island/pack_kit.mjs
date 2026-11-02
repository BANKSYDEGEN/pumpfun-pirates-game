// [Raul] PUMPFUN PIRATES island: compress the Blender town kit for the web (run from a dir with @gltf-transform + sharp + meshoptimizer).
//   node pack_kit.mjs town_kit_raw.glb OUT_DIR
// High: 2048 webp albedo (A = emissive mask) + 2048 webp normal map. Low: 1024 albedo only, LOD1 meshes only.
// Meshes: dedup, weld, quantize, meshopt (EXT_meshopt_compression).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
const [, , src, out] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const low of [false, true]) {
  const doc = await io.read(src), root = doc.getRoot();
  if (low) { for (const n of root.listNodes()) if (/_LOD0$/.test(n.getName())) n.dispose();
    for (const m of root.listMaterials()) { const t = m.getNormalTexture(); m.setNormalTexture(null); } }
  await doc.transform(dedup(), weld(), prune(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizeColor: 8, quantizeNormal: 8, quantizeTexcoord: 14 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: low ? [1024, 1024] : [2048, 2048], quality: low ? 80 : 88 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const f = `${out}/town_kit${low ? '_low' : ''}.glb`; await io.write(f, doc);
  const { statSync } = await import('fs'); console.log(f, (statSync(f).size / 1024).toFixed(0) + ' KB');
}
